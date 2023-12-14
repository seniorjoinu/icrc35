import { ICRC35Connection } from "../src";
import { ICRC35AsyncRequest } from "../src/plugins/async.plugin";
import { ICRC35 } from "../src/index";
import { ErrorCode, ICRC35Error } from "../src/utils";
import { TestMsgPipe, originA, originB } from "./utils";

describe("async plugin", () => {
  it("should be able to receive a request and respond", async () => {
    const [endpointA, endpointB] = await make();

    const responsePromise = endpointA.plugins.ICRC35Async.call("test:123", { a: 1, b: "2" });

    let request: any = await endpointB.plugins.ICRC35Async.next();

    expect(request).toBeDefined();
    expect(request).toBeInstanceOf(ICRC35AsyncRequest);
    expect(request!.route).toBe("test:123");
    expect(request!.body).toBeDefined();
    expect(typeof request!.body).toBe("object");
    expect((request!.body as { a: number }).a).toBe(1);
    expect((request!.body as { b: string }).b).toBe("2");

    request!.respond(true);

    const response = (await responsePromise) as boolean;

    expect(typeof response).toBe("boolean");
    expect(response).toBe(true);

    endpointA.plugins.ICRC35Connection.close();
    endpointB.plugins.ICRC35Connection.close();
  });

  it("should cancel promises on closed connection", async () => {
    let thrown1 = false;

    try {
      const [endpointA, endpointB] = await make();

      const responsePromise1 = endpointA.plugins.ICRC35Async.call("test:abc:def", true);
      const responsePromise2 = endpointA.plugins.ICRC35Async.call("test:abc:def", true);

      endpointB.plugins.ICRC35Connection.close();
      endpointA.plugins.ICRC35Connection.close();

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
      const [endpointA, endpointB] = await make();

      const responsePromise1 = endpointA.plugins.ICRC35Async.call("test:abc:def", true);
      const responsePromise2 = endpointA.plugins.ICRC35Async.call("test:abc:def", true);

      // closed in different order
      endpointA.plugins.ICRC35Connection.close();
      endpointB.plugins.ICRC35Connection.close();

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
    const [endpointA, endpointB] = await make();

    const responsePromise1 = endpointA.plugins.ICRC35Async.call("test:abc:def", { a: 1 });
    const responsePromise2 = endpointA.plugins.ICRC35Async.call("test:abc:def", { a: 2 });

    const request1 = await endpointB.plugins.ICRC35Async.next(["test:abc:def"]);
    const request2 = await endpointB.plugins.ICRC35Async.next(["test:abc:def"]);

    expect((request1.body as { a: number }).a).toBe(1);
    expect((request2.body as { a: number }).a).toBe(2);

    request1.respond(undefined);
    request2.respond(undefined);

    await responsePromise1;
    await responsePromise2;

    endpointA.plugins.ICRC35Connection.close();
    endpointB.plugins.ICRC35Connection.close();
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
