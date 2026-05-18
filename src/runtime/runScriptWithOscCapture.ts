import { splitCodeAndComment } from "../language/parser";
import type { OscCaptureResult, StartOscCapture } from "./oscCapture";
import { startOscCapture as defaultStartOscCapture } from "./oscCapture";
import type { RunScriptOptions, RunScriptResult } from "./runScript";
import { findUnsupportedTalkControlFlow, formatUnsupportedTalkControlFlowError, runScript } from "./runScript";

export interface RunScriptWithOscCaptureOptions extends RunScriptOptions {
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  capturePrefix?: string;
  maxCallbackMessages?: number;
  startCapture?: StartOscCapture;
}

export interface RunScriptWithOscCaptureResult extends RunScriptResult {
  callbackAddresses: string[];
  callbacks?: OscCaptureResult;
}

const DEFAULT_CAPTURE_PREFIX = "/pangolint/";
const OSC_OUT_TTS_ADDRESS_RE = /\bOscOutTTS\s*(?:\(\s*)?"((?:\\.|[^"\\])*)"/gi;

export function extractPangoLintOscAddresses(text: string, prefix = DEFAULT_CAPTURE_PREFIX): string[] {
  const addresses = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const { code } = splitCodeAndComment(rawLine);
    OSC_OUT_TTS_ADDRESS_RE.lastIndex = 0;
    let match = OSC_OUT_TTS_ADDRESS_RE.exec(code);
    while (match !== null) {
      const address = decodePangoStringFragment(match[1]);
      if (isCapturableAddress(address, prefix)) {
        addresses.add(address);
      }
      match = OSC_OUT_TTS_ADDRESS_RE.exec(code);
    }
  }
  return [...addresses];
}

export async function runScriptWithOscCapture(
  text: string,
  options: RunScriptWithOscCaptureOptions,
): Promise<RunScriptWithOscCaptureResult> {
  const callbackAddresses = extractPangoLintOscAddresses(text, options.capturePrefix ?? DEFAULT_CAPTURE_PREFIX);
  const controlFlowFindings = findUnsupportedTalkControlFlow(text);
  if (controlFlowFindings.length > 0) {
    return {
      ok: false,
      linesSent: 0,
      payloadsSent: 0,
      bytesSent: 0,
      error: formatUnsupportedTalkControlFlowError(controlFlowFindings),
      callbackAddresses,
    };
  }

  const startCapture = options.startCapture ?? defaultStartOscCapture;
  let capture: Awaited<ReturnType<StartOscCapture>> | undefined;

  if (callbackAddresses.length > 0) {
    try {
      capture = await startCapture({
        listenHost: options.listenHost,
        listenPort: options.listenPort,
        timeoutMs: options.timeoutMs,
        addresses: callbackAddresses,
        expectedSourceHost: options.talkHost,
        maxMessages: options.maxCallbackMessages,
      });
      capture.done.catch(() => {
        // The caller awaits this promise after the send; this suppresses any
        // early rejection from an injected capture session.
      });
      await capture.ready;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      capture?.stop();
      return {
        ok: false,
        linesSent: 0,
        payloadsSent: 0,
        bytesSent: 0,
        error: message,
        callbackAddresses,
        callbacks: { ok: false, messages: [], timedOut: false, error: message },
      };
    }
  }

  const result = await runScript(text, options);
  if (!capture) {
    return { ...result, callbackAddresses };
  }

  if (!result.ok) {
    capture.stop();
  }
  const callbacks = await capture.done;
  return { ...result, callbackAddresses, callbacks };
}

function decodePangoStringFragment(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

function isCapturableAddress(address: string, prefix: string): boolean {
  if (!address.startsWith(prefix)) {
    return false;
  }
  for (let index = 0; index < address.length; index += 1) {
    const code = address.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) {
      return false;
    }
  }
  return true;
}
