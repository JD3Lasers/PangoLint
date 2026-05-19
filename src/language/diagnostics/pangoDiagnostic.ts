export type DiagnosticSeverity = "error" | "warning" | "hint";

export interface PangoDiagnostic {
  line: number;
  start: number;
  length: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
}

export function makePangoDiagnostic(
  line: number,
  start: number,
  length: number,
  severity: DiagnosticSeverity,
  code: string,
  message: string,
): PangoDiagnostic {
  return {
    line,
    start,
    length: Math.max(1, length),
    severity,
    code,
    message,
  };
}
