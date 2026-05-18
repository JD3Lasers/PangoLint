// Collapsible category group tests.
//
// Covers the state-side contract for category expand/collapse: default
// collapsed state, toggle, expand-all, collapse-all, allCategoriesExpanded.

import { describe, expect, it } from "vitest";
import type { CommandSummary } from "../../src/sidebar/model/types";
import { SidebarState } from "../../src/sidebar/view/webview/bundle/state";

function makeCommands(categories: string[]): CommandSummary[] {
  return categories.map((category, i) => ({
    canonical: `Command${i}`,
    aliases: [],
    description: "",
    category,
    safetyTier: "T1" as const,
    evidenceLevel: "exported" as const,
    signature: `Command${i}`,
  }));
}

describe("collapsible category groups", () => {
  it("groups are always computed — no toggle required", () => {
    const state = new SidebarState();
    const commands = makeCommands(["General", "OSC output", "FX"]);
    state.setCatalog({ commands, categories: [], categoryOrder: {} });
    expect(state.groups()).toHaveLength(3);
  });

  it("expanded categories starts empty — all groups collapsed by default", () => {
    const state = new SidebarState();
    state.setCatalog({ commands: makeCommands(["A", "B"]), categories: [] });
    expect(state.expandedCategories.size).toBe(0);
    expect(state.allCategoriesExpanded()).toBe(false);
  });

  it("toggleCategoryExpanded adds and removes from the set", () => {
    const state = new SidebarState();
    state.setCatalog({ commands: makeCommands(["General", "FX"]), categories: [] });

    state.toggleCategoryExpanded("General");
    expect(state.expandedCategories.has("General")).toBe(true);
    expect(state.expandedCategories.has("FX")).toBe(false);

    state.toggleCategoryExpanded("General");
    expect(state.expandedCategories.has("General")).toBe(false);
  });

  it("expandAllCategories marks every visible group expanded", () => {
    const state = new SidebarState();
    state.setCatalog({ commands: makeCommands(["A", "B", "C"]), categories: [] });
    state.expandAllCategories();
    expect(state.allCategoriesExpanded()).toBe(true);
    expect(state.expandedCategories.size).toBe(3);
  });

  it("collapseAllCategories clears the expanded set", () => {
    const state = new SidebarState();
    state.setCatalog({ commands: makeCommands(["A", "B"]), categories: [] });
    state.expandAllCategories();
    state.collapseAllCategories();
    expect(state.expandedCategories.size).toBe(0);
    expect(state.allCategoriesExpanded()).toBe(false);
  });

  it("allCategoriesExpanded returns false when only some are expanded", () => {
    const state = new SidebarState();
    state.setCatalog({ commands: makeCommands(["A", "B", "C"]), categories: [] });
    state.toggleCategoryExpanded("A");
    expect(state.allCategoriesExpanded()).toBe(false);
  });

  it("tolerates older init payloads without category order", () => {
    const state = new SidebarState();
    const commands: CommandSummary[] = [
      {
        canonical: "OscOutTTS",
        aliases: [],
        description: "OSC callback",
        category: "OSC output",
        safetyTier: "T1",
        evidenceLevel: "observed",
        signature: 'OscOutTTS "<address>", "<type-tags>", <args...>',
      },
      {
        canonical: "BlackOut",
        aliases: [],
        description: "Black out output",
        category: "General",
        safetyTier: "T3",
        evidenceLevel: "exported",
        signature: "BlackOut",
      },
    ];
    state.setCatalog({ commands, categories: [], categoryOrder: {} });
    state.setCatalog({ commands, categories: [] });
    expect(state.groups().map((group) => group.category)).toEqual(["General", "OSC output"]);
  });

  it("normalizes malformed init payloads to an empty catalog", () => {
    const state = new SidebarState();
    state.setCatalog({});
    expect(state.getCatalog()).toEqual({ commands: [], categories: [], categoryOrder: {} });
    expect(state.list()).toEqual([]);
    expect(state.groups()).toEqual([]);
  });
});
