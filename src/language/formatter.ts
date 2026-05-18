import { findAssignmentOperator, isAssignmentTarget, splitCodeAndComment, splitLeadingLabel } from "./parser";

export function formatPangoScript(text: string): string {
  return text.split(/\r?\n/).map(formatLine).join("\n");
}

function formatLine(raw: string): string {
  const { code, comment } = splitCodeAndComment(raw.replace(/\r$/, ""));
  let formatted = code.trim();

  if (formatted) {
    formatted = normalizeLabelAndStatement(formatted);
    formatted = normalizeCommas(formatted);
  }

  if (comment) {
    return formatted ? `${formatted} ${comment}` : comment;
  }
  return formatted;
}

function normalizeLabelAndStatement(code: string): string {
  const labelPrefix = splitLeadingLabel(code);
  if (!labelPrefix) {
    return normalizeAssignment(code);
  }
  if (!labelPrefix.statement) {
    return `${labelPrefix.label}:`;
  }
  return `${labelPrefix.label}: ${normalizeAssignment(labelPrefix.statement)}`;
}

function normalizeAssignment(code: string): string {
  if (/^if\b/i.test(code)) {
    return code;
  }
  const index = findAssignmentOperator(code);
  if (index < 0) {
    return code;
  }
  const left = code.slice(0, index).trim();
  if (!isAssignmentTarget(left)) {
    return code;
  }
  const right = code.slice(index + 1).trim();
  return `${left} = ${right}`;
}

function normalizeCommas(code: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }
    if (!inString && char === ",") {
      result = `${result.trimEnd()}, `;
      while (code[index + 1] === " ") {
        index += 1;
      }
      continue;
    }
    result += char;
  }

  return result.trimEnd();
}
