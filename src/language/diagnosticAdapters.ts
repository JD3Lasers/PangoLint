import * as vscode from "vscode";
import type { PangoDiagnostic } from "./diagnostics/pangoDiagnostic";

const DIAGNOSTIC_DOCS_BASE = "https://github.com/JD3Lasers/PangoLint/blob/main/docs/references/diagnostics/README.md";

export function toVsCodeDiagnostics(diagnostics: PangoDiagnostic[]): vscode.Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    const range = new vscode.Range(
      diagnostic.line,
      diagnostic.start,
      diagnostic.line,
      diagnostic.start + diagnostic.length,
    );
    const item = new vscode.Diagnostic(range, diagnostic.message, severityToVsCode(diagnostic.severity));
    item.code = {
      value: diagnostic.code,
      target: vscode.Uri.parse(`${DIAGNOSTIC_DOCS_BASE}#${diagnostic.code}`),
    };
    item.source = "PangoLint";
    return item;
  });
}

function severityToVsCode(severity: PangoDiagnostic["severity"]): vscode.DiagnosticSeverity {
  if (severity === "error") {
    return vscode.DiagnosticSeverity.Error;
  }
  if (severity === "hint") {
    return vscode.DiagnosticSeverity.Hint;
  }
  return vscode.DiagnosticSeverity.Warning;
}
