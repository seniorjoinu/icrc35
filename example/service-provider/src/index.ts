import { ExamplePlugin } from "example-icrc35-plugin";
import { ICRC35, ICRC35Connection } from "icrc-35";

if (window.location.pathname !== "/icrc35") {
  alert("Wrong ICRC-35 path: go to /icrc35");
}

if (!window.opener) {
  alert("No ICRC-35 peer detected");
}

window.addEventListener("load", async () => {
  // establish ICRC-35 connection
  const connection = await ICRC35Connection.establish({
    mode: "child",
    connectionFilter: {
      kind: "blacklist",
      list: [],
    },
    peer: window.opener,
    debug: true,
  });

  // the receiver side does not need to enable the plugin, if it only receives requests and responds to them, without sending requests itself
  const icrc35 = new ICRC35(connection);

  // wait for a request from peer
  let greetRequest = await icrc35.plugins.ICRC35Async.next([ExamplePlugin.GreetRoute]);

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
    icrc35.plugins.ICRC35Connection.close();
    window.close();
  }, 100);
});
