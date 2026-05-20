import * as vscode from "vscode";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { parseScript } from "./parser";

/**
 * Document symbol provider: exposes script labels in the outline panel and
 * breadcrumb bar for navigation through long scripts.
 */
export function documentSymbolsForScript(document: vscode.TextDocument): vscode.DocumentSymbol[] {
  const text = document.getText();
  if (documentAnalysisLimitReason(text)) return [];
  const parsed = parseScript(text);
  const symbols: vscode.DocumentSymbol[] = [];
  for (const line of parsed.lines) {
    if (symbols.length >= PANGO_ANALYSIS_LIMITS.maxCodeLensLabels) break;
    if (!line.label) continue;
    const lineText = document.lineAt(line.lineNumber).text;
    if (lineAnalysisLimitReason(lineText)) continue;
    const labelStart = lineText.indexOf(line.label);
    if (labelStart < 0) continue;
    const labelEnd = labelStart + line.label.length;
    const fullRange = new vscode.Range(line.lineNumber, 0, line.lineNumber, lineText.length);
    const selectionRange = new vscode.Range(line.lineNumber, labelStart, line.lineNumber, labelEnd);
    symbols.push(new vscode.DocumentSymbol(line.label, "", vscode.SymbolKind.Method, fullRange, selectionRange));
  }
  return symbols;
}

/**
 * Definition provider for `Goto <label>` and `If <cond> Goto <label>`
 * statements.
 */
export function definitionForGotoTarget(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.Location | undefined {
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const re = /\bgoto\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
  for (const match of lineText.matchAll(re)) {
    const targetName = match[1] ?? match[2];
    if (!targetName) continue;
    const matchStart = match.index ?? 0;
    const nameStart = matchStart + match[0].lastIndexOf(targetName);
    const nameEnd = nameStart + targetName.length;
    if (position.character < nameStart || position.character > nameEnd) continue;

    const index = buildLabelIndex(document);
    if (!index) return undefined;
    if (!match[1] && index.declaredVariables.has(targetName.toLowerCase())) return undefined;
    const occurrence = index.byName.get(targetName.toLowerCase())?.find((item) => item.role === "declaration");
    if (occurrence) return new vscode.Location(document.uri, occurrence.range);
    return undefined;
  }
  return undefined;
}

export interface LabelOccurrence {
  range: vscode.Range;
  role: "declaration" | "reference";
}

export function findLabelOccurrences(document: vscode.TextDocument, name: string): LabelOccurrence[] {
  return buildLabelIndex(document)?.byName.get(name.toLowerCase()) ?? [];
}

export function gotoLabelCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.CompletionItem[] | undefined {
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const context = gotoTargetCompletionContext(lineText, position.character);
  if (!context) return undefined;

  const index = buildLabelIndex(document);
  if (!index || index.declarations.length === 0) return undefined;
  const typedKey = context.typedTarget.toLowerCase();
  if (typedKey && index.declaredVariables.has(typedKey)) {
    return undefined;
  }

  const seen = new Set<string>();
  const range =
    context.typedTarget.length > 0
      ? new vscode.Range(
          position.line,
          position.character - context.typedTarget.length,
          position.line,
          position.character,
        )
      : undefined;
  const items: vscode.CompletionItem[] = [];
  for (const declaration of index.declarations) {
    const key = declaration.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const item = new vscode.CompletionItem(declaration.name, vscode.CompletionItemKind.Reference);
    item.detail = `Label declared on line ${declaration.occurrence.range.start.line + 1}`;
    item.insertText = declaration.name;
    item.sortText = `0_${key}`;
    if (range) item.range = range;
    items.push(item);
  }
  return items;
}

interface LabelIndex {
  byName: Map<string, LabelOccurrence[]>;
  declarations: Array<{ name: string; occurrence: LabelOccurrence }>;
  declaredVariables: Set<string>;
}

function buildLabelIndex(document: vscode.TextDocument): LabelIndex | undefined {
  const text = document.getText();
  if (documentAnalysisLimitReason(text)) return undefined;
  const parsed = parseScript(text);
  const declaredVariables = new Set<string>();
  for (const line of parsed.lines) {
    if (line.kind !== "declaration" || !line.declaration) continue;
    for (const name of line.declaration.names) {
      declaredVariables.add(name.toLowerCase());
    }
  }

  const byName = new Map<string, LabelOccurrence[]>();
  const declarations: Array<{ name: string; occurrence: LabelOccurrence }> = [];
  let occurrenceCount = 0;
  const addOccurrence = (name: string, occurrence: LabelOccurrence): void => {
    if (occurrenceCount >= PANGO_ANALYSIS_LIMITS.maxLabelOccurrences) return;
    occurrenceCount += 1;
    const key = name.toLowerCase();
    const entries = byName.get(key);
    if (entries) {
      entries.push(occurrence);
    } else {
      byName.set(key, [occurrence]);
    }
    if (occurrence.role === "declaration") {
      declarations.push({ name, occurrence });
    }
  };

  for (const line of parsed.lines) {
    const text = document.lineAt(line.lineNumber).text;
    if (lineAnalysisLimitReason(text)) continue;
    if (line.label) {
      const start = text.indexOf(line.label);
      if (start >= 0) {
        addOccurrence(line.label, {
          range: new vscode.Range(line.lineNumber, start, line.lineNumber, start + line.label.length),
          role: "declaration",
        });
      }
    }
    if (line.kind === "goto" || line.kind === "if") {
      const re = /\bgoto\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
      for (const match of text.matchAll(re)) {
        const matched = match[1] ?? match[2];
        if (!matched) continue;
        if (!match[1] && declaredVariables.has(matched.toLowerCase())) continue;
        const matchStart = match.index ?? 0;
        const nameStart = matchStart + match[0].lastIndexOf(matched);
        addOccurrence(matched, {
          range: new vscode.Range(line.lineNumber, nameStart, line.lineNumber, nameStart + matched.length),
          role: "reference",
        });
      }
    }
  }
  return { byName, declarations, declaredVariables };
}

export function labelHighlights(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.DocumentHighlight[] | undefined {
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const targetName = labelNameAtPosition(lineText, position.character);
  if (!targetName) return undefined;
  const occurrences = findLabelOccurrences(document, targetName);
  if (occurrences.length === 0) return undefined;
  return occurrences.map(
    (occurrence) =>
      new vscode.DocumentHighlight(
        occurrence.range,
        occurrence.role === "declaration" ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read,
      ),
  );
}

export function labelReferences(
  document: vscode.TextDocument,
  position: vscode.Position,
  includeDeclaration: boolean,
): vscode.Location[] | undefined {
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const targetName = labelNameAtPosition(lineText, position.character);
  if (!targetName) return undefined;
  const occurrences = findLabelOccurrences(document, targetName);
  if (occurrences.length === 0) return undefined;
  const filtered = includeDeclaration
    ? occurrences
    : occurrences.filter((occurrence) => occurrence.role !== "declaration");
  return filtered.map((occurrence) => new vscode.Location(document.uri, occurrence.range));
}

export function labelReferenceCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
  const out: vscode.CodeLens[] = [];
  const index = buildLabelIndex(document);
  if (!index) return out;
  for (const declaration of index.declarations) {
    if (out.length >= PANGO_ANALYSIS_LIMITS.maxCodeLensLabels) break;
    const occurrences = index.byName.get(declaration.name.toLowerCase()) ?? [];
    const refs = occurrences.filter((occurrence) => occurrence.role === "reference");
    const range = declaration.occurrence.range;
    const lens = new vscode.CodeLens(range, {
      title: `${refs.length} reference${refs.length === 1 ? "" : "s"}`,
      command: "editor.action.showReferences",
      arguments: [
        document.uri,
        range.start,
        refs.map((occurrence) => new vscode.Location(document.uri, occurrence.range)),
      ],
    });
    out.push(lens);
  }
  return out;
}

export function labelRenameEdits(
  document: vscode.TextDocument,
  position: vscode.Position,
  newName: string,
): vscode.WorkspaceEdit | undefined {
  const lineText = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const targetName = labelNameAtPosition(lineText, position.character);
  if (!targetName) return undefined;
  const occurrences = findLabelOccurrences(document, targetName);
  if (occurrences.length === 0) return undefined;
  const edit = new vscode.WorkspaceEdit();
  for (const occurrence of occurrences) {
    edit.replace(document.uri, occurrence.range, newName);
  }
  return edit;
}

export function labelNameAtPosition(lineText: string, column: number): string | undefined {
  if (lineAnalysisLimitReason(lineText)) return undefined;
  const declRe = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/;
  const decl = declRe.exec(lineText);
  if (decl) {
    const start = decl[1].length;
    const end = start + decl[2].length;
    if (column >= start && column <= end) return decl[2];
  }

  const gotoRe = /\bgoto\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
  for (const match of lineText.matchAll(gotoRe)) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    const matchStart = match.index ?? 0;
    const nameStart = matchStart + match[0].lastIndexOf(name);
    const nameEnd = nameStart + name.length;
    if (column >= nameStart && column <= nameEnd) return name;
  }
  return undefined;
}

function gotoTargetCompletionContext(lineText: string, column: number): { typedTarget: string } | undefined {
  const linePrefix = lineText.slice(0, column);
  const match = /\bgoto\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(linePrefix);
  if (!match) return undefined;
  return { typedTarget: match[1] ?? "" };
}
