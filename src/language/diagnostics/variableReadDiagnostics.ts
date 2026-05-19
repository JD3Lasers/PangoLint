import { extractBareIdentifiers, type ParsedLine } from "../parser";
import { expressionForVariableReads, isExternallyInvokedLabelName } from "../usageDiagnostics";
import { makePangoDiagnostic, type PangoDiagnostic } from "./pangoDiagnostic";

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

interface DeclaredVariable {
  name: string;
  lineNumber: number;
  column: number;
  initialized: boolean;
  read: boolean;
}

interface LabelInfo {
  name: string;
  lineNumber: number;
  column: number;
  referenced: boolean;
}

export interface VariableReadState {
  labels: Set<string>;
  declared: Map<string, DeclaredVariable>;
  stringAssignments: Map<string, string>;
  warnedUninitialized: Set<string>;
  labelInfo: Map<string, LabelInfo>;
  hasAnyGoto: boolean;
}

export function createVariableReadState(lines: readonly ParsedLine[]): VariableReadState {
  const labels = new Set<string>();
  const labelInfo = new Map<string, LabelInfo>();
  for (const line of lines) {
    if (!line.label) continue;
    labels.add(line.label.toLowerCase());
    const key = line.label.toLowerCase();
    if (!labelInfo.has(key)) {
      const column = Math.max(0, line.raw.indexOf(line.label));
      labelInfo.set(key, { name: line.label, lineNumber: line.lineNumber, column, referenced: false });
    }
  }

  return {
    labels,
    declared: new Map(),
    stringAssignments: new Map(),
    warnedUninitialized: new Set(),
    labelInfo,
    hasAnyGoto: false,
  };
}

export function findVariableReadDiagnosticsForLine(line: ParsedLine, state: VariableReadState): PangoDiagnostic[] {
  const diagnostics: PangoDiagnostic[] = [];
  if ((line.kind === "goto" || line.kind === "if") && line.gotoTarget) {
    state.hasAnyGoto = true;
    const targetKey = line.gotoTarget.toLowerCase();
    const variableTarget = state.declared.get(targetKey);
    if (variableTarget) {
      variableTarget.read = true;
      if (!variableTarget.initialized && !state.warnedUninitialized.has(targetKey)) {
        state.warnedUninitialized.add(targetKey);
        diagnostics.push(
          makePangoDiagnostic(
            line.lineNumber,
            Math.max(0, line.raw.indexOf(line.gotoTarget)),
            line.gotoTarget.length,
            "warning",
            "uninitialized-variable",
            `Variable '${variableTarget.name}' is read before a local assignment in this file.`,
          ),
        );
      }
      const resolvedTarget = state.stringAssignments.get(targetKey);
      const resolvedInfo = resolvedTarget ? state.labelInfo.get(resolvedTarget.toLowerCase()) : undefined;
      if (resolvedInfo) resolvedInfo.referenced = true;
    } else if (!state.labels.has(targetKey)) {
      diagnostics.push(
        makePangoDiagnostic(
          line.lineNumber,
          0,
          line.raw.length,
          "warning",
          "missing-label",
          `Goto target '${line.gotoTarget}' does not match a label in this file.`,
        ),
      );
    } else {
      const info = state.labelInfo.get(targetKey);
      if (info) info.referenced = true;
    }
  }

  if (line.kind === "declaration" && line.declaration) {
    if (line.declaration.scope !== "globalvar") {
      for (const name of line.declaration.names) {
        const column = Math.max(0, line.raw.indexOf(name));
        if (!state.declared.has(name.toLowerCase())) {
          state.declared.set(name.toLowerCase(), {
            name,
            lineNumber: line.lineNumber,
            column,
            initialized: false,
            read: false,
          });
        }
      }
    }
    const remainder = line.raw.includes(";") ? line.raw.slice(line.raw.indexOf(";") + 1) : "";
    if (remainder) {
      for (const identifier of extractBareIdentifiers(remainder)) {
        const variable = state.declared.get(identifier.toLowerCase());
        if (variable) variable.read = true;
      }
    }
    return diagnostics;
  }

  const readExpression = stripExpressionFunctionCallNames(expressionForVariableReads(line));
  if (readExpression) {
    for (const identifier of extractBareIdentifiers(readExpression)) {
      const key = identifier.toLowerCase();
      if (BUILTIN_WORDS.has(key)) continue;
      const variable = state.declared.get(key);
      if (variable) {
        variable.read = true;
        if (!variable.initialized && !state.warnedUninitialized.has(key)) {
          state.warnedUninitialized.add(key);
          diagnostics.push(
            makePangoDiagnostic(
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
    const variable = state.declared.get(line.assignment.target.toLowerCase());
    if (variable) {
      variable.initialized = true;
      const stringValue = stringLiteralValue(line.assignment.expression);
      if (stringValue === undefined) {
        state.stringAssignments.delete(line.assignment.target.toLowerCase());
      } else {
        state.stringAssignments.set(line.assignment.target.toLowerCase(), stringValue);
      }
    }
  }

  return diagnostics;
}

export function findUnusedVariableAndLabelDiagnostics(state: VariableReadState): PangoDiagnostic[] {
  const diagnostics: PangoDiagnostic[] = [];
  for (const variable of state.declared.values()) {
    if (variable.read) continue;
    diagnostics.push(
      makePangoDiagnostic(
        variable.lineNumber,
        variable.column,
        variable.name.length,
        "hint",
        "unused-variable",
        `Variable '${variable.name}' is declared but never read in this file.`,
      ),
    );
  }

  if (state.hasAnyGoto) {
    for (const info of state.labelInfo.values()) {
      if (info.referenced) continue;
      if (isExternallyInvokedLabelName(info.name)) continue;
      diagnostics.push(
        makePangoDiagnostic(
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
