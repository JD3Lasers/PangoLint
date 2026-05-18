import type * as vscode from "vscode";

/**
 * Find the property-path-shaped expression containing the cursor.
 * Requires at least one dot, for example `Master.Brightness`,
 * `Zone.0.Red`, or `COLORPICKER.AQUABUTTON1.Value`.
 */
export function propertyPathAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const lineText = document.lineAt(position.line).text;
  const re =
    /(?:^|[^A-Za-z0-9_#])((?:FB[34][-_][A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)(?:\.(?:[A-Za-z0-9_]+|\d+))+\b)/g;
  for (const match of lineText.matchAll(re)) {
    const text = match[1];
    const start = (match.index ?? 0) + match[0].indexOf(text);
    const end = start + text.length;
    if (start <= position.character && position.character <= end) return text;
  }
  return undefined;
}
