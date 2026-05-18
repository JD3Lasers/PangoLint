import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ObjectPropertyBehaviorClassification,
  ObjectPropertyEntry,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
} from "../src/knowledge/objectPropertyIndex";

interface CrosswalkRow {
  normalizedPropertyPattern: string;
  leafName: string;
  coverage?: Record<string, boolean>;
  objectContexts?: CrosswalkObjectContext[];
  objectBusPaths?: string[];
  objectIndexEntries?: CrosswalkObjectIndexEntry[];
  commands?: CrosswalkCommand[];
  oscCommandRoutes?: CrosswalkOscRoute[];
  rangeSeeds?: {
    objectPropertyRanges?: CrosswalkObjectPropertyRange[];
    commandParameterRanges?: CrosswalkCommandParameterRange[];
  };
}

interface CrosswalkObjectContext {
  domain?: string;
  kind?: string;
  label?: string;
  lookupDisplayLabel?: string;
  propertyPath?: string;
  objectPaths?: string[];
  oscPaths?: string[];
}

interface CrosswalkObjectIndexEntry {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: "object" | "fx";
  confidence: string;
  osc?: string;
  variantCount?: number;
  valueMetadata?: ObjectPropertyValueMetadata;
  classification?: ObjectPropertyBehaviorClassification;
}

interface CrosswalkCommand {
  commandName: string;
  label?: string;
  category?: string;
  coverageStatus?: string;
  evidenceLevel?: string;
  safetyTier?: string;
}

interface CrosswalkOscRoute {
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

interface CrosswalkObjectPropertyRange {
  valueType?: string;
  valueRange?: ObjectPropertyValueMetadata["valueRange"];
  evidenceLevel?: string;
  locationContext?: ObjectPropertyValueMetadata["locationContext"];
}

interface CrosswalkCommandParameterRange {
  commandName: string;
  formSignature?: string;
  parameterName?: string;
  parameterType?: string;
  range?: string;
  valueRange?: ObjectPropertyValueMetadata["valueRange"];
}

interface ObjectPropertyIndexFile {
  entries?: ObjectPropertyEntry[];
}

interface McpPropertyControlEntry {
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
    contexts: Array<{
      domain?: string;
      kind?: string;
      label?: string;
      propertyPath?: string;
      objectPaths?: string[];
      oscPaths?: string[];
    }>;
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
    commands: CrosswalkCommand[];
    parameterRangeCount: number;
    parameterRanges: CrosswalkCommandParameterRange[];
  };
  osc: {
    routeCount: number;
    routes: CrosswalkOscRoute[];
  };
  detailAvailable: {
    objectContexts: number;
    objectBusPaths: number;
    commands: number;
    oscRoutes: number;
    parameterRanges: number;
  };
}

interface McpControlReferenceFile {
  schemaVersion: 1;
  generatedBy: string;
  generatedFrom: string[];
  responseLimits: {
    defaultExampleLimit: number;
    maxExampleLimit: number;
    defaultSearchLimit: number;
    maxSearchLimit: number;
  };
  entries: McpPropertyControlEntry[];
}

const repoRoot = path.resolve(__dirname, "..");
const controlReferenceRoot = path.join(repoRoot, "data", "pangoscript", "control-reference");
const crosswalkPath = path.join(controlReferenceRoot, "control-crosswalk", "property-control-index.json");
const objectPropertyIndexPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "object-property-index.json",
);
const outputRoot = path.join(controlReferenceRoot, "mcp-control-reference");
const outputPath = path.join(outputRoot, "property-controls.json");
const summaryPath = path.join(outputRoot, "summary.json");
const readmePath = path.join(outputRoot, "README.md");

const DEFAULT_EXAMPLE_LIMIT = 3;
const MAX_EXAMPLE_LIMIT = 8;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function compactClassification(
  classification: ObjectPropertyBehaviorClassification | undefined,
): ObjectPropertyBehaviorClassification | undefined {
  if (!classification) return undefined;
  return {
    accessMode: classification.accessMode,
    behaviorKind: classification.behaviorKind,
    writeTestStatus: classification.writeTestStatus,
    readbackStatus: classification.readbackStatus,
    evidenceLevel: classification.evidenceLevel,
  };
}

function compactValueMetadata(
  metadata: ObjectPropertyValueMetadata | CrosswalkObjectPropertyRange | undefined,
): McpPropertyControlEntry["value"] {
  if (!metadata) return undefined;
  const range = metadata.valueRange;
  return {
    valueType: metadata.valueType,
    ...(range
      ? {
          range: {
            min: range.min,
            max: range.max,
            dynamicMaxExpression: range.dynamicMax?.expression,
            unit: range.unit,
            boundaryBehavior: range.boundaryBehavior,
            evidenceLevel: range.evidenceLevel,
          },
        }
      : {}),
    evidenceLevel: metadata.evidenceLevel,
    locationKind: metadata.locationContext?.kind,
  };
}

function compactReadbackMetadata(
  metadata: ObjectPropertyReadbackMetadata | undefined,
  classification: ObjectPropertyBehaviorClassification | undefined,
): McpPropertyControlEntry["readback"] {
  if (metadata) {
    return {
      status: "readable",
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

function compactObjectContext(
  context: CrosswalkObjectContext,
): McpPropertyControlEntry["objectTree"]["contexts"][number] {
  return {
    domain: context.domain,
    kind: context.kind,
    label: context.lookupDisplayLabel ?? context.label,
    propertyPath: context.propertyPath,
    objectPaths: context.objectPaths?.slice(0, MAX_EXAMPLE_LIMIT),
    oscPaths: context.oscPaths?.slice(0, MAX_EXAMPLE_LIMIT),
  };
}

function entryRootFromPath(pathValue: string): string {
  return pathValue.split(".", 1)[0] ?? pathValue;
}

function entryPropertyFromPath(pathValue: string): string {
  const parts = pathValue.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : pathValue;
}

function buildObjectPropertyEntryMaps(indexFile: ObjectPropertyIndexFile): {
  byPath: Map<string, ObjectPropertyEntry>;
  byNormalizedPath: Map<string, ObjectPropertyEntry>;
} {
  const byPath = new Map<string, ObjectPropertyEntry>();
  const byNormalizedPath = new Map<string, ObjectPropertyEntry>();
  for (const entry of indexFile.entries ?? []) {
    byPath.set(entry.path.toLowerCase(), entry);
    byNormalizedPath.set(entry.normalizedPath.toLowerCase(), entry);
  }
  return { byPath, byNormalizedPath };
}

function findObjectPropertyEntry(
  row: CrosswalkRow,
  maps: ReturnType<typeof buildObjectPropertyEntryMaps>,
): ObjectPropertyEntry | undefined {
  for (const entry of row.objectIndexEntries ?? []) {
    const found =
      maps.byPath.get(entry.path.toLowerCase()) ?? maps.byNormalizedPath.get(entry.normalizedPath.toLowerCase());
    if (found) return found;
  }
  return maps.byNormalizedPath.get(row.normalizedPropertyPattern.toLowerCase());
}

function buildEntry(row: CrosswalkRow, maps: ReturnType<typeof buildObjectPropertyEntryMaps>): McpPropertyControlEntry {
  const objectIndexEntry = row.objectIndexEntries?.[0];
  const objectPropertyEntry = findObjectPropertyEntry(row, maps);
  const objectContexts = row.objectContexts ?? [];
  const objectBusPaths = unique([...(row.objectBusPaths ?? []), objectIndexEntry?.osc, objectPropertyEntry?.osc]);
  const commands = (row.commands ?? []).map((command) => ({
    commandName: command.commandName,
    label: command.label,
    category: command.category,
    coverageStatus: command.coverageStatus,
    evidenceLevel: command.evidenceLevel,
    safetyTier: command.safetyTier,
  }));
  const oscRoutes = (row.oscCommandRoutes ?? []).map((route) => ({
    routeId: route.routeId,
    namespace: route.namespace,
    pathPattern: route.pathPattern,
    args: route.args,
    routeKind: route.routeKind,
    evidenceLevel: route.evidenceLevel,
    supportStatus: route.supportStatus,
    safetyTier: route.safetyTier,
    valueTransform: route.valueTransform,
  }));
  const parameterRanges = (row.rangeSeeds?.commandParameterRanges ?? []).map((range) => ({
    commandName: range.commandName,
    formSignature: range.formSignature,
    parameterName: range.parameterName,
    parameterType: range.parameterType,
    range: range.range,
    valueRange: range.valueRange
      ? {
          min: range.valueRange.min,
          max: range.valueRange.max,
          unit: range.valueRange.unit,
          boundaryBehavior: range.valueRange.boundaryBehavior,
          evidenceLevel: range.valueRange.evidenceLevel,
        }
      : undefined,
  }));
  const behavior = compactClassification(objectPropertyEntry?.classification ?? objectIndexEntry?.classification);
  const value =
    compactValueMetadata(objectPropertyEntry?.valueMetadata ?? objectIndexEntry?.valueMetadata) ??
    compactValueMetadata(row.rangeSeeds?.objectPropertyRanges?.[0]);
  const root = objectIndexEntry?.root ?? objectPropertyEntry?.root ?? entryRootFromPath(row.normalizedPropertyPattern);
  const property =
    objectIndexEntry?.property ?? objectPropertyEntry?.property ?? entryPropertyFromPath(row.normalizedPropertyPattern);

  return {
    path: row.normalizedPropertyPattern,
    label: row.leafName,
    root,
    property,
    kind: objectIndexEntry?.kind ?? objectPropertyEntry?.kind ?? "object",
    confidence: objectIndexEntry?.confidence ?? objectPropertyEntry?.confidence,
    coverage: row.coverage ?? {},
    objectTree: {
      path: objectIndexEntry?.path ?? objectPropertyEntry?.path,
      normalizedPath: objectIndexEntry?.normalizedPath ?? objectPropertyEntry?.normalizedPath,
      directBusPath: objectIndexEntry?.osc ?? objectPropertyEntry?.osc,
      variantCount: objectIndexEntry?.variantCount ?? objectPropertyEntry?.variantCount,
      contextCount: objectContexts.length,
      contexts: objectContexts.slice(0, MAX_EXAMPLE_LIMIT).map(compactObjectContext),
      objectBusPathCount: objectBusPaths.length,
      objectBusPaths: objectBusPaths.slice(0, MAX_EXAMPLE_LIMIT),
    },
    value,
    readback: compactReadbackMetadata(objectPropertyEntry?.readbackMetadata, behavior),
    behavior,
    pangoScript: {
      commandCount: commands.length,
      commands: commands.slice(0, MAX_EXAMPLE_LIMIT),
      parameterRangeCount: parameterRanges.length,
      parameterRanges: parameterRanges.slice(0, MAX_EXAMPLE_LIMIT),
    },
    osc: {
      routeCount: oscRoutes.length,
      routes: oscRoutes.slice(0, MAX_EXAMPLE_LIMIT),
    },
    detailAvailable: {
      objectContexts: objectContexts.length,
      objectBusPaths: objectBusPaths.length,
      commands: commands.length,
      oscRoutes: oscRoutes.length,
      parameterRanges: parameterRanges.length,
    },
  };
}

function writeReadme(): void {
  const lines = [
    "# MCP Control Reference",
    "",
    "This generated projection is the MCP package surface for property control lookup.",
    "",
    "It is built from tracked control-reference data and `data/pangoscript/object-tree/runtime-indexes/object-property-index.json`.",
    "",
    "The projection keeps compact examples for PangoScript commands, OSC routes, Object Tree contexts, value ranges, readback, and behavior classification. MCP tools apply their own response caps on top of this file.",
    "",
    "Refresh from tracked inputs with:",
    "",
    "```bash",
    "npm run build:mcp-control-reference",
    "```",
    "",
  ];
  writeFileSync(readmePath, `${lines.join("\n")}`, "utf8");
}

const crosswalkRows = readJson<CrosswalkRow[]>(crosswalkPath);
const objectPropertyMaps = buildObjectPropertyEntryMaps(readJson<ObjectPropertyIndexFile>(objectPropertyIndexPath));
const entries = crosswalkRows
  .map((row) => buildEntry(row, objectPropertyMaps))
  .sort((left, right) => left.path.localeCompare(right.path));

const projection: McpControlReferenceFile = {
  schemaVersion: 1,
  generatedBy: "scripts/generateMcpControlReference.ts",
  generatedFrom: [
    "data/pangoscript/control-reference/control-crosswalk/property-control-index.json",
    "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  ],
  responseLimits: {
    defaultExampleLimit: DEFAULT_EXAMPLE_LIMIT,
    maxExampleLimit: MAX_EXAMPLE_LIMIT,
    defaultSearchLimit: DEFAULT_SEARCH_LIMIT,
    maxSearchLimit: MAX_SEARCH_LIMIT,
  },
  entries,
};

mkdirSync(outputRoot, { recursive: true });
writeJson(outputPath, projection);
writeJson(summaryPath, {
  schemaVersion: 1,
  generatedBy: projection.generatedBy,
  propertyControlCount: entries.length,
  propertiesWithPangoScriptCommands: entries.filter((entry) => entry.pangoScript.commandCount > 0).length,
  propertiesWithOscRoutes: entries.filter((entry) => entry.osc.routeCount > 0).length,
  propertiesWithObjectTreePaths: entries.filter((entry) => Boolean(entry.objectTree.path)).length,
  propertiesWithValueRange: entries.filter((entry) => Boolean(entry.value?.range)).length,
  propertiesWithReadback: entries.filter((entry) => Boolean(entry.readback)).length,
  propertiesWithBehavior: entries.filter((entry) => Boolean(entry.behavior)).length,
});
writeReadme();

process.stdout.write(
  `Wrote ${path.relative(repoRoot, outputPath).replaceAll(path.sep, "/")} (${entries.length} entries)\n`,
);
