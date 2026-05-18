import { describe, expect, it } from "vitest";
import type { CommandKnowledgeEntry } from "../../src/knowledge/knowledgeBase";
import { buildObjectPropertyIndex, type ObjectPropertyIndexFile } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import { loadMcpKnowledge } from "../src/knowledgeBase";
import { listObjects } from "../src/tools/listObjects";
import { lookupCommand } from "../src/tools/lookupCommand";
import { lookupObject } from "../src/tools/lookupObject";
import { searchCommands } from "../src/tools/searchCommands";

function makeKnowledge(): Map<string, CommandKnowledgeEntry> {
  const entries: CommandKnowledgeEntry[] = [
    {
      canonical: "Brightness",
      aliases: ["brightness"],
      evidenceLevel: "exported",
      confidence: "high",
      safetyTier: "T1",
      category: "General",
      forms: [{ signature: "Brightness <value>" }],
      description: "Set master brightness 0..100.",
    },
    {
      canonical: "EnableLaserOutput",
      aliases: ["enablelaseroutput"],
      evidenceLevel: "documented",
      confidence: "high",
      safetyTier: "T2",
      category: "General",
      forms: [{ signature: "EnableLaserOutput" }],
      description: "Enable laser output.",
    },
    {
      canonical: "BlackOut",
      aliases: ["blackout"],
      evidenceLevel: "documented",
      confidence: "high",
      safetyTier: "T4",
      category: "General",
      forms: [{ signature: "BlackOut" }],
      description: "Stop all output.",
    },
    {
      canonical: "DisplayPopup",
      aliases: ["displaypopup"],
      evidenceLevel: "documented",
      confidence: "high",
      safetyTier: "T1",
      category: "General",
      forms: [
        {
          signature: 'DisplayPopup "<message>"',
          description: "Show a popup dialog to the operator.",
          parameters: [{ name: "message", type: "string", required: true, description: "Popup message text." }],
        },
      ],
      description: "Show a popup message in BEYOND.",
    },
    {
      canonical: "OscOutTTS",
      aliases: ["oscouttts"],
      evidenceLevel: "documented",
      confidence: "high",
      safetyTier: "T1",
      category: "MIDI, DMX, Channel, OSC output",
      forms: [
        {
          signature: 'OscOutTTS "/path", "s", "<text>"',
          description: "Send an OSC packet with type tags.",
          parameters: [
            { name: "address", type: "string", required: true, description: "OSC address path." },
            { name: "types", type: "string", required: true, description: "OSC type tag string." },
            { name: "value", type: "string", required: true, description: "String payload." },
          ],
        },
      ],
      notes: [{ text: "Useful for readback pings because it can send OSC string values to a listener." }],
      tags: ["osc", "string", "readback"],
      description: "Send OSC output from a PangoScript command.",
    },
  ];
  const map = new Map<string, CommandKnowledgeEntry>();
  for (const entry of entries) {
    map.set(entry.canonical.toLowerCase(), entry);
    for (const alias of entry.aliases ?? []) map.set(alias.toLowerCase(), entry);
  }
  return map;
}

const fixturePropertyIndex = buildPropertyIndex({
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test",
  schemas: [
    { object: "Master", isArray: false, propertyCount: 1, properties: ["Brightness"], sharedWithAliases: 0 },
    { object: "Zone", isArray: true, propertyCount: 2, properties: ["Red", "Brightness"], sharedWithAliases: 0 },
    { object: "UniversePanel", isArray: true, propertyCount: 1, properties: ["Caption"], sharedWithAliases: 0 },
  ],
} satisfies PropertyIndexFile);

const fixtureObjectPropertyIndex = buildObjectPropertyIndex({
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test",
  entries: [
    {
      path: "Master.ShowSpeed",
      normalizedPath: "Master.ShowSpeed",
      root: "Master",
      property: "ShowSpeed",
      kind: "object",
      confidence: "observed",
      osc: "/b/Master/ShowSpeed",
      searchText: "master show speed",
      variantCount: 1,
      variants: [{ path: "Master.ShowSpeed", osc: "/b/Master/ShowSpeed" }],
    },
    {
      path: "WS.N.N.Caption",
      normalizedPath: "WS.N.N.Caption",
      root: "WS",
      property: "Caption",
      kind: "object",
      confidence: "observed",
      searchText: "workspace cue grid caption",
      variantCount: 1,
      variants: [{ path: "WS.1.2.Caption", osc: "/b/WS/1/2/Caption" }],
    },
    {
      path: "FX.N.N.N.Oscillator.Period",
      normalizedPath: "FX.N.N.N.Oscillator.Period",
      root: "FX",
      property: "Oscillator.Period",
      kind: "fx",
      confidence: "observed",
      searchText: "fx quickfx oscillator period",
      variantCount: 1,
      variants: [{ path: "FX.0.0.0.Oscillator.Period", osc: "/b/FX/0/0/0/Oscillator/Period" }],
    },
    {
      path: "FX.N.N.N.Oscillator.Amplitude",
      normalizedPath: "FX.N.N.N.Oscillator.Amplitude",
      root: "FX",
      property: "Oscillator.Amplitude",
      kind: "fx",
      confidence: "observed",
      searchText: "fx quickfx oscillator amplitude",
      variantCount: 1,
      variants: [{ path: "FX.0.0.0.Oscillator.Amplitude", osc: "/b/FX/0/0/0/Oscillator/Amplitude" }],
    },
  ],
} satisfies ObjectPropertyIndexFile);

describe("lookupCommand", () => {
  const byName = makeKnowledge();

  it("returns the entry for a canonical name", () => {
    const result = lookupCommand({ name: "Brightness" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.canonical).toBe("Brightness");
  });

  it("looks up case-insensitively", () => {
    expect(lookupCommand({ name: "BRIGHTNESS" }, byName).ok).toBe(true);
    expect(lookupCommand({ name: "brightness" }, byName).ok).toBe(true);
  });

  it("fails on unknown names", () => {
    const result = lookupCommand({ name: "TotallyMadeUp" }, byName);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown command");
  });

  it("fails when name is missing or blank", () => {
    expect(lookupCommand({ name: "" }, byName).ok).toBe(false);
    expect(lookupCommand({ name: "   " }, byName).ok).toBe(false);
  });
});

describe("searchCommands", () => {
  const byName = makeKnowledge();
  const references = new Map([
    [
      "displaypopup",
      "### DisplayPopup\n\nUse this command for an operator-facing modal notice when the script needs acknowledgement before continuing.",
    ],
  ]);

  it("ranks by Levenshtein distance (closest first)", () => {
    const result = searchCommands({ query: "Brigtness" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].canonical).toBe("Brightness");
      expect(result.data.hits[0].distance).toBeLessThan(2);
    }
  });

  it("filters by safetyTier", () => {
    const result = searchCommands({ query: "out", safetyTier: "T4" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const canonicals: string[] = result.data.hits.map((h) => h.canonical);
      expect(canonicals).toContain("BlackOut");
      expect(canonicals).not.toContain("Brightness");
    }
  });

  it("respects the limit", () => {
    const result = searchCommands({ query: "a", limit: 1 }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hits).toHaveLength(1);
  });

  it("dedupes entries seen via aliases", () => {
    const result = searchCommands({ query: "brightness" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const canonicals: string[] = result.data.hits.map((h) => h.canonical);
      const brightnessHits = canonicals.filter((n: string) => n === "Brightness");
      expect(brightnessHits).toHaveLength(1);
    }
  });

  it("fails on blank query", () => {
    expect(searchCommands({ query: "" }, byName).ok).toBe(false);
  });

  it("rejects oversized queries before Levenshtein ranking", () => {
    const result = searchCommands({ query: "brightness ".repeat(PANGO_ANALYSIS_LIMITS.maxMcpQueryChars) }, byName);

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("query exceeds") });
  });

  it("fails when a query has no searchable letters or numbers", () => {
    const result = searchCommands({ query: "!!!" }, byName);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("letter or number");
  });

  it("searches descriptions and parameters for task-intent queries", () => {
    const result = searchCommands({ query: "popup message" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].canonical).toBe("DisplayPopup");
      expect(result.data.hits[0].matchedFields).toEqual(expect.arrayContaining(["description", "parameters"]));
    }
  });

  it("searches categories, forms, notes, and tags for OSC task-intent queries", () => {
    const result = searchCommands({ query: "send osc string" }, byName);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].canonical).toBe("OscOutTTS");
      expect(result.data.hits[0].matchedFields).toEqual(expect.arrayContaining(["category", "forms", "notes", "tags"]));
    }
  });

  it("searches command-reference prose when catalog fields are not enough", () => {
    const result = searchCommands({ query: "operator modal notice" }, byName, references);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits[0].canonical).toBe("DisplayPopup");
      expect(result.data.hits[0].matchedFields).toContain("reference");
      expect(result.data.hits[0].referenceExcerpt).toContain("operator-facing modal notice");
    }
  });
});

describe("lookupObject", () => {
  it("returns the canonical schema for known names", () => {
    const result = lookupObject({ name: "Master" }, fixturePropertyIndex);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.properties).toEqual(["Brightness"]);
  });

  it("looks up case-insensitively", () => {
    expect(lookupObject({ name: "MASTER" }, fixturePropertyIndex).ok).toBe(true);
    expect(lookupObject({ name: "zone" }, fixturePropertyIndex).ok).toBe(true);
  });

  it("fails on unknown names", () => {
    const result = lookupObject({ name: "NotARealObject" }, fixturePropertyIndex);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown object");
  });

  it("resolves Object Tree roots that are not canonical schemas", () => {
    const result = lookupObject({ name: "WS" }, fixturePropertyIndex, fixtureObjectPropertyIndex);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.object).toBe("WS");
      expect(result.data.properties).toEqual(["Caption"]);
      expect(result.data.objectTree?.root).toBe("WS");
      expect(result.data.objectTree?.pathCount).toBe(1);
      expect(result.data.objectTree?.paths).toBeUndefined();
      expect(result.data.objectTree?.propertyPage.items).toEqual(["Caption"]);
      expect(result.data.sources).toEqual(["object-property-index"]);
      expect(serializedBytes(result.data)).toBeLessThan(1_500);
    }
  });

  it("returns a capped Object Tree path page only when requested", () => {
    const result = lookupObject(
      { name: "WS", includePaths: true, pathLimit: 1 },
      fixturePropertyIndex,
      fixtureObjectPropertyIndex,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.objectTree?.paths).toEqual(["WS.N.N.Caption"]);
      expect(result.data.objectTree?.pathPage).toMatchObject({
        items: ["WS.N.N.Caption"],
        offset: 0,
        limit: 1,
        total: 1,
      });
    }
  });

  it("preserves the total property count when property summaries are paged", () => {
    const result = lookupObject({ name: "FX", propertyLimit: 1 }, fixturePropertyIndex, fixtureObjectPropertyIndex);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.propertyCount).toBe(2);
      expect(result.data.properties).toHaveLength(1);
      expect(result.data.objectTree?.propertyCount).toBe(2);
      expect(result.data.objectTree?.propertyPage).toMatchObject({
        items: ["Oscillator.Amplitude"],
        offset: 0,
        limit: 1,
        total: 2,
        nextOffset: 1,
      });
    }
  });

  it("resolves concrete Object Tree paths through the same object lookup tool", () => {
    const result = lookupObject({ name: "WS.1.2.Caption" }, fixturePropertyIndex, fixtureObjectPropertyIndex);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.object).toBe("WS");
      expect(result.data.objectTree?.matchedProperty?.path).toBe("WS.N.N.Caption");
      expect(result.data.objectTree?.matchedVariant?.path).toBe("WS.1.2.Caption");
      expect(result.data.objectTree?.matchedProperty).not.toHaveProperty("variants");
    }
  });
});

describe("listObjects", () => {
  it("returns every canonical name + count", () => {
    const result = listObjects(fixturePropertyIndex);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.count).toBe(3);
      expect(result.data.names.sort()).toEqual(["Master", "UniversePanel", "Zone"]);
    }
  });

  it("includes Object Tree roots beside canonical schema names", () => {
    const result = listObjects(fixturePropertyIndex, fixtureObjectPropertyIndex);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.names).toEqual(["FX", "Master", "UniversePanel", "WS", "Zone"]);
      expect(result.data.count).toBe(5);
      expect(result.data.objects).toContainEqual(
        expect.objectContaining({
          name: "WS",
          sources: ["object-property-index"],
          objectTreePropertyCount: 1,
        }),
      );
    }
  });
});

describe("bundled MCP object discovery data", () => {
  it("lets agents resolve WS cue-grid paths through lookupObject", () => {
    const knowledge = loadMcpKnowledge({ PANGOLINT_MCP_DATA_DIR: process.cwd() });
    const result = lookupObject({ name: "WS.1.2.Caption" }, knowledge.propertyIndex, knowledge.objectPropertyIndex);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.object).toBe("WS");
      expect(result.data.sources).toEqual(["object-property-index"]);
      expect(result.data.objectTree?.matchedProperty?.path).toBe("WS.N.N.Caption");
      expect(result.data.objectTree?.paths).toBeUndefined();
      expect(serializedBytes(result.data)).toBeLessThan(3_500);
    }
  });
});

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
