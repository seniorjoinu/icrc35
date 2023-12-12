import z from "zod";
import { ICRC35ConnectionPlugin } from "./connection.plugin";
import { Plugin } from "./plugin-system";
import { RejectFn, ResolveFn } from "../types";
import { ErrorCode, ICRC35Error, delay } from "../utils";

export class ICRC35AsyncPlugin<
  P extends { ICRC35Connection: ICRC35ConnectionPlugin } = { ICRC35Connection: ICRC35ConnectionPlugin }
> extends Plugin<"ICRC35Async", P> {
  private sentRequests: Record<TRequestId, [ResolveFn<any>, RejectFn]> = {};
  private receivedRequests: Request<any>[] = [];

  getName(): "ICRC35Async" {
    return "ICRC35Async";
  }

  protected init(): void {
    this.base.assertHasPlugin("ICRC35Connection");

    this.base.plugins.ICRC35Connection.onMessage((msg) => {
      const res = ZAsyncMsg.safeParse(msg);
      if (!res.success) return;

      if (res.data.kind === "request") {
        const route = ZRoute.parse(res.data.route);
        const request = new Request(this, res.data.requestId, route, res.data.body);

        this.receivedRequests.push(request);
        return;
      }

      if (res.data.kind === "response") {
        if (!(res.data.requestId in this.sentRequests)) {
          throw new ICRC35Error(
            ErrorCode.UNREACHEABLE,
            `Received a response for non existing request with id ${res.data.requestId}: ${res.data.body}`
          );
        }

        const [resolve, _] = this.sentRequests[res.data.requestId];
        resolve(res.data.body);

        delete this.sentRequests[res.data.requestId];
        return;
      }
    });

    this.base.plugins.ICRC35Connection.onConnectionClosed((reason) => {
      Object.values(this.sentRequests).forEach(([_, reject]) =>
        reject(new ICRC35Error(ErrorCode.INVALID_STATE, `connection ${reason}`))
      );

      this.sentRequests = {};
    });
  }

  next<R extends unknown>(): Request<R> | undefined {
    return this.receivedRequests.shift();
  }

  async asyncNext<R extends unknown>(delayMs: number = 50): Promise<Request<R>> {
    while (this.base.plugins.ICRC35Connection.isActive()) {
      const req = this.next();

      if (req) return req as Request<R>;

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
    const msg: IAsyncMsg = {
      domain: "icrc-35-async-plugin",
      kind: "response",
      requestId,
      body: response,
    };

    this.base.plugins.ICRC35Connection.sendMessage(msg, transfer);
  }

  // used by Request
  private closeConnection() {
    this.base.plugins.ICRC35Connection.close();
  }
}

export class Request<T extends unknown> {
  constructor(
    private plugin: ICRC35AsyncPlugin,
    private requestId: TRequestId,
    public readonly route: TRoute,
    public readonly body: T
  ) {}

  respond<T extends unknown>(response: T, transfer?: Transferable[]) {
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
