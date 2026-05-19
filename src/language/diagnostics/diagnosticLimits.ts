import { PANGO_ANALYSIS_LIMITS } from "../analysisLimits";
import type { PangoDiagnostic } from "./pangoDiagnostic";

export function addPangoDiagnosticWithLimit(
  diagnostics: PangoDiagnostic[],
  diagnostic: PangoDiagnostic | undefined,
): void {
  if (!diagnostic) return;
  if (diagnostics.length >= PANGO_ANALYSIS_LIMITS.maxDiagnostics) {
    const incomingPriority = diagnosticPriority(diagnostic);
    let replacementIndex = -1;
    let replacementPriority = incomingPriority;
    for (let index = 0; index < diagnostics.length; index += 1) {
      const priority = diagnosticPriority(diagnostics[index]);
      if (priority < replacementPriority) {
        replacementPriority = priority;
        replacementIndex = index;
      }
    }
    if (replacementIndex < 0) return;
    diagnostics[replacementIndex] = diagnostic;
    return;
  }
  diagnostics.push(diagnostic);
}

export function addPangoDiagnosticsWithLimit(
  diagnostics: PangoDiagnostic[],
  nextDiagnostics: readonly PangoDiagnostic[],
): void {
  for (const diagnostic of nextDiagnostics) {
    addPangoDiagnosticWithLimit(diagnostics, diagnostic);
  }
}

function diagnosticPriority(diagnostic: PangoDiagnostic): number {
  if (diagnostic.severity === "error") return 3;
  if (diagnostic.severity === "warning") return 2;
  return 1;
}
