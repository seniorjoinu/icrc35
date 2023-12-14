import {
  AfterCloseHandlerFn,
  BeforeCloseHandlerFn,
  ConnectionClosedReason,
  HandlerFn,
  ICRC35ConnectionChildConfig,
  ICRC35ConnectionParentConfig,
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
  private msgHandlers: HandlerFn[] = [];
  private beforeCloseHandlers: BeforeCloseHandlerFn[] = [];
  private afterCloseHandlers: AfterCloseHandlerFn[] = [];
  private debug: boolean;

  static async establish<P extends IPeer, L extends IListener>(
    config: ICRC35ConnectionChildConfig<P, L> | ICRC35ConnectionParentConfig<P, L>
  ): Promise<IICRC35Connection> {
    const it = new ICRC35Connection<P, L>(config);

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

  sendMessage(msg: any, transfer?: Transferable[]) {
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
    this.msgHandlers.push(handler);
  }

  removeMessageHandler(handler: HandlerFn) {
    const idx = this.msgHandlers.indexOf(handler);
    if (idx < 0) return;

    this.msgHandlers.splice(idx, 1);
  }

  close() {
    if (!this.isActive()) return;

    for (let beforeCloseHandler of this.beforeCloseHandlers) {
      beforeCloseHandler();
    }
    this.beforeCloseHandlers = [];

    const msg: IConnectionClosedMsg = {
      domain: "icrc-35",
      kind: "ConnectionClosed",
    };
    this.peer.postMessage(msg, this.peerOrigin!);

    if (this.debug) {
      log(this.listener.origin, "sent message", msg, "from", this.peerOrigin);
    }

    this.handleConnectionClosed("closed by this");
  }

  onBeforeConnectionClosed(handler: BeforeCloseHandlerFn): void {
    this.beforeCloseHandlers.push(handler);
  }

  removeBeforeConnectionClosedHandler(handler: BeforeCloseHandlerFn): void {
    const idx = this.beforeCloseHandlers.indexOf(handler);
    if (idx < 0) return;

    this.beforeCloseHandlers.splice(idx, 1);
  }

  onAfterConnectionClosed(handler: AfterCloseHandlerFn) {
    this.afterCloseHandlers.push(handler);
  }

  removeAfterConnectionClosedHandler(handler: AfterCloseHandlerFn) {
    const idx = this.afterCloseHandlers.indexOf(handler);
    if (idx < 0) return;

    this.afterCloseHandlers.splice(idx, 1);
  }

  isActive(): this is { peer: P; peerOrigin: string } {
    return this._peer !== null && this._peerOrigin !== null;
  }

  get peer() {
    return this._peer;
  }

  get peerOrigin() {
    return this._peerOrigin!;
  }

  get listener() {
    return this._listener;
  }

  private listen = (ev: MessageEvent<any>) => {
    // pass if the connection is already closed
    if (!this.isActive()) return;

    // ignore events coming from other origins
    if (ev.origin !== this.peerOrigin) return;

    const res = ZMsg.safeParse(ev.data);

    // ignore non-icrc35 messages
    if (!res.success) return;

    if (this.debug) {
      log(this.listener.origin, "received message", ev.data, "from", ev.origin);
    }

    switch (res.data.kind) {
      case "ConnectionClosed": {
        const r = ZConnectionClosedMsg.safeParse(res.data);
        if (!r.success) return;

        this.handleConnectionClosed("closed by peer");
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
        this.handleConnectionClosed("timed out");
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

  private handleConnectionClosed(reason: ConnectionClosedReason) {
    this._peer = null;
    this.listener.removeEventListener("message", this.listen);
    this.msgHandlers = [];

    for (let afterCloseHandler of this.afterCloseHandlers) {
      afterCloseHandler(reason);
    }

    this.afterCloseHandlers = [];
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

    for (let handler of this.msgHandlers) {
      handler(data);
    }
  }

  private updateTimestamp() {
    this.lastReceivedMsgTimestamp = Date.now();
  }

  private constructor(config: ICRC35ConnectionChildConfig<P, L> | ICRC35ConnectionParentConfig<P, L>) {
    const parsedConfig = ZICRC35ConnectionConfig.parse(config);

    this._peer = parsedConfig.peer as P;
    if (!parsedConfig.listener) {
      this._listener = defaultListener() as L;
    } else {
      this._listener = parsedConfig.listener as L;
    }

    this.debug = parsedConfig.debug || DEFAULT_DEBUG;

    if (parsedConfig.mode === "parent") {
      this.mode = ZEndpointParentMode.parse(parsedConfig);
      this._peerOrigin = parsedConfig.peerOrigin!;
    } else {
      this.mode = ZEndpointChildMode.parse(parsedConfig);
    }
  }

  private childHandshake(resolve: ResolveFn, reject: RejectFn) {
    const secret = generateSecret();

    if (this.debug) {
      log(this.listener.origin, "child-level handshake started...");
    }

    const handler = (ev: MessageEvent<any>) => {
      // pass other events originated from this page
      if (ev.origin === this.listener.origin) return;

      // pass other events
      const res = ZHandshakeCompleteMsg.safeParse(ev.data);
      if (!res.success) return;

      if (this.debug) {
        log(this.listener.origin, "received message", ev.data, "from", ev.origin);
      }

      // pass events with other secrets (this would mean some other page is trying to get in)
      if (!isEqualUint8Arr(secret, res.data.secret)) {
        if (this.debug) {
          log(this.listener.origin, "incorrect secret, ignoring...");
        }

        return;
      }

      if (!this.childExpectsPeer(ev.origin)) {
        this.listener.removeEventListener("message", handler);
        reject(new ICRC35Error(ErrorCode.UNEXPECTED_PEER, `Did not expect a connection from peer '${ev.origin}'`));

        return;
      }

      if (this.debug) {
        log(this.listener.origin, `child-level handshake complete, peer origin = ${ev.origin}`);
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
    if (this.debug) {
      log(this.listener.origin, "parent-level handshake started...");
    }

    const handler = (ev: MessageEvent<any>) => {
      // pass other events originated from this page
      if (ev.origin === this.listener.origin) return;

      // pass other events
      const res = ZHandshakeInitMsg.safeParse(ev.data);
      if (!res.success) return;

      if (this.debug) {
        log(this.listener.origin, "received message", ev.data, "from", ev.origin);
      }

      const msg: IHandshakeCompleteMsg = {
        domain: "icrc-35",
        kind: "HandshakeComplete",
        secret: res.data.secret,
      };

      if (this.debug) {
        log(this.listener.origin, `parent-level handshake complete, peer origin = ${this._peerOrigin}`);
      }

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
