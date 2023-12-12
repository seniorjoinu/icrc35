import { Base, Plugin } from "../src/plugins/plugin-system";
import { ErrorCode, ICRC35Error } from "../src/utils";

class PluginA extends Plugin {
  init(): void {}

  a() {
    return 1;
  }
}

class PluginB<P extends { a: PluginA } = { a: PluginA }> extends Plugin<P> {
  init(): void {
    this.base.assertHasPlugin("a");
  }

  b() {
    return this.base.plugins.a.a() + 2;
  }
}

class PluginC<P extends { a: PluginA; b: PluginB } = { a: PluginA; b: PluginB }> extends Plugin<P> {
  init(): void {
    this.base.assertHasPlugin("b");
  }

  c() {
    return this.base.plugins.a.a() + this.base.plugins.b.b() + 3;
  }
}

describe("plugin system", () => {
  it("should be able to extend base with plugins + dependencies", async () => {
    const engine = new Base({
      a: new PluginA(),
      b: new PluginB(),
      c: new PluginC(),
    });

    expect(engine.plugins.a.a()).toBe(1);
    expect(engine.plugins.b.b()).toBe(3);
    expect(engine.plugins.c.c()).toBe(7);
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
