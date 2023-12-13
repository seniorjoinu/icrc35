import { ExamplePlugin } from "example-icrc35-plugin";
import { Base, ICRC35AsyncPlugin, ICRC35Connection, ICRC35ConnectionPlugin, IPeer } from "icrc-35";

if (window.location.pathname !== "/icrc35") {
  alert("Wrong ICRC-35 path: go to /icrc35");
}

if (!window.opener) {
  alert("No ICRC-35 peer detected");
}

window.addEventListener("load", async () => {
  // establish ICRC-35 connection
  const peer = window.opener as IPeer;
  const connection = await ICRC35Connection.establish({
    mode: "child",
    connectionFilter: {
      kind: "blacklist",
      list: [],
    },
    peer,
    debug: true,
  });

  // create plugin system
  const connectionPlugin = new ICRC35ConnectionPlugin(connection);
  const asyncPlugin = new ICRC35AsyncPlugin();
  const examplePlugin: ExamplePlugin = new ExamplePlugin();

  const endpoint = new Base({
    [connectionPlugin.getName()]: connectionPlugin,
    [asyncPlugin.getName()]: asyncPlugin,
    [examplePlugin.getName()]: examplePlugin,
  });

  // wait for a request from peer
  let greetRequest = await endpoint.plugins.ICRC35Async.asyncNext();

  // ignore all other routes
  switch (greetRequest.route) {
    case ExamplePlugin.GreetRoute:
      break;

    default:
      return;
  }

  // validate inputs
  const name = greetRequest.body as string;

  if (typeof name !== "string") {
    throw new Error(`Invalid request body, expected string`);
  }

  // calculate output and respond
  const greeting = `Hello, ${name}`;

  greetRequest.respond(greeting);

  // close the connection and the window
  setTimeout(() => {
    endpoint.plugins.ICRC35Connection.close();
    window.close();
  }, 100);
});
