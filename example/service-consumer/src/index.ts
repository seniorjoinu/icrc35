import { ExampleClient } from "example-icrc35-client-library";
import { ICRC35Connection, openICRC35Window } from "icrc-35";

const btn = document.getElementById("greet-btn")!;
const input = document.getElementById("greet-input")! as HTMLInputElement;

btn.addEventListener("click", async () => {
  const connection = await ICRC35Connection.establish({
    mode: "parent",
    debug: true,
    ...openICRC35Window("http://localhost:8092"),
  });

  const client = new ExampleClient(connection);
  const greeting = await client.greet(input.value);

  setTimeout(() => alert(greeting.result), 10);
});
