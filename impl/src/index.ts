import { ICRC35ConnectionPlugin } from "./plugins/connection.plugin";
import { ICRC35AsyncPlugin } from "./plugins/async.plugin";
import { IICRC35Connection } from "./types";
import { ICRC35Error, ErrorCode } from "./utils";

export { ICRC35Connection } from "./connection";
export type {
  IICRC35Connection,
  ICRC35ConnectionChildConfig,
  ICRC35ConnectionParentConfig,
  IPeer,
  IListener,
  HandlerFn,
  CloseHandlerFn,
} from "./types";
export { openICRC35Window } from "./utils";

export { ICRC35Plugin } from "./plugins/plugin";
export { ICRC35AsyncRequest } from "./plugins/async.plugin";

export class ICRC35<P extends object = {}> {
  private _plugins: P & { ICRC35Connection: ICRC35ConnectionPlugin; ICRC35Async: ICRC35AsyncPlugin };

  constructor(connection: IICRC35Connection, _plugins?: P) {
    const p = _plugins ? _plugins : {};

    this._plugins = {
      ICRC35Connection: new ICRC35ConnectionPlugin(connection),
      ICRC35Async: new ICRC35AsyncPlugin(),
      ...p,
    } as P & { ICRC35Connection: ICRC35ConnectionPlugin; ICRC35Async: ICRC35AsyncPlugin };

    Object.values(this._plugins)
      // @ts-expect-error - imitating friend classes
      .forEach((plugin) => plugin.install(this));
  }

  get plugins(): P & { ICRC35Connection: ICRC35ConnectionPlugin; ICRC35Async: ICRC35AsyncPlugin } {
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
