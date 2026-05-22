import { describe, expect, it } from "vitest";
import { buildCommandListSections, objectSelectionSelectors } from "../../src/reference/bundle/list";
import { isObjectReferenceSection } from "../../src/reference/bundle/object-tree/objectTreeListRows";
import { buildIndex, search } from "../../src/reference/bundle/search";
import type { ReferenceCommand } from "../../src/reference/bundle/types";

function command(overrides: Partial<ReferenceCommand> & Pick<ReferenceCommand, "canonical">): ReferenceCommand {
  return {
    canonical: overrides.canonical,
    kind: overrides.kind ?? "command",
    aliases: overrides.aliases ?? [overrides.canonical],
    description: overrides.description ?? "",
    category: overrides.category ?? "General",
    safetyTier: overrides.safetyTier ?? "T1",
    evidenceLevel: overrides.evidenceLevel ?? "documented",
    forms: overrides.forms ?? [{ signature: overrides.canonical, parameters: [] }],
    notes: overrides.notes ?? [],
    tags: overrides.tags ?? [],
    coverage: overrides.coverage,
  };
}

describe("reference command search", () => {
  it("ranks spaced command-name searches before weaker description matches", () => {
    const commands = [
      command({
        canonical: "MeshPointChan",
        description: "Define a mesh point with a channel-style shape.",
        category: "General",
      }),
      command({
        canonical: "ChannelOut",
        description: "Set a BEYOND internal channel value.",
        category: "MIDI, DMX, Channel, OSC output",
        forms: [{ signature: "ChannelOut <channelIndex>, <value>", parameters: [] }],
      }),
      command({
        canonical: "SetEffectChannelAction",
        description: "Set the effect-channel action parameter for a channel.",
        category: "MIDI, DMX, Channel, OSC output",
      }),
    ];

    const hits = search(buildIndex(commands), "channel out");

    expect(hits.map((hit) => hit.item.canonical)).toContain("ChannelOut");
    expect(hits[0]?.item.canonical).toBe("ChannelOut");
  });

  it("does not regroup active search results by category", () => {
    const hits = [
      command({ canonical: "ChannelOut", category: "MIDI, DMX, Channel, OSC output" }),
      command({ canonical: "MeshPointChan", category: "General" }),
    ];

    expect(buildCommandListSections(hits, ["General", "MIDI, DMX, Channel, OSC output"], "channel out")).toEqual([
      { category: null, commands: hits },
    ]);
  });

  it("treats punctuation-only searches as no matches", () => {
    const commands = [
      command({
        canonical: "ChannelOut",
        description: "Set a BEYOND internal channel value.",
      }),
    ];

    expect(search(buildIndex(commands), "++")).toEqual([]);
  });

  it("searches displayed safety labels from rewritten reference descriptions", () => {
    const commands = [
      command({
        canonical: "ExecCmd",
        description: "Runs a T4 command through the reference runtime path.",
        safetyTier: "T4",
      }),
    ];

    expect(search(buildIndex(commands), "Safety 1").map((hit) => hit.item.canonical)).toEqual(["ExecCmd"]);
  });
});

describe("reference object list selection", () => {
  it("falls back to the object row when the selected property row is not rendered", () => {
    expect(objectSelectionSelectors("FX", "FX.N.N.N.Enabled")).toEqual([
      '.list__row[data-property-path="FX.N.N.N.Enabled"]',
      '.list__row[data-object="FX"]',
    ]);
  });

  it("treats Universe Components as an Object Tree reference section", () => {
    expect(isObjectReferenceSection("fx")).toBe(true);
    expect(isObjectReferenceSection("cue-types")).toBe(true);
    expect(isObjectReferenceSection("universe-components")).toBe(true);
    expect(isObjectReferenceSection("schemas")).toBe(false);
  });
});
