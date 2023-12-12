import { ErrorCode, ICRC35Error } from "../utils";

export abstract class Plugin<DEPS extends object = {}> {
  private _base: Base<DEPS> | null = null;

  private install(base: Base<DEPS>) {
    this._base = base;
    this.init();
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
    this._plugins = _plugins;
    Object.values(_plugins).forEach((plugin: IPlugin<P>) => plugin.install(this));
  }

  get plugins(): P {
    return this._plugins!;
  }

  hasPlugin(name: string): boolean {
    return name in this._plugins;
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
