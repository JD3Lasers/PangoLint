import * as vscode from "vscode";
import type { CommandKnowledgeEntry } from "../knowledge/knowledgeBase";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { parseScript } from "./parser";

export function inlayHintsForRange(
  document: vscode.TextDocument,
  range: vscode.Range,
  knowledgeByName: Map<string, CommandKnowledgeEntry>,
): vscode.InlayHint[] {
  const text = document.getText();
  if (documentAnalysisLimitReason(text)) return [];
  if (range.end.line - range.start.line + 1 > PANGO_ANALYSIS_LIMITS.maxInlayHintLines) return [];
  const out: vscode.InlayHint[] = [];
  const parsed = parseScript(text);
  for (const line of parsed.lines) {
    if (line.lineNumber < range.start.line || line.lineNumber > range.end.line) continue;
    if (line.kind !== "command" || !line.command) continue;
    const entry = knowledgeByName.get(line.command.name.toLowerCase());
    const params = entry?.forms?.[0]?.parameters;
    if (!params || params.length === 0) continue;
    const lineText = document.lineAt(line.lineNumber).text;
    if (lineAnalysisLimitReason(lineText)) continue;
    const argsText = line.command.args;
    if (!argsText) continue;
    const argsStart = lineText.indexOf(argsText);
    if (argsStart < 0) continue;
    let inner = argsText;
    let innerOffset = argsStart;
    if (inner.startsWith("(") && inner.endsWith(")")) {
      inner = inner.slice(1, -1);
      innerOffset += 1;
    }
    const argRanges = splitArgPositions(inner);
    for (let i = 0; i < argRanges.length && i < params.length; i++) {
      const param = params[i];
      if (param.type === "variadic") break;
      const { start } = argRanges[i];
      const absStart = innerOffset + start;
      const hint = new vscode.InlayHint(
        new vscode.Position(line.lineNumber, absStart),
        `${param.name}:`,
        vscode.InlayHintKind.Parameter,
      );
      hint.paddingRight = true;
      out.push(hint);
    }
  }
  return out;
}

function splitArgPositions(argsText: string): Array<{ start: number; end: number }> {
  const trimmed = argsText.trimEnd();
  if (!trimmed) return [];
  const out: Array<{ start: number; end: number }> = [];
  let inString = false;
  let escaped = false;
  let parenDepth = 0;
  let segStart = 0;
  while (segStart < trimmed.length && /\s/.test(trimmed[segStart])) segStart++;
  for (let i = segStart; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    else if (ch === "," && parenDepth === 0) {
      out.push({ start: segStart, end: i });
      segStart = i + 1;
      while (segStart < trimmed.length && /\s/.test(trimmed[segStart])) segStart++;
    }
  }
  if (segStart < trimmed.length) {
    out.push({ start: segStart, end: trimmed.length });
  }
  return out;
}
