import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BUNDLED_PANGOSCRIPT_DATA_PATHS, bundledDataPathSegments } from "./bundledDataPaths";
import {
  canonicalizeObjectPropertyHardwareRoot,
  canonicalizeObjectPropertyHardwareRootPath,
  normalizeObjectPropertyPath,
  type ObjectPropertyBehaviorClassification,
  objectPropertyPathMatchesShape,
} from "./objectPropertyIndex";

export interface McpPropertyControlCommand {
  commandName: string;
  label?: string;
  category?: string;
  coverageStatus?: string;
  evidenceLevel?: string;
  safetyTier?: string;
}

export interface McpPropertyControlParameterRange {
  commandName: string;
  formSignature?: string;
  parameterName?: string;
  parameterType?: string;
  range?: string;
  valueRange?: {
    min?: number;
    max?: number;
    unit?: string;
    boundaryBehavior?: string;
    evidenceLevel?: string;
  };
}

export interface McpPropertyControlOscRoute {
  routeId: string;
  namespace?: string;
  pathPattern?: string;
  args?: string[];
  routeKind?: string;
  evidenceLevel?: string;
  supportStatus?: string;
  safetyTier?: string;
  valueTransform?: {
    kind?: string;
    offset?: number;
  };
}

export interface McpPropertyControlObjectContext {
  domain?: string;
  kind?: string;
  label?: string;
  propertyPath?: string;
  objectPaths?: string[];
  oscPaths?: string[];
}

export interface McpPropertyControlEntry {
  path: string;
  label: string;
  root: string;
  property: string;
  kind: "object" | "fx";
  confidence?: string;
  coverage: Record<string, boolean>;
  objectTree: {
    path?: string;
    normalizedPath?: string;
    directBusPath?: string;
    variantCount?: number;
    contextCount: number;
    contexts: McpPropertyControlObjectContext[];
    objectBusPathCount: number;
    objectBusPaths: string[];
  };
  value?: {
    valueType?: string;
    range?: {
      min?: number;
      max?: number;
      dynamicMaxExpression?: string;
      unit?: string;
      boundaryBehavior?: string;
      evidenceLevel?: string;
    };
    evidenceLevel?: string;
    locationKind?: string;
  };
  readback?: {
    status: string;
    probePath?: string;
    valueType?: string;
    typeTag?: string;
    evidenceLevel?: string;
    observedValue?: string | number | boolean | null;
    locationKind?: string;
  };
  behavior?: ObjectPropertyBehaviorClassification;
  pangoScript: {
    commandCount: number;
    commands: McpPropertyControlCommand[];
    parameterRangeCount: number;
    parameterRanges: McpPropertyControlParameterRange[];
  };
  osc: {
    routeCount: number;
    routes: McpPropertyControlOscRoute[];
  };
  detailAvailable: {
    objectContexts: number;
    objectBusPaths: number;
    commands: number;
    oscRoutes: number;
    parameterRanges: number;
  };
}

export interface McpControlReferenceFile {
  schemaVersion: number;
  generatedBy?: string;
  generatedFrom?: string[];
  responseLimits?: {
    defaultExampleLimit?: number;
    maxExampleLimit?: number;
    defaultSearchLimit?: number;
    maxSearchLimit?: number;
  };
  entries: McpPropertyControlEntry[];
}

interface PropertyControlSearchInput {
  query: string;
  root?: string;
  kind?: "object" | "fx";
  limit?: number;
}

interface PropertyControlSearchHit {
  entry: McpPropertyControlEntry;
  score: number;
  matchedTerms: string[];
}

export interface McpControlReferenceLoadResult {
  index: McpPropertyControlIndex;
  source: "bundled" | "empty";
  error?: string;
}

export interface McpPropertyControlIndex {
  lookup(pathOrNormalizedPath: string): McpPropertyControlEntry | undefined;
  search(input: PropertyControlSearchInput): PropertyControlSearchHit[];
  allEntries(): McpPropertyControlEntry[];
  size(): number;
}

const EMPTY: McpControlReferenceFile = {
  schemaVersion: 1,
  entries: [],
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export function buildMcpPropertyControlIndex(file: McpControlReferenceFile): McpPropertyControlIndex {
  const entries = [...file.entries];
  const byPath = new Map<string, McpPropertyControlEntry>();
  const byRoot = new Map<string, McpPropertyControlEntry[]>();

  for (const entry of entries) {
    byPath.set(entry.path.toLowerCase(), entry);
    const rootKey = entry.root.toLowerCase();
    const rootEntries = byRoot.get(rootKey);
    if (rootEntries) {
      rootEntries.push(entry);
    } else {
      byRoot.set(rootKey, [entry]);
    }
  }

  return {
    lookup: (pathOrNormalizedPath: string) => {
      const query = pathOrNormalizedPath.trim();
      if (!query) return undefined;
      const controlPath = normalizeControlLookupPath(query);
      const direct = byPath.get(query.toLowerCase()) ?? byPath.get(controlPath.toLowerCase());
      if (direct) return direct;

      const root = controlPath.split(".", 1)[0]?.toLowerCase();
      if (!root) return undefined;
      for (const entry of byRoot.get(root) ?? []) {
        if (objectPropertyPathMatchesShape(controlPath, entry.path)) return entry;
      }
      return undefined;
    },
    search: (input: PropertyControlSearchInput) => searchEntries(input, entries),
    allEntries: () => [...entries],
    size: () => entries.length,
  };
}

export function loadBundledMcpControlReference(extensionPath: string): McpControlReferenceLoadResult {
  const filePath = path.join(
    extensionPath,
    ...bundledDataPathSegments(BUNDLED_PANGOSCRIPT_DATA_PATHS.mcpPropertyControls),
  );
  if (!existsSync(filePath)) {
    return {
      index: buildMcpPropertyControlIndex(EMPTY),
      source: "empty",
      error: "mcp-control-reference/property-controls.json not found in bundled data.",
    };
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as McpControlReferenceFile;
    if (!Array.isArray(raw.entries)) {
      return {
        index: buildMcpPropertyControlIndex(EMPTY),
        source: "empty",
        error: "mcp-control-reference/property-controls.json is malformed (missing entries array).",
      };
    }
    return { index: buildMcpPropertyControlIndex(raw), source: "bundled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      index: buildMcpPropertyControlIndex(EMPTY),
      source: "empty",
      error: `Failed to parse mcp-control-reference/property-controls.json (${message}).`,
    };
  }
}

function normalizeControlLookupPath(rawPath: string): string {
  const bracketAsDot = rawPath
    .trim()
    .replace(/\[(#?\d+|#?N)\]/gi, (_match, indexValue: string) => `.${indexValue.toUpperCase()}`)
    .replace(/\.+/g, ".");
  return normalizeObjectPropertyPath(canonicalizeObjectPropertyHardwareRootPath(bracketAsDot));
}

function searchEntries(
  input: PropertyControlSearchInput,
  entries: McpPropertyControlEntry[],
): PropertyControlSearchHit[] {
  const query = input.query?.trim();
  if (!query) return [];

  const limit = clampLimit(input.limit);
  const rootFilter = input.root ? canonicalizeObjectPropertyHardwareRoot(input.root.trim()).toLowerCase() : undefined;
  const terms = tokenize(query);
  const queryLower = query.toLowerCase();

  const hits: PropertyControlSearchHit[] = [];
  for (const entry of entries) {
    if (rootFilter && entry.root.toLowerCase() !== rootFilter) continue;
    if (input.kind && entry.kind !== input.kind) continue;

    const haystack = buildSearchText(entry);
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    const score = scoreEntry(entry, haystack, queryLower, matchedTerms);
    if (score <= 0) continue;
    hits.push({ entry, score, matchedTerms });
  }

  hits.sort(
    (left, right) =>
      right.score - left.score ||
      left.entry.root.localeCompare(right.entry.root) ||
      left.entry.property.localeCompare(right.entry.property) ||
      left.entry.path.localeCompare(right.entry.path),
  );
  return hits.slice(0, limit);
}

function scoreEntry(
  entry: McpPropertyControlEntry,
  haystack: string,
  queryLower: string,
  matchedTerms: string[],
): number {
  let score = 0;
  const pathLower = entry.path.toLowerCase();
  const propertyLower = entry.property.toLowerCase();

  if (pathLower === queryLower) score += 200;
  if (propertyLower === queryLower || entry.label.toLowerCase() === queryLower) score += 120;
  if (pathLower.includes(queryLower)) score += 80;
  if (haystack.includes(queryLower)) score += 50;
  score += matchedTerms.length * 20;
  if (entry.pangoScript.commandCount > 0) score += 8;
  if (entry.osc.routeCount > 0) score += 6;
  if (entry.behavior?.evidenceLevel === "observed") score += 4;
  return score;
}

function buildSearchText(entry: McpPropertyControlEntry): string {
  return [
    entry.path,
    entry.label,
    entry.root,
    entry.property,
    entry.kind,
    entry.confidence,
    entry.value?.valueType,
    entry.value?.range?.unit,
    entry.value?.range?.boundaryBehavior,
    entry.readback?.status,
    entry.behavior?.accessMode,
    entry.behavior?.behaviorKind,
    ...entry.objectTree.objectBusPaths,
    ...entry.objectTree.contexts.flatMap((context) => [
      context.domain,
      context.kind,
      context.label,
      context.propertyPath,
      ...(context.objectPaths ?? []),
      ...(context.oscPaths ?? []),
    ]),
    ...entry.pangoScript.commands.flatMap((command) => [
      command.commandName,
      command.label,
      command.category,
      command.coverageStatus,
      command.evidenceLevel,
      command.safetyTier,
    ]),
    ...entry.osc.routes.flatMap((route) => [
      route.routeId,
      route.namespace,
      route.pathPattern,
      route.routeKind,
      route.evidenceLevel,
      route.supportStatus,
      route.safetyTier,
      ...(route.args ?? []),
      route.valueTransform?.kind,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function clampLimit(rawLimit: number | undefined): number {
  if (rawLimit === undefined || !Number.isFinite(rawLimit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9#]+/i)
    .filter((term) => term.length > 0);
}
