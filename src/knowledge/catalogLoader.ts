import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BUNDLED_PANGOSCRIPT_DATA_PATHS, bundledDataPathSegments } from "./bundledDataPaths";
import type { CommandCatalog } from "./catalog";
import { parseCommandCatalog } from "./catalog";
import { commandCatalogFromKnowledgeBase, type PangoKnowledgeBase } from "./knowledgeBase";

const EMPTY_KNOWLEDGE_BASE: PangoKnowledgeBase = { schemaVersion: 1, commands: {} };

export interface CatalogLoadResult {
  catalog: CommandCatalog;
  knowledgeBase: PangoKnowledgeBase;
  source: "merged-knowledge" | "empty";
  error?: string;
}

/**
 * Load the bundled PangoScript command knowledge from
 * data/pangoscript/commands.merged.json (the only catalog source the
 * shipped extension consumes). Build-time generators read the tracked
 * command data and curated overlay from the public repository.
 */
export function loadBundledCatalog(extensionPath: string): CatalogLoadResult {
  const knowledgePath = path.join(
    extensionPath,
    ...bundledDataPathSegments(BUNDLED_PANGOSCRIPT_DATA_PATHS.commandsMerged),
  );
  if (!existsSync(knowledgePath)) {
    return {
      catalog: parseCommandCatalog(""),
      knowledgeBase: EMPTY_KNOWLEDGE_BASE,
      source: "empty",
      error: "No PangoScript command catalog was found. Run `npm run build:knowledge` or reinstall the extension.",
    };
  }
  try {
    const knowledgeBase = JSON.parse(readFileSync(knowledgePath, "utf8")) as PangoKnowledgeBase;
    return { catalog: commandCatalogFromKnowledgeBase(knowledgeBase), knowledgeBase, source: "merged-knowledge" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      catalog: parseCommandCatalog(""),
      knowledgeBase: EMPTY_KNOWLEDGE_BASE,
      source: "empty",
      error: `Failed to parse commands.merged.json (${message}).`,
    };
  }
}
