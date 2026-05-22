// BEYOND FX effect menu hierarchy. Mirrors the "Add" button dropdown in
// BEYOND's Effect tab, captured from BEYOND 5.5.0 Build 2044 on 2026-05-08.
// Shared by the Objects sidebar and standalone reference page so both surfaces
// use the same effect type labels, subcategories, and ordering.

export type FxPropertyGroup = "oscillator" | "keys" | "router" | "other";

interface FxTypeEntry {
  readonly label: string;
  readonly group: FxPropertyGroup;
  readonly subcategories?: readonly FxSubcategoryEntry[];
  readonly effects?: readonly string[];
}

interface FxSubcategoryEntry {
  readonly label: string;
  readonly effects: readonly string[];
}

export const FX_MENU: readonly FxTypeEntry[] = [
  {
    label: "Oscillating effect",
    group: "oscillator",
    subcategories: [
      {
        label: "Geometric",
        effects: [
          "Zoom",
          "Size X",
          "Size Y",
          "Size Z",
          "Roto Y",
          "Roto X",
          "Roto Z",
          "Position X",
          "Position Y",
          "Position Z",
          "Perspective",
        ],
      },
      {
        label: "Color",
        effects: ["Hue", "Hue scroll", "Brightness", "Erase In", "Write Out", "Red", "Green", "Blue", "Beam Brush"],
      },
      {
        label: "Waves",
        effects: ["Wave X to Y", "Wave X to Z", "Wave Y to X", "Wave Y to Z"],
      },
      {
        label: "Mirror",
        effects: ["Mirror X", "Mirror Y", "Mirror Z"],
      },
    ],
  },
  {
    label: "Key effect",
    group: "keys",
    subcategories: [
      {
        label: "Geometric",
        effects: [
          "Size",
          "Position",
          "Rotation",
          "Linearity",
          "Linearity centered",
          "Symmetry",
          "Keystone",
          "Pincushion",
          "Bow",
          "Shear",
          "Linearity (Tangent)",
          "Linearity (Tangent, normalized)",
          "ZZ Perspective",
          "ST2000 Perspective",
          "Variable Size",
          "Variable Position",
          "Variable Turn",
        ],
      },
      {
        label: "Color",
        effects: [
          "Brightness",
          "Color",
          "Color gradient",
          "Color wing",
          "Color wing (points)",
          "Recolor anchors",
          "Contrast, Saturation, Lightness",
          "Red, Green, Blue level",
          "Replace color",
          "Two colors",
          "Color noise",
          "Channel shift",
          "Color shift",
          "Log color",
          "Color on/off",
          "Rainbow",
          "Rectangular blend",
        ],
      },
      {
        label: "Special",
        effects: [
          "XYZ Matrix",
          "RGB Matrix",
          "Resolution",
          "Move segment",
          "Geometric surface wrap",
          "Channel value",
          "Channel multiplier",
          "Resampler",
          "Plain resampler (#)",
          "Down-sampler",
          "Up-sampler x2",
          "Up-sampler x3",
          "Plain resampler (%)",
          "Resampler-Limiter",
        ],
      },
      {
        label: "Window",
        effects: ["Window clip", "Rectangle Clip In", "Rectangle Clip Out", "Limiter"],
      },
      {
        label: "Cloning",
        effects: [
          "Linear Clone",
          "Roto Clone",
          "Kaleidoscope",
          "Rebound Left/Bottom",
          "Rebound Right/Top",
          "Mirror X",
          "Mirror Y",
          "Mirror Z",
          "Doubler",
          "Clone 1D",
          "Clone 2D",
          "Clone Round",
          "Clone Round+Center",
        ],
      },
      {
        label: "Transformations",
        effects: [
          "Spin",
          "Z-axis surface warp (sphere, cone, etc.)",
          "Bulge/Squeeze surface warp",
          "Bend surface warp",
        ],
      },
      {
        label: "Point",
        effects: ["Point Repeater", "LivePRO - Anchors", "LivePRO - Anchors number", "Beam maker", "Slow Beam path"],
      },
      {
        label: "Frame",
        effects: ["Scan Rate", "Visible Points", "Trim Points", "Mute"],
      },
      {
        label: "Video",
        effects: ["Recolor by video", "Bump mapping by video", "Recolor by Webcam"],
      },
      {
        label: "Filters",
        effects: [
          "Density filter",
          "Soft line endings",
          "RC/BB Filter",
          "Drop Shadow",
          '"Anti-anchor"',
          "Velocity to Brightness",
          "Dwell time",
          "Delete dark lines",
          "Raster Mask",
        ],
      },
      {
        label: "Oscillators",
        effects: ["Modulator", "XY Oscillator", "X Oscillator", "Y Oscillator", "Z Oscillator"],
      },
      {
        label: "Beam Brush",
        effects: ["Brush value", "Brush offset", "Brush limiter", "Brush inside", "Brush outside", "Brush Ramp"],
      },
    ],
  },
  {
    label: "Color effect",
    group: "keys",
    effects: [
      "Color effect",
      "Brightness effect",
      "Power effect",
      "Random black",
      "Palette effect",
      "Beam Brush effect",
    ],
  },
  {
    label: "Zone routing",
    group: "router",
    effects: ["Zone Chase effect", "Set Zone", "Add Zone", "Delete Zone", "Replace Zone", "Reverse order"],
  },
  {
    label: "More",
    group: "other",
    effects: ["Path effect", "Image properties", "Output color balance", "Filter", "Mask"],
  },
];
