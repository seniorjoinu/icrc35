import z from "zod";
import { ICRC35Plugin } from "./plugin";
import { RejectFn, ResolveFn, TOrigin } from "../types";
import { ErrorCode, ICRC35Error, delay } from "../utils";

export class ICRC35AsyncPlugin extends ICRC35Plugin<"ICRC35Async"> {
  private sentRequests: Record<TRequestId, [ResolveFn<any>, RejectFn]> = {};
  private receivedRequests: ICRC35AsyncRequest<any>[] = [];
  private requestsInProcess: TRequestId[] = [];

  getName(): "ICRC35Async" {
    return "ICRC35Async";
  }

  protected init(): void {
    this.base.assertHasPlugin("ICRC35Connection");

    this.base.plugins.ICRC35Connection.onMessage((msg) => {
      // ignore other messages
      const res = ZAsyncMsg.safeParse(msg);
      if (!res.success) return;

      if (res.data.kind === "request") {
        const route = ZRoute.parse(res.data.route);

        const request = new ICRC35AsyncRequest({
          plugin: this,
          requestId: res.data.requestId,
          peerOrigin: this.base.plugins.ICRC35Connection.peerOrigin!,
          route: route,
          body: res.data.body,
        });

        this.receivedRequests.push(request);
        return;
      }

      if (res.data.kind === "response") {
        // ignore responses for non-existing requests
        if (!(res.data.requestId in this.sentRequests)) {
          return;
        }

        const [resolve, _] = this.sentRequests[res.data.requestId];
        resolve(res.data.body);

        delete this.sentRequests[res.data.requestId];
        return;
      }
    });

    this.base.plugins.ICRC35Connection.onAfterConnectionClosed((reason) => {
      Object.values(this.sentRequests).forEach(([_, reject]) =>
        reject(new ICRC35Error(ErrorCode.INVALID_STATE, `connection ${reason}`))
      );

      this.sentRequests = {};
    });
  }

  tryNext<R extends unknown>(allowedRoutes?: TRoute[]): ICRC35AsyncRequest<R> | undefined {
    if (allowedRoutes === undefined) {
      const req = this.receivedRequests.shift();

      if (req) this.requestsInProcess.push(req.requestId);

      return req;
    }

    const idx = this.receivedRequests.findIndex((it) => allowedRoutes.includes(it.route));
    if (idx < 0) return undefined;

    const req = this.receivedRequests.splice(idx, 1)[0];
    this.requestsInProcess.push(req.requestId);

    return req;
  }

  async next<R extends unknown>(allowedRoutes?: TRoute[], delayMs: number = 50): Promise<ICRC35AsyncRequest<R>> {
    while (this.base.plugins.ICRC35Connection.isActive()) {
      const req = this.tryNext(allowedRoutes);

      if (req) return req as ICRC35AsyncRequest<R>;

      await delay(delayMs);
    }

    throw new ICRC35Error(ErrorCode.INVALID_STATE, "The connection is already closed");
  }

  async call<T extends unknown, R extends unknown>(route: TRoute, request: T, transfer?: Transferable[]): Promise<R> {
    if (!this.base.plugins.ICRC35Connection.isActive()) {
      throw new ICRC35Error(ErrorCode.INVALID_STATE, "The connection is already closed");
    }

    const msg: IAsyncMsg = {
      domain: "icrc-35-async-plugin",
      kind: "request",
      route,
      requestId: crypto.randomUUID(),
      body: request,
    };

    const promise = new Promise<R>((resolve, reject) => {
      this.sentRequests[msg.requestId] = [resolve, reject];
    });

    this.base.plugins.ICRC35Connection.sendMessage(msg, transfer);

    return promise;
  }

  respond<T extends unknown>(requestId: TRequestId, response: T, transfer?: Transferable[]) {
    const idx = this.requestsInProcess.indexOf(requestId);
    if (idx < 0) return;

    this.requestsInProcess.splice(idx, 1);

    const msg: IAsyncMsg = {
      domain: "icrc-35-async-plugin",
      kind: "response",
      requestId,
      body: response,
    };

    this.base.plugins.ICRC35Connection.sendMessage(msg, transfer);
  }

  // used by ICRC35AsyncRequest
  private closeConnection() {
    this.base.plugins.ICRC35Connection.close();
  }
}
export class ICRC35AsyncRequest<T extends unknown> {
  private plugin: ICRC35AsyncPlugin;
  private inProgress: boolean;
  public readonly requestId: TRequestId;
  public readonly peerOrigin: TOrigin;
  public readonly route: TRoute;
  public readonly body: T;

  constructor(init: { plugin: ICRC35AsyncPlugin; requestId: TRequestId; peerOrigin: TOrigin; route: TRoute; body: T }) {
    this.plugin = init.plugin;
    this.inProgress = true;
    this.requestId = init.requestId;
    this.peerOrigin = init.peerOrigin;
    this.route = init.route;
    this.body = init.body;
  }

  respond<T extends unknown>(response: T, transfer?: Transferable[]) {
    if (!this.inProgress) return;
    this.inProgress = false;

    this.plugin.respond(this.requestId, response, transfer);
  }

  closeConnection() {
    (this.plugin as unknown as { closeConnection: () => void }).closeConnection();
  }
}

const ZRequestId = z.string().uuid();
const ZRoute = z.string().url();
const ZAsyncMsg = z.object({
  domain: z.literal("icrc-35-async-plugin"),
  kind: z.literal("request").or(z.literal("response")),
  requestId: ZRequestId,
  route: z.optional(ZRoute),
  body: z.any(),
});

type TRequestId = z.infer<typeof ZRequestId>;
type TRoute = z.infer<typeof ZRoute>;
type IAsyncMsg = z.infer<typeof ZAsyncMsg>;
