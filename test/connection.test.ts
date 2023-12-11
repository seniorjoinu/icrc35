import { ICRC35Connection, IPeer } from "../src";
import { IListener } from "../src/types";
import { delay } from "../src/utils";

const originA = "https://a.com";
const originB = "https://b.com";

async function make(config?: { breakConnectionAfterHandshake: boolean }) {
  const pipeAB = new TestMsgPipe(originA, originB);
  const pipeBA = new TestMsgPipe(originB, originA);

  const windowAP = ICRC35Connection.establish({
    peer: pipeBA,
    listener: pipeAB,
    mode: "parent",
    peerOrigin: originB,
    debug: true,
  });

  const windowB = await ICRC35Connection.establish({
    peer: pipeAB,
    listener: pipeBA,
    mode: "child",
    connectionFilter: {
      kind: "blacklist",
      list: [],
    },
    debug: true,
  });

  const windowA = await windowAP;

  if (config?.breakConnectionAfterHandshake) {
    pipeAB.break();
    pipeBA.break();
  }

  return [windowA, windowB];
}

describe("icrc35 connection", () => {
  it("should be able to establish and close connection", async () => {
    const [windowA, windowB] = await make();

    expect(windowA.isActive()).toBe(true);
    expect(windowB.isActive()).toBe(true);

    expect(windowA.peerOrigin).toBe(originB);
    expect(windowB.peerOrigin).toBe(originA);

    const p = new Promise<void>((res, rej) => {
      windowA.onConnectionClosed((reason) => (reason === "close" ? res() : rej()));
    });

    windowB.close();

    await p;
  });

  it("should keep the connection alive on inactivity", async () => {
    const [windowA, windowB] = await make();

    await delay(1000 * 10);

    const p = new Promise<void>((res, rej) => {
      windowA.onConnectionClosed((reason) => (reason === "close" ? res() : rej()));
    });

    windowB.close();

    await p;
  });

  it("should disconnect on timeout", async () => {
    const [windowA, windowB] = await make({ breakConnectionAfterHandshake: true });

    const pA = new Promise<void>((res, rej) => {
      windowA.onConnectionClosed((reason) => (reason === "timeout" ? res() : rej()));
    });

    const pB = new Promise<void>((res, rej) => {
      windowB.onConnectionClosed((reason) => (reason === "timeout" ? res() : rej()));
    });

    await Promise.all([pA, pB]);
  });
});

class TestMsgPipe implements IPeer, IListener {
  origin: string;
  peerOrigin: string;
  listeners: ((ev: MessageEvent<unknown>) => void)[] = [];
  private broken: boolean = false;

  constructor(myOrigin: string, peerOrigin: string) {
    this.origin = myOrigin;
    this.peerOrigin = peerOrigin;
  }

  break() {
    this.broken = true;
  }

  addEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx < 0) return;

    this.listeners.splice(idx, 1);
  }

  postMessage(message: any, targetOrigin: string, transfer?: Transferable[] | undefined) {
    const ev: MessageEvent<any> = {
      data: message,
      type: "message",
      origin: this.peerOrigin,
      lastEventId: "",
      ports: [],
      source: null,
      initMessageEvent: () => {},
      bubbles: false,
      cancelBubble: false,
      cancelable: false,
      composed: false,
      currentTarget: null,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      returnValue: false,
      srcElement: null,
      target: null,
      timeStamp: 0,
      composedPath: () => [],
      initEvent: () => {},
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      stopPropagation: () => {},
      NONE: 0,
      CAPTURING_PHASE: 1,
      AT_TARGET: 2,
      BUBBLING_PHASE: 3,
    };

    if (this.broken) return;

    // emulate multi-threading
    setTimeout(() => {
      for (let listener of this.listeners) {
        listener(ev);
      }
    }, 10);
  }
}
