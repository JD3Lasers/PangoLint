import { describe, expect, it } from "vitest";

import { encodeColor, findColorMatches } from "../../src/language/colorDecorations";

describe("findColorMatches", () => {
  it("decodes ColorBGR <hex> with R in the high byte", () => {
    const matches = findColorMatches("ColorBGR 0xC86432", 0);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ red: 200, green: 100, blue: 50, format: "ColorBGR" });
  });

  it("decodes ColorRGB <hex> with R in the low byte", () => {
    const matches = findColorMatches("ColorRGB 0x3264C8", 0);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ red: 200, green: 100, blue: 50, format: "ColorRGB" });
  });

  it("decodes ColorChannel.N.Color = <int> as BGR-packed", () => {
    // 3302600 = 0x3264C8; runtime observations read back r=200 g=100 b=50.
    const matches = findColorMatches("ColorChannel.0.Color = 3302600", 0);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ red: 200, green: 100, blue: 50, format: "ColorChannelInt" });
  });

  it("ignores non-color hex literals", () => {
    expect(findColorMatches("Brightness 0xFF", 0)).toEqual([]);
    expect(findColorMatches("var x = 12345", 0)).toEqual([]);
  });

  it("handles multiple color matches on one line", () => {
    const matches = findColorMatches("ColorBGR 0xFF0000  ColorRGB 0x0000FF", 0);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ red: 255, green: 0, blue: 0, format: "ColorBGR" });
    expect(matches[1]).toMatchObject({ red: 255, green: 0, blue: 0, format: "ColorRGB" });
  });

  it("captures the literal start column accurately", () => {
    const matches = findColorMatches("    ColorBGR 0xFF8800", 0);
    expect(matches[0].start).toBe("    ColorBGR ".length);
    expect(matches[0].length).toBe("0xFF8800".length);
  });
});

describe("encodeColor", () => {
  it("round-trips ColorBGR hex literal with same length and case", () => {
    expect(encodeColor(200, 100, 50, "ColorBGR", "0x000000")).toBe("0xC86432");
  });

  it("round-trips ColorRGB hex literal", () => {
    expect(encodeColor(200, 100, 50, "ColorRGB", "0x000000")).toBe("0x3264C8");
  });

  it("round-trips ColorChannelInt (BGR-packed) decimal literal", () => {
    expect(encodeColor(200, 100, 50, "ColorChannelInt", "0")).toBe("3302600");
  });

  it("preserves base: hex stays hex, decimal stays decimal", () => {
    expect(encodeColor(0xff, 0x88, 0x00, "ColorBGR", "0x000000")).toBe("0xFF8800");
    expect(encodeColor(0xff, 0x88, 0x00, "ColorBGR", "0")).toBe("16746496");
  });
});
