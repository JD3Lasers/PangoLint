// Sidebar object queries. Wraps the bundled property index and exposes
// the renderer-agnostic ObjectSummary / ObjectDetail shapes the sidebar
// consumes. No vscode imports.

import type { KnownObjectSchema, PropertyIndex } from "../../knowledge/propertyIndex";
import type { ObjectDetail, ObjectSummary } from "./types";

export interface SidebarObjects {
  summaries: ObjectSummary[];
  detailByName: Map<string, ObjectDetail>;
}

export function buildSidebarObjects(index: PropertyIndex): SidebarObjects {
  const names = index.allObjectNames();
  const summaries: ObjectSummary[] = [];
  const detailByName = new Map<string, ObjectDetail>();

  for (const name of names) {
    const schema = index.getObject(name);
    if (!schema) continue;
    const summary = toSummary(schema);
    summaries.push(summary);
    detailByName.set(name.toLowerCase(), toDetail(schema));
  }

  return { summaries, detailByName };
}

export function getObjectTree(objects: SidebarObjects): ObjectSummary[] {
  return objects.summaries;
}

export function getObjectDetail(objects: SidebarObjects, name: string): ObjectDetail | undefined {
  return objects.detailByName.get(name.trim().toLowerCase());
}

export function getPropertyPaths(detail: ObjectDetail): string[] {
  const prefix = detail.isArray ? `${detail.name}.N` : detail.name;
  return detail.properties.map((p) => `${prefix}.${p}`);
}

function toSummary(schema: KnownObjectSchema): ObjectSummary {
  return {
    name: schema.object,
    isArray: schema.isArray,
    propertyCount: schema.propertyCount,
    inheritedFrom: schema.inheritedFrom,
  };
}

function toDetail(schema: KnownObjectSchema): ObjectDetail {
  return {
    name: schema.object,
    isArray: schema.isArray,
    propertyCount: schema.propertyCount,
    inheritedFrom: schema.inheritedFrom,
    properties: [...schema.properties],
    arrayIndices: schema.arrayIndices ? [...schema.arrayIndices] : undefined,
    perIndexSchemas: schema.perIndexSchemas ? { ...schema.perIndexSchemas } : undefined,
  };
}
