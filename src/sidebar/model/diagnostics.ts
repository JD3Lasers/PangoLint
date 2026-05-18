// Pure summarization of diagnostic input for the Diagnostics view. The
// view layer adapts vscode.Diagnostic[] to DiagnosticInput[] before
// calling here so this module stays vscode-free and testable.

import type { DiagnosticGroup, DiagnosticInput, DiagnosticSeverity } from "./types";

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
};

export function summarizeDiagnostics(input: DiagnosticInput[]): DiagnosticGroup[] {
  const groups = new Map<string, DiagnosticGroup>();
  for (const entry of input) {
    const existing = groups.get(entry.rule);
    if (existing) {
      existing.entries.push(entry);
      existing.count = existing.entries.length;
      if (SEVERITY_RANK[entry.severity] < SEVERITY_RANK[existing.severity]) {
        existing.severity = entry.severity;
      }
    } else {
      groups.set(entry.rule, {
        rule: entry.rule,
        severity: entry.severity,
        count: 1,
        entries: [entry],
      });
    }
  }

  for (const group of groups.values()) {
    group.entries.sort((a, b) => {
      if (a.uri !== b.uri) return a.uri.localeCompare(b.uri);
      if (a.line !== b.line) return a.line - b.line;
      return a.character - b.character;
    });
  }

  return [...groups.values()].sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    return a.rule.localeCompare(b.rule);
  });
}

export function summarizePangoLintDiagnostics(input: DiagnosticInput[]): DiagnosticGroup[] {
  return summarizeDiagnostics(input.filter((entry) => entry.source === "PangoLint"));
}
