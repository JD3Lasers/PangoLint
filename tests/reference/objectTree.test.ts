import { describe, expect, it } from "vitest";
import {
  buildCueTypePropertySections,
  buildCueTypeReference,
  buildCueTypesTree,
  buildFxEffectPropertySections,
  buildFxEffectReference,
  buildFxTree,
  countObjectTreeLeaves,
  filterObjectPropertySections,
  filterObjectReferenceRows,
  filterObjectTree,
  type ObjectTreeNode,
} from "../../src/reference/bundle/objectTree";
import { getVisibleDetailSelection, hasVisibleDetailSelection, ReferenceState } from "../../src/reference/bundle/state";
import type { ReferenceCatalog, ReferenceObject, ReferenceObjectProperty } from "../../src/reference/bundle/types";

function emptyCatalog(): ReferenceCatalog {
  return {
    meta: {
      generatedAt: "2026-01-01T00:00:00Z",
      version: "0.0.0",
      total: 0,
      categories: [],
      coverage: { total: 0, mapped: 0, noDirectProperty: 0, deferred: 0, unknown: 0 },
    },
    commands: [],
    objects: [],
  };
}

describe("ReferenceState objectSection", () => {
  it("defaults to 'schemas'", () => {
    const state = new ReferenceState(emptyCatalog());
    expect(state.objectSection).toBe("schemas");
  });

  it("setObjectSection switches section and fires 'section' change", () => {
    const state = new ReferenceState(emptyCatalog());
    const changes: string[] = [];
    state.subscribe((c) => changes.push(c));
    state.setObjectSection("fx");
    expect(state.objectSection).toBe("fx");
    expect(changes).toContain("section");
  });

  it("setObjectSection is a no-op if already on that section", () => {
    const state = new ReferenceState(emptyCatalog());
    const changes: string[] = [];
    state.subscribe((c) => changes.push(c));
    state.setObjectSection("schemas"); // already default
    expect(changes).toHaveLength(0);
  });

  it("setViewMode resets objectSection to 'schemas'", () => {
    const state = new ReferenceState(emptyCatalog());
    state.setViewMode("objects");
    state.setObjectSection("fx");
    state.setViewMode("commands");
    state.setViewMode("objects");
    expect(state.objectSection).toBe("schemas");
  });

  it("select resets objectSection when it switches to commands", () => {
    const state = new ReferenceState(emptyCatalog());
    state.setViewMode("objects");
    state.setObjectSection("cue-types");

    state.select("BlackOut");

    expect(state.viewMode).toBe("commands");
    expect(state.objectSection).toBe("schemas");
  });

  it("selectObject resets objectSection when it switches to objects", () => {
    const state = new ReferenceState(emptyCatalog());
    state.objectSection = "fx";

    state.selectObject("Master", "Master.BPM");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("schemas");
    expect(state.selectedObjectPropertyPath).toBe("Master.BPM");
  });

  it("selectObject emits when the selected property path changes", () => {
    const state = new ReferenceState(emptyCatalog());
    state.selectObject("Master", "Master.BPM");
    const changes: string[] = [];
    state.subscribe((c) => changes.push(c));

    state.selectObject("Master", "Master.Alpha");

    expect(changes).toEqual(["selection"]);
    expect(state.selectedObject).toBe("Master");
    expect(state.selectedObjectPropertyPath).toBe("Master.Alpha");
  });

  it("selectObjectReference selects a Cue Type reference row", () => {
    const state = new ReferenceState(emptyCatalog());

    state.selectObjectReference("cue-types", "Text");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("cue-types");
    expect(state.selectedObjectReference).toEqual({ section: "cue-types", id: "Text" });
    expect(state.selectedObject).toBeNull();
    expect(state.selectedObjectPropertyPath).toBeNull();
    expect(state.selectedCanonical).toBeNull();
  });

  it("selectObject clears a selected Object Tree reference row", () => {
    const state = new ReferenceState(emptyCatalog());
    state.selectObjectReference("cue-types", "Text");

    state.selectObject("WS", "WS.N.N.Caption");

    expect(state.selectedObjectReference).toBeNull();
    expect(state.selectedObject).toBe("WS");
    expect(state.selectedObjectPropertyPath).toBe("WS.N.N.Caption");
  });

  it("setObjectSection clears the selected Object Tree reference row", () => {
    const state = new ReferenceState(emptyCatalog());
    state.selectObjectReference("fx", "Oscillating effect :: Zoom");

    state.setObjectSection("cue-types");

    expect(state.selectedObjectReference).toBeNull();
    expect(state.selectedObject).toBeNull();
    expect(state.selectedObjectPropertyPath).toBeNull();
  });

  it("does not expose a preserved command selection as Object Tree detail", () => {
    const state = new ReferenceState(emptyCatalog());
    state.select("BlackOut");
    state.setViewMode("objects");

    expect(state.selectedCanonical).toBe("BlackOut");
    expect(hasVisibleDetailSelection(state)).toBe(false);
    expect(getVisibleDetailSelection(state)).toBeNull();
  });

  it("reports only the current mode's selection as visible detail", () => {
    const state = new ReferenceState(emptyCatalog());

    state.select("BlackOut");
    expect(getVisibleDetailSelection(state)).toEqual({ kind: "command", canonical: "BlackOut" });

    state.selectObject("Master", "Master.BPM");
    expect(getVisibleDetailSelection(state)).toEqual({
      kind: "object",
      name: "Master",
      propertyPath: "Master.BPM",
    });

    state.selectObjectReference("fx", "Oscillating effect :: Zoom");
    expect(getVisibleDetailSelection(state)).toEqual({
      kind: "object-reference",
      selection: { section: "fx", id: "Oscillating effect :: Zoom" },
    });
  });
});

function makeProperty(
  path: string,
  contexts: Array<{ kind: string; label: string; parentLabel?: string }>,
): ReferenceObjectProperty {
  const [root = "", ...propertyParts] = path.split(".");
  return {
    path,
    root,
    property: propertyParts.join("."),
    kind: "object",
    setters: [],
    probeContexts: contexts.map((c, i) => ({
      id: `ctx-${i}`,
      kind: c.kind,
      label: c.label,
      parentLabel: c.parentLabel,
      normalizedPrefix: path.split(".").slice(0, 2).join("."),
      probePrefix: path.split(".").slice(0, 2).join("."),
    })),
  };
}

function makeObject(name: string, properties: ReferenceObjectProperty[]): ReferenceObject {
  return { name, isArray: false, propertyCount: properties.length, properties };
}

function childrenOf(node: ObjectTreeNode | undefined): ObjectTreeNode[] {
  expect(node).toBeDefined();
  return node?.children ?? [];
}

describe("buildFxTree", () => {
  it("groups FX properties by effect family (parentLabel) then effect name (label)", () => {
    const period = makeProperty("FX.N.N.N.Period", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
    ]);
    const amp = makeProperty("FX.N.N.N.Amplitude", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
    ]);
    const fx = makeObject("FX", [period, amp]);

    const tree = buildFxTree([fx]);

    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("Oscillating effect");
    expect(childrenOf(tree[0]).map((n) => n.label)).toEqual(["Geometric", "Color", "Waves", "Mirror"]);
    const effects = childrenOf(childrenOf(tree[0])[0]);
    expect(effects[0].label).toBe("Zoom");
    const leaves = childrenOf(effects[0]);
    expect(leaves.map((n) => n.path)).toEqual(expect.arrayContaining(["FX.N.N.N.Period", "FX.N.N.N.Amplitude"]));
  });

  it("uses the sidebar FX menu order and subcategories", () => {
    const fx = makeObject("FX", [
      makeProperty("FX.N.N.N.Oscillator.Period", [
        { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
      ]),
      makeProperty("FX.N.N.N.Keys.A", [{ kind: "quickfx-effect", label: "Color", parentLabel: "Key effect" }]),
      makeProperty("FX.N.N.N.Keys.Palette", [
        { kind: "quickfx-effect", label: "Palette effect", parentLabel: "Color effect" },
      ]),
      makeProperty("FX.N.N.N.RouterOutZone", [
        { kind: "quickfx-effect", label: "Set Zone", parentLabel: "Zone routing" },
      ]),
      makeProperty("FX.N.N.N.Keys.ImagePath", [
        { kind: "quickfx-effect", label: "Image properties", parentLabel: "More" },
      ]),
    ]);

    const tree = buildFxTree([fx]);

    expect(tree.map((node) => node.label)).toEqual([
      "Oscillating effect",
      "Key effect",
      "Color effect",
      "Zone routing",
      "More",
    ]);
    expect(childrenOf(tree[0]).map((node) => node.label)).toEqual(["Geometric", "Color", "Waves", "Mirror"]);
    expect(
      childrenOf(childrenOf(tree[0])[0])
        .map((node) => node.label)
        .slice(0, 2),
    ).toEqual(["Zoom", "Size X"]);
    expect(childrenOf(tree[2]).map((node) => node.label)).toEqual([
      "Color effect",
      "Brightness effect",
      "Power effect",
      "Random black",
      "Palette effect",
      "Beam Brush effect",
    ]);
  });

  it("places FX properties with no quickfx-effect context in an 'Other' bucket", () => {
    const caption = makeProperty("FX.CAPTION", []); // no probeContexts
    const fx = makeObject("FX", [caption]);

    const tree = buildFxTree([fx]);

    const other = tree.find((n) => n.label === "Other");
    const leaves = childrenOf(other);
    expect(leaves.map((n) => n.path)).toContain("FX.CAPTION");
  });

  it("returns empty array when no FX object exists", () => {
    expect(buildFxTree([])).toEqual([]);
    expect(buildFxTree([makeObject("Master", [])])).toEqual([]);
  });
});

describe("buildCueTypesTree", () => {
  it("groups WS properties by cue type label", () => {
    const captionColor = makeProperty("WS.N.N.CaptionColor", [
      { kind: "cue-type", label: "Frames (Simple)" },
      { kind: "cue-type", label: "Text" },
    ]);
    const ws = makeObject("WS", [captionColor]);

    const tree = buildCueTypesTree([ws]);

    const framesNode = tree.find((n) => n.label === "Frames (Simple)");
    const textNode = tree.find((n) => n.label === "Text");
    const framesLeaves = childrenOf(framesNode);
    const textLeaves = childrenOf(textNode);
    // Property appears under both cue types it belongs to
    expect(framesLeaves.map((n) => n.path)).toContain("WS.N.N.CaptionColor");
    expect(textLeaves.map((n) => n.path)).toContain("WS.N.N.CaptionColor");
  });

  it("returns empty array when no WS object exists", () => {
    expect(buildCueTypesTree([])).toEqual([]);
  });
});

describe("filterObjectTree", () => {
  it("keeps a matching branch with its property leaves", () => {
    const tree: ObjectTreeNode[] = [
      {
        label: "Oscillating effect",
        children: [
          {
            label: "Zoom",
            children: [
              { label: "FX.N.N.ChasePeriod", path: "FX.N.N.ChasePeriod" },
              { label: "FX.N.N.ChaseTimeMode", path: "FX.N.N.ChaseTimeMode" },
            ],
          },
          {
            label: "Rotate",
            children: [{ label: "FX.N.N.RotatePeriod", path: "FX.N.N.RotatePeriod" }],
          },
        ],
      },
      {
        label: "Other",
        children: [{ label: "FX.CAPTION", path: "FX.CAPTION" }],
      },
    ];

    const filtered = filterObjectTree(tree, "zoom");

    expect(filtered.map((node) => node.label)).toEqual(["Oscillating effect"]);
    const effect = childrenOf(filtered[0])[0];
    expect(effect.label).toBe("Zoom");
    expect(childrenOf(effect).map((node) => node.path)).toEqual(["FX.N.N.ChasePeriod", "FX.N.N.ChaseTimeMode"]);
  });

  it("keeps only matching leaves when the branch does not match", () => {
    const tree: ObjectTreeNode[] = [
      {
        label: "Oscillating effect",
        children: [
          {
            label: "Zoom",
            children: [
              { label: "FX.N.N.ChasePeriod", path: "FX.N.N.ChasePeriod" },
              { label: "FX.N.N.ChaseTimeMode", path: "FX.N.N.ChaseTimeMode" },
            ],
          },
        ],
      },
    ];

    const filtered = filterObjectTree(tree, "TimeMode");

    const effect = childrenOf(childrenOf(filtered[0])[0]);
    expect(effect.map((node) => node.path)).toEqual(["FX.N.N.ChaseTimeMode"]);
  });

  it("counts property leaves recursively", () => {
    const tree: ObjectTreeNode[] = [
      {
        label: "Cue Types",
        children: [
          { label: "WS.N.N.Caption", path: "WS.N.N.Caption" },
          { label: "WS.N.N.CaptionColor", path: "WS.N.N.CaptionColor" },
        ],
      },
    ];

    expect(countObjectTreeLeaves(tree)).toBe(2);
  });
});

describe("buildCueTypeReference", () => {
  it("uses cue type rows in the middle column and property groups in the detail pane", () => {
    const caption = makeProperty("WS.N.N.Caption", [
      { kind: "cue-type", label: "Frames (Simple)" },
      { kind: "cue-type", label: "Text" },
    ]);
    const fontSize = makeProperty("WS.N.N.FontSize", [{ kind: "cue-type", label: "Text" }]);
    const visiblePoints = makeProperty("WS.N.N.VisiblePoints", [{ kind: "cue-type", label: "Frames (Simple)" }]);
    const ws = makeObject("WS", [caption, fontSize, visiblePoints]);

    const reference = buildCueTypeReference([ws]);

    expect(reference.typeCount).toBe(2);
    expect(reference.rows.map((row) => row.label)).toEqual(["Frames (Simple)", "Text"]);
    expect(reference.rows.map((row) => row.propertyCount)).toEqual([2, 2]);
    const textDetail = reference.details.find((detail) => detail.id === "Text");
    expect(textDetail).toMatchObject({
      id: "Text",
      label: "Text",
      root: "WS",
      propertyCount: 2,
    });
    expect(textDetail?.sections.map((section) => section.label)).toEqual(["Common cue controls", "Text controls"]);
    expect(textDetail?.sections[0].properties.map((property) => property.path)).toEqual(["WS.N.N.Caption"]);
    expect(textDetail?.sections[1].properties.map((property) => property.path)).toEqual(["WS.N.N.FontSize"]);
  });

  it("returns no rows when the WS object is missing", () => {
    const reference = buildCueTypeReference([]);

    expect(reference.rows).toEqual([]);
    expect(reference.details).toEqual([]);
    expect(reference.typeCount).toBe(0);
  });
});

describe("buildFxEffectReference", () => {
  it("uses FX effect rows in the middle column and property groups in the detail pane", () => {
    const enabled = makeProperty("FX.N.N.N.Enabled", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
      { kind: "quickfx-effect", label: "Palette effect", parentLabel: "Color effect" },
    ]);
    const oscillatorPeriod = makeProperty("FX.N.N.N.Oscillator.Period", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
    ]);
    const paletteIndex = makeProperty("FX.N.N.N.Keys.N.Value1", [
      { kind: "quickfx-effect", label: "Palette effect", parentLabel: "Color effect" },
    ]);
    const caption = makeProperty("FX.CAPTION", []);
    const fx = makeObject("FX", [enabled, oscillatorPeriod, paletteIndex, caption]);

    const reference = buildFxEffectReference([fx]);

    expect(reference.effectCount).toBe(2);
    expect(reference.rows.map((row) => row.label)).toEqual(["Zoom", "Palette effect", "Other FX properties"]);
    expect(reference.rows.map((row) => row.propertyCount)).toEqual([2, 2, 1]);
    const zoomDetail = reference.details.find((detail) => detail.label === "Zoom");
    expect(zoomDetail).toMatchObject({
      label: "Zoom",
      description: "Oscillating effect / Geometric",
      root: "FX",
      propertyCount: 2,
    });
    expect(zoomDetail?.sections.map((section) => section.label)).toEqual(["Common FX controls", "Zoom controls"]);
    expect(zoomDetail?.sections[0].properties.map((property) => property.path)).toEqual(["FX.N.N.N.Enabled"]);
    expect(zoomDetail?.sections[1].properties.map((property) => property.path)).toEqual(["FX.N.N.N.Oscillator.Period"]);
  });

  it("returns no rows when the FX object is missing", () => {
    const reference = buildFxEffectReference([]);

    expect(reference.rows).toEqual([]);
    expect(reference.details).toEqual([]);
    expect(reference.effectCount).toBe(0);
  });
});

describe("filterObjectReferenceRows", () => {
  it("filters reference rows by label and property paths from the detail", () => {
    const caption = makeProperty("WS.N.N.Caption", [
      { kind: "cue-type", label: "Frames (Simple)" },
      { kind: "cue-type", label: "Text" },
    ]);
    const fontSize = makeProperty("WS.N.N.FontSize", [{ kind: "cue-type", label: "Text" }]);
    const ws = makeObject("WS", [caption, fontSize]);
    const reference = buildCueTypeReference([ws]);

    expect(filterObjectReferenceRows(reference.rows, reference.details, "frames").map((row) => row.label)).toEqual([
      "Frames (Simple)",
    ]);
    expect(filterObjectReferenceRows(reference.rows, reference.details, "fontsize").map((row) => row.label)).toEqual([
      "Text",
    ]);
  });
});

describe("buildCueTypePropertySections", () => {
  it("pulls common cue controls into one section instead of repeating them per cue type", () => {
    const caption = makeProperty("WS.N.N.Caption", [
      { kind: "cue-type", label: "Frames (Simple)" },
      { kind: "cue-type", label: "Text" },
    ]);
    const fontSize = makeProperty("WS.N.N.FontSize", [{ kind: "cue-type", label: "Text" }]);
    const visiblePoints = makeProperty("WS.N.N.VisiblePoints", [{ kind: "cue-type", label: "Frames (Simple)" }]);
    const ws = makeObject("WS", [caption, fontSize, visiblePoints]);

    const result = buildCueTypePropertySections([ws]);

    expect(result.typeCount).toBe(2);
    expect(result.uniquePropertyCount).toBe(3);
    expect(result.sections.map((section) => section.label)).toEqual(["Common cue controls", "Frames (Simple)", "Text"]);
    expect(result.sections[0].properties.map((property) => property.path)).toEqual(["WS.N.N.Caption"]);
    expect(result.sections[1].properties.map((property) => property.path)).toEqual(["WS.N.N.VisiblePoints"]);
    expect(result.sections[2].properties.map((property) => property.path)).toEqual(["WS.N.N.FontSize"]);
  });

  it("returns no sections when the WS object is missing", () => {
    const result = buildCueTypePropertySections([]);

    expect(result.sections).toEqual([]);
    expect(result.uniquePropertyCount).toBe(0);
    expect(result.typeCount).toBe(0);
  });
});

describe("buildFxEffectPropertySections", () => {
  it("pulls common FX controls into one section before effect-specific controls", () => {
    const enabled = makeProperty("FX.N.N.N.Enabled", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
      { kind: "quickfx-effect", label: "Palette effect", parentLabel: "Color effect" },
    ]);
    const oscillatorPeriod = makeProperty("FX.N.N.N.Oscillator.Period", [
      { kind: "quickfx-effect", label: "Zoom", parentLabel: "Oscillating effect" },
    ]);
    const paletteIndex = makeProperty("FX.N.N.N.Keys.N.Value1", [
      { kind: "quickfx-effect", label: "Palette effect", parentLabel: "Color effect" },
    ]);
    const caption = makeProperty("FX.CAPTION", []);
    const fx = makeObject("FX", [enabled, oscillatorPeriod, paletteIndex, caption]);

    const result = buildFxEffectPropertySections([fx]);

    expect(result.effectCount).toBe(2);
    expect(result.uniquePropertyCount).toBe(4);
    expect(result.sections.map((section) => section.label)).toEqual([
      "Common FX controls",
      "Zoom",
      "Palette effect",
      "Other FX properties",
    ]);
    expect(result.sections[0].properties.map((property) => property.path)).toEqual(["FX.N.N.N.Enabled"]);
    expect(result.sections[1].description).toBe("Oscillating effect / Geometric");
    expect(result.sections[1].properties.map((property) => property.path)).toEqual(["FX.N.N.N.Oscillator.Period"]);
    expect(result.sections[2].description).toBe("Color effect");
    expect(result.sections[2].properties.map((property) => property.path)).toEqual(["FX.N.N.N.Keys.N.Value1"]);
    expect(result.sections[3].properties.map((property) => property.path)).toEqual(["FX.CAPTION"]);
  });

  it("returns no sections when the FX object is missing", () => {
    const result = buildFxEffectPropertySections([]);

    expect(result.sections).toEqual([]);
    expect(result.uniquePropertyCount).toBe(0);
    expect(result.effectCount).toBe(0);
  });
});

describe("filterObjectPropertySections", () => {
  it("keeps flat property rows when the section label matches", () => {
    const sections = [
      {
        label: "Common cue controls",
        properties: [makeProperty("WS.N.N.Caption", [])],
      },
      {
        label: "Text",
        properties: [makeProperty("WS.N.N.FontSize", [])],
      },
    ];

    const filtered = filterObjectPropertySections(sections, "common");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe("Common cue controls");
    expect(filtered[0].properties.map((property) => property.path)).toEqual(["WS.N.N.Caption"]);
  });

  it("filters flat property rows by Object Tree path and OSC path", () => {
    const caption = makeProperty("WS.N.N.Caption", []);
    caption.osc = "/b/WS/0/0/Caption";
    const fontSize = makeProperty("WS.N.N.FontSize", []);
    fontSize.osc = "/b/WS/0/0/FontSize";
    const sections = [
      {
        label: "Text",
        properties: [caption, fontSize],
      },
    ];

    const filtered = filterObjectPropertySections(sections, "fontsize");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].properties.map((property) => property.path)).toEqual(["WS.N.N.FontSize"]);
  });
});
