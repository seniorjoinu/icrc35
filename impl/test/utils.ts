import { IListener, IPeer } from "../src/types";

export const originA = "https://a.com";
export const originB = "https://b.com";

export class TestMsgPipe implements IPeer, IListener {
  origin: string;
  peerOrigin: string;
  listeners: ((ev: MessageEvent<unknown>) => void)[] = [];
  private broken: boolean = false;

  constructor(myOrigin: string, peerOrigin: string) {
    this.origin = myOrigin;
    this.peerOrigin = peerOrigin;
  }

  break() {
    this.broken = true;
  }

  addEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(event: "message", listener: (ev: MessageEvent<any>) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx < 0) return;

    this.listeners.splice(idx, 1);
  }

  postMessage(message: any, targetOrigin: string, transfer?: Transferable[] | undefined) {
    const ev: MessageEvent<any> = {
      data: message,
      type: "message",
      origin: this.peerOrigin,
      lastEventId: "",
      ports: [],
      source: null,
      initMessageEvent: () => {},
      bubbles: false,
      cancelBubble: false,
      cancelable: false,
      composed: false,
      currentTarget: null,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      returnValue: false,
      srcElement: null,
      target: null,
      timeStamp: 0,
      composedPath: () => [],
      initEvent: () => {},
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      stopPropagation: () => {},
      NONE: 0,
      CAPTURING_PHASE: 1,
      AT_TARGET: 2,
      BUBBLING_PHASE: 3,
    };

    if (this.broken) return;

    // emulate multi-threading
    setTimeout(() => {
      for (let listener of this.listeners) {
        listener(ev);
      }
    }, 10);
  }
}
