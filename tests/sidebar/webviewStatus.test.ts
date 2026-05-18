import { describe, expect, it } from "vitest";

import type { CommandSummary } from "../../src/sidebar/model/types";
import { formatCatalogStatus } from "../../src/sidebar/view/webview/bundle/status";

function item(canonical: string, kind?: CommandSummary["kind"]): CommandSummary {
  return {
    canonical,
    kind,
    aliases: [],
    description: "",
    signature: canonical,
    safetyTier: "T0",
    evidenceLevel: "documented",
    category: kind === "function" ? "Expression" : "General",
  };
}

describe("command webview status", () => {
  it("separates executable commands from expression functions in the full-list footer", () => {
    const visible = [item("Brightness"), item("ExtValue", "function"), item("int", "function")];

    expect(formatCatalogStatus(visible, visible)).toBe("1 command + 2 functions");
  });

  it("uses neutral entry wording when the list is filtered", () => {
    const total = [item("Brightness"), item("DisplayPopup"), item("ExtValue", "function")];
    const visible = [item("ExtValue", "function")];

    expect(formatCatalogStatus(visible, total)).toBe("1 of 3 entries");
  });
});
