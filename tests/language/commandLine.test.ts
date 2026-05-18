import { describe, expect, it } from "vitest";

import { leadingCommandName } from "../../src/language/commandLine";

describe("leadingCommandName", () => {
  it("returns the command token at the start of a PangoScript line", () => {
    expect(leadingCommandName("  Brightness 50 // comment")).toEqual({
      name: "Brightness",
      start: 2,
      end: 12,
    });
  });

  it("returns the same leading command regardless of cursor position consumers", () => {
    expect(leadingCommandName("SetBpm 128")).toEqual({
      name: "SetBpm",
      start: 0,
      end: 6,
    });
  });

  it("does not treat OSC addresses or blank lines as command names", () => {
    expect(leadingCommandName("/b/Master/Brightness 50")).toBeUndefined();
    expect(leadingCommandName("   ")).toBeUndefined();
  });
});
