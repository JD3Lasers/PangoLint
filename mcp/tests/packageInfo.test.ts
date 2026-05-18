// Locks the version-drift fix in place: SERVER_VERSION (read at module
// load from mcp/package.json) must match what the manifest actually
// declares. If anyone ever bumps the version in only one place, this
// test fires.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_VERSION } from "../src/packageInfo";

describe("SERVER_VERSION", () => {
  it("matches the version declared in mcp/package.json", () => {
    const manifestPath = path.resolve(__dirname, "..", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: string; version?: string };
    expect(manifest.name).toBe("pangolint-mcp");
    expect(manifest.version).toBeTruthy();
    expect(SERVER_VERSION).toBe(manifest.version);
  });

  it("is a non-empty string", () => {
    expect(typeof SERVER_VERSION).toBe("string");
    expect(SERVER_VERSION.length).toBeGreaterThan(0);
  });
});
