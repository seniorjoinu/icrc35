import { ICRC35AsyncRequest, IICRC35Connection } from "icrc-35";

export class ExampleClient {
  static GreetRoute = "example:greet";

  constructor(private connection: IICRC35Connection) {}

  async greet(name: string): Promise<ISharedResponse> {
    const res = await this.connection.request(ExampleClient.GreetRoute, { name });

    if (
      typeof res === "object" &&
      (res as ISharedResponse).result &&
      typeof (res as ISharedResponse).result === "string"
    ) {
      return res as ISharedResponse;
    }

    throw new Error("Invalid response");
  }

  async nextGreetRequest(): Promise<ICRC35AsyncRequest<ISharedRequest>> {
    return this.connection.nextRequest([ExampleClient.GreetRoute]);
  }
}

export interface ISharedRequest {
  name: string;
}

export interface ISharedResponse {
  result: string;
}
