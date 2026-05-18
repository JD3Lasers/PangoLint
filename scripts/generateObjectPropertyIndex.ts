// Build data/pangoscript/object-tree/runtime-indexes/object-property-index.json
// from tracked Object Tree source facts.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CUE_COMMON_PROPERTIES, CUE_TYPES } from "../src/knowledge/cueProperties";
import type {
  ObjectPropertyAcceptedValue,
  ObjectPropertyAddressMetadata,
  ObjectPropertyBehaviorClassification,
  ObjectPropertyProbeContext,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueEvidence,
  ObjectPropertyValueMetadata,
  ObjectPropertyValueRange,
} from "../src/knowledge/objectPropertyIndex";

interface CachePathEntry {
  path: string;
  normalizedPath: string;
  root: string;
  property?: string;
  kind: "object" | "fx";
  osc?: string;
  searchText?: string;
  segments: string[];
  variantCount?: number;
  fx?: {
    qfxPanel?: string;
    cellCaption?: string;
    label?: string;
    channel?: string;
  };
}

interface CacheObjectTree {
  paths: CachePathEntry[];
  fxLabels?: FxEffectLabelFile;
}

interface FxEffectLabelFile {
  cells?: Record<
    string,
    {
      qfx_panel?: string;
      qfxPanel?: string;
      caption?: string;
      cellCaption?: string;
      effects?: Array<{
        index: number;
        label?: string;
        channel?: string;
      }>;
    }
  >;
}

interface FxCellLabel {
  qfxPanel?: string;
  cellCaption?: string;
}

interface FxEffectTypeReferenceEntry {
  addressForms?: string[];
  group?: string | null;
  label?: string;
  lookup?: {
    label?: string;
    group?: string;
  };
}

interface FxEffectMenuEntry {
  label?: string;
  group?: string;
}

interface CanonicalPathEntry {
  path: string;
  normalizedPath: string;
  root: string;
  kind: "object" | "fx";
  osc?: string;
  searchText?: string;
  observedCount: number;
  isGenericAlias: boolean;
  fx?: CachePathEntry["fx"];
}

interface OutputEntry {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: "object" | "fx";
  confidence: "observed";
  osc?: string;
  searchText: string;
  variantCount: number;
  variants: Array<{
    path: string;
    osc?: string;
    fx?: {
      qfxPanel?: string;
      cellCaption?: string;
      label?: string;
      channel?: string;
    };
  }>;
  fx?: {
    qfxPanel?: string;
    cellCaption?: string;
    label?: string;
    channel?: string;
  };
  addressMetadata?: ObjectPropertyAddressMetadata;
  probeContexts?: ObjectPropertyProbeContext[];
  valueMetadata?: ObjectPropertyValueMetadata;
  readbackMetadata?: ObjectPropertyReadbackMetadata;
  contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
  classification?: ObjectPropertyBehaviorClassification;
}

interface RangeOverlayFile {
  schemaVersion: 1;
  entries: RangeOverlayEntry[];
}

interface RangeOverlayEntry extends ObjectPropertyValueMetadata {
  path: string;
  contextId?: string;
}

interface ReadbackOverlayFile {
  schemaVersion: 1;
  entries: ReadbackOverlayEntry[];
}

interface ReadbackOverlayEntry extends ObjectPropertyReadbackMetadata {
  path: string;
}

interface ClassificationOverlayFile {
  schemaVersion: 1;
  entries: ClassificationOverlayEntry[];
}

interface ClassificationOverlayEntry extends ObjectPropertyBehaviorClassification {
  path: string;
}

interface CommandKnowledgeFile {
  commands: Record<string, CommandRangeCommand>;
}

interface CommandRangeCommand {
  canonical: string;
  evidenceLevel?: string;
  forms?: CommandRangeForm[];
  setsProperty?: string[];
}

interface CommandRangeForm {
  parameters?: CommandRangeParameter[];
}

interface CommandRangeParameter {
  name: string;
  type: "number" | "integer" | "float" | "string" | "boolean" | "variadic" | "unknown";
  range?: string;
  valueRange?: ObjectPropertyValueRange & { evidenceLevel?: string };
  acceptedValues?: ObjectPropertyAcceptedValue[];
}

interface CommandRangeCandidate {
  path: string;
  command: string;
  parameter: CommandRangeParameter;
}

const repoRoot = path.resolve(__dirname, "..");
const objectPathSourceFactsRelativePath = "data/pangoscript/object-tree/source-facts/object-paths.json";
const inputPath = path.join(repoRoot, ...objectPathSourceFactsRelativePath.split("/"));
const outputPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "object-property-index.json",
);
const commandKnowledgePath = path.join(repoRoot, "data", "pangoscript", "commands.merged.json");
const fxEffectTypeReferencePath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "control-reference",
  "object-control-reference",
  "fx-effect-types.json",
);
const objectTreeSourceFactsPath = path.join(repoRoot, "data", "pangoscript", "object-tree", "source-facts");
const rangeOverlayDirectory = path.join(objectTreeSourceFactsPath, "value-metadata");
const rangeOverlayPath = path.join(rangeOverlayDirectory, "root.json");
const readbackOverlayDirectory = path.join(objectTreeSourceFactsPath, "readback-metadata");
const readbackOverlayPath = path.join(readbackOverlayDirectory, "root.json");
const classificationOverlayDirectory = path.join(objectTreeSourceFactsPath, "behavior-metadata");
const classificationOverlayPath = path.join(classificationOverlayDirectory, "root.json");
const customUniverseRoots = new Set(["COLORPICKER", "HardwareMuter", "SHOWKONTROL"]);
const zoneAliasRoot = "ZoneAlias";
const universeAliasRoot = "UniversePanelAlias";
const universeControlSegment = "Control";
const objectTreePathCorrections = new Map([
  ["Config.Scan RateSliderMax", { path: "Config.ScanRateSliderMax", osc: "/b/Config/ScanRateSliderMax" }],
]);

const cache = JSON.parse(readFileSync(inputPath, "utf8")) as CacheObjectTree;
const fxEffectLabels = loadFxEffectLabels(cache);
const fxCellLabels = loadFxCellLabels(cache);
const fxEffectMenuEntries = loadFxEffectMenuEntries(fxEffectTypeReferencePath);
const grouped = new Map<string, CanonicalPathEntry[]>();

for (const entry of cache.paths) {
  const canonicalEntry = canonicalizeEntry(entry);
  const groupKey = canonicalEntry.normalizedPath.toLowerCase();
  const group = grouped.get(groupKey) ?? [];
  group.push(canonicalEntry);
  grouped.set(groupKey, group);
}

const generatedEntries = withUniverseZonePadByNameNumericVariants(
  [...grouped.values()]
    .map((group) => buildEntry(preferredNormalizedPath(group), group))
    .map(applyManualRuntimeCorrection),
);

const entries = generatedEntries
  .concat(universeZonePadByNameEntries(generatedEntries, new Set(generatedEntries.map((entry) => entry.path))))
  .concat(manualRuntimeEntries(new Set(generatedEntries.map((entry) => entry.path))))
  .concat(cueGridEntries(new Set(generatedEntries.map((entry) => entry.path))))
  .sort((a, b) => a.path.localeCompare(b.path));

applyCommandRangeSeeds(entries, loadCommandKnowledge(commandKnowledgePath));
applyRangeOverlay(entries, loadRangeOverlays(rangeOverlayPath, rangeOverlayDirectory));
applyReadbackOverlay(entries, loadReadbackOverlays(readbackOverlayPath, readbackOverlayDirectory));
applyClassificationOverlay(
  entries,
  loadClassificationOverlays(classificationOverlayPath, classificationOverlayDirectory),
);

const output = {
  schemaVersion: 1,
  entries,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${entries.length} entries)`);

function buildEntry(normalizedPath: string, group: CanonicalPathEntry[]): OutputEntry {
  const sortedGroup = [...group].sort((a, b) => a.path.localeCompare(b.path));
  const first = sortedGroup[0];
  const normalizedSegments = normalizedPath.split(".").filter(Boolean);
  const isGenericAlias = sortedGroup.some((entry) => entry.isGenericAlias);
  const variants = isGenericAlias
    ? [{ path: normalizedPath }]
    : sortedGroup.map((entry) => ({
        path: entry.path,
        ...(entry.osc ? { osc: entry.osc } : {}),
        ...(entry.fx ? { fx: compactFx(entry.fx) } : {}),
      }));
  const fxMetadata = first.fx ? compactFx(first.fx) : undefined;
  const addressMetadata = isGenericAlias ? aliasAddressMetadataForRoot(normalizedSegments[0] ?? first.root) : undefined;
  const probeContexts =
    normalizedPath === "FX.N.N.Name"
      ? fxCellProbeContexts(sortedGroup)
      : normalizedPath.startsWith("FX.N.N.N.")
        ? fxProbeContexts(sortedGroup)
        : [];
  const variantCount = sortedGroup.reduce((total, entry) => total + entry.observedCount, 0);

  const entry: OutputEntry = {
    path: normalizedPath,
    normalizedPath,
    root: normalizedSegments[0] ?? first.root,
    property: propertyPath(normalizedSegments, first.kind),
    kind: first.kind,
    confidence: "observed",
    ...(!isGenericAlias && first.osc ? { osc: first.osc } : {}),
    searchText: addressMetadata
      ? mergeSearchText(buildSearchText(normalizedPath, sortedGroup), aliasAddressSearchText(addressMetadata))
      : buildSearchText(normalizedPath, sortedGroup),
    variantCount,
    variants,
    ...(fxMetadata ? { fx: fxMetadata } : {}),
    ...(addressMetadata ? { addressMetadata } : {}),
    ...(probeContexts.length ? { probeContexts } : {}),
  };

  return entry;
}

function preferredNormalizedPath(group: CanonicalPathEntry[]): string {
  return [...group].sort(
    (a, b) => b.observedCount - a.observedCount || a.normalizedPath.localeCompare(b.normalizedPath),
  )[0].normalizedPath;
}

function applyManualRuntimeCorrection(entry: OutputEntry): OutputEntry {
  if (entry.path !== "DmxOutput.N") return entry;

  const variants = Array.from({ length: 2047 }, (_, index) => ({
    path: `DmxOutput.${index}`,
    osc: `/b/DmxOutput/${index}`,
  }));

  return {
    ...entry,
    searchText: mergeSearchText(
      entry.searchText,
      "runtime observed dmx output flat array four universes indices 0 through 2046 dmxoutput 2046",
    ),
    variantCount: variants.length,
    variants,
  };
}

function withUniverseZonePadByNameNumericVariants(entries: OutputEntry[]): OutputEntry[] {
  const zonePadByNameSuffixes = new Set(
    entries
      .filter((entry) => entry.path.startsWith("Universe.N.ZonePad1."))
      .map((entry) => entry.path.slice("Universe.N.ZonePad1.".length)),
  );

  return entries.map((entry) => {
    const suffix = entry.path.startsWith("Universe.N.N.") ? entry.path.slice("Universe.N.N.".length) : undefined;
    if (!suffix || !zonePadByNameSuffixes.has(suffix)) return entry;

    const variantPath = `Universe.0.23.${suffix}`;
    if (entry.variants.some((variant) => variant.path === variantPath)) return entry;

    const variant = {
      path: variantPath,
      osc: `/b/Universe/0/23/${suffix.replace(/\./g, "/")}`,
    };

    return {
      ...entry,
      variantCount: entry.variantCount + 1,
      variants: [...entry.variants, variant].sort((a, b) => a.path.localeCompare(b.path)),
      searchText: mergeSearchText(
        entry.searchText,
        `${variantPath} ${variant.osc} zonepad2 projection zone by name component`,
      ),
    };
  });
}

function universeZonePadByNameEntries(sourceEntries: OutputEntry[], existingPaths: Set<string>): OutputEntry[] {
  const entries: OutputEntry[] = [];

  for (const source of sourceEntries) {
    if (!source.path.startsWith("Universe.N.ZonePad1.")) continue;

    const suffix = source.path.slice("Universe.N.ZonePad1.".length);
    const normalizedPath = `Universe.N.ZonePad2.${suffix}`;
    if (existingPaths.has(normalizedPath)) continue;

    const concretePath = `Universe.0.ZonePad2.${suffix}`;
    const osc = `/b/Universe/0/ZonePad2/${suffix.replace(/\./g, "/")}`;
    const segments = splitPath(normalizedPath);

    entries.push({
      path: normalizedPath,
      normalizedPath,
      root: "Universe",
      property: propertyPath(segments, "object"),
      kind: "object",
      confidence: "observed",
      osc,
      searchText: mergeSearchText(
        `${normalizedPath} ${splitCamel(normalizedPath)} ${concretePath} ${osc}`,
        "zonepad2 projection zone by name named zone target",
      ),
      variantCount: 1,
      variants: [{ path: concretePath, osc }],
    });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function manualRuntimeEntries(existingPaths: Set<string>): OutputEntry[] {
  const entries: OutputEntry[] = [
    {
      path: "Master.ShowShift",
      normalizedPath: "Master.ShowShift",
      root: "Master",
      property: "ShowShift",
      kind: "object",
      confidence: "observed",
      osc: "/b/Master/ShowShift",
      searchText: "master show shift show timing milliseconds seconds readback mastershowshift",
      variantCount: 1,
      variants: [{ path: "Master.ShowShift", osc: "/b/Master/ShowShift" }],
    },
  ];
  return entries.filter((entry) => !existingPaths.has(entry.path));
}

function cueGridEntries(existingPaths: Set<string>): OutputEntry[] {
  const cueTypeContexts = CUE_TYPES.map((cueType, index) => cueTypeProbeContext(cueType.label, index));
  const parametricCueType = CUE_TYPES.find((cueType) => cueType.label === "Parametric-Image");
  const cueShapeContexts =
    parametricCueType?.shapes?.map((shape, index) =>
      cueShapeProbeContext(parametricCueType.label, shape.label, index),
    ) ?? [];

  const evidenceByProperty = new Map<
    string,
    { evidence: Set<string>; contexts: Map<string, ObjectPropertyProbeContext> }
  >();
  const add = (property: string, evidence: string, contexts: readonly ObjectPropertyProbeContext[]) => {
    const existing = evidenceByProperty.get(property) ?? {
      evidence: new Set<string>(),
      contexts: new Map<string, ObjectPropertyProbeContext>(),
    };
    existing.evidence.add(evidence);
    for (const context of contexts) existing.contexts.set(context.id, context);
    evidenceByProperty.set(property, existing);
  };

  for (const property of CUE_COMMON_PROPERTIES) {
    add(property, "common cue property", cueTypeContexts);
  }
  for (const [cueTypeIndex, cueType] of CUE_TYPES.entries()) {
    const cueTypeContext = cueTypeContexts[cueTypeIndex];
    for (const property of cueType.uniqueProperties) {
      add(property, `cue type ${cueType.label}`, cueTypeContext ? [cueTypeContext] : []);
    }
    for (const [shapeIndex, shape] of (cueType.shapes ?? []).entries()) {
      const shapeContext = cueShapeContexts[shapeIndex];
      for (const property of shape.uniqueProperties) {
        add(property, `cue type ${cueType.label} shape ${shape.label}`, shapeContext ? [shapeContext] : []);
      }
    }
  }

  return [...evidenceByProperty.entries()]
    .map(([property, metadata]) => {
      const path = `WS.N.N.${property}`;
      const probeContexts = [...metadata.contexts.values()].sort(compareProbeContexts);
      const variants = probeContexts.map((context) => ({
        path: probePath(context, property),
        osc: probeOsc(context, property),
      }));
      const firstVariant = variants[0];
      const evidenceText = [...metadata.evidence].join(" ");
      return {
        path,
        normalizedPath: path,
        root: "WS",
        property,
        kind: "object" as const,
        confidence: "observed" as const,
        ...(firstVariant?.osc ? { osc: firstVariant.osc } : {}),
        searchText: mergeSearchText(
          `${path} ${splitCamel(property)} workspace ws cue grid page cue page index cue index`,
          `${evidenceText} ${probeContextSearchText(probeContexts)}`,
        ),
        variantCount: variants.length,
        variants,
        ...(probeContexts.length ? { probeContexts } : {}),
      };
    })
    .filter((entry) => !existingPaths.has(entry.path));
}

function cueTypeProbeContext(label: string, cueIndex: number): ObjectPropertyProbeContext {
  return {
    id: `cue-type:${slug(label)}`,
    kind: "cue-type",
    label,
    normalizedPrefix: "WS.N.N",
    probePrefix: `WS.0.${cueIndex}`,
    probeOscPrefix: `/b/WS/0/${cueIndex}`,
    populationDependent: true,
    notes: "Sample workspace cue slot for this cue type.",
  };
}

function cueShapeProbeContext(parentLabel: string, label: string, cueIndex: number): ObjectPropertyProbeContext {
  return {
    id: `cue-shape:${slug(parentLabel)}:${slug(label)}`,
    kind: "cue-shape",
    label,
    parentLabel,
    normalizedPrefix: "WS.N.N",
    probePrefix: `WS.1.${cueIndex}`,
    probeOscPrefix: `/b/WS/1/${cueIndex}`,
    populationDependent: true,
    notes: "Sample workspace cue slot for this Parametric-Image shape.",
  };
}

function fxProbeContexts(group: CanonicalPathEntry[]): ObjectPropertyProbeContext[] {
  const contexts = new Map<string, ObjectPropertyProbeContext>();
  for (const entry of group) {
    if (!entry.fx) continue;
    const segments = splitPath(entry.path);
    if (segments.length < 5 || segments[0] !== "FX") continue;
    const probePrefix = segments.slice(0, 4).join(".");
    const menuEntry = fxEffectMenuEntries.get(probePrefix);
    const sourceParentLabel = fxParentLabel(entry.fx);
    const sourceLabel =
      entry.fx.channel ?? fxLabelSuffix(entry.fx.label) ?? fxFirstLabelClause(entry.fx.label) ?? probePrefix;
    const parentLabel = menuEntry?.group ?? sourceParentLabel;
    const label = menuEntry?.label ?? sourceLabel;
    const id = `quickfx:${slug(sourceParentLabel ?? "effect")}:${slug(sourceLabel)}:${slug(probePrefix)}`;
    contexts.set(id, {
      id,
      kind: "quickfx-effect",
      label,
      ...(parentLabel ? { parentLabel } : {}),
      normalizedPrefix: "FX.N.N.N",
      probePrefix,
      ...(entry.osc ? { probeOscPrefix: entry.osc.split("/").slice(0, 6).join("/") } : {}),
      populationDependent: true,
      ...(entry.fx.qfxPanel ? { qfxPanel: entry.fx.qfxPanel } : {}),
      ...(entry.fx.cellCaption ? { cellCaption: entry.fx.cellCaption } : {}),
      ...(entry.fx.channel ? { channel: entry.fx.channel } : {}),
      notes: "Sample QuickFX effect slot for this effect placement.",
    });
  }
  return [...contexts.values()].sort(compareProbeContexts);
}

function loadFxEffectMenuEntries(filePath: string): Map<string, FxEffectMenuEntry> {
  if (!existsSync(filePath)) return new Map();
  const entries = JSON.parse(readFileSync(filePath, "utf8")) as FxEffectTypeReferenceEntry[];
  const labels = new Map<string, FxEffectMenuEntry>();
  for (const entry of entries) {
    const label = entry.lookup?.label ?? entry.label;
    const group = entry.lookup?.group ?? entry.group ?? undefined;
    for (const address of entry.addressForms ?? []) {
      const segments = splitPath(address);
      if (segments.length !== 4 || segments[0] !== "FX") continue;
      labels.set(segments.join("."), {
        ...(label ? { label } : {}),
        ...(group ? { group } : {}),
      });
    }
  }
  return labels;
}

function fxCellProbeContexts(group: CanonicalPathEntry[]): ObjectPropertyProbeContext[] {
  const contexts = new Map<string, ObjectPropertyProbeContext>();
  for (const entry of group) {
    const segments = splitPath(entry.path);
    if (segments.length !== 4 || segments[0] !== "FX" || segments[3] !== "Name") continue;
    const probePrefix = segments.slice(0, 3).join(".");
    const oscPrefix = entry.osc?.split("/").slice(0, 5).join("/");
    const cell = fxCellLabels.get(probePrefix);
    const label = cell?.cellCaption || probePrefix;
    const id = `quickfx-cell:${slug(probePrefix)}`;
    contexts.set(id, {
      id,
      kind: "quickfx-cell",
      label,
      normalizedPrefix: "FX.N.N",
      probePrefix,
      ...(oscPrefix ? { probeOscPrefix: oscPrefix } : {}),
      populationDependent: true,
      ...(cell?.qfxPanel ? { qfxPanel: cell.qfxPanel } : {}),
      ...(cell?.cellCaption ? { cellCaption: cell.cellCaption } : {}),
      notes: "Sample QuickFX cell slot for this cell name placement.",
    });
  }
  return [...contexts.values()].sort(compareProbeContexts);
}

function loadFxEffectLabels(sourceFacts: CacheObjectTree): Map<string, NonNullable<CachePathEntry["fx"]>> {
  const labels = new Map<string, NonNullable<CachePathEntry["fx"]>>();
  for (const entry of sourceFacts.paths) {
    const segments = splitPath(entry.path);
    if (!entry.fx || segments.length < 4 || segments[0] !== "FX") continue;
    labels.set(segments.slice(0, 4).join("."), {
      ...(entry.fx.qfxPanel ? { qfxPanel: entry.fx.qfxPanel } : {}),
      ...(entry.fx.cellCaption ? { cellCaption: entry.fx.cellCaption } : {}),
      ...(entry.fx.label ? { label: entry.fx.label } : {}),
      ...(entry.fx.channel ? { channel: entry.fx.channel } : {}),
    });
  }
  for (const [cell, cellInfo] of Object.entries(sourceFacts.fxLabels?.cells ?? {})) {
    const [row, column] = cell.split(".");
    if (row === undefined || column === undefined) continue;
    for (const effect of cellInfo.effects ?? []) {
      const key = `FX.${row}.${column}.${effect.index}`;
      const existing = labels.get(key) ?? {};
      const qfxPanel = cellInfo.qfxPanel ?? cellInfo.qfx_panel ?? existing.qfxPanel;
      const cellCaption = cellInfo.cellCaption ?? cellInfo.caption ?? existing.cellCaption;
      labels.set(key, {
        ...(qfxPanel ? { qfxPanel } : {}),
        ...(cellCaption ? { cellCaption } : {}),
        ...(effect.label ? { label: effect.label } : {}),
        ...(effect.channel ? { channel: effect.channel } : {}),
      });
    }
  }
  return labels;
}

function loadFxCellLabels(sourceFacts: CacheObjectTree): Map<string, FxCellLabel> {
  const labels = new Map<string, FxCellLabel>();
  for (const entry of sourceFacts.paths) {
    const segments = splitPath(entry.path);
    if (!entry.fx || segments.length < 4 || segments[0] !== "FX") continue;
    const key = segments.slice(0, 3).join(".");
    const existing = labels.get(key) ?? {};
    labels.set(key, {
      ...(existing.qfxPanel ? { qfxPanel: existing.qfxPanel } : {}),
      ...(existing.cellCaption ? { cellCaption: existing.cellCaption } : {}),
      ...(entry.fx.qfxPanel ? { qfxPanel: entry.fx.qfxPanel } : {}),
      ...(entry.fx.cellCaption ? { cellCaption: entry.fx.cellCaption } : {}),
    });
  }
  for (const [cell, cellInfo] of Object.entries(sourceFacts.fxLabels?.cells ?? {})) {
    const [row, column] = cell.split(".");
    if (row === undefined || column === undefined) continue;
    const key = `FX.${row}.${column}`;
    const existing = labels.get(key) ?? {};
    labels.set(key, {
      ...(existing.qfxPanel ? { qfxPanel: existing.qfxPanel } : {}),
      ...(existing.cellCaption ? { cellCaption: existing.cellCaption } : {}),
      ...((cellInfo.qfxPanel ?? cellInfo.qfx_panel) ? { qfxPanel: cellInfo.qfxPanel ?? cellInfo.qfx_panel } : {}),
      ...((cellInfo.cellCaption ?? cellInfo.caption) ? { cellCaption: cellInfo.cellCaption ?? cellInfo.caption } : {}),
    });
  }
  return labels;
}

function fxEffectMetadataForPath(pathValue: string): NonNullable<CachePathEntry["fx"]> | undefined {
  const segments = splitPath(pathValue);
  if (segments.length < 4 || segments[0] !== "FX") return undefined;
  return fxEffectLabels.get(segments.slice(0, 4).join("."));
}

function mergeFxMetadata(
  primary: CachePathEntry["fx"],
  fallback: CachePathEntry["fx"],
): CachePathEntry["fx"] | undefined {
  if (!primary && !fallback) return undefined;
  return {
    ...(fallback ?? {}),
    ...(primary ?? {}),
  };
}

function compareProbeContexts(left: ObjectPropertyProbeContext, right: ObjectPropertyProbeContext): number {
  return (
    compareDottedPath(left.probePrefix, right.probePrefix) ||
    left.kind.localeCompare(right.kind) ||
    (left.parentLabel ?? "").localeCompare(right.parentLabel ?? "") ||
    left.label.localeCompare(right.label) ||
    left.probePrefix.localeCompare(right.probePrefix, undefined, { numeric: true })
  );
}

function compareDottedPath(left: string, right: string): number {
  const leftParts = splitPath(left);
  const rightParts = splitPath(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

function probePath(context: ObjectPropertyProbeContext, property: string): string {
  return `${context.probePrefix}.${property}`;
}

function probeOsc(context: ObjectPropertyProbeContext, property: string): string | undefined {
  return context.probeOscPrefix ? `${context.probeOscPrefix}/${property.replaceAll(".", "/")}` : undefined;
}

function probeContextSearchText(contexts: readonly ObjectPropertyProbeContext[]): string {
  return contexts
    .flatMap((context) => [
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
      context.populationDependent ? "population dependent sample probe location" : undefined,
    ])
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function fxParentLabel(fx: NonNullable<CachePathEntry["fx"]>): string | undefined {
  const label = fx.label ?? "";
  const dash = label.indexOf(" - ");
  if (dash > 0) return label.slice(0, dash).trim();
  const comma = label.indexOf(",");
  if (comma > 0) return label.slice(0, comma).trim();
  return fx.qfxPanel;
}

function fxFirstLabelClause(label: string | undefined): string | undefined {
  return label?.split(",")[0]?.trim();
}

function fxLabelSuffix(label: string | undefined): string | undefined {
  const dash = label?.indexOf(" - ");
  if (dash === undefined || dash < 0) return undefined;
  return label?.slice(dash + 3).trim();
}

function canonicalizeEntry(entry: CachePathEntry): CanonicalPathEntry {
  const sourceSegments = canonicalSegments(
    Array.isArray(entry.segments) && entry.segments.length > 0 ? entry.segments : splitPath(entry.path),
  );
  const correction = objectTreePathCorrections.get(sourceSegments.join("."));
  const segments = correction ? splitPath(correction.path) : sourceSegments;
  const canonicalPath = segments.join(".");
  const root = segments[0] ?? entry.root;
  const isGenericAlias = isGenericAliasRoot(root);
  const correctedOsc = correction?.osc ?? entry.osc;
  const osc = isRedactedHardwareRoot(root) ? undefined : redactPublicHardwareIdentifier(correctedOsc);
  const searchText = redactPublicSearchText(isGenericAlias ? canonicalPath : entry.searchText, root);
  const fx = mergeFxMetadata(entry.fx, fxEffectMetadataForPath(canonicalPath));
  return {
    path: canonicalPath,
    normalizedPath: normalizePath(canonicalPath),
    root,
    kind: root === "FX" ? "fx" : entry.kind,
    ...(!isGenericAlias && osc ? { osc } : {}),
    searchText,
    observedCount: Math.max(1, entry.variantCount ?? 1),
    isGenericAlias,
    ...(fx ? { fx } : {}),
  };
}

function canonicalSegments(segments: string[]): string[] {
  if (segments.length === 0) return segments;
  const root = segments[0];
  const hardwareRoot = canonicalHardwareRoot(root);
  if (hardwareRoot) {
    return [hardwareRoot, ...segments.slice(1)];
  }
  if (isDashWrappedName(root)) {
    return [zoneAliasRoot, ...segments.slice(1)];
  }
  if (customUniverseRoots.has(root) && segments.length >= 2) {
    return [universeAliasRoot, universeControlSegment, ...segments.slice(2)];
  }
  return segments;
}

function canonicalHardwareRoot(root: string): string | undefined {
  const match = /^FB([34])[_-]\d+$/.exec(root);
  if (!match) return undefined;
  return `FB${match[1]}-XXXXX`;
}

function redactPublicHardwareIdentifier(value: string | undefined): string | undefined {
  return value?.replace(/\bFB([34])_\d+\b/g, "FB$1_XXXXX").replace(/\bFB([34])-\d+\b/g, "FB$1-XXXXX");
}

function redactPublicSearchText(value: string | undefined, root: string): string | undefined {
  const redacted = redactPublicHardwareIdentifier(value);
  if (!redacted || !/^FB[34]-XXXXX$/.test(root)) return redacted;
  return tokenize(redacted)
    .filter((token) => !/^\d{4,}$/.test(token))
    .join(" ");
}

function isDashWrappedName(segment: string): boolean {
  return segment.length > 6 && segment.startsWith("---") && segment.endsWith("---");
}

function isGenericAliasRoot(root: string): boolean {
  return root === zoneAliasRoot || root === universeAliasRoot;
}

function aliasAddressMetadataForRoot(root: string): ObjectPropertyAddressMetadata | undefined {
  if (root === zoneAliasRoot) {
    return {
      mode: "user-configured-name",
      placeholder: zoneAliasRoot,
      aliasOf: "Zone.N",
      userConfigured: true,
    };
  }
  if (root === universeAliasRoot) {
    return {
      mode: "user-configured-name",
      placeholder: universeAliasRoot,
      aliasOf: "Universe.N",
      userConfigured: true,
      componentPlaceholder: universeControlSegment,
    };
  }
  return undefined;
}

function aliasAddressSearchText(metadata: ObjectPropertyAddressMetadata): string {
  return [
    metadata.mode,
    metadata.placeholder,
    metadata.aliasOf,
    metadata.componentPlaceholder,
    metadata.userConfigured ? "user configured user defined name alias placeholder replace variable" : "",
    metadata.placeholder === zoneAliasRoot ? "projection zone" : "",
    metadata.placeholder === universeAliasRoot ? "universe panel component control" : "",
  ].join(" ");
}

function isRedactedHardwareRoot(root: string): boolean {
  return /^FB[34]-XXXXX$/.test(root);
}

function splitPath(identifier: string): string[] {
  return identifier.split(".").filter(Boolean);
}

function normalizePath(identifier: string): string {
  return splitPath(identifier)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return "N";
      if (/^#\d+$/.test(segment)) return "#N";
      return segment;
    })
    .join(".");
}

function propertyPath(segments: string[], kind: "object" | "fx"): string {
  if (kind === "fx" && segments[0] === "FX" && segments.length > 4) {
    return segments.slice(4).join(".");
  }
  if ((segments[1] === "N" || segments[1] === "#N") && segments.length > 2) {
    return segments.slice(2).join(".");
  }
  return segments.slice(1).join(".") || segments[0] || "";
}

function buildSearchText(normalizedPath: string, group: CanonicalPathEntry[]): string {
  const tokens = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    for (const token of tokenize(value)) tokens.add(token);
  };

  add(normalizedPath);
  add(splitCamel(normalizedPath));
  for (const entry of group) {
    add(entry.path);
    if (!entry.isGenericAlias) {
      add(entry.osc);
      add(entry.searchText);
    }
    add(entry.root);
    add(entry.fx?.qfxPanel);
    add(entry.fx?.cellCaption);
    add(entry.fx?.label);
    add(entry.fx?.channel);
  }
  return [...tokens].join(" ");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
}

function mergeSearchText(left: string, right: string): string {
  return [...new Set(tokenize(`${left} ${right}`))].join(" ");
}

function splitCamel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed"
  );
}

function compactFx(fx: NonNullable<CachePathEntry["fx"]>) {
  return {
    ...(fx.qfxPanel ? { qfxPanel: fx.qfxPanel } : {}),
    ...(fx.cellCaption ? { cellCaption: fx.cellCaption } : {}),
    ...(fx.label ? { label: fx.label } : {}),
    ...(fx.channel ? { channel: fx.channel } : {}),
  };
}

function loadCommandKnowledge(filePath: string): CommandKnowledgeFile {
  return JSON.parse(readFileSync(filePath, "utf8")) as CommandKnowledgeFile;
}

function applyCommandRangeSeeds(entries: OutputEntry[], commandKnowledge: CommandKnowledgeFile): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const candidatesByPath = new Map<string, CommandRangeCandidate[]>();
  for (const command of Object.values(commandKnowledge.commands)) {
    const candidates = commandRangeCandidates(command, byPath);
    for (const candidate of candidates) {
      const bucket = candidatesByPath.get(candidate.path) ?? [];
      bucket.push(candidate);
      candidatesByPath.set(candidate.path, bucket);
    }
  }

  for (const [pathValue, candidates] of candidatesByPath) {
    const entry = byPath.get(pathValue);
    if (!entry || entry.valueMetadata) continue;
    const candidate = [...candidates].sort(compareCommandRangeCandidates)[0];
    const metadata = commandCandidateValueMetadata(candidate);
    entry.valueMetadata = metadata;
    entry.searchText = mergeSearchText(entry.searchText, commandCandidateSearchText(candidate, metadata));
  }
}

function commandRangeCandidates(
  command: CommandRangeCommand,
  entriesByPath: ReadonlyMap<string, OutputEntry>,
): CommandRangeCandidate[] {
  const paths = (command.setsProperty ?? []).filter((pathValue) => entriesByPath.has(pathValue));
  if (paths.length === 0 || isSelectorOnlyCommand(command.canonical)) return [];

  const candidates: CommandRangeCandidate[] = [];
  for (const form of command.forms ?? []) {
    const params = (form.parameters ?? []).filter(hasRangeMetadata);
    if (params.length === 0) continue;
    candidates.push(...mappedCommandRangeCandidates(command.canonical, paths, params));
  }
  return candidates;
}

function mappedCommandRangeCandidates(
  command: string,
  paths: readonly string[],
  params: readonly CommandRangeParameter[],
): CommandRangeCandidate[] {
  const candidate = (pathValue: string, param: CommandRangeParameter | undefined): CommandRangeCandidate[] =>
    pathValue && param ? [{ path: pathValue, command, parameter: param }] : [];
  const param = (name: string) => params.find((item) => item.name === name);

  if (command === "SetCueCaptionColor") {
    return candidate("WS.N.N.CaptionColor", param("packedColor"));
  }
  if (command === "SetGridSize") {
    const columnsRows = setGridSizeCountParameter(param("columns"), param("rows"));
    return [
      ...candidate("Grid.GetColCount", param("columns")),
      ...candidate("Grid.GetRowCount", param("rows")),
      ...candidate("Grid.Count", columnsRows),
    ];
  }
  if (command === "PositionIndex" || command === "SizeIndex") {
    return paths.flatMap((pathValue) => candidate(pathValue, param("value")));
  }
  if (command === "RGBA" || command === "RGBADelta") {
    return [
      ...candidate("Master.Red", param("r") ?? param("value")),
      ...candidate("Master.Green", param("g") ?? param("value")),
      ...candidate("Master.Blue", param("b") ?? param("value")),
      ...candidate("Master.Alpha", param("a") ?? param("value")),
    ];
  }
  if (command === "ZoneFXTimeScale" || command === "ZoneFXTimeShift") {
    return paths.flatMap((pathValue) => {
      if (pathValue.includes("Clock")) return candidate(pathValue, param("clockMul"));
      if (pathValue.includes("Metro")) return candidate(pathValue, param("metroMul"));
      return [];
    });
  }
  if (params.length === 1) {
    return paths.flatMap((pathValue) => candidate(pathValue, params[0]));
  }
  if (params.length === paths.length) {
    return paths.flatMap((pathValue, index) => candidate(pathValue, params[index]));
  }
  return [];
}

function hasRangeMetadata(param: CommandRangeParameter): boolean {
  return Boolean(param.valueRange || param.acceptedValues?.length);
}

function isSelectorOnlyCommand(command: string): boolean {
  return (
    command === "MuteZonesOfProjector" ||
    command === "ToggleMuteZoneOfProjector" ||
    command === "UnMuteZonesOfProjector"
  );
}

function setGridSizeCountParameter(
  columns: CommandRangeParameter | undefined,
  rows: CommandRangeParameter | undefined,
): CommandRangeParameter | undefined {
  if (!columns?.valueRange || !rows?.valueRange) return undefined;
  return {
    name: "columnsRows",
    type: "integer",
    valueRange: {
      min: 1,
      max: 256,
      unit: "cue slots",
      boundaryBehavior: "unknown",
      evidenceLevel: "inferred",
      notes:
        "Derived from SetGridSize columns and rows, each observed as 1..16. Grid.Count is the resulting cell count, so this range is inferred from exact command metadata rather than independently probed as a direct SetProp range.",
    },
  };
}

function compareCommandRangeCandidates(left: CommandRangeCandidate, right: CommandRangeCandidate): number {
  return (
    commandRangeCandidateScore(right) - commandRangeCandidateScore(left) || left.command.localeCompare(right.command)
  );
}

function commandRangeCandidateScore(candidate: CommandRangeCandidate): number {
  let score = 0;
  if (!isDeltaCandidate(candidate)) score += 80;
  if (propertyParameterMatches(candidate.path, candidate.parameter.name)) score += 60;
  if (candidate.parameter.valueRange?.min !== undefined || candidate.parameter.valueRange?.max !== undefined)
    score += 20;
  if (candidate.parameter.acceptedValues?.length) score += 5;
  if (candidate.parameter.name === "value") score += 3;
  return score;
}

function isDeltaCandidate(candidate: CommandRangeCandidate): boolean {
  return /delta|relative/i.test(
    `${candidate.command} ${candidate.parameter.name} ${candidate.parameter.range ?? ""} ${
      candidate.parameter.valueRange?.unit ?? ""
    }`,
  );
}

function propertyParameterMatches(pathValue: string, parameterName: string): boolean {
  const leaf = splitPath(pathValue).at(-1)?.toLowerCase();
  const parameter = parameterName.toLowerCase();
  if (!leaf) return false;
  if (leaf === parameter) return true;
  const aliases: Record<string, string[]> = {
    alpha: ["a", "enabled"],
    blue: ["b"],
    captioncolor: ["packedcolor"],
    count: ["columnsrows"],
    getcolcount: ["columns"],
    getrowcount: ["rows"],
    green: ["g"],
    red: ["r"],
    rgbcolor: ["packedcolor"],
  };
  return aliases[leaf]?.includes(parameter) ?? false;
}

function commandCandidateValueMetadata(candidate: CommandRangeCandidate): ObjectPropertyValueMetadata {
  const rangeEvidence = toObjectValueEvidence(candidate.parameter.valueRange?.evidenceLevel);
  const evidenceLevel = rangeEvidence ?? "inferred";
  return {
    valueType: commandParameterValueType(candidate.parameter.type),
    ...(candidate.parameter.valueRange ? { valueRange: commandValueRange(candidate.parameter.valueRange) } : {}),
    ...(candidate.parameter.acceptedValues?.length
      ? { acceptedValues: candidate.parameter.acceptedValues.map((value) => ({ ...value })) }
      : {}),
    evidenceLevel,
    notes: `Command-derived seed from ${candidate.command} ${candidate.parameter.name} parameter for exact setsProperty target. This is not same-name propagation.`,
  };
}

function commandParameterValueType(
  type: CommandRangeParameter["type"],
): NonNullable<ObjectPropertyValueMetadata["valueType"]> {
  return type === "variadic" ? "unknown" : type;
}

function commandValueRange(range: NonNullable<CommandRangeParameter["valueRange"]>): ObjectPropertyValueRange {
  return {
    ...(range.min !== undefined ? { min: range.min } : {}),
    ...(range.max !== undefined ? { max: range.max } : {}),
    ...(range.minInclusive !== undefined ? { minInclusive: range.minInclusive } : {}),
    ...(range.maxInclusive !== undefined ? { maxInclusive: range.maxInclusive } : {}),
    ...(range.unit ? { unit: range.unit } : {}),
    ...(range.boundaryBehavior ? { boundaryBehavior: range.boundaryBehavior } : {}),
    ...(toObjectValueEvidence(range.evidenceLevel)
      ? { evidenceLevel: toObjectValueEvidence(range.evidenceLevel) }
      : {}),
    ...(range.notes ? { notes: range.notes } : {}),
  };
}

function toObjectValueEvidence(value: string | undefined): ObjectPropertyValueEvidence | undefined {
  if (value === "documented" || value === "observed" || value === "inferred" || value === "unverified") return value;
  return undefined;
}

function commandCandidateSearchText(candidate: CommandRangeCandidate, metadata: ObjectPropertyValueMetadata): string {
  return [
    "command derived exact setsproperty target",
    candidate.command,
    candidate.parameter.name,
    candidate.parameter.range,
    metadata.notes,
    valueMetadataSearchText(metadata),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function loadRangeOverlays(rootFilePath: string, directoryPath: string): RangeOverlayEntry[] {
  return rangeOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) => loadRangeOverlay(filePath));
}

function rangeOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [...sourcePaths, ...rangeOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath)];
}

function rangeOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return rangeOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadRangeOverlay(filePath: string): RangeOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as RangeOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

function applyRangeOverlay(entries: OutputEntry[], overlayEntries: RangeOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    const overlayKey = `${overlay.path}\u0000${overlay.contextId ?? ""}`;
    if (seen.has(overlayKey)) {
      throw new Error(`Duplicate object-property range metadata for ${overlay.path}${overlay.contextId ?? ""}`);
    }
    seen.add(overlayKey);
    const entry = byPath.get(overlay.path);
    if (!entry) throw new Error(`value metadata references unknown Object Tree path: ${overlay.path}`);
    const valueMetadata = toValueMetadata(overlay);
    if (overlay.contextId) {
      if (!entry.probeContexts?.some((context) => context.id === overlay.contextId)) {
        throw new Error(`${overlay.path} range metadata references unknown probe context: ${overlay.contextId}`);
      }
      entry.contextValueMetadata = [
        ...(entry.contextValueMetadata ?? []),
        { ...valueMetadata, contextId: overlay.contextId },
      ];
    } else {
      entry.valueMetadata = valueMetadata;
    }
    entry.searchText = mergeSearchText(entry.searchText, valueMetadataSearchText(valueMetadata));
  }
}

function loadReadbackOverlays(rootFilePath: string, directoryPath: string): ReadbackOverlayEntry[] {
  return readbackOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) => loadReadbackOverlay(filePath));
}

function readbackOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [...sourcePaths, ...readbackOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath)];
}

function readbackOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return readbackOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadReadbackOverlay(filePath: string): ReadbackOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ReadbackOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

function applyReadbackOverlay(entries: OutputEntry[], overlayEntries: ReadbackOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    if (seen.has(overlay.path)) {
      throw new Error(`Duplicate object-property readback metadata for ${overlay.path}`);
    }
    seen.add(overlay.path);
    const entry = byPath.get(overlay.path);
    if (!entry) throw new Error(`readback metadata references unknown Object Tree path: ${overlay.path}`);
    const readbackMetadata = toReadbackMetadata(overlay);
    entry.readbackMetadata = readbackMetadata;
    entry.searchText = mergeSearchText(entry.searchText, readbackMetadataSearchText(readbackMetadata));
  }
}

function loadClassificationOverlays(rootFilePath: string, directoryPath: string): ClassificationOverlayEntry[] {
  return classificationOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) =>
    loadClassificationOverlay(filePath),
  );
}

function classificationOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [
    ...sourcePaths,
    ...classificationOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath),
  ];
}

function classificationOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return classificationOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadClassificationOverlay(filePath: string): ClassificationOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ClassificationOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

function applyClassificationOverlay(entries: OutputEntry[], overlayEntries: ClassificationOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    if (seen.has(overlay.path)) {
      throw new Error(`Duplicate object-property behavior classification for ${overlay.path}`);
    }
    seen.add(overlay.path);
    const entry = byPath.get(overlay.path);
    if (!entry) {
      throw new Error(`behavior metadata references unknown Object Tree path: ${overlay.path}`);
    }
    const classification = toBehaviorClassification(overlay);
    entry.classification = classification;
    entry.searchText = mergeSearchText(entry.searchText, behaviorClassificationSearchText(classification));
  }
}

function toReadbackMetadata(entry: ReadbackOverlayEntry): ObjectPropertyReadbackMetadata {
  const { path: _path, ...metadata } = entry;
  validateReadbackMetadata(entry.path, metadata);
  return metadata;
}

function toBehaviorClassification(entry: ClassificationOverlayEntry): ObjectPropertyBehaviorClassification {
  const { path: _path, ...classification } = entry;
  validateBehaviorClassification(entry.path, classification);
  return classification;
}

function toValueMetadata(entry: RangeOverlayEntry): ObjectPropertyValueMetadata {
  const { contextId: _contextId, path: _path, ...metadata } = entry;
  validateValueMetadata(entry.path, metadata);
  return metadata;
}

function validateReadbackMetadata(pathValue: string, metadata: ObjectPropertyReadbackMetadata): void {
  if (metadata.readable !== true) {
    throw new Error(`${pathValue} readback metadata must set readable true`);
  }
  if (metadata.probeMode !== "readback-only") {
    throw new Error(`${pathValue} readback metadata must use readback-only probeMode`);
  }
  if (typeof metadata.probePath !== "string" || metadata.probePath.trim().length === 0) {
    throw new Error(`${pathValue} readback metadata requires a non-empty probePath`);
  }
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid readback evidenceLevel`);
  }
  if (
    metadata.valueType !== undefined &&
    !["number", "integer", "float", "string", "boolean", "enum", "unknown"].includes(metadata.valueType)
  ) {
    throw new Error(`${pathValue} has invalid readback valueType`);
  }
  if (metadata.typeTag !== undefined && !["f", "i", "s"].includes(metadata.typeTag)) {
    throw new Error(`${pathValue} has invalid readback typeTag`);
  }
  const observedValueType = typeof metadata.observedValue;
  if (
    metadata.observedValue !== undefined &&
    metadata.observedValue !== null &&
    !["string", "number", "boolean"].includes(observedValueType)
  ) {
    throw new Error(`${pathValue} observedValue must be string, number, boolean, or null`);
  }
  const locationKind = metadata.locationContext?.kind;
  if (
    locationKind !== undefined &&
    !["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"].includes(locationKind)
  ) {
    throw new Error(`${pathValue} has invalid readback locationContext kind`);
  }
}

function validateBehaviorClassification(pathValue: string, metadata: ObjectPropertyBehaviorClassification): void {
  if (!["read-write", "read-only", "write-only", "read-mostly", "unknown"].includes(metadata.accessMode)) {
    throw new Error(`${pathValue} has invalid behavior accessMode`);
  }
  if (
    ![
      "state-value",
      "flag-state",
      "momentary-action",
      "enum-state",
      "string-state",
      "computed-status",
      "alias-status",
      "fixture-dependent",
      "unknown",
    ].includes(metadata.behaviorKind)
  ) {
    throw new Error(`${pathValue} has invalid behaviorKind`);
  }
  if (
    ![
      "not-tested",
      "write-readback-tested",
      "command-readback-tested",
      "write-no-op-tested",
      "write-rejected-tested",
      "documented-writable",
      "documented-read-only",
      "not-applicable",
    ].includes(metadata.writeTestStatus)
  ) {
    throw new Error(`${pathValue} has invalid writeTestStatus`);
  }
  if (
    !["not-tested", "readback-tested", "readback-not-available", "documented-readable", "not-applicable"].includes(
      metadata.readbackStatus,
    )
  ) {
    throw new Error(`${pathValue} has invalid readbackStatus`);
  }
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid behavior evidenceLevel`);
  }
  if (metadata.notes !== undefined && metadata.notes.trim().length === 0) {
    throw new Error(`${pathValue} behavior classification notes must be non-empty when present`);
  }
}

function validateValueMetadata(pathValue: string, metadata: ObjectPropertyValueMetadata): void {
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid evidenceLevel`);
  }
  if (
    metadata.valueType !== undefined &&
    !["number", "integer", "float", "string", "boolean", "enum", "unknown"].includes(metadata.valueType)
  ) {
    throw new Error(`${pathValue} has invalid valueType`);
  }
  if (metadata.valueRange) {
    const { min, max, dynamicMax, boundaryBehavior, evidenceLevel } = metadata.valueRange;
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error(`${pathValue} valueRange min must be <= max`);
    }
    validateDynamicBound(pathValue, dynamicMax);
    if (
      boundaryBehavior !== undefined &&
      !["clamp", "reject", "no-op", "wrap", "pass-through", "unknown"].includes(boundaryBehavior)
    ) {
      throw new Error(`${pathValue} has invalid valueRange boundaryBehavior`);
    }
    if (evidenceLevel !== undefined && !["documented", "observed", "inferred", "unverified"].includes(evidenceLevel)) {
      throw new Error(`${pathValue} has invalid valueRange evidenceLevel`);
    }
  }
  if (metadata.acceptedValues) {
    for (const accepted of metadata.acceptedValues) {
      if (!["string", "number", "boolean"].includes(typeof accepted.value)) {
        throw new Error(`${pathValue} acceptedValues entries require string, number, or boolean value`);
      }
    }
  }
  const locationKind = metadata.locationContext?.kind;
  if (
    locationKind !== undefined &&
    !["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"].includes(locationKind)
  ) {
    throw new Error(`${pathValue} has invalid locationContext kind`);
  }
}

function validateDynamicBound(
  pathValue: string,
  dynamicBound: ObjectPropertyValueRange["dynamicMax"] | undefined,
): void {
  if (dynamicBound === undefined) return;
  if (typeof dynamicBound.expression !== "string" || dynamicBound.expression.trim().length === 0) {
    throw new Error(`${pathValue} valueRange.dynamicMax.expression must be a non-empty string`);
  }
  if (
    dynamicBound.sourcePaths !== undefined &&
    (!Array.isArray(dynamicBound.sourcePaths) ||
      dynamicBound.sourcePaths.length === 0 ||
      !dynamicBound.sourcePaths.every((sourcePath) => typeof sourcePath === "string" && sourcePath.trim().length > 0))
  ) {
    throw new Error(`${pathValue} valueRange.dynamicMax.sourcePaths must be a non-empty string array when present`);
  }
  if (dynamicBound.notes !== undefined && dynamicBound.notes.trim().length === 0) {
    throw new Error(`${pathValue} valueRange.dynamicMax.notes must be non-empty when present`);
  }
}

function valueMetadataSearchText(metadata: ObjectPropertyValueMetadata): string {
  return [
    metadata.valueType,
    metadata.unit,
    metadata.valueRange?.unit,
    metadata.valueRange?.dynamicMax?.expression,
    ...(metadata.valueRange?.dynamicMax?.sourcePaths ?? []),
    metadata.valueRange?.dynamicMax?.notes,
    metadata.valueRange?.boundaryBehavior,
    metadata.valueRange?.notes,
    metadata.evidenceLevel,
    metadata.notes,
    metadata.locationContext?.kind,
    metadata.locationContext?.indexBasis,
    metadata.locationContext?.notes,
    ...(metadata.locationContext?.populationDependent ? ["population dependent populated slot location aware"] : []),
    ...(metadata.acceptedValues ?? []).flatMap((value) => [String(value.value), value.label, value.description]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function readbackMetadataSearchText(metadata: ObjectPropertyReadbackMetadata): string {
  return [
    "readback",
    metadata.valueType,
    metadata.probePath,
    metadata.probeMode,
    metadata.typeTag,
    metadata.evidenceLevel,
    metadata.notes,
    metadata.locationContext?.kind,
    metadata.locationContext?.indexBasis,
    metadata.locationContext?.notes,
    ...(metadata.locationContext?.populationDependent ? ["population dependent populated slot location aware"] : []),
    metadata.observedValue === undefined ? undefined : String(metadata.observedValue),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function behaviorClassificationSearchText(metadata: ObjectPropertyBehaviorClassification): string {
  return [
    "behavior classification access mode",
    metadata.accessMode,
    metadata.behaviorKind,
    metadata.writeTestStatus,
    metadata.readbackStatus,
    metadata.evidenceLevel,
    metadata.notes,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
