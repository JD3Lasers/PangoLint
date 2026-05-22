import { CUE_COMMON_PROPERTIES } from "../../../src/knowledge/cue-properties/cueCommonProperties";
import { CUE_TYPES } from "../../../src/knowledge/cue-properties/cueTypes";
import type {
  ObjectPropertyAddressMetadata,
  ObjectPropertyProbeContext,
} from "../../../src/knowledge/objectPropertyIndex";
import { normalizePath, propertyPath, splitPath } from "./objectPropertyIndexPaths";
import {
  buildSearchText,
  compareProbeContexts,
  mergeSearchText,
  probeContextSearchText,
  probeOsc,
  probePath,
  slug,
  splitCamel,
  tokenize,
} from "./objectPropertyIndexSearchText";
import { loadFxCellLabels, loadFxEffectLabels, loadFxEffectMenuEntries } from "./objectPropertyIndexSourceFacts";
import type {
  CacheObjectTree,
  CachePathEntry,
  FxCellLabel,
  FxEffectMenuEntry,
  NormalizedPathEntry,
  OutputEntry,
} from "./objectPropertyIndexTypes";

const customUniverseRoots = new Set(["COLORPICKER", "HardwareMuter", "SHOWKONTROL"]);
const zoneAliasRoot = "ZoneAlias";
const universeAliasRoot = "UniversePanelAlias";
const universeControlSegment = "Control";
const objectTreePathCorrections = new Map<string, { path: string; osc: string }>([
  ["Config.Scan RateSliderMax", { path: "Config.ScanRateSliderMax", osc: "/b/Config/ScanRateSliderMax" }],
]);

let fxEffectLabels = new Map<string, NonNullable<CachePathEntry["fx"]>>();
let fxCellLabels = new Map<string, FxCellLabel>();
let fxEffectMenuEntries = new Map<string, FxEffectMenuEntry>();

export function buildObjectPropertyEntries(cache: CacheObjectTree, fxEffectTypeReferencePath: string): OutputEntry[] {
  fxEffectLabels = loadFxEffectLabels(cache);
  fxCellLabels = loadFxCellLabels(cache);
  fxEffectMenuEntries = loadFxEffectMenuEntries(fxEffectTypeReferencePath);

  const grouped = new Map<string, NormalizedPathEntry[]>();

  for (const entry of cache.paths) {
    const sourceEntry = buildNormalizedPathEntry(entry);
    const groupKey = sourceEntry.normalizedPath.toLowerCase();
    const group = grouped.get(groupKey) ?? [];
    group.push(sourceEntry);
    grouped.set(groupKey, group);
  }

  const generatedEntries = withUniverseZonePadByNameNumericVariants(
    [...grouped.values()]
      .map((group) => buildEntry(preferredNormalizedPath(group), group))
      .map(applyManualRuntimeCorrection),
  );

  return generatedEntries
    .concat(universeZonePadByNameEntries(generatedEntries, new Set(generatedEntries.map((entry) => entry.path))))
    .concat(manualRuntimeEntries(new Set(generatedEntries.map((entry) => entry.path))))
    .concat(cueGridEntries(new Set(generatedEntries.map((entry) => entry.path))))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function buildEntry(normalizedPath: string, group: NormalizedPathEntry[]): OutputEntry {
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

function preferredNormalizedPath(group: NormalizedPathEntry[]): string {
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

function fxProbeContexts(group: NormalizedPathEntry[]): ObjectPropertyProbeContext[] {
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

function fxCellProbeContexts(group: NormalizedPathEntry[]): ObjectPropertyProbeContext[] {
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

function buildNormalizedPathEntry(entry: CachePathEntry): NormalizedPathEntry {
  const sourceSegments = normalizedSourceSegments(
    Array.isArray(entry.segments) && entry.segments.length > 0 ? entry.segments : splitPath(entry.path),
  );
  const correction = objectTreePathCorrections.get(sourceSegments.join("."));
  const segments = correction ? splitPath(correction.path) : sourceSegments;
  const pathValue = segments.join(".");
  const root = segments[0] ?? entry.root;
  const isGenericAlias = isGenericAliasRoot(root);
  const correctedOsc = correction?.osc ?? entry.osc;
  const osc = isRedactedHardwareRoot(root) ? undefined : redactPublicHardwareIdentifier(correctedOsc);
  const searchText = redactPublicSearchText(isGenericAlias ? pathValue : entry.searchText, root);
  const fx = mergeFxMetadata(entry.fx, fxEffectMetadataForPath(pathValue));
  return {
    path: pathValue,
    normalizedPath: normalizePath(pathValue),
    root,
    kind: root === "FX" ? "fx" : entry.kind,
    ...(!isGenericAlias && osc ? { osc } : {}),
    searchText,
    observedCount: Math.max(1, entry.variantCount ?? 1),
    isGenericAlias,
    ...(fx ? { fx } : {}),
  };
}

function normalizedSourceSegments(segments: string[]): string[] {
  if (segments.length === 0) return segments;
  const root = segments[0];
  const hardwareRoot = publicHardwareRoot(root);
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

function publicHardwareRoot(root: string): string | undefined {
  const match = /^FB([34])[_-](?:\d+|XXXXX)$/.exec(root);
  if (!match) return undefined;
  return `FB${match[1]}_XXXXX`;
}

function redactPublicHardwareIdentifier(value: string | undefined): string | undefined {
  return value?.replace(/\bFB([34])[_-](?:\d+|XXXXX)\b/g, "FB$1_XXXXX");
}

function redactPublicSearchText(value: string | undefined, root: string): string | undefined {
  const redacted = redactPublicHardwareIdentifier(value);
  if (!redacted || !/^FB[34]_XXXXX$/.test(root)) return redacted;
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
  return /^FB[34]_XXXXX$/.test(root);
}

function compactFx(fx: NonNullable<CachePathEntry["fx"]>) {
  return {
    ...(fx.qfxPanel ? { qfxPanel: fx.qfxPanel } : {}),
    ...(fx.cellCaption ? { cellCaption: fx.cellCaption } : {}),
    ...(fx.label ? { label: fx.label } : {}),
    ...(fx.channel ? { channel: fx.channel } : {}),
  };
}
