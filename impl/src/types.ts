import z from "zod";
import { ICRC35_SECRET_SIZE } from "./consts";

// ------------ PROTOCOL TYPES START --------------

export const ZMsgKind = z.enum([
  "HandshakeInit",
  "HandshakeComplete",
  "Ping",
  "Pong",
  "ConnectionClosed",
  "Common",
  "Request",
  "Response",
]);
export const ZSecret = z.custom<Uint8Array>((val) => val instanceof Uint8Array && val.length == ICRC35_SECRET_SIZE);

export const ZICRC35Base = z.object({
  domain: z.literal("icrc-35"),
});

export const ZHandshakeInitMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.HandshakeInit),
  secret: ZSecret,
}).strict();
export const ZHandshakeCompleteMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.HandshakeComplete),
  secret: ZSecret,
}).strict();

export const ZPingMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Ping),
}).strict();
export const ZPongMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Pong),
}).strict();

export const ZConnectionClosedMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.ConnectionClosed),
}).strict();

export const ZCommonMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Common),
  payload: z.any(),
});

export const ZRequestId = z.string().uuid();
export const ZRoute = z.string().url();

export const ZRequestMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Request),
  requestId: ZRequestId,
  route: ZRoute,
  payload: z.any(),
});

export const ZResponseMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Response),
  requestId: ZRequestId,
  payload: z.any(),
});

export const ZMsg = z.discriminatedUnion("kind", [
  ZHandshakeInitMsg,
  ZHandshakeCompleteMsg,
  ZPingMsg,
  ZPongMsg,
  ZConnectionClosedMsg,
  ZCommonMsg,
  ZRequestMsg,
  ZResponseMsg,
]);

export type EMsgKind = z.infer<typeof ZMsgKind>;
export type TSecret = z.infer<typeof ZSecret>;

export type IHandshakeInitMsg = z.infer<typeof ZHandshakeInitMsg>;
export type IHandshakeCompleteMsg = z.infer<typeof ZHandshakeCompleteMsg>;

export type IPongMsg = z.infer<typeof ZPongMsg>;
export type IPingMsg = z.infer<typeof ZPingMsg>;

export type IConnectionClosedMsg = z.infer<typeof ZConnectionClosedMsg>;

export type TRequestId = z.infer<typeof ZRequestId>;
export type TRoute = z.infer<typeof ZRoute>;
export type ICommonMsg = z.infer<typeof ZCommonMsg>;
export type IRequestMsg = z.infer<typeof ZRequestMsg>;
export type IResposeMsg = z.infer<typeof ZResponseMsg>;

export type IMsg = z.infer<typeof ZMsg>;

// ------------ PROTOCOL TYPES END --------------
// ------------- ADDITIONAL TYPES START --------------

export const ZOrigin = z.string().url();
export const ZPeer = z.custom<IPeer>((val) => {
  const res =
    typeof val === "object" && "postMessage" in (val as object) && typeof (val as IPeer).postMessage === "function";

  return res;
});
export const ZListener = z.custom<IListener>((val) => {
  const res =
    typeof val === "object" &&
    "addEventListener" in (val as object) &&
    "removeEventListener" in (val as object) &&
    "origin" in (val as object) &&
    typeof (val as IListener).addEventListener === "function" &&
    typeof (val as IListener).removeEventListener === "function" &&
    typeof (val as IListener).origin === "string";

  return res;
});

export const ZConnectionFilter = z
  .object({
    kind: z.enum(["blacklist", "whitelist"]),
    list: z.array(ZOrigin),
  })
  .strict();

export const ZEndpointParentMode = z.object({
  mode: z.literal("parent"),
  peerOrigin: ZOrigin,
});
export const ZEndpointChildMode = z.object({
  mode: z.literal("child"),
  connectionFilter: z.optional(ZConnectionFilter),
});
export const ZEndpointMode = z.discriminatedUnion("mode", [ZEndpointParentMode, ZEndpointChildMode]);

export const ZEndpointModeKind = z.enum(["parent", "child"]);

export const ZICRC35ConnectionConfig = z.object({
  peer: ZPeer,
  listener: z.optional(ZListener),
  mode: ZEndpointModeKind,
  peerOrigin: z.optional(ZOrigin),
  connectionFilter: z.optional(ZConnectionFilter),
  debug: z.optional(z.boolean()),
});

export type TOrigin = z.infer<typeof ZOrigin>;
export interface IPeer {
  postMessage: (message: any, targetOrigin: string, transfer?: Transferable[]) => void;
}
export interface IListener {
  origin: string;
  addEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void;
  removeEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void;
}
export type IConnectionFilter = z.infer<typeof ZConnectionFilter>;
export type IEndpointParentMode = z.infer<typeof ZEndpointParentMode>;
export type IEndpointChildMode = z.infer<typeof ZEndpointChildMode>;
export type EEndpointModeKind = z.infer<typeof ZEndpointModeKind>;
export type IEndpointMode = z.infer<typeof ZEndpointMode>;

interface ICRC35ConnectionConfig<P extends IPeer, L extends IListener> {
  peer: P;
  listener?: L;
  debug?: boolean;
  mode: EEndpointModeKind;
}

export interface ICRC35ConnectionChildConfig<P extends IPeer, L extends IListener>
  extends ICRC35ConnectionConfig<P, L> {
  connectionFilter: IConnectionFilter;
}

export interface ICRC35ConnectionParentConfig<P extends IPeer, L extends IListener>
  extends ICRC35ConnectionConfig<P, L> {
  peerOrigin: TOrigin;
}

export type ResolveFn<T extends void = void> = (v: T | PromiseLike<T>) => void;
export type RejectFn = (reason?: any) => void;

export type HandlerFn = (msg: any) => void;
export type ConnectionClosedReason = "closed by this" | "closed by peer" | "timed out";
export type AfterCloseHandlerFn = (reason: ConnectionClosedReason) => void;
export type BeforeCloseHandlerFn = () => void;

export interface IICRC35Connection {
  readonly peerOrigin: TOrigin;
  sendCommonMessage(msg: any, transfer?: Transferable[]): void;
  onCommonMessage(handler: HandlerFn): void;
  removeCommonMessageHandler(handler: HandlerFn): void;
  close(): void;
  onBeforeConnectionClosed(handler: BeforeCloseHandlerFn): void;
  removeBeforeConnectionClosedHandler(handler: BeforeCloseHandlerFn): void;
  onAfterConnectionClosed(handler: AfterCloseHandlerFn): void;
  removeAfterConnectionClosedHandler(handler: AfterCloseHandlerFn): void;
  request<T extends unknown, R extends unknown>(route: TRoute, request: T, transfer?: Transferable[]): Promise<R>;
  respond<T extends unknown>(requestId: TRequestId, response: T, transfer?: Transferable[]): void;
  tryNextRequest<R extends unknown>(allowedRoutes?: TRoute[]): ICRC35AsyncRequest<R> | undefined;
  nextRequest<R extends unknown>(allowedRoutes?: TRoute[], delayMs?: number): Promise<ICRC35AsyncRequest<R>>;
  isActive(): boolean;
}

export class ICRC35AsyncRequest<T extends unknown> {
  private connection: IICRC35Connection;
  private inProgress: boolean;
  public readonly requestId: TRequestId;
  public readonly peerOrigin: TOrigin;
  public readonly route: TRoute;
  public readonly payload: T;

  constructor(init: {
    connection: IICRC35Connection;
    requestId: TRequestId;
    peerOrigin: TOrigin;
    route: TRoute;
    payload: T;
  }) {
    this.connection = init.connection;
    this.inProgress = true;
    this.requestId = init.requestId;
    this.peerOrigin = init.peerOrigin;
    this.route = init.route;
    this.payload = init.payload;
  }

  respond<T extends unknown>(response: T, transfer?: Transferable[]) {
    if (!this.inProgress) return;
    this.inProgress = false;

    this.connection.respond(this.requestId, response, transfer);
  }

  closeConnection() {
    this.connection.close();
  }
}

// ------------- ADDITIONAL TYPES END --------------
