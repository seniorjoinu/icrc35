import { Base, Plugin } from "../src/plugins/plugin-system";
import { ErrorCode, ICRC35Error } from "../src/utils";

class PluginA extends Plugin<"PluginA"> {
  protected init(): void {}

  a() {
    return 1;
  }

  getName(): "PluginA" {
    return "PluginA";
  }
}

class PluginB<P extends { PluginA: PluginA } = { PluginA: PluginA }> extends Plugin<"PluginB", P> {
  protected init(): void {
    this.base.assertHasPlugin("PluginA");
  }

  b() {
    return this.base.plugins.PluginA.a() + 2;
  }

  getName(): "PluginB" {
    return "PluginB";
  }
}

class PluginC<P extends { PluginA: PluginA; PluginB: PluginB } = { PluginA: PluginA; PluginB: PluginB }> extends Plugin<
  "PluginC",
  P
> {
  protected init(): void {
    this.base.assertHasPlugin("PluginA");
    this.base.assertHasPlugin("PluginB");
  }

  c() {
    return this.base.plugins.PluginA.a() + this.base.plugins.PluginB.b() + 3;
  }

  getName(): "PluginC" {
    return "PluginC";
  }
}

describe("plugin system", () => {
  it("should be able to extend base with plugins + dependencies", async () => {
    const A = new PluginA();
    const B = new PluginB();
    const C = new PluginC();

    const engine = new Base({
      [A.getName()]: A,
      [B.getName()]: B,
      [C.getName()]: C,
    });

    expect(engine.plugins.PluginA.a()).toBe(1);
    expect(engine.plugins.PluginB.b()).toBe(3);
    expect(engine.plugins.PluginC.c()).toBe(7);
  });

  it("should throw if a dependency is not satisfied", async () => {
    let thrown = false;

    try {
      const engine = new Base({
        b: new PluginB(),
      });
    } catch (e) {
      if (e instanceof ICRC35Error) {
        if (e.code === ErrorCode.UNREACHEABLE) {
          thrown = true;
        }
      }
    }

    expect(thrown).toBe(true);
  });
});
