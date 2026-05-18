import type { CommandCatalog } from "../knowledge/catalog";
import { lookupCommand } from "../knowledge/catalog";
import type { CommandKnowledgeEntry, KnowledgeForm } from "../knowledge/knowledgeBase";
import type { ObjectPropertyIndex } from "../knowledge/objectPropertyIndex";
import {
  canonicalizeObjectPropertyHardwareRootPath,
  concretizeObjectPropertyShape,
  objectPropertyShapeForPath,
} from "../knowledge/objectPropertyIndex";
import { type PropertyIndex, perIndexSchemaName } from "../knowledge/propertyIndex";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { countArgs, extractBareIdentifiers, hasUnclosedString, parenthesesStatus, parseScript } from "./parser";
import { expressionForVariableReads, isExternallyInvokedLabelName } from "./usageDiagnostics";

export type DiagnosticSeverity = "error" | "warning" | "hint";

export interface PangoDiagnostic {
  line: number;
  start: number;
  length: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
}

/**
 * Levenshtein distance between two strings (case-insensitive). Pure DP, no
 * allocations beyond the row buffer. Used by the property "did you mean"
 * diagnostic to find close-match suggestions.
 */
export function levenshteinDistance(a: string, b: string): number {
  const lower = (s: string): string => s.toLowerCase();
  const x = lower(a);
  const y = lower(b);
  if (x === y) return 0;
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = new Array(y.length + 1);
  let curr = new Array(y.length + 1);
  for (let j = 0; j <= y.length; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[y.length];
}

/**
 * Scan a line for property-path expressions like `Master.RotoAngleX`,
 * `Zone.0.UGC.ShearY`, `ColorChannel.0.Color`. For each path where the root
 * is a known object but the property isn't in the schema, find the best
 * Levenshtein match within the schema and (if close enough) emit a
 * hint-level diagnostic suggesting the correction.
 *
 * Posture (per repository parser and diagnostic rules):
 * - Unknown root objects → silent (preserves user-defined-universe support)
 * - Known root + unknown prop with NO close match → silent
 * - Known root + unknown prop WITH close match (distance ≤ 2 absolute, or ≤
 *   30% of property length, whichever is larger) → hint
 *
 * Only the first close match per path is suggested to avoid noise.
 */
const PROPERTY_PATH_LINE_RE =
  /(?:^|[^A-Za-z0-9_#])((?:FB[34][-_][A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)((?:\.(?:[A-Za-z0-9_]+|\d+))+)\b)/g;

export function findPropertyTypoDiagnostics(
  lineText: string,
  lineNumber: number,
  propertyIndex: PropertyIndex,
  sourceOffset = 0,
  objectPropertyIndex?: ObjectPropertyIndex,
): PangoDiagnostic[] {
  if (lineAnalysisLimitReason(lineText)) return [];
  const out: PangoDiagnostic[] = [];
  const seen = new Set<string>(); // dedupe per line
  let pathCount = 0;
  for (const match of lineText.matchAll(PROPERTY_PATH_LINE_RE)) {
    const fullPath = match[1];
    if (seen.has(fullPath)) continue;
    seen.add(fullPath);
    pathCount += 1;
    if (pathCount > PANGO_ANALYSIS_LIMITS.maxPropertyPathsPerLine) break;
    const matchStart = (match.index ?? 0) + match[0].indexOf(fullPath);
    if (objectPropertyIndex?.lookup(fullPath)) continue;
    const objectTreeDiagnostic = findObjectTreePathTypoDiagnostic(
      fullPath,
      matchStart,
      lineNumber,
      sourceOffset,
      objectPropertyIndex,
    );
    const root = fullPath.split(".", 1)[0];
    const schema = propertyIndex.getObject(root);
    if (!schema) {
      if (objectTreeDiagnostic) out.push(objectTreeDiagnostic);
      continue; // unknown root — permissive unless Object Tree has a close match
    }

    const parts = fullPath.split(".");
    // For ARRAY schemas the form is Object.<index>.<prop...>; skip the index.
    const propParts = schema.isArray ? parts.slice(2) : parts.slice(1);
    if (propParts.length === 0) continue;
    const propPath = propParts.join(".");

    // Per-button schema dispatch: when this is an isArray universe panel
    // and the button has been classified, verify against that control's
    // canonical schema instead of the panel's. Falls back to the panel
    // schema for unclassified buttons.
    let verifyAgainst = schema;
    if (schema.isArray && parts.length >= 2) {
      const targetName = perIndexSchemaName(schema, parts[1]);
      if (targetName) {
        const target = propertyIndex.getObject(targetName);
        if (target) verifyAgainst = target;
      }
    }
    if (verifyAgainst.properties.includes(propPath)) continue; // verified path
    if (objectTreeDiagnostic) {
      out.push(objectTreeDiagnostic);
      continue;
    }

    // Find best Levenshtein match within the schema.
    let bestProp: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    let candidateCount = 0;
    for (const known of verifyAgainst.properties) {
      candidateCount += 1;
      if (candidateCount > PANGO_ANALYSIS_LIMITS.maxPropertyTypoCandidates) break;
      const d = levenshteinDistance(propPath, known);
      if (d < bestDist) {
        bestDist = d;
        bestProp = known;
      }
    }
    if (bestProp === null) continue;

    // Threshold: ≤ 2 absolute, or ≤ ceil(30% of length), whichever is larger.
    const threshold = Math.max(2, Math.ceil(propPath.length * 0.3));
    if (bestDist > threshold) continue;
    if (bestDist === 0) continue; // exact match — already handled by includes() above
    // BEYOND is case-insensitive on property names, so a case-only mismatch
    // isn't a typo worth flagging.
    if (propPath.toLowerCase() === bestProp.toLowerCase()) continue;

    out.push({
      line: lineNumber,
      start: sourceOffset + matchStart,
      length: fullPath.length,
      severity: "hint",
      code: "property-typo",
      message: `Did you mean ${schema.object}${schema.isArray ? `.${parts[1]}` : ""}.${bestProp}? (no '${propPath}' in ${schema.object} schema)`,
    });
  }
  return out;
}

function findObjectTreePathTypoDiagnostic(
  fullPath: string,
  matchStart: number,
  lineNumber: number,
  sourceOffset: number,
  objectPropertyIndex: ObjectPropertyIndex | undefined,
): PangoDiagnostic | undefined {
  if (!objectPropertyIndex) return undefined;
  const root = fullPath.split(".", 1)[0]?.toLowerCase();
  if (!root) return undefined;

  let bestSuggestion: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const entry of objectPropertyIndex.entriesForRoot(root)) {
    const candidate = objectTreeTypoCandidate(fullPath, entry.normalizedPath);
    if (!candidate) continue;
    if (
      candidate.distance < bestDist ||
      (candidate.distance === bestDist && (!bestSuggestion || candidate.suggestion.localeCompare(bestSuggestion) < 0))
    ) {
      bestDist = candidate.distance;
      bestSuggestion = candidate.suggestion;
    }
  }
  if (!bestSuggestion) return undefined;

  return {
    line: lineNumber,
    start: sourceOffset + matchStart,
    length: fullPath.length,
    severity: "hint",
    code: "property-typo",
    message: `Did you mean ${bestSuggestion}? (no '${fullPath}' in Object Tree index)`,
  };
}

function objectTreeTypoCandidate(
  fullPath: string,
  normalizedPath: string,
): { suggestion: string; distance: number } | undefined {
  const comparisonPath = canonicalizeObjectPropertyHardwareRootPath(fullPath);
  const shapedPath = objectPropertyShapeForPath(comparisonPath, normalizedPath);
  const canonicalSuggestion = concretizeObjectPropertyShape(normalizedPath, comparisonPath);
  if (!shapedPath || !canonicalSuggestion) return undefined;
  const suggestion = restoreOriginalHardwareRoot(canonicalSuggestion, fullPath, comparisonPath);

  const shapedSegments = shapedPath.split(".");
  const targetSegments = normalizedPath.split(".");
  if (shapedSegments.length !== targetSegments.length) return undefined;

  let mismatch: { typed: string; target: string } | undefined;
  for (let index = 0; index < shapedSegments.length; index += 1) {
    const typed = shapedSegments[index];
    const target = targetSegments[index];
    if (typed.toLowerCase() === target.toLowerCase()) continue;
    if (mismatch) return undefined;
    mismatch = { typed, target };
  }
  if (!mismatch) return undefined;
  if (/^(?:#?\d+|#?N)$/i.test(mismatch.typed) || /^(?:#?\d+|#?N)$/i.test(mismatch.target)) return undefined;

  const distance = levenshteinDistance(mismatch.typed, mismatch.target);
  const threshold = Math.max(2, Math.ceil(Math.max(mismatch.typed.length, mismatch.target.length) * 0.3));
  if (distance === 0 || distance > threshold) return undefined;
  if (fullPath.toLowerCase() === suggestion.toLowerCase()) return undefined;
  return { suggestion, distance };
}

function restoreOriginalHardwareRoot(suggestion: string, fullPath: string, comparisonPath: string): string {
  const originalRoot = fullPath.split(".", 1)[0];
  const comparisonRoot = comparisonPath.split(".", 1)[0];
  if (!originalRoot || !comparisonRoot || originalRoot === comparisonRoot) return suggestion;
  if (!suggestion.toLowerCase().startsWith(`${comparisonRoot.toLowerCase()}.`)) return suggestion;
  return `${originalRoot}${suggestion.slice(comparisonRoot.length)}`;
}

const BUILTIN_WORDS = new Set([
  "any",
  "asis",
  "false",
  "globalvar",
  "goto",
  "if",
  "off",
  "on",
  "toggle",
  "true",
  "var",
]);

const EXPRESSION_FUNCTION_WORDS = new Set(["deltavalue", "extdelta", "extvalue", "int", "intstr", "max", "round"]);

// Recognized control-flow keywords that aren't always in the command catalog
// but are valid PangoScript. Skip the unknown-command warning for these.
const CONTROL_FLOW_KEYWORDS = new Set(["exit", "for", "next"]);

// Loop keywords from other languages that PangoScript does NOT support.
// Documented conditional loops are expressed with a label +
// If <cond> Goto <label>. Hint when other-language keywords are seen.
const UNSUPPORTED_LOOP_KEYWORDS = new Set(["while", "do", "repeat", "until", "loop"]);
const DELPHI_STYLE_FOR_RANGE_RE = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S[\s\S]*\bto\b\s*\S[\s\S]*$/i;
const TERMINAL_EXIT_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?exit\s*;?$/i;
const EXIT_SEMICOLON_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?exit\s*;\s*$/i;
const TEXTUAL_LOGICAL_OPERATORS = ["and", "or"] as const;
const ZONE_POINTS_INDEX_RE = /\bZone\.\d+\.Points\s*\[[^\]\r\n]+\]\.[A-Za-z_][A-Za-z0-9_]*\b/i;
const DELTAVALUE_ASSIGNMENT_CALL_RE = /\bDeltaValue\s*\(/i;
const DELTAVALUE_DIRECT_CALL_RE = /\bDeltaValue\(/i;
const DELTAVALUE_SPACED_CALL_RE = /\bDeltaValue\s+\(/i;
const EXTVALUE_CALL_RE = /\bExtValue\s*\(/i;

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
      makeDiagnostic(
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
  const addDiagnostic = (diagnostic: PangoDiagnostic | undefined): void => {
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
  };
  const addDiagnostics = (next: PangoDiagnostic[]): void => {
    for (const diagnostic of next) addDiagnostic(diagnostic);
  };
  const skippedLines = new Set<number>();
  for (const line of parsed.lines) {
    const lineLimitReason = lineAnalysisLimitReason(line.code);
    if (!lineLimitReason) continue;
    skippedLines.add(line.lineNumber);
    addDiagnostic(
      makeDiagnostic(
        line.lineNumber,
        0,
        Math.min(line.raw.length, PANGO_ANALYSIS_LIMITS.maxLineChars),
        "warning",
        "analysis-limited",
        `PangoLint skipped deep diagnostics on this line because ${lineLimitReason}.`,
      ),
    );
  }
  const labels = new Set<string>();
  const declared = new Map<
    string,
    { name: string; lineNumber: number; column: number; initialized: boolean; read: boolean }
  >();
  const stringAssignments = new Map<string, string>();
  const warnedUninitialized = new Set<string>();
  // Track per-label: where it was declared and whether any goto refers to it.
  const labelInfo = new Map<string, { name: string; lineNumber: number; column: number; referenced: boolean }>();
  let hasAnyGoto = false;
  let hasDefineMidiTrigger = false;
  let warnedExtValueDefineMidiTrigger = false;

  for (const line of parsed.lines) {
    if (line.label) {
      labels.add(line.label.toLowerCase());
      const key = line.label.toLowerCase();
      if (!labelInfo.has(key)) {
        const column = Math.max(0, line.raw.indexOf(line.label));
        labelInfo.set(key, { name: line.label, lineNumber: line.lineNumber, column, referenced: false });
      }
    }
    if (line.kind === "command" && line.command?.name.toLowerCase() === "definemiditrigger") {
      hasDefineMidiTrigger = true;
    }
  }

  // Property typo hints — only fires for known root objects with close matches.
  if (propertyIndex) {
    for (const line of parsed.lines) {
      if (!line.code) continue;
      if (skippedLines.has(line.lineNumber)) continue;
      const rawOffset = Math.max(0, line.raw.indexOf(line.code));
      addDiagnostics(
        findPropertyTypoDiagnostics(line.code, line.lineNumber, propertyIndex, rawOffset, objectPropertyIndex),
      );
    }
  }

  for (const line of parsed.lines) {
    if (skippedLines.has(line.lineNumber)) continue;
    if (line.code && hasUnclosedString(line.code)) {
      addDiagnostic(
        makeDiagnostic(line.lineNumber, 0, line.raw.length, "error", "unclosed-string", "Unclosed string literal."),
      );
    }

    const parens = parenthesesStatus(line.code);
    if (line.code && (parens.balance !== 0 || parens.prematureClose)) {
      addDiagnostic(
        makeDiagnostic(
          line.lineNumber,
          0,
          line.raw.length,
          "warning",
          "unbalanced-parentheses",
          "Parentheses are not balanced on this line.",
        ),
      );
    }

    if (line.kind === "if") {
      const logicalOperator = findUnsupportedLogicalOperatorDiagnostic(line.code, line.raw, line.lineNumber);
      addDiagnostic(logicalOperator);
      const bangNotEqual = findUnsupportedBangNotEqualDiagnostic(line.code, line.raw, line.lineNumber);
      addDiagnostic(bangNotEqual);
    }

    const propertyIndexAccess = findUnsupportedPropertyIndexAccessDiagnostic(line.code, line.raw, line.lineNumber);
    addDiagnostic(propertyIndexAccess);

    if (hasDefineMidiTrigger && !warnedExtValueDefineMidiTrigger) {
      const extValueTriggerDefault = findExtValueDefineMidiTriggerDefaultDiagnostic(
        line.code,
        line.raw,
        line.lineNumber,
      );
      if (extValueTriggerDefault) {
        addDiagnostic(extValueTriggerDefault);
        warnedExtValueDefineMidiTrigger = true;
      }
    }

    const exitSemicolon = findUnsupportedExitSemicolonDiagnostic(line.code, line.raw, line.lineNumber);
    addDiagnostic(exitSemicolon);

    if (line.kind === "goto" || line.kind === "if") {
      const quotedGoto = findUnsupportedQuotedGotoDiagnostic(line.code, line.raw, line.lineNumber);
      addDiagnostic(quotedGoto);
    }

    if (line.kind === "command" && line.command) {
      const cmdLower = line.command.name.toLowerCase();
      const deltaValueCommandArgument = findUnsupportedDeltaValueCommandArgumentDiagnostic(
        line.code,
        line.raw,
        line.lineNumber,
      );
      addDiagnostic(deltaValueCommandArgument);
      const deltaValueMidiSlotContext = deltaValueCommandArgument
        ? undefined
        : findDeltaValueMidiSlotContextDiagnostic(line.code, line.raw, line.lineNumber);
      addDiagnostic(deltaValueMidiSlotContext);

      if (UNSUPPORTED_LOOP_KEYWORDS.has(cmdLower)) {
        addDiagnostic(
          makeDiagnostic(
            line.lineNumber,
            0,
            line.command.name.length,
            "hint",
            "unsupported-loop",
            `'${line.command.name}' is not a PangoScript construct. For conditional loops, use a label + 'If <cond> Goto <label>'.`,
          ),
        );
      } else if (cmdLower === "for" && DELPHI_STYLE_FOR_RANGE_RE.test(line.command.args)) {
        addDiagnostic(
          makeDiagnostic(
            line.lineNumber,
            Math.max(0, line.raw.toLowerCase().indexOf("for")),
            line.raw.trim().length,
            "error",
            "unsupported-for-range-syntax",
            "BEYOND reports 'Operation expected: to' for Delphi-style For assignment ranges like `For name = start To end`. Use documented label/Goto control flow instead.",
          ),
        );
      } else if (
        !CONTROL_FLOW_KEYWORDS.has(cmdLower) &&
        !isPropertyPathCommandName(line.command.name) &&
        !lookupCommand(catalog, line.command.name)
      ) {
        addDiagnostic(
          makeDiagnostic(
            line.lineNumber,
            0,
            line.command.name.length,
            "warning",
            "unknown-command",
            `Unknown PangoScript command '${line.command.name}'.`,
          ),
        );
      }
    }

    if (line.kind === "command" && line.command && knowledgeByName) {
      const entry = knowledgeByName.get(line.command.name.toLowerCase());
      const arity = entry?.forms ? checkArity(line.command.args, entry.forms) : undefined;
      if (arity) {
        addDiagnostic(
          makeDiagnostic(
            line.lineNumber,
            0,
            line.command.name.length,
            "warning",
            "wrong-arg-count",
            `${line.command.name} expects ${arity.expected} ${arity.expected === "1" ? "argument" : "arguments"}, got ${arity.actual}.`,
          ),
        );
      }
    }

    if ((line.kind === "goto" || line.kind === "if") && line.gotoTarget) {
      hasAnyGoto = true;
      const targetKey = line.gotoTarget.toLowerCase();
      const variableTarget = declared.get(targetKey);
      if (variableTarget) {
        variableTarget.read = true;
        if (!variableTarget.initialized && !warnedUninitialized.has(targetKey)) {
          warnedUninitialized.add(targetKey);
          addDiagnostic(
            makeDiagnostic(
              line.lineNumber,
              Math.max(0, line.raw.indexOf(line.gotoTarget)),
              line.gotoTarget.length,
              "warning",
              "uninitialized-variable",
              `Variable '${variableTarget.name}' is read before a local assignment in this file.`,
            ),
          );
        }
        const resolvedTarget = stringAssignments.get(targetKey);
        const resolvedInfo = resolvedTarget ? labelInfo.get(resolvedTarget.toLowerCase()) : undefined;
        if (resolvedInfo) resolvedInfo.referenced = true;
      } else if (!labels.has(targetKey)) {
        addDiagnostic(
          makeDiagnostic(
            line.lineNumber,
            0,
            line.raw.length,
            "warning",
            "missing-label",
            `Goto target '${line.gotoTarget}' does not match a label in this file.`,
          ),
        );
      } else {
        const info = labelInfo.get(targetKey);
        if (info) info.referenced = true;
      }
    }

    if (line.kind === "declaration" && line.declaration) {
      // GlobalVar declarations stay out of the unused-variable index — they
      // are routinely mutated externally (OSC, sister scripts) and an
      // "unused" check on a single file says nothing about whether they
      // are live system-wide. Var declarations are file-scoped and safe to
      // track.
      if (line.declaration.scope !== "globalvar") {
        for (const name of line.declaration.names) {
          const column = Math.max(0, line.raw.indexOf(name));
          if (!declared.has(name.toLowerCase())) {
            declared.set(name.toLowerCase(), {
              name,
              lineNumber: line.lineNumber,
              column,
              initialized: false,
              read: false,
            });
          }
        }
      }
      // Fall through: many corpus scripts pack a declaration and read on the
      // same physical line via `;` (e.g. `var b; b = c & 255`). The current
      // parser surfaces only the leading declaration, so post-semicolon reads
      // would be invisible if we `continue` here. Scan the full raw line for
      // bare identifiers to catch those read sites.
      const remainder = line.raw.includes(";") ? line.raw.slice(line.raw.indexOf(";") + 1) : "";
      if (remainder) {
        for (const identifier of extractBareIdentifiers(remainder)) {
          const variable = declared.get(identifier.toLowerCase());
          if (variable) variable.read = true;
        }
      }
      continue;
    }

    const readExpression = stripExpressionFunctionCallNames(expressionForVariableReads(line));
    if (readExpression) {
      for (const identifier of extractBareIdentifiers(readExpression)) {
        const key = identifier.toLowerCase();
        if (BUILTIN_WORDS.has(key)) {
          continue;
        }
        const variable = declared.get(key);
        if (variable) {
          variable.read = true;
          if (!variable.initialized && !warnedUninitialized.has(key)) {
            warnedUninitialized.add(key);
            addDiagnostic(
              makeDiagnostic(
                line.lineNumber,
                Math.max(0, line.raw.indexOf(identifier)),
                identifier.length,
                "warning",
                "uninitialized-variable",
                `Variable '${variable.name}' is read before a local assignment in this file.`,
              ),
            );
          }
        }
      }
    }

    if (line.kind === "assignment" && line.assignment) {
      const deltaValueAssignment = findUnsupportedDeltaValueAssignmentDiagnostic(
        line.assignment.expression,
        line.raw,
        line.lineNumber,
      );
      addDiagnostic(deltaValueAssignment);

      const variable = declared.get(line.assignment.target.toLowerCase());
      if (variable) {
        variable.initialized = true;
        const stringValue = stringLiteralValue(line.assignment.expression);
        if (stringValue === undefined) {
          stringAssignments.delete(line.assignment.target.toLowerCase());
        } else {
          stringAssignments.set(line.assignment.target.toLowerCase(), stringValue);
        }
      }
    }
  }

  const lastExecutableLine = [...parsed.lines]
    .filter((line) => !skippedLines.has(line.lineNumber))
    .reverse()
    .find((line) => line.kind !== "blank" && line.kind !== "comment" && line.code.trim().length > 0);
  if (lastExecutableLine && !TERMINAL_EXIT_RE.test(lastExecutableLine.code.trim())) {
    addDiagnostic(
      makeDiagnostic(
        lastExecutableLine.lineNumber,
        0,
        lastExecutableLine.raw.length,
        "hint",
        "missing-terminal-exit",
        "BEYOND accepts this shape, but `exit` is recommended to prevent fall-through between script sections.",
      ),
    );
  }

  // Unused-variable hints. A variable that's declared via Var
  // but never appears in any read expression is likely dead code or a typo.
  // GlobalVar declarations are intentionally exempt — those are routinely
  // mutated externally (OSC, sister scripts).
  for (const variable of declared.values()) {
    if (variable.read) continue;
    addDiagnostic(
      makeDiagnostic(
        variable.lineNumber,
        variable.column,
        variable.name.length,
        "hint",
        "unused-variable",
        `Variable '${variable.name}' is declared but never read in this file.`,
      ),
    );
  }

  // Unused-label hints. Only fires in files that already use
  // Goto somewhere — files with zero gotos are typically event handlers
  // where the label IS the entry point. Common entry-point names
  // (OnClick, Init, Start, …) are also exempt regardless of file shape.
  if (hasAnyGoto) {
    for (const info of labelInfo.values()) {
      if (info.referenced) continue;
      if (isExternallyInvokedLabelName(info.name)) continue;
      addDiagnostic(
        makeDiagnostic(
          info.lineNumber,
          info.column,
          info.name.length,
          "hint",
          "unused-label",
          `Label '${info.name}' is declared but never targeted by a Goto in this file.`,
        ),
      );
    }
  }

  return diagnostics;
}

function diagnosticPriority(diagnostic: PangoDiagnostic): number {
  if (diagnostic.severity === "error") return 3;
  if (diagnostic.severity === "warning") return 2;
  return 1;
}

function stringLiteralValue(expression: string): string | undefined {
  const trimmed = expression.trim();
  const match = /^"([^"\\]*)"$/.exec(trimmed);
  return match?.[1];
}

function stripExpressionFunctionCallNames(expression: string): string {
  let inString = false;
  let escaped = false;
  const chars = [...expression];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (!/[A-Za-z_]/.test(char ?? "")) continue;
    const wordStart = index;
    let wordEnd = index + 1;
    while (wordEnd < chars.length && /[A-Za-z0-9_]/.test(chars[wordEnd] ?? "")) {
      wordEnd += 1;
    }

    const word = expression.slice(wordStart, wordEnd).toLowerCase();
    let callStart = wordEnd;
    while (callStart < chars.length && /\s/.test(chars[callStart] ?? "")) {
      callStart += 1;
    }
    if (EXPRESSION_FUNCTION_WORDS.has(word) && chars[callStart] === "(") {
      for (let clearIndex = wordStart; clearIndex < wordEnd; clearIndex += 1) {
        chars[clearIndex] = " ";
      }
    }
    index = wordEnd - 1;
  }

  return chars.join("");
}

function findUnsupportedExitSemicolonDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  if (!EXIT_SEMICOLON_RE.test(lineCode.trim())) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  const exitIndex = lineCode.toLowerCase().lastIndexOf("exit");
  return makeDiagnostic(
    lineNumber,
    rawOffset + Math.max(0, exitIndex),
    lineCode.length - Math.max(0, exitIndex),
    "warning",
    "unsupported-exit-semicolon",
    "BEYOND reports 'Invalid expression' for `exit;`. Use bare `exit` without a trailing semicolon.",
  );
}

function findUnsupportedQuotedGotoDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const gotoIndex = findWordOutsideStrings(lineCode, "goto", 0, lineCode.length);
  if (gotoIndex < 0) return undefined;

  let quoteIndex = gotoIndex + "goto".length;
  while (quoteIndex < lineCode.length && /\s/.test(lineCode[quoteIndex] ?? "")) {
    quoteIndex += 1;
  }
  if (lineCode[quoteIndex] !== '"') return undefined;

  const closingQuoteIndex = lineCode.indexOf('"', quoteIndex + 1);
  const length = closingQuoteIndex >= 0 ? closingQuoteIndex - quoteIndex + 1 : lineCode.length - quoteIndex;
  const label = lineCode.slice(quoteIndex + 1, closingQuoteIndex >= 0 ? closingQuoteIndex : undefined);
  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makeDiagnostic(
    lineNumber,
    rawOffset + quoteIndex,
    length,
    "warning",
    "unsupported-quoted-goto-label",
    `BEYOND reports 'Illegal goto label: ${label}' for quoted Goto targets. Use a bare label name: Goto ${label}.`,
  );
}

function findUnsupportedPropertyIndexAccessDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(lineCode, ZONE_POINTS_INDEX_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makeDiagnostic(
    lineNumber,
    rawOffset + match.index,
    match.text.length,
    "warning",
    "unsupported-property-index-access",
    `BEYOND reports 'Invalid array index value' and unknown-variable errors for direct reads of '${match.text}'. Use verified dotted property reads, or keep Zone.N.Points[...] only as a quoted string for commands that document property path strings.`,
  );
}

function findUnsupportedDeltaValueAssignmentDiagnostic(
  expression: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(expression, DELTAVALUE_ASSIGNMENT_CALL_RE);
  if (!match) return undefined;

  const expressionOffset = Math.max(0, lineRaw.indexOf(expression));
  return makeDiagnostic(
    lineNumber,
    expressionOffset + match.index,
    "DeltaValue".length,
    "warning",
    "unsupported-deltavalue-assignment",
    "BEYOND rejects `DeltaValue(...)` assignment expressions. No-space calls report 'Unknown function, undeclared or not initialized variable: deltavalue'; spaced `deltavalue (...)` calls report 'Operation expected: ('. Spaced `deltavalue (...)` is only observed in MIDI-to-PangoScript slot property/control arguments.",
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
  return makeDiagnostic(
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
  return makeDiagnostic(
    lineNumber,
    rawOffset + match.index,
    "DeltaValue".length,
    "hint",
    "deltavalue-midi-slot-context",
    "BEYOND editor paste/run reports 'Unknown function' for spaced `deltavalue (...)` property/control commands. Use this form only in a bound MIDI-to-PangoScript slot that has been validated against the controller.",
  );
}

function isPropertyPathCommandName(name: string): boolean {
  return name.includes(".");
}

function findExtValueDefineMidiTriggerDefaultDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const match = findRegexOutsideStrings(lineCode, EXTVALUE_CALL_RE);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makeDiagnostic(
    lineNumber,
    rawOffset + match.index,
    "ExtValue".length,
    "hint",
    "extvalue-define-midi-trigger-default",
    "BEYOND accepted this DefineMidiTrigger/InRangeTrigger label-handler shape, but ExtValue returns default values instead of the incoming MIDI CC value. Use direct MIDI-to-PangoScript slot scripts for ExtValue scaling until this trigger context is validated otherwise.",
  );
}

function findUnsupportedLogicalOperatorDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const ifIndex = findWordOutsideStrings(lineCode, "if", 0, lineCode.length);
  if (ifIndex < 0) return undefined;

  const conditionStart = ifIndex + "if".length;
  const gotoIndex = findWordOutsideStrings(lineCode, "goto", conditionStart, lineCode.length);
  const conditionEnd = gotoIndex >= 0 ? gotoIndex : lineCode.length;
  const match = findFirstWordOutsideStrings(lineCode, TEXTUAL_LOGICAL_OPERATORS, conditionStart, conditionEnd);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  const operator = match.word.toLowerCase();
  return makeDiagnostic(
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
  const ifIndex = findWordOutsideStrings(lineCode, "if", 0, lineCode.length);
  if (ifIndex < 0) return undefined;

  const conditionStart = ifIndex + "if".length;
  const gotoIndex = findWordOutsideStrings(lineCode, "goto", conditionStart, lineCode.length);
  const conditionEnd = gotoIndex >= 0 ? gotoIndex : lineCode.length;
  const match = findTextOutsideStrings(lineCode, "!=", conditionStart, conditionEnd);
  if (!match) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makeDiagnostic(
    lineNumber,
    rawOffset + match.index,
    match.text.length,
    "warning",
    "unsupported-bang-not-equal-operator",
    "BEYOND reports 'Operation expected: !' for `!=` in If conditions. Use `<>` for not-equal comparisons.",
  );
}

function findWordOutsideStrings(text: string, word: string, start: number, end: number): number {
  return findFirstWordOutsideStrings(text, [word], start, end)?.index ?? -1;
}

function findTextOutsideStrings(
  text: string,
  needle: string,
  start: number,
  end: number,
): { text: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (text.slice(index, index + needle.length) === needle) {
      return { text: needle, index };
    }
  }

  return undefined;
}

function findFirstWordOutsideStrings(
  text: string,
  words: readonly string[],
  start: number,
  end: number,
): { word: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    for (const word of words) {
      if (startsWithWordAt(text, word, index, end)) {
        return { word: text.slice(index, index + word.length), index };
      }
    }
  }

  return undefined;
}

function startsWithWordAt(text: string, word: string, index: number, end: number): boolean {
  const afterIndex = index + word.length;
  if (afterIndex > end) return false;
  if (text.slice(index, afterIndex).toLowerCase() !== word.toLowerCase()) return false;
  return !isIdentifierChar(text[index - 1]) && !isIdentifierChar(text[afterIndex]);
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_]/.test(char);
}

function findRegexOutsideStrings(text: string, pattern: RegExp): { text: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    const match = text.slice(index).match(pattern);
    if (match?.index === 0 && match[0]) {
      return { text: match[0], index };
    }
  }

  return undefined;
}

function checkArity(argsString: string, forms: KnowledgeForm[]): { expected: string; actual: number } | undefined {
  const actual = countArgs(argsString);
  const ranges = arityRangesForForms(forms);

  if (ranges.length === 0) return undefined;
  if (ranges.some((range) => actual >= range.min && actual <= range.max)) {
    return undefined;
  }

  return { expected: describeArityExpectation(ranges), actual };
}

function arityRangesForForms(forms: KnowledgeForm[]): Array<{ min: number; max: number }> {
  const hasCuratedForms = forms.some((form) => !isGeneratedOptionalExampleForm(form) && !isGeneratedBareStub(form));
  const hasCuratedParameterizedForms = forms.some((form) => {
    return !isGeneratedOptionalExampleForm(form) && !isGeneratedBareStub(form) && (form.parameters?.length ?? 0) > 0;
  });

  return forms.flatMap((form) => {
    if (isGeneratedOptionalExampleForm(form)) {
      const count = form.parameters?.length ?? 0;
      return [{ min: hasCuratedForms ? count : 0, max: count }];
    }
    if (hasCuratedParameterizedForms && isGeneratedBareStub(form)) return [];

    const range = arityRangeForForm(form);
    return range ? [range] : [];
  });
}

function isGeneratedOptionalExampleForm(form: KnowledgeForm): boolean {
  const params = form.parameters ?? [];
  if (params.length === 0) return false;
  return params.every(
    (param, index) => param.name === `arg${index + 1}` && param.type === "unknown" && param.required === false,
  );
}

function isGeneratedBareStub(form: KnowledgeForm): boolean {
  return form.parameters === undefined && isBareCommandSignature(form.signature);
}

function arityRangeForForm(form: KnowledgeForm): { min: number; max: number } | undefined {
  if (isZeroArityForm(form)) return { min: 0, max: 0 };

  const params = form.parameters ?? [];
  if (params.length === 0) return undefined;

  const required = params.filter((param) => param.required).length;
  return {
    min: required,
    max: isVariadicForm(form) ? Number.POSITIVE_INFINITY : params.length,
  };
}

function isVariadicForm(form: KnowledgeForm): boolean {
  if (/\.\.\./.test(form.signature ?? "")) return true;
  return (form.parameters ?? []).some((param) => {
    return param.type === "variadic" || /\.\.n\b/i.test(param.name) || /\brepeatable\b/i.test(param.description ?? "");
  });
}

function describeArityExpectation(ranges: Array<{ min: number; max: number }>): string {
  const merged = mergeArityRanges(ranges);
  if (merged.length === 1) {
    const [range] = merged;
    if (!range) return "unknown";
    if (range.max === Number.POSITIVE_INFINITY) return `at least ${range.min}`;
    if (range.min === range.max) return String(range.min);
    return `between ${range.min} and ${range.max}`;
  }

  const exactValues = merged
    .filter((range) => range.min === range.max)
    .map((range) => range.min)
    .sort((left, right) => left - right);
  if (exactValues.length === merged.length && exactValues.length <= 3) {
    return exactValues.join(" or ");
  }

  const variadic = merged.find((range) => range.max === Number.POSITIVE_INFINITY);
  if (variadic) {
    const exactPrefix = exactValues.length > 0 ? `${exactValues.join(" or ")} or ` : "";
    return `${exactPrefix}at least ${variadic.min}`;
  }

  return `between ${Math.min(...merged.map((range) => range.min))} and ${Math.max(...merged.map((range) => range.max))}`;
}

function mergeArityRanges(ranges: Array<{ min: number; max: number }>): Array<{ min: number; max: number }> {
  const sorted = [...ranges].sort((left, right) => left.min - right.min || left.max - right.max);
  const merged: Array<{ min: number; max: number }> = [];
  for (const range of sorted) {
    const prior = merged[merged.length - 1];
    if (!prior || range.min > prior.max + 1) {
      merged.push({ ...range });
      continue;
    }
    prior.max = Math.max(prior.max, range.max);
  }
  return merged;
}

function isZeroArityForm(form: KnowledgeForm): boolean {
  return Array.isArray(form.parameters) && form.parameters.length === 0 && isBareCommandSignature(form.signature);
}

function isBareCommandSignature(signature: string | undefined): boolean {
  const trimmed = signature?.trim() ?? "";
  return trimmed.length > 0 && !/\s/.test(trimmed) && !/[<[]/.test(trimmed);
}

function makeDiagnostic(
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
