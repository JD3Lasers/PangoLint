// Build data/pangoscript/object-tree/runtime-indexes/object-property-index.json
// from tracked Object Tree source facts.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { applyCommandRangeSeeds, loadCommandKnowledge } from "./objectPropertyIndex/objectPropertyIndexCommandMetadata";
import { buildObjectPropertyEntries } from "./objectPropertyIndex/objectPropertyIndexEntries";
import {
  applyClassificationOverlay,
  applyRangeOverlay,
  applyReadbackOverlay,
  loadClassificationOverlays,
  loadRangeOverlays,
  loadReadbackOverlays,
} from "./objectPropertyIndex/objectPropertyIndexMetadata";
import { objectPropertyIndexPaths, repoRoot } from "./objectPropertyIndex/objectPropertyIndexPaths";
import { loadCacheObjectTree } from "./objectPropertyIndex/objectPropertyIndexSourceFacts";

const paths = objectPropertyIndexPaths(repoRoot);
const cache = loadCacheObjectTree(paths.inputPath);
const entries = buildObjectPropertyEntries(cache, paths.fxEffectTypeReferencePath);

applyCommandRangeSeeds(entries, loadCommandKnowledge(paths.commandKnowledgePath));
applyRangeOverlay(entries, loadRangeOverlays(paths.rangeOverlayPath, paths.rangeOverlayDirectory));
applyReadbackOverlay(entries, loadReadbackOverlays(paths.readbackOverlayPath, paths.readbackOverlayDirectory));
applyClassificationOverlay(
  entries,
  loadClassificationOverlays(paths.classificationOverlayPath, paths.classificationOverlayDirectory),
);

const output = {
  schemaVersion: 1,
  entries,
};

mkdirSync(path.dirname(paths.outputPath), { recursive: true });
writeFileSync(paths.outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, paths.outputPath)} (${entries.length} entries)`);
