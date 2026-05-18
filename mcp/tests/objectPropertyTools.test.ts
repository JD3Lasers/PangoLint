import { describe, expect, it } from "vitest";

import { buildObjectPropertyIndex, type ObjectPropertyIndexFile } from "../../src/knowledge/objectPropertyIndex";
import { loadMcpKnowledge } from "../src/knowledgeBase";
import { lookupObjectProperty } from "../src/tools/lookupObjectProperty";
import { searchObjectProperties } from "../src/tools/searchObjectProperties";

const fixture: ObjectPropertyIndexFile = {
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
    },
    {
      path: "FX.N.N.N.Oscillator.Period",
      normalizedPath: "FX.N.N.N.Oscillator.Period",
      root: "FX",
      property: "Oscillator.Period",
      kind: "fx",
      confidence: "observed",
      searchText: "fx quickfx oscillator period timing zoom",
      variantCount: 4,
      variants: [
        { path: "FX.0.0.0.Oscillator.Period", osc: "/b/FX/0/0/0/Oscillator/Period" },
        { path: "FX.0.0.1.Oscillator.Period", osc: "/b/FX/0/0/1/Oscillator/Period" },
        { path: "FX.0.0.2.Oscillator.Period", osc: "/b/FX/0/0/2/Oscillator/Period" },
        { path: "FX.0.0.3.Oscillator.Period", osc: "/b/FX/0/0/3/Oscillator/Period" },
      ],
      probeContexts: [
        {
          id: "quickfx:oscillating-effect:zoom:fx-0-0-0",
          kind: "quickfx-effect",
          label: "Zoom",
          parentLabel: "Oscillating effect",
          normalizedPrefix: "FX.N.N.N",
          probePrefix: "FX.0.0.0",
          probeOscPrefix: "/b/FX/0/0/0",
          populationDependent: true,
        },
        {
          id: "quickfx:oscillating-effect:zoom:fx-0-0-1",
          kind: "quickfx-effect",
          label: "Zoom",
          parentLabel: "Oscillating effect",
          normalizedPrefix: "FX.N.N.N",
          probePrefix: "FX.0.0.1",
          probeOscPrefix: "/b/FX/0/0/1",
          populationDependent: true,
        },
      ],
      valueMetadata: {
        evidenceLevel: "observed",
        locationContext: {
          kind: "quickfx-slot",
          populationDependent: true,
          notes: "Effect slots depend on the current show.",
        },
      },
      classification: {
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      },
    },
  ],
};

const index = buildObjectPropertyIndex(fixture);

describe("searchObjectProperties", () => {
  it("returns ranked object-property hits", () => {
    const result = searchObjectProperties({ query: "show speed", limit: 5 }, index);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].path).toBe("Master.ShowSpeed");
      expect(result.data.hits[0].osc).toBe("/b/Master/ShowSpeed");
      expect(result.data.hits[0]).not.toHaveProperty("variants");
      expect(serializedBytes(result.data)).toBeLessThan(1_500);
    }
  });

  it("supports root and kind filters", () => {
    const result = searchObjectProperties({ query: "period", root: "FX", kind: "fx" }, index);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits).toHaveLength(1);
      expect(result.data.hits[0].path).toBe("FX.N.N.N.Oscillator.Period");
      expect(result.data.hits[0]).not.toHaveProperty("variants");
      expect(result.data.hits[0]).not.toHaveProperty("probeContexts");
      expect(result.data.hits[0].valueSummary).toMatchObject({
        evidenceLevel: "observed",
        locationKind: "quickfx-slot",
      });
      expect(result.data.hits[0].classification).toEqual({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(result.data.hits[0].readbackSummary).toEqual({
        status: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(result.data.hits[0].detailAvailable).toEqual({
        variants: 4,
        probeContexts: 2,
        contextValueMetadata: 0,
      });
    }
  });

  it("returns capped details only when requested", () => {
    const result = searchObjectProperties(
      { query: "period", root: "FX", kind: "fx", includeDetails: true, variantLimit: 2, probeContextLimit: 1 },
      index,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].details?.variants).toHaveLength(2);
      expect(result.data.hits[0].details?.probeContexts).toEqual([
        expect.objectContaining({
          id: "quickfx:oscillating-effect:zoom:fx-0-0-0",
          probePrefix: "FX.0.0.0",
          probeOscPrefix: "/b/FX/0/0/0",
        }),
      ]);
      expect(result.data.hits[0].details?.omitted).toMatchObject({ variants: 2, probeContexts: 1 });
      expect(serializedBytes(result.data)).toBeLessThan(3_500);
    }
  });

  it("fails on blank query", () => {
    expect(searchObjectProperties({ query: "" }, index).ok).toBe(false);
  });
});

describe("lookupObjectProperty", () => {
  it("resolves concrete paths to their normalized entry", () => {
    const result = lookupObjectProperty({ path: "FX.0.0.0.Oscillator.Period" }, index);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.property.path).toBe("FX.N.N.N.Oscillator.Period");
      expect(result.data.matchedVariant?.path).toBe("FX.0.0.0.Oscillator.Period");
      expect(result.data.property).not.toHaveProperty("variants");
      expect(result.data.property.valueSummary).toMatchObject({ evidenceLevel: "observed" });
      expect(result.data.property.readbackSummary).toEqual({
        status: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(serializedBytes(result.data)).toBeLessThan(1_800);
    }
  });

  it("expands exact lookup details with hard caps", () => {
    const result = lookupObjectProperty(
      { path: "FX.0.0.0.Oscillator.Period", includeDetails: true, variantLimit: 99, probeContextLimit: 99 },
      index,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.property.details?.variants).toHaveLength(4);
      expect(result.data.property.details?.probeContexts).toHaveLength(2);
      expect(result.data.property.details?.limits.variantLimit).toBe(10);
      expect(result.data.property.details?.limits.probeContextLimit).toBe(8);
      expect(serializedBytes(result.data)).toBeLessThan(4_500);
    }
  });

  it("fails on unknown paths", () => {
    const result = lookupObjectProperty({ path: "Master.NotReal" }, index);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown object property");
  });
});

describe("bundled MCP object-property data", () => {
  it("exposes cue-grid WS.N.N properties from the same object tree users see in the extension", () => {
    const knowledge = loadMcpKnowledge({ PANGOLINT_MCP_DATA_DIR: process.cwd() });

    const lookup = lookupObjectProperty({ path: "WS.1.2.Caption" }, knowledge.objectPropertyIndex);
    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      expect(lookup.data.property.path).toBe("WS.N.N.Caption");
      expect(lookup.data.property.root).toBe("WS");
      expect(lookup.data.property.property).toBe("Caption");
      expect(lookup.data.property.classification?.readbackStatus).toBe("readback-tested");
      expect(lookup.data.property).not.toHaveProperty("variants");
      expect(serializedBytes(lookup.data)).toBeLessThan(2_500);
    }

    const search = searchObjectProperties(
      { query: "cue caption", root: "WS", limit: 5 },
      knowledge.objectPropertyIndex,
    );
    expect(search.ok).toBe(true);
    if (search.ok) {
      expect(search.data.hits.map((hit) => hit.path)).toContain("WS.N.N.Caption");
      const caption = search.data.hits.find((hit) => hit.path === "WS.N.N.Caption");
      expect(caption?.classification?.readbackStatus).toBe("readback-tested");
      expect(caption).not.toHaveProperty("variants");
      expect(serializedBytes(search.data)).toBeLessThan(6_000);
    }
  }, 30_000);
});

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
