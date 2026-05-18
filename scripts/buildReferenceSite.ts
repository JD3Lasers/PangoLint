// Builds the standalone PangoScript reference page as a single
// self-contained HTML file, ready to ship inside the VSIX and open
// in the user's default browser via vscode.env.openExternal.
//
// Inputs:
//   - data/pangoscript/commands.merged.json
//   - data/pangoscript/command-property-coverage.json
//   - data/pangoscript/object-tree/runtime-indexes/known-properties.json
//   - data/pangoscript/object-tree/runtime-indexes/object-property-index.json
//   - data/pangoscript/beyond-category-tree.json  (BEYOND-native category order)
//   - src/knowledge/expressionFunctions.ts
//
// Output:
//   - media/reference/pangoscript-reference.html  (~5 MB, single file)
//
// The page receives the catalog as an inlined <script
// type="application/json"> block; the compiled bundle reads it on
// DOMContentLoaded. No fetch, no CORS, no localhost.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { EXPRESSION_FUNCTIONS } from "../src/knowledge/expressionFunctions";
import { buildObjectPropertyCard, type ObjectPropertyCard } from "../src/knowledge/objectPropertyCards";
import type { ObjectPropertyEntry } from "../src/knowledge/objectPropertyIndex";

// Existing build scripts (build:knowledge, etc.) all assume they run
// from the repo root; we follow the same convention so the
// `esbuild → node dist/*.cjs` pipeline keeps working without
// import.meta.url gymnastics.
const ROOT = process.cwd();

// ── Public-safe filter rules ──────────────────────────────────────
const HIDDEN_TAGS = new Set(["prototype", "do-not-use", "internal"]);
const PUBLIC_EVIDENCE = new Set(["documented", "observed"]);
const PUBLIC_NOTE_AUDIENCES = new Set([undefined, null, "user"]);

// ── Input types (light) ───────────────────────────────────────────
interface RawCommandsFile {
  schemaVersion?: number;
  generatedAt?: string;
  generatedFrom?: string;
  commands: Record<string, RawCommand>;
}

interface RawCommand {
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

interface RawForm {
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
  boundaryBehavior?: "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";
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

interface RawNote {
  text?: string;
  audience?: string | null;
}

interface RawCoverage {
  summary: {
    total: number;
    mapped: number;
    noDirectProperty: number;
    deferred: number;
    unknown: number;
  };
  commands: Record<string, RawCoverageEntry>;
}

interface RawCoverageEntry {
  canonical: string;
  status: "mapped" | "no-direct-property" | "deferred" | "unknown";
  setsProperty?: string[];
  notes?: string;
}

interface RawObjectIndex {
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

interface RawObjectProbeContext {
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

interface RawObjectValueMetadata {
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

interface RawObjectReadbackMetadata {
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

interface RawObjectBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel?: string;
  notes?: string;
}

type PublicObjectPropertyCard = Omit<ObjectPropertyCard, "classification" | "details"> & {
  classification?: RawObjectBehaviorClassification;
  details?: never;
};

interface RawKnownProperties {
  schemas: RawSchema[];
}

interface RawSchema {
  object: string;
  isArray?: boolean;
  propertyCount?: number;
  properties?: string[];
  sharedWithAliases?: string[];
}

interface RawCategoryTree {
  categories: Array<{ name: string; order: number }>;
}

// ── Output types (mirror src/reference/bundle/types.ts) ───────────
interface OutCommand {
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
}

interface OutForm {
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

interface OutObjectProperty {
  path: string;
  root: string;
  property: string;
  osc?: string;
  kind: string;
  setters: string[];
  probeContexts?: OutObjectProbeContext[];
  valueMetadata?: RawObjectValueMetadata;
  readbackMetadata?: RawObjectReadbackMetadata;
  classification?: RawObjectBehaviorClassification;
  contextValueMetadata?: Array<RawObjectValueMetadata & { contextId: string }>;
  propertyCard?: PublicObjectPropertyCard;
}

interface OutObjectProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
}

interface OutObject {
  name: string;
  isArray: boolean;
  propertyCount: number;
  properties: OutObjectProperty[];
}

interface OutCatalog {
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
}

// ── Helpers ───────────────────────────────────────────────────────
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function readPackageVersion(): string {
  const pkg = readJson<{ version: string }>("package.json");
  return pkg.version;
}

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

function transformCommand(cmd: RawCommand, coverage: RawCoverageEntry | undefined): OutCommand {
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

function buildObjects(knownProps: RawKnownProperties, index: RawObjectIndex, commands: OutCommand[]): OutObject[] {
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
      addObjectProperty(propsByPath, fromIndexedProperty(entry, setters));
    }

    if (schema) {
      for (const property of schema.properties ?? []) {
        const path = schemaPath(name, schema, property, indexByPath);
        const indexed = indexByPath.get(path) ?? indexByPath.get(normalizeNumericSegments(path));
        addObjectProperty(propsByPath, {
          path: indexed?.path ?? path,
          root: name,
          property: indexed?.property ?? property,
          osc: indexed?.osc,
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
  map.set(property.path, {
    ...existing,
    osc: existing.osc ?? property.osc,
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
): OutObjectProperty {
  return {
    path: entry.path,
    root: entry.root,
    property: entry.property,
    osc: entry.osc,
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

function buildCatalog(): OutCatalog {
  const rawCommands = readJson<RawCommandsFile>("data/pangoscript/commands.merged.json");
  const rawCoverage = readJson<RawCoverage>("data/pangoscript/command-property-coverage.json");
  const rawKnown = readJson<RawKnownProperties>("data/pangoscript/object-tree/runtime-indexes/known-properties.json");
  const rawIndex = readJson<RawObjectIndex>("data/pangoscript/object-tree/runtime-indexes/object-property-index.json");
  const rawTree = readJson<RawCategoryTree>("data/pangoscript/beyond-category-tree.json");

  const commands: OutCommand[] = [];
  for (const cmd of Object.values(rawCommands.commands)) {
    if (!isBrowsableCommand(cmd)) continue;
    commands.push(transformCommand(cmd, rawCoverage.commands[cmd.canonical]));
  }
  for (const fn of EXPRESSION_FUNCTIONS) {
    commands.push(transformExpressionFunction(fn));
  }
  commands.sort((a, b) => a.canonical.localeCompare(b.canonical));

  const objects = buildObjects(rawKnown, rawIndex, commands);

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

// ── Bundle the renderer via esbuild ───────────────────────────────
function buildBundle(): string {
  const entry = resolve(ROOT, "src/reference/bundle/main.ts");
  // Use esbuild via the local dev binary; --minify keeps the payload small.
  const tmp = resolve(ROOT, "dist/.reference-bundle.js");
  mkdirSync(dirname(tmp), { recursive: true });
  const esbuildBin = resolve(ROOT, "node_modules", "esbuild", "bin", "esbuild");
  const esbuildCommand = process.platform === "win32" ? process.execPath : esbuildBin;
  const esbuildArgs = [
    entry,
    "--bundle",
    "--platform=browser",
    "--format=esm",
    "--target=es2022",
    "--minify",
    `--outfile=${tmp}`,
  ];
  execFileSync(esbuildCommand, process.platform === "win32" ? [esbuildBin, ...esbuildArgs] : esbuildArgs, {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  return readFileSync(tmp, "utf8");
}

// ── Render single-file HTML ───────────────────────────────────────
function escapeForScriptTag(json: string): string {
  // </script> in inline JSON breaks the page; escape the closing tag.
  return json.replace(/<\//g, "<\\/");
}

function renderHtml(catalog: OutCatalog, css: string, bundle: string, iconDataUri: string): string {
  const catalogJson = escapeForScriptTag(JSON.stringify(catalog));
  const meta = catalog.meta;
  const subtitle = `Catalog build ${meta.catalogBuild ?? "—"} · v${meta.version}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PangoScript Reference · PangoLint</title>
    <style>${css}</style>
  </head>
  <body>
    <header class="topbar">
      <img class="topbar__icon" src="${iconDataUri}" alt="" />
      <h1 class="topbar__title">PangoScript Reference</h1>
      <span class="topbar__subtitle">PangoLint</span>
      <span class="topbar__meta">${subtitle}</span>
    </header>
    <main id="reference-root"></main>
    <script id="reference-catalog" type="application/json">${catalogJson}</script>
    <script type="module">${bundle}</script>
  </body>
</html>
`;
}

function iconAsDataUri(): string {
  const buf = readFileSync(resolve(ROOT, "media/icon.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ── Entry ─────────────────────────────────────────────────────────
function main(): void {
  const catalog = buildCatalog();
  const css = readText("src/reference/styles.css");
  const bundle = buildBundle();
  const icon = iconAsDataUri();
  const html = renderHtml(catalog, css, bundle, icon);

  const out = resolve(ROOT, "media/reference/pangoscript-reference.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);

  const sizeMB = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(2);
  console.log(
    `[reference] wrote ${out} (${sizeMB} MB · ${catalog.commands.length} items · ${catalog.objects.length} objects)`,
  );
}

main();
