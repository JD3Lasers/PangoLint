// Tool: listObjects - returns canonical schema names plus Object Tree-only
// roots (WS, FX, workspace-safe aliases, etc.) so agents can discover the
// same object families visible in the VS Code Objects panel.

import type { ObjectPropertyIndex } from "../../../src/knowledge/objectPropertyIndex";
import type { PropertyIndex } from "../../../src/knowledge/propertyIndex";
import { ok, type ToolResult } from "../toolResult";
import type { LookupObjectSource } from "./lookupObject";

export interface ObjectDiscoverySummary {
  name: string;
  sources: LookupObjectSource[];
  schemaPropertyCount?: number;
  objectTreePropertyCount?: number;
  objectTreePathCount?: number;
}

export type ListObjectsResult = ToolResult<{ names: string[]; count: number; objects: ObjectDiscoverySummary[] }>;

export function listObjects(
  propertyIndex: PropertyIndex,
  objectPropertyIndex?: ObjectPropertyIndex,
): ListObjectsResult {
  const byName = new Map<string, ObjectDiscoverySummary>();

  for (const name of propertyIndex.allObjectNames()) {
    const schema = propertyIndex.getObject(name);
    byName.set(name.toLowerCase(), {
      name,
      sources: ["canonical-schema"],
      schemaPropertyCount: schema?.propertyCount,
    });
  }

  if (objectPropertyIndex) {
    const rootStats = new Map<string, { name: string; properties: Set<string>; paths: Set<string> }>();
    for (const entry of objectPropertyIndex.allEntries()) {
      const key = entry.root.toLowerCase();
      let stats = rootStats.get(key);
      if (!stats) {
        stats = { name: entry.root, properties: new Set(), paths: new Set() };
        rootStats.set(key, stats);
      }
      stats.properties.add(entry.property);
      stats.paths.add(entry.path);
    }

    for (const [key, stats] of rootStats) {
      const existing = byName.get(key);
      if (existing) {
        byName.set(key, {
          ...existing,
          sources: appendSource(existing.sources, "object-property-index"),
          objectTreePropertyCount: stats.properties.size,
          objectTreePathCount: stats.paths.size,
        });
      } else {
        byName.set(key, {
          name: stats.name,
          sources: ["object-property-index"],
          objectTreePropertyCount: stats.properties.size,
          objectTreePathCount: stats.paths.size,
        });
      }
    }
  }

  const objects = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const names = objects.map((object) => object.name);
  return ok({ names, count: names.length, objects });
}

function appendSource(sources: LookupObjectSource[], source: LookupObjectSource): LookupObjectSource[] {
  return sources.includes(source) ? sources : [...sources, source];
}
