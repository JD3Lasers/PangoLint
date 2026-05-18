export type ValidationSeverity = "error" | "warning" | "information" | "hint";

export interface ValidationReportDiagnostic {
  severity: ValidationSeverity;
  code: string;
  message: string;
  line: number;
  character: number;
}

export interface ValidationReportInput {
  documentName: string;
  diagnostics: readonly ValidationReportDiagnostic[];
}

export function formatValidationReport(input: ValidationReportInput): string {
  const lines = [
    `PangoLint validation: ${input.documentName}`,
    `${input.diagnostics.length} diagnostic${input.diagnostics.length === 1 ? "" : "s"}`,
    "",
  ];

  if (input.diagnostics.length === 0) {
    lines.push("No PangoLint diagnostics found.");
    return lines.join("\n");
  }

  for (const diagnostic of input.diagnostics) {
    lines.push(
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code} [Ln ${diagnostic.line + 1}, Col ${
        diagnostic.character + 1
      }]`,
      diagnostic.message,
      "",
    );
  }

  return lines.join("\n").trimEnd();
}
