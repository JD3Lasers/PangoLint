import { describe, expect, it } from "vitest";

import type { ObjectPropertyEntry } from "../../src/knowledge/objectPropertyIndex";
import { filterFxEffectProperties } from "../../src/sidebar/model/fxMenu";

describe("FX menu property filtering", () => {
  it("matches Key effect properties by effect label instead of returning every key property", () => {
    const entries = [
      fxEntry("FX.N.N.N.Keys.A", {
        label: "Key effect - Color",
        channel: "Color",
      }),
      fxEntry("FX.N.N.N.Keys.B", {
        label: "Key effect - Brightness",
        channel: "Brightness",
      }),
    ];

    expect(filterFxEffectProperties("Key effect", "Color", "keys", entries)).toEqual(["FX.N.N.N.Keys.A"]);
  });

  it("applies BEYOND menu aliases while matching oscillating effect metadata", () => {
    const entries = [
      fxEntry("FX.N.N.N.Oscillator.Angle", {
        label: "Oscillating effect - Rotation X",
        channel: "Rotation X",
      }),
      fxEntry("FX.N.N.N.Oscillator.Period", {
        label: "Oscillating effect - Size X",
        channel: "Size X",
      }),
    ];

    expect(filterFxEffectProperties("Oscillating effect", "Roto X", "oscillator", entries)).toEqual([
      "FX.N.N.N.Oscillator.Angle",
    ]);
  });

  it("uses captured QuickFX layers to disambiguate repeated menu labels", () => {
    const entries = [
      fxEntry("FX.N.N.N.Oscillator.Channel", {
        qfxPanel: "Layer 1, Effect 1",
        label: "Oscillating effect - Beam Brush",
        channel: "Beam Brush",
      }),
      fxEntry("FX.N.N.N.Keys.BeamBrush", {
        qfxPanel: "Layer 3, Effect 1",
        label: "Beam Brush, By Points, Beam Brush, Gradient",
        channel: "Beam Brush",
      }),
    ];

    expect(filterFxEffectProperties("Color effect", "Beam Brush effect", "keys", entries)).toEqual([
      "FX.N.N.N.Keys.BeamBrush",
    ]);
  });
});

function fxEntry(path: string, fx: NonNullable<ObjectPropertyEntry["fx"]>): ObjectPropertyEntry {
  return {
    path,
    normalizedPath: path,
    root: "FX",
    property: path.replace(/^FX\.N\.N\.N\./, ""),
    kind: "fx",
    confidence: "observed",
    searchText: `${path} ${fx.label ?? ""} ${fx.channel ?? ""}`.toLowerCase(),
    variantCount: 1,
    variants: [{ path, fx }],
    fx,
  };
}
