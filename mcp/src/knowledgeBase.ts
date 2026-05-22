// Loads the bundled PangoScript knowledge for the MCP server. Mirrors the
// extension's catalog + property-index loaders but without any vscode
// imports. Both consumers read from the same `data/pangoscript/` source.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CommandCatalog,
  CommandKnowledgeEntry,
  PangoKnowledgeBase,
} from "../../src/knowledge/mcpKnowledgeExports";
import {
  BUNDLED_PANGOSCRIPT_DATA_PATHS,
  bundledDataPathSegments,
  loadBundledCatalog,
  loadBundledMcpControlReference,
  loadBundledObjectPropertyIndex,
  loadBundledPropertyIndex,
  type McpPropertyControlIndex,
  type ObjectPropertyIndex,
  type PropertyIndex,
} from "../../src/knowledge/mcpKnowledgeExports";
import { MCP_ENV_VARS } from "./configEnv";

const MCP_LOG_PREFIX = "PangoLint MCP";

export interface McpKnowledgeBase {
  /** Curated knowledge for every command in the catalog. */
  knowledgeBase: PangoKnowledgeBase;
  /** Parsed CommandCatalog (built from the knowledge base). */
  catalog: CommandCatalog;
  /** Lower-cased name → curated entry (canonical + every alias). */
  byName: Map<string, CommandKnowledgeEntry>;
  /** Bundled canonical object schemas (Master, Zone, UniversePanel, …). */
  propertyIndex: PropertyIndex;
  /** Agent-searchable BEYOND Object Tree property path index. */
  objectPropertyIndex: ObjectPropertyIndex;
  /** Compact MCP projection for property control lookup. */
  propertyControlIndex: McpPropertyControlIndex;
}

/**
 * Resolve the directory containing the shared `data/pangoscript/` and
 * `docs/references/` files.
 *
 * Two supported layouts:
 *
 * - **Published npm tarball**: `node_modules/pangolint-mcp/dist/server.js`
 *   → `data/` and `docs/` live one level up (alongside `dist/`), copied
 *   in by `scripts/package/copyMcpData.cjs` at publish time.
 * - **Monorepo dev**: `mcp/src/knowledgeBase.ts` (vitest) or
 *   `mcp/dist/server.js` → `data/` and `docs/` live at the repo root.
 *
 * Strategy: check both candidates and pick the first whose
 * `data/pangoscript/commands.merged.json` exists. Honors
 * `PANGOLINT_MCP_DATA_DIR` as an explicit override (useful when
 * pointing the server at a freshly-rebuilt repo during dev).
 */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const dataDir = env[MCP_ENV_VARS.dataDir];
  if (dataDir) return dataDir;

  const here = fileURLToPath(import.meta.url);
  const dir = path.dirname(here);
  // 1. Published-tarball layout: mcp/dist/server.js → mcp/
  // 2. Monorepo dev layout: mcp/src/knowledgeBase.ts or mcp/dist/server.js → repo root
  const candidates = [path.resolve(dir, ".."), path.resolve(dir, "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, ...bundledDataPathSegments(BUNDLED_PANGOSCRIPT_DATA_PATHS.commandsMerged)))) {
      return candidate;
    }
  }
  // Fallback: return the deepest candidate so downstream `existsSync` checks
  // surface clear "file not found" errors with the most plausible path.
  return candidates[candidates.length - 1];
}

export function buildKnowledgeByName(kb: PangoKnowledgeBase): Map<string, CommandKnowledgeEntry> {
  const map = new Map<string, CommandKnowledgeEntry>();
  for (const entry of Object.values(kb.commands)) {
    map.set(entry.canonical.toLowerCase(), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(alias.toLowerCase(), entry);
    }
  }
  return map;
}

/**
 * INVARIANT: the returned `McpKnowledgeBase` is treated as **immutable**
 * for the lifetime of the server process. Callers must not mutate the
 * knowledge base, catalog, or any of the indexes after this function
 * returns. `registerResources` in `mcp/src/resources/index.ts` caches
 * the stringified payloads at register time on this assumption. If the
 * data ever needs to hot-reload, the cache and `size` hints there must
 * be revisited at the same time.
 */
export function loadMcpKnowledge(env: NodeJS.ProcessEnv = process.env): McpKnowledgeBase {
  const dataDir = resolveDataDir(env);
  const catalogResult = loadBundledCatalog(dataDir);
  if (catalogResult.error) {
    // Surfaced via stderr in server.ts; here we simply continue with whatever
    // partial catalog was returned (may be empty).
    process.stderr.write(`${MCP_LOG_PREFIX}: ${catalogResult.error}\n`);
  }
  const propertyResult = loadBundledPropertyIndex(dataDir);
  if (propertyResult.error) {
    process.stderr.write(`${MCP_LOG_PREFIX}: ${propertyResult.error}\n`);
  }
  const objectPropertyResult = loadBundledObjectPropertyIndex(dataDir);
  if (objectPropertyResult.error) {
    process.stderr.write(`${MCP_LOG_PREFIX}: ${objectPropertyResult.error}\n`);
  }
  const propertyControlResult = loadBundledMcpControlReference(dataDir);
  if (propertyControlResult.error) {
    process.stderr.write(`${MCP_LOG_PREFIX}: ${propertyControlResult.error}\n`);
  }
  return {
    knowledgeBase: catalogResult.knowledgeBase,
    catalog: catalogResult.catalog,
    byName: buildKnowledgeByName(catalogResult.knowledgeBase),
    propertyIndex: propertyResult.index,
    objectPropertyIndex: objectPropertyResult.index,
    propertyControlIndex: propertyControlResult.index,
  };
}
