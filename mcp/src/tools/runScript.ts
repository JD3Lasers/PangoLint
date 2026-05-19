// Tool: runScript: sends a straight-line PangoScript command batch to the
// configured BEYOND host via Talk. The lint-before-run gate refuses
// `error`-severity diagnostics or analysis-limited lint results, and the shared
// runtime transport refuses control-flow scripts because Talk is not BEYOND
// editor-equivalent. Hint and warning diagnostics are reported but do not block;
// agents are expected to surface them to the user.

import type { CommandCatalog } from "../../../src/knowledge/catalog";
import type { CommandKnowledgeEntry } from "../../../src/knowledge/knowledgeBase";
import type { ObjectPropertyIndex } from "../../../src/knowledge/objectPropertyIndex";
import type { PropertyIndex } from "../../../src/knowledge/propertyIndex";
import { mcpTextLimitReason } from "../../../src/language/analysisLimits";
import { lintPangoScript } from "../../../src/language/diagnostics";
import type { PangoDiagnostic } from "../../../src/language/diagnostics/pangoDiagnostic";
import { runScript as runtimeRunScript } from "../../../src/runtime/runScript";
import type { SendTalkTcpCommandsOptions, SendTalkTcpCommandsResult, TalkTcpReply } from "../../../src/runtime/talkTcp";
import type { McpConfig } from "../config";
import { fail, ok, type ToolResult } from "../config";

export interface RunScriptInput {
  text: string;
}

export interface RunScriptOutput {
  /** True when Talk UDP transmission completed without error. */
  ok: boolean;
  /** Lint summary returned regardless of whether send was attempted. */
  diagnostics: PangoDiagnostic[];
  errorCount: number;
  warningCount: number;
  hintCount: number;
  transport?: "tcp" | "udp";
  talkHost?: string;
  talkPort?: number;
  talkStatus?: "ok" | "error" | "timeout" | "closed" | "send-only";
  talkGreeting?: string;
  talkReplies: TalkTcpReply[];
  beyondError?: SendTalkTcpCommandsResult["beyondError"];
  /** Number of non-blank, non-comment lines transmitted (0 when refused). */
  linesSent: number;
  /** Number of UDP datagrams transmitted. */
  payloadsSent: number;
  /** Total bytes transmitted. */
  bytesSent: number;
  /** Reason for refusal or transport failure, when applicable. */
  error?: string;
  /** True iff send was refused due to error-severity diagnostics. */
  refusedDueToErrors?: boolean;
  /** True iff send was refused because linting intentionally skipped analysis. */
  refusedDueToAnalysisLimit?: boolean;
}

export type RunScriptResult = ToolResult<RunScriptOutput>;

export interface RunScriptDeps {
  /** Test hook: defaults to the real Talk UDP sender. */
  send?: (host: string, port: number, payload: Buffer) => Promise<void>;
  /** Test hook: defaults to the real Talk TCP sender. */
  sendTcp?: (options: SendTalkTcpCommandsOptions) => Promise<SendTalkTcpCommandsResult>;
}

interface LintInput {
  catalog: CommandCatalog;
  knowledgeByName: Map<string, CommandKnowledgeEntry>;
  propertyIndex: PropertyIndex;
  objectPropertyIndex?: ObjectPropertyIndex;
}

export async function runScript(
  input: RunScriptInput,
  config: McpConfig,
  lintInput: LintInput,
  deps: RunScriptDeps = {},
): Promise<RunScriptResult> {
  if (!config.runtimeWriteEnabled) {
    return fail("runtime write disabled - set PANGOLINT_MCP_RUNTIME_WRITE=enabled to enable runScript", true);
  }
  if (typeof input.text !== "string") return fail("text is required");
  const textLimitReason = mcpTextLimitReason(input.text);
  if (textLimitReason) return fail(`text exceeds MCP runScript limit: ${textLimitReason}`);

  const diagnostics = lintPangoScript(
    input.text,
    lintInput.catalog,
    lintInput.knowledgeByName,
    lintInput.propertyIndex,
    lintInput.objectPropertyIndex,
  );
  let errorCount = 0;
  let warningCount = 0;
  let hintCount = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errorCount++;
    else if (d.severity === "warning") warningCount++;
    else hintCount++;
  }
  const analysisLimited = diagnostics.some((diagnostic) => diagnostic.code === "analysis-limited");

  if (errorCount > 0) {
    return ok({
      ok: false,
      diagnostics,
      errorCount,
      warningCount,
      hintCount,
      talkReplies: [],
      linesSent: 0,
      payloadsSent: 0,
      bytesSent: 0,
      error: `refused: script has ${errorCount} error-severity diagnostic${errorCount === 1 ? "" : "s"} - fix these and retry`,
      refusedDueToErrors: true,
    });
  }
  if (analysisLimited) {
    return ok({
      ok: false,
      diagnostics,
      errorCount,
      warningCount,
      hintCount,
      talkReplies: [],
      linesSent: 0,
      payloadsSent: 0,
      bytesSent: 0,
      error: "refused: script analysis was skipped or capped by PangoLint limits",
      refusedDueToAnalysisLimit: true,
    });
  }

  const sendResult = await runtimeRunScript(input.text, {
    talkHost: config.beyondTalkHost,
    talkPort: config.beyondTalkPort,
    talkTransport: config.beyondTalkTransport,
    talkTcpHost: config.beyondTalkTcpHost,
    talkTcpPort: config.beyondTalkTcpPort,
    talkUdpHost: config.beyondTalkUdpHost,
    talkUdpPort: config.beyondTalkUdpPort,
    talkUdpFallbackAllowed: config.beyondTalkUdpFallbackAllowed,
    talkTcpPassword: config.beyondTalkTcpPassword,
    commandTimeoutMs: config.readbackTimeoutMs,
    send: deps.send,
    sendTcp: deps.sendTcp,
  });

  return ok({
    ok: sendResult.ok,
    diagnostics,
    errorCount,
    warningCount,
    hintCount,
    transport: sendResult.transport,
    talkHost: sendResult.transport === "tcp" ? config.beyondTalkTcpHost : config.beyondTalkUdpHost,
    talkPort: sendResult.transport === "tcp" ? config.beyondTalkTcpPort : config.beyondTalkUdpPort,
    talkStatus: sendResult.talkStatus,
    talkGreeting: sendResult.talkGreeting,
    talkReplies: sendResult.talkReplies ?? [],
    beyondError: sendResult.beyondError,
    linesSent: sendResult.linesSent,
    payloadsSent: sendResult.payloadsSent,
    bytesSent: sendResult.bytesSent,
    error: sendResult.error,
  });
}
