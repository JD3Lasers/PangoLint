// Loads the bundled BEYOND object-property search index
// (data/pangoscript/object-tree/runtime-indexes/object-property-index.json) and exposes exact lookup plus
// ranked search helpers for agent-facing discovery.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BUNDLED_PANGOSCRIPT_DATA_PATHS, bundledDataPathSegments } from "./bundledDataPaths";

export type ObjectPropertyKind = "object" | "fx";
export type ObjectPropertyConfidence = "observed" | "inferred" | "unverified";
export type ObjectPropertyValueType = "number" | "integer" | "float" | "string" | "boolean" | "enum" | "unknown";
export type ObjectPropertyBoundaryBehavior = "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";
export type ObjectPropertyValueEvidence = "documented" | "observed" | "inferred" | "unverified";
export type ObjectPropertyProbeContextKind = "cue-type" | "cue-shape" | "quickfx-cell" | "quickfx-effect";
export type ObjectPropertyLocationKind =
  | "indexed-root"
  | "workspace-slot"
  | "quickfx-slot"
  | "showfile-alias"
  | "hardware-instance";
export type ObjectPropertyAccessMode = "read-write" | "read-only" | "write-only" | "read-mostly" | "unknown";
export type ObjectPropertyBehaviorKind =
  | "state-value"
  | "flag-state"
  | "momentary-action"
  | "enum-state"
  | "string-state"
  | "computed-status"
  | "alias-status"
  | "fixture-dependent"
  | "unknown";
export type ObjectPropertyWriteTestStatus =
  | "not-tested"
  | "write-readback-tested"
  | "command-readback-tested"
  | "write-no-op-tested"
  | "write-rejected-tested"
  | "documented-writable"
  | "documented-read-only"
  | "not-applicable";
export type ObjectPropertyReadbackStatus =
  | "not-tested"
  | "readback-tested"
  | "readback-not-available"
  | "documented-readable"
  | "not-applicable";
export type ObjectPropertyBehaviorEvidence = "documented" | "observed" | "inferred" | "unverified";

export interface ObjectPropertyValueRange {
  min?: number;
  max?: number;
  dynamicMax?: ObjectPropertyDynamicBound;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: ObjectPropertyBoundaryBehavior;
  evidenceLevel?: ObjectPropertyValueEvidence;
  notes?: string;
}

export interface ObjectPropertyDynamicBound {
  expression: string;
  sourcePaths?: string[];
  notes?: string;
}

export interface ObjectPropertyAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

export interface ObjectPropertyLocationContext {
  kind: ObjectPropertyLocationKind;
  populationDependent?: boolean;
  indexBasis?: string;
  notes?: string;
}

export interface ObjectPropertyProbeContext {
  id: string;
  kind: ObjectPropertyProbeContextKind;
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

export interface ObjectPropertyValueMetadata {
  valueType?: ObjectPropertyValueType;
  valueRange?: ObjectPropertyValueRange;
  acceptedValues?: ObjectPropertyAcceptedValue[];
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel: ObjectPropertyValueEvidence;
  notes?: string;
  locationContext?: ObjectPropertyLocationContext;
}

export interface ObjectPropertyReadbackMetadata {
  readable: true;
  valueType?: ObjectPropertyValueType;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: "f" | "i" | "s";
  evidenceLevel: ObjectPropertyValueEvidence;
  observedAt?: string;
  notes?: string;
  locationContext?: ObjectPropertyLocationContext;
}

export interface ObjectPropertyBehaviorClassification {
  accessMode: ObjectPropertyAccessMode;
  behaviorKind: ObjectPropertyBehaviorKind;
  writeTestStatus: ObjectPropertyWriteTestStatus;
  readbackStatus: ObjectPropertyReadbackStatus;
  evidenceLevel: ObjectPropertyBehaviorEvidence;
  notes?: string;
}

export interface ObjectPropertyVariant {
  /** Concrete observed path, or a representative alias path for showfile-specific roots. */
  path: string;
  /** OSC address corresponding to the concrete path, when known and not showfile-specific. */
  osc?: string;
  /** Optional QuickFX label metadata for this variant. */
  fx?: ObjectPropertyFxMetadata;
}

export interface ObjectPropertyFxMetadata {
  qfxPanel?: string;
  cellCaption?: string;
  label?: string;
  channel?: string;
}

export type ObjectPropertyAddressMode = "user-configured-name";

export interface ObjectPropertyAddressMetadata {
  mode: ObjectPropertyAddressMode;
  placeholder: string;
  aliasOf: string;
  userConfigured: boolean;
  componentPlaceholder?: string;
}

export interface ObjectPropertyEntry {
  /** Normalized path for indexed families, exact path for scalar properties. */
  path: string;
  /** Numeric path segments collapsed to N, e.g. FX.N.N.N.Oscillator.Period. */
  normalizedPath: string;
  /** Root object, e.g. Master, Zone, FX. */
  root: string;
  /** Property path below the root, e.g. ShowSpeed or Oscillator.Period. */
  property: string;
  /** Object-tree family. FX paths are separated because labels are user-configured. */
  kind: ObjectPropertyKind;
  /** Evidence level for the path's existence in BEYOND Object Tree source data. */
  confidence: ObjectPropertyConfidence;
  /** OSC address for scalar entries or the first concrete variant. */
  osc?: string;
  /** Lower-cased terms used by agent search. */
  searchText: string;
  /** Number of observed path instances collapsed into this entry. */
  variantCount: number;
  /** Concrete observed paths or generic representative paths for alias entries. */
  variants: ObjectPropertyVariant[];
  /** Optional QuickFX label metadata. */
  fx?: ObjectPropertyFxMetadata;
  /** Metadata for roots that stand in for user-configured Object Tree names. */
  addressMetadata?: ObjectPropertyAddressMetadata;
  /** Sample locations that can be used when probing a normalized, location-aware path. */
  probeContexts?: ObjectPropertyProbeContext[];
  /** Optional curated value/range metadata, separate from path-existence confidence. */
  valueMetadata?: ObjectPropertyValueMetadata;
  /** Optional readback metadata for lookup-only paths without verified writable ranges. */
  readbackMetadata?: ObjectPropertyReadbackMetadata;
  /** Optional value/range metadata that applies only in a specific probe context. */
  contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
  /** Optional access and behavior classification, separate from value and readback evidence. */
  classification?: ObjectPropertyBehaviorClassification;
}

export interface ObjectPropertyIndexFile {
  schemaVersion: number;
  generatedAt?: string;
  generatedFrom?: string;
  entries: ObjectPropertyEntry[];
}

export interface ObjectPropertySearchInput {
  query: string;
  root?: string;
  kind?: ObjectPropertyKind;
  limit?: number;
}

export interface ObjectPropertySearchHit {
  entry: ObjectPropertyEntry;
  score: number;
  matchedTerms: string[];
}

export interface ObjectPropertyLookupResult {
  entry: ObjectPropertyEntry;
  matchedVariant?: ObjectPropertyVariant;
}

export interface ObjectPropertyIndexLoadResult {
  index: ObjectPropertyIndex;
  source: "bundled" | "empty";
  error?: string;
}

export interface ObjectPropertyIndex {
  lookup(pathOrNormalizedPath: string): ObjectPropertyLookupResult | undefined;
  search(input: ObjectPropertySearchInput): ObjectPropertySearchHit[];
  entriesForRoot(root: string): ObjectPropertyEntry[];
  allEntries(): ObjectPropertyEntry[];
  size(): number;
}

const EMPTY: ObjectPropertyIndexFile = {
  schemaVersion: 1,
  entries: [],
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export function buildObjectPropertyIndex(file: ObjectPropertyIndexFile): ObjectPropertyIndex {
  const entries = [...file.entries];
  const byPath = new Map<string, ObjectPropertyLookupResult>();
  const byNormalizedPath = new Map<string, ObjectPropertyLookupResult>();
  const byRoot = new Map<string, ObjectPropertyEntry[]>();

  for (const entry of entries) {
    const normalizedResult: ObjectPropertyLookupResult = { entry };
    byPath.set(entry.path.toLowerCase(), normalizedResult);
    byNormalizedPath.set(entry.normalizedPath.toLowerCase(), normalizedResult);
    const rootKey = entry.root.toLowerCase();
    const rootEntries = byRoot.get(rootKey);
    if (rootEntries) {
      rootEntries.push(entry);
    } else {
      byRoot.set(rootKey, [entry]);
    }

    for (const variant of entry.variants ?? []) {
      byPath.set(variant.path.toLowerCase(), { entry, matchedVariant: variant });
    }
  }

  return {
    lookup: (pathOrNormalizedPath: string) => {
      const query = pathOrNormalizedPath.trim();
      if (!query) return undefined;
      const lower = query.toLowerCase();
      const canonicalQuery = canonicalizeObjectPropertyHardwareRootPath(query);
      const canonicalLower = canonicalQuery.toLowerCase();
      const direct =
        byPath.get(lower) ??
        byNormalizedPath.get(normalizeObjectPropertyPath(query).toLowerCase()) ??
        byPath.get(canonicalLower) ??
        byNormalizedPath.get(normalizeObjectPropertyPath(canonicalQuery).toLowerCase());
      if (direct) return direct;
      const root = canonicalQuery.split(".", 1)[0]?.toLowerCase();
      if (!root) return undefined;
      for (const entry of byRoot.get(root) ?? []) {
        if (objectPropertyPathMatchesShape(canonicalQuery, entry.normalizedPath)) return { entry };
      }
      return undefined;
    },
    search: (input: ObjectPropertySearchInput) => searchEntries(input, entries),
    entriesForRoot: (root: string) => [
      ...(byRoot.get(canonicalizeObjectPropertyHardwareRoot(root.trim()).toLowerCase()) ?? []),
    ],
    allEntries: () => [...entries],
    size: () => entries.length,
  };
}

export function loadBundledObjectPropertyIndex(extensionPath: string): ObjectPropertyIndexLoadResult {
  const filePath = path.join(
    extensionPath,
    ...bundledDataPathSegments(BUNDLED_PANGOSCRIPT_DATA_PATHS.objectPropertyIndex),
  );
  if (!existsSync(filePath)) {
    return {
      index: buildObjectPropertyIndex(EMPTY),
      source: "empty",
      error: "object-property-index.json not found in bundled extension data.",
    };
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyIndexFile;
    if (!Array.isArray(raw.entries)) {
      return {
        index: buildObjectPropertyIndex(EMPTY),
        source: "empty",
        error: "object-property-index.json is malformed (missing entries array).",
      };
    }
    return { index: buildObjectPropertyIndex(raw), source: "bundled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      index: buildObjectPropertyIndex(EMPTY),
      source: "empty",
      error: `Failed to parse object-property-index.json (${message}).`,
    };
  }
}

export function normalizeObjectPropertyPath(rawPath: string): string {
  return rawPath
    .split(".")
    .filter(Boolean)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return "N";
      if (/^#\d+$/.test(segment)) return "#N";
      return segment;
    })
    .join(".");
}

export function objectPropertyShapeForPath(rawPath: string, shapePath: string): string | undefined {
  const rawSegments = splitObjectPropertyPath(rawPath);
  const shapeSegments = splitObjectPropertyPath(shapePath);
  if (rawSegments.length !== shapeSegments.length) return undefined;
  const out: string[] = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    const shape = shapeSegments[index];
    if (shape === "N") {
      if (!/^\d+$/.test(segment)) return undefined;
      out.push("N");
      continue;
    }
    if (shape === "#N") {
      if (!/^#\d+$/.test(segment)) return undefined;
      out.push("#N");
      continue;
    }
    out.push(segment);
  }
  return out.join(".");
}

export function objectPropertyPathMatchesShape(rawPath: string, shapePath: string): boolean {
  const shaped = objectPropertyShapeForPath(rawPath, shapePath);
  return shaped?.toLowerCase() === shapePath.toLowerCase();
}

export function concretizeObjectPropertyShape(shapePath: string, rawPath: string): string | undefined {
  const shapeSegments = splitObjectPropertyPath(shapePath);
  const rawSegments = splitObjectPropertyPath(rawPath);
  if (shapeSegments.length !== rawSegments.length) return undefined;
  const out: string[] = [];
  for (let index = 0; index < shapeSegments.length; index += 1) {
    const segment = shapeSegments[index];
    const rawSegment = rawSegments[index];
    if (segment === "N") {
      if (!/^\d+$/.test(rawSegment)) return undefined;
      out.push(rawSegment);
      continue;
    }
    if (segment === "#N") {
      if (!/^#\d+$/.test(rawSegment)) return undefined;
      out.push(rawSegment);
      continue;
    }
    out.push(segment);
  }
  return out.join(".");
}

function splitObjectPropertyPath(pathValue: string): string[] {
  return pathValue.split(".").filter(Boolean);
}

export function canonicalizeObjectPropertyHardwareRootPath(rawPath: string): string {
  const segments = splitObjectPropertyPath(rawPath);
  if (segments.length === 0) return rawPath;
  segments[0] = canonicalizeObjectPropertyHardwareRoot(segments[0]);
  return segments.join(".");
}

export function canonicalizeObjectPropertyHardwareRoot(root: string): string {
  const match = /^FB([34])[-_][^.]+$/i.exec(root);
  if (!match) return root;
  return `FB${match[1]}_XXXXX`;
}

function searchEntries(input: ObjectPropertySearchInput, entries: ObjectPropertyEntry[]): ObjectPropertySearchHit[] {
  const query = input.query?.trim();
  if (!query) return [];

  const limit = clampLimit(input.limit);
  const rootFilter = input.root ? canonicalizeObjectPropertyHardwareRoot(input.root.trim()).toLowerCase() : undefined;
  const kindFilter = input.kind;
  const terms = tokenize(query);
  const queryLower = query.toLowerCase();

  const hits: ObjectPropertySearchHit[] = [];
  for (const entry of entries) {
    if (rootFilter && entry.root.toLowerCase() !== rootFilter) continue;
    if (kindFilter && entry.kind !== kindFilter) continue;

    const haystack = entry.searchText || buildSearchText(entry);
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    const score = scoreEntry(entry, haystack, queryLower, matchedTerms);
    if (score <= 0) continue;
    hits.push({ entry, score, matchedTerms });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.root.localeCompare(b.entry.root) ||
      a.entry.property.localeCompare(b.entry.property) ||
      a.entry.path.localeCompare(b.entry.path),
  );
  return hits.slice(0, limit);
}

function scoreEntry(entry: ObjectPropertyEntry, haystack: string, queryLower: string, matchedTerms: string[]): number {
  let score = 0;
  const pathLower = entry.path.toLowerCase();
  const normalizedLower = entry.normalizedPath.toLowerCase();
  const propertyLower = entry.property.toLowerCase();

  if (pathLower === queryLower || normalizedLower === queryLower) score += 200;
  if (propertyLower === queryLower) score += 120;
  if (pathLower.includes(queryLower) || normalizedLower.includes(queryLower)) score += 80;
  if (haystack.includes(queryLower)) score += 50;
  score += matchedTerms.length * 20;
  if (entry.kind === "object") score += 2;
  return score;
}

function buildSearchText(entry: ObjectPropertyEntry): string {
  return [
    entry.path,
    entry.normalizedPath,
    entry.root,
    entry.property,
    entry.osc,
    entry.fx?.label,
    entry.fx?.channel,
    entry.fx?.cellCaption,
    entry.addressMetadata?.mode,
    entry.addressMetadata?.placeholder,
    entry.addressMetadata?.aliasOf,
    entry.addressMetadata?.componentPlaceholder,
    entry.readbackMetadata?.valueType,
    entry.readbackMetadata?.probePath,
    entry.readbackMetadata?.probeMode,
    entry.readbackMetadata?.typeTag,
    entry.readbackMetadata?.evidenceLevel,
    entry.readbackMetadata?.notes,
    entry.readbackMetadata?.locationContext?.kind,
    entry.readbackMetadata?.locationContext?.indexBasis,
    entry.readbackMetadata?.locationContext?.notes,
    ...(entry.probeContexts ?? []).flatMap((context) => [
      context.id,
      context.kind,
      context.label,
      context.parentLabel,
      context.normalizedPrefix,
      context.probePrefix,
      context.probeOscPrefix,
      context.qfxPanel,
      context.cellCaption,
      context.channel,
      context.notes,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}
