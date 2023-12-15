import { ICRC35Connection } from "../src";
import { ICRC35AsyncRequest } from "../src/types";
import { ErrorCode, ICRC35Error, delay } from "../src/utils";
import { TestMsgPipe, make, originA, originB } from "./utils";

describe("common connection", () => {
  it("should be able to establish and close connection", async () => {
    const [connectionA, connectionB] = await make();

    expect(connectionA.isActive()).toBe(true);
    expect(connectionB.isActive()).toBe(true);

    expect(connectionA.peerOrigin).toBe(originB);
    expect(connectionB.peerOrigin).toBe(originA);

    const p = new Promise<void>((res, rej) => {
      connectionA.onAfterConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
    });

    connectionB.close();

    await p;
  });

  it("should keep the connection alive on inactivity", async () => {
    const [connectionA, connectionB] = await make();

    await delay(1000 * 10);

    const p = new Promise<void>((res, rej) => {
      connectionA.onAfterConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
    });

    connectionB.close();

    await p;
  });

  it("should disconnect on timeout", async () => {
    const [connectionA, connectionB] = await make({ breakConnectionAfterHandshake: true });

    const pA = new Promise<void>((res, rej) => {
      connectionA.onAfterConnectionClosed((reason) => (reason === "timed out" ? res() : rej()));
    });

    const pB = new Promise<void>((res, rej) => {
      connectionB.onAfterConnectionClosed((reason) => (reason === "timed out" ? res() : rej()));
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

  it("should pass common messages back and forth", async () => {
    const [connectionA, connectionB] = await make();
    let aDone = false;

    connectionA.onCommonMessage((msg: TestMessage) => {
      if (msg.a === 0) {
        connectionA.sendCommonMessage({
          a: 1,
          b: "test1",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 2) {
        connectionA.sendCommonMessage({
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

    connectionB.onCommonMessage((msg: TestMessage) => {
      if (msg.a === 1) {
        connectionB.sendCommonMessage({
          a: 2,
          b: "test2",
          c: {
            d: new Date(),
          },
        });

        return;
      }

      if (msg.a === 3) {
        connectionB.sendCommonMessage({
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

    connectionB.sendCommonMessage({
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
      connectionA.onAfterConnectionClosed((reason) => (reason === "closed by peer" ? res() : rej()));
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

describe("async connection", () => {
  it("should be able to receive a request and respond", async () => {
    const [connectionA, connectionB] = await make();

    const responsePromise = connectionA.request("test:123", { a: 1, b: "2" });

    let request: any = await connectionB.nextRequest();

    expect(request).toBeDefined();
    expect(request).toBeInstanceOf(ICRC35AsyncRequest);
    expect(request!.route).toBe("test:123");
    expect(request!.payload).toBeDefined();
    expect(typeof request!.payload).toBe("object");
    expect((request!.payload as { a: number }).a).toBe(1);
    expect((request!.payload as { b: string }).b).toBe("2");

    request!.respond(true);

    const response = (await responsePromise) as boolean;

    expect(typeof response).toBe("boolean");
    expect(response).toBe(true);

    connectionA.close();
    connectionB.close();
  });

  it("should cancel promises on closed connection", async () => {
    let thrown1 = false;

    try {
      const [connectionA, connectionB] = await make();

      const responsePromise1 = connectionA.request("test:abc:def", true);
      const responsePromise2 = connectionA.request("test:abc:def", true);

      connectionB.close();
      connectionA.close();

      await Promise.all([responsePromise1, responsePromise2]);
    } catch (e) {
      if (e instanceof ICRC35Error) {
        if (e.code === ErrorCode.INVALID_STATE) {
          thrown1 = true;
        }
      }
    }

    expect(thrown1).toBe(true);

    let thrown2 = false;

    try {
      const [connectionA, connectionB] = await make();

      const responsePromise1 = connectionA.request("test:abc:def", true);
      const responsePromise2 = connectionA.request("test:abc:def", true);

      // closed in different order
      connectionA.close();
      connectionB.close();

      await Promise.all([responsePromise1, responsePromise2]);
    } catch (e) {
      if (e instanceof ICRC35Error) {
        if (e.code === ErrorCode.INVALID_STATE) {
          thrown2 = true;
        }
      }
    }

    expect(thrown2).toBe(true);
  });

  it("should allow multiple concurrent requests to be processed in the same order", async () => {
    const [connectionA, connectionB] = await make();

    const responsePromise1 = connectionA.request("test:abc:def", { a: 1 });
    const responsePromise2 = connectionA.request("test:abc:def", { a: 2 });

    const request1 = await connectionB.nextRequest(["test:abc:def"]);
    const request2 = await connectionB.nextRequest(["test:abc:def"]);

    expect((request1.payload as { a: number }).a).toBe(1);
    expect((request2.payload as { a: number }).a).toBe(2);

    request1.respond(undefined);
    request2.respond(undefined);

    await responsePromise1;
    await responsePromise2;

    connectionA.close();
    connectionB.close();
  });
});
