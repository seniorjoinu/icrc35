import { ICRC35_SECRET_SIZE } from "./consts";
import { IConnectionFilter } from "./types";

export function generateSecret(): Uint8Array {
  const res = new Uint8Array(ICRC35_SECRET_SIZE);
  crypto.getRandomValues(res);

  return res;
}

// the default is to deny all connections (empty whitelist)
// if you need an "allow all" filter, set it to empty blacklist
export function generateDefaultFilter(): IConnectionFilter {
  return {
    kind: "whitelist",
    list: [],
  };
}

export function isEqualUint8Arr(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

export async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export enum ErrorCode {
  UNEXPECTED_PEER = "ICRC35_UNEXPECTED_PEER",
  INVALID_STATE = "ICRC35_INVALID_STATE",
  UNREACHEABLE = "ICRC35_UNREACHEABLE",
}

export class ICRC35Error<E extends Error> extends Error {
  cause?: E;

  constructor(public code: ErrorCode, msg?: string, ops?: { cause: E }) {
    super(msg);
    this.cause = ops?.cause;
  }

  toString() {
    return `<ICRC-35> ${super.toString()}`;
  }
}

export function log(...args: any[]) {
  console.log("<ICRC-35>", ...args);
}

export function err(...args: any[]) {
  console.error("<ICRC-35>", ...args);
}
