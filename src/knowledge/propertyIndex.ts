// Loads the bundled BEYOND property catalog
// (data/pangoscript/object-tree/runtime-indexes/known-properties.json)
// and exposes lookup helpers for the extension's completion / hover providers.
//
// The JSON is generated from BEYOND Object Tree data. It contains canonical
// object schemas only - workspace-specific identifiers are stripped during
// the build step.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface KnownObjectSchema {
  /** Canonical object name (e.g. "Master", "Zone", "Projector"). */
  object: string;
  /** True if accessed as Object.<index>.<prop> rather than Object.<prop>. */
  isArray: boolean;
  /** Total number of properties in this schema. */
  propertyCount: number;
  /** Sorted list of property paths under the object root. */
  properties: string[];
  /** How many other root names share this exact schema fingerprint. */
  sharedWithAliases: number;
  /**
   * For isArray schemas where the "index" slot is a named identifier (e.g.
   * universe panel buttons accessed as Panel.<ButtonName>.<Prop>), the
   * known/discovered names that should be offered for first-level
   * completion. When undefined, a numeric "0" sentinel is used instead.
   */
  arrayIndices?: string[];
  /**
   * When this schema was cloned from a canonical bundled schema (e.g. a
   * user universe inheriting UniversePanel, or a zone alias inheriting
   * Zone), the canonical source name. Used by hover tooltips to credit
   * the source schema so users understand where suggestions came from.
   */
  inheritedFrom?: string;
  /**
   * For universe panels whose individual buttons exhibit shape variants
   * (an Effect control vs. a ZonePad vs. a plain button), maps the
   * lower-cased button name to a canonical schema name in the bundled
   * index (e.g. "UniverseEffectControl", "UniverseZonePadControl"). When
   * a key is present, completion / hover dispatch to that schema's
   * properties for paths under `<Panel>.<button>.…`. Buttons absent from
   * this map fall back to the panel's own `properties` (which inherits
   * from `inheritedFrom` - typically `UniversePanel`).
   */
  perIndexSchemas?: Record<string, string>;
  /**
   * How this schema entered the workspace index. Absent for bundled
   * canonical schemas and for explicitly registered user objects.
   * - `folderScope` - workspace scanner inferred it from two or more
   *   sibling `.BeyondCode` files in the same parent folder.
   * - `beyondReadback` - confirmed via runtime readback of `<root>.<button>.Caption`
   *   against a live BEYOND instance (T1 readback-only). Session-scoped.
   */
  discoverySource?: "folderScope" | "beyondReadback";
  /**
   * For folder-scoped auto-discoveries, the number of distinct files
   * the root was observed in within its strongest parent folder. Used
   * by hover tooltips to surface the discovery confidence ("seen in N
   * files in this folder").
   */
  observedFileCount?: number;
  /**
   * For beyond-readback validations, the ISO timestamp of the validating
   * readback. Used by hover tooltips to surface freshness ("validated 5
   * minutes ago").
   */
  validatedAt?: string;
}

export interface PropertyIndexFile {
  schemaVersion: number;
  generatedAt?: string;
  generatedFrom?: string;
  schemas: KnownObjectSchema[];
}

export interface PropertyIndexLoadResult {
  index: PropertyIndex;
  source: "bundled" | "empty";
  error?: string;
}

/**
 * Indexed view of the property catalog with O(1) object lookup.
 */
export interface PropertyIndex {
  /** Look up a schema by its canonical object name (case-insensitive). */
  getObject(name: string): KnownObjectSchema | undefined;
  /** All canonical object names. */
  allObjectNames(): string[];
  /** Total number of registered schemas. */
  size(): number;
}

const EMPTY: PropertyIndexFile = {
  schemaVersion: 1,
  schemas: [],
};

export function buildPropertyIndex(file: PropertyIndexFile): PropertyIndex {
  const byName = new Map<string, KnownObjectSchema>();
  for (const schema of file.schemas) {
    byName.set(schema.object.toLowerCase(), schema);
  }
  return {
    getObject: (name: string) => byName.get(name.toLowerCase()),
    allObjectNames: () => file.schemas.map((s) => s.object).sort(),
    size: () => file.schemas.length,
  };
}

/**
 * Combines multiple PropertyIndex instances. Lookup walks them in order;
 * the first match wins. Used to layer workspace user-defined objects
 * (universes, zone aliases) over the bundled canonical schemas.
 */
export function mergedPropertyIndex(...indices: PropertyIndex[]): PropertyIndex {
  return {
    getObject: (name: string) => {
      for (const idx of indices) {
        const hit = idx.getObject(name);
        if (hit) return hit;
      }
      return undefined;
    },
    allObjectNames: () => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const idx of indices) {
        for (const n of idx.allObjectNames()) {
          if (seen.has(n.toLowerCase())) continue;
          seen.add(n.toLowerCase());
          out.push(n);
        }
      }
      return out.sort();
    },
    size: () => {
      const seen = new Set<string>();
      for (const idx of indices) {
        for (const n of idx.allObjectNames()) seen.add(n.toLowerCase());
      }
      return seen.size;
    },
  };
}

export function perIndexSchemaName(schema: KnownObjectSchema, indexName: string): string | undefined {
  const perIndexSchemas = schema.perIndexSchemas;
  if (!perIndexSchemas) return undefined;
  const key = indexName.toLowerCase();
  if (!Object.hasOwn(perIndexSchemas, key)) return undefined;
  const targetName = perIndexSchemas[key];
  return typeof targetName === "string" ? targetName : undefined;
}

export function loadBundledPropertyIndex(extensionPath: string): PropertyIndexLoadResult {
  const filePath = path.join(
    extensionPath,
    "data",
    "pangoscript",
    "object-tree",
    "runtime-indexes",
    "known-properties.json",
  );
  if (!existsSync(filePath)) {
    return {
      index: buildPropertyIndex(EMPTY),
      source: "empty",
      error: "known-properties.json not found in bundled extension data.",
    };
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as PropertyIndexFile;
    if (!Array.isArray(raw.schemas)) {
      return {
        index: buildPropertyIndex(EMPTY),
        source: "empty",
        error: "known-properties.json is malformed (missing schemas array).",
      };
    }
    return { index: buildPropertyIndex(raw), source: "bundled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      index: buildPropertyIndex(EMPTY),
      source: "empty",
      error: `Failed to parse known-properties.json (${message}).`,
    };
  }
}
