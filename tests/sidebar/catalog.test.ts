import { describe, expect, it } from "vitest";
import type { ExpressionFunctionEntry } from "../../src/knowledge/expressionFunctions";
import type { CommandKnowledgeEntry, PangoKnowledgeBase } from "../../src/knowledge/knowledgeBase";
import { buildSidebarCatalog, getCommandDetail, getCommands, groupByCategory } from "../../src/sidebar/model/catalog";

function entry(
  overrides: Partial<CommandKnowledgeEntry> & Pick<CommandKnowledgeEntry, "canonical">,
): CommandKnowledgeEntry {
  return {
    canonical: overrides.canonical,
    aliases: overrides.aliases ?? [],
    description: overrides.description ?? "",
    evidenceLevel: overrides.evidenceLevel ?? "documented",
    confidence: overrides.confidence ?? "medium",
    safetyTier: overrides.safetyTier ?? "unknown",
    category: overrides.category ?? "General",
    forms: overrides.forms,
    notes: overrides.notes,
    verification: overrides.verification,
    tags: overrides.tags,
    setsProperty: overrides.setsProperty,
  };
}

const fixture: PangoKnowledgeBase = {
  schemaVersion: 1,
  commands: {
    OscOutString: entry({
      canonical: "OscOutString",
      aliases: ["OscOutString"],
      description: "Sends a single OSC message with a string payload.",
      evidenceLevel: "documented",
      safetyTier: "T1",
      category: "OSC output",
      forms: [
        {
          signature: 'OscOutString "<addr>", "<tag>", "<value>"',
          parameters: [
            { name: "address", type: "string", required: true },
            { name: "tag", type: "string", required: true },
            { name: "value", type: "string", required: true },
          ],
        },
      ],
    }),
    OscOutInt: entry({
      canonical: "OscOutInt",
      aliases: ["OscOutInt"],
      description: "Sends a single OSC message with an integer payload.",
      evidenceLevel: "documented",
      safetyTier: "T1",
      category: "OSC output",
    }),
    BeyondPlay: entry({
      canonical: "BeyondPlay",
      description: "Plays the current cue.",
      evidenceLevel: "exported",
      safetyTier: "T3",
      category: "General",
    }),
    PlayCue: entry({
      canonical: "PlayCue",
      description: "Plays a cue by index.",
      evidenceLevel: "exported",
      safetyTier: "T3",
      category: "Cue clicking",
    }),
    SetBpm: entry({
      canonical: "SetBpm",
      description: "Set the master BPM tempo.",
      evidenceLevel: "observed",
      safetyTier: "T2",
      category: "Beat timer - tap and re-sync",
      setsProperty: ["Master.BPM"],
      forms: [
        {
          signature: "SetBpm <value>",
          parameters: [{ name: "value", type: "number", required: true }],
        },
      ],
    }),
    Chat: entry({
      canonical: "Chat",
      description: "Prototype stage command. Under construction. Do not use.",
      evidenceLevel: "documented",
      safetyTier: "T0",
      category: "General",
      tags: ["prototype", "do-not-use"],
    }),
    LoadCueFromBlob: entry({
      canonical: "LoadCueFromBlob",
      description: "Command designed for special project, do not use in PangoScript.",
      evidenceLevel: "documented",
      safetyTier: "T0",
      category: "Files",
      tags: ["internal", "do-not-use"],
    }),
  },
};

describe("sidebar catalog", () => {
  it("builds a sorted command list with BEYOND-native categories", () => {
    const catalog = buildSidebarCatalog(fixture);
    expect(catalog.list.map((command) => command.canonical)).toEqual(
      ["BeyondPlay", "OscOutString", "OscOutInt", "PlayCue", "SetBpm"].sort((a, b) => a.localeCompare(b)),
    );
    const categories = catalog.list.map((command) => command.category);
    expect(categories).toEqual(["General", "OSC output", "OSC output", "Cue clicking", "Beat timer - tap and re-sync"]);
  });

  it("omits prototype and do-not-use commands from the browsable command list", () => {
    const catalog = buildSidebarCatalog(fixture);

    expect(catalog.list.map((command) => command.canonical)).not.toContain("Chat");
    expect(catalog.list.map((command) => command.canonical)).not.toContain("LoadCueFromBlob");
    expect(getCommands(catalog, { query: "chat" })).toEqual([]);
    expect(getCommands(catalog, { query: "blob" })).toEqual([]);

    // Keep direct detail lookup addressable for legacy scripts and explicit links.
    expect(getCommandDetail(catalog, "chat")?.tags).toEqual(["prototype", "do-not-use"]);
  });

  it("filters by categories (multi-select)", () => {
    const catalog = buildSidebarCatalog(fixture);

    const oscOnly = getCommands(catalog, { categories: ["OSC output"] });
    expect(oscOnly.map((command) => command.canonical)).toEqual(["OscOutInt", "OscOutString"]);

    const oscPlusCue = getCommands(catalog, { categories: ["OSC output", "Cue clicking"] });
    expect(oscPlusCue.map((command) => command.canonical)).toEqual(["OscOutInt", "OscOutString", "PlayCue"]);

    // Empty array means no constraint, same as omitting the filter.
    const all = getCommands(catalog, { categories: [] });
    expect(all.map((command) => command.canonical)).toEqual([
      "BeyondPlay",
      "OscOutInt",
      "OscOutString",
      "PlayCue",
      "SetBpm",
    ]);
  });

  it("ranks free-text query: exact > prefix > substring > fuzzy", () => {
    const catalog = buildSidebarCatalog(fixture);
    const ranked = getCommands(catalog, { query: "osc" });
    expect(ranked.map((command) => command.canonical)).toEqual(["OscOutInt", "OscOutString"]);

    const fuzzy = getCommands(catalog, { query: "playcu" });
    expect(fuzzy[0]?.canonical).toBe("PlayCue");
  });

  it("treats spaced command-name searches as command-name matches", () => {
    const catalog = buildSidebarCatalog({
      schemaVersion: 1,
      commands: {
        ChannelOut: entry({
          canonical: "ChannelOut",
          aliases: ["ChannelOut"],
          description: "Set a BEYOND internal channel value.",
          category: "MIDI, DMX, Channel, OSC output",
          forms: [{ signature: "ChannelOut <channelIndex>, <value>" }],
        }),
        MeshPointChan: entry({
          canonical: "MeshPointChan",
          aliases: ["MeshPointChan"],
          description: "Define a mesh point with a channel-style shape.",
          category: "General",
        }),
        SetEffectChannelAction: entry({
          canonical: "SetEffectChannelAction",
          aliases: ["SetEffectChannelAction"],
          description: "Set the effect-channel action parameter for a channel.",
          category: "MIDI, DMX, Channel, OSC output",
        }),
      },
    });

    const ranked = getCommands(catalog, { query: "channel out" });

    expect(ranked.map((command) => command.canonical)).toContain("ChannelOut");
    expect(ranked[0]?.canonical).toBe("ChannelOut");
  });

  it("treats punctuation-only searches as no matches", () => {
    const catalog = buildSidebarCatalog(fixture);

    expect(getCommands(catalog, { query: "++" })).toEqual([]);
  });

  it("matches commands by their BEYOND category name", () => {
    const catalog = buildSidebarCatalog(fixture);

    // "cue" matches the "Cue clicking" category - only PlayCue has that category
    const cueCat = getCommands(catalog, { query: "cue clicking" });
    expect(cueCat.map((c) => c.canonical)).toContain("PlayCue");
    expect(cueCat.map((c) => c.canonical)).not.toContain("OscOutInt");

    // "osc output" matches the "OSC output" category
    const oscCat = getCommands(catalog, { query: "osc output" });
    expect(oscCat.map((c) => c.canonical)).toContain("OscOutInt");
    expect(oscCat.map((c) => c.canonical)).toContain("OscOutString");
    expect(oscCat.map((c) => c.canonical)).not.toContain("PlayCue");
  });

  it("returns full detail with parameters and example", () => {
    const catalog = buildSidebarCatalog(fixture);
    const detail = getCommandDetail(catalog, "oscoutstring");
    expect(detail).toBeDefined();
    expect(detail?.signatures[0]?.parameters).toHaveLength(3);
    expect(detail?.example).toBe('OscOutString "<addr>", "<tag>", "<value>"');
  });

  it("preserves command property mappings for the command detail panel", () => {
    const catalog = buildSidebarCatalog(fixture);
    const detail = getCommandDetail(catalog, "setbpm");

    expect(detail?.setsProperty).toEqual(["Master.BPM"]);
  });

  it("surfaces expression functions separately from commands", () => {
    const expressionFunctions: ExpressionFunctionEntry[] = [
      {
        canonical: "ExtValue",
        aliases: [],
        description: "Return the current external control value scaled into the requested range.",
        evidenceLevel: "inferred",
        confidence: "medium",
        forms: [
          {
            signature: "ExtValue(<min>, <max>)",
            parameters: [
              { name: "min", type: "number", required: true },
              { name: "max", type: "number", required: true },
            ],
          },
        ],
      },
    ];
    const catalog = buildSidebarCatalog(fixture, { expressionFunctions });

    const ext = getCommandDetail(catalog, "extvalue");

    expect(ext?.kind).toBe("function");
    expect(ext?.category).toBe("Expression");
    expect(ext?.signatures[0]?.signature).toBe("ExtValue(<min>, <max>)");
    expect(getCommands(catalog, { query: "ext" }).map((item) => item.canonical)).toEqual(["ExtValue"]);
  });

  it("returns undefined for unknown command names", () => {
    const catalog = buildSidebarCatalog(fixture);
    expect(getCommandDetail(catalog, "DoesNotExist")).toBeUndefined();
  });

  it("groups commands by BEYOND category, alphabetical when no order map provided", () => {
    const catalog = buildSidebarCatalog(fixture);
    const groups = groupByCategory(catalog.list);
    expect([...groups.keys()]).toEqual(["Beat timer - tap and re-sync", "Cue clicking", "General", "OSC output"]);
    expect(groups.get("OSC output")?.map((command) => command.canonical)).toEqual(["OscOutInt", "OscOutString"]);
  });

  it("groups commands by BEYOND category, sorted by tree order when order map provided", () => {
    const catalog = buildSidebarCatalog(fixture);
    // Tree order: General=1, Cue clicking=2, OSC output=13
    const categoryOrder = { General: 1, "Cue clicking": 2, "Beat timer - tap and re-sync": 3, "OSC output": 13 };
    const groups = groupByCategory(catalog.list, categoryOrder);
    expect([...groups.keys()]).toEqual(["General", "Cue clicking", "Beat timer - tap and re-sync", "OSC output"]);
    expect(groups.get("OSC output")?.map((command) => command.canonical)).toEqual(["OscOutInt", "OscOutString"]);
  });
});
