import { ICRC35Connection } from "../connection";
import { IListener, IPeer, IICRC35Connection, CloseHandlerFn, HandlerFn } from "../types";
import { Plugin } from "./plugin-system";

export class ICRC35ConnectionPlugin<L extends IPeer = IPeer, P extends IListener = IListener>
  extends Plugin<"ICRC35Connection">
  implements IICRC35Connection
{
  protected init(): void {}

  getName(): "ICRC35Connection" {
    return "ICRC35Connection";
  }

  get peerOrigin() {
    return this.connection.peerOrigin;
  }

  constructor(private connection: ICRC35Connection<L, P>) {
    super();
  }

  sendMessage(msg: any, transfer?: Transferable[] | undefined): void {
    this.connection.sendMessage(msg, transfer);
  }

  onMessage(handler: HandlerFn): void {
    this.connection.onMessage(handler);
  }

  close(): void {
    this.connection.close();
  }

  onConnectionClosed(handler: CloseHandlerFn): void {
    this.connection.onConnectionClosed(handler);
  }

  isActive(): boolean {
    return this.connection.isActive();
  }
}
