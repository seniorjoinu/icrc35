import { ExamplePlugin } from "example-icrc35-plugin";
import { ICRC35, ICRC35Connection, openICRC35Window } from "icrc-35";

const btn = document.getElementById("greet-btn")!;
const input = document.getElementById("greet-input")! as HTMLInputElement;

btn.addEventListener("click", async () => {
  const connection = await ICRC35Connection.establish({
    mode: "parent",
    debug: true,
    ...openICRC35Window("http://localhost:8092"),
  });
  const examplePlugin = new ExamplePlugin();
  const icrc35 = new ICRC35(connection, { [examplePlugin.getName()]: examplePlugin });

  const name = input.value;
  const greeting = await icrc35.plugins.Example.greet(name);

  alert(greeting);
});
