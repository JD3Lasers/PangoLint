import { describe, expect, it } from "vitest";
import { buildMcpPropertyControlIndex, type McpControlReferenceFile } from "../../src/knowledge/mcpControlReference";
import { loadMcpKnowledge } from "../src/knowledgeBase";
import { lookupPropertyControls } from "../src/tools/lookupPropertyControls";
import { searchPropertyControls } from "../src/tools/searchPropertyControls";

const fixture: McpControlReferenceFile = {
  schemaVersion: 1,
  entries: [
    {
      path: "DmxOutput.N",
      label: "N",
      root: "DmxOutput",
      property: "N",
      kind: "object",
      confidence: "observed",
      coverage: {
        hasObjectContext: true,
        hasObjectBusPath: true,
        hasPangoScriptCommand: true,
        hasOscCommandRoute: true,
        hasRangeSeed: true,
      },
      objectTree: {
        path: "DmxOutput.N",
        normalizedPath: "DmxOutput.N",
        directBusPath: "/b/DmxOutput/0",
        variantCount: 2047,
        contextCount: 4,
        contexts: [
          { domain: "object", kind: "indexed-root", label: "DMX output 1", propertyPath: "N" },
          { domain: "object", kind: "indexed-root", label: "DMX output 2", propertyPath: "N" },
          { domain: "object", kind: "indexed-root", label: "DMX output 3", propertyPath: "N" },
          { domain: "object", kind: "indexed-root", label: "DMX output 4", propertyPath: "N" },
        ],
        objectBusPathCount: 4,
        objectBusPaths: ["/b/DmxOutput/0", "/b/DmxOutput/1", "/b/DmxOutput/2", "/b/DmxOutput/3"],
      },
      value: {
        valueType: "integer",
        range: { min: 0, max: 255, boundaryBehavior: "clamp", evidenceLevel: "observed" },
        evidenceLevel: "observed",
        locationKind: "indexed-root",
      },
      readback: { status: "readback-tested", evidenceLevel: "observed" },
      behavior: {
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      },
      pangoScript: {
        commandCount: 4,
        commands: [
          { commandName: "DmxOut", label: "DMX output", category: "MIDI, DMX, Channel, OSC output", safetyTier: "T3" },
          { commandName: "DmxOutRange", category: "MIDI, DMX, Channel, OSC output", safetyTier: "T3" },
          { commandName: "DmxOut16", category: "MIDI, DMX, Channel, OSC output", safetyTier: "T3" },
          { commandName: "DmxOutFine", category: "MIDI, DMX, Channel, OSC output", safetyTier: "T3" },
        ],
        parameterRangeCount: 4,
        parameterRanges: [
          {
            commandName: "DmxOut",
            formSignature: "DmxOut <channel>, <value>",
            parameterName: "channel",
            range: "1..2048",
          },
          {
            commandName: "DmxOut",
            formSignature: "DmxOut <channel>, <value>",
            parameterName: "value",
            range: "0..255 or -1",
          },
          { commandName: "DmxOutRange", parameterName: "startChannel", range: "1..2048" },
          { commandName: "DmxOutRange", parameterName: "value", range: "0..255" },
        ],
      },
      osc: {
        routeCount: 4,
        routes: [
          {
            routeId: "osc.beyond-dmx.f",
            namespace: "gateway",
            pathPattern: "/beyond/dmx",
            args: ["f[]"],
            safetyTier: "T2",
          },
          {
            routeId: "osc.beyond-general-dmxout.f-f",
            namespace: "general",
            pathPattern: "/beyond/general/DmxOut",
            args: ["f", "f"],
          },
          {
            routeId: "osc.beyond-general-dmxout.i-i",
            namespace: "general",
            pathPattern: "/beyond/general/DmxOut",
            args: ["i", "i"],
          },
          {
            routeId: "osc.beyond-general-dmxout.s-s",
            namespace: "general",
            pathPattern: "/beyond/general/DmxOut",
            args: ["s", "s"],
          },
        ],
      },
      detailAvailable: {
        objectContexts: 4,
        objectBusPaths: 4,
        commands: 4,
        oscRoutes: 4,
        parameterRanges: 4,
      },
    },
  ],
};

const index = buildMcpPropertyControlIndex(fixture);

describe("lookupPropertyControls", () => {
  it("returns compact control information for an exact or concrete property path", () => {
    const result = lookupPropertyControls({ path: "DmxOutput.5" }, index);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.propertyControl.path).toBe("DmxOutput.N");
      expect(result.data.propertyControl.pangoScript.commands).toHaveLength(3);
      expect(result.data.propertyControl.osc.routes).toHaveLength(3);
      expect(result.data.propertyControl.objectTree.objectBusPaths).toHaveLength(3);
      expect(result.data.propertyControl.value?.range).toMatchObject({ min: 0, max: 255 });
      expect(result.data.propertyControl.readback?.status).toBe("readback-tested");
      expect(result.data.propertyControl.behavior?.accessMode).toBe("read-write");
      expect(result.data.propertyControl.pangoScript.omitted.commands).toBe(1);
      expect(serializedBytes(result.data)).toBeLessThan(8_000);
    }
  });

  it("expands examples with hard response caps", () => {
    const result = lookupPropertyControls(
      {
        path: "DmxOutput.N",
        includeDetails: true,
        commandLimit: 99,
        oscRouteLimit: 99,
        objectContextLimit: 99,
        objectBusPathLimit: 99,
        parameterRangeLimit: 99,
      },
      index,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.propertyControl.pangoScript.commands).toHaveLength(4);
      expect(result.data.propertyControl.osc.routes).toHaveLength(4);
      expect(result.data.propertyControl.objectTree.contexts).toHaveLength(4);
      expect(result.data.propertyControl.limits.commandLimit).toBe(8);
      expect(serializedBytes(result.data)).toBeLessThan(12_000);
    }
  });

  it("reports missing properties clearly", () => {
    const result = lookupPropertyControls({ path: "Nope.Missing" }, index);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown property control");
  });
});

describe("searchPropertyControls", () => {
  it("finds property controls by command and OSC terms", () => {
    const result = searchPropertyControls({ query: "dmx output /beyond/dmx", limit: 5 }, index);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits).toHaveLength(1);
      expect(result.data.hits[0].path).toBe("DmxOutput.N");
      expect(result.data.hits[0].matchedTerms).toEqual(expect.arrayContaining(["dmx", "output", "beyond"]));
      expect(serializedBytes(result.data)).toBeLessThan(8_500);
    }
  });
});

describe("bundled MCP control reference", () => {
  const knowledge = loadMcpKnowledge({ PANGOLINT_MCP_DATA_DIR: process.cwd() });

  it("loads the tracked compact projection", () => {
    expect(knowledge.propertyControlIndex.size()).toBeGreaterThan(5_000);
  });

  it("serves exact lookup and search from the bundled projection", () => {
    const lookup = lookupPropertyControls({ path: "DmxOutput.5" }, knowledge.propertyControlIndex);
    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      expect(lookup.data.propertyControl.path).toBe("DmxOutput.N");
      expect(lookup.data.propertyControl.pangoScript.commandCount).toBeGreaterThan(0);
      expect(lookup.data.propertyControl.osc.routeCount).toBeGreaterThan(0);
      expect(lookup.data.propertyControl.value?.range?.max).toBe(255);
      expect(serializedBytes(lookup.data)).toBeLessThan(10_000);
    }

    const search = searchPropertyControls({ query: "dmx output", limit: 3 }, knowledge.propertyControlIndex);
    expect(search.ok).toBe(true);
    if (search.ok) {
      expect(search.data.hits.map((hit) => hit.path)).toContain("DmxOutput.N");
      expect(serializedBytes(search.data)).toBeLessThan(18_000);
    }
  });

  it("searches bundled controls by readback access mechanism", () => {
    const expressionSearch = searchPropertyControls(
      { query: "pangoscript-expression", limit: 10 },
      knowledge.propertyControlIndex,
    );
    const objectBusSearch = searchPropertyControls(
      { query: "osc-object-bus", limit: 50 },
      knowledge.propertyControlIndex,
    );

    expect(expressionSearch.ok).toBe(true);
    if (expressionSearch.ok) {
      expect(expressionSearch.data.hits.map((hit) => hit.path)).toContain("Projector.Count");
    }
    expect(objectBusSearch.ok).toBe(true);
    if (objectBusSearch.ok) {
      expect(objectBusSearch.data.hits.map((hit) => hit.path)).toContain("Status.Projector.Count");
    }
  });
});

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
