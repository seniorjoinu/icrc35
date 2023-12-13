import { Plugin } from "../src/plugins/plugin-system";
import { ICRC35AsyncPlugin } from "../src/plugins/async.plugin";

export class ExamplePlugin<
  P extends { ICRC35Async: ICRC35AsyncPlugin } = { ICRC35Async: ICRC35AsyncPlugin }
> extends Plugin<"Example", P> {
  protected init(): void {
    this.base.assertHasPlugin("ICRC35Async");
  }

  getName(): "Example" {
    return "Example";
  }

  async greet(name: string): Promise<string> {
    const greeting: string = await this.base.plugins.ICRC35Async.call("example:greet", name);

    if (typeof greeting !== "string") throw new Error("Invalid response");

    return greeting;
  }
}

describe("example", () => {
  it("should work", async () => {});
});
