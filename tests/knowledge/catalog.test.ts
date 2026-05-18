import { describe, expect, it } from "vitest";

import { lookupCommand, parseCommandCatalog } from "../../src/knowledge/catalog";

describe("command catalog", () => {
  it("parses canonical commands and aliases from separator export lines", () => {
    const catalog = parseCommandCatalog(
      [
        'AddSms|AddSMS "This is my demo message"',
        'OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)',
        "Brightness|Brightness 100 | 0..100 (percents)",
      ].join("\n"),
    );

    expect(catalog.commands).toHaveLength(3);
    expect(lookupCommand(catalog, "addsms")?.canonical).toBe("AddSms");
    expect(lookupCommand(catalog, "AddSMS")?.example).toBe('AddSMS "This is my demo message"');
    expect(lookupCommand(catalog, "OscOutTTS")?.description).toContain("Type Tag");
  });

  it("ignores blank lines without losing command order", () => {
    const catalog = parseCommandCatalog("\nBrightness|Brightness 100\n\nBlackOut|BlackOut\n");

    expect(catalog.commands.map((command) => command.canonical)).toEqual(["Brightness", "BlackOut"]);
  });
});
