import * as vscode from "vscode";
import {
  documentAnalysisLimitReason,
  lineAnalysisLimitReason,
  PANGO_ANALYSIS_LIMITS,
} from "../language/analysisLimits";
import { parseScript } from "../language/parser";

const workspaceSymbolCache = new Map<string, { mtimeMs: number; symbols: vscode.SymbolInformation[] }>();

/**
 * Workspace symbol search (Ctrl+T): finds .BeyondCode files, reads label
 * declarations, and returns symbols matching the case-insensitive query.
 */
export async function provideWorkspaceLabelSymbols(
  query: string,
  token: vscode.CancellationToken,
): Promise<vscode.SymbolInformation[]> {
  const wantLower = query.toLowerCase();
  const uris = await vscode.workspace.findFiles(
    "**/*.BeyondCode",
    "{**/node_modules/**,**/.git/**,**/.vscode-test/**,**/.trash/**}",
    PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbolFiles,
    token,
  );
  const out: vscode.SymbolInformation[] = [];
  for (const uri of uris) {
    if (token.isCancellationRequested) break;
    if (out.length >= PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbols) break;
    const symbols = await symbolsForUri(uri);
    for (const symbol of symbols) {
      if (out.length >= PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbols) break;
      if (!wantLower || symbol.name.toLowerCase().includes(wantLower)) {
        out.push(symbol);
      }
    }
  }
  return out;
}

export function clearWorkspaceSymbolCacheForUri(uri: vscode.Uri): void {
  workspaceSymbolCache.delete(cacheKey(uri));
}

async function symbolsForUri(uri: vscode.Uri): Promise<vscode.SymbolInformation[]> {
  let mtimeMs = 0;
  try {
    const stats = await vscode.workspace.fs.stat(uri);
    mtimeMs = stats.mtime;
    if (stats.size > PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbolFileBytes) return [];
  } catch {
    return [];
  }
  const key = cacheKey(uri);
  const cached = workspaceSymbolCache.get(key);
  if (cached && cached.mtimeMs === mtimeMs) return cached.symbols;

  let text: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    text = Buffer.from(bytes).toString("utf8");
    if (documentAnalysisLimitReason(text)) return [];
  } catch {
    return [];
  }

  const parsed = parseScript(text);
  const symbols: vscode.SymbolInformation[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of parsed.lines) {
    if (!line.label) continue;
    const lineText = lines[line.lineNumber] ?? "";
    if (lineAnalysisLimitReason(lineText)) continue;
    const start = lineText.indexOf(line.label);
    if (start < 0) continue;
    symbols.push(
      new vscode.SymbolInformation(
        line.label,
        vscode.SymbolKind.Method,
        "",
        new vscode.Location(uri, new vscode.Range(line.lineNumber, start, line.lineNumber, start + line.label.length)),
      ),
    );
  }
  workspaceSymbolCache.set(key, { mtimeMs, symbols });
  return symbols;
}

function cacheKey(uri: vscode.Uri): string {
  return uri.toString();
}
