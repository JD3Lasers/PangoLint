import type { ReferenceForm, ReferenceObjectProperty } from "../types";

export function buildObjectValueSummaryText(metadata: ReferenceObjectProperty["valueMetadata"]): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  appendDistinctSummaryPart(parts, metadata.valueType);
  if (metadata.valueRange) {
    const bounds = objectValueRangeBounds(metadata.valueRange);
    appendDistinctSummaryPart(parts, bounds);
    appendDistinctSummaryPart(parts, metadata.valueRange.unit);
    if (metadata.valueRange.boundaryBehavior) {
      appendDistinctSummaryPart(
        parts,
        `${describeBoundaryBehavior(metadata.valueRange.boundaryBehavior)} outside range`,
      );
    }
  } else if (metadata.unit) {
    appendDistinctSummaryPart(parts, metadata.unit);
  }
  if (metadata.defaultValue !== undefined) appendDistinctSummaryPart(parts, `default ${String(metadata.defaultValue)}`);
  if (metadata.acceptedValues?.length) {
    appendDistinctSummaryPart(parts, metadata.acceptedValues.map(formatAcceptedValue).join(", "));
  }
  if (metadata.locationContext?.populationDependent) appendDistinctSummaryPart(parts, "location-aware");
  return parts.length > 0 ? parts.join("; ") : null;
}

export function buildObjectValueCardSummaryText(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"] | undefined,
): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  appendDistinctSummaryPart(parts, summary.valueType);
  if (summary.range) {
    const bounds = objectValueCardRangeBounds(summary.range);
    appendDistinctSummaryPart(parts, bounds);
    appendDistinctSummaryPart(parts, summary.range.unit);
    if (summary.range.boundaryBehavior) {
      appendDistinctSummaryPart(parts, `${describeBoundaryBehavior(summary.range.boundaryBehavior)} outside range`);
    }
  } else if (summary.unit) {
    appendDistinctSummaryPart(parts, summary.unit);
  }
  if (summary.defaultValue !== undefined) appendDistinctSummaryPart(parts, `default ${String(summary.defaultValue)}`);
  if (summary.acceptedValueCount) appendDistinctSummaryPart(parts, `${summary.acceptedValueCount} accepted values`);
  if (summary.locationKind)
    appendDistinctSummaryPart(parts, behaviorLabel(summary.locationKind) ?? summary.locationKind);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectReadbackSummary(metadata: ReferenceObjectProperty["readbackMetadata"]): string | null {
  if (!metadata) return null;
  const parts = ["readback"];
  if (metadata.valueType) parts.push(metadata.valueType);
  if (metadata.observedValue !== undefined) parts.push(`observed ${String(metadata.observedValue)}`);
  if (metadata.locationContext?.populationDependent) parts.push("location-aware");
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectReadbackCardSummary(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["readbackSummary"] | undefined,
): string | null {
  if (!summary) return null;
  if (!summary.valueType && summary.observedValue === undefined && !summary.locationKind) return null;
  const parts = [summary.status === "readable" ? "readback" : (behaviorLabel(summary.status) ?? summary.status)];
  if (summary.valueType) parts.push(summary.valueType);
  if (summary.observedValue !== undefined) parts.push(`observed ${String(summary.observedValue)}`);
  if (summary.locationKind) parts.push(behaviorLabel(summary.locationKind) ?? summary.locationKind);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectBehaviorSummary(classification: ReferenceObjectProperty["classification"]): string | null {
  if (!classification) return null;
  const parts = [behaviorLabel(classification.accessMode), behaviorLabel(classification.behaviorKind)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join("; ") : null;
}

export function formatAcceptedValue(
  value:
    | NonNullable<ReferenceForm["parameters"][number]["acceptedValues"]>[number]
    | NonNullable<NonNullable<ReferenceObjectProperty["valueMetadata"]>["acceptedValues"]>[number],
): string {
  return value.label ? `${value.value}=${value.label}` : String(value.value);
}

export function describeBoundaryBehavior(
  behavior: NonNullable<ReferenceForm["parameters"][number]["valueRange"]>["boundaryBehavior"],
): string {
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

function appendDistinctSummaryPart(parts: string[], part: string | undefined | null): void {
  if (!part) return;
  const normalized = part.trim().toLowerCase();
  if (parts.some((existing) => existing.trim().toLowerCase() === normalized)) return;
  parts.push(part);
}

function behaviorLabel(value: string | undefined): string | undefined {
  return value?.replaceAll("-", " ");
}

function objectValueRangeBounds(
  range: NonNullable<ReferenceObjectProperty["valueMetadata"]>["valueRange"],
): string | null {
  if (!range) return null;
  const { min, max, dynamicMax } = range;
  const dynamicMaxExpression = dynamicMax?.expression;
  if (min === undefined && max === undefined && !dynamicMaxExpression) return null;
  if (min !== undefined && dynamicMaxExpression) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
    }
    return `${min}..${dynamicMaxExpression}`;
  }
  if (min !== undefined && max !== undefined) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${range.minInclusive === false ? ">" : ">="} ${min}`;
  if (dynamicMaxExpression) return `${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
  if (max !== undefined) return `${range.maxInclusive === false ? "<" : "<="} ${max}`;
  return null;
}

function objectValueCardRangeBounds(
  range: NonNullable<NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"]>["range"],
): string | null {
  if (!range) return null;
  const { min, max, dynamicMaxExpression } = range;
  if (min === undefined && max === undefined && !dynamicMaxExpression) return null;
  if (min !== undefined && dynamicMaxExpression) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
    }
    return `${min}..${dynamicMaxExpression}`;
  }
  if (min !== undefined && max !== undefined) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${range.minInclusive === false ? ">" : ">="} ${min}`;
  if (dynamicMaxExpression) return `${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
  if (max !== undefined) return `${range.maxInclusive === false ? "<" : "<="} ${max}`;
  return null;
}
