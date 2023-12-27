import { ExampleServer, ISharedRequest, ISharedResponse } from "example-icrc35-client-library";
import { ICRC35Connection } from "icrc-35";
import { generateDefaultFilter } from "icrc-35/dist/esm/utils";

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
    connectionFilter: generateDefaultFilter(),
    peer: window.opener,
    debug: true,
  });
  const server = new ExampleServer(connection);

  // wait for a request from peer
  let greetRequest = await server.nextGreetRequest();

  // validate inputs
  const body = greetRequest.payload as ISharedRequest;
  if (typeof body !== "object" || !body.name || typeof body.name !== "string") {
    throw new Error("Invalid request");
  }

  // calculate output and respond
  const greeting: ISharedResponse = { result: `Hello, ${body.name}` };
  greetRequest.respond(greeting);

  // close the connection and the window
  connection.close();
  window.close();
});
