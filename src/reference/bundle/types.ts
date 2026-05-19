// Renderer types for the standalone PangoScript reference page.
//
// These shapes mirror the public-safe subset of the bundled catalog data
// that scripts/buildReferenceSite.ts inlines into the page. The build
// script is the contract: any field present here MUST be emitted into
// the inlined catalog JSON, and vice versa. The build script trims
// maintainer-only fields (confidence, source IDs, inferred / unverified
// evidence) before serialising so the renderer can assume what it sees
// is end-user-safe.

export type Kind = "command" | "function";

export type SidebarSafetyTier = "T0" | "T1" | "T2" | "T3" | "T4" | "unknown";
export type PublicEvidenceLevel = "documented" | "observed";
export type CoverageStatus = "mapped" | "no-direct-property" | "deferred" | "unknown";

export interface ReferenceParameter {
  name: string;
  type: string;
  required: boolean;
  range?: string;
  valueRange?: ReferenceValueRange;
  acceptedValues?: ReferenceAcceptedValue[];
  description?: string;
}

export type ReferenceBoundaryBehavior = "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";

export interface ReferenceValueRange {
  min?: number;
  max?: number;
  dynamicMax?: ReferenceDynamicBound;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: ReferenceBoundaryBehavior;
  evidenceLevel?: PublicEvidenceLevel;
  notes?: string;
}

export interface ReferenceDynamicBound {
  expression: string;
  sourcePaths?: string[];
  notes?: string;
}

export interface ReferenceAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

export interface ReferenceObjectLocationContext {
  kind?: string;
  populationDependent?: boolean;
  indexBasis?: string;
  notes?: string;
}

export interface ReferenceObjectValueMetadata {
  valueType?: string;
  valueRange?: ReferenceValueRange;
  acceptedValues?: ReferenceAcceptedValue[];
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel?: PublicEvidenceLevel;
  notes?: string;
  locationContext?: ReferenceObjectLocationContext;
}

export interface ReferenceObjectReadbackMetadata {
  readable: true;
  valueType?: string;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: string;
  evidenceLevel?: PublicEvidenceLevel;
  observedAt?: string;
  notes?: string;
  locationContext?: ReferenceObjectLocationContext;
}

export interface ReferenceObjectBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel?: PublicEvidenceLevel;
}

export interface ReferenceObjectProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
}

export interface ReferenceForm {
  signature: string;
  description?: string;
  parameters: ReferenceParameter[];
}

export interface ReferenceCoverage {
  status: CoverageStatus;
  setsProperty?: string[];
  notes?: string;
}

export interface ReferenceOscValueTransform {
  kind: string;
  factor?: number;
  amount?: number;
  offset?: number;
  clamp?: [number, number];
}

export interface ReferenceOscRoute {
  id: string;
  pathPattern: string;
  args: string[];
  namespace: string;
  targetPropertyPatterns?: string[];
  normalizedTargetPropertyPatterns?: string[];
  valueTransform?: ReferenceOscValueTransform;
}

export interface ReferenceCommand {
  canonical: string;
  kind: Kind;
  aliases: string[];
  description: string;
  category: string;
  safetyTier: SidebarSafetyTier;
  evidenceLevel?: PublicEvidenceLevel;
  forms: ReferenceForm[];
  notes: string[];
  tags: string[];
  coverage?: ReferenceCoverage;
  oscRoutes?: ReferenceOscRoute[];
}

export interface ReferenceCategory {
  name: string;
  count: number;
  /** Tree order from BEYOND's category tree; lower sorts earlier. */
  order: number;
}

export interface ReferenceCoverageSummary {
  total: number;
  mapped: number;
  noDirectProperty: number;
  deferred: number;
  unknown: number;
}

export interface ReferenceMeta {
  /** ISO timestamp written at build time. */
  generatedAt: string;
  /** Extension version that produced the page. */
  version: string;
  /** Knowledge-base build identifier (BEYOND export build number). */
  catalogBuild?: string;
  /** Total browsable items (commands + functions) — pre-computed. */
  total: number;
  /** Per-category command counts, sorted by BEYOND tree order. */
  categories: ReferenceCategory[];
  /** Coverage breakdown for the data-quality panel. */
  coverage: ReferenceCoverageSummary;
}

/** OSC-mapping summary, keyed by canonical PangoScript path. */
export interface ReferenceObjectProperty {
  path: string;
  root: string;
  property: string;
  osc?: string;
  oscRoutes?: ReferenceOscRoute[];
  kind: string;
  /** Reverse lookup: which commands set this property. Empty if none. */
  setters: string[];
  probeContexts?: ReferenceObjectProbeContext[];
  valueMetadata?: ReferenceObjectValueMetadata;
  readbackMetadata?: ReferenceObjectReadbackMetadata;
  classification?: ReferenceObjectBehaviorClassification;
  contextValueMetadata?: Array<ReferenceObjectValueMetadata & { contextId: string }>;
  propertyCard?: ReferenceObjectPropertyCard;
}

export interface ReferenceObjectPropertyCard {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: string;
  osc?: string;
  confidence: string;
  variantCount: number;
  valueSummary?: ReferenceObjectValueSummary;
  readbackSummary?: ReferenceObjectReadbackSummary;
  classification?: ReferenceObjectBehaviorClassification;
  detailAvailable: {
    variants: number;
    probeContexts: number;
    contextValueMetadata: number;
  };
}

export interface ReferenceObjectValueSummary {
  valueType?: string;
  range?: {
    min?: number;
    max?: number;
    dynamicMaxExpression?: string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
    unit?: string;
    boundaryBehavior?: ReferenceBoundaryBehavior;
    evidenceLevel?: string;
  };
  acceptedValueCount?: number;
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel?: string;
  locationKind?: string;
  contextValueMetadataCount?: number;
}

export interface ReferenceObjectReadbackSummary {
  status: string;
  probePath?: string;
  valueType?: string;
  typeTag?: string;
  evidenceLevel?: string;
  observedValue?: string | number | boolean | null;
  locationKind?: string;
}

export interface ReferenceObject {
  name: string;
  /** Inherits-from name, if applicable. */
  inheritsFrom?: string;
  isArray: boolean;
  arrayIndices?: string[];
  propertyCount: number;
  properties: ReferenceObjectProperty[];
}

export interface ReferenceCatalog {
  meta: ReferenceMeta;
  commands: ReferenceCommand[];
  /** Object schemas, keyed by name. */
  objects: ReferenceObject[];
}
