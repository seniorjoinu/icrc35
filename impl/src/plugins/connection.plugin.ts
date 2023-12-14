import { IICRC35Connection, CloseHandlerFn, HandlerFn } from "../types";
import { ICRC35Plugin } from "./plugin";

export class ICRC35ConnectionPlugin extends ICRC35Plugin<"ICRC35Connection"> implements IICRC35Connection {
  protected init(): void {}

  getName(): "ICRC35Connection" {
    return "ICRC35Connection";
  }

  get peerOrigin() {
    return this.connection.peerOrigin;
  }

  constructor(private connection: IICRC35Connection) {
    super();
  }

  sendMessage(msg: any, transfer?: Transferable[] | undefined): void {
    this.connection.sendMessage(msg, transfer);
  }

  onMessage(handler: HandlerFn): void {
    this.connection.onMessage(handler);
  }

  removeMessageHandler(handler: HandlerFn): void {
    this.connection.removeMessageHandler(handler);
  }

  close(): void {
    this.connection.close();
  }

  onConnectionClosed(handler: CloseHandlerFn): void {
    this.connection.onConnectionClosed(handler);
  }

  removeConnectionClosedHandler(handler: CloseHandlerFn): void {
    this.connection.removeConnectionClosedHandler(handler);
  }

  isActive(): boolean {
    return this.connection.isActive();
  }
}
