import { ICRC35Connection, IPeer } from "../src";
import { IListener } from "../src/types";
import { ErrorCode, ICRC35Error, delay } from "../src/utils";

const originA = "https://a.com";
const originB = "https://b.com";

async function make(config?: { breakConnectionAfterHandshake: boolean }) {
  const pipeAB = new TestMsgPipe(originA, originB);
  const pipeBA = new TestMsgPipe(originB, originA);

  const connectionAP = ICRC35Connection.establish({
    peer: pipeBA,
    listener: pipeAB,
    mode: "parent",
    peerOrigin: originB,
    debug: true,
  });

  const connectionB = await ICRC35Connection.establish({
    peer: pipeAB,
    listener: pipeBA,
    mode: "child",
    connectionFilter: {
      kind: "blacklist",
      list: [],
    },
    debug: true,
  });

  const connectionA = await connectionAP;

  if (config?.breakConnectionAfterHandshake) {
    pipeAB.break();
    pipeBA.break();
  }

  return [connectionA, connectionB];
}

describe("icrc35 connection", () => {
  it("should be able to establish and close connection", async () => {
    const [connectionA, connectionB] = await make();

    expect(connectionA.isActive()).toBe(true);
    expect(connectionB.isActive()).toBe(true);

    expect(connectionA.peerOrigin).toBe(originB);
    expect(connectionB.peerOrigin).toBe(originA);

    const p = new Promise<void>((res, rej) => {
      connectionA.onConnectionClosed((reason) => (reason === "close" ? res() : rej()));
    });

    connectionB.close();

    await p;
  });

  it("should keep the connection alive on inactivity", async () => {
    const [connectionA, connectionB] = await make();

    await delay(1000 * 10);

    const p = new Promise<void>((res, rej) => {
      connectionA.onConnectionClosed((reason) => (reason === "close" ? res() : rej()));
    });

    connectionB.close();

    await p;
  });

  it("should disconnect on timeout", async () => {
    const [connectionA, connectionB] = await make({ breakConnectionAfterHandshake: true });

    const pA = new Promise<void>((res, rej) => {
      connectionA.onConnectionClosed((reason) => (reason === "timeout" ? res() : rej()));
    });

    const pB = new Promise<void>((res, rej) => {
      connectionB.onConnectionClosed((reason) => (reason === "timeout" ? res() : rej()));
    });

    await Promise.all([pA, pB]);
  });

  type TestMessage = {
    a: number;
    b: string;
    c: {
      d: Date;
    };
  };

  it("should pass messages back and forth", async () => {
    const [connectionA, connectionB] = await make();
    let aDone = false;

    connectionA.onMessage((msg: TestMessage) => {
      if (msg.a === 0) {
        connectionA.sendMessage({
          a: 1,
          b: "test1",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 2) {
        connectionA.sendMessage({
          a: 3,
          b: "test3",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 4) {
        aDone = true;
      }
    });

    let bDone = false;

    connectionB.onMessage((msg: TestMessage) => {
      if (msg.a === 1) {
        connectionB.sendMessage({
          a: 2,
          b: "test2",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 3) {
        connectionB.sendMessage({
          a: 4,
          b: "test4",
          c: {
            d: new Date(),
          },
        });

        bDone = true;
        return;
      }
    });

    connectionB.sendMessage({
      a: 0,
      b: "test0",
      c: {
        d: new Date(),
      },
    });

    while (!(aDone && bDone)) {
      await delay(50);
    }

    const p = new Promise<void>((res, rej) => {
      connectionA.onConnectionClosed((reason) => (reason === "close" ? res() : rej()));
    });

    connectionB.close();

    await p;
  });

  it("child should be able to filter a connection out", async () => {
    const pipeAB = new TestMsgPipe(originA, originB);
    const pipeBA = new TestMsgPipe(originB, originA);

    let blacklistWorks = false;

    try {
      const connectionAP = ICRC35Connection.establish({
        peer: pipeBA,
        listener: pipeAB,
        mode: "parent",
        peerOrigin: originB,
        debug: true,
      });

      const connectionB = await ICRC35Connection.establish({
        peer: pipeAB,
        listener: pipeBA,
        mode: "child",
        connectionFilter: {
          kind: "blacklist",
          list: [originA],
        },
        debug: true,
      });

      const connectionA = await connectionAP;
    } catch (e) {
      if (e instanceof ICRC35Error) {
        if (e.code === ErrorCode.UNEXPECTED_PEER) {
          blacklistWorks = true;
        }
      }
    }

    expect(blacklistWorks).toBe(true);

    let whitelistWorks = false;

    try {
      const connectionAP = ICRC35Connection.establish({
        peer: pipeBA,
        listener: pipeAB,
        mode: "parent",
        peerOrigin: originB,
        debug: true,
      });

      const connectionB = await ICRC35Connection.establish({
        peer: pipeAB,
        listener: pipeBA,
        mode: "child",
        connectionFilter: {
          kind: "whitelist",
          list: [],
        },
        debug: true,
      });

      const connectionA = await connectionAP;
    } catch (e) {
      if (e instanceof ICRC35Error) {
        if (e.code === ErrorCode.UNEXPECTED_PEER) {
          whitelistWorks = true;
        }
      }
    }

    expect(whitelistWorks).toBe(true);
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
