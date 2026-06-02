// Tool: readReceivedOscMessages: bounded OSC receive window on the
// configured callback port. This is read-runtime only: it listens for
// BEYOND OSC feedback and returns decoded packets without sending Talk
// commands or changing BEYOND state.

import { PANGO_ANALYSIS_LIMITS } from "../../../src/language/mcpLanguageExports";
import {
  startOscCapture as defaultStartOscCapture,
  type OscCaptureResult,
  type OscMessage,
  type StartOscCapture,
} from "../../../src/runtime/mcpRuntimeExports";
import type { McpConfig } from "../config";
import { fail, ok, type ToolResult } from "../toolResult";

const DEFAULT_MAX_MESSAGES = 32;
const MAX_MESSAGES = 256;
const MAX_ADDRESS_FILTERS = 64;

export interface ReadReceivedOscMessagesInput {
  /** Exact OSC addresses to receive. When omitted with no prefix, every decoded OSC packet is returned. */
  addresses?: string[];
  /** OSC address prefix to receive, e.g. "/pangolint/" or "/b/Zone/". */
  addressPrefix?: string;
  /** Receive window in milliseconds. Defaults to the configured readback timeout. */
  timeoutMs?: number;
  /** Maximum number of matching packets to return before the receive window closes. */
  maxMessages?: number;
}

interface ReadReceivedOscMessagesOutput {
  ok: boolean;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  maxMessages: number;
  addresses: string[];
  addressPrefix?: string;
  expectedSourceHost?: string;
  timedOut: boolean;
  messageCount: number;
  messages: OscMessage[];
  error?: string;
}

export type ReadReceivedOscMessagesResult = ToolResult<ReadReceivedOscMessagesOutput>;

export interface ReadReceivedOscMessagesDeps {
  /** Test hook: defaults to the real Node OSC capture listener. */
  startCapture?: StartOscCapture;
}

export async function readReceivedOscMessages(
  input: ReadReceivedOscMessagesInput,
  config: McpConfig,
  deps: ReadReceivedOscMessagesDeps = {},
): Promise<ReadReceivedOscMessagesResult> {
  if (!config.runtimeReadEnabled) {
    return fail("runtime read disabled: set PANGOLINT_MCP_RUNTIME_READ=enabled to enable read runtime tools", true);
  }

  const addresses = normalizeOscAddressFilters(input.addresses);
  if (typeof addresses === "string") return fail(addresses);

  const addressPrefix = normalizeOptionalOscAddress(input.addressPrefix, "OSC addressPrefix");
  if (typeof addressPrefix === "string" && addressPrefix.startsWith("error:")) {
    return fail(addressPrefix.slice("error:".length));
  }

  const timeoutMs = normalizeTimeoutMs(input.timeoutMs, config.readbackTimeoutMs);
  if (typeof timeoutMs === "string") return fail(timeoutMs);

  const maxMessages = normalizeMaxMessages(input.maxMessages);
  if (typeof maxMessages === "string") return fail(maxMessages);

  const expectedSourceHost = expectedOscSourceHostFromConfig(config);
  const startCapture = deps.startCapture ?? defaultStartOscCapture;
  let capture: Awaited<ReturnType<StartOscCapture>> | undefined;
  let captureResult: OscCaptureResult;

  try {
    capture = await startCapture({
      listenHost: config.oscListenHost,
      listenPort: config.oscListenPort,
      timeoutMs,
      addresses,
      addressPrefix,
      expectedSourceHost,
      maxMessages,
    });
    capture.done.catch(() => {
      // The result is awaited below. This prevents an early rejection from
      // becoming an unhandled rejection if the listener fails before ready.
    });
    await capture.ready;
    captureResult = await capture.done;
  } catch (error) {
    capture?.stop();
    return fail(`OSC receive failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return ok({
    ok: captureResult.ok,
    listenHost: config.oscListenHost,
    listenPort: config.oscListenPort,
    timeoutMs,
    maxMessages,
    addresses,
    addressPrefix,
    expectedSourceHost,
    timedOut: captureResult.timedOut,
    messageCount: captureResult.messages.length,
    messages: captureResult.messages,
    error: captureResult.error,
  });
}

function normalizeOscAddressFilters(addresses: string[] | undefined): string[] | string {
  if (!addresses) return [];
  if (!Array.isArray(addresses)) return "addresses must be an array of OSC address strings";
  if (addresses.length > MAX_ADDRESS_FILTERS) {
    return `addresses exceeds MCP readReceivedOscMessages limit: max ${MAX_ADDRESS_FILTERS}`;
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawAddress of addresses) {
    const address = normalizeOptionalOscAddress(rawAddress, "OSC address filters");
    if (typeof address === "string" && address.startsWith("error:")) {
      return address.slice("error:".length);
    }
    if (address && !seen.has(address)) {
      seen.add(address);
      result.push(address);
    }
  }
  return result;
}

function normalizeOptionalOscAddress(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return `error:${label} must be a string`;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) {
      return `error:${label} must be printable ASCII paths starting with "/"`;
    }
  }
  const address = value.trim();
  if (!address) return undefined;
  if (!address.startsWith("/")) {
    return `error:${label} must be printable ASCII paths starting with "/"`;
  }
  if (address.length > PANGO_ANALYSIS_LIMITS.maxMcpNameChars) {
    return `error:${label} exceeds MCP name limit: max ${PANGO_ANALYSIS_LIMITS.maxMcpNameChars} characters`;
  }
  return address;
}

function normalizeTimeoutMs(timeoutMs: number | undefined, configuredTimeoutMs: number): number | string {
  if (timeoutMs === undefined) return configuredTimeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    return "timeoutMs must be a positive integer";
  }
  if (timeoutMs > configuredTimeoutMs) {
    return `timeoutMs exceeds configured PANGOLINT_MCP_READBACK_TIMEOUT_MS (${configuredTimeoutMs})`;
  }
  return timeoutMs;
}

function normalizeMaxMessages(maxMessages: number | undefined): number | string {
  if (maxMessages === undefined) return DEFAULT_MAX_MESSAGES;
  if (!Number.isInteger(maxMessages) || maxMessages <= 0) {
    return "maxMessages must be a positive integer";
  }
  if (maxMessages > MAX_MESSAGES) {
    return `maxMessages exceeds MCP readReceivedOscMessages limit: max ${MAX_MESSAGES}`;
  }
  return maxMessages;
}

function expectedOscSourceHostFromConfig(config: McpConfig): string | undefined {
  if (config.beyondTalkTransport === "tcp") {
    return config.beyondTalkTcpHost;
  }
  if (config.beyondTalkTransport === "udp") {
    return config.beyondTalkUdpHost;
  }
  return config.beyondTalkUdpFallbackAllowed && config.beyondTalkTcpHost !== config.beyondTalkUdpHost
    ? undefined
    : config.beyondTalkTcpHost;
}
