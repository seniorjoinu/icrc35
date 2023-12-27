import { GREET_ROUTE, ISharedRequest, ISharedResponse } from "example-icrc35-shared-library";
import { ICRC35Connection } from "icrc-35";

if (window.location.pathname !== "/icrc-35") {
  alert("Wrong ICRC-35 path: go to /icrc-35");
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

  // wait for a request from peer
  connection.onRequest(GREET_ROUTE, (request) => {
    // validate inputs
    const body = request.payload as ISharedRequest;
    if (typeof body !== "object" || !body.name || typeof body.name !== "string") {
      throw new Error("Invalid request");
    }

    // calculate output and respond
    const greeting: ISharedResponse = { result: `Hello, ${body.name}` };
    request.respond(greeting);

    // close the connection and the window
    connection.close();
    window.close();
  });
});
