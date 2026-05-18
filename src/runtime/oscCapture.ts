import dgram from "node:dgram";

import type { OscMessage } from "./osc";
import { decodeOscPacket, sourceMatchesExpectedHost } from "./osc";
import { acquireOscPortLock } from "./oscPortLock";

export interface OscCaptureOptions {
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  addresses: readonly string[];
  expectedSourceHost?: string;
  maxMessages?: number;
}

export interface OscCaptureResult {
  ok: boolean;
  messages: OscMessage[];
  timedOut: boolean;
  error?: string;
}

export interface OscCaptureSession {
  ready: Promise<void>;
  done: Promise<OscCaptureResult>;
  stop(): void;
}

export type StartOscCapture = (options: OscCaptureOptions) => Promise<OscCaptureSession>;

export const startOscCapture: StartOscCapture = async (options) => {
  const releasePortLock = await acquireOscPortLock(options);
  const socket = dgram.createSocket("udp4");
  const ready = createDeferred<void>();
  const done = createDeferred<OscCaptureResult>();
  const addresses = new Set(options.addresses);
  const messages: OscMessage[] = [];
  const timeoutMs = Math.max(1, options.timeoutMs);
  const maxMessages = Math.max(1, options.maxMessages ?? 64);
  let settled = false;

  const timer = setTimeout(() => {
    ready.reject(new Error(`Timed out waiting for OSC capture listener after ${timeoutMs}ms.`));
    finish({ ok: true, messages: [...messages], timedOut: true });
  }, timeoutMs);

  const closeSocket = (): void => {
    try {
      socket.close();
    } catch {
      // The socket may already be closed after a bind error.
    }
  };

  const finish = (result: OscCaptureResult): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    closeSocket();
    releasePortLock();
    done.resolve(result);
  };

  socket.on("error", (error) => {
    const msg = error instanceof Error ? error.message : String(error);
    const bindError = new Error(`OSC capture failed on ${options.listenHost}:${options.listenPort}: ${msg}`);
    ready.reject(bindError);
    finish({ ok: false, messages: [...messages], timedOut: false, error: bindError.message });
  });

  socket.on("listening", () => {
    ready.resolve();
  });

  socket.on("message", (payload, rinfo) => {
    let decoded: OscMessage;
    try {
      decoded = {
        ...decodeOscPacket(payload),
        sourceAddress: rinfo.address,
        sourcePort: rinfo.port,
      };
    } catch {
      return;
    }
    if (!addresses.has(decoded.address)) {
      return;
    }
    if (!sourceMatchesExpectedHost(decoded, options.expectedSourceHost)) {
      return;
    }
    messages.push(decoded);
    if (messages.length >= maxMessages) {
      finish({ ok: true, messages: [...messages], timedOut: false });
    }
  });

  socket.bind(Number(options.listenPort), options.listenHost);

  return {
    ready: ready.promise,
    done: done.promise,
    stop: () => finish({ ok: true, messages: [...messages], timedOut: false }),
  };
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let settled = false;
  return {
    promise,
    resolve: (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject: (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    },
  };
}
