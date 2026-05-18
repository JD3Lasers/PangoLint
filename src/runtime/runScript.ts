// Send straight-line PangoScript command batches to BEYOND via Talk UDP.
// Talk UDP is not equivalent to running a script in BEYOND's editor; control
// flow is refused before transport so skipped branches, loops, and exits are
// not flattened into line-by-line execution.

import { type ParsedLine, parseScript } from "../language/parser";
import { buildTalkPayloads, sendTalkUdp } from "./talkUdp";

export interface RunScriptOptions {
  talkHost: string;
  talkPort: number;
  /** Max bytes per UDP datagram. Defaults to 1200 to stay below typical MTU. */
  maxPayloadBytes?: number;
  /** Hook for testing — defaults to the real UDP sender. */
  send?: (host: string, port: number, payload: Buffer) => Promise<void>;
}

export interface RunScriptResult {
  ok: boolean;
  /** Number of non-blank, non-comment lines actually transmitted. */
  linesSent: number;
  /** Number of UDP datagrams transmitted. */
  payloadsSent: number;
  /** Total bytes transmitted. */
  bytesSent: number;
  error?: string;
}

export interface TalkControlFlowFinding {
  lineNumber: number;
  lineText: string;
  construct: string;
}

const CONTROL_FLOW_COMMANDS = new Set(["exit", "for", "loop", "next", "restart", "sleep", "while"]);

export function findUnsupportedTalkControlFlow(text: string): TalkControlFlowFinding[] {
  const findings: TalkControlFlowFinding[] = [];
  for (const line of parseScript(text).lines) {
    const finding = controlFlowFindingForLine(line);
    if (finding) {
      findings.push(finding);
    }
  }
  return findings;
}

/**
 * Strip blank lines and full-line comments, then send to BEYOND. Inline
 * trailing comments (e.g. `Brightness 50  // dim`) are preserved as-is —
 * BEYOND's parser drops them.
 */
export async function runScript(text: string, options: RunScriptOptions): Promise<RunScriptResult> {
  const controlFlowFindings = findUnsupportedTalkControlFlow(text);
  if (controlFlowFindings.length > 0) {
    return {
      ok: false,
      linesSent: 0,
      payloadsSent: 0,
      bytesSent: 0,
      error: formatUnsupportedTalkControlFlowError(controlFlowFindings),
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !/^\s*\/\//.test(line));

  if (lines.length === 0) {
    return { ok: false, linesSent: 0, payloadsSent: 0, bytesSent: 0, error: "No executable lines to send." };
  }

  let payloads: Buffer[];
  try {
    payloads = buildTalkPayloads(lines, { maxPayloadBytes: options.maxPayloadBytes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, linesSent: 0, payloadsSent: 0, bytesSent: 0, error: message };
  }

  const send = options.send ?? sendTalkUdp;
  let bytesSent = 0;
  let payloadsSent = 0;
  try {
    for (const payload of payloads) {
      await send(options.talkHost, options.talkPort, payload);
      payloadsSent++;
      bytesSent += payload.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, linesSent: lines.length, payloadsSent, bytesSent, error: message };
  }

  return {
    ok: true,
    linesSent: lines.length,
    payloadsSent,
    bytesSent,
  };
}

function controlFlowFindingForLine(line: ParsedLine): TalkControlFlowFinding | undefined {
  if (line.kind === "blank" || line.kind === "comment") {
    return undefined;
  }
  if (line.label) {
    return buildFinding(line, "label");
  }
  if (line.kind === "if" || line.kind === "goto" || line.kind === "blockBoundary") {
    return buildFinding(line, line.kind);
  }
  const commandName = line.command?.name.toLowerCase();
  if (!commandName) {
    return undefined;
  }
  if (CONTROL_FLOW_COMMANDS.has(commandName) || commandName.startsWith("waitfor")) {
    return buildFinding(line, line.command?.name ?? commandName);
  }
  return undefined;
}

function buildFinding(line: ParsedLine, construct: string): TalkControlFlowFinding {
  const lineText = (line.code || line.raw).trim();
  return {
    lineNumber: line.lineNumber + 1,
    lineText: lineText.length > 120 ? `${lineText.slice(0, 117)}...` : lineText,
    construct,
  };
}

export function formatUnsupportedTalkControlFlowError(findings: readonly TalkControlFlowFinding[]): string {
  const first = findings[0];
  const extra =
    findings.length > 1
      ? ` (${findings.length - 1} more control-flow line${findings.length === 2 ? "" : "s"} found)`
      : "";
  return `Talk UDP can only send straight-line command batches. This script contains ${first.construct} control flow at line ${first.lineNumber}: ${first.lineText}.${extra} Paste/run it directly in BEYOND's PangoScript editor to test full script control flow.`;
}
