import { IICRC35Connection, AfterCloseHandlerFn, HandlerFn, BeforeCloseHandlerFn } from "../types";
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

  onBeforeConnectionClosed(handler: BeforeCloseHandlerFn): void {
    this.connection.onBeforeConnectionClosed(handler);
  }

  removeBeforeConnectionClosedHandler(handler: BeforeCloseHandlerFn): void {
    this.connection.removeBeforeConnectionClosedHandler(handler);
  }

  onAfterConnectionClosed(handler: AfterCloseHandlerFn): void {
    this.connection.onAfterConnectionClosed(handler);
  }

  removeAfterConnectionClosedHandler(handler: AfterCloseHandlerFn): void {
    this.connection.removeAfterConnectionClosedHandler(handler);
  }

  isActive(): boolean {
    return this.connection.isActive();
  }
}
