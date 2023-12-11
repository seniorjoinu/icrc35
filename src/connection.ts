import {
  CloseHandlerFn,
  HandlerFn,
  ICRC35ConnectionConfig,
  IConnectionClosedMsg,
  ICustomMsg,
  IEndpointChildMode,
  IEndpointParentMode,
  IHandshakeCompleteMsg,
  IHandshakeInitMsg,
  IICRC35Connection,
  IListener,
  IPeer,
  IPingMsg,
  IPongMsg,
  RejectFn,
  ResolveFn,
  TOrigin,
  ZConnectionClosedMsg,
  ZCustomMsg,
  ZEndpointChildMode,
  ZEndpointParentMode,
  ZHandshakeCompleteMsg,
  ZHandshakeInitMsg,
  ZICRC35ConnectionConfig,
  ZMsg,
  ZPingMsg,
  ZPongMsg,
} from "./types";
import {
  ErrorCode,
  ICRC35Error,
  generateDefaultFilter,
  generateSecret,
  isEqualUint8Arr,
  delay,
  defaultListener,
  log,
} from "./utils";
import { DEFAULT_DEBUG, ICRC35_CONNECTION_TIMEOUT_MS, ICRC35_PING_TIMEOUT_MS } from "./consts";

export class ICRC35Connection<P extends IPeer, L extends IListener> implements IICRC35Connection {
  private _peer: P | null = null;
  private _peerOrigin: TOrigin | null = null;
  private _listener: L;
  private mode: IEndpointChildMode | IEndpointParentMode;
  private lastReceivedMsgTimestamp: number = 0;
  private handler: HandlerFn | null = null;
  private closeHandler: CloseHandlerFn | null = null;
  private debug: boolean;

  static async establish<P extends IPeer, L extends IListener>(
    config: ICRC35ConnectionConfig<P, L>
  ): Promise<ICRC35Connection<P, L>> {
    const it = new ICRC35Connection(config);

    await new Promise<void>((resolve, reject) => {
      if (config.mode === "child") {
        it.childHandshake(resolve, reject);
      } else {
        it.parentHandshake(resolve, reject);
      }
    });

    it.listener.addEventListener("message", it.listen);
    it.initPingPong();

    return it;
  }

  send(msg: any, transfer?: Transferable[]) {
    if (!this.isActive()) throw new ICRC35Error(ErrorCode.INVALID_STATE, "Connection closed");

    const _msg: ICustomMsg = {
      domain: "icrc-35",
      kind: "Custom",
      payload: msg,
    };

    this._peer!.postMessage(_msg, this._peerOrigin!, transfer);

    if (this.debug) {
      log(this.listener.origin, "sent message", msg, "to", this._peerOrigin);
    }
  }

  onMessage(handler: HandlerFn) {
    this.handler = handler;
  }

  close() {
    if (!this.isActive()) return;

    const msg: IConnectionClosedMsg = {
      domain: "icrc-35",
      kind: "ConnectionClosed",
    };
    this.peer.postMessage(msg, this.peerOrigin!);

    if (this.debug) {
      log(this.listener.origin, "sent message", msg, "from", this.peerOrigin);
    }

    this.handleConnectionClosed(null);
  }

  onConnectionClosed(handler: CloseHandlerFn) {
    this.closeHandler = handler;
  }

  isActive(): this is { peer: P; peerOrigin: string } {
    return this._peer !== null && this._peerOrigin !== null;
  }

  get peer() {
    return this._peer;
  }

  get peerOrigin() {
    return this._peerOrigin;
  }

  get listener() {
    return this._listener;
  }

  private listen = (ev: MessageEvent<any>) => {
    if (this.debug) {
      log(this.listener.origin, "received message", ev.data, "from", ev.origin);
    }

    // pass if the connection is already closed
    if (!this.isActive()) return;

    // ignore events coming from other origins
    if (ev.origin !== this.peerOrigin) return;

    const res = ZMsg.safeParse(ev.data);

    // ignore non-icrc35 messages
    if (!res.success) return;

    switch (res.data.kind) {
      case "ConnectionClosed": {
        const r = ZConnectionClosedMsg.safeParse(res.data);
        if (!r.success) return;

        this.handleConnectionClosed("close");
        return;
      }
      case "Ping": {
        const r = ZPingMsg.safeParse(res.data);
        if (!r.success) return;

        this.handlePing();
        return;
      }
      case "Pong": {
        const r = ZPongMsg.safeParse(res.data);
        if (!r.success) return;

        this.handlePong();
        return;
      }
      case "Custom": {
        const r = ZCustomMsg.safeParse(res.data);
        if (!r.success) return;

        this.handleCustom(res.data.payload);
        return;
      }

      // ignore other messages
      default:
        return;
    }
  };

  // this function will check the last interaction time
  // if this time was more than the <ping timeout> seconds ago, it will send a ping message, to which the other side should respond with pong
  // if there is no response for <connection timeout> seconds, the connection will be closed as stale
  private async initPingPong() {
    const int = setInterval(() => {
      if (!this.isActive()) {
        clearInterval(int);
        return;
      }

      const delta = Date.now() - this.lastReceivedMsgTimestamp;

      if (delta >= ICRC35_CONNECTION_TIMEOUT_MS) {
        this.handleConnectionClosed("timeout");
        clearInterval(int);
        return;
      }

      if (delta >= ICRC35_PING_TIMEOUT_MS) {
        const msg: IPingMsg = {
          domain: "icrc-35",
          kind: "Ping",
        };

        this._peer!.postMessage(msg, this.peerOrigin!);

        if (this.debug) {
          log(this.listener.origin, "sent message", msg, "to", this.peerOrigin);
        }

        return;
      }
    }, ICRC35_PING_TIMEOUT_MS);
  }

  private handleConnectionClosed(reason: "close" | "timeout" | null) {
    this._peer = null;
    this.listener.removeEventListener("message", this.listen);

    if (reason !== null && this.closeHandler !== null) {
      this.closeHandler(reason);
    }
  }

  private handlePing() {
    this.updateTimestamp();

    const msg: IPongMsg = {
      domain: "icrc-35",
      kind: "Pong",
    };

    this._peer!.postMessage(msg, this.peerOrigin!);

    if (this.debug) {
      log(this.listener.origin, "sent message", msg, "from", this.peerOrigin);
    }
  }

  private handlePong() {
    this.updateTimestamp();
  }

  private handleCustom(data: any) {
    this.updateTimestamp();

    if (!this.handler) return null;

    this.handler(data);
  }

  private updateTimestamp() {
    this.lastReceivedMsgTimestamp = Date.now();
  }

  private constructor(config: ICRC35ConnectionConfig<P, L>) {
    // @ts-expect-error - all we need here is to be able to call .postMessage() on the peer, we don't care about it's inner structure or subtypes
    config = ZICRC35ConnectionConfig.parse(config);

    this._peer = config.peer;
    if (!config.listener) {
      this._listener = defaultListener() as L;
    } else {
      this._listener = config.listener;
    }

    this.debug = config.debug || DEFAULT_DEBUG;

    if (config.mode === "parent") {
      this.mode = ZEndpointParentMode.parse(config);
      this._peerOrigin = this.mode.peerOrigin;
    } else {
      this.mode = ZEndpointChildMode.parse(config);
    }
  }

  private childHandshake(resolve: ResolveFn, reject: RejectFn) {
    const secret = generateSecret();

    const handler = (ev: MessageEvent<any>) => {
      if (this.debug) {
        log(this.listener.origin, "received message", ev.data, "from", ev.origin);
      }

      // pass other events originated from this page
      if (ev.origin === this.listener.origin) return;

      // pass other events
      const res = ZHandshakeCompleteMsg.safeParse(ev.data);
      if (!res.success) return;

      // pass events with other secrets (this would mean some other page is trying to get in)
      if (!isEqualUint8Arr(secret, res.data.secret)) return;

      if (!this.childExpectsPeer(ev.origin)) {
        this.listener.removeEventListener("message", handler);
        reject(new ICRC35Error(ErrorCode.UNEXPECTED_PEER, `Did not expect a connection from peer '${ev.origin}'`));

        return;
      }

      this.updateTimestamp();
      this._peerOrigin = ev.origin;
      this.listener.removeEventListener("message", handler);

      resolve();
    };

    this.listener.addEventListener("message", handler);

    const msg: IHandshakeInitMsg = {
      domain: "icrc-35",
      kind: "HandshakeInit",
      secret,
    };

    this._peer!.postMessage(msg, "*");

    if (this.debug) {
      log(this.listener.origin, "sent message", msg, "to *");
    }
  }

  private parentHandshake(resolve: ResolveFn, reject: RejectFn) {
    const handler = (ev: MessageEvent<any>) => {
      if (this.debug) {
        log(this.listener.origin, "received message", ev.data, "from", ev.origin);
      }

      // pass other events originated from this page
      if (ev.origin === this.listener.origin) return;

      // pass other events
      const res = ZHandshakeInitMsg.safeParse(ev.data);
      if (!res.success) return;

      const msg: IHandshakeCompleteMsg = {
        domain: "icrc-35",
        kind: "HandshakeComplete",
        secret: res.data.secret,
      };

      this.updateTimestamp();
      this._peer!.postMessage(msg, this._peerOrigin!);

      if (this.debug) {
        log(this.listener.origin, "sent message", msg, "to", this._peerOrigin);
      }

      this.listener.removeEventListener("message", handler);
      resolve();
    };

    this.listener.addEventListener("message", handler);
  }

  // returns true if the peer origin is valid
  private childExpectsPeer(peerOrigin: string): boolean {
    let filter = (this.mode as IEndpointChildMode).connectionFilter;

    // create a default filter (deny all)
    if (!filter) {
      filter = generateDefaultFilter();
      (this.mode as IEndpointChildMode).connectionFilter = filter;
    }

    if (filter.kind === "blacklist") {
      return !filter.list.includes(peerOrigin);
    } else {
      return filter.list.includes(peerOrigin);
    }
  }
}
