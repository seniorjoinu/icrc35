import z from "zod";
import { ICRC35_SECRET_SIZE } from "./consts";

// ------------ PROTOCOL TYPES START --------------

export const ZMsgKind = z.enum(["HandshakeInit", "HandshakeComplete", "Ping", "Pong", "ConnectionClosed", "Custom"]);
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

export const ZCustomMsg = ZICRC35Base.extend({
  kind: z.literal(ZMsgKind.Enum.Custom),
  payload: z.any(),
});

export const ZMsg = z.discriminatedUnion("kind", [
  ZHandshakeInitMsg,
  ZHandshakeCompleteMsg,
  ZPingMsg,
  ZPongMsg,
  ZConnectionClosedMsg,
  ZCustomMsg,
]);

export type EMsgKind = z.infer<typeof ZMsgKind>;
export type TSecret = z.infer<typeof ZSecret>;

export type IHandshakeInitMsg = z.infer<typeof ZHandshakeInitMsg>;
export type IHandshakeCompleteMsg = z.infer<typeof ZHandshakeCompleteMsg>;

export type IPongMsg = z.infer<typeof ZPongMsg>;
export type IPingMsg = z.infer<typeof ZPingMsg>;

export type IConnectionClosedMsg = z.infer<typeof ZConnectionClosedMsg>;

export type ICustomMsg = z.infer<typeof ZCustomMsg>;

export type IMsg = z.infer<typeof ZMsg>;

// ------------ PROTOCOL TYPES END --------------
// ------------- ADDITIONAL TYPES START --------------

export const ZOrigin = z.string().url();
export const ZPeer = z.custom<IPeer>(
  (val) =>
    typeof val === "object" &&
    (val as object).hasOwnProperty("postMessage") &&
    typeof (val as IPeer).postMessage === "function"
);

export const ZConnectionFilter = z
  .object({
    kind: z.enum(["blacklist", "whitelist"]),
    list: z.array(ZOrigin),
  })
  .strict();

export const ZEndpointParentMode = z
  .object({
    mode: z.literal("parent"),
    peerOrigin: ZOrigin,
  })
  .strict();
export const ZEndpointChildMode = z
  .object({
    mode: z.literal("child"),
    connectionFilter: z.optional(ZConnectionFilter),
  })
  .strict();
export const ZEndpointMode = z.discriminatedUnion("mode", [ZEndpointParentMode, ZEndpointChildMode]);

export const ZEndpointModeKind = z.enum(["parent", "child"]);

export const ZICRC35ConnectionConfig = z.object({
  peer: ZPeer,
  mode: ZEndpointModeKind,
  peerOrigin: z.optional(ZOrigin),
  connectionFilter: z.optional(ZConnectionFilter),
});

export type TOrigin = z.infer<typeof ZOrigin>;
export interface IPeer {
  postMessage: (message: any, targetOrigin: string, transfer?: Transferable[]) => void;
}
export type IConnectionFilter = z.infer<typeof ZConnectionFilter>;
export type IEndpointParentMode = z.infer<typeof ZEndpointParentMode>;
export type IEndpointChildMode = z.infer<typeof ZEndpointChildMode>;
export type EEndpointModeKind = z.infer<typeof ZEndpointModeKind>;
export type IEndpointMode = {
  mode: EEndpointModeKind;
  connectionFilter?: IConnectionFilter;
};

export interface ICRC35ConnectionConfig<W extends IPeer> extends IEndpointMode {
  peer: W;
}

export type ResolveFn = (v: void | PromiseLike<void>) => void;
export type RejectFn = (reason?: any) => void;

export type HandlerFn = (msg: any) => void;
export type CloseHandlerFn = (reason: "close" | "timeout") => void;

export interface IICRC35Connection {
  send(msg: any, transfer?: Transferable[]): void;
  onMessage(handler: HandlerFn): void;
  close(): void;
  onConnectionClosed(handler: CloseHandlerFn): void;
  isActive(): boolean;
}

// ------------- ADDITIONAL TYPES END --------------
// ------------- UTILITY TYPES START ---------------

export type Defined<T> = T extends undefined ? never : T;
export type Assume<T, U> = T extends U ? T : never;
