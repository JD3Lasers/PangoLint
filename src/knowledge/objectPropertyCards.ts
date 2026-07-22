import type {
  ObjectPropertyBehaviorClassification,
  ObjectPropertyEntry,
  ObjectPropertyProbeContext,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
  ObjectPropertyVariant,
} from "./objectPropertyIndex";

export const OBJECT_PROPERTY_DETAIL_LIMITS = {
  defaultVariantLimit: 3,
  maxVariantLimit: 10,
  defaultProbeContextLimit: 3,
  maxProbeContextLimit: 8,
  defaultContextValueLimit: 3,
  maxContextValueLimit: 8,
  defaultPageLimit: 25,
  maxPageLimit: 100,
} as const;

export interface ObjectPropertyDetailInput {
  includeDetails?: boolean;
  variantLimit?: number;
  probeContextLimit?: number;
  contextValueLimit?: number;
}

export interface ResolvedObjectPropertyDetailOptions {
  includeDetails: boolean;
  variantLimit: number;
  probeContextLimit: number;
  contextValueLimit: number;
}

interface ObjectPropertyValueSummary {
  valueType?: string;
  range?: {
    min?: number;
    max?: number;
    dynamicMaxExpression?: string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
    unit?: string;
    boundaryBehavior?: string;
    evidenceLevel?: string;
  };
  acceptedValueCount?: number;
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel?: string;
  locationKind?: string;
  contextValueMetadataCount?: number;
}

interface ObjectPropertyReadbackSummary {
  status: string;
  accessMechanism?: string;
  probePath?: string;
  valueType?: string;
  typeTag?: string;
  evidenceLevel?: string;
  observedValue?: string | number | boolean | null;
  locationKind?: string;
}

export interface ObjectPropertyCard {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: string;
  osc?: string;
  confidence: string;
  variantCount: number;
  valueSummary?: ObjectPropertyValueSummary;
  readbackSummary?: ObjectPropertyReadbackSummary;
  classification?: ObjectPropertyBehaviorClassification;
  detailAvailable: {
    variants: number;
    probeContexts: number;
    contextValueMetadata: number;
  };
  details?: {
    variants?: ObjectPropertyVariant[];
    probeContexts?: ObjectPropertyProbeContext[];
    contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
    valueMetadata?: ObjectPropertyValueMetadata;
    readbackMetadata?: ObjectPropertyReadbackMetadata;
    limits: {
      variantLimit: number;
      probeContextLimit: number;
      contextValueLimit: number;
    };
    omitted: {
      variants: number;
      probeContexts: number;
      contextValueMetadata: number;
    };
  };
}

export interface PageResult<T> {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  nextOffset?: number;
}

export function buildObjectPropertyCard(
  entry: ObjectPropertyEntry,
  detailInput: ObjectPropertyDetailInput = {},
): ObjectPropertyCard {
  const detailOptions = resolveObjectPropertyDetailOptions(detailInput);
  const probeContexts = entry.probeContexts ?? [];
  const contextValueMetadata = entry.contextValueMetadata ?? [];
  const card: ObjectPropertyCard = {
    path: entry.path,
    normalizedPath: entry.normalizedPath,
    root: entry.root,
    property: entry.property,
    kind: entry.kind,
    osc: entry.osc,
    confidence: entry.confidence,
    variantCount: entry.variantCount,
    valueSummary: summarizeValueMetadata(entry.valueMetadata, contextValueMetadata),
    readbackSummary: summarizeReadbackMetadata(entry.readbackMetadata, entry.classification),
    classification: entry.classification,
    detailAvailable: {
      variants: entry.variants?.length ?? 0,
      probeContexts: probeContexts.length,
      contextValueMetadata: contextValueMetadata.length,
    },
  };

  if (!detailOptions.includeDetails) return card;

  const variants = (entry.variants ?? []).slice(0, detailOptions.variantLimit);
  const probeContextItems = probeContexts.slice(0, detailOptions.probeContextLimit);
  const contextValueItems = contextValueMetadata.slice(0, detailOptions.contextValueLimit);
  card.details = {
    ...(variants.length > 0 ? { variants } : {}),
    ...(probeContextItems.length > 0 ? { probeContexts: probeContextItems } : {}),
    ...(contextValueItems.length > 0 ? { contextValueMetadata: contextValueItems } : {}),
    ...(entry.valueMetadata ? { valueMetadata: entry.valueMetadata } : {}),
    ...(entry.readbackMetadata ? { readbackMetadata: entry.readbackMetadata } : {}),
    limits: {
      variantLimit: detailOptions.variantLimit,
      probeContextLimit: detailOptions.probeContextLimit,
      contextValueLimit: detailOptions.contextValueLimit,
    },
    omitted: {
      variants: Math.max(0, (entry.variants?.length ?? 0) - variants.length),
      probeContexts: Math.max(0, probeContexts.length - probeContextItems.length),
      contextValueMetadata: Math.max(0, contextValueMetadata.length - contextValueItems.length),
    },
  };
  return card;
}

export function resolveObjectPropertyDetailOptions(
  input: ObjectPropertyDetailInput = {},
): ResolvedObjectPropertyDetailOptions {
  return {
    includeDetails: input.includeDetails === true,
    variantLimit: resolveLimit(
      input.variantLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.defaultVariantLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.maxVariantLimit,
    ),
    probeContextLimit: resolveLimit(
      input.probeContextLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.defaultProbeContextLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.maxProbeContextLimit,
    ),
    contextValueLimit: resolveLimit(
      input.contextValueLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.defaultContextValueLimit,
      OBJECT_PROPERTY_DETAIL_LIMITS.maxContextValueLimit,
    ),
  };
}

export function pageItems<T>(items: T[], rawOffset: number | undefined, rawLimit: number | undefined): PageResult<T> {
  const offset = resolveOffset(rawOffset);
  const limit = resolveLimit(
    rawLimit,
    OBJECT_PROPERTY_DETAIL_LIMITS.defaultPageLimit,
    OBJECT_PROPERTY_DETAIL_LIMITS.maxPageLimit,
  );
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length < items.length ? offset + page.length : undefined;
  return {
    items: page,
    offset,
    limit,
    total: items.length,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
  };
}

function summarizeValueMetadata(
  metadata: ObjectPropertyValueMetadata | undefined,
  contextValueMetadata: Array<ObjectPropertyValueMetadata & { contextId: string }>,
): ObjectPropertyValueSummary | undefined {
  if (!metadata && contextValueMetadata.length === 0) return undefined;
  const summaryMetadata = metadata ?? commonContextValueMetadata(contextValueMetadata);
  const range = summaryMetadata?.valueRange;
  return {
    valueType: summaryMetadata?.valueType,
    ...(range
      ? {
          range: {
            min: range.min,
            max: range.max,
            dynamicMaxExpression: range.dynamicMax?.expression,
            minInclusive: range.minInclusive,
            maxInclusive: range.maxInclusive,
            unit: range.unit,
            boundaryBehavior: range.boundaryBehavior,
            evidenceLevel: range.evidenceLevel,
          },
        }
      : {}),
    acceptedValueCount: summaryMetadata?.acceptedValues?.length,
    unit: summaryMetadata?.unit,
    defaultValue: summaryMetadata?.defaultValue,
    evidenceLevel: summaryMetadata?.evidenceLevel,
    locationKind: summaryMetadata?.locationContext?.kind,
    contextValueMetadataCount: contextValueMetadata.length || undefined,
  };
}

function commonContextValueMetadata(
  contextValueMetadata: Array<ObjectPropertyValueMetadata & { contextId: string }>,
): Partial<ObjectPropertyValueMetadata> | undefined {
  const [first] = contextValueMetadata;
  if (!first) return undefined;
  return {
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => metadata.valueType)
      ? { valueType: first.valueType }
      : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => valueRangeKey(metadata.valueRange))
      ? { valueRange: first.valueRange }
      : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => acceptedValuesKey(metadata.acceptedValues))
      ? { acceptedValues: first.acceptedValues }
      : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => metadata.unit) ? { unit: first.unit } : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => metadata.defaultValue)
      ? { defaultValue: first.defaultValue }
      : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => metadata.evidenceLevel)
      ? { evidenceLevel: first.evidenceLevel }
      : {}),
    ...(allContextValuesMatch(contextValueMetadata, (metadata) => metadata.locationContext?.kind)
      ? { locationContext: first.locationContext }
      : {}),
  };
}

function allContextValuesMatch<T>(
  contextValueMetadata: Array<ObjectPropertyValueMetadata & { contextId: string }>,
  readValue: (metadata: ObjectPropertyValueMetadata) => T,
): boolean {
  const [first] = contextValueMetadata;
  if (!first) return false;
  const expected = readValue(first);
  return contextValueMetadata.every((metadata) => readValue(metadata) === expected);
}

function valueRangeKey(range: ObjectPropertyValueMetadata["valueRange"]): string | undefined {
  if (!range) return undefined;
  return JSON.stringify({
    min: range.min,
    max: range.max,
    dynamicMaxExpression: range.dynamicMax?.expression,
    minInclusive: range.minInclusive,
    maxInclusive: range.maxInclusive,
    unit: range.unit,
    boundaryBehavior: range.boundaryBehavior,
    evidenceLevel: range.evidenceLevel,
  });
}

function acceptedValuesKey(values: ObjectPropertyValueMetadata["acceptedValues"]): string | undefined {
  if (!values) return undefined;
  return JSON.stringify(values.map((value) => ({ value: value.value, label: value.label })));
}

function summarizeReadbackMetadata(
  metadata: ObjectPropertyReadbackMetadata | undefined,
  classification: ObjectPropertyBehaviorClassification | undefined,
): ObjectPropertyReadbackSummary | undefined {
  if (metadata) {
    return {
      status: "readable",
      accessMechanism: metadata.accessMechanism,
      probePath: metadata.probePath,
      valueType: metadata.valueType,
      typeTag: metadata.typeTag,
      evidenceLevel: metadata.evidenceLevel,
      observedValue: metadata.observedValue,
      locationKind: metadata.locationContext?.kind,
    };
  }

  if (!classification) return undefined;
  return {
    status: classification.readbackStatus,
    evidenceLevel: classification.evidenceLevel,
  };
}

function resolveLimit(raw: number | undefined, fallback: number, max: number): number {
  if (raw === undefined || !Number.isFinite(raw)) return fallback;
  if (raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

function resolveOffset(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}
