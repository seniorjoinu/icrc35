import type { ICRC35 } from "../index";
import { ErrorCode, ICRC35Error } from "../utils";

export abstract class ICRC35Plugin<N extends string, DEPS extends object = {}> {
  private _base: ICRC35<DEPS> | null = null;

  // used by the ICRC35 class
  private install(base: ICRC35<DEPS>) {
    this._base = base;
    this.init();
  }

  protected get base() {
    if (this._base === null) throw new ICRC35Error(ErrorCode.INVALID_STATE, "The plugin is not installed");

    return this._base!;
  }

  protected abstract init(): void;

  abstract getName(): N;
}
