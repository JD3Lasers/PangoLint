import { randomBytes } from "node:crypto";
import dgram from "node:dgram";

import type { OscArg, OscMessage } from "./osc";
import { decodeOscPacket, sourceMatchesExpectedHost } from "./osc";
import { withOscPortLock } from "./oscPortLock";
import { buildTalkPayloads, sendTalkUdp } from "./talkUdp";

export interface ReadbackOptions {
  talkHost: string;
  talkPort: number;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  requestId?: string;
  logger?: (msg: string) => void;
}

export interface ConnectionCheckResult {
  ok: boolean;
  requestId: string;
  command: string;
  message?: OscMessage;
  error?: string;
}

export interface PropertyReadbackOptions extends ReadbackOptions {
  propertyPath: string;
  typeTag?: "f" | "i" | "s";
}

export interface PropertyReadbackResult {
  ok: boolean;
  requestId: string;
  propertyPath: string;
  script: string;
  value?: string | number;
  message?: OscMessage;
  error?: string;
}

const PROPERTY_ROOT = String.raw`(?:FB[34][-_][A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)(?:\[[0-9]+\])*`;
const PROPERTY_SEGMENT = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)(?:\[[0-9]+\])*`;
const PROPERTY_PATH_RE = new RegExp(`^${PROPERTY_ROOT}(?:\\.${PROPERTY_SEGMENT})+$`);
const REQUEST_ID_BYTES = 16;

export function createReadbackRequestId(prefix = "pangolint"): string {
  return `${prefix}-${randomBytes(REQUEST_ID_BYTES).toString("hex")}`;
}

export function validateReadbackPropertyPath(path: string): string | undefined {
  const trimmed = path.trim();
  if (path !== trimmed || !PROPERTY_PATH_RE.test(trimmed)) {
    return `Invalid property path '${path}'.`;
  }
  return undefined;
}

export interface ReadbackTransport {
  sendTalk(host: string, port: number, payload: Buffer): Promise<void>;
  listenForOsc(
    host: string,
    port: number,
    predicate: (message: OscMessage) => boolean,
    timeoutMs: number,
  ): ReadbackOscListener;
}

export interface ReadbackOscListener {
  ready: Promise<void>;
  message: Promise<OscMessage>;
}

export async function checkBeyondConnection(
  options: ReadbackOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<ConnectionCheckResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createRequestId();
  const command = `OscOutTTS "/pangolint/ping", "s", "${requestId}"`;
  const [payload] = buildTalkPayloads([command]);

  try {
    return await withOscPortLock(options, async () => {
      logger?.(`[connection] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address: "/pangolint/ping",
            typeTags: "s",
            expectedArgs: [requestId],
            talkHost: options.talkHost,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {
        // If listener readiness fails first, this callback promise is no longer
        // awaited by checkBeyondConnection but may reject from the same socket error.
      });

      await listener.ready;
      logger?.(`[connection] listener ready — sending Talk UDP to ${options.talkHost}:${options.talkPort}`);
      await transport.sendTalk(options.talkHost, options.talkPort, payload);
      logger?.("[connection] command sent — awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address: "/pangolint/ping",
        typeTags: "s",
        expectedArgs: [requestId],
        talkHost: options.talkHost,
      });
      logger?.(`[connection] received callback: ${message.address}`);
      return { ok: true, requestId, command, message };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[connection] failed: ${msg}`);
    return { ok: false, requestId, command, error: msg };
  }
}

export async function readBeyondProperty(
  options: PropertyReadbackOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<PropertyReadbackResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createRequestId();
  const typeTag = options.typeTag ?? "f";
  const address = `/pangolint/readback/${requestId}`;
  const pathError = validateReadbackPropertyPath(options.propertyPath);
  if (pathError) {
    return {
      ok: false,
      requestId,
      propertyPath: options.propertyPath,
      script: "",
      error: pathError,
    };
  }

  const scriptLines = [`var v`, `v = ${options.propertyPath}`, `OscOutTTS "${address}", "${typeTag}", v`];
  const script = scriptLines.join("\n");

  let payloads: Buffer[];
  try {
    payloads = buildTalkPayloads(scriptLines);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      requestId,
      propertyPath: options.propertyPath,
      script,
      error: msg,
    };
  }
  if (payloads.length !== 1) {
    return {
      ok: false,
      requestId,
      propertyPath: options.propertyPath,
      script,
      error: "Script exceeded payload limit.",
    };
  }

  try {
    return await withOscPortLock(options, async () => {
      logger?.(`[readback] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address,
            typeTags: typeTag,
            talkHost: options.talkHost,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {});

      await listener.ready;
      logger?.(`[readback] listener ready — sending property read script for ${options.propertyPath}`);
      await transport.sendTalk(options.talkHost, options.talkPort, payloads[0]);
      logger?.("[readback] script sent — awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address,
        typeTags: typeTag,
        talkHost: options.talkHost,
      });
      logger?.(`[readback] received callback: ${message.address} args=${JSON.stringify(message.args)}`);
      const raw = message.args[0];
      const value = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
      return { ok: true, requestId, propertyPath: options.propertyPath, script, value, message };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[readback] failed: ${msg}`);
    return { ok: false, requestId, propertyPath: options.propertyPath, script, error: msg };
  }
}

export interface WriteVerifyOptions extends ReadbackOptions {
  command: string;
  readbackPath: string;
  expectedValue: number | string;
  restoreCommand?: string;
  typeTag?: "f" | "i" | "s";
}

export interface WriteVerifyResult {
  ok: boolean;
  command: string;
  readbackPath: string;
  after?: number | string;
  expected: number | string;
  matched: boolean;
  restored: boolean;
  error?: string;
}

export async function verifyCommandWrite(
  options: WriteVerifyOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<WriteVerifyResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createRequestId();
  const typeTag = options.typeTag ?? "f";
  const address = `/pangolint/verify/${requestId}`;
  const pathError = validateReadbackPropertyPath(options.readbackPath);
  if (pathError) {
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored: false,
      error: pathError,
    };
  }

  const scriptLines = [
    options.command,
    "var v",
    `v = ${options.readbackPath}`,
    `OscOutTTS "${address}", "${typeTag}", v`,
  ];

  let payloads: Buffer[];
  let restorePayload: Buffer | undefined;
  try {
    payloads = buildTalkPayloads(scriptLines);
    if (options.restoreCommand) {
      [restorePayload] = buildTalkPayloads([options.restoreCommand]);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored: false,
      error: msg,
    };
  }
  if (payloads.length !== 1) {
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored: false,
      error: "Script exceeded payload limit.",
    };
  }

  let after: number | string | undefined;
  let matched = false;
  let restored = false;
  let writePacketSent = false;
  const sendRestore = async (): Promise<void> => {
    if (!restorePayload || !options.restoreCommand) return;
    try {
      await transport.sendTalk(options.talkHost, options.talkPort, restorePayload);
      restored = true;
      logger?.(`[verify] restore sent: ${options.restoreCommand}`);
    } catch (restoreError) {
      const msg = restoreError instanceof Error ? restoreError.message : String(restoreError);
      logger?.(`[verify] restore failed: ${msg}`);
    }
  };

  try {
    return await withOscPortLock(options, async () => {
      try {
        logger?.(`[verify] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
        const listener = transport.listenForOsc(
          options.listenHost,
          options.listenPort,
          (message) =>
            isExpectedOscCallback(message, {
              address,
              typeTags: typeTag,
              talkHost: options.talkHost,
            }),
          options.timeoutMs,
        );

        listener.message.catch(() => {});

        await listener.ready;
        logger?.(`[verify] listener ready — sending write+readback script for ${options.command}`);
        await transport.sendTalk(options.talkHost, options.talkPort, payloads[0]);
        writePacketSent = true;
        logger?.("[verify] script sent — awaiting OSC callback");
        const message = await listener.message;
        assertExpectedOscCallback(message, {
          address,
          typeTags: typeTag,
          talkHost: options.talkHost,
        });
        logger?.(`[verify] received callback: ${message.address} args=${JSON.stringify(message.args)}`);

        const raw = message.args[0];
        after = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
        matched = after === options.expectedValue;

        await sendRestore();

        return {
          ok: true,
          command: options.command,
          readbackPath: options.readbackPath,
          after,
          expected: options.expectedValue,
          matched,
          restored,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger?.(`[verify] failed: ${msg}`);
        if (writePacketSent) {
          await sendRestore();
        }
        return {
          ok: false,
          command: options.command,
          readbackPath: options.readbackPath,
          expected: options.expectedValue,
          matched: false,
          restored,
          error: msg,
        };
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[verify] failed: ${msg}`);
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored,
      error: msg,
    };
  }
}

interface ExpectedOscCallback {
  address: string;
  typeTags: "f" | "i" | "s";
  talkHost: string;
  expectedArgs?: readonly OscArg[];
}

function isExpectedOscCallback(message: OscMessage, expected: ExpectedOscCallback): boolean {
  if (message.address !== expected.address) return false;
  if (message.typeTags !== expected.typeTags) return false;
  if (!sourceMatchesExpectedHost(message, expected.talkHost)) return false;

  if (expected.expectedArgs) {
    if (message.args.length !== expected.expectedArgs.length) return false;
    return expected.expectedArgs.every((arg, index) => message.args[index] === arg);
  }

  if (message.args.length !== expected.typeTags.length) return false;
  return expected.typeTags.split("").every((tag, index) => argMatchesTypeTag(message.args[index], tag));
}

function assertExpectedOscCallback(message: OscMessage, expected: ExpectedOscCallback): void {
  if (!isExpectedOscCallback(message, expected)) {
    throw new Error(`Unexpected OSC callback for ${expected.address}.`);
  }
}

function argMatchesTypeTag(arg: OscArg | undefined, tag: string): boolean {
  if (tag === "s") return typeof arg === "string";
  if (tag === "i") return typeof arg === "number" && Number.isInteger(arg);
  if (tag === "f") return typeof arg === "number" && Number.isFinite(arg);
  return false;
}

export const nodeReadbackTransport: ReadbackTransport = {
  async sendTalk(host: string, port: number, payload: Buffer): Promise<void> {
    await sendTalkUdp(host, port, payload);
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
    return { ready: readyDeferred.promise, message };
  },
};

function createRequestId(): string {
  return createReadbackRequestId("pangolint");
}

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
