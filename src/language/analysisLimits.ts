export const PANGO_ANALYSIS_LIMITS = {
  maxDocumentChars: 250_000,
  maxDocumentLines: 8_000,
  maxLineChars: 4_000,
  maxDiagnostics: 500,
  maxPropertyPathsPerLine: 32,
  maxPropertyTypoCandidates: 512,
  maxQuickFixDiagnostics: 50,
  maxQuickFixCommandLength: 80,
  maxLabelOccurrences: 5_000,
  maxCodeLensLabels: 500,
  maxSemanticTokens: 20_000,
  maxInlayHintLines: 1_000,
  maxWorkspaceSymbolFiles: 500,
  maxWorkspaceSymbolFileBytes: 250_000,
  maxWorkspaceSymbols: 5_000,
  maxWorkspaceScanFiles: 500,
  maxWorkspaceScanEntries: 20_000,
  maxWorkspaceScanDepth: 20,
  maxWorkspaceScanFileBytes: 250_000,
  maxMcpTextChars: 250_000,
  maxMcpQueryChars: 200,
  maxMcpNameChars: 200,
} as const;

export function documentAnalysisLimitReason(text: string): string | undefined {
  if (text.length > PANGO_ANALYSIS_LIMITS.maxDocumentChars) {
    return `document has ${text.length} characters; limit is ${PANGO_ANALYSIS_LIMITS.maxDocumentChars}`;
  }
  const lineCount = countLinesUpTo(text, PANGO_ANALYSIS_LIMITS.maxDocumentLines + 1);
  if (lineCount > PANGO_ANALYSIS_LIMITS.maxDocumentLines) {
    return `document has more than ${PANGO_ANALYSIS_LIMITS.maxDocumentLines} lines`;
  }
  return undefined;
}

export function lineAnalysisLimitReason(line: string): string | undefined {
  if (line.length > PANGO_ANALYSIS_LIMITS.maxLineChars) {
    return `line has ${line.length} characters; limit is ${PANGO_ANALYSIS_LIMITS.maxLineChars}`;
  }
  return undefined;
}

export function mcpTextLimitReason(text: string): string | undefined {
  if (text.length > PANGO_ANALYSIS_LIMITS.maxMcpTextChars) {
    return `text has ${text.length} characters; limit is ${PANGO_ANALYSIS_LIMITS.maxMcpTextChars}`;
  }
  return undefined;
}

export function mcpQueryLimitReason(query: string): string | undefined {
  if (query.length > PANGO_ANALYSIS_LIMITS.maxMcpQueryChars) {
    return `query has ${query.length} characters; limit is ${PANGO_ANALYSIS_LIMITS.maxMcpQueryChars}`;
  }
  return undefined;
}

export function mcpNameLimitReason(name: string): string | undefined {
  if (name.length > PANGO_ANALYSIS_LIMITS.maxMcpNameChars) {
    return `value has ${name.length} characters; limit is ${PANGO_ANALYSIS_LIMITS.maxMcpNameChars}`;
  }
  return undefined;
}

function countLinesUpTo(text: string, cap: number): number {
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      lines += 1;
      if (lines >= cap) return lines;
    }
  }
  return lines;
}
