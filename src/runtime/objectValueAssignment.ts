export type ObjectValueTypeTag = "f" | "s";

export interface ObjectValueAssignment {
  command: string;
  expectedValue: number | string;
  typeTag: ObjectValueTypeTag;
}

export interface ObjectValueAssignmentError {
  error: string;
}

export function buildObjectValueAssignment(
  propertyPath: string,
  rawInput: string,
): ObjectValueAssignment | ObjectValueAssignmentError {
  const value = rawInput.trim();
  if (!value) {
    return { error: "Value is required." };
  }
  if (/[\r\n\0]/.test(value)) {
    return { error: "Value must be a single line." };
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && /^-?\d+(?:\.\d+)?$/.test(value)) {
    return {
      command: `${propertyPath} = ${value}`,
      expectedValue: numeric,
      typeTag: "f",
    };
  }

  if (value.startsWith('"')) {
    return { error: "Enter string values without wrapping quotes." };
  }
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code > 0x7e) {
      return { error: "String values must contain printable ASCII characters only." };
    }
  }

  const quoted = `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return {
    command: `${propertyPath} = ${quoted}`,
    expectedValue: value,
    typeTag: "s",
  };
}
