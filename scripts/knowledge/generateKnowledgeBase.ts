import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  loadCategoryTree,
  resolveCategoriesStrict,
  validateDocCategories,
  validateDocCategoryPlacement,
  validateDocHeadingsInCatalog,
  validateOverlayCategories,
} from "../../src/knowledge/categoryResolution";
import {
  loadJsonFile,
  mergeKnowledgeBase,
  overlayCategoriesByCanonical,
  type PangoKnowledgeBase,
  validateCuratedOverlay,
} from "../../src/knowledge/knowledgeBase";
import { buildCommandPropertyCoverageLedger } from "../../src/knowledge/propertyMappingCoverage";

const root = process.cwd();
const dataDir = path.join(root, "data", "pangoscript");
const generatedPath = path.join(dataDir, "commands.generated.json");
const overlayPath = path.join(dataDir, "commands.overlay.json");
const mergedPath = path.join(dataDir, "commands.merged.json");
const coveragePath = path.join(dataDir, "command-property-coverage.json");

const generated = loadGeneratedCommandData();
const overlay = loadJsonFile<PangoKnowledgeBase>(overlayPath, {
  schemaVersion: 1,
  commands: {},
});

validateCuratedOverlay({
  overlay,
});

const merged = mergeKnowledgeBase(generated, overlay);

const treeJsonPath = path.join(dataDir, "beyond-category-tree.json");
const tree = loadCategoryTree(treeJsonPath);

const overlayCategoryMap = overlayCategoriesByCanonical(overlay);
const overlayErrors = validateOverlayCategories(overlayCategoryMap, tree);
if (overlayErrors.length > 0) {
  for (const e of overlayErrors) console.error(`[categories] ${e}`);
  throw new Error(`Overlay category validation failed (${overlayErrors.length} errors)`);
}

const docDir = path.join(root, "docs/references/beyond/pangoscript/command-reference");
const docErrors = validateDocCategories(docDir, tree);
if (docErrors.length > 0) {
  console.error(`[categories] doc validation errors (${docErrors.length}):`);
  for (const e of docErrors) console.error(`  ${e}`);
  throw new Error(`Doc category validation failed (${docErrors.length} errors)`);
}

const canonicalList = Object.values(merged.commands).map((e) => e.canonical);
const categoryMap = resolveCategoriesStrict(canonicalList, overlayCategoryMap, tree);
for (const entry of Object.values(merged.commands)) {
  const category = categoryMap.get(entry.canonical);
  if (!category) throw new Error(`internal: missing category for ${entry.canonical} after strict resolution`);
  entry.category = category;
}
console.log(`[categories] resolved ${categoryMap.size} commands`);

// Include aliases so that headings like `### ReStartCell / RestartCell`
// (where RestartCell is a documented alias) do not fail the gate.
const catalogNames = new Set(canonicalList);
for (const entry of Object.values(merged.commands)) {
  for (const alias of entry.aliases ?? []) catalogNames.add(alias);
}
const headingErrors = validateDocHeadingsInCatalog(docDir, catalogNames);
if (headingErrors.length > 0) {
  console.error(`[categories] doc heading errors (${headingErrors.length}):`);
  for (const e of headingErrors) console.error(`  ${e}`);
  throw new Error(`Doc heading validation failed (${headingErrors.length} errors)`);
}

const placementErrors = validateDocCategoryPlacement(docDir, categoryMap);
if (placementErrors.length > 0) {
  console.error(`[categories] doc placement errors (${placementErrors.length}):`);
  for (const e of placementErrors) console.error(`  ${e}`);
  throw new Error(`Doc category placement validation failed (${placementErrors.length} errors)`);
}

mkdirSync(dataDir, { recursive: true });
writeJson(generatedPath, generated);
writeJson(mergedPath, merged);
writeJson(coveragePath, buildCommandPropertyCoverageLedger(merged));

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadGeneratedCommandData(): PangoKnowledgeBase {
  if (existsSync(generatedPath)) {
    return loadJsonFile<PangoKnowledgeBase>(generatedPath, {
      schemaVersion: 1,
      commands: {},
    });
  }

  console.error(`Missing checked-in generated command data: ${generatedPath}`);
  console.error("A public checkout should include data/pangoscript/commands.generated.json.");
  process.exit(1);
}
