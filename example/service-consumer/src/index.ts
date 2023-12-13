import { ExamplePlugin } from "example-icrc35-plugin";
import { Base, ICRC35AsyncPlugin, ICRC35Connection, openICRC35Window, ICRC35ConnectionPlugin } from "icrc-35";

const btn = document.getElementById("greet-btn")!;
const input = document.getElementById("greet-input")! as HTMLInputElement;

btn.addEventListener("click", async () => {
  const peerOrigin = "http://localhost:8092";
  const peer = openICRC35Window(peerOrigin);

  const connection = await ICRC35Connection.establish({
    mode: "parent",
    peer,
    peerOrigin,
    debug: true,
  });

  const connectionPlugin = new ICRC35ConnectionPlugin(connection);
  const asyncPlugin = new ICRC35AsyncPlugin();
  const examplePlugin: ExamplePlugin = new ExamplePlugin();

  const endpoint = new Base({
    [connectionPlugin.getName()]: connectionPlugin,
    [asyncPlugin.getName()]: asyncPlugin,
    [examplePlugin.getName()]: examplePlugin,
  });

  const name = input.value;
  const greeting = await endpoint.plugins.Example.greet(name);

  alert(greeting);
});
