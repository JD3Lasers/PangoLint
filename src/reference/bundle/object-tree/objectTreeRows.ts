import { FX_MENU } from "../../../sidebar/model/fxMenuData";
import type { ReferenceObject, ReferenceObjectProperty } from "../types";
import type { ObjectTreeNode } from "./objectTreeTypes";

function leafNode(prop: ReferenceObjectProperty): ObjectTreeNode {
  return {
    label: prop.path,
    path: prop.path,
    osc: prop.osc,
    setters: prop.setters.length ? prop.setters : undefined,
  };
}

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
