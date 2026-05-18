import { describe, expect, it } from "vitest";
import type { CommandSummary } from "../../src/sidebar/model/types";
import { SidebarState } from "../../src/sidebar/view/webview/bundle/state";

function command(overrides: Partial<CommandSummary> & Pick<CommandSummary, "canonical">): CommandSummary {
  return {
    canonical: overrides.canonical,
    aliases: overrides.aliases ?? [overrides.canonical],
    description: overrides.description ?? "",
    category: overrides.category ?? "General",
    safetyTier: overrides.safetyTier ?? "T1",
    evidenceLevel: overrides.evidenceLevel ?? "documented",
    signature: overrides.signature ?? overrides.canonical,
  };
}

describe("commands webview search", () => {
  it("keeps active search results in rank order instead of category order", () => {
    const state = new SidebarState();
    state.setCatalog({
      commands: [
        command({
          canonical: "MeshPointChan",
          description: "Define a mesh point with a channel-style shape.",
          category: "General",
        }),
        command({
          canonical: "ChannelOut",
          description: "Set a BEYOND internal channel value.",
          category: "MIDI, DMX, Channel, OSC output",
          signature: "ChannelOut <channelIndex>, <value>",
        }),
        command({
          canonical: "SetEffectChannelAction",
          description: "Set the effect-channel action parameter for a channel.",
          category: "MIDI, DMX, Channel, OSC output",
        }),
      ],
      categories: [],
      categoryOrder: { General: 1, "MIDI, DMX, Channel, OSC output": 23 },
    });

    state.setQuery("channel out");

    expect(state.list().map((item) => item.canonical)).toContain("ChannelOut");
    expect(state.list()[0]?.canonical).toBe("ChannelOut");
    expect(state.groups()).toEqual([{ category: "Search results", commands: state.list() }]);
  });

  it("treats punctuation-only searches as no matches", () => {
    const state = new SidebarState();
    state.setCatalog({
      commands: [
        command({
          canonical: "ChannelOut",
          description: "Set a BEYOND internal channel value.",
        }),
      ],
      categories: [],
      categoryOrder: {},
    });

    state.setQuery("++");

    expect(state.list()).toEqual([]);
    expect(state.groups()).toEqual([{ category: "Search results", commands: [] }]);
  });
});
