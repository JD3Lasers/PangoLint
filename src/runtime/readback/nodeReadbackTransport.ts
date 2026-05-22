import dgram from "node:dgram";
import { decodeOscPacket, type OscMessage } from "../osc/osc";
import { type SendTalkTcpCommandsOptions, type SendTalkTcpCommandsResult, sendTalkTcpCommands } from "../talk/talkTcp";
import { sendTalkUdp } from "../talk/talkUdp";
import type { ReadbackOscListener, ReadbackTransport } from "./readbackTypes";

export const nodeReadbackTransport: ReadbackTransport = {
  async sendTalk(host: string, port: number, payload: Buffer): Promise<void> {
    await sendTalkUdp(host, port, payload);
  },

  async sendTalkTcp(options: SendTalkTcpCommandsOptions): Promise<SendTalkTcpCommandsResult> {
    return sendTalkTcpCommands(options);
  },

  listenForOsc(
    host: string,
    port: number,
    predicate: (message: OscMessage) => boolean,
    timeoutMs: number,
  ): ReadbackOscListener {
    const socket = dgram.createSocket("udp4");
    const readyDeferred = createDeferred<void>();
    let settled = false;
    let closeListener = (): void => {};

    const message = new Promise<OscMessage>((resolve, reject) => {
      const timer = setTimeout(
        () => {
          const timeoutError = new Error(`Timed out waiting for OSC callback after ${timeoutMs}ms.`);
          readyDeferred.reject(timeoutError);
          finish(() => reject(timeoutError));
        },
        Math.max(1, timeoutMs),
      );

      const finish = (settle: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // The socket may already be closed by a bind error.
        }
        settle();
      };
      closeListener = (): void => {
        const closeError = new Error("OSC listener closed before callback.");
        readyDeferred.reject(closeError);
        finish(() => reject(closeError));
      };

      socket.on("error", (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        const bindError = new Error(`OSC listener failed on ${host}:${port}: ${msg}`);
        readyDeferred.reject(bindError);
        finish(() => reject(bindError));
      });

      socket.on("listening", () => {
        readyDeferred.resolve();
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
        if (predicate(decoded)) {
          finish(() => resolve(decoded));
        }
      });
    });

    socket.bind(Number(port), host);
    return { ready: readyDeferred.promise, message, close: closeListener };
  },
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
