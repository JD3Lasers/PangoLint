import type { ObjectPropertyCard } from "../../../src/knowledge/objectPropertyCards";

export interface RawCommandsFile {
  schemaVersion?: number;
  generatedAt?: string;
  generatedFrom?: string;
  commands: Record<string, RawCommand>;
}

export interface RawCommand {
  canonical: string;
  aliases?: string[];
  description?: string;
  category?: string;
  safetyTier?: string;
  evidenceLevel?: string;
  confidence?: string;
  forms?: RawForm[];
  notes?: Array<RawNote | string>;
  tags?: string[];
  setsProperty?: string[];
}

export interface RawForm {
  signature?: string;
  description?: string;
  parameters?: RawParameter[];
}

interface RawParameter {
  name?: string;
  type?: string;
  required?: boolean;
  range?: string;
  valueRange?: RawValueRange;
  acceptedValues?: RawAcceptedValue[];
  description?: string;
}

interface RawValueRange {
  min?: number;
  max?: number;
  dynamicMax?: RawDynamicBound;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "mixed" | "unknown";
  evidenceLevel?: "documented" | "observed";
  notes?: string;
}

interface RawDynamicBound {
  expression: string;
  sourcePaths?: string[];
  notes?: string;
}

interface RawAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

export interface RawNote {
  text?: string;
  audience?: string | null;
}

export interface RawCoverage {
  summary: {
    total: number;
    mapped: number;
    noDirectProperty: number;
    deferred: number;
    unknown: number;
  };
  commands: Record<string, RawCoverageEntry>;
}

export interface RawCoverageEntry {
  canonical: string;
  status: "mapped" | "no-direct-property" | "deferred" | "unknown";
  setsProperty?: string[];
  notes?: string;
}

export interface RawObjectIndex {
  entries: Array<{
    path: string;
    normalizedPath?: string;
    root: string;
    property: string;
    osc?: string;
    kind: string;
    probeContexts?: RawObjectProbeContext[];
    valueMetadata?: RawObjectValueMetadata;
    readbackMetadata?: RawObjectReadbackMetadata;
    classification?: RawObjectBehaviorClassification;
    contextValueMetadata?: Array<RawObjectValueMetadata & { contextId: string }>;
  }>;
}

export interface RawUniverseComponent {
  id: string;
  label: string;
  componentIndex: number;
  defaultName: string;
  propertyCount: number;
  propertySetId: string;
  addressForms: string[];
  oscAddressForms: string[];
  properties: RawUniverseComponentProperty[];
}

interface RawUniverseComponentProperty {
  path: string;
  leafName: string;
  objectPaths: string[];
  oscPaths: string[];
}

export interface RawObjectProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
  populationDependent?: boolean;
  qfxPanel?: string;
  cellCaption?: string;
  channel?: string;
  notes?: string;
}

export interface RawObjectValueMetadata {
  valueType?: string;
  valueRange?: RawValueRange;
  acceptedValues?: RawAcceptedValue[];
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel?: string;
  notes?: string;
  locationContext?: {
    kind?: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

export interface RawObjectReadbackMetadata {
  readable: true;
  valueType?: string;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: string;
  evidenceLevel?: string;
  observedAt?: string;
  notes?: string;
  locationContext?: {
    kind?: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

export interface RawObjectBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel?: string;
  notes?: string;
}

export type PublicObjectPropertyCard = Omit<ObjectPropertyCard, "classification" | "details"> & {
  classification?: RawObjectBehaviorClassification;
  details?: never;
};

export interface RawKnownProperties {
  schemas: RawSchema[];
}

export interface RawSchema {
  object: string;
  isArray?: boolean;
  propertyCount?: number;
  properties?: string[];
  rootProperties?: string[];
  sharedWithAliases?: string[];
}

export interface RawCategoryTree {
  categories: Array<{ name: string; order: number }>;
}

export interface RawCommandOscRouteLink {
  commandName: string;
  linkKind: string;
  normalizedPropertyPattern?: string;
  route: RawOscRoute;
}

export interface RawObjectPropertyOscRoute {
  propertyPattern: string;
  routeId: string;
  namespace: string;
  pathPattern: string;
  args?: string[];
  routeKind: string;
  evidenceLevel: string;
  supportStatus: string;
  valueTransform?: RawOscValueTransform;
}

interface RawOscRoute {
  routeId?: string;
  id?: string;
  addressSpace?: string;
  namespace: string;
  pathPattern: string;
  args?: string[];
  routeKind: string;
  evidenceLevel: string;
  supportStatus: string;
  targetPropertyPatterns?: string[];
  normalizedTargetPropertyPatterns?: string[];
  valueTransform?: RawOscValueTransform;
  safetyTier?: string;
}

export interface RawOscValueTransform {
  kind: string;
  factor?: number;
  amount?: number;
  offset?: number;
  clamp?: [number, number];
  description?: string;
}

// ── Output types (mirror src/reference/bundle/types.ts) ───────────
export interface OutCommand {
  canonical: string;
  kind: "command" | "function";
  aliases: string[];
  description: string;
  category: string;
  safetyTier: string;
  evidenceLevel?: "documented" | "observed";
  forms: OutForm[];
  notes: string[];
  tags: string[];
  coverage?: {
    status: "mapped" | "no-direct-property" | "deferred" | "unknown";
    setsProperty?: string[];
    notes?: string;
  };
  oscRoutes?: OutOscRoute[];
}

export interface OutForm {
  signature: string;
  description?: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    range?: string;
    valueRange?: RawValueRange;
    acceptedValues?: RawAcceptedValue[];
    description?: string;
  }>;
}

export interface OutObjectProperty {
  path: string;
  root: string;
  property: string;
  osc?: string;
  oscRoutes?: OutOscRoute[];
  kind: string;
  setters: string[];
  probeContexts?: OutObjectProbeContext[];
  valueMetadata?: RawObjectValueMetadata;
  readbackMetadata?: RawObjectReadbackMetadata;
  classification?: RawObjectBehaviorClassification;
  contextValueMetadata?: Array<RawObjectValueMetadata & { contextId: string }>;
  propertyCard?: PublicObjectPropertyCard;
}

export interface OutObjectProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
}

export interface OutObject {
  name: string;
  isArray: boolean;
  propertyCount: number;
  properties: OutObjectProperty[];
}

export interface OutUniverseComponent {
  id: string;
  label: string;
  componentIndex: number;
  defaultName: string;
  propertyCount: number;
  propertySetId: string;
  addressForms: string[];
  oscAddressForms: string[];
  properties: RawUniverseComponentProperty[];
}

export interface OutCatalog {
  meta: {
    generatedAt: string;
    version: string;
    catalogBuild?: string;
    total: number;
    categories: Array<{ name: string; count: number; order: number }>;
    coverage: RawCoverage["summary"];
  };
  commands: OutCommand[];
  objects: OutObject[];
  universeComponents: OutUniverseComponent[];
}

export interface OutOscRoute {
  id: string;
  pathPattern: string;
  args: string[];
  namespace: string;
  targetPropertyPatterns?: string[];
  normalizedTargetPropertyPatterns?: string[];
  valueTransform?: RawOscValueTransform;
}
