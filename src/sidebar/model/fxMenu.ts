import type { ObjectPropertyEntry, ObjectPropertyFxMetadata } from "../../knowledge/objectPropertyIndex";
import type { FxPropertyGroup } from "./fxMenuData";

export type { FxPropertyGroup } from "./fxMenuData";
export { FX_MENU } from "./fxMenuData";

// Strip the location-specific FX.N[.N]* prefix, leaving the relative
// property path. Effects can live in QFX (FX.N.N.N.*), on cues, zones,
// etc., so the prefix is not meaningful in the effect browser.
export function fxPathToRelative(path: string): string {
  return `.${path.replace(/^FX(?:\.N)+\./, "")}`;
}

const FX_TYPE_LAYER: Record<string, number> = {
  "oscillating effect": 1,
  "key effect": 2,
  "color effect": 3,
  "zone routing": 4,
  more: 5,
};

const EFFECT_ALIASES: Record<string, readonly string[]> = {
  "add zone": ["add zone"],
  "beam brush effect": ["beam brush"],
  blue: ["blue channel"],
  green: ["green channel"],
  "image properties": ["image parameters"],
  "output color balance": ["output color balance fully balanced"],
  "palette effect": ["palette"],
  red: ["red channel"],
  "roto x": ["rotation x"],
  "roto y": ["rotation y"],
  "roto z": ["rotation z"],
  "wave x to y": ["x to y wave"],
  "wave x to z": ["x to z wave"],
  "wave y to x": ["y to x wave"],
  "wave y to z": ["y to z wave"],
  "zone chase effect": ["zone chase"],
};

export function filterFxEffectProperties(
  typeLabel: string,
  effectLabel: string,
  group: FxPropertyGroup,
  entries: readonly ObjectPropertyEntry[],
): string[] {
  const result = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "fx" || entry.root !== "FX") continue;

    const matchingMetadata = fxMetadataForEntry(entry).some((fx) => {
      return metadataMatchesType(typeLabel, group, fx) && metadataMatchesEffect(effectLabel, fx);
    });
    if (!matchingMetadata) continue;

    result.add(entry.normalizedPath);
  }
  return [...result];
}

function fxMetadataForEntry(entry: ObjectPropertyEntry): ObjectPropertyFxMetadata[] {
  return [entry.fx, ...(entry.variants ?? []).map((variant) => variant.fx)].filter(
    (fx): fx is ObjectPropertyFxMetadata => fx !== undefined,
  );
}

function metadataMatchesType(typeLabel: string, group: FxPropertyGroup, fx: ObjectPropertyFxMetadata): boolean {
  const type = normalizeFxLabel(typeLabel);
  const expectedLayer = FX_TYPE_LAYER[type];
  const qfxLayer = parseQfxLayer(fx.qfxPanel);
  if (expectedLayer !== undefined && qfxLayer !== undefined) return qfxLayer === expectedLayer;

  const label = normalizeFxLabel(fx.label ?? "");
  if ((group === "oscillator" || type === "key effect") && type !== "") return label.startsWith(type);

  return true;
}

function metadataMatchesEffect(effectLabel: string, fx: ObjectPropertyFxMetadata): boolean {
  const wanted = expandFxLabelVariants(effectLabel);
  const candidates = new Set<string>();

  for (const raw of [fx.channel, fx.label, firstFxLabelClause(fx.label), fxLabelSuffix(fx.label)]) {
    if (raw !== undefined) {
      for (const variant of expandFxLabelVariants(raw)) candidates.add(variant);
    }
  }

  for (const value of wanted) {
    if (candidates.has(value)) return true;
  }
  return false;
}

function firstFxLabelClause(label: string | undefined): string | undefined {
  return label?.split(",")[0]?.trim();
}

function fxLabelSuffix(label: string | undefined): string | undefined {
  const dash = label?.indexOf(" - ");
  if (dash === undefined || dash === -1) return undefined;
  return label?.slice(dash + 3).trim();
}

function expandFxLabelVariants(label: string): Set<string> {
  const normalized = normalizeFxLabel(label);
  const values = new Set<string>();
  addFxLabelVariant(values, normalized);

  const aliases = EFFECT_ALIASES[normalized] ?? [];
  for (const alias of aliases) addFxLabelVariant(values, alias);
  for (const [source, sourceAliases] of Object.entries(EFFECT_ALIASES)) {
    if (sourceAliases.includes(normalized)) addFxLabelVariant(values, source);
  }

  return values;
}

function addFxLabelVariant(values: Set<string>, value: string): void {
  if (!value) return;
  values.add(value);
  values.add(value.replace(/\s+effect$/, ""));
  values.add(value.replace(/\s+channel$/, ""));
  values.add(value.replace(/\s+fully balanced$/, ""));
}

function normalizeFxLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseQfxLayer(qfxPanel: string | undefined): number | undefined {
  const match = qfxPanel?.match(/^Layer\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}
