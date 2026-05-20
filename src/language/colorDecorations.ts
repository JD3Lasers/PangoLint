// Color decorator support for PangoScript. Detects color literals on lines
// containing color-related tokens and reports them to VS Code so the editor
// shows a swatch in the gutter (and a color picker on click).
//
// PangoScript color formats observed from BEYOND runtime readback:
//
//   - ColorChannel.<N>.Color = <int>     BGR-packed: B=hi, G=mid, R=lo
//   - ColorBGR <hex>                     R=hi, G=mid, B=lo (despite name)
//   - ColorRGB <hex>                     B=hi, G=mid, R=lo (despite name)
//   - <Object>.{Red,Green,Blue,Alpha}    per-component, 0-255
//
// We avoid guessing for ambiguous numeric literals; only literals adjacent
// to a known color-context token get decorated.
//
// Round-trip: ColorPresentation rebuilds the source text in the same format
// (hex stays hex, decimal stays decimal, BGR stays BGR).

export type ColorFormat = "ColorBGR" | "ColorRGB" | "ColorChannelInt" | "PerComponent";

export interface ColorMatch {
  /** Zero-based line number. */
  line: number;
  /** Column where the literal text starts. */
  start: number;
  /** Length of the literal text. */
  length: number;
  /** RGB channel values, each 0-255. */
  red: number;
  green: number;
  blue: number;
  /** How the literal is encoded - used by ColorPresentation to round-trip. */
  format: ColorFormat;
  /** Original literal text (for re-encoding decimal vs hex). */
  literal: string;
}

const HEX_LITERAL = "0[xX][0-9A-Fa-f]+";
const DEC_LITERAL = "\\d+";
const NUM_LITERAL = `(?:${HEX_LITERAL}|${DEC_LITERAL})`;

// Patterns we recognize. Each captures the literal text in group 1.
const PATTERNS: Array<{ regex: RegExp; format: ColorFormat }> = [
  // ColorBGR 0xRRGGBB or ColorBGR 12345 (R is high byte)
  { regex: new RegExp(`\\bColorBGR\\s+(${NUM_LITERAL})`, "g"), format: "ColorBGR" },
  // ColorRGB 0xBBGGRR or ColorRGB 12345 (R is low byte)
  { regex: new RegExp(`\\bColorRGB\\s+(${NUM_LITERAL})`, "g"), format: "ColorRGB" },
  // <something>.Color = <int>  (BGR-packed)
  { regex: new RegExp(`\\.Color\\s*=\\s*(${NUM_LITERAL})`, "g"), format: "ColorChannelInt" },
];

/**
 * Find all color literals in a single line of source text.
 */
export function findColorMatches(line: string, lineNumber: number): ColorMatch[] {
  const out: ColorMatch[] = [];
  for (const { regex, format } of PATTERNS) {
    regex.lastIndex = 0;
    for (const m of line.matchAll(regex)) {
      const literal = m[1];
      const start = (m.index ?? 0) + m[0].indexOf(literal);
      const value = parseLiteral(literal);
      if (value === undefined) continue;
      const { r, g, b } = decodePacked(value, format);
      out.push({
        line: lineNumber,
        start,
        length: literal.length,
        red: r,
        green: g,
        blue: b,
        format,
        literal,
      });
    }
  }
  return out;
}

function parseLiteral(text: string): number | undefined {
  const value = text.startsWith("0x") || text.startsWith("0X") ? parseInt(text.slice(2), 16) : parseInt(text, 10);
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return undefined;
  return value;
}

function decodePacked(value: number, format: ColorFormat): { r: number; g: number; b: number } {
  const hi = (value >> 16) & 0xff;
  const mid = (value >> 8) & 0xff;
  const lo = value & 0xff;
  switch (format) {
    case "ColorBGR":
      // R=hi, G=mid, B=lo (per runtime observation - name is misleading)
      return { r: hi, g: mid, b: lo };
    case "ColorRGB":
      // R=lo, G=mid, B=hi (per runtime observation - name is misleading)
      return { r: lo, g: mid, b: hi };
    case "ColorChannelInt":
      // BGR-packed: R=lo, G=mid, B=hi
      return { r: lo, g: mid, b: hi };
    case "PerComponent":
      // Not packed; only one channel per literal, but we still need a return.
      return { r: lo, g: 0, b: 0 };
  }
}

/**
 * Re-encode RGB values back into the literal's original format and base.
 * Returns the new literal text suitable for replacement in the source.
 */
export function encodeColor(r: number, g: number, b: number, format: ColorFormat, originalLiteral: string): string {
  const wasHex = originalLiteral.startsWith("0x") || originalLiteral.startsWith("0X");
  let value: number;
  switch (format) {
    case "ColorBGR":
      value = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
      break;
    case "ColorRGB":
      value = ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
      break;
    case "ColorChannelInt":
      value = ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
      break;
    case "PerComponent":
      value = r & 0xff;
      break;
  }
  if (wasHex) {
    const padded = value.toString(16).toUpperCase().padStart(6, "0");
    return `0x${padded}`;
  }
  return value.toString(10);
}
