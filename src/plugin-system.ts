import { ErrorCode, ICRC35Error } from "./utils";

export abstract class Plugin<DEPS extends object = {}> {
  private _base: Base<DEPS> | null = null;

  private install(base: Base<DEPS>) {
    this._base = base;
  }

  protected get base() {
    if (this._base === null) throw new ICRC35Error(ErrorCode.INVALID_STATE, "The plugin is not installed");

    return this._base!;
  }

  abstract init(): void;
}

export class Base<P extends object = {}> {
  private _plugins: P;

  constructor(_plugins: P) {
    Object.values(_plugins).forEach((plugin: IPlugin<P>) => plugin.install(this));
    this._plugins = _plugins;
  }

  get plugins(): P {
    return this._plugins!;
  }

  hasPlugin(name: string): boolean {
    return name in this;
  }

  assertHasPlugin(name: string) {
    if (!this.hasPlugin(name)) {
      throw new ICRC35Error(ErrorCode.UNREACHEABLE, `No plugin named '${name}' found`);
    }
  }
}

interface IPlugin<P extends object> {
  install(base: Base<P>): void;
}

function test() {
  class PluginA extends Plugin {
    init(): void {}

    a() {
      console.log("a");
    }
  }

  class PluginB<P extends { a: PluginA } = { a: PluginA }> extends Plugin<P> {
    init(): void {
      this.base.assertHasPlugin("a");
    }

    b() {
      this.base.plugins.a.a();
      console.log("b");
    }
  }

  class PluginC<P extends { a: PluginA; b: PluginB } = { a: PluginA; b: PluginB }> extends Plugin<P> {
    init(): void {
      this.base.assertHasPlugin("b");
    }

    c() {
      this.base.plugins.a.a();
      this.base.plugins.b.b();
      console.log("c");
    }
  }

  const base = new Base({
    a: new PluginA(),
    b: new PluginB(),
    c: new PluginC(),
  });

  base.plugins.a.a();
  base.plugins.b.b();
  base.plugins.c.c();
}
