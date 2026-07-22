import { EXPRESSION_FUNCTIONS } from "../../../src/knowledge/expressionFunctions";
import { buildObjectPropertyCard } from "../../../src/knowledge/objectPropertyCards";
import type { ObjectPropertyEntry } from "../../../src/knowledge/objectPropertyIndex";
import type {
  OutCatalog,
  OutCommand,
  OutForm,
  OutObject,
  OutObjectProbeContext,
  OutObjectProperty,
  OutOscRoute,
  OutUniverseComponent,
  PublicObjectPropertyCard,
  RawCategoryTree,
  RawCommand,
  RawCommandOscRouteLink,
  RawCommandsFile,
  RawCoverage,
  RawCoverageEntry,
  RawForm,
  RawKnownProperties,
  RawNote,
  RawObjectBehaviorClassification,
  RawObjectIndex,
  RawObjectProbeContext,
  RawObjectPropertyOscRoute,
  RawObjectReadbackMetadata,
  RawObjectValueMetadata,
  RawOscValueTransform,
  RawSchema,
  RawUniverseComponent,
} from "./referenceCatalogTypes";
import { readPackageVersion, readReferenceJson } from "./referenceInputFiles";

const HIDDEN_TAGS = new Set(["prototype", "do-not-use", "internal"]);
const PUBLIC_EVIDENCE = new Set(["documented", "observed"]);
const PUBLIC_NOTE_AUDIENCES = new Set([undefined, null, "user"]);

function inferCatalogBuild(meta: Record<string, string | undefined>): string | undefined {
  const candidate = meta.generatedFrom ?? meta.generatedAt ?? undefined;
  if (!candidate) return undefined;
  const match = /build[-_ ]?(\d+)/i.exec(candidate);
  return match ? match[1] : undefined;
}

function isBrowsableCommand(cmd: RawCommand): boolean {
  return !(cmd.tags ?? []).some((t) => HIDDEN_TAGS.has(t.toLowerCase()));
}

function publicEvidenceOf(raw?: string): "documented" | "observed" | undefined {
  if (!raw) return undefined;
  return PUBLIC_EVIDENCE.has(raw) ? (raw as "documented" | "observed") : undefined;
}

function noteText(note: RawNote | string): string | null {
  if (typeof note === "string") return note;
  if (!note || typeof note !== "object") return null;
  if (note.audience !== undefined && !PUBLIC_NOTE_AUDIENCES.has(note.audience)) {
    return null;
  }
  return note.text ?? null;
}

function transformForm(form: RawForm): OutForm {
  return {
    signature: form.signature ?? "",
    description: form.description,
    parameters: (form.parameters ?? []).map((p) => ({
      name: p.name ?? "",
      type: p.type ?? "unknown",
      required: Boolean(p.required),
      range: p.range,
      valueRange: p.valueRange,
      acceptedValues: p.acceptedValues,
      description: p.description,
    })),
  };
}

function transformCommand(
  cmd: RawCommand,
  coverage: RawCoverageEntry | undefined,
  oscRoutes: OutOscRoute[] | undefined,
): OutCommand {
  const notes = (cmd.notes ?? []).map(noteText).filter((n): n is string => Boolean(n));
  const tags = (cmd.tags ?? []).filter((t) => !HIDDEN_TAGS.has(t.toLowerCase()));
  const out: OutCommand = {
    canonical: cmd.canonical,
    kind: "command",
    aliases: [...new Set(cmd.aliases ?? [cmd.canonical])],
    description: cmd.description ?? "",
    category: cmd.category ?? "Uncategorized",
    safetyTier: cmd.safetyTier ?? "unknown",
    evidenceLevel: publicEvidenceOf(cmd.evidenceLevel),
    forms: (cmd.forms ?? []).map(transformForm),
    notes,
    tags,
  };
  if (oscRoutes?.length) {
    out.oscRoutes = oscRoutes;
  }
  if (coverage) {
    out.coverage = {
      status: coverage.status,
      setsProperty: coverage.setsProperty,
      notes: coverage.notes,
    };
  } else if (cmd.setsProperty?.length) {
    out.coverage = { status: "mapped", setsProperty: cmd.setsProperty };
  }
  return out;
}

function transformExpressionFunction(fn: (typeof EXPRESSION_FUNCTIONS)[number]): OutCommand {
  return {
    canonical: fn.canonical,
    kind: "function",
    aliases: [...new Set(fn.aliases ?? [fn.canonical])],
    description: fn.description,
    category: "Expression functions",
    safetyTier: "unknown",
    evidenceLevel: publicEvidenceOf(fn.evidenceLevel),
    forms: (fn.forms ?? []).map((f) => ({
      signature: f.signature ?? "",
      description: f.description,
      parameters: (f.parameters ?? []).map((p) => ({
        name: p.name ?? "",
        type: p.type ?? "unknown",
        required: Boolean(p.required),
        range: undefined,
        description: p.description,
      })),
    })),
    notes: (fn.notes ?? [])
      .map((n) => (typeof n === "string" ? n : (n.text ?? null)))
      .filter((n): n is string => Boolean(n)),
    tags: fn.tags ?? [],
  };
}

function buildObjects(
  knownProps: RawKnownProperties,
  index: RawObjectIndex,
  commands: OutCommand[],
  propertyOscRoutes: Map<string, OutOscRoute[]>,
): OutObject[] {
  // Reverse-lookup: property path → set of canonical commands that set it.
  const setters = new Map<string, Set<string>>();
  for (const cmd of commands) {
    for (const path of cmd.coverage?.setsProperty ?? []) {
      addSetter(setters, path, cmd.canonical);
    }
  }

  // Lookup tables from canonical / normalized property path to OSC
  // index entry. The object-property index includes Object Tree-only
  // roots such as WS.N.N.* that are not present in known-properties, so
  // it is the primary source for browsable object paths.
  const indexByPath = new Map<string, RawObjectIndex["entries"][number]>();
  const indexByRoot = new Map<string, RawObjectIndex["entries"][number][]>();
  for (const entry of index.entries) {
    indexByPath.set(entry.path, entry);
    if (entry.normalizedPath) indexByPath.set(entry.normalizedPath, entry);
    const bucket = indexByRoot.get(entry.root) ?? [];
    bucket.push(entry);
    indexByRoot.set(entry.root, bucket);
  }

  const knownByName = new Map<string, RawSchema>();
  for (const schema of knownProps.schemas ?? []) {
    if (schema.object) knownByName.set(schema.object, schema);
  }

  const names = new Set<string>([...knownByName.keys(), ...indexByRoot.keys()]);
  const objects: OutObject[] = [];
  for (const name of names) {
    if (!name) continue;
    const schema = knownByName.get(name);
    const propsByPath = new Map<string, OutObjectProperty>();

    for (const entry of indexByRoot.get(name) ?? []) {
      addObjectProperty(propsByPath, fromIndexedProperty(entry, setters, propertyOscRoutes));
    }

    if (schema) {
      for (const property of [...(schema.properties ?? []), ...(schema.rootProperties ?? [])]) {
        const path = schemaPath(name, schema, property, indexByPath);
        const indexed = indexByPath.get(path) ?? indexByPath.get(normalizeNumericSegments(path));
        addObjectProperty(propsByPath, {
          path: indexed?.path ?? path,
          root: name,
          property: indexed?.property ?? property,
          osc: indexed?.osc,
          oscRoutes: propertyRoutesFor(propertyOscRoutes, indexed?.path ?? path),
          kind: indexed?.kind ?? "object",
          setters: sortedSettersFor(setters, indexed?.path ?? path),
        });
      }
    }

    const props = [...propsByPath.values()].sort(compareObjectProperties);
    objects.push({
      name,
      isArray: Boolean(schema?.isArray) || props.some((prop) => hasNumericPlaceholder(name, prop.path)),
      propertyCount: props.length,
      properties: props,
    });
  }
  objects.sort((a, b) => a.name.localeCompare(b.name));
  return objects;
}

function addSetter(setters: Map<string, Set<string>>, path: string, canonical: string): void {
  for (const key of new Set([path, normalizeNumericSegments(path)])) {
    const bucket = setters.get(key) ?? new Set();
    bucket.add(canonical);
    setters.set(key, bucket);
  }
}

function addObjectProperty(map: Map<string, OutObjectProperty>, property: OutObjectProperty): void {
  const existing = map.get(property.path);
  if (!existing) {
    map.set(property.path, property);
    return;
  }
  const setters = [...new Set([...existing.setters, ...property.setters])].sort();
  const oscRoutes = mergeOscRoutes(existing.oscRoutes, property.oscRoutes);
  map.set(property.path, {
    ...existing,
    osc: existing.osc ?? property.osc,
    ...(oscRoutes.length ? { oscRoutes } : {}),
    kind: existing.kind ?? property.kind,
    setters,
    valueMetadata: existing.valueMetadata ?? property.valueMetadata,
    readbackMetadata: existing.readbackMetadata ?? property.readbackMetadata,
    classification: existing.classification ?? property.classification,
    contextValueMetadata: existing.contextValueMetadata ?? property.contextValueMetadata,
    propertyCard: existing.propertyCard ?? property.propertyCard,
  });
}

function fromIndexedProperty(
  entry: RawObjectIndex["entries"][number],
  setters: Map<string, Set<string>>,
  propertyOscRoutes: Map<string, OutOscRoute[]>,
): OutObjectProperty {
  return {
    path: entry.path,
    root: entry.root,
    property: entry.property,
    osc: entry.osc,
    oscRoutes: propertyRoutesFor(propertyOscRoutes, entry.path),
    kind: entry.kind ?? "object",
    setters: sortedSettersFor(setters, entry.path),
    probeContexts: publicObjectProbeContexts(entry.probeContexts),
    valueMetadata: publicObjectValueMetadata(entry.valueMetadata),
    readbackMetadata: publicObjectReadbackMetadata(entry.readbackMetadata),
    classification: publicObjectBehaviorClassification(entry.classification),
    contextValueMetadata: publicContextValueMetadata(entry.contextValueMetadata),
    propertyCard: publicObjectPropertyCard(entry),
  };
}

function publicObjectPropertyCard(entry: RawObjectIndex["entries"][number]): PublicObjectPropertyCard {
  const {
    details: _details,
    classification: rawClassification,
    valueSummary: rawValueSummary,
    readbackSummary: rawReadbackSummary,
    ...card
  } = buildObjectPropertyCard(entry as ObjectPropertyEntry);
  const classification = publicObjectBehaviorClassification(rawClassification);
  const valueSummary = rawValueSummary
    ? {
        ...rawValueSummary,
        evidenceLevel: publicEvidenceOf(rawValueSummary.evidenceLevel),
        range: rawValueSummary.range
          ? {
              ...rawValueSummary.range,
              evidenceLevel: publicEvidenceOf(rawValueSummary.range.evidenceLevel),
            }
          : undefined,
      }
    : undefined;
  const readbackSummary = rawReadbackSummary
    ? {
        ...rawReadbackSummary,
        evidenceLevel: publicEvidenceOf(rawReadbackSummary.evidenceLevel),
      }
    : undefined;
  return {
    ...card,
    ...(classification ? { classification } : {}),
    ...(valueSummary ? { valueSummary } : {}),
    ...(readbackSummary ? { readbackSummary } : {}),
  };
}

function publicObjectProbeContexts(contexts: RawObjectProbeContext[] | undefined): OutObjectProbeContext[] | undefined {
  if (!contexts?.length) return undefined;
  const out = contexts.map(
    (ctx): OutObjectProbeContext => ({
      id: ctx.id,
      kind: ctx.kind,
      label: ctx.label,
      parentLabel: ctx.parentLabel,
      normalizedPrefix: ctx.normalizedPrefix,
      probePrefix: ctx.probePrefix,
      probeOscPrefix: ctx.probeOscPrefix,
    }),
  );
  return out.length ? out : undefined;
}

function publicObjectBehaviorClassification(
  classification: RawObjectBehaviorClassification | undefined,
): RawObjectBehaviorClassification | undefined {
  if (!classification) return undefined;
  const { notes: _notes, ...rest } = classification;
  return {
    ...rest,
    evidenceLevel: publicEvidenceOf(classification.evidenceLevel),
  };
}

function publicObjectValueMetadata(metadata: RawObjectValueMetadata | undefined): RawObjectValueMetadata | undefined {
  if (!metadata) return undefined;
  // Strip all free-text notes fields: they are maintainer annotations not
  // intended for end-user display, and omitting them keeps the page compact.
  const { notes: _notes, locationContext, valueRange, ...rest } = metadata;
  return {
    ...rest,
    evidenceLevel: publicEvidenceOf(metadata.evidenceLevel),
    locationContext: locationContext ? { ...locationContext, notes: undefined } : undefined,
    valueRange: valueRange
      ? {
          ...valueRange,
          dynamicMax: valueRange.dynamicMax ? { ...valueRange.dynamicMax, notes: undefined } : undefined,
          evidenceLevel: publicEvidenceOf(valueRange.evidenceLevel),
          notes: undefined,
        }
      : undefined,
  };
}

function publicContextValueMetadata(
  entries: Array<RawObjectValueMetadata & { contextId: string }> | undefined,
): Array<RawObjectValueMetadata & { contextId: string }> | undefined {
  const publicEntries = entries
    ?.map((entry) => {
      const metadata = publicObjectValueMetadata(entry);
      return metadata ? { ...metadata, contextId: entry.contextId } : undefined;
    })
    .filter((entry): entry is RawObjectValueMetadata & { contextId: string } => Boolean(entry));
  return publicEntries?.length ? publicEntries : undefined;
}

function publicObjectReadbackMetadata(
  metadata: RawObjectReadbackMetadata | undefined,
): RawObjectReadbackMetadata | undefined {
  if (!metadata) return undefined;
  const { notes: _notes, locationContext, ...rest } = metadata;
  return {
    ...rest,
    evidenceLevel: publicEvidenceOf(metadata.evidenceLevel),
    locationContext: locationContext ? { ...locationContext, notes: undefined } : undefined,
  };
}

function buildCommandOscRouteMap(links: RawCommandOscRouteLink[]): Map<string, OutOscRoute[]> {
  const routesByCommand = new Map<string, OutOscRoute[]>();
  for (const link of links) {
    if (!link.commandName) continue;
    const route = publicCommandOscRoute(link);
    if (!route) continue;
    routesByCommand.set(link.commandName, mergeOscRoutes(routesByCommand.get(link.commandName), [route]));
  }
  return routesByCommand;
}

function buildObjectPropertyOscRouteMap(routes: RawObjectPropertyOscRoute[]): Map<string, OutOscRoute[]> {
  const routesByProperty = new Map<string, OutOscRoute[]>();
  for (const route of routes) {
    if (!route.propertyPattern) continue;
    const out = publicObjectPropertyOscRoute(route);
    if (!out) continue;
    for (const key of controlPropertyKeys(route.propertyPattern)) {
      routesByProperty.set(key, mergeOscRoutes(routesByProperty.get(key), [out]));
    }
  }
  return routesByProperty;
}

function publicCommandOscRoute(link: RawCommandOscRouteLink): OutOscRoute | null {
  const route = link.route;
  const id = route.routeId ?? route.id;
  if (!id || !route.pathPattern) return null;
  if (!isPublicOscRouteStatus(route.supportStatus)) return null;
  const out: OutOscRoute = {
    id,
    pathPattern: route.pathPattern,
    args: route.args ?? [],
    namespace: route.namespace,
    targetPropertyPatterns: route.targetPropertyPatterns,
    normalizedTargetPropertyPatterns: route.normalizedTargetPropertyPatterns,
    valueTransform: publicOscValueTransform(route.valueTransform),
  };
  return stripEmptyRouteFields(out);
}

function publicObjectPropertyOscRoute(route: RawObjectPropertyOscRoute): OutOscRoute | null {
  if (!route.routeId || !route.pathPattern) return null;
  if (!isPublicOscRouteStatus(route.supportStatus)) return null;
  const out: OutOscRoute = {
    id: route.routeId,
    pathPattern: route.pathPattern,
    args: route.args ?? [],
    namespace: route.namespace,
    valueTransform: publicOscValueTransform(route.valueTransform),
  };
  return stripEmptyRouteFields(out);
}

function isPublicOscRouteStatus(status: string): boolean {
  return status === "confirmed" || status === "acceptedNoReadback";
}

function stripEmptyRouteFields(route: OutOscRoute): OutOscRoute {
  return {
    id: route.id,
    pathPattern: route.pathPattern,
    args: route.args,
    namespace: route.namespace,
    ...(route.targetPropertyPatterns?.length ? { targetPropertyPatterns: route.targetPropertyPatterns } : {}),
    ...(route.normalizedTargetPropertyPatterns?.length
      ? { normalizedTargetPropertyPatterns: route.normalizedTargetPropertyPatterns }
      : {}),
    ...(route.valueTransform ? { valueTransform: route.valueTransform } : {}),
  };
}

function publicOscValueTransform(transform: RawOscValueTransform | undefined): RawOscValueTransform | undefined {
  if (!transform) return undefined;
  return {
    kind: transform.kind,
    ...(transform.factor !== undefined ? { factor: transform.factor } : {}),
    ...(transform.amount !== undefined ? { amount: transform.amount } : {}),
    ...(transform.offset !== undefined ? { offset: transform.offset } : {}),
    ...(transform.clamp ? { clamp: transform.clamp } : {}),
  };
}

function propertyRoutesFor(routesByProperty: Map<string, OutOscRoute[]>, path: string): OutOscRoute[] | undefined {
  const routes = mergeOscRoutes(
    routesByProperty.get(path),
    routesByProperty.get(normalizeControlPropertyPattern(path)),
    routesByProperty.get(normalizeNumericSegments(path)),
  );
  return routes.length ? routes : undefined;
}

function mergeOscRoutes(...routeLists: Array<OutOscRoute[] | undefined>): OutOscRoute[] {
  const byKey = new Map<string, OutOscRoute>();
  for (const routes of routeLists) {
    for (const route of routes ?? []) {
      byKey.set(oscRouteKey(route), route);
    }
  }
  return [...byKey.values()].sort(compareOscRoutes);
}

function oscRouteKey(route: OutOscRoute): string {
  return [route.id, route.pathPattern, route.args.join(",")].join("|");
}

function compareOscRoutes(a: OutOscRoute, b: OutOscRoute): number {
  return (
    a.namespace.localeCompare(b.namespace) ||
    a.pathPattern.localeCompare(b.pathPattern) ||
    a.args.join(",").localeCompare(b.args.join(","))
  );
}

function controlPropertyKeys(pattern: string): string[] {
  const normalized = normalizeControlPropertyPattern(pattern);
  return [
    ...new Set([pattern, normalized, normalizeNumericSegments(pattern), ...controlPropertyAliasKeys(normalized)]),
  ];
}

function normalizeControlPropertyPattern(pattern: string): string {
  return normalizeNumericSegments(pattern.replace(/\[(\d+)\]/g, ".$1").replace(/\[N\]/g, ".N"));
}

function controlPropertyAliasKeys(pattern: string): string[] {
  const projectorLeafAliases: Record<string, string> = {
    InvX: "InvertX",
    InvY: "InvertY",
    PosX: "PositionX",
    PosY: "PositionY",
  };
  const match = /^Projector\.N\.(InvX|InvY|PosX|PosY)$/.exec(pattern);
  if (!match) return [];
  return [`Projector.N.${projectorLeafAliases[match[1]]}`];
}

function schemaPath(
  name: string,
  schema: RawSchema,
  property: string,
  indexByPath: Map<string, RawObjectIndex["entries"][number]>,
): string {
  if (/^\d+$/.test(property) && indexByPath.has(`${name}.N`)) return `${name}.N`;
  const direct = `${name}.${property}`;
  if (indexByPath.has(direct)) return direct;
  const arrayPath = schema.isArray ? `${name}.N.${property}` : direct;
  const normalized = normalizeNumericSegments(arrayPath);
  if (indexByPath.has(normalized)) return normalized;
  return arrayPath;
}

function normalizeNumericSegments(path: string): string {
  const parts = path.split(".");
  return parts.map((part, index) => (index > 0 && /^\d+$/.test(part) ? "N" : part)).join(".");
}

function sortedSettersFor(setters: Map<string, Set<string>>, path: string): string[] {
  const out = new Set<string>();
  for (const key of [path, normalizeNumericSegments(path)]) {
    for (const setter of setters.get(key) ?? []) out.add(setter);
  }
  return [...out].sort();
}

function hasNumericPlaceholder(root: string, path: string): boolean {
  const suffix = path.slice(root.length + 1);
  return suffix.split(".").includes("N");
}

function compareObjectProperties(a: OutObjectProperty, b: OutObjectProperty): number {
  return a.path.localeCompare(b.path, undefined, { numeric: true });
}

export function buildReferenceCatalog(): OutCatalog {
  const rawCommands = readReferenceJson<RawCommandsFile>("data/pangoscript/commands.merged.json");
  const rawCoverage = readReferenceJson<RawCoverage>("data/pangoscript/command-property-coverage.json");
  const rawKnown = readReferenceJson<RawKnownProperties>(
    "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  );
  const rawIndex = readReferenceJson<RawObjectIndex>(
    "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  );
  const rawCommandOscRouteLinks = readReferenceJson<RawCommandOscRouteLink[]>(
    "data/pangoscript/control-reference/command-control-reference/command-osc-route-links.json",
  );
  const rawObjectPropertyOscRoutes = readReferenceJson<RawObjectPropertyOscRoute[]>(
    "data/pangoscript/control-reference/osc-control-reference/object-property-target-index.json",
  );
  const rawUniverseComponents = readReferenceJson<RawUniverseComponent[]>(
    "data/pangoscript/control-reference/object-control-reference/universe-component-types.json",
  );
  const rawTree = readReferenceJson<RawCategoryTree>("data/pangoscript/beyond-category-tree.json");
  const commandOscRoutes = buildCommandOscRouteMap(rawCommandOscRouteLinks);
  const objectPropertyOscRoutes = buildObjectPropertyOscRouteMap(rawObjectPropertyOscRoutes);

  const commands: OutCommand[] = [];
  for (const cmd of Object.values(rawCommands.commands)) {
    if (!isBrowsableCommand(cmd)) continue;
    commands.push(transformCommand(cmd, rawCoverage.commands[cmd.canonical], commandOscRoutes.get(cmd.canonical)));
  }
  for (const fn of EXPRESSION_FUNCTIONS) {
    commands.push(transformExpressionFunction(fn));
  }
  commands.sort((a, b) => a.canonical.localeCompare(b.canonical));

  const objects = buildObjects(rawKnown, rawIndex, commands, objectPropertyOscRoutes);
  const universeComponents = rawUniverseComponents.map(publicUniverseComponent);

  // Per-category counts in BEYOND tree order
  const categoryCounts = new Map<string, number>();
  for (const cmd of commands) {
    categoryCounts.set(cmd.category, (categoryCounts.get(cmd.category) ?? 0) + 1);
  }
  const treeOrder = new Map<string, number>();
  for (const c of rawTree.categories ?? []) treeOrder.set(c.name, c.order);
  const categories = [...categoryCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      order: treeOrder.get(name) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      version: readPackageVersion(),
      catalogBuild: inferCatalogBuild({
        generatedFrom: (rawCommands as unknown as Record<string, string | undefined>).generatedFrom,
        generatedAt: rawCommands.generatedAt,
      }),
      total: commands.length,
      categories,
      coverage: summarizeCoverage(commands),
    },
    commands,
    objects,
    universeComponents,
  };
}

function publicUniverseComponent(component: RawUniverseComponent): OutUniverseComponent {
  return {
    id: component.id,
    label: component.label,
    componentIndex: component.componentIndex,
    defaultName: component.defaultName,
    propertyCount: component.propertyCount,
    propertySetId: component.propertySetId,
    addressForms: [...component.addressForms],
    oscAddressForms: [...component.oscAddressForms],
    properties: component.properties.map((property) => ({
      path: property.path,
      leafName: property.leafName,
      objectPaths: [...property.objectPaths],
      oscPaths: [...property.oscPaths],
    })),
  };
}

function summarizeCoverage(commands: OutCommand[]): RawCoverage["summary"] {
  const summary: RawCoverage["summary"] = {
    total: commands.length,
    mapped: 0,
    noDirectProperty: 0,
    deferred: 0,
    unknown: 0,
  };
  for (const cmd of commands) {
    switch (cmd.coverage?.status ?? "unknown") {
      case "mapped":
        summary.mapped += 1;
        break;
      case "no-direct-property":
        summary.noDirectProperty += 1;
        break;
      case "deferred":
        summary.deferred += 1;
        break;
      case "unknown":
        summary.unknown += 1;
        break;
    }
  }
  return summary;
}
