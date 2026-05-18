import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadBundledCatalog } from "../../src/knowledge/catalogLoader";

describe("loadBundledCatalog", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "pangolint-loader-"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("loads the merged knowledge base when present", () => {
    writeMergedKnowledge(tempRoot, {
      schemaVersion: 1,
      generatedAt: "2026-05-03T00:00:00.000Z",
      commands: {
        SelectZone: {
          canonical: "SelectZone",
          evidenceLevel: "exported",
          confidence: "medium",
          forms: [{ signature: "SelectZone 1" }],
        },
      },
    });

    const result = loadBundledCatalog(tempRoot);

    expect(result.error).toBeUndefined();
    expect(result.source).toBe("merged-knowledge");
    expect(result.catalog.commands.length).toBe(1);
    expect(result.catalog.commands[0]?.canonical).toBe("SelectZone");
  });

  it("reports a clear error when merged JSON is corrupt", () => {
    mkdirSync(path.join(tempRoot, "data", "pangoscript"), { recursive: true });
    writeFileSync(path.join(tempRoot, "data", "pangoscript", "commands.merged.json"), "{ not valid json", "utf8");

    const result = loadBundledCatalog(tempRoot);

    expect(result.error).toMatch(/Failed to parse commands\.merged\.json/);
    expect(result.source).toBe("empty");
    expect(result.catalog.commands).toEqual([]);
  });

  it("reports a clear error when no catalog source is available", () => {
    const result = loadBundledCatalog(tempRoot);

    expect(result.error).toMatch(/No PangoScript command catalog/);
    expect(result.source).toBe("empty");
    expect(result.catalog.commands).toEqual([]);
  });
});

function writeMergedKnowledge(root: string, value: unknown): void {
  const dir = path.join(root, "data", "pangoscript");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "commands.merged.json"), JSON.stringify(value), "utf8");
}
