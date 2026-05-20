// Resolves the pangolint-mcp package version at runtime so the
// McpServer constructor and `getServerConfig` always advertise the
// version declared in package.json - no hardcoded constant to drift.
//
// The resolver assumes the standard mcp/ layout: this module is bundled
// into mcp/dist/server.js (published tarball) or executed from
// mcp/src/packageInfo.ts (vitest). In both cases, ../package.json is
// the mcp package manifest.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readPackageVersion(): string {
  const here = fileURLToPath(import.meta.url);
  const manifestPath = path.resolve(path.dirname(here), "..", "package.json");
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { name?: string; version?: string };
  if (parsed.name !== "pangolint-mcp" || typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`pangolint-mcp/package.json at ${manifestPath} is missing name/version`);
  }
  return parsed.version;
}

export const SERVER_VERSION: string = readPackageVersion();
