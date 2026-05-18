import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPropertyIndex,
  loadBundledPropertyIndex,
  type PropertyIndexFile,
} from "../../src/knowledge/propertyIndex";

function makeFixture(file: PropertyIndexFile): string {
  const dir = mkdtempSync(join(tmpdir(), "pangolint-propindex-"));
  const dataDir = join(dir, "data", "pangoscript", "object-tree", "runtime-indexes");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "known-properties.json"), JSON.stringify(file));
  return dir;
}

const sample: PropertyIndexFile = {
  schemaVersion: 1,
  generatedAt: "2026-05-04T00:00:00Z",
  generatedFrom: "test fixture",
  schemas: [
    {
      object: "Master",
      isArray: false,
      propertyCount: 3,
      properties: ["Brightness", "RotoAngleX", "UGC.ShearY"],
      sharedWithAliases: 0,
    },
    {
      object: "Zone",
      isArray: true,
      propertyCount: 2,
      properties: ["Red", "RotoAngleX"],
      sharedWithAliases: 23,
    },
  ],
};

describe("buildPropertyIndex", () => {
  it("indexes schemas by lowercase object name and resolves both cases", () => {
    const index = buildPropertyIndex(sample);
    expect(index.size()).toBe(2);
    expect(index.getObject("Master")?.properties).toContain("RotoAngleX");
    expect(index.getObject("master")?.properties).toContain("RotoAngleX");
    expect(index.getObject("zone")?.isArray).toBe(true);
    expect(index.getObject("nope")).toBeUndefined();
  });

  it("returns sorted list of all object names", () => {
    const index = buildPropertyIndex(sample);
    expect(index.allObjectNames()).toEqual(["Master", "Zone"]);
  });
});

describe("loadBundledPropertyIndex", () => {
  it("loads and indexes a valid known-properties.json", () => {
    const dir = makeFixture(sample);
    try {
      const result = loadBundledPropertyIndex(dir);
      expect(result.source).toBe("bundled");
      expect(result.error).toBeUndefined();
      expect(result.index.size()).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty index with error message when file missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-propindex-empty-"));
    try {
      const result = loadBundledPropertyIndex(dir);
      expect(result.source).toBe("empty");
      expect(result.error).toMatch(/not found/);
      expect(result.index.size()).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty index when JSON is malformed", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-propindex-bad-"));
    const dataDir = join(dir, "data", "pangoscript", "object-tree", "runtime-indexes");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "known-properties.json"), "{ this isn't json");
    try {
      const result = loadBundledPropertyIndex(dir);
      expect(result.source).toBe("empty");
      expect(result.error).toMatch(/Failed to parse/);
      expect(result.index.size()).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty index when schemas array is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-propindex-missingfield-"));
    const dataDir = join(dir, "data", "pangoscript", "object-tree", "runtime-indexes");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, "known-properties.json"),
      JSON.stringify({ schemaVersion: 1, generatedAt: "", generatedFrom: "" }),
    );
    try {
      const result = loadBundledPropertyIndex(dir);
      expect(result.source).toBe("empty");
      expect(result.error).toMatch(/malformed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
