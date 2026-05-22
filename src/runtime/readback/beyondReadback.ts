import { randomBytes } from "node:crypto";
import dgram from "node:dgram";
import { type BeyondTalkTransport, type RunScriptResult, runScript } from "../commandBatch/runScript";
import type { OscArg, OscMessage } from "../osc/osc";
import { decodeOscPacket, sourceMatchesExpectedHost } from "../osc/osc";
import { withOscPortLock } from "../osc/oscPortLock";
import {
  type SendTalkTcpCommandsOptions,
  type SendTalkTcpCommandsResult,
  sendTalkTcpCommands,
  type TalkTcpReply,
} from "../talk/talkTcp";
import { buildTalkPayloads, sendTalkUdp, validateTalkCommandLines } from "../talk/talkUdp";

export interface ReadbackOptions {
  talkHost: string;
  talkPort: number;
  talkTransport?: BeyondTalkTransport;
  talkTcpHost?: string;
  talkTcpPort?: number;
  talkUdpHost?: string;
  talkUdpPort?: number;
  talkUdpFallbackAllowed?: boolean;
  talkTcpPassword?: string;
  commandTimeoutMs?: number;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  requestId?: string;
  logger?: (msg: string) => void;
}

interface ReadbackTalkStatus {
  transport?: "tcp" | "udp";
  talkStatus?: RunScriptResult["talkStatus"];
  talkGreeting?: string;
  talkReplies?: TalkTcpReply[];
  beyondError?: SendTalkTcpCommandsResult["beyondError"];
  linesSent?: number;
  payloadsSent?: number;
  bytesSent?: number;
}

export interface ConnectionCheckResult extends ReadbackTalkStatus {
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

export interface PropertyReadbackResult extends ReadbackTalkStatus {
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
  sendTalkTcp?: (options: SendTalkTcpCommandsOptions) => Promise<SendTalkTcpCommandsResult>;
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
  close?: () => void;
}

export async function checkBeyondConnection(
  options: ReadbackOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<ConnectionCheckResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createRequestId();
  const command = `OscOutTTS "/pangolint/ping", "s", "${requestId}"`;
  const commands = [command];

  try {
    validateTalkCommandLines(commands);
    return await withOscPortLock(options, async () => {
      logger?.(`[connection] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address: "/pangolint/ping",
            typeTags: "s",
            expectedArgs: [requestId],
            expectedSourceHosts,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {
        // If listener readiness fails first, this callback promise is no longer
        // awaited by checkBeyondConnection but may reject from the same socket error.
      });

      await listener.ready;
      logger?.(`[connection] listener ready, sending Talk command`);
      const sendResult = await sendReadbackTalk(commands, options, transport);
      if (!sendResult.ok) {
        closeReadbackOscListener(listener);
        return {
          ok: false,
          requestId,
          command,
          ...readbackTalkStatus(sendResult),
          error: sendResult.error ?? "Talk send failed.",
        };
      }
      logger?.("[connection] command sent, awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address: "/pangolint/ping",
        typeTags: "s",
        expectedArgs: [requestId],
        expectedSourceHosts,
      });
      logger?.(`[connection] received callback: ${message.address}`);
      return { ok: true, requestId, command, message, ...readbackTalkStatus(sendResult) };
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

  const scriptLines = propertyReadbackScriptLines(address, typeTag, options.propertyPath, options);
  const script = scriptLines.join("\n");
  try {
    validateTalkCommandLines(scriptLines);
    const udpPayloadError = udpPayloadPreflightError(scriptLines, options);
    if (udpPayloadError) {
      return {
        ok: false,
        requestId,
        propertyPath: options.propertyPath,
        script,
        error: udpPayloadError,
      };
    }
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

  try {
    return await withOscPortLock(options, async () => {
      logger?.(`[readback] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address,
            typeTags: typeTag,
            expectedSourceHosts,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {});

      await listener.ready;
      logger?.(`[readback] listener ready, sending property read script for ${options.propertyPath}`);
      const sendResult = await sendReadbackTalk(scriptLines, options, transport);
      if (!sendResult.ok) {
        closeReadbackOscListener(listener);
        return {
          ok: false,
          requestId,
          propertyPath: options.propertyPath,
          script,
          ...readbackTalkStatus(sendResult),
          error: sendResult.error ?? "Talk send failed.",
        };
      }
      logger?.("[readback] script sent, awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address,
        typeTags: typeTag,
        expectedSourceHosts,
      });
      logger?.(`[readback] received callback: ${message.address} args=${JSON.stringify(message.args)}`);
      const raw = message.args[0];
      const value = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
      return {
        ok: true,
        requestId,
        propertyPath: options.propertyPath,
        script,
        value,
        message,
        ...readbackTalkStatus(sendResult),
      };
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

export interface WriteVerifyResult extends ReadbackTalkStatus {
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

  const scriptLines = writeVerifyScriptLines(options.command, address, typeTag, options.readbackPath, options);
  try {
    validateTalkCommandLines(scriptLines);
    const udpPayloadError = udpPayloadPreflightError(scriptLines, options);
    if (udpPayloadError) {
      return {
        ok: false,
        command: options.command,
        readbackPath: options.readbackPath,
        expected: options.expectedValue,
        matched: false,
        restored: false,
        error: udpPayloadError,
      };
    }
    if (options.restoreCommand) {
      validateTalkCommandLines([options.restoreCommand]);
      const restorePayloadError = udpPayloadPreflightError([options.restoreCommand], options);
      if (restorePayloadError) {
        return {
          ok: false,
          command: options.command,
          readbackPath: options.readbackPath,
          expected: options.expectedValue,
          matched: false,
          restored: false,
          error: restorePayloadError,
        };
      }
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
  let after: number | string | undefined;
  let matched = false;
  let restored = false;
  let writePacketSent = false;
  const sendRestore = async (): Promise<void> => {
    if (!options.restoreCommand) return;
    try {
      const restoreResult = await sendReadbackTalk([options.restoreCommand], options, transport);
      if (!restoreResult.ok) {
        throw new Error(restoreResult.error ?? "restore send failed");
      }
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
        const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
        const listener = transport.listenForOsc(
          options.listenHost,
          options.listenPort,
          (message) =>
            isExpectedOscCallback(message, {
              address,
              typeTags: typeTag,
              expectedSourceHosts,
            }),
          options.timeoutMs,
        );

        listener.message.catch(() => {});

        await listener.ready;
        logger?.(`[verify] listener ready, sending write+readback script for ${options.command}`);
        const sendResult = await sendReadbackTalk(scriptLines, options, transport);
        if (!sendResult.ok) {
          closeReadbackOscListener(listener);
          writePacketSent = writeCommandMayHaveReachedBeyond(sendResult);
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
            ...readbackTalkStatus(sendResult),
            error: sendResult.error ?? "Talk send failed.",
          };
        }
        writePacketSent = true;
        logger?.("[verify] script sent, awaiting OSC callback");
        const message = await listener.message;
        assertExpectedOscCallback(message, {
          address,
          typeTags: typeTag,
          expectedSourceHosts,
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
          ...readbackTalkStatus(sendResult),
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

function propertyReadbackScriptLines(
  address: string,
  typeTag: "f" | "i" | "s",
  propertyPath: string,
  options: ReadbackOptions,
): string[] {
  if (usesStatusProducingReadbackLine(options)) {
    return [`OscOutTTS "${address}", "${typeTag}", ${propertyPath}`];
  }
  return ["var v", `v = ${propertyPath}`, `OscOutTTS "${address}", "${typeTag}", v`];
}

function writeVerifyScriptLines(
  command: string,
  address: string,
  typeTag: "f" | "i" | "s",
  readbackPath: string,
  options: ReadbackOptions,
): string[] {
  if (usesStatusProducingReadbackLine(options)) {
    return [command, `OscOutTTS "${address}", "${typeTag}", ${readbackPath}`];
  }
  return [command, "var v", `v = ${readbackPath}`, `OscOutTTS "${address}", "${typeTag}", v`];
}

function usesStatusProducingReadbackLine(options: ReadbackOptions): boolean {
  const transport = options.talkTransport ?? "udp";
  return transport === "tcp" || transport === "auto";
}

async function sendReadbackTalk(
  commands: readonly string[],
  options: ReadbackOptions,
  transport: ReadbackTransport,
): Promise<RunScriptResult> {
  return runScript(commands.join("\n"), {
    talkHost: options.talkHost,
    talkPort: options.talkPort,
    talkTransport: options.talkTransport ?? "udp",
    talkTcpHost: options.talkTcpHost,
    talkTcpPort: options.talkTcpPort,
    talkUdpHost: options.talkUdpHost ?? options.talkHost,
    talkUdpPort: options.talkUdpPort ?? options.talkPort,
    talkUdpFallbackAllowed: options.talkUdpFallbackAllowed,
    talkTcpPassword: options.talkTcpPassword,
    commandTimeoutMs: options.commandTimeoutMs ?? options.timeoutMs,
    send: transport.sendTalk,
    sendTcp: transport.sendTalkTcp,
  });
}

function readbackTalkStatus(result: RunScriptResult): ReadbackTalkStatus {
  return {
    transport: result.transport,
    talkStatus: result.talkStatus,
    talkGreeting: result.talkGreeting,
    talkReplies: result.talkReplies,
    beyondError: result.beyondError,
    linesSent: result.linesSent,
    payloadsSent: result.payloadsSent,
    bytesSent: result.bytesSent,
  };
}

function writeCommandMayHaveReachedBeyond(result: RunScriptResult): boolean {
  if (result.transport === "udp") {
    return result.payloadsSent > 0 || result.bytesSent > 0;
  }
  if (result.transport === "tcp") {
    return (
      result.linesSent > 0 ||
      result.talkReplies?.some((reply) => reply.lineNumber === 1) === true ||
      result.beyondError?.lineNumber === 1
    );
  }
  return false;
}

function udpPayloadPreflightError(commands: readonly string[], options: ReadbackOptions): string | undefined {
  if (!readbackUdpMayBeUsed(options)) {
    return undefined;
  }
  const payloads = buildTalkPayloads([...commands]);
  return payloads.length > 1 ? "Script exceeded payload limit." : undefined;
}

function readbackUdpMayBeUsed(options: ReadbackOptions): boolean {
  const transport = options.talkTransport ?? "udp";
  return transport === "udp" || (transport === "auto" && options.talkUdpFallbackAllowed === true);
}

function expectedReadbackOscSourceHosts(options: ReadbackOptions): string[] {
  const transport = options.talkTransport ?? "udp";
  if (transport === "tcp") {
    return [options.talkTcpHost ?? options.talkHost];
  }
  if (transport === "auto") {
    const tcpHost = options.talkTcpHost ?? options.talkHost;
    const udpHost = options.talkUdpHost ?? options.talkHost;
    return options.talkUdpFallbackAllowed ? uniqueDefinedHosts([tcpHost, udpHost]) : [tcpHost];
  }
  return [options.talkUdpHost ?? options.talkHost];
}

function uniqueDefinedHosts(hosts: readonly string[]): string[] {
  return [...new Set(hosts.filter((host) => host.trim().length > 0))];
}

function closeReadbackOscListener(listener: ReadbackOscListener): void {
  try {
    listener.close?.();
  } catch {
    // Listener cleanup is best-effort after transport failure. The original
    // Talk send result remains the actionable error for the caller.
  }
}

interface ExpectedOscCallback {
  address: string;
  typeTags: "f" | "i" | "s";
  expectedSourceHosts: readonly string[];
  expectedArgs?: readonly OscArg[];
}

function isExpectedOscCallback(message: OscMessage, expected: ExpectedOscCallback): boolean {
  if (message.address !== expected.address) return false;
  if (message.typeTags !== expected.typeTags) return false;
  if (!sourceMatchesAnyExpectedHost(message, expected.expectedSourceHosts)) return false;

  if (expected.expectedArgs) {
    if (message.args.length !== expected.expectedArgs.length) return false;
    return expected.expectedArgs.every((arg, index) => message.args[index] === arg);
  }

  if (message.args.length !== expected.typeTags.length) return false;
  return expected.typeTags.split("").every((tag, index) => argMatchesTypeTag(message.args[index], tag));
}

function sourceMatchesAnyExpectedHost(message: OscMessage, expectedHosts: readonly string[]): boolean {
  return expectedHosts.length === 0 || expectedHosts.some((host) => sourceMatchesExpectedHost(message, host));
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
