import { ICRC35Connection } from "../src";
import { ICRC35 } from "../src/index";
import { ErrorCode, ICRC35Error, delay } from "../src/utils";
import { TestMsgPipe, originA, originB } from "./utils";

describe("icrc35 connection", () => {
  it("should be able to establish and close connection", async () => {
    const [endpointA, endpointB] = await make();

    expect(endpointA.plugins.ICRC35Connection.isActive()).toBe(true);
    expect(endpointB.plugins.ICRC35Connection.isActive()).toBe(true);

    expect(endpointA.plugins.ICRC35Connection.peerOrigin).toBe(originB);
    expect(endpointB.plugins.ICRC35Connection.peerOrigin).toBe(originA);

    const p = new Promise<void>((res, rej) => {
      endpointA.plugins.ICRC35Connection.onConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
    });

    endpointB.plugins.ICRC35Connection.close();

    await p;
  });

  it("should keep the connection alive on inactivity", async () => {
    const [endpointA, endpointB] = await make();

    await delay(1000 * 10);

    const p = new Promise<void>((res, rej) => {
      endpointA.plugins.ICRC35Connection.onConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
    });

    endpointB.plugins.ICRC35Connection.close();

    await p;
  });

  it("should disconnect on timeout", async () => {
    const [endpointA, endpointB] = await make({ breakConnectionAfterHandshake: true });

    const pA = new Promise<void>((res, rej) => {
      endpointA.plugins.ICRC35Connection.onConnectionClosed((reason) => (reason === "timed out" ? res() : rej()));
    });

    const pB = new Promise<void>((res, rej) => {
      endpointB.plugins.ICRC35Connection.onConnectionClosed((reason) => (reason === "timed out" ? res() : rej()));
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
    const [endpointA, endpointB] = await make();
    let aDone = false;

    endpointA.plugins.ICRC35Connection.onMessage((msg: TestMessage) => {
      if (msg.a === 0) {
        endpointA.plugins.ICRC35Connection.sendMessage({
          a: 1,
          b: "test1",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 2) {
        endpointA.plugins.ICRC35Connection.sendMessage({
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

    endpointB.plugins.ICRC35Connection.onMessage((msg: TestMessage) => {
      if (msg.a === 1) {
        endpointB.plugins.ICRC35Connection.sendMessage({
          a: 2,
          b: "test2",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 3) {
        endpointB.plugins.ICRC35Connection.sendMessage({
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

    endpointB.plugins.ICRC35Connection.sendMessage({
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
      endpointA.plugins.ICRC35Connection.onConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
    });

    endpointB.plugins.ICRC35Connection.close();

    await p;
  });

  it("child should be able to filter a connection out", async () => {
    const pipeAB = new TestMsgPipe(originA, originB);
    const pipeBA = new TestMsgPipe(originB, originA);

    let blacklistWorks = false;

    try {
      const connectionAP = ICRC35Connection.establish({
        peer: pipeBA,
        peerOrigin: originB,
        listener: pipeAB,
        mode: "parent",
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
        peerOrigin: originB,
        listener: pipeAB,
        mode: "parent",
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

async function make(config?: { breakConnectionAfterHandshake: boolean }) {
  const pipeAB = new TestMsgPipe(originA, originB);
  const pipeBA = new TestMsgPipe(originB, originA);

  const connectionAP = ICRC35Connection.establish({
    peer: pipeBA,
    peerOrigin: originB,
    listener: pipeAB,
    mode: "parent",
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

  const endpointA = new ICRC35(connectionA);
  const endpointB = new ICRC35(connectionB);

  return [endpointA, endpointB];
}
