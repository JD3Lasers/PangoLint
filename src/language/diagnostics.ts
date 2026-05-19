import type { CommandCatalog } from "../knowledge/catalog";
import type { CommandKnowledgeEntry } from "../knowledge/knowledgeBase";
import type { ObjectPropertyIndex } from "../knowledge/objectPropertyIndex";
import type { PropertyIndex } from "../knowledge/propertyIndex";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import {
  findDeltaValueCommandArgumentDiagnostics,
  findExtValueDefineMidiTriggerDefaultDiagnostic,
  findIfConditionCompatibilityDiagnostics,
  findSyntaxShapeDiagnostics,
  findUnsupportedDeltaValueAssignmentDiagnostic,
  findUnsupportedPropertyIndexAccessDiagnostic,
} from "./diagnostics/beyondCompatibilityDiagnostics";
import { findUnknownCommandDiagnostic, findWrongArgumentCountDiagnostic } from "./diagnostics/commandDiagnostics";
import { findControlFlowDiagnostics, findMissingTerminalExitDiagnostic } from "./diagnostics/controlFlowDiagnostics";
import { addPangoDiagnosticsWithLimit, addPangoDiagnosticWithLimit } from "./diagnostics/diagnosticLimits";
import { makePangoDiagnostic, type PangoDiagnostic } from "./diagnostics/pangoDiagnostic";
import { findPropertyTypoDiagnostics } from "./diagnostics/propertyPathDiagnostics";
import {
  createVariableReadState,
  findUnusedVariableAndLabelDiagnostics,
  findVariableReadDiagnosticsForLine,
} from "./diagnostics/variableReadDiagnostics";
import { parseScript } from "./parser";

export function lintPangoScript(
  text: string,
  catalog: CommandCatalog,
  knowledgeByName?: Map<string, CommandKnowledgeEntry>,
  propertyIndex?: PropertyIndex,
  objectPropertyIndex?: ObjectPropertyIndex,
): PangoDiagnostic[] {
  const documentLimitReason = documentAnalysisLimitReason(text);
  if (documentLimitReason) {
    return [
      makePangoDiagnostic(
        0,
        0,
        1,
        "warning",
        "analysis-limited",
        `PangoLint skipped full-file diagnostics because ${documentLimitReason}.`,
      ),
    ];
  }

  const parsed = parseScript(text);
  const diagnostics: PangoDiagnostic[] = [];
  const skippedLines = new Set<number>();
  for (const line of parsed.lines) {
    const lineLimitReason = lineAnalysisLimitReason(line.code);
    if (!lineLimitReason) continue;
    skippedLines.add(line.lineNumber);
    addPangoDiagnosticWithLimit(
      diagnostics,
      makePangoDiagnostic(
        line.lineNumber,
        0,
        Math.min(line.raw.length, PANGO_ANALYSIS_LIMITS.maxLineChars),
        "warning",
        "analysis-limited",
        `PangoLint skipped deep diagnostics on this line because ${lineLimitReason}.`,
      ),
    );
  }

  if (propertyIndex) {
    for (const line of parsed.lines) {
      if (!line.code) continue;
      if (skippedLines.has(line.lineNumber)) continue;
      const rawOffset = Math.max(0, line.raw.indexOf(line.code));
      addPangoDiagnosticsWithLimit(
        diagnostics,
        findPropertyTypoDiagnostics(line.code, line.lineNumber, propertyIndex, rawOffset, objectPropertyIndex),
      );
    }
  }

  const variableReadState = createVariableReadState(parsed.lines);
  const hasDefineMidiTrigger = parsed.lines.some((line) => {
    return line.kind === "command" && line.command?.name.toLowerCase() === "definemiditrigger";
  });
  let warnedExtValueDefineMidiTrigger = false;

  for (const line of parsed.lines) {
    if (skippedLines.has(line.lineNumber)) continue;

    addPangoDiagnosticsWithLimit(diagnostics, findSyntaxShapeDiagnostics(line));
    addPangoDiagnosticsWithLimit(diagnostics, findIfConditionCompatibilityDiagnostics(line));
    addPangoDiagnosticWithLimit(diagnostics, findUnsupportedPropertyIndexAccessDiagnostic(line));

    if (hasDefineMidiTrigger && !warnedExtValueDefineMidiTrigger) {
      const extValueTriggerDefault = findExtValueDefineMidiTriggerDefaultDiagnostic(line);
      if (extValueTriggerDefault) {
        addPangoDiagnosticWithLimit(diagnostics, extValueTriggerDefault);
        warnedExtValueDefineMidiTrigger = true;
      }
    }

    addPangoDiagnosticsWithLimit(diagnostics, findControlFlowDiagnostics(line));
    addPangoDiagnosticsWithLimit(diagnostics, findDeltaValueCommandArgumentDiagnostics(line));
    addPangoDiagnosticWithLimit(diagnostics, findUnknownCommandDiagnostic(line, catalog));
    addPangoDiagnosticWithLimit(diagnostics, findWrongArgumentCountDiagnostic(line, knowledgeByName));
    addPangoDiagnosticsWithLimit(diagnostics, findVariableReadDiagnosticsForLine(line, variableReadState));
    addPangoDiagnosticWithLimit(diagnostics, findUnsupportedDeltaValueAssignmentDiagnostic(line));
  }

  const lastExecutableLine = [...parsed.lines]
    .filter((line) => !skippedLines.has(line.lineNumber))
    .reverse()
    .find((line) => line.kind !== "blank" && line.kind !== "comment" && line.code.trim().length > 0);
  addPangoDiagnosticWithLimit(diagnostics, findMissingTerminalExitDiagnostic(lastExecutableLine));
  addPangoDiagnosticsWithLimit(diagnostics, findUnusedVariableAndLabelDiagnostics(variableReadState));

  return diagnostics;
}
