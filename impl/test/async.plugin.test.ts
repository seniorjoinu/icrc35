import { ICRC35Connection } from "../src";
import { ICRC35AsyncRequest } from "../src/plugins/async.plugin";
import { ICRC35 } from "../src/index";
import { ErrorCode, ICRC35Error } from "../src/utils";
import { TestMsgPipe, originA, originB } from "./utils";

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
