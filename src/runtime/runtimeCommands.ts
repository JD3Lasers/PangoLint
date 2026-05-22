import * as vscode from "vscode";
import {
  EXTENSION_COMMAND_IDS,
  EXTENSION_CONFIG_SECTIONS,
  EXTENSION_OUTPUT_CHANNELS,
  EXTENSION_SETTING_KEYS,
  PANGOSCRIPT_LANGUAGE_ID,
} from "../extensionHost/extensionIds";
import type { PangoDiagnostic } from "../language/diagnostics/pangoDiagnostic";
import { propertyPathAtPosition } from "../language/propertyPath";
import { requireWorkspaceTrust } from "../workspace/workspaceTrust";
import { checkBeyondConnection, readBeyondProperty, verifyCommandWrite } from "./beyondReadback";
import { evaluateRuntimeLintGate } from "./lintGate";
import { buildObjectValueAssignment } from "./objectValueAssignment";
import type { OscMessage } from "./osc";
import type { RunScriptWithOscCaptureResult } from "./runScriptWithOscCapture";
import { runScriptWithOscCapture } from "./runScriptWithOscCapture";
import { type BeyondRuntimeConfig, getBeyondRuntimeConfig } from "./runtimeConfig";
import { type RuntimeCommandHooks, validateActiveDocumentAgainstBeyond } from "./validationCommands";

interface RunSessionState {
  confirmed: boolean;
  /** Most recently transmitted script text, used by 'Re-run last script'. */
  lastText?: string;
  /** Status bar item shown once a successful run occurs. */
  replayStatusItem?: vscode.StatusBarItem;
}

interface RuntimeCommandsHooks extends RuntimeCommandHooks {
  onCapturedOscMessages?: (messages: readonly OscMessage[]) => void;
  lintScriptText?: (text: string) => readonly PangoDiagnostic[];
}

export function registerBeyondRuntimeCommands(context: vscode.ExtensionContext, hooks?: RuntimeCommandsHooks): void {
  const output = vscode.window.createOutputChannel(EXTENSION_OUTPUT_CHANNELS.run);
  const state: RunSessionState = { confirmed: false };

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.checkBeyondConnection, async () => {
      if (!requireWorkspaceTrust("BEYOND runtime readback checks")) return;
      const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "PangoLint testing BEYOND connection",
          cancellable: false,
        },
        () => checkBeyondConnection(getBeyondRuntimeConfig(config)),
      );

      if (result.ok) {
        void vscode.window.showInformationMessage(`BEYOND readback succeeded: ${result.requestId}`);
      } else {
        void vscode.window.showErrorMessage(`BEYOND readback failed: ${result.error ?? "unknown error"}`);
      }
    }),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.runScript, () =>
      runActiveDocument(output, state, { selectionOnly: false }, hooks),
    ),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.runSelection, () =>
      runActiveDocument(output, state, { selectionOnly: true }, hooks),
    ),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.fetchObjectValue, () => fetchObjectValueAtCursor(output)),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.setObjectValue, () => setObjectValueAtCursor(output, state)),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.replayLastScript, () =>
      replayLastScript(output, state, hooks),
    ),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.validateObjectsAgainstBeyond, () =>
      validateActiveDocumentAgainstBeyond(output, hooks),
    ),
  );
}

/**
 * Send the active editor's straight-line PangoScript document (or selection)
 * to BEYOND as a Talk command batch. Safety-gated by workspace trust, the
 * execution setting, and a per-session confirmation modal.
 */
async function runActiveDocument(
  output: vscode.OutputChannel,
  state: RunSessionState,
  opts: { selectionOnly: boolean },
  hooks: RuntimeCommandsHooks | undefined,
): Promise<void> {
  if (!requireWorkspaceTrust("BEYOND Talk batch execution")) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
    void vscode.window.showErrorMessage("PangoLint: Open a .BeyondCode file before running.");
    return;
  }

  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
  if (!config.get<boolean>(EXTENSION_SETTING_KEYS.allowScriptExecution, false)) {
    void vscode.window.showErrorMessage(
      "PangoLint: Talk batch sending is disabled. Enable 'pangolint.beyond.allowScriptExecution' in settings to send straight-line commands to BEYOND.",
    );
    return;
  }

  const text =
    opts.selectionOnly && !editor.selection.isEmpty
      ? editor.document.getText(editor.selection)
      : editor.document.getText();
  if (!text.trim()) {
    void vscode.window.showWarningMessage("PangoLint: Nothing to run (empty selection or document).");
    return;
  }

  const runtimeConfig = getBeyondRuntimeConfig(config);
  const { timeoutMs } = runtimeConfig;
  const lineCount = text.split(/\r?\n/).filter((line) => line.trim() && !/^\s*\/\//.test(line)).length;
  const lintGate = hooks?.lintScriptText ? evaluateRuntimeLintGate(hooks.lintScriptText(text)) : undefined;
  if (lintGate && !lintGate.ok) {
    output.show(true);
    output.appendLine(
      `[${new Date().toISOString()}] lint gate refused Talk batch - errors=${lintGate.errorCount} warnings=${lintGate.warningCount} hints=${lintGate.hintCount}`,
    );
    output.appendLine(`  FAIL - ${lintGate.error}`);
    void vscode.window.showErrorMessage(`PangoLint run blocked: ${lintGate.error}`);
    return;
  }

  if (!state.confirmed || config.get<boolean>(EXTENSION_SETTING_KEYS.confirmRunEachSession, true)) {
    const target = opts.selectionOnly ? "selection" : "document";
    const choice = await vscode.window.showWarningMessage(
      `Send ${lineCount} executable line${lineCount === 1 ? "" : "s"} from this ${target} as a BEYOND Talk command batch to ${describeConfiguredTalkTarget(runtimeConfig)}?\n\nBEYOND Talk command transport is not the editor runner. PangoLint blocks labels, goto, if, loops, waits, and exit; paste full control-flow scripts into BEYOND's PangoScript editor.`,
      { modal: true },
      "Run",
    );
    if (choice !== "Run") return;
    state.confirmed = true;
  }

  output.show(true);
  output.appendLine(`[${new Date().toISOString()}] ${formatConfiguredRunHeader(runtimeConfig, lineCount)}`);

  const result = await runScriptWithOscCapture(text, runtimeConfig);
  if (result.ok) {
    appendTalkRunResult(output, result);
    appendCallbackCaptureResult(output, result, timeoutMs);
    notifyCapturedCallbacks(result, hooks);
    void vscode.window.setStatusBarMessage(
      `PangoLint: sent ${result.linesSent} Talk line${result.linesSent === 1 ? "" : "s"} over ${result.transport === "tcp" ? "TCP" : "UDP"}`,
      3000,
    );
    state.lastText = text;
    showReplayStatusItem(state, lineCount);
  } else {
    appendTalkRunResult(output, result);
    output.appendLine(`  FAIL - ${result.error}`);
    void vscode.window.showErrorMessage(`PangoLint run failed: ${result.error}`);
  }
}

/**
 * Re-send the most recently successful runActiveDocument Talk batch.
 * Goes through the same safety gate so replay is not a backdoor around the
 * play-button rules.
 */
async function replayLastScript(
  output: vscode.OutputChannel,
  state: RunSessionState,
  hooks: RuntimeCommandsHooks | undefined,
): Promise<void> {
  if (!requireWorkspaceTrust("BEYOND Talk batch replay")) return;
  if (!state.lastText) {
    void vscode.window.showWarningMessage("PangoLint: No previous script to re-run. Run a script first.");
    return;
  }
  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
  if (!config.get<boolean>(EXTENSION_SETTING_KEYS.allowScriptExecution, false)) {
    void vscode.window.showErrorMessage(
      "PangoLint: Talk batch sending is disabled. Enable 'pangolint.beyond.allowScriptExecution' to re-run.",
    );
    return;
  }
  const runtimeConfig = getBeyondRuntimeConfig(config);
  const { timeoutMs } = runtimeConfig;
  const lineCount = state.lastText.split(/\r?\n/).filter((line) => line.trim() && !/^\s*\/\//.test(line)).length;

  if (config.get<boolean>(EXTENSION_SETTING_KEYS.confirmRunEachSession, true)) {
    const choice = await vscode.window.showWarningMessage(
      `Re-send the last BEYOND Talk command batch (${lineCount} executable line${lineCount === 1 ? "" : "s"}) to ${describeConfiguredTalkTarget(runtimeConfig)}?`,
      { modal: true },
      "Run",
    );
    if (choice !== "Run") return;
  }

  output.show(true);
  output.appendLine(`[${new Date().toISOString()}] replay ${formatConfiguredRunHeader(runtimeConfig, lineCount)}`);
  const result = await runScriptWithOscCapture(state.lastText, runtimeConfig);
  if (result.ok) {
    appendTalkRunResult(output, result);
    appendCallbackCaptureResult(output, result, timeoutMs);
    notifyCapturedCallbacks(result, hooks);
    void vscode.window.setStatusBarMessage(
      `PangoLint: replayed ${result.linesSent} Talk line${result.linesSent === 1 ? "" : "s"} over ${result.transport === "tcp" ? "TCP" : "UDP"}`,
      3000,
    );
  } else {
    appendTalkRunResult(output, result);
    output.appendLine(`  FAIL - ${result.error}`);
    void vscode.window.showErrorMessage(`PangoLint replay failed: ${result.error}`);
  }
}

function formatConfiguredRunHeader(config: BeyondRuntimeConfig, lineCount: number): string {
  if (config.talkTransport === "tcp") {
    return `Talk TCP -> ${config.talkTcpHost}:${config.talkTcpPort} (${lineCount} lines)`;
  }
  if (config.talkTransport === "udp") {
    return `Talk UDP -> ${config.talkUdpHost}:${config.talkUdpPort} (${lineCount} lines)`;
  }
  return `Talk auto -> TCP ${config.talkTcpHost}:${config.talkTcpPort}, UDP fallback ${config.talkUdpFallbackAllowed ? "allowed" : "disabled"} (${lineCount} lines)`;
}

function describeConfiguredTalkTarget(config: BeyondRuntimeConfig): string {
  if (config.talkTransport === "tcp") {
    return `Talk TCP at ${config.talkTcpHost}:${config.talkTcpPort}`;
  }
  if (config.talkTransport === "udp") {
    return `Talk UDP at ${config.talkUdpHost}:${config.talkUdpPort}`;
  }
  return `Talk TCP at ${config.talkTcpHost}:${config.talkTcpPort} with UDP fallback ${config.talkUdpFallbackAllowed ? "allowed" : "disabled"}`;
}

function appendTalkRunResult(output: vscode.OutputChannel, result: RunScriptWithOscCaptureResult): void {
  if (result.transport === "tcp") {
    appendTalkTcpResult(output, result);
    return;
  }
  if (result.transport !== "udp") {
    return;
  }
  output.appendLine(
    `  ${result.ok ? "ok" : "sent"} - ${result.linesSent} line${result.linesSent === 1 ? "" : "s"} over Talk UDP, ${result.payloadsSent} datagram${result.payloadsSent === 1 ? "" : "s"}, ${result.bytesSent} bytes. BEYOND command status unavailable.`,
  );
}

function appendTalkTcpResult(output: vscode.OutputChannel, result: RunScriptWithOscCaptureResult): void {
  if (result.talkGreeting) {
    output.appendLine(`  greeting <- ${result.talkGreeting}`);
  }
  for (const reply of result.talkReplies ?? []) {
    const label = reply.lineNumber === undefined ? "setup" : `line ${reply.lineNumber}`;
    const lines = reply.replyLines.length > 0 ? reply.replyLines.join(" / ") : reply.status;
    output.appendLine(`  ${label} ${reply.status} <- ${lines}`);
  }
  if (result.ok) {
    output.appendLine(`  ok - ${result.linesSent} line${result.linesSent === 1 ? "" : "s"} sent over Talk TCP`);
  }
}

function notifyCapturedCallbacks(result: RunScriptWithOscCaptureResult, hooks: RuntimeCommandsHooks | undefined): void {
  const messages = result.callbacks?.ok ? result.callbacks.messages : [];
  if (messages.length > 0) {
    hooks?.onCapturedOscMessages?.(messages);
  }
}

function appendCallbackCaptureResult(
  output: vscode.OutputChannel,
  result: RunScriptWithOscCaptureResult,
  timeoutMs: number,
): void {
  if (result.callbackAddresses.length === 0) {
    return;
  }
  const callbacks = result.callbacks;
  if (!callbacks) {
    output.appendLine(
      `  callbacks - ${result.callbackAddresses.length} PangoLint OSC address${result.callbackAddresses.length === 1 ? "" : "es"} detected, capture did not run`,
    );
    return;
  }
  if (!callbacks.ok) {
    output.appendLine(`  callbacks FAIL - ${callbacks.error ?? "unknown OSC capture error"}`);
    return;
  }
  if (callbacks.messages.length === 0) {
    output.appendLine(`  callbacks - no matching /pangolint/ OSC messages captured after ${timeoutMs}ms`);
    return;
  }
  output.appendLine(
    `  callbacks - captured ${callbacks.messages.length} matching OSC message${callbacks.messages.length === 1 ? "" : "s"}${callbacks.timedOut ? ` in ${timeoutMs}ms window` : ""}`,
  );
  for (const message of callbacks.messages) {
    output.appendLine(`    ← ${message.address} (${message.typeTags || "no args"}) ${JSON.stringify(message.args)}`);
  }
}

function showReplayStatusItem(state: RunSessionState, lineCount: number): void {
  if (!state.replayStatusItem) {
    state.replayStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    state.replayStatusItem.command = EXTENSION_COMMAND_IDS.replayLastScript;
  }
  state.replayStatusItem.text = `$(debug-restart) Re-run (${lineCount})`;
  state.replayStatusItem.tooltip = "PangoLint: Re-send the last Talk UDP command batch to BEYOND";
  state.replayStatusItem.show();
}

/**
 * Fetch the live value of the property path under the cursor by sending
 * a readback-only script to BEYOND.
 */
async function fetchObjectValueAtCursor(output: vscode.OutputChannel): Promise<void> {
  if (!requireWorkspaceTrust("BEYOND live property fetches")) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
    void vscode.window.showErrorMessage("PangoLint: Open a .BeyondCode file before fetching.");
    return;
  }
  const path = propertyPathAtPosition(editor.document, editor.selection.active);
  if (!path) {
    void vscode.window.showWarningMessage(
      "PangoLint: Place the cursor on a property path (e.g. Master.Brightness, Zone.0.Red).",
    );
    return;
  }

  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
  const runtimeConfig = getBeyondRuntimeConfig(config);

  output.show(true);
  output.appendLine(`[${new Date().toISOString()}] fetch ${path} from ${describeConfiguredTalkTarget(runtimeConfig)}`);

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `PangoLint fetching ${path}`, cancellable: false },
    () => readBeyondProperty({ propertyPath: path, ...runtimeConfig }),
  );

  if (result.ok) {
    output.appendLine(`  ok - ${path} = ${JSON.stringify(result.value)}`);
    void vscode.window.showInformationMessage(`${path} = ${result.value}`);
  } else {
    output.appendLine(`  FAIL - ${result.error}`);
    void vscode.window.showErrorMessage(`PangoLint fetch failed: ${result.error ?? "unknown error"}`);
  }
}

/**
 * Write a new value to the property path under the cursor and verify via
 * readback. This mutates BEYOND state and is gated like Talk batch sends.
 */
async function setObjectValueAtCursor(output: vscode.OutputChannel, state: RunSessionState): Promise<void> {
  if (!requireWorkspaceTrust("BEYOND live property writes")) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
    void vscode.window.showErrorMessage("PangoLint: Open a .BeyondCode file before setting.");
    return;
  }
  const path = propertyPathAtPosition(editor.document, editor.selection.active);
  if (!path) {
    void vscode.window.showWarningMessage(
      "PangoLint: Place the cursor on a property path (e.g. Master.Brightness, Zone.0.Red).",
    );
    return;
  }

  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
  if (!config.get<boolean>(EXTENSION_SETTING_KEYS.allowScriptExecution, false)) {
    void vscode.window.showErrorMessage(
      "PangoLint: Script execution is disabled. Enable 'pangolint.beyond.allowScriptExecution' in settings to write values to BEYOND.",
    );
    return;
  }

  const input = await vscode.window.showInputBox({
    prompt: `New value for ${path}`,
    placeHolder: "e.g. 50, 0.7, name",
    validateInput: (value) => (value.trim() ? null : "Value is required"),
  });
  if (input === undefined) return;
  const assignment = buildObjectValueAssignment(path, input);
  if ("error" in assignment) {
    void vscode.window.showErrorMessage(`PangoLint: ${assignment.error}`);
    return;
  }
  const { command, expectedValue, typeTag } = assignment;

  const runtimeConfig = getBeyondRuntimeConfig(config);

  if (!state.confirmed || config.get<boolean>(EXTENSION_SETTING_KEYS.confirmRunEachSession, true)) {
    const choice = await vscode.window.showWarningMessage(
      `Send '${command}' to BEYOND at ${describeConfiguredTalkTarget(runtimeConfig)} and verify via readback?\n\nThe write executes live on the BEYOND host.`,
      { modal: true },
      "Run",
    );
    if (choice !== "Run") return;
    state.confirmed = true;
  }

  output.show(true);
  output.appendLine(
    `[${new Date().toISOString()}] set ${command} through ${describeConfiguredTalkTarget(runtimeConfig)}`,
  );

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `PangoLint setting ${path}`, cancellable: false },
    () =>
      verifyCommandWrite({
        command,
        readbackPath: path,
        expectedValue,
        typeTag,
        ...runtimeConfig,
      }),
  );

  if (result.ok) {
    const verdict = result.matched ? "matched" : `mismatched (got ${JSON.stringify(result.after)})`;
    output.appendLine(`  ok - readback ${verdict}`);
    void vscode.window.showInformationMessage(
      result.matched
        ? `${path} = ${result.after} (verified)`
        : `Wrote ${path} = ${expectedValue}, but readback returned ${result.after}.`,
    );
  } else {
    output.appendLine(`  FAIL - ${result.error}`);
    void vscode.window.showErrorMessage(`PangoLint set failed: ${result.error ?? "unknown error"}`);
  }
}

interface CachedLiveValue {
  value: number | string | undefined;
  fetchedAt: number;
  error?: string;
}

const LIVE_HOVER_TTL_MS = 30_000;
const liveValueCache = new Map<string, CachedLiveValue>();

/**
 * Append a live-value section to a property-path hover. Reads from a
 * 30-second cache when available; otherwise fetches via readBeyondProperty
 * with a short timeout and populates the cache.
 */
export async function augmentHoverWithLiveValue(base: vscode.Hover, path: string): Promise<vscode.Hover> {
  if (!vscode.workspace.isTrusted) return base;
  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
  const runtimeConfig = getBeyondRuntimeConfig(config);
  const { timeoutMs: configuredTimeoutMs } = runtimeConfig;
  const cacheKey = `${runtimeConfig.talkTransport}:${runtimeConfig.talkTcpHost}:${runtimeConfig.talkTcpPort}:${runtimeConfig.talkUdpHost}:${runtimeConfig.talkUdpPort}|${path}`;
  const now = Date.now();

  const cached = liveValueCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < LIVE_HOVER_TTL_MS) {
    return cloneHoverWithLiveValue(base, cached, now);
  }

  const timeoutMs = Math.min(configuredTimeoutMs, 1500);
  try {
    const result = await readBeyondProperty({
      propertyPath: path,
      ...runtimeConfig,
      timeoutMs,
    });
    const entry: CachedLiveValue = result.ok
      ? { value: result.value, fetchedAt: now }
      : { value: undefined, fetchedAt: now, error: result.error ?? "fetch failed" };
    liveValueCache.set(cacheKey, entry);
    return cloneHoverWithLiveValue(base, entry, now);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const entry: CachedLiveValue = { value: undefined, fetchedAt: now, error: msg };
    liveValueCache.set(cacheKey, entry);
    return cloneHoverWithLiveValue(base, entry, now);
  }
}

function cloneHoverWithLiveValue(base: vscode.Hover, entry: CachedLiveValue, now: number): vscode.Hover {
  const ageS = Math.round((now - entry.fetchedAt) / 1000);
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  for (const part of base.contents) {
    if (part instanceof vscode.MarkdownString) md.appendMarkdown(`${part.value}\n\n`);
    else if (typeof part === "string") md.appendMarkdown(`${part}\n\n`);
  }
  if (entry.error || entry.value === undefined) {
    md.appendMarkdown(`---\n\n**Live value:** _fetch failed_${entry.error ? ` (${entry.error})` : ""}.`);
  } else {
    const staleness = ageS > 0 ? ` (cached ${ageS}s ago)` : "";
    md.appendMarkdown(`---\n\n**Live value:** \`${entry.value}\`${staleness}`);
  }
  return new vscode.Hover(md, base.range);
}
