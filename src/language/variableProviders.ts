import * as vscode from "vscode";
import type { CommandCatalog } from "../knowledge/catalog";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { findLabelOccurrences, labelNameAtPosition, labelRenameEdits } from "./labelProviders";
import { parseScript } from "./parser";

const VALID_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const NON_VARIABLE_KEYWORDS = new Set([
  "any",
  "asis",
  "false",
  "globalvar",
  "goto",
  "if",
  "off",
  "on",
  "toggle",
  "true",
  "var",
  "for",
  "next",
  "to",
  "step",
  "exit",
  "return",
]);

interface VariableOccurrence {
  range: vscode.Range;
  role: "declaration" | "assignment" | "read";
}

export function prepareRenameDispatch(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.Range | undefined {
  const lineText = document.lineAt(position.line).text;
  const labelName = labelNameAtPosition(lineText, position.character);
  if (labelName) {
    const occurrences = findLabelOccurrences(document, labelName);
    const here = occurrences.find((o) => o.range.contains(position));
    if (here) return here.range;
  }
  const varName = variableNameAtPosition(document, position);
  if (varName) {
    const occurrences = findVariableOccurrences(document, varName);
    const here = occurrences.find((o) => o.range.contains(position));
    return here?.range;
  }
  throw new Error("Rename is only available on label or declared-variable tokens.");
}

export function provideRenameEditsDispatch(
  document: vscode.TextDocument,
  position: vscode.Position,
  newName: string,
  catalog: CommandCatalog,
): vscode.WorkspaceEdit | undefined {
  if (!VALID_IDENTIFIER_RE.test(newName)) {
    throw new Error(`'${newName}' is not a valid PangoScript identifier.`);
  }
  const lineText = document.lineAt(position.line).text;
  if (labelNameAtPosition(lineText, position.character)) {
    const labelEdit = labelRenameEdits(document, position, newName);
    if (labelEdit) return labelEdit;
  }
  if (variableNameAtPosition(document, position)) {
    return variableRenameEdits(document, position, newName, catalog);
  }
  return undefined;
}

function variableRenameEdits(
  document: vscode.TextDocument,
  position: vscode.Position,
  newName: string,
  catalog: CommandCatalog,
): vscode.WorkspaceEdit | undefined {
  if (NON_VARIABLE_KEYWORDS.has(newName.toLowerCase())) {
    throw new Error(`'${newName}' is a reserved keyword and cannot be used as a variable name.`);
  }
  const lower = newName.toLowerCase();
  if (catalog.commands.some((c) => c.canonical.toLowerCase() === lower)) {
    throw new Error(`'${newName}' is a known BEYOND command and would shadow the command call.`);
  }
  const targetName = variableNameAtPosition(document, position);
  if (!targetName) return undefined;
  const occurrences = findVariableOccurrences(document, targetName);
  if (occurrences.length === 0) return undefined;
  const edit = new vscode.WorkspaceEdit();
  for (const occ of occurrences) {
    edit.replace(document.uri, occ.range, newName);
  }
  return edit;
}

export function variableReferences(
  document: vscode.TextDocument,
  position: vscode.Position,
  includeDeclaration: boolean,
): vscode.Location[] | undefined {
  const targetName = variableNameAtPosition(document, position);
  if (!targetName) return undefined;
  const occurrences = findVariableOccurrences(document, targetName);
  if (occurrences.length === 0) return undefined;
  const filtered = includeDeclaration ? occurrences : occurrences.filter((o) => o.role !== "declaration");
  return filtered.map((occ) => new vscode.Location(document.uri, occ.range));
}

function findVariableOccurrences(document: vscode.TextDocument, name: string): VariableOccurrence[] {
  const text = document.getText();
  if (documentAnalysisLimitReason(text)) return [];
  const want = name.toLowerCase();
  const out: VariableOccurrence[] = [];
  const parsed = parseScript(text);
  const identRe = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

  for (const line of parsed.lines) {
    if (out.length >= PANGO_ANALYSIS_LIMITS.maxLabelOccurrences) break;
    const text = document.lineAt(line.lineNumber).text;
    if (lineAnalysisLimitReason(text)) continue;

    if (line.kind === "declaration" && line.declaration) {
      for (const declName of line.declaration.names) {
        if (declName.toLowerCase() !== want) continue;
        const idx = text.toLowerCase().indexOf(declName.toLowerCase());
        if (idx < 0) continue;
        out.push({
          range: new vscode.Range(line.lineNumber, idx, line.lineNumber, idx + declName.length),
          role: "declaration",
        });
      }
      continue;
    }

    for (const m of text.matchAll(identRe)) {
      const ident = m[1];
      if (ident.toLowerCase() !== want) continue;
      const start = m.index ?? 0;
      const end = start + ident.length;

      if (text[start - 1] === ".") continue;
      if (NON_VARIABLE_KEYWORDS.has(ident.toLowerCase())) continue;
      if (line.kind === "command" && line.command && line.command.name === ident) {
        const cmdStart = text.indexOf(line.command.name);
        if (cmdStart === start) continue;
      }
      if (line.label && line.label.toLowerCase() === want) {
        const labelStart = text.indexOf(line.label);
        if (labelStart === start && text[end] === ":") continue;
      }
      const trailing = text.slice(end);
      if (/^\s*:/.test(trailing) && text.slice(0, start).trim() === "") continue;

      if (
        line.kind === "assignment" &&
        line.assignment &&
        line.assignment.target.toLowerCase() === want &&
        text.indexOf(line.assignment.target) === start
      ) {
        out.push({
          range: new vscode.Range(line.lineNumber, start, line.lineNumber, end),
          role: "assignment",
        });
      } else {
        out.push({
          range: new vscode.Range(line.lineNumber, start, line.lineNumber, end),
          role: "read",
        });
      }
    }
  }
  return out;
}

function variableNameAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const text = document.getText();
  if (documentAnalysisLimitReason(text)) return undefined;
  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  if (!wordRange) return undefined;
  const word = document.getText(wordRange);
  if (NON_VARIABLE_KEYWORDS.has(word.toLowerCase())) return undefined;
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  if (lineText[wordRange.start.character - 1] === ".") return undefined;
  const parsed = parseScript(text);
  const want = word.toLowerCase();
  for (const line of parsed.lines) {
    if (line.kind === "declaration" && line.declaration) {
      if (line.declaration.names.some((n) => n.toLowerCase() === want)) return word;
    }
  }
  return undefined;
}
