import { describe, expect, it } from "vitest";

import { formatPangoScript } from "../../src/language/formatter";

describe("PangoScript formatter", () => {
  it("normalizes low-risk whitespace while preserving strings", () => {
    const input = [
      " var zoneName  ",
      "zoneName=Zone.0.Name;",
      'OscOutTTS "/x,y", "s","hello,world"  ',
      "mylabel:zoneName=Zone.0.Name",
      "DisplayPopup value=1",
      "  When0:   ",
    ].join("\r\n");

    expect(formatPangoScript(input)).toBe(
      [
        "var zoneName",
        "zoneName = Zone.0.Name;",
        'OscOutTTS "/x,y", "s", "hello,world"',
        "mylabel: zoneName = Zone.0.Name",
        "DisplayPopup value=1",
        "When0:",
      ].join("\n"),
    );
  });
});
