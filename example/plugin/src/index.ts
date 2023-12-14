import { ICRC35Plugin } from "icrc-35";

export class ExamplePlugin extends ICRC35Plugin<"Example"> {
  protected init(): void {
    this.base.assertHasPlugin("ICRC35Async");
  }

  getName(): "Example" {
    return "Example";
  }

  static GreetRoute: string = "example:greet";

  async greet(name: string): Promise<string> {
    const greeting = await this.base.plugins.ICRC35Async.call(ExamplePlugin.GreetRoute, name);

    if (typeof greeting !== "string") {
      throw new Error("Invalid response");
    }

    return greeting;
  }
}
