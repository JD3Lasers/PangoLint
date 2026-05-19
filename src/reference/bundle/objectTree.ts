import { FX_MENU } from "../../sidebar/model/fxMenuData";
import type { ReferenceObject, ReferenceObjectProperty, ReferenceUniverseComponent } from "./types";

export interface ObjectTreeNode {
  label: string;
  description?: string;
  path?: string;
  osc?: string;
  setters?: string[];
  children?: ObjectTreeNode[];
}

export interface ObjectPropertySection {
  label: string;
  description?: string;
  properties: ReferenceObjectProperty[];
}

export interface CueTypePropertySections {
  sections: ObjectPropertySection[];
  uniquePropertyCount: number;
  typeCount: number;
}

export interface FxEffectPropertySections {
  sections: ObjectPropertySection[];
  uniquePropertyCount: number;
  effectCount: number;
}

export interface ObjectPropertyReferenceRow {
  id: string;
  label: string;
  description?: string;
  group?: string;
  propertyCount: number;
}

export interface ObjectPropertyReferenceDetail {
  id: string;
  label: string;
  description?: string;
  root: string;
  detailKind?: string;
  pathDisplayContext?: "schema" | "fx-effect" | "universe-component";
  pathDisplayPrefix?: string;
  propertyCount: number;
  sections: ObjectPropertySection[];
}

export interface CueTypeReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  uniquePropertyCount: number;
  typeCount: number;
}

export interface FxEffectReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  uniquePropertyCount: number;
  effectCount: number;
}

export interface UniverseComponentReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  componentCount: number;
}

interface FxEffectDisplayEntry {
  key: string;
  label: string;
  family: string;
  subcategory?: string;
}

function leafNode(prop: ReferenceObjectProperty): ObjectTreeNode {
  return {
    label: prop.path,
    path: prop.path,
    osc: prop.osc,
    setters: prop.setters.length ? prop.setters : undefined,
  };
}

/**
 * Build the FX Effects tree from the catalog's FX object.
 * Groups by quickfx-effect parentLabel (family) -> label (effect) -> properties.
 * Properties with no quickfx-effect context land in an "Other" bucket.
 */
export function buildFxTree(objects: ReferenceObject[]): ObjectTreeNode[] {
  const fxObj = objects.find((o) => o.name === "FX");
  if (!fxObj) return [];

  const familyMap = new Map<string, Map<string, ReferenceObjectProperty[]>>();
  const other: ReferenceObjectProperty[] = [];

  for (const prop of fxObj.properties) {
    const fxContexts = prop.probeContexts?.filter((c) => c.kind === "quickfx-effect") ?? [];
    if (!fxContexts.length) {
      other.push(prop);
      continue;
    }
    for (const ctx of fxContexts) {
      const family = ctx.parentLabel ?? ctx.label;
      let effectMap = familyMap.get(family);
      if (!effectMap) {
        effectMap = new Map();
        familyMap.set(family, effectMap);
      }
      const bucket = effectMap.get(ctx.label) ?? [];
      bucket.push(prop);
      effectMap.set(ctx.label, bucket);
    }
  }

  const tree: ObjectTreeNode[] = [];
  const usedFamilies = new Set<string>();

  for (const fxType of FX_MENU) {
    const effectMap = familyMap.get(fxType.label);
    if (!effectMap) continue;
    usedFamilies.add(fxType.label);

    const knownEffectLabels = new Set<string>();
    let children: ObjectTreeNode[];
    if (fxType.subcategories) {
      children = fxType.subcategories.map((subcategory) => {
        for (const label of subcategory.effects) knownEffectLabels.add(label);
        return {
          label: subcategory.label,
          description: `${subcategory.effects.length} ${subcategory.effects.length === 1 ? "effect" : "effects"}`,
          children: subcategory.effects.map((effectName) => effectNode(effectName, effectMap.get(effectName) ?? [])),
        };
      });
    } else {
      const effects = fxType.effects ?? [];
      for (const label of effects) knownEffectLabels.add(label);
      children = effects.map((effectName) => effectNode(effectName, effectMap.get(effectName) ?? []));
    }

    const menuEffectCount = fxType.subcategories
      ? fxType.subcategories.reduce((total, subcategory) => total + subcategory.effects.length, 0)
      : (fxType.effects?.length ?? 0);
    const extraEffects = [...effectMap.entries()]
      .filter(([effectName]) => !knownEffectLabels.has(effectName))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([effectName, props]) => effectNode(effectName, props));

    children = children.concat(extraEffects);
    const effectCount = menuEffectCount + extraEffects.length;
    tree.push({
      label: fxType.label,
      description: `${effectCount} ${effectCount === 1 ? "effect" : "effects"}`,
      children,
    });
  }

  for (const [family, effectMap] of familyMap) {
    if (usedFamilies.has(family)) continue;
    const effectNodes = [...effectMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([effectName, props]) => effectNode(effectName, props));
    tree.push({
      label: family,
      description: `${effectNodes.length} ${effectNodes.length === 1 ? "effect" : "effects"}`,
      children: effectNodes,
    });
  }

  if (other.length) {
    tree.push({
      label: "Other",
      description: `${other.length} ${other.length === 1 ? "property" : "properties"}`,
      children: other.map(leafNode),
    });
  }

  return tree;
}

function effectNode(effectName: string, props: ReferenceObjectProperty[]): ObjectTreeNode {
  if (!props.length) return { label: effectName };
  return {
    label: effectName,
    description: `${props.length} ${props.length === 1 ? "property" : "properties"}`,
    children: props.map(leafNode),
  };
}

/**
 * Build the Cue Types tree from the catalog's WS object.
 * Groups by cue-type label -> properties.
 * A property appears under every cue type whose context it carries.
 */
export function buildCueTypesTree(objects: ReferenceObject[]): ObjectTreeNode[] {
  const wsObj = objects.find((o) => o.name === "WS");
  if (!wsObj) return [];

  const cueMap = new Map<string, ReferenceObjectProperty[]>();

  for (const prop of wsObj.properties) {
    const cueContexts = prop.probeContexts?.filter((c) => c.kind === "cue-type") ?? [];
    for (const ctx of cueContexts) {
      const bucket = cueMap.get(ctx.label) ?? [];
      bucket.push(prop);
      cueMap.set(ctx.label, bucket);
    }
  }

  const tree: ObjectTreeNode[] = [];
  for (const [cueType, props] of cueMap) {
    tree.push({
      label: cueType,
      description: `${props.length} ${props.length === 1 ? "property" : "properties"}`,
      children: props.map(leafNode),
    });
  }
  tree.sort((a, b) => a.label.localeCompare(b.label));
  return tree;
}

export function buildCueTypeReference(objects: ReferenceObject[]): CueTypeReference {
  const wsObj = objects.find((o) => o.name === "WS");
  if (!wsObj) return { rows: [], details: [], uniquePropertyCount: 0, typeCount: 0 };

  const propertiesByCueType = new Map<string, ReferenceObjectProperty[]>();
  const cueTypesByPath = new Map<string, Set<string>>();

  for (const prop of wsObj.properties) {
    const labels = new Set(prop.probeContexts?.filter((c) => c.kind === "cue-type").map((c) => c.label) ?? []);
    if (!labels.size) continue;
    cueTypesByPath.set(prop.path, labels);
    for (const label of labels) {
      const bucket = propertiesByCueType.get(label) ?? [];
      bucket.push(prop);
      propertiesByCueType.set(label, bucket);
    }
  }

  const cueTypeLabels = [...propertiesByCueType.keys()].sort((a, b) => a.localeCompare(b));
  if (!cueTypeLabels.length) return { rows: [], details: [], uniquePropertyCount: 0, typeCount: 0 };

  const commonProperties = sortObjectProperties(
    wsObj.properties.filter((prop) => cueTypesByPath.get(prop.path)?.size === cueTypeLabels.length),
  );
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));

  const rows: ObjectPropertyReferenceRow[] = [];
  const details: ObjectPropertyReferenceDetail[] = [];
  for (const label of cueTypeLabels) {
    const typeProperties = sortObjectProperties(propertiesByCueType.get(label) ?? []);
    const nonCommonProperties = typeProperties.filter((prop) => !commonPaths.has(prop.path));
    const sections = propertySectionsWithCommonControls("Common cue controls", commonProperties, `${label} controls`, [
      ...nonCommonProperties,
    ]);
    rows.push({
      id: label,
      label,
      propertyCount: typeProperties.length,
    });
    details.push({
      id: label,
      label,
      root: "WS",
      propertyCount: typeProperties.length,
      sections,
    });
  }

  return {
    rows,
    details,
    uniquePropertyCount: cueTypesByPath.size,
    typeCount: cueTypeLabels.length,
  };
}

export function buildCueTypePropertySections(objects: ReferenceObject[]): CueTypePropertySections {
  const wsObj = objects.find((o) => o.name === "WS");
  if (!wsObj) return { sections: [], uniquePropertyCount: 0, typeCount: 0 };

  const propertiesByCueType = new Map<string, ReferenceObjectProperty[]>();
  const cueTypesByPath = new Map<string, Set<string>>();

  for (const prop of wsObj.properties) {
    const labels = new Set(prop.probeContexts?.filter((c) => c.kind === "cue-type").map((c) => c.label) ?? []);
    if (!labels.size) continue;
    cueTypesByPath.set(prop.path, labels);
    for (const label of labels) {
      const bucket = propertiesByCueType.get(label) ?? [];
      bucket.push(prop);
      propertiesByCueType.set(label, bucket);
    }
  }

  const cueTypeLabels = [...propertiesByCueType.keys()].sort((a, b) => a.localeCompare(b));
  if (!cueTypeLabels.length) return { sections: [], uniquePropertyCount: 0, typeCount: 0 };

  const commonProperties = wsObj.properties.filter(
    (prop) => cueTypesByPath.get(prop.path)?.size === cueTypeLabels.length,
  );
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));
  const sections: ObjectPropertySection[] = [];
  if (commonProperties.length) {
    sections.push({
      label: "Common cue controls",
      description: `${cueTypeLabels.length} ${cueTypeLabels.length === 1 ? "cue type" : "cue types"}`,
      properties: sortObjectProperties(commonProperties),
    });
  }

  for (const label of cueTypeLabels) {
    const properties = sortObjectProperties(
      (propertiesByCueType.get(label) ?? []).filter((prop) => !commonPaths.has(prop.path)),
    );
    if (!properties.length) continue;
    sections.push({ label, properties });
  }

  return {
    sections,
    uniquePropertyCount: cueTypesByPath.size,
    typeCount: cueTypeLabels.length,
  };
}

export function buildFxEffectReference(objects: ReferenceObject[]): FxEffectReference {
  const fxObj = objects.find((o) => o.name === "FX");
  if (!fxObj) return { rows: [], details: [], uniquePropertyCount: 0, effectCount: 0 };

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

  const effectKeys = new Set(propertiesByEffect.keys());
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

  const effectKeys = new Set(propertiesByEffect.keys());
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

export function buildUniverseComponentReference(
  objects: ReferenceObject[],
  components: ReferenceUniverseComponent[] = [],
): UniverseComponentReference {
  const universe = objects.find((objectSchema) => objectSchema.name === "Universe");
  if (!universe || components.length === 0) return { rows: [], details: [], componentCount: 0 };

  const propertyByPath = new Map(universe.properties.map((property) => [property.path, property]));
  const entries: Array<{
    componentIndex: number;
    group: string;
    row: ObjectPropertyReferenceRow;
    detail: ObjectPropertyReferenceDetail;
  }> = [];

  for (const component of [...components].sort((a, b) => a.componentIndex - b.componentIndex)) {
    const properties = component.properties
      .map((property) => findUniverseComponentProperty(property.objectPaths, component.defaultName, propertyByPath))
      .filter((property): property is ReferenceObjectProperty => Boolean(property));
    if (!properties.length) continue;

    const group = universeComponentGroup(component, properties);
    const label = `Universe ${component.label}`;
    const pathDisplayPrefix = `Universe.N.${component.defaultName}`;
    entries.push({
      componentIndex: component.componentIndex,
      group,
      row: {
        id: component.id,
        label,
        description: pathDisplayPrefix,
        group,
        propertyCount: properties.length,
      },
      detail: {
        id: component.id,
        label,
        description: `${group} / ${pathDisplayPrefix}`,
        root: "Universe",
        detailKind: "universe component",
        pathDisplayContext: "universe-component",
        pathDisplayPrefix,
        propertyCount: properties.length,
        sections: universeComponentPropertySections(properties, pathDisplayPrefix),
      },
    });
  }
  entries.sort(
    (a, b) =>
      universeComponentGroupOrder(a.group) - universeComponentGroupOrder(b.group) ||
      a.componentIndex - b.componentIndex,
  );

  return {
    rows: entries.map((entry) => entry.row),
    details: entries.map((entry) => entry.detail),
    componentCount: entries.length,
  };
}

export function filterObjectReferenceRows(
  rows: ObjectPropertyReferenceRow[],
  details: ObjectPropertyReferenceDetail[],
  query: string,
): ObjectPropertyReferenceRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  return rows.filter((row) => {
    if (
      [row.label, row.description, row.group, row.id].some((value) => value?.toLowerCase().includes(normalizedQuery))
    ) {
      return true;
    }
    const detail = detailById.get(row.id);
    return detail?.sections.some((section) => {
      if (objectPropertySectionMatches(section, normalizedQuery)) return true;
      return section.properties.some((property) => objectPropertyMatches(property, normalizedQuery));
    });
  });
}

export function filterObjectPropertySections(
  sections: ObjectPropertySection[],
  query: string,
): ObjectPropertySection[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sections;

  const filtered: ObjectPropertySection[] = [];
  for (const section of sections) {
    if (objectPropertySectionMatches(section, normalizedQuery)) {
      filtered.push(section);
      continue;
    }
    const properties = section.properties.filter((property) => objectPropertyMatches(property, normalizedQuery));
    if (properties.length) filtered.push({ ...section, properties });
  }
  return filtered;
}

export function countObjectPropertyRows(sections: ObjectPropertySection[]): number {
  return sections.reduce((total, section) => total + section.properties.length, 0);
}

export function filterObjectTree(nodes: ObjectTreeNode[], query: string): ObjectTreeNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nodes;

  const filtered: ObjectTreeNode[] = [];
  for (const node of nodes) {
    const next = filterObjectTreeNode(node, normalizedQuery);
    if (next) filtered.push(next);
  }
  return filtered;
}

export function countObjectTreeLeaves(nodes: ObjectTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.path !== undefined) {
      count += 1;
      continue;
    }
    count += countObjectTreeLeaves(node.children ?? []);
  }
  return count;
}

function filterObjectTreeNode(node: ObjectTreeNode, normalizedQuery: string): ObjectTreeNode | null {
  const selfMatches = objectTreeNodeMatches(node, normalizedQuery);
  if (!node.children?.length) return selfMatches ? node : null;

  const children = selfMatches ? node.children : filterObjectTree(node.children, normalizedQuery);
  if (!children.length) return null;
  return { ...node, children };
}

function objectTreeNodeMatches(node: ObjectTreeNode, normalizedQuery: string): boolean {
  const values = [node.label, node.description, node.path, node.osc, ...(node.setters ?? [])];
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function sortObjectProperties(properties: ReferenceObjectProperty[]): ReferenceObjectProperty[] {
  return [...properties].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

function propertySectionsWithCommonControls(
  commonLabel: string,
  commonProperties: ReferenceObjectProperty[],
  specificLabel: string,
  specificProperties: ReferenceObjectProperty[],
): ObjectPropertySection[] {
  const sections: ObjectPropertySection[] = [];
  if (commonProperties.length) {
    sections.push({ label: commonLabel, properties: commonProperties });
  }
  if (specificProperties.length) {
    sections.push({ label: specificLabel, properties: sortObjectProperties(specificProperties) });
  }
  return sections;
}

function objectPropertySectionMatches(section: ObjectPropertySection, normalizedQuery: string): boolean {
  return [section.label, section.description].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function objectPropertyMatches(property: ReferenceObjectProperty, normalizedQuery: string): boolean {
  const values = [property.path, property.property, property.osc, ...(property.setters ?? [])];
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function findUniverseComponentProperty(
  objectPaths: string[],
  defaultName: string,
  propertyByPath: Map<string, ReferenceObjectProperty>,
): ReferenceObjectProperty | null {
  const normalizedPaths = objectPaths.map(normalizeNumericSegments);
  const preferredPaths = [
    ...normalizedPaths.filter((path) => path.includes(`.${defaultName}.`)),
    ...normalizedPaths.filter((path) => !path.includes(`.${defaultName}.`)),
  ];
  for (const path of preferredPaths) {
    const property = propertyByPath.get(path);
    if (property) return property;
  }
  return null;
}

function universeComponentGroup(component: ReferenceUniverseComponent, properties: ReferenceObjectProperty[]): string {
  if (
    properties.some((property) =>
      componentRelativePath(property.path, `Universe.N.${component.defaultName}`).startsWith("Zone."),
    )
  ) {
    return "Projection Zones";
  }
  if (
    properties.some((property) =>
      componentRelativePath(property.path, `Universe.N.${component.defaultName}`).startsWith("Effect."),
    )
  ) {
    return "Effect Components";
  }
  return "Standard Components";
}

function universeComponentGroupOrder(group: string): number {
  switch (group) {
    case "Standard Components":
      return 0;
    case "Effect Components":
      return 1;
    case "Projection Zones":
      return 2;
    default:
      return 3;
  }
}

function universeComponentPropertySections(
  properties: ReferenceObjectProperty[],
  pathDisplayPrefix: string,
): ObjectPropertySection[] {
  const buckets: Array<{
    label: string;
    match: (relativePath: string) => boolean;
    properties: ReferenceObjectProperty[];
  }> = [
    { label: "Component controls", match: (relativePath) => !relativePath.includes("."), properties: [] },
    { label: "Effect controls", match: (relativePath) => relativePath.startsWith("Effect."), properties: [] },
    {
      label: "Zone controls",
      match: (relativePath) =>
        relativePath.startsWith("Zone.") &&
        !relativePath.startsWith("Zone.UGC.") &&
        !relativePath.startsWith("Zone.Effect."),
      properties: [],
    },
    { label: "Zone UGC controls", match: (relativePath) => relativePath.startsWith("Zone.UGC."), properties: [] },
    { label: "Zone effect controls", match: (relativePath) => relativePath.startsWith("Zone.Effect."), properties: [] },
  ];
  const otherProperties: ReferenceObjectProperty[] = [];

  for (const property of properties) {
    const relativePath = componentRelativePath(property.path, pathDisplayPrefix);
    const bucket = buckets.find((candidate) => candidate.match(relativePath));
    if (bucket) {
      bucket.properties.push(property);
    } else {
      otherProperties.push(property);
    }
  }

  const sections = buckets
    .filter((bucket) => bucket.properties.length > 0)
    .map((bucket) => ({ label: bucket.label, properties: bucket.properties }));
  if (otherProperties.length) sections.push({ label: "Other component controls", properties: otherProperties });
  return sections;
}

function componentRelativePath(path: string, prefix: string): string {
  return path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path;
}

function normalizeNumericSegments(path: string): string {
  return path
    .split(".")
    .map((part, index) => (index > 0 && /^\d+$/.test(part) ? "N" : part))
    .join(".");
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
