import * as vscode from "vscode";

/**
 * Build a SelectionRange chain for smart expand/shrink.
 * Levels, innermost to outermost:
 *
 * 1. Identifier under cursor
 * 2. Each containing parenthesized group
 * 3. Whole line
 * 4. Whole document
 */
export function buildSelectionRange(document: vscode.TextDocument, position: vscode.Position): vscode.SelectionRange {
  const lineText = document.lineAt(position.line).text;

  let current: vscode.SelectionRange | undefined;
  current = new vscode.SelectionRange(fullDocumentRange(document));
  current = new vscode.SelectionRange(new vscode.Range(position.line, 0, position.line, lineText.length), current);

  for (const group of containingParenGroups(lineText, position.line, position.character)) {
    current = new vscode.SelectionRange(group, current);
  }

  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  if (wordRange) {
    current = new vscode.SelectionRange(wordRange, current);
  }

  return current;
}

export function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  if (document.lineCount === 0) {
    return new vscode.Range(0, 0, 0, 0);
  }
  const lastLine = document.lineAt(document.lineCount - 1);
  return new vscode.Range(0, 0, document.lineCount - 1, lastLine.range.end.character);
}

function containingParenGroups(lineText: string, lineNumber: number, column: number): vscode.Range[] {
  const opens: number[] = [];
  const groups: vscode.Range[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < lineText.length; i++) {
    const ch = lineText[i];
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
    if (ch === "(") opens.push(i);
    else if (ch === ")") {
      const start = opens.pop();
      if (start === undefined) continue;
      if (column >= start && column <= i + 1) {
        groups.push(new vscode.Range(lineNumber, start, lineNumber, i + 1));
      }
    }
  }
  return groups.sort((a, b) => a.start.character - b.start.character || b.end.character - a.end.character);
}
