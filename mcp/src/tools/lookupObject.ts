// Tool: lookupObject: returns bundled schema data for a BEYOND
// object (Master, Zone, UniversePanel, ...) and falls back to the richer
// Object Tree property index for roots such as WS and FX that are visible
// in the extension Objects panel but not canonical schemas.

import {
  buildObjectPropertyCard,
  type ObjectPropertyCard,
  type ObjectPropertyDetailInput,
  type PageResult,
  pageItems,
} from "../../../src/knowledge/objectPropertyCards";
import type {
  ObjectPropertyIndex,
  ObjectPropertyKind,
  ObjectPropertyLookupResult,
} from "../../../src/knowledge/objectPropertyIndex";
import type { KnownObjectSchema, PropertyIndex } from "../../../src/knowledge/propertyIndex";
import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import { fail, ok, type ToolResult } from "../toolResult";

export interface LookupObjectInput extends ObjectPropertyDetailInput {
  name: string;
  propertyOffset?: number;
  propertyLimit?: number;
  includePaths?: boolean;
  pathOffset?: number;
  pathLimit?: number;
}

export type LookupObjectSource = "canonical-schema" | "object-property-index";

export interface ObjectTreeRootSummary {
  root: string;
  propertyCount: number;
  properties: string[];
  propertyPage: PageResult<string>;
  pathCount: number;
  paths?: string[];
  pathPage?: PageResult<string>;
  kinds: ObjectPropertyKind[];
  variantCount: number;
  isArrayRoot: boolean;
  matchedProperty?: ObjectPropertyCard;
  matchedVariant?: { path: string; osc?: string };
  lookupHint: string;
}

export interface LookupObjectData extends KnownObjectSchema {
  sources: LookupObjectSource[];
  objectTree?: ObjectTreeRootSummary;
}

export type LookupObjectResult = ToolResult<LookupObjectData>;

export function lookupObject(
  input: LookupObjectInput,
  propertyIndex: PropertyIndex,
  objectPropertyIndex?: ObjectPropertyIndex,
): LookupObjectResult {
  const name = input.name?.trim();
  if (!name) return fail("name is required");
  const nameLimitReason = mcpNameLimitReason(name);
  if (nameLimitReason) return fail(`name exceeds MCP lookupObject limit: ${nameLimitReason}`);

  const propertyLookup = name.includes(".") ? objectPropertyIndex?.lookup(name) : undefined;
  const objectTreeRoot = propertyLookup?.entry.root ?? name;
  const schema = propertyIndex.getObject(name);
  const objectTree = objectPropertyIndex
    ? summarizeObjectTreeRoot(objectTreeRoot, objectPropertyIndex, propertyLookup, input)
    : undefined;

  if (!schema && !objectTree) return fail(`unknown object: ${input.name}`);

  return ok(toLookupData(schema, objectTree));
}

function toLookupData(
  schema: KnownObjectSchema | undefined,
  objectTree: ObjectTreeRootSummary | undefined,
): LookupObjectData {
  const objectName = schema?.object ?? objectTree?.root ?? "";
  const properties = schema ? [...schema.properties] : (objectTree?.properties ?? []);
  const sources: LookupObjectSource[] = [];
  if (schema) sources.push("canonical-schema");
  if (objectTree) sources.push("object-property-index");

  return {
    object: objectName,
    isArray: schema?.isArray ?? objectTree?.isArrayRoot ?? false,
    propertyCount: schema?.propertyCount ?? objectTree?.propertyCount ?? properties.length,
    properties,
    sharedWithAliases: schema?.sharedWithAliases ?? 0,
    arrayIndices: schema?.arrayIndices ? [...schema.arrayIndices] : undefined,
    inheritedFrom: schema?.inheritedFrom,
    perIndexSchemas: schema?.perIndexSchemas ? { ...schema.perIndexSchemas } : undefined,
    discoverySource: schema?.discoverySource,
    observedFileCount: schema?.observedFileCount,
    validatedAt: schema?.validatedAt,
    sources,
    objectTree,
  };
}

function summarizeObjectTreeRoot(
  root: string,
  index: ObjectPropertyIndex,
  property?: ObjectPropertyLookupResult,
  input: LookupObjectInput = { name: root },
): ObjectTreeRootSummary | undefined {
  const rootLower = root.trim().toLowerCase();
  if (!rootLower) return undefined;

  const entries = index
    .allEntries()
    .filter((entry) => entry.root.toLowerCase() === rootLower)
    .sort((a, b) => a.property.localeCompare(b.property) || a.path.localeCompare(b.path));
  if (entries.length === 0) return undefined;

  const actualRoot = entries[0].root;
  const properties = unique(entries.map((entry) => entry.property));
  const paths = entries.map((entry) => entry.path);
  const propertyPage = pageItems(properties, input.propertyOffset, input.propertyLimit);
  const pathPage = input.includePaths ? pageItems(paths, input.pathOffset, input.pathLimit) : undefined;
  return {
    root: actualRoot,
    propertyCount: properties.length,
    properties: propertyPage.items,
    propertyPage,
    pathCount: paths.length,
    ...(pathPage ? { paths: pathPage.items, pathPage } : {}),
    kinds: unique(entries.map((entry) => entry.kind)),
    variantCount: entries.reduce((sum, entry) => sum + entry.variantCount, 0),
    isArrayRoot: inferArrayRoot(actualRoot, paths),
    ...(property ? { matchedProperty: buildObjectPropertyCard(property.entry, input) } : {}),
    ...(property?.matchedVariant ? { matchedVariant: property.matchedVariant } : {}),
    lookupHint: `Use lookupObjectProperty for an exact ${actualRoot} property path. Set includePaths true with pathLimit for a paged path list.`,
  };
}

function inferArrayRoot(root: string, paths: string[]): boolean {
  const rootPrefix = `${root}.`;
  return paths.some((path) => path.startsWith(rootPrefix) && /^N(?:\.|$)/.test(path.slice(rootPrefix.length)));
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}
