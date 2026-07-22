// Build data/pangoscript/object-tree/runtime-indexes/known-properties.json
// from tracked Object Tree source facts.
//
// Roots derived from the object tree get one schema each. Roots that only
// exist as hand-crafted entries in the existing file (sub-schemas used by the
// workspace scanner, and deprecated roots) are preserved verbatim. Roots that
// are pure alias placeholders (ZoneAlias, UniversePanelAlias) are skipped:
// those are handled at runtime by the workspace scanner.
//
// Property derivation rule:
//   normalized path "Root.N.N.Caption" maps to isArray=true and property="N.Caption"
//   (getPropertyPaths adds one leading "N." prefix so the result is correct)
//
// Run:
//   npm run build:known-properties

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { KnownObjectSchema, PropertyIndexFile } from "../../src/knowledge/propertyIndex";

const repoRoot = process.cwd();
const objectPathSourceFactsRelativePath = "data/pangoscript/object-tree/source-facts/object-paths.json";
const treePath = path.join(repoRoot, ...objectPathSourceFactsRelativePath.split("/"));
const outputPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "known-properties.json",
);
const existingPath = outputPath;

// Roots excluded from auto-generation:
//   ZoneAlias / UniversePanelAlias: workspace alias placeholders (runtime scanner)
//   DmxOutput: flat 2047-element index array; its paths ARE the indices (no
//               sub-properties), so property derivation produces an empty list.
//               Covered by HARDCODED_SCHEMAS below.
const SKIP_ROOTS = new Set(["ZoneAlias", "UniversePanelAlias", "DmxOutput"]);

// Schemas always emitted with exact content, not derived from the object tree.
// DmxOutput is a flat numeric-index array (0..2046); no sub-properties exist.
const HARDCODED_SCHEMAS: KnownObjectSchema[] = [
  {
    object: "DmxOutput",
    isArray: false,
    propertyCount: 2047,
    properties: Array.from({ length: 2047 }, (_, i) => String(i)),
    sharedWithAliases: 0,
  },
];

// Runtime-observed properties not present in Object Tree source facts.
// Injected (in sort order) into the named auto-generated schema.
const PROPERTY_ADDITIONS: Record<string, string[]> = {
  Master: ["ShowShift"],
  Projector: ["Count"],
};

// Per-root property filters. Universe mixes N.* (generic numeric index, the
// generic form) with ComponentName.* (workspace-specific default names like
// Button1 that users can rename). Keep only N.* so the schema is
// workspace-agnostic. The Universe source facts expand all 23 component
// indices so the N.N.* paths cover the full property union (233 props).
const PROPERTY_ROOT_FILTERS: Record<string, (prop: string) => boolean> = {
  Universe: (prop) => prop.startsWith("N.") || prop.startsWith("#N.") || prop === "N" || prop === "#N",
};
const OBJECT_TREE_PATH_CORRECTIONS = new Map([["Config.Scan RateSliderMax", "Config.ScanRateSliderMax"]]);

interface TreePathEntry {
  path: string;
  normalizedPath: string;
  root: string;
  kind: "object" | "fx";
  segments: string[];
}

interface ObjectTree {
  paths: TreePathEntry[];
}

const tree = JSON.parse(readFileSync(treePath, "utf8")) as ObjectTree;

// Group normalized paths by root.
const byRoot = new Map<string, Set<string>>();
for (const entry of tree.paths) {
  if (SKIP_ROOTS.has(entry.root)) continue;
  const set = byRoot.get(entry.root) ?? new Set<string>();
  set.add(OBJECT_TREE_PATH_CORRECTIONS.get(entry.normalizedPath) ?? entry.normalizedPath);
  byRoot.set(entry.root, set);
}

// Load existing file to preserve manual schemas that aren't in the object tree.
let existing: PropertyIndexFile | null = null;
try {
  existing = JSON.parse(readFileSync(existingPath, "utf8")) as PropertyIndexFile;
} catch {
  // The file can be absent during the first local generation run.
}
const manualSchemas: KnownObjectSchema[] = existing?.schemas.filter((s) => !byRoot.has(s.object)) ?? [];

// Build auto-generated schemas.
const generated: KnownObjectSchema[] = [];

for (const [root, normalizedPaths] of byRoot) {
  const isArray = [...normalizedPaths].some((p) => {
    const segs = p.split(".");
    return segs.length > 1 && (segs[1] === "N" || segs[1] === "#N");
  });

  const props = new Set<string>();
  const rootFilter = PROPERTY_ROOT_FILTERS[root];
  for (const np of normalizedPaths) {
    const segs = np.split(".");
    // Strip root + leading N if array.
    const start = isArray ? 2 : 1;
    const prop = segs.slice(start).join(".");
    if (prop && (!rootFilter || rootFilter(prop))) props.add(prop);
  }

  const properties = [...props].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  // Inject runtime-observed properties that are absent from Object Tree source facts.
  for (const extra of PROPERTY_ADDITIONS[root] ?? []) {
    if (!properties.includes(extra)) {
      const idx = properties.findIndex((p) => p.localeCompare(extra, undefined, { sensitivity: "base" }) > 0);
      if (idx === -1) properties.push(extra);
      else properties.splice(idx, 0, extra);
    }
  }

  generated.push({
    object: root,
    isArray,
    propertyCount: properties.length,
    properties,
    sharedWithAliases: 0, // filled below
  });
}

// Compute sharedWithAliases: count how many generated schemas share the same
// sorted property fingerprint (exact same property set).
const fpCount = new Map<string, number>();
for (const schema of generated) {
  const fp = schema.properties.join("|");
  fpCount.set(fp, (fpCount.get(fp) ?? 0) + 1);
}
for (const schema of generated) {
  const fp = schema.properties.join("|");
  schema.sharedWithAliases = (fpCount.get(fp) ?? 1) - 1;
}

// Merge: auto-generated + preserved manual + hardcoded. Hardcoded wins on name
// conflicts (deduplicate by taking first occurrence after the sort-then-dedupe).
const hardcodedNames = new Set(HARDCODED_SCHEMAS.map((s) => s.object));
const filteredManual = manualSchemas.filter((s) => !hardcodedNames.has(s.object));
const all = [...generated, ...filteredManual, ...HARDCODED_SCHEMAS].sort((a, b) =>
  a.object.localeCompare(b.object, undefined, { sensitivity: "base" }),
);

const output: PropertyIndexFile = {
  schemaVersion: 1,
  schemas: all,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote ${path.relative(repoRoot, outputPath)} (${all.length} schemas: ${generated.length} auto + ${manualSchemas.length} manual)`,
);
const shared = generated.filter((s) => s.sharedWithAliases > 0);
if (shared.length > 0) {
  console.log("Shared-fingerprint groups:");
  const seen = new Set<string>();
  for (const s of shared) {
    const fp = s.properties.join("|");
    if (seen.has(fp)) continue;
    seen.add(fp);
    const group = generated.filter((g) => g.properties.join("|") === fp).map((g) => g.object);
    console.log(`  ${group.join(", ")} (${s.propertyCount} props each)`);
  }
}
