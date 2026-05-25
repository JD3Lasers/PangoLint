import type { ReferenceForm, ReferenceObjectProperty } from "../types";

export interface ObjectValueDisplayParts {
  valueParts: string[];
  formatParts: string[];
}

export interface ObjectValueDisplayOptions {
  hideUnknownBoundaryBehavior?: boolean;
}

export function buildObjectValueSummaryText(metadata: ReferenceObjectProperty["valueMetadata"]): string | null {
  return joinObjectValueDisplayParts(buildObjectValueSummaryParts(metadata));
}

export function buildObjectValueSummaryParts(
  metadata: ReferenceObjectProperty["valueMetadata"],
  options: ObjectValueDisplayOptions = {},
): ObjectValueDisplayParts | null {
  if (!metadata) return null;
  const valueParts: string[] = [];
  const formatParts: string[] = [];
  appendDistinctSummaryPart(valueParts, metadata.valueType);
  appendValueFormatPart(formatParts, metadata.valueRange?.unit, metadata.valueType);
  appendValueFormatPart(formatParts, metadata.unit, metadata.valueType);
  if (metadata.valueRange) {
    const bounds = objectValueRangeBounds(metadata.valueRange);
    appendDistinctSummaryPart(valueParts, bounds);
    if (shouldShowBoundaryBehavior(metadata.valueRange.boundaryBehavior, options)) {
      appendDistinctSummaryPart(
        valueParts,
        `${describeBoundaryBehavior(metadata.valueRange.boundaryBehavior)} outside range`,
      );
    }
  }
  if (metadata.defaultValue !== undefined)
    appendDistinctSummaryPart(valueParts, `default ${String(metadata.defaultValue)}`);
  if (metadata.acceptedValues?.length && !isDefaultBooleanAcceptedValues(metadata.valueType, metadata.acceptedValues)) {
    appendDistinctSummaryPart(valueParts, metadata.acceptedValues.map(formatAcceptedValue).join(", "));
  }
  appendDistinctSummaryPart(valueParts, visibleLocationContextLabel(metadata.locationContext));
  return valueParts.length > 0 || formatParts.length > 0 ? { valueParts, formatParts } : null;
}

export function buildObjectValueCardSummaryText(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"] | undefined,
): string | null {
  return joinObjectValueDisplayParts(buildObjectValueCardSummaryParts(summary));
}

export function buildObjectValueCardSummaryParts(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"] | undefined,
  options: ObjectValueDisplayOptions = {},
): ObjectValueDisplayParts | null {
  if (!summary) return null;
  const valueParts: string[] = [];
  const formatParts: string[] = [];
  appendDistinctSummaryPart(valueParts, summary.valueType);
  appendValueFormatPart(formatParts, summary.range?.unit, summary.valueType);
  appendValueFormatPart(formatParts, summary.unit, summary.valueType);
  if (summary.range) {
    const bounds = objectValueCardRangeBounds(summary.range);
    appendDistinctSummaryPart(valueParts, bounds);
    if (shouldShowBoundaryBehavior(summary.range.boundaryBehavior, options)) {
      appendDistinctSummaryPart(
        valueParts,
        `${describeBoundaryBehavior(summary.range.boundaryBehavior)} outside range`,
      );
    }
  }
  if (summary.defaultValue !== undefined)
    appendDistinctSummaryPart(valueParts, `default ${String(summary.defaultValue)}`);
  if (
    summary.acceptedValueCount &&
    !isDefaultBooleanAcceptedValueCount(summary.valueType, summary.acceptedValueCount)
  ) {
    appendDistinctSummaryPart(valueParts, `${summary.acceptedValueCount} accepted values`);
  }
  appendDistinctSummaryPart(valueParts, visibleLocationKind(summary.locationKind));
  return valueParts.length > 0 || formatParts.length > 0 ? { valueParts, formatParts } : null;
}

function joinObjectValueDisplayParts(parts: ObjectValueDisplayParts | null): string | null {
  if (!parts) return null;
  const allParts = [...parts.valueParts, ...parts.formatParts];
  return allParts.length > 0 ? allParts.join("; ") : null;
}

function appendValueFormatPart(parts: string[], part: string | undefined | null, valueType: string | undefined): void {
  if (!part) return;
  if (valueType && part.trim().toLowerCase() === valueType.trim().toLowerCase()) return;
  appendDistinctSummaryPart(parts, part);
}

function shouldShowBoundaryBehavior(
  behavior: NonNullable<ReferenceForm["parameters"][number]["valueRange"]>["boundaryBehavior"] | undefined,
  options: ObjectValueDisplayOptions,
): behavior is NonNullable<ReferenceForm["parameters"][number]["valueRange"]>["boundaryBehavior"] {
  if (!behavior) return false;
  return !(options.hideUnknownBoundaryBehavior && behavior === "unknown");
}

function isDefaultBooleanAcceptedValueCount(valueType: string | undefined, count: number): boolean {
  return valueType?.trim().toLowerCase() === "boolean" && count === 2;
}

function isDefaultBooleanAcceptedValues(
  valueType: string | undefined,
  values: NonNullable<ReferenceObjectProperty["valueMetadata"]>["acceptedValues"],
): boolean {
  if (valueType?.trim().toLowerCase() !== "boolean" || values?.length !== 2) return false;
  if (values.some((value) => value.label)) return false;
  const normalizedValues = values.map((value) => String(value.value).trim().toLowerCase()).sort();
  return (
    (normalizedValues[0] === "0" && normalizedValues[1] === "1") ||
    (normalizedValues[0] === "false" && normalizedValues[1] === "true")
  );
}

function visibleLocationContextLabel(
  locationContext: NonNullable<ReferenceObjectProperty["valueMetadata"]>["locationContext"] | undefined,
): string | undefined {
  if (!locationContext) return undefined;
  const kind = visibleLocationKind(locationContext.kind);
  if (kind) return kind;
  return locationContext.kind ? undefined : locationContext.populationDependent ? "location-aware" : undefined;
}

function visibleLocationKind(locationKind: string | undefined): string | undefined {
  if (!locationKind || locationKind === "indexed-root") return undefined;
  return behaviorLabel(locationKind) ?? locationKind;
}

export function objectReadbackSummary(metadata: ReferenceObjectProperty["readbackMetadata"]): string | null {
  if (!metadata) return null;
  const parts = ["readback"];
  if (metadata.valueType) parts.push(metadata.valueType);
  const locationLabel = visibleLocationContextLabel(metadata.locationContext);
  if (locationLabel) parts.push(locationLabel);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectReadbackCardSummary(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["readbackSummary"] | undefined,
): string | null {
  if (!summary) return null;
  const locationKind = visibleLocationKind(summary.locationKind);
  if (!summary.valueType && !locationKind) return null;
  const parts = [summary.status === "readable" ? "readback" : (behaviorLabel(summary.status) ?? summary.status)];
  if (summary.valueType) parts.push(summary.valueType);
  if (locationKind) parts.push(locationKind);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectBehaviorSummary(classification: ReferenceObjectProperty["classification"]): string | null {
  const parts = objectBehaviorSummaryParts(classification);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectBehaviorSummaryParts(classification: ReferenceObjectProperty["classification"]): string[] {
  if (!classification) return [];
  const parts = [behaviorLabel(classification.accessMode), behaviorLabel(classification.behaviorKind)].filter(
    (part): part is string => Boolean(part),
  );
  return parts;
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
    case "mixed":
      return "has mixed behavior";
    case "reject":
      return "rejects";
    case "wrap":
      return "wraps";
    default:
      return "unknown";
  }
}

function appendDistinctSummaryPart(parts: string[], part: string | undefined | null): void {
  if (!part) return;
  const normalized = part.trim().toLowerCase();
  if (parts.some((existing) => existing.trim().toLowerCase() === normalized)) return;
  parts.push(part);
}

function behaviorLabel(value: string | undefined): string | undefined {
  if (value === "computed-status") return "status";
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
