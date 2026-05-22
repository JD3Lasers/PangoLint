import { FX_MENU } from "../../../sidebar/model/fxMenuData";
import type { ReferenceObject, ReferenceObjectProperty } from "../types";
import { propertySectionsWithCommonControls, sortObjectProperties } from "./objectPropertySections";
import type {
  FxEffectPropertySections,
  FxEffectReference,
  ObjectPropertyReferenceDetail,
  ObjectPropertyReferenceRow,
  ObjectPropertySection,
} from "./objectTreeTypes";

interface FxEffectDisplayEntry {
  key: string;
  label: string;
  family: string;
  subcategory?: string;
}

interface FxEffectPropertyGroups {
  propertiesByEffect: Map<string, ReferenceObjectProperty[]>;
  effectsByPath: Map<string, Set<string>>;
  propertiesWithoutEffectContext: ReferenceObjectProperty[];
  effectKeys: Set<string>;
}

export function buildFxEffectReference(objects: ReferenceObject[]): FxEffectReference {
  const fxObj = objects.find((o) => o.name === "FX");
  if (!fxObj) return { rows: [], details: [], uniquePropertyCount: 0, effectCount: 0 };

  const { propertiesByEffect, effectsByPath, propertiesWithoutEffectContext, effectKeys } =
    fxEffectPropertyGroups(fxObj);
  const commonProperties = sortObjectProperties(
    fxObj.properties.filter((prop) => effectsByPath.get(prop.path)?.size === effectKeys.size),
  );
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));
  const rows: ObjectPropertyReferenceRow[] = [];
  const details: ObjectPropertyReferenceDetail[] = [];
  const usedKeys = new Set<string>();

  const appendEffect = (entry: FxEffectDisplayEntry): void => {
    if (!effectKeys.has(entry.key)) return;
    usedKeys.add(entry.key);
    const effectProperties = sortObjectProperties(propertiesByEffect.get(entry.key) ?? []);
    const nonCommonProperties = effectProperties.filter((prop) => !commonPaths.has(prop.path));
    const description = entry.subcategory ? `${entry.family} / ${entry.subcategory}` : entry.family;
    rows.push({
      id: entry.key,
      label: entry.label,
      description,
      propertyCount: effectProperties.length,
    });
    details.push({
      id: entry.key,
      label: entry.label,
      description,
      root: "FX",
      propertyCount: effectProperties.length,
      sections: propertySectionsWithCommonControls("Common FX controls", commonProperties, `${entry.label} controls`, [
        ...nonCommonProperties,
      ]),
    });
  };

  for (const entry of fxEffectDisplayEntries()) appendEffect(entry);

  const extraKeys = [...effectKeys].filter((key) => !usedKeys.has(key)).sort((a, b) => a.localeCompare(b));
  for (const key of extraKeys) {
    const [family, label] = splitFxEffectKey(key);
    appendEffect({
      key,
      label,
      family,
    });
  }

  const otherProperties = sortObjectProperties(propertiesWithoutEffectContext);
  if (otherProperties.length) {
    rows.push({
      id: "other-fx-properties",
      label: "Other FX properties",
      description: "No effect type context",
      propertyCount: otherProperties.length,
    });
    details.push({
      id: "other-fx-properties",
      label: "Other FX properties",
      description: "No effect type context",
      root: "FX",
      propertyCount: otherProperties.length,
      sections: [{ label: "Other FX properties", properties: otherProperties }],
    });
  }

  return {
    rows,
    details,
    uniquePropertyCount: new Set([...effectsByPath.keys(), ...propertiesWithoutEffectContext.map((prop) => prop.path)])
      .size,
    effectCount: effectKeys.size,
  };
}

export function buildFxEffectPropertySections(objects: ReferenceObject[]): FxEffectPropertySections {
  const fxObj = objects.find((o) => o.name === "FX");
  if (!fxObj) return { sections: [], uniquePropertyCount: 0, effectCount: 0 };

  const { propertiesByEffect, effectsByPath, propertiesWithoutEffectContext, effectKeys } =
    fxEffectPropertyGroups(fxObj);
  const commonProperties = fxObj.properties.filter((prop) => effectsByPath.get(prop.path)?.size === effectKeys.size);
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));
  const sections: ObjectPropertySection[] = [];

  if (commonProperties.length) {
    sections.push({
      label: "Common FX controls",
      description: `${effectKeys.size} ${effectKeys.size === 1 ? "effect type" : "effect types"}`,
      properties: sortObjectProperties(commonProperties),
    });
  }

  const usedKeys = new Set<string>();
  for (const entry of fxEffectDisplayEntries()) {
    if (!effectKeys.has(entry.key)) continue;
    usedKeys.add(entry.key);
    const properties = sortObjectProperties(
      (propertiesByEffect.get(entry.key) ?? []).filter((prop) => !commonPaths.has(prop.path)),
    );
    if (!properties.length) continue;
    sections.push({
      label: entry.label,
      description: entry.subcategory ? `${entry.family} / ${entry.subcategory}` : entry.family,
      properties,
    });
  }

  const extraKeys = [...effectKeys].filter((key) => !usedKeys.has(key)).sort((a, b) => a.localeCompare(b));
  for (const key of extraKeys) {
    const [family, label] = splitFxEffectKey(key);
    const properties = sortObjectProperties(
      (propertiesByEffect.get(key) ?? []).filter((prop) => !commonPaths.has(prop.path)),
    );
    if (!properties.length) continue;
    sections.push({
      label,
      description: family === label ? undefined : family,
      properties,
    });
  }

  if (propertiesWithoutEffectContext.length) {
    sections.push({
      label: "Other FX properties",
      properties: sortObjectProperties(propertiesWithoutEffectContext),
    });
  }

  return {
    sections,
    uniquePropertyCount: new Set([...effectsByPath.keys(), ...propertiesWithoutEffectContext.map((prop) => prop.path)])
      .size,
    effectCount: effectKeys.size,
  };
}

function fxEffectPropertyGroups(fxObj: ReferenceObject): FxEffectPropertyGroups {
  const propertiesByEffect = new Map<string, ReferenceObjectProperty[]>();
  const effectsByPath = new Map<string, Set<string>>();
  const propertiesWithoutEffectContext: ReferenceObjectProperty[] = [];

  for (const prop of fxObj.properties) {
    const effectKeys = new Set<string>();
    for (const ctx of prop.probeContexts?.filter((c) => c.kind === "quickfx-effect") ?? []) {
      const family = ctx.parentLabel ?? ctx.label;
      const key = fxEffectKey(family, ctx.label);
      effectKeys.add(key);
      const bucket = propertiesByEffect.get(key) ?? [];
      bucket.push(prop);
      propertiesByEffect.set(key, bucket);
    }
    if (effectKeys.size) {
      effectsByPath.set(prop.path, effectKeys);
    } else {
      propertiesWithoutEffectContext.push(prop);
    }
  }

  return {
    propertiesByEffect,
    effectsByPath,
    propertiesWithoutEffectContext,
    effectKeys: new Set(propertiesByEffect.keys()),
  };
}

function fxEffectDisplayEntries(): FxEffectDisplayEntry[] {
  const entries: FxEffectDisplayEntry[] = [];
  for (const family of FX_MENU) {
    if (family.subcategories) {
      for (const subcategory of family.subcategories) {
        for (const label of subcategory.effects) {
          entries.push({
            key: fxEffectKey(family.label, label),
            label,
            family: family.label,
            subcategory: subcategory.label,
          });
        }
      }
      continue;
    }
    for (const label of family.effects ?? []) {
      entries.push({
        key: fxEffectKey(family.label, label),
        label,
        family: family.label,
      });
    }
  }
  return entries;
}

function fxEffectKey(family: string, label: string): string {
  return `${family} :: ${label}`;
}

function splitFxEffectKey(key: string): [string, string] {
  const [family = "", label = family] = key.split(" :: ");
  return [family, label];
}
