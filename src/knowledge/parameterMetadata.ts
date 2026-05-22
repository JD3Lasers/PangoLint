type ParameterBoundaryBehavior = "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";

interface ParameterAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

interface ParameterValueRange {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: ParameterBoundaryBehavior;
}

export interface ParameterRangeMetadata {
  range?: string;
  valueRange?: ParameterValueRange;
  acceptedValues?: ParameterAcceptedValue[];
}

export function formatParameterRangeMetadata(param: ParameterRangeMetadata): string {
  const parts: string[] = [];
  if (param.range) parts.push(param.range);
  const valueRange = param.valueRange;
  if (valueRange) {
    const bounds = formatValueRangeBounds(valueRange);
    const structured = [
      bounds && bounds !== param.range ? bounds : null,
      valueRange.unit,
      valueRange.boundaryBehavior ? `${describeBoundaryBehavior(valueRange.boundaryBehavior)} outside range` : null,
    ].filter((part): part is string => Boolean(part));
    if (structured.length > 0) parts.push(structured.join("; "));
  }
  const values = param.acceptedValues?.map(formatAcceptedValue) ?? [];
  if (values.length > 0) parts.push(values.join(", "));
  return parts.join(" · ");
}

function formatValueRangeBounds(valueRange: ParameterValueRange): string | null {
  const { min, max } = valueRange;
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined) {
    if (valueRange.minInclusive === false || valueRange.maxInclusive === false) {
      return `${valueRange.minInclusive === false ? ">" : ">="} ${min} and ${
        valueRange.maxInclusive === false ? "<" : "<="
      } ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${valueRange.minInclusive === false ? ">" : ">="} ${min}`;
  return `${valueRange.maxInclusive === false ? "<" : "<="} ${max}`;
}

function formatAcceptedValue(value: ParameterAcceptedValue): string {
  return value.label ? `${value.value}=${value.label}` : String(value.value);
}

function describeBoundaryBehavior(behavior: ParameterBoundaryBehavior): string {
  switch (behavior) {
    case "clamp":
      return "clamps";
    case "no-op":
      return "no-ops";
    case "pass-through":
      return "passes through";
    case "reject":
      return "rejects";
    case "wrap":
      return "wraps";
    default:
      return "unknown behavior";
  }
}
