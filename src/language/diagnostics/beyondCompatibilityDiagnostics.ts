import { hasUnclosedString, type ParsedLine, parenthesesStatus } from "../parser";
import { makePangoDiagnostic, type PangoDiagnostic } from "./pangoDiagnostic";
import { findFirstWordOutsideStrings, findRegexOutsideStrings, findTextOutsideStrings } from "./pangoscriptTextSearch";

const TEXTUAL_LOGICAL_OPERATORS = ["and", "or"] as const;
const ZONE_POINTS_INDEX_RE = /\bZone\.\d+\.Points\s*\[[^\]\r\n]+\]\.[A-Za-z_][A-Za-z0-9_]*\b/i;
const DELTAVALUE_ASSIGNMENT_CALL_RE = /\bDeltaValue\s*\(/i;
const DELTAVALUE_DIRECT_CALL_RE = /\bDeltaValue\(/i;
const DELTAVALUE_SPACED_CALL_RE = /\bDeltaValue\s+\(/i;
const EXTVALUE_CALL_RE = /\bExtValue\s*\(/i;

export function findSyntaxShapeDiagnostics(line: ParsedLine): PangoDiagnostic[] {
  const diagnostics: PangoDiagnostic[] = [];
  if (line.code && hasUnclosedString(line.code)) {
    diagnostics.push(
      makePangoDiagnostic(line.lineNumber, 0, line.raw.length, "error", "unclosed-string", "Unclosed string literal."),
    );
  }

  const parens = parenthesesStatus(line.code);
  if (line.code && (parens.balance !== 0 || parens.prematureClose)) {
    diagnostics.push(
      makePangoDiagnostic(
        line.lineNumber,
        0,
        line.raw.length,
        "warning",
        "unbalanced-parentheses",
        "Parentheses are not balanced on this line.",
      ),
    );
  }

  return diagnostics;
}

export function findIfConditionCompatibilityDiagnostics(line: ParsedLine): PangoDiagnostic[] {
  if (line.kind !== "if") return [];
  const diagnostics: PangoDiagnostic[] = [];
  const logicalOperator = findUnsupportedLogicalOperatorDiagnostic(line.code, line.raw, line.lineNumber);
  if (logicalOperator) diagnostics.push(logicalOperator);
  const bangNotEqual = findUnsupportedBangNotEqualDiagnostic(line.code, line.raw, line.lineNumber);
  if (bangNotEqual) diagnostics.push(bangNotEqual);
  return diagnostics;
}

export function findUnsupportedPropertyIndexAccessDiagnostic(line: ParsedLine): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(line.code, ZONE_POINTS_INDEX_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, line.raw.indexOf(line.code));
  return makePangoDiagnostic(
    line.lineNumber,
    rawOffset + match.index,
    match.text.length,
    "warning",
    "unsupported-property-index-access",
    `BEYOND reports 'Invalid array index value' and unknown-variable errors for direct reads of '${match.text}'. Use verified dotted property reads, or keep Zone.N.Points[...] only as a quoted string for commands that document property path strings.`,
  );
}

export function findDeltaValueCommandArgumentDiagnostics(line: ParsedLine): PangoDiagnostic[] {
  if (line.kind !== "command" || !line.command) return [];
  const directCall = findUnsupportedDeltaValueCommandArgumentDiagnostic(line.code, line.raw, line.lineNumber);
  if (directCall) return [directCall];

  const midiSlotContext = findDeltaValueMidiSlotContextDiagnostic(line.code, line.raw, line.lineNumber);
  return midiSlotContext ? [midiSlotContext] : [];
}

export function findUnsupportedDeltaValueAssignmentDiagnostic(line: ParsedLine): PangoDiagnostic | undefined {
  if (line.kind !== "assignment" || !line.assignment) return undefined;
  const match = findRegexOutsideStrings(line.assignment.expression, DELTAVALUE_ASSIGNMENT_CALL_RE);
  if (!match) return undefined;

  const expressionOffset = Math.max(0, line.raw.indexOf(line.assignment.expression));
  return makePangoDiagnostic(
    line.lineNumber,
    expressionOffset + match.index,
    "DeltaValue".length,
    "warning",
    "unsupported-deltavalue-assignment",
    "BEYOND rejects `DeltaValue(...)` assignment expressions. No-space calls report 'Unknown function, undeclared or not initialized variable: deltavalue'; spaced `deltavalue (...)` calls report 'Operation expected: ('. Spaced `deltavalue (...)` is only observed in MIDI-to-PangoScript slot property/control arguments.",
  );
}

export function findExtValueDefineMidiTriggerDefaultDiagnostic(line: ParsedLine): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(line.code, EXTVALUE_CALL_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, line.raw.indexOf(line.code));
  return makePangoDiagnostic(
    line.lineNumber,
    rawOffset + match.index,
    "ExtValue".length,
    "hint",
    "extvalue-define-midi-trigger-default",
    "BEYOND accepted this DefineMidiTrigger/InRangeTrigger label-handler shape, but ExtValue returns default values instead of the incoming MIDI CC value. Use direct MIDI-to-PangoScript slot scripts for ExtValue scaling until this trigger context is validated otherwise.",
  );
}

function findUnsupportedDeltaValueCommandArgumentDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(lineCode, DELTAVALUE_DIRECT_CALL_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + match.index,
    "DeltaValue".length,
    "warning",
    "unsupported-deltavalue-command-argument",
    "BEYOND editor paste/run reports 'Unknown function, undeclared or not initialized variable: deltavalue' for no-space `DeltaValue(...)` property/control argument command forms. Spaced `deltavalue (...)` is observed in MIDI-to-PangoScript slot usage.",
  );
}

function findDeltaValueMidiSlotContextDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(lineCode, DELTAVALUE_SPACED_CALL_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + match.index,
    "DeltaValue".length,
    "hint",
    "deltavalue-midi-slot-context",
    "BEYOND editor paste/run reports 'Unknown function' for spaced `deltavalue (...)` property/control commands. Use this form only in a bound MIDI-to-PangoScript slot that has been validated against the controller.",
  );
}

function findUnsupportedLogicalOperatorDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const ifIndex = findFirstWordOutsideStrings(lineCode, ["if"], 0, lineCode.length)?.index ?? -1;
  if (ifIndex < 0) return undefined;

  const conditionStart = ifIndex + "if".length;
  const gotoIndex = findFirstWordOutsideStrings(lineCode, ["goto"], conditionStart, lineCode.length)?.index ?? -1;
  const conditionEnd = gotoIndex >= 0 ? gotoIndex : lineCode.length;
  const match = findFirstWordOutsideStrings(lineCode, TEXTUAL_LOGICAL_OPERATORS, conditionStart, conditionEnd);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  const operator = match.word.toLowerCase();
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + match.index,
    match.word.length,
    "warning",
    "unsupported-logical-operator",
    `BEYOND reports 'Operation expected: ${operator}' for textual '${match.word}' in If conditions. Split compound logic into chained If/Goto branches.`,
  );
}

function findUnsupportedBangNotEqualDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const ifIndex = findFirstWordOutsideStrings(lineCode, ["if"], 0, lineCode.length)?.index ?? -1;
  if (ifIndex < 0) return undefined;

  const conditionStart = ifIndex + "if".length;
  const gotoIndex = findFirstWordOutsideStrings(lineCode, ["goto"], conditionStart, lineCode.length)?.index ?? -1;
  const conditionEnd = gotoIndex >= 0 ? gotoIndex : lineCode.length;
  const match = findTextOutsideStrings(lineCode, "!=", conditionStart, conditionEnd);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + match.index,
    match.text.length,
    "warning",
    "unsupported-bang-not-equal-operator",
    "BEYOND reports 'Operation expected: !' for `!=` in If conditions. Use `<>` for not-equal comparisons.",
  );
}
