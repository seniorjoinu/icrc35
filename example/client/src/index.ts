import { IICRC35Connection } from "icrc-35";

export class ExampleClient {
  constructor(private connection: IICRC35Connection) {}

  async greet(name: string): Promise<ISharedResponse> {
    const res = await this.connection.request(GreetRoute, { name });

    if (
      typeof res === "object" &&
      (res as ISharedResponse).result &&
      typeof (res as ISharedResponse).result === "string"
    ) {
      return res as ISharedResponse;
    }

    throw new Error("Invalid response");
  }
}

export const GreetRoute = "example:greet";

export interface ISharedRequest {
  name: string;
}

export interface ISharedResponse {
  result: string;
}
