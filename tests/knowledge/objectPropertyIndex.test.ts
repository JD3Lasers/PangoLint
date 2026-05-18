import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildObjectPropertyIndex,
  concretizeObjectPropertyShape,
  loadBundledObjectPropertyIndex,
  type ObjectPropertyIndexFile,
  objectPropertyPathMatchesShape,
  objectPropertyShapeForPath,
} from "../../src/knowledge/objectPropertyIndex";

const sample: ObjectPropertyIndexFile = {
  schemaVersion: 1,
  generatedAt: "2026-05-04T18:17:37Z",
  generatedFrom: "test fixture",
  entries: [
    {
      path: "Master.ShowSpeed",
      normalizedPath: "Master.ShowSpeed",
      root: "Master",
      property: "ShowSpeed",
      kind: "object",
      confidence: "observed",
      osc: "/b/Master/ShowSpeed",
      searchText: "master show speed global speed readback",
      variantCount: 1,
      variants: [{ path: "Master.ShowSpeed", osc: "/b/Master/ShowSpeed" }],
      classification: {
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: "Runtime write/readback evidence confirmed ShowSpeed changes stored timing state.",
      },
    },
    {
      path: "FX.N.N.N.Oscillator.Period",
      normalizedPath: "FX.N.N.N.Oscillator.Period",
      root: "FX",
      property: "Oscillator.Period",
      kind: "fx",
      confidence: "observed",
      searchText: "fx quickfx oscillator period timing zoom",
      variantCount: 2,
      variants: [
        { path: "FX.0.0.0.Oscillator.Period", osc: "/b/FX/0/0/0/Oscillator/Period" },
        { path: "FX.0.0.1.Oscillator.Period", osc: "/b/FX/0/0/1/Oscillator/Period" },
      ],
      probeContexts: [
        {
          id: "quickfx:oscillating-effect:size-x:fx-0-0-1",
          kind: "quickfx-effect",
          label: "Size X",
          parentLabel: "Oscillating effect",
          normalizedPrefix: "FX.N.N.N",
          probePrefix: "FX.0.0.1",
          probeOscPrefix: "/b/FX/0/0/1",
          populationDependent: true,
        },
      ],
      fx: {
        qfxPanel: "Layer 1, Effect 1",
        cellCaption: "OSCILLATING EFFECTS",
        label: "Oscillating effect - Zoom",
        channel: "Zoom",
      },
    },
    {
      path: "WS.N.N.Ani.0.MaxValue",
      normalizedPath: "WS.N.N.Ani.0.MaxValue",
      root: "WS",
      property: "Ani.0.MaxValue",
      kind: "object",
      confidence: "observed",
      osc: "/b/WS/0/0/Ani/0/MaxValue",
      searchText: "workspace cue animation max value",
      variantCount: 1,
      variants: [{ path: "WS.0.0.Ani.0.MaxValue", osc: "/b/WS/0/0/Ani/0/MaxValue" }],
      probeContexts: [
        {
          id: "cue-type:object-animator",
          kind: "cue-type",
          label: "Object Animator",
          normalizedPrefix: "WS.N.N",
          probePrefix: "WS.0.13",
          probeOscPrefix: "/b/WS/0/13",
          populationDependent: true,
        },
      ],
      valueMetadata: {
        valueType: "float",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 1,
          unit: "normalized",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
          indexBasis: "page index then cue slot index",
        },
      },
    },
    {
      path: "FB3-XXXXX.ColorShift",
      normalizedPath: "FB3-XXXXX.ColorShift",
      root: "FB3-XXXXX",
      property: "ColorShift",
      kind: "object",
      confidence: "observed",
      searchText: "fb3 hardware controller color shift",
      variantCount: 1,
      variants: [{ path: "FB3-XXXXX.ColorShift" }],
    },
    {
      path: "FB4-XXXXX.Connected",
      normalizedPath: "FB4-XXXXX.Connected",
      root: "FB4-XXXXX",
      property: "Connected",
      kind: "object",
      confidence: "observed",
      searchText: "fb4 hardware controller connected",
      variantCount: 1,
      variants: [{ path: "FB4-XXXXX.Connected" }],
    },
  ],
};

function makeFixture(file: ObjectPropertyIndexFile): string {
  const dir = mkdtempSync(join(tmpdir(), "pangolint-object-props-"));
  const dataDir = join(dir, "data", "pangoscript", "object-tree", "runtime-indexes");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "object-property-index.json"), JSON.stringify(file));
  return dir;
}

describe("buildObjectPropertyIndex", () => {
  it("resolves exact and normalized paths case-insensitively", () => {
    const index = buildObjectPropertyIndex(sample);

    expect(index.lookup("Master.ShowSpeed")?.entry.path).toBe("Master.ShowSpeed");
    expect(index.lookup("master.showspeed")?.entry.path).toBe("Master.ShowSpeed");

    const fx = index.lookup("FX.0.0.1.Oscillator.Period");
    expect(fx?.entry.path).toBe("FX.N.N.N.Oscillator.Period");
    expect(fx?.matchedVariant?.path).toBe("FX.0.0.1.Oscillator.Period");
  });

  it("preserves behavior classification metadata for lookup callers", () => {
    const index = buildObjectPropertyIndex(sample);

    expect(index.lookup("Master.ShowSpeed")?.entry.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
      notes: "Runtime write/readback evidence confirmed ShowSpeed changes stored timing state.",
    });
  });

  it("resolves Object Tree shapes without collapsing literal numeric property members", () => {
    const index = buildObjectPropertyIndex(sample);

    const lookup = index.lookup("WS.1.2.Ani.0.MaxValue");
    expect(lookup?.entry.path).toBe("WS.N.N.Ani.0.MaxValue");
    expect(lookup?.entry.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: { min: 0, max: 1, unit: "normalized" },
      locationContext: { kind: "workspace-slot", populationDependent: true },
    });
    expect(index.lookup("WS.1.2.Ani.1.MaxValue")).toBeUndefined();
  });

  it("exposes probe context metadata for location-aware normalized paths", () => {
    const index = buildObjectPropertyIndex(sample);

    expect(index.lookup("WS.1.2.Ani.0.MaxValue")?.entry.probeContexts).toEqual([
      expect.objectContaining({
        id: "cue-type:object-animator",
        kind: "cue-type",
        label: "Object Animator",
        probePrefix: "WS.0.13",
        probeOscPrefix: "/b/WS/0/13",
      }),
    ]);
    expect(index.lookup("FX.0.0.1.Oscillator.Period")?.entry.probeContexts).toEqual([
      expect.objectContaining({
        id: "quickfx:oscillating-effect:size-x:fx-0-0-1",
        kind: "quickfx-effect",
        label: "Size X",
        probePrefix: "FX.0.0.1",
        probeOscPrefix: "/b/FX/0/0/1",
      }),
    ]);
  });

  it("resolves concrete FB3 and FB4 controller serial roots against redacted Object Tree entries", () => {
    const index = buildObjectPropertyIndex(sample);
    const numericSerial = [1, 2, 3, 4, 5].join("");
    const alphaSerial = ["ABC", "123"].join("");
    const fb3Root = ["F", "B", "3"].join("");
    const fb4Root = ["F", "B", "4"].join("");

    expect(index.lookup(`${fb3Root}-${numericSerial}.ColorShift`)?.entry.path).toBe("FB3-XXXXX.ColorShift");
    expect(index.lookup(`${fb3Root}_${numericSerial}.ColorShift`)?.entry.path).toBe("FB3-XXXXX.ColorShift");
    expect(index.lookup(`${fb4Root}-${alphaSerial}.Connected`)?.entry.path).toBe("FB4-XXXXX.Connected");
    expect(index.entriesForRoot(`${fb4Root}_${alphaSerial}`).map((entry) => entry.path)).toEqual([
      "FB4-XXXXX.Connected",
    ]);
  });

  it("groups entries by root for callers that need bounded candidate scans", () => {
    const index = buildObjectPropertyIndex(sample);

    expect(index.entriesForRoot("WS").map((entry) => entry.path)).toEqual(["WS.N.N.Ani.0.MaxValue"]);
    expect(index.entriesForRoot("missing")).toEqual([]);
  });

  it("searches terms and filters by root and kind", () => {
    const index = buildObjectPropertyIndex(sample);

    const fxHits = index.search({ query: "oscillator period", root: "FX", kind: "fx" });
    expect(fxHits[0].entry.path).toBe("FX.N.N.N.Oscillator.Period");

    const masterHits = index.search({ query: "show speed", root: "Master" });
    expect(masterHits[0].entry.path).toBe("Master.ShowSpeed");
  });
});

describe("objectPropertyShapeForPath", () => {
  it("only wildcard-normalizes segments marked as placeholders by the index shape", () => {
    expect(objectPropertyShapeForPath("WS.1.2.Ani.0.MaxValue", "WS.N.N.Ani.0.MaxValue")).toBe("WS.N.N.Ani.0.MaxValue");
    expect(objectPropertyPathMatchesShape("WS.1.2.Ani.0.MaxValue", "WS.N.N.Ani.0.MaxValue")).toBe(true);
    expect(objectPropertyPathMatchesShape("WS.1.2.Ani.1.MaxValue", "WS.N.N.Ani.0.MaxValue")).toBe(false);
    expect(objectPropertyShapeForPath("WS.1.A.Caption", "WS.N.N.Caption")).toBeUndefined();
    expect(concretizeObjectPropertyShape("WS.N.N.Caption", "WS.1.A.Captino")).toBeUndefined();
  });
});

describe("loadBundledObjectPropertyIndex", () => {
  it("loads the bundled object-property-index.json", () => {
    const dir = makeFixture(sample);
    try {
      const result = loadBundledObjectPropertyIndex(dir);
      expect(result.source).toBe("bundled");
      expect(result.error).toBeUndefined();
      expect(result.index.size()).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty index with an error when the file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-object-props-empty-"));
    try {
      const result = loadBundledObjectPropertyIndex(dir);
      expect(result.source).toBe("empty");
      expect(result.error).toMatch(/object-property-index\.json not found/);
      expect(result.index.size()).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
