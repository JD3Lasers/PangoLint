import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeCatalogGaps } from "../../src/knowledge/catalogGaps";
import { loadCategoryTree, resolveCategoryMap, resolveCommandCategory } from "../../src/knowledge/categoryResolution";
import {
  mergeKnowledgeBase,
  overlayCategoriesByCanonical,
  type PangoKnowledgeBase,
  validateCuratedOverlay,
} from "../../src/knowledge/knowledgeBase";
import {
  type CommandPropertyCoverageFile,
  dataDir,
  effectActionProps,
  findForbiddenDescriptionClaims,
  findPropertyPaths,
  fxProps,
  readJson,
} from "./readKnowledgeTestData";

describe("checked-in PangoScript command knowledge data", () => {
  it("keeps curated overlay metadata valid", () => {
    const overlay = readJson<PangoKnowledgeBase>("commands.overlay.json");

    expect(() =>
      validateCuratedOverlay({
        overlay,
      }),
    ).not.toThrow();
  });

  it("keeps public command artifacts free of maintainer provenance fields", () => {
    const artifacts = ["commands.generated.json", "commands.overlay.json", "commands.merged.json"];
    const provenanceField = ["source", "Refs"].join("");

    for (const artifact of artifacts) {
      const parsed = readJson<unknown>(artifact);
      expect(findPropertyPaths(parsed, provenanceField), artifact).toEqual([]);
    }
  });

  it("keeps merged command descriptions free of public verification labels and source provenance", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(findForbiddenDescriptionClaims(merged)).toEqual([]);
  });

  it("keeps the public command category tree free of capture provenance", () => {
    const tree = readJson<Record<string, unknown>>("beyond-category-tree.json");

    expect(Object.keys(tree).sort()).toEqual(["categories"]);
  });

  it("keeps generated and merged command counts aligned", () => {
    const generated = readJson<PangoKnowledgeBase>("commands.generated.json");
    const overlay = readJson<PangoKnowledgeBase>("commands.overlay.json");
    const checkedInMerged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const rebuiltMerged = mergeKnowledgeBase(generated, overlay);

    // Apply category resolution so rebuiltMerged matches the checked-in file,
    // which has categories populated by the build script.
    const tree = loadCategoryTree(path.join(dataDir, "beyond-category-tree.json"));
    const treeMap = resolveCategoryMap(tree);
    const overlayCategories = overlayCategoriesByCanonical(overlay);
    for (const entry of Object.values(rebuiltMerged.commands)) {
      const overlayCategory = overlayCategories[entry.canonical];
      const resolved = resolveCommandCategory(entry.canonical, overlayCategory, treeMap);
      if (resolved.category) entry.category = resolved.category;
    }

    // generated/ comes from the upstream BEYOND command export (521 commands).
    // merged/ adds overlay-only commands documented after that export:
    // currently 8 prototype/
    // internal entries (Chat, LoadCueFromBlob, LoadZoneFromBlob, Pub,
    // PubObject, SubCmd, SubJson, SubProp).
    expect(Object.keys(generated.commands)).toHaveLength(521);
    expect(Object.keys(checkedInMerged.commands).length).toBeGreaterThanOrEqual(521);
    expect(checkedInMerged.commands.OscOutTTS.confidence).toBe("high");
    const waitForBeat = checkedInMerged.commands.WaitForBeat;
    expect(waitForBeat.forms?.map((form) => form.signature)).toContain("WaitForBeat <beatMask>, <count>");
    expect(waitForBeat.forms?.[0]?.parameters?.[0]).toMatchObject({
      name: "beatMask",
      description: expect.stringContaining("1 = timer beat"),
    });
    expect(checkedInMerged).toEqual(rebuiltMerged);
  });

  it("keeps release-blocking catalog metadata gaps at zero", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const report = analyzeCatalogGaps({ knowledgeBase: merged, usages: new Map(), corpusFileCount: 0 });

    expect(report.summary.emptyDescriptions.total).toBe(0);
    expect(report.summary.missingParameters.total).toBe(0);
    expect(report.summary.terseDescriptions.total).toBe(0);
    expect(report.summary.unknownSafety.total).toBe(0);
  });

  it("ships a command property mapping coverage ledger for every command", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const ledger = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const commandNames = Object.keys(merged.commands).sort();

    expect(ledger.schemaVersion).toBe(1);
    expect(ledger.summary.total).toBe(529);
    expect(ledger.summary.total).toBe(commandNames.length);
    expect(
      ledger.summary.mapped + ledger.summary.noDirectProperty + ledger.summary.deferred + ledger.summary.unknown,
    ).toBe(ledger.summary.total);
    expect(Object.keys(ledger.commands).sort()).toEqual(commandNames);

    const mappedCount = Object.values(merged.commands).filter(
      (command) => (command.setsProperty?.length ?? 0) > 0,
    ).length;
    expect(ledger.summary.mapped).toBe(mappedCount);
    expect(ledger.commands.PositionIndex).toMatchObject({
      canonical: "PositionIndex",
      status: "mapped",
      setsProperty: ["Master.PositionX", "Master.PositionY", "Master.PositionZ"],
    });
    expect(ledger.commands.BlackOut).toMatchObject({
      canonical: "BlackOut",
      status: "no-direct-property",
    });
    expect(ledger.summary.unknown).toBe(0);
  });

  it("ships curated PreviewAsUninverse metadata from the command reference", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const command = merged.commands.PreviewAsUninverse;

    expect(command?.description).toContain("Universe page in the Main Preview panel");
    expect(command?.safetyTier).toBe("T1");
    expect(command?.forms?.[0]).toMatchObject({
      signature: "PreviewAsUninverse 1",
      description: expect.stringContaining("display the Universe page"),
      parameters: [
        {
          name: "state",
          type: "integer",
          required: true,
          range: "0..1",
        },
      ],
    });
  });

  it("ships live-probed BPM command range metadata with clamp semantics", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const valueParam = findParam("SetBpm", "SetBpm <value>", "value");
    const deltaParam = findParam("SetBpmDelta", "SetBpmDelta <delta>", "delta");

    expect(valueParam).toMatchObject({
      range: "1..600",
      valueRange: {
        min: 1,
        max: 600,
        unit: "bpm",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(deltaParam).toMatchObject({
      range: "relative; result clamps to 1..600",
      valueRange: {
        unit: "bpm delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master brightness range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const brightnessParam = findParam("Brightness", "Brightness <value>", "value");
    const brightnessDeltaParam = findParam("BrightnessDelta", "BrightnessDelta <delta>", "delta");
    const showBrightnessParam = findParam("MasterShowBrightness", "MasterShowBrightness <value>", "value");

    expect(brightnessParam).toMatchObject({
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(brightnessDeltaParam).toMatchObject({
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(showBrightnessParam).toMatchObject({
      range: "nominal 0..100; runtime pass-through observed through -1000..1000000",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("2026-05-12");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("-1000");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("1000000");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("differs from Brightness");
  });

  it("ships live-probed rotation angle range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;
    const cases = ["AngleX", "AngleY", "AngleZ"] as const;

    for (const commandName of cases) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-2880..2880",
        valueRange: {
          min: -2880,
          max: 2880,
          unit: "degrees",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const paramName of ["x", "y", "z"]) {
      expect(findParam("Angle", "Angle <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "-2880..2880",
        valueRange: {
          min: -2880,
          max: 2880,
          unit: "degrees",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("AngleDelta", "AngleDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result wraps modulo 2880",
        valueRange: {
          unit: "degrees delta",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
    }
  });

  it("ships live-probed rotation speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const paramName of ["x", "y", "z"]) {
      expect(findParam("RotoSpeed", "RotoSpeed <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "-1440..1440",
        valueRange: {
          min: -1440,
          max: 1440,
          unit: "rotation speed",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("RotoSpeedDelta", "RotoSpeedDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; resulting speed clamps to -1440..1440",
        valueRange: {
          unit: "rotation speed delta",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, property] of [
      ["RotoSpeedX", "Master.RotoSpeedX"],
      ["RotoSpeedY", "Master.RotoSpeedY"],
      ["RotoSpeedZ", "Master.RotoSpeedZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-1440..1440",
        valueRange: {
          min: -1440,
          max: 1440,
          unit: "rotation speed",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }
  });

  it("ships live-probed position and size range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["x", "y", "z"]) {
      const positionParam = findParam("Position", "Position <x>, <y>, <z>", paramName);
      expect(positionParam).toMatchObject({
        type: "number",
        range: "documented -400..400; runtime stores through +/-400.01220703125",
        valueRange: {
          min: -400.01220703125,
          max: 400.01220703125,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(String(positionParam?.valueRange?.notes)).toContain("400.01220703125");
      expect(String(positionParam?.valueRange?.notes)).toContain("not an asymptotic curve");
      expect(String(positionParam?.valueRange?.notes)).toContain("lint acceptance");
      expect(findParam("PositionDelta", "PositionDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result clamps to -400..400",
        valueRange: {
          unit: "percent delta",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("Size", "Size <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "0..400",
        valueRange: {
          max: 400,
          unit: "percent",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("SizeDelta", "SizeDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result clamps above 400, negatives pass through",
        valueRange: {
          unit: "percent delta",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, property] of [
      ["PositionX", "Master.PositionX"],
      ["PositionY", "Master.PositionY"],
      ["PositionZ", "Master.PositionZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-400..400",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }

    for (const [commandName, property] of [
      ["SizeX", "Master.SizeX"],
      ["SizeY", "Master.SizeY"],
      ["SizeZ", "Master.SizeZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "nominal 0..400; values above 400 clamp, negatives pass through",
        valueRange: {
          max: 400,
          unit: "percent",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }

    for (const commandName of ["PositionIndex", "SizeIndex"] as const) {
      expect(findParam(commandName, `${commandName} <axis>, <value>`, "axis")).toMatchObject({
        type: "integer",
        range: "0..2",
        valueRange: {
          min: 0,
          max: 2,
          unit: "axis index",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 0, label: "X" },
          { value: 1, label: "Y" },
          { value: 2, label: "Z" },
        ],
      });
    }

    expect(findParam("PositionIndex", "PositionIndex <axis>, <value>", "value")).toMatchObject({
      type: "number",
      range: "-400..400",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("SizeIndex", "SizeIndex <axis>, <value>", "value")).toMatchObject({
      type: "number",
      range: "nominal 0..400; runtime stores -400..400",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    const sizeIndexValueParam = findParam("SizeIndex", "SizeIndex <axis>, <value>", "value");
    expect(String(sizeIndexValueParam?.valueRange?.notes)).toContain("-401 clamps to -400");
    expect(String(sizeIndexValueParam?.valueRange?.notes)).toContain("readback did not prove");
  });

  it("ships live-probed RGBA channel range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const signature of ["RGBA <r>, <g>, <b>, <a>", "RGBA <r>, <g>, <b>"]) {
      const paramNames = signature.endsWith("<a>") ? ["r", "g", "b", "a"] : ["r", "g", "b"];
      for (const paramName of paramNames) {
        expect(findParam("RGBA", signature, paramName)).toMatchObject({
          type: "integer",
          range: "0..255",
          valueRange: {
            min: 0,
            max: 255,
            unit: "8-bit channel",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
        });
      }
    }

    const channelValues = [
      { value: 0, label: "Red" },
      { value: 1, label: "Green" },
      { value: 2, label: "Blue" },
      { value: 3, label: "Alpha" },
    ];

    const rgbaIndexParam = findParam("RGBA", "RGBA <index>, <value>", "index");
    expect(rgbaIndexParam).toMatchObject({
      type: "integer",
      range: "0..3",
      valueRange: {
        min: 0,
        max: 3,
        unit: "RGBA channel index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: channelValues,
    });
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("RGBA 4,55 writes Red=55");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("RGBA 5,77");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("not a general wrap mapping");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("lint acceptance");
    expect(findParam("RGBA", "RGBA <index>, <value>", "value")).toMatchObject({
      type: "integer",
      range: "0..255",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const signature of ["RGBADelta <r>, <g>, <b>, <a>", "RGBADelta <r>, <g>, <b>"]) {
      const paramNames = signature.endsWith("<a>") ? ["r", "g", "b", "a"] : ["r", "g", "b"];
      for (const paramName of paramNames) {
        expect(findParam("RGBADelta", signature, paramName)).toMatchObject({
          type: "integer",
          valueRange: {
            unit: "channel delta",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
        });
      }
    }

    const rgbaDeltaIndexParam = findParam("RGBADelta", "RGBADelta <index>, <value>", "index");
    expect(rgbaDeltaIndexParam).toMatchObject({
      type: "integer",
      range: "0..3",
      valueRange: {
        min: 0,
        max: 3,
        unit: "RGBA channel index",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
      acceptedValues: channelValues,
    });
    expect(String(rgbaDeltaIndexParam?.valueRange?.notes)).toContain("RGBADelta 4,10");
    expect(String(rgbaDeltaIndexParam?.valueRange?.notes)).toContain("no observable channel change");
    expect(findParam("RGBADelta", "RGBADelta <index>, <value>", "value")).toMatchObject({
      type: "integer",
      valueRange: {
        unit: "channel delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed color slider and packed-color metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const colorSliderParam = findParam("ColorSlider", "ColorSlider <value>", "value");
    expect(colorSliderParam).toMatchObject({
      type: "number",
      range: "0..255",
      valueRange: {
        min: 0,
        max: 255,
        unit: "color slider",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("half values rounded to even");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("0.6 and 0.9 read back 1");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("255.5 read back 255");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");

    expect(findParam("ColorSliderDelta", "ColorSliderDelta <delta>", "delta")).toMatchObject({
      type: "number",
      valueRange: {
        unit: "color slider delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("ColorOn", "ColorOn <enabled>", "enabled")).toMatchObject({
      type: "number",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
        { value: "OFF", label: "OFF" },
        { value: "ON", label: "ON" },
      ],
      valueRange: {
        unit: "enable threshold",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, description, firstProbeValue, secondProbeValue] of [
      ["ColorRGB", "low byte", "257 read Red=1", "0xFF0000FF read Red=255"],
      ["ColorBGR", "high RGB byte", "0x1FFFF read Red=1", "0xFF0000FF read Red=0"],
    ] as const) {
      const param = findParam(commandName, `${commandName} <packedColor>`, "packedColor");
      expect(param).toMatchObject({
        type: "integer",
        range: "0..16777215",
        valueRange: {
          min: 0,
          max: 16777215,
          unit: "24-bit packed color",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
      expect(param?.description).toContain(description);
      expect(String(param?.valueRange?.notes)).toContain(firstProbeValue);
      expect(String(param?.valueRange?.notes)).toContain(secondProbeValue);
      expect(String(param?.valueRange?.notes)).toContain("byte masking");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");
    }
  });

  it("ships live-probed physics slider range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      ["SetAttractionSlider", "SetAttractionSlider <value>", 50, "51 or 100 clamp to 50"],
      ["SetFrictionSlider", "SetFrictionSlider <value>", 30, "31 or 100 clamp to 30"],
      ["SetMassSlider", "SetMassSlider <value>", 30, "31 or 100 clamp to 30"],
    ] as const;

    for (const [commandName, signature, max, maxEvidence] of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === "value") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range: `1..${max}`,
        valueRange: {
          min: 1,
          max,
          unit: "slider value",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain(maxEvidence);
      expect(String(param?.valueRange?.notes)).toContain("did not switch workspace or physics preset");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");
    }
  });

  it("ships live-probed audio gain and release range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const clampedCases = [
      ["SetAudioGain", "SetAudioGain <level>", "level", "1..15", 1, 15, "gain level"],
      ["SetAudioRelease", "SetAudioRelease <time>", "time", "0.1..99", 0.1, 99, "release time"],
    ] as const;

    for (const [commandName, signature, paramName, range, min, max, unit] of clampedCases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range,
        valueRange: {
          min,
          max,
          unit,
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    const passThroughCases = [
      [
        "SetAudioInGain",
        "SetAudioInGain <level>",
        "level",
        "normal-use 1..15; runtime pass-through observed through -1000..100000",
        "gain level",
      ],
      [
        "SetAudioInRelease",
        "SetAudioInRelease <time>",
        "time",
        "normal-use 1..99; runtime pass-through observed through -1000..100000",
        "release time",
      ],
    ] as const;

    for (const [commandName, signature, paramName, range, unit] of passThroughCases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range,
        valueRange: {
          unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
      expect(String(param?.valueRange?.notes)).toContain("100000");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance");
    }
  });

  it("ships live-probed master audio volume and mute metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    expect(findParam("MasterAudioVolume", "MasterAudioVolume <percent>", "percent")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "audio volume percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("MasterAudioVolumeMute", "MasterAudioVolumeMute <state>", "state")).toMatchObject({
      type: "integer",
      range: "0..2",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
        { value: 2, label: "TOGGLE" },
        { value: "OFF", label: "OFF" },
        { value: "ON", label: "ON" },
        { value: "TOGGLE", label: "TOGGLE" },
      ],
      valueRange: {
        min: 0,
        max: 2,
        unit: "mute state",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed visible points range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("VisiblePoints", "VisiblePoints <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "visible points percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("VisiblePointsDelta", "VisiblePointsDelta <delta>", "delta")).toMatchObject({
      type: "number",
      valueRange: {
        unit: "visible points delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed scan rate range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const scanRate = findParam("ScanRate", "ScanRate <value>", "value");
    expect(scanRate).toMatchObject({
      type: "number",
      range: "1..400",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(scanRate?.valueRange?.notes)).toContain("2026-05-12");
    expect(String(scanRate?.valueRange?.notes)).toContain("1, 5, 10");
    expect(String(scanRate?.valueRange?.notes)).toContain("below the ScanRateDelta result floor");

    const scanRateDelta = findParam("ScanRateDelta", "ScanRateDelta <delta>", "delta");
    expect(scanRateDelta).toMatchObject({
      type: "number",
      range: "relative; result clamps to 25..200",
      valueRange: {
        unit: "scan rate delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("deltas -49, -50, and -51 all read back 25");
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("delta 1 read back 25 rather than 2");
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("hardware dependence is not proven");
  });

  it("ships live-probed animation speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("AnimationSpeed", "AnimationSpeed <value>", "value")).toMatchObject({
      type: "number",
      range: "0..400",
      valueRange: {
        min: 0,
        max: 400,
        unit: "animation speed percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("AnimationSpeedDelta", "AnimationSpeedDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..400",
      valueRange: {
        unit: "animation speed delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed zoom range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("Zoom", "Zoom <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("ZoomDelta", "ZoomDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed strobe speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("StrobeSpeed", "StrobeSpeed <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "flickers per second",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("StrobeSpeedDelta", "StrobeSpeedDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "flickers per second delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master speed scalar range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const percentScaled = [
      ["MasterFXSpeed", "MasterFXSpeed <value>", "value", "Master.FXSpeed"],
      ["MasterCueSpeed", "MasterCueSpeed <value>", "value", "Master.CueSpeed"],
      ["MasterCueLcSpeed", "MasterCueLcSpeed <percent>", "percent", "Master.CueLcSpeed"],
      ["MasterLCSpeed", "MasterLCSpeed <value>", "value", "Master.LCSpeed"],
      ["MasterZoneFxSpeed", "MasterZoneFxSpeed <value>", "value", "Master.ZoneFxSpeed"],
    ] as const;

    for (const [commandName, signature, paramName, propertyPath] of percentScaled) {
      expect(merged.commands[commandName]?.setsProperty).toEqual([propertyPath]);
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range: "pass-through; input percent stores input / 100 at least -1..9999",
        valueRange: {
          unit: "percent input",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("MasterSpeed", "MasterSpeed <ratio>", "ratio")).toMatchObject({
      range: "no exposed readback effect observed for -1, 0, 50, 100, and 9999",
      valueRange: {
        unit: "documented ratio",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master timing shift range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature, paramName, propertyPath, unit, range] of [
      [
        "MasterClockShift",
        "MasterClockShift <seconds>",
        "seconds",
        "Master.CueClockShift",
        "seconds",
        "pass-through; absolute setter observed -3.5..10000",
      ],
      [
        "MasterEffectClockShift",
        "MasterEffectClockShift <seconds>",
        "seconds",
        "Master.MasterEffectClockShift",
        "seconds",
        "pass-through; absolute setter observed -3.5..10000",
      ],
      [
        "MasterEffectMetroShift",
        "MasterEffectMetroShift <beats>",
        "beats",
        "Master.MasterEffectMetroShift",
        "beats",
        "pass-through; absolute setter observed -2.5..10000",
      ],
      [
        "MasterMetroShift",
        "MasterMetroShift <beats>",
        "beats",
        "Master.CueBeatShift",
        "beats",
        "pass-through; absolute setter observed -2.5..10000",
      ],
      [
        "MasterShowShift",
        "MasterShowShift <ms>",
        "ms",
        "Master.ShowShift",
        "milliseconds input",
        "pass-through; absolute setter observed -250..100000",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toEqual([propertyPath]);
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
    }

    expect(merged.commands.MasterPauseTime?.setsProperty).toEqual(["Master.PauseTime"]);
    expect(findParam("MasterPauseTime", "MasterPauseTime <ms>", "ms")).toMatchObject({
      type: "integer",
      range: "0..5000",
      valueRange: {
        min: 0,
        max: 5000,
        unit: "milliseconds",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships transition index range metadata and transition time readback limits", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["MasterTransitionIndex", "MasterTransitionIndex <value>"],
      ["SetTransitionIndex", "SetTransitionIndex <value>"],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toEqual(["Master.TransitionIndex"]);
      expect(findParam(commandName, signature, "value")).toMatchObject({
        type: "integer",
        range: "0..24",
        valueRange: {
          min: 0,
          max: 24,
          unit: "transition preset index",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, signature] of [
      ["MasterTransitionTime", "MasterTransitionTime <seconds>"],
      ["SetTransitionTime", "SetTransitionTime <seconds>"],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toBeUndefined();
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
        safetyTier: "T2",
      });
      expect(findParam(commandName, signature, "seconds")).toMatchObject({
        type: "number",
        range: "no readable range evidence; representative writes sent for -1, 0, 0.5, 2, and 10000",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("ships live-probed BeamBrush range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("BeamBrush", "BeamBrush <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("BeamBrushDelta", "BeamBrushDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed hue and saturation range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    expect(findParam("Hue", "Hue <value>", "value")).toMatchObject({
      type: "number",
      range: "-1..720",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      acceptedValues: [expect.objectContaining({ value: -1, label: "DISABLED" })],
    });

    expect(findParam("HueDelta", "HueDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to -1..720",
      valueRange: {
        unit: "degrees delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("HueShift", "HueShift <value>", "value")).toMatchObject({
      type: "number",
      range: "pass-through; no clamp observed through -1000000..1000000",
      valueRange: {
        unit: "degrees",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("HueShiftDelta", "HueShiftDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; resulting value passed through at -1000000 and 1000000",
      valueRange: {
        unit: "degrees delta",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("Saturation", "Saturation <value>", "value")).toMatchObject({
      type: "number",
      range: "-100..100",
      valueRange: {
        min: -100,
        max: 100,
        unit: "signed saturation offset",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("SaturationDelta", "SaturationDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to -100..100",
      valueRange: {
        unit: "signed saturation delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed channel input ratio range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      "SetChannelToChannelRatio",
      "SetDmxToChannelRatio",
      "SetFFTToChannelRatio",
      "SetVdjToChannelRatio",
    ] as const;

    for (const commandName of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <ratio>`)
        ?.parameters?.find((candidate) => candidate.name === "ratio") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range: "0..100",
        valueRange: {
          min: 0,
          max: 100,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }
  });

  it("ships live-probed FX MSL range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    for (let index = 1; index <= 6; index += 1) {
      const commandName = `SetFX${index}MSL`;
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <layer>`)
        ?.parameters?.find((candidate) => candidate.name === "layer") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "integer",
        range: "0..11",
        valueRange: {
          min: 0,
          max: 11,
          unit: "MSL input layer",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain("2026-05-12");
      expect(String(param?.valueRange?.notes)).toContain("-2");
      expect(String(param?.valueRange?.notes)).toContain("100");
      expect(String(param?.description)).toContain("Inputs -2 through 100 pass through to storage");
    }
  });

  it("ships live-probed surface MSL range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      "SetGrid1MSL",
      "SetGrid2MSL",
      "SetSliderMSL",
      "SetButtonMSL",
      "SetZoneMuteMSL",
      "SetZoneSelMSL",
    ] as const;

    for (const commandName of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <layer>`)
        ?.parameters?.find((candidate) => candidate.name === "layer") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "integer",
        range: "0..11",
        valueRange: {
          min: 0,
          max: 11,
          unit: "MSL input layer",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain("2026-05-12");
      expect(String(param?.valueRange?.notes)).toContain("-2");
      expect(String(param?.valueRange?.notes)).toContain("100");
      expect(String(param?.description)).toContain("Inputs -2 through 100 pass through to storage");
    }
  });

  it("keeps LockScreen metadata tied to BEYOND UI security, not PangoScript Password", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const command = merged.commands.LockScreen;

    expect(command?.description).toContain("UI-side password");
    expect(command?.description).toContain("NOT the PangoScript `Password` command");
    expect(command?.forms?.[0]?.description).toContain("BEYOND Configuration/Security");
    expect(command?.forms?.[0]?.description).toContain("PangoScript Password command is unrelated");
    expect(command?.forms?.[0]?.parameters).toEqual([]);
  });

  it("keeps working-example command arities represented in curated metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    const muteSelectedZones = merged.commands.MuteSelectedZones?.forms?.find(
      (form) => form.signature === "MuteSelectedZones <action>",
    );
    const waitForTimerBeat = merged.commands.WaitForTimerBeat?.forms?.find(
      (form) => form.signature === "WaitForTimerBeat <beats>",
    );

    expect(muteSelectedZones).toMatchObject({
      signature: "MuteSelectedZones <action>",
      parameters: [
        {
          name: "action",
          required: true,
        },
      ],
    });
    expect(waitForTimerBeat).toMatchObject({
      signature: "WaitForTimerBeat <beats>",
      parameters: [
        {
          name: "beats",
          required: true,
        },
      ],
    });
  });

  it("ships timing wait range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const sleepTime = findParam("Sleep", "Sleep <timeMs>", "timeMs");
    const waitMask = findParam("WaitForBeat", "WaitForBeat <beatMask>, <count>", "beatMask");
    const waitCount = findParam("WaitForBeat", "WaitForBeat <beatMask>, <count>", "count");
    const timerBeats = findParam("WaitForTimerBeat", "WaitForTimerBeat <beats>", "beats");

    expect(sleepTime).toMatchObject({
      range: "milliseconds; lower and upper bounds not established",
      valueRange: {
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(waitMask).toMatchObject({
      range: "bit mask 1..7 using timer=1, manual=2, audio=4",
      valueRange: {
        min: 1,
        max: 7,
        unit: "beat-source bit mask",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(waitMask?.acceptedValues).toEqual([
      expect.objectContaining({ value: 1, label: "Timer beat" }),
      expect.objectContaining({ value: 2, label: "Manual beat" }),
      expect.objectContaining({ value: 4, label: "Audio beat" }),
      expect.objectContaining({ value: 7, label: "Any documented beat source" }),
    ]);
    expect(waitCount).toMatchObject({
      range: "documented whole-event count; fractional and zero behavior unverified",
      valueRange: {
        unit: "matching beat events",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(timerBeats).toMatchObject({
      range: "timer beats; fractional, zero, and upper-bound behavior unverified",
      valueRange: {
        unit: "timer beats",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
  });

  it("ships source-dependent trigger threshold metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.flatMap((form) => form.parameters ?? [])
        .find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const commandName of [
      "DecreaseTrigger",
      "IncreaseTrigger",
      "InRangeTrigger",
      "InRangeTriggerCmd",
      "OutOfRangeTrigger",
      "OutOfRangeTriggerCmd",
    ]) {
      for (const paramName of ["minValue", "maxValue"]) {
        const param = findParam(commandName, paramName);
        expect(param, `${commandName}.${paramName}`).toMatchObject({
          range: "source-dependent watched value",
          valueRange: {
            unit: "watched trigger value",
            boundaryBehavior: "unknown",
            evidenceLevel: "documented",
          },
        });
        expect(param?.valueRange).not.toHaveProperty("min");
        expect(param?.valueRange).not.toHaveProperty("max");
      }
    }

    for (const commandName of ["LessThanTrigger", "MoreThanTrigger"]) {
      const param = findParam(commandName, "threshold");
      expect(param, `${commandName}.threshold`).toMatchObject({
        range: "source-dependent watched value",
        valueRange: {
          unit: "watched trigger value",
          boundaryBehavior: "unknown",
          evidenceLevel: "documented",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }
  });

  it("ships observed AnimateProp range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.flatMap((form) => form.parameters ?? [])
        .find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["startValue", "finishValue"]) {
      const param = findParam("AnimateProp", paramName);
      expect(param, `AnimateProp.${paramName}`).toMatchObject({
        range: "target-property-dependent numeric value",
        valueRange: {
          unit: "target property value",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    const animateDuration = findParam("AnimateProp", "durationMS");
    expect(animateDuration).toMatchObject({
      range: "0 and positive milliseconds observed; upper bound not established",
      valueRange: {
        min: 0,
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(animateDuration?.valueRange).not.toHaveProperty("max");

    const animateFinishEvent = findParam("AnimateProp", "finishEvent");
    expect(animateFinishEvent).toMatchObject({
      range: "free-form event name; empty string accepted",
    });

    const delta = findParam("AnimatePropDelta", "totalDelta");
    expect(delta).toMatchObject({
      range: "target-property-dependent numeric delta",
      valueRange: {
        unit: "target property delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(delta?.valueRange).not.toHaveProperty("min");
    expect(delta?.valueRange).not.toHaveProperty("max");

    const deltaDuration = findParam("AnimatePropDelta", "durationMS");
    expect(deltaDuration).toMatchObject({
      range: "0 and positive milliseconds observed; upper bound not established",
      valueRange: {
        min: 0,
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(deltaDuration?.valueRange).not.toHaveProperty("max");

    const deltaFinishEvent = findParam("AnimatePropDelta", "finishEvent");
    expect(deltaFinishEvent).toMatchObject({
      range: "free-form event name; empty string behavior inferred from AnimateProp",
    });
  });

  it("pins conservative safety tiers for dynamic and state-changing command families", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.ExecCmd?.safetyTier).toBe("T4");
    expect(merged.commands.SetZoneMeshPointPos?.safetyTier).toBe("T4");

    for (const commandName of ["HtmlBody", "HtmlClearBody", "HtmlClearHead", "HtmlHead", "HtmlHide", "HtmlUpdate"]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T2");
    }

    for (const commandName of [
      "ClickFlash",
      "ClickLive",
      "ClickRestart",
      "ClickSelect",
      "ClickSoloFlash",
      "ClickToggle",
      "ClickTrack",
      "HoldClick",
      "MultiCue",
      "OneCue",
      "OnePer",
    ]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T2");
    }

    for (const commandName of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T4");
    }
  });

  it("ships blocked mesh geometry range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["x", "y"]) {
      const param = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', paramName);
      expect(param, `MeshPoint.${paramName}`).toMatchObject({
        range:
          "export example uses -100..100 coordinate space; accepted bounds and normalized 0..1 behavior unverified",
        valueRange: {
          unit: "mesh coordinate",
          boundaryBehavior: "unknown",
          evidenceLevel: "exported",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    const z = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', "z");
    expect(z).toMatchObject({
      range: "export example uses 0 for Z; accepted bounds and normalized 0..1 behavior unverified",
      valueRange: {
        unit: "mesh coordinate",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(z?.valueRange).not.toHaveProperty("min");
    expect(z?.valueRange).not.toHaveProperty("max");

    const name = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', "name");
    expect(name).toMatchObject({
      range: "free-form point label; name-reference behavior unverified",
    });

    for (const [paramName, range] of [
      ["a", "undocumented numeric parameter; export example a=1; coordinate or channel meaning unverified"],
      ["b", "undocumented numeric parameter; export example b=0; coordinate or channel meaning unverified"],
      ["c", "undocumented numeric parameter; export example c=0; coordinate or channel meaning unverified"],
    ]) {
      const param = findParam("MeshPointChan", "MeshPointChan <a>, <b>, <c>", paramName);
      expect(param, `MeshPointChan.${paramName}`).toMatchObject({
        range,
        valueRange: {
          unit: "undocumented mesh-point channel parameter",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    for (const [commandName, signature, paramNames] of [
      ["MeshCurve", "MeshCurve <pt1>, <pt2>, <pt3>", ["pt1", "pt2", "pt3"]],
      ["MeshPolygon", "MeshPolygon <pt1>, <pt2>", ["pt1", "pt2"]],
      ["MeshRect", "MeshRect <pt1>, <pt2>, <pt3>, <pt4>", ["pt1", "pt2", "pt3", "pt4"]],
      ["MeshSpline", "MeshSpline <base1>, <handle1>, <handle2>, <base2>", ["base1", "handle1", "handle2", "base2"]],
      ["MeshTriangle", "MeshTriangle <pt1>, <pt2>, <pt3>", ["pt1", "pt2", "pt3"]],
    ] as const) {
      for (const paramName of paramNames) {
        const param = findParam(commandName, signature, paramName);
        expect(param, `${commandName}.${paramName}`).toMatchObject({
          range: "1-based mesh point index; export examples reference points 1..N; zero and upper bound unverified",
          valueRange: {
            min: 1,
            unit: "mesh point index",
            boundaryBehavior: "unknown",
            evidenceLevel: "exported",
          },
        });
        expect(param?.valueRange).not.toHaveProperty("max");
      }
    }

    for (const commandName of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("keeps command setsProperty paths resolvable through shipped object schemas", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const knownProperties = readJson<{
      schemas: Array<{
        object: string;
        isArray: boolean;
        properties: string[];
      }>;
    }>("known-properties.json");
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        normalizedPath?: string;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set<string>();
    for (const schema of knownProperties.schemas) {
      for (const property of schema.properties) {
        knownPaths.add(`${schema.object}${schema.isArray ? ".N" : ""}.${property}`);
      }
    }
    for (const entry of objectPropertyIndex.entries) {
      knownPaths.add(entry.normalizedPath ?? entry.path);
      knownPaths.add(entry.path);
    }

    const missing: string[] = [];
    for (const command of Object.values(merged.commands)) {
      for (const property of command.setsProperty ?? []) {
        if (!knownPaths.has(property)) missing.push(`${command.canonical}:${property}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("ships lab-confirmed setter mappings for indexed live-control commands", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.PositionIndex?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(merged.commands.PositionDelta?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(merged.commands.PositionX?.setsProperty).toEqual(["Master.PositionX"]);
    expect(merged.commands.PositionY?.setsProperty).toEqual(["Master.PositionY"]);
    expect(merged.commands.PositionZ?.setsProperty).toEqual(["Master.PositionZ"]);
    expect(merged.commands.SizeDelta?.setsProperty).toEqual(["Master.SizeX", "Master.SizeY", "Master.SizeZ"]);
    expect(merged.commands.SizeIndex?.setsProperty).toEqual(["Master.SizeX", "Master.SizeY", "Master.SizeZ"]);
    expect(merged.commands.SizeX?.setsProperty).toContain("Master.SizeX");
    expect(merged.commands.SizeY?.setsProperty).toEqual(["Master.SizeY"]);
    expect(merged.commands.SizeZ?.setsProperty).toEqual(["Master.SizeZ"]);
    expect(merged.commands.AnimationSpeed?.setsProperty).toEqual(["Master.AnimationSpeed"]);
    expect(merged.commands.VisiblePoints?.setsProperty).toEqual(["Master.VisiblePoints"]);
  });

  it("ships lab-confirmed setter mappings for live-control color and rotation-speed commands", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.ColorRGB?.setsProperty).toEqual(["Master.Red", "Master.RGBColor"]);
    expect(merged.commands.ColorBGR?.setsProperty).toEqual(["Master.Red", "Master.RGBColor"]);
    expect(merged.commands.RGBA?.setsProperty).toEqual([
      "Master.Red",
      "Master.Green",
      "Master.Blue",
      "Master.Alpha",
      "Master.RGBColor",
    ]);
    expect(merged.commands.RGBADelta?.setsProperty).toEqual([
      "Master.Red",
      "Master.Green",
      "Master.Blue",
      "Master.Alpha",
      "Master.RGBColor",
    ]);
    expect(merged.commands.RotoSpeed?.setsProperty).toEqual([
      "Master.RotoSpeedX",
      "Master.RotoSpeedY",
      "Master.RotoSpeedZ",
    ]);
    expect(merged.commands.RotoSpeedX?.setsProperty).toEqual(["Master.RotoSpeedX"]);
    expect(merged.commands.RotoSpeedY?.setsProperty).toEqual(["Master.RotoSpeedY"]);
    expect(merged.commands.RotoSpeedZ?.setsProperty).toEqual(["Master.RotoSpeedZ"]);
  });

  it("classifies live-control reset, button, and tab state coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.ResetPosition?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(coverage.commands.ClickLCTabMode?.status).toBe("no-direct-property");
    expect(coverage.commands.ClickLockSize?.status).toBe("no-direct-property");
    expect(coverage.commands.ResetLCTab?.status).toBe("no-direct-property");
    expect(coverage.commands.ResetLiveControl?.status).toBe("deferred");
    expect(coverage.commands.ResetLiveControl?.notes).toContain("Sweeping multi-property reset");
  });

  it("classifies FX command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const fxAssignments = fxProps("");
    const fxActions = fxProps("Action", 8);
    const fxTimeMul = [...fxProps("TimeMulClock", 8), ...fxProps("TimeMulMetro", 8)];
    const fxTimeScale = [...fxProps("TimeScaleClock", 8), ...fxProps("TimeScaleMetro", 8)];
    const fxTimeShift = [...fxProps("TimeShiftClock", 8), ...fxProps("TimeShiftMetro", 8)];

    expect(merged.commands.ClickFXStopAll?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.FX?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.ResetMasterFX?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.FXAction?.setsProperty).toEqual(fxActions);
    expect(merged.commands.SetFXMul?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.SetFXMulAx?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.MulFXMulAx?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.FXTimeScaleAx?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.FXTimeScaleAxReset?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.FXTimeScaleDeltaAx?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.ZoneFXTimeScale?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.ZoneFXTimeShift?.setsProperty).toEqual(fxTimeShift);

    for (const command of [
      "ClickFXTabMode",
      "ClickFxVlj",
      "DropFX",
      "FXCellClick",
      "FXCellDown",
      "FXClick",
      "FXScroll",
      "FXScrollDelta",
      "Set1FxPerLine",
      "Set4FxPerLine",
      "SetDropFxMode",
      "ShiftFX",
      "StopFX",
      "StopFxCell",
      "ToggleFX",
      "ZoneFXTimeScaleDelta",
      "ZoneFXTimeShiftDelta",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }

    for (const command of ["FXTimeSync", "ResetCuesFX", "ResetFxTiming", "ResetProTrackFX", "ResetZonesFX"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }
  });

  it("ships zone FX timing and FX scroll range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>"],
      ["ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>"],
    ] as const) {
      expect(findParam(commandName, signature, "layer")).toMatchObject({
        type: "integer",
        range: "1..8",
        valueRange: {
          min: 1,
          max: 8,
          unit: "FX layer",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>", "clockMul")).toMatchObject({
      range: "0 accepted; pass-through observed for 0, 2, and 4",
      valueRange: {
        min: 0,
        unit: "clock multiplier",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>", "metroMul")).toMatchObject({
      range: "0 accepted; pass-through observed for 0, 2, and 4",
      valueRange: {
        min: 0,
        unit: "metro multiplier",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>", "clockMul")).toMatchObject({
      range: "pass-through observed for 0, 2, and 4",
      valueRange: {
        unit: "clock shift value",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>", "metroMul")).toMatchObject({
      range: "pass-through observed for 0, 2, and 4",
      valueRange: {
        unit: "metro shift value",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, signature, clockName, metroName, clockRange, metroRange] of [
      [
        "ZoneFXTimeScaleDelta",
        "ZoneFXTimeScaleDelta <layer>, <clockDelta>, <metroDelta>",
        "clockDelta",
        "metroDelta",
        "no direct write target observed for delta 2",
        "no direct write target observed for delta 3",
      ],
      [
        "ZoneFXTimeShiftDelta",
        "ZoneFXTimeShiftDelta <layer>, <clockDelta>, <metroDelta>",
        "clockDelta",
        "metroDelta",
        "no direct write target observed for delta 4",
        "no direct write target observed for delta 5",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, "layer")).toMatchObject({
        valueRange: {
          unit: "FX layer",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(findParam(commandName, signature, clockName)).toMatchObject({
        range: clockRange,
        valueRange: {
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(findParam(commandName, signature, metroName)).toMatchObject({
        range: metroRange,
        valueRange: {
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("FXScroll", "FXScroll <baseIndex>", "baseIndex")).toMatchObject({
      range: "no readable range evidence; representative writes sent for 0, 4, and 999",
      valueRange: {
        unit: "QuickFX base index",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(findParam("FXScrollDelta", "FXScrollDelta <delta>", "delta")).toMatchObject({
      range: "no readable range evidence; representative writes sent for -999, -1, 1, and 999",
      valueRange: {
        unit: "QuickFX base-index delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
  });

  it("classifies projection-zone routing, selection, mute, and mesh coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const zoneSelection = ["Zone.N.Selected"];
    const zoneMute = ["Zone.N.Mute", "Zone.N.Muted"];

    for (const command of [
      "ReStoreZoneSelection",
      "SelectAndFocusZone",
      "SelectZone",
      "SelectZoneName",
      "ToggleSelectZone",
      "UnSelectZone",
      "UnSelectZoneName",
      "UnselectAllZones",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(zoneSelection);
    }

    for (const command of [
      "MuteAllZones",
      "MuteSelectedZones",
      "MuteZone",
      "MuteZonesOfProjector",
      "ToggleMuteZone",
      "ToggleMuteZoneOfProjector",
      "UnMuteZonesOfProjector",
      "UnmuteAllZone",
      "UnmuteZone",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(zoneMute);
    }

    expect(merged.commands.SetProTrackZones?.setsProperty).toEqual(["ProTrack.N.Zones"]);
    expect(merged.commands.SetZoneMuteMSL?.setsProperty).toEqual(["MIDI1.ZoneMuteMSL"]);
    expect(merged.commands.SetZoneSelMSL?.setsProperty).toEqual(["MIDI1.ZoneSelMSL"]);

    for (const command of [
      "ControlCue",
      "ControlFromFxTab",
      "ControlFromLcTab",
      "ControlFromTcTab",
      "ControlFromUI",
      "ControlMaster",
      "ControlProTrack",
      "ControlProjector",
      "ControlSelCues",
      "ControlSelProTracks",
      "ControlSelZones",
      "ControlZone",
      "FocusProjector",
      "FocusZone",
      "GetFxControl",
      "GetLiveControl",
      "GetPage",
      "GetTimeControl",
      "PreviewZoneGrid",
      "PreviewZoneMatrix",
      "ProjectionZonesDialog",
      "SelectFixt",
      "SelectProjector",
      "SetLimiterPerZone",
      "StoreZoneSelection",
      "ToggleSelectFixt",
      "ToggleSelectProjector",
      "UnselectAllFixt",
      "UnselectAllProjectors",
      "UnselectFixt",
      "UnselectProjector",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }

    for (const command of ["LoadZoneFromBlob", "MuteSelected", "SetZoneMeshPointPos"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }
  });

  it("ships projector index range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["MuteZonesOfProjector", "MuteZonesOfProjector <projectorIndex>"],
      ["ToggleMuteZoneOfProjector", "ToggleMuteZoneOfProjector <projectorIndex>"],
      ["UnMuteZonesOfProjector", "UnMuteZonesOfProjector <projectorIndex>"],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "mapped",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, "projectorIndex")).toMatchObject({
        range: "1..max Zone.N.ProjectorIndex (1..3 observed in lab)",
        valueRange: {
          min: 1,
          unit: "projector index",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, signature, range] of [
      [
        "FocusProjector",
        "FocusProjector <projectorIndex>",
        "1..configured projector indices; no readable focus property",
      ],
      [
        "SelectProjector",
        "SelectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "ToggleSelectProjector",
        "ToggleSelectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "UnselectProjector",
        "UnselectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "ControlProjector",
        "ControlProjector <projectorIndex>",
        "historical projector index; representative writes sent for 0, 1, and 4 with no readable route state",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
      });
      expect(findParam(commandName, signature, "projectorIndex")).toMatchObject({
        range,
        valueRange: {
          min: 1,
          unit: "projector index",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("classifies ProTrack command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of ["SelectProTrack", "ToggleSelectProTrack", "UnselectAllProTracks", "UnselectProTrack"]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Selected"]);
    }

    for (const command of [
      "MuteAllProTracks",
      "MuteProTrack",
      "ToggleMuteProTrack",
      "UnmuteAllProTracks",
      "UnmuteProTrack",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Mute"]);
    }

    for (const command of ["SoloProTrack", "ToggleSoloProTrack", "UnSoloAllProTrack", "UnSoloProTrack"]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Solo"]);
    }

    for (const command of [
      "FocusProTrack",
      "InvertProTrackTime",
      "ProTrackDisk",
      "ProTrackDiskShift",
      "ProTrackResetJump",
      "ProTrackSetJump",
      "ProTrackSetLoop",
      "StartTvMode",
      "StopProTrack",
      "StopProTrackFX",
      "StopTvMode",
      "SynchronizePlayerToBeat",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships documented LinePerCycle scheduler range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const lines = merged.commands.LinePerCycle?.forms
      ?.find((form) => form.signature === "LinePerCycle <lines>")
      ?.parameters?.find((param) => param.name === "lines") as
      | (Record<string, unknown> & {
          acceptedValues?: Array<Record<string, unknown>>;
          valueRange?: Record<string, unknown>;
        })
      | undefined;

    expect(lines).toMatchObject({
      type: "integer",
      range: "documented default 30 lines per cycle; accepted bounds, 0 behavior, and maximum unverified",
      valueRange: {
        unit: "script lines per scheduling cycle",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(lines?.valueRange).not.toHaveProperty("min");
    expect(lines?.valueRange).not.toHaveProperty("max");
    expect(lines?.acceptedValues).toEqual([expect.objectContaining({ value: 30, label: "Documented default" })]);
    expect(merged.commands.LinePerCycle?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unverified",
          method: "operatorSupervised",
          expectedCallback: expect.stringContaining(
            "PangoLint lint acceptance and Talk UDP transmission are not range evidence",
          ),
        }),
      ]),
    );
  });

  it("ships conservative ProTrack disk and TV mode range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const position = findParam("ProTrackDisk", "ProTrackDisk <indexOrName>, <position>", "position");
    expect(position).toMatchObject({
      range: "fractional disk position; export example 0.1; bounds and clamp behavior unverified",
      valueRange: {
        unit: "fractional disk position",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(position?.valueRange).not.toHaveProperty("min");
    expect(position?.valueRange).not.toHaveProperty("max");

    const diskShiftForm = merged.commands.ProTrackDiskShift?.forms?.find(
      (form) => form.signature === "ProTrackDiskShift <delta>",
    );
    expect(diskShiftForm?.parameters?.map((param) => param.name)).toEqual(["delta"]);

    const delta = findParam("ProTrackDiskShift", "ProTrackDiskShift <delta>", "delta");
    expect(delta).toMatchObject({
      range: "fractional disk-position delta; export example 0.1; negative and clamp behavior unverified",
      valueRange: {
        unit: "fractional disk-position delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(delta?.valueRange).not.toHaveProperty("min");
    expect(delta?.valueRange).not.toHaveProperty("max");

    const fps = findParam("StartTvMode", "StartTvMode <fps>", "fps");
    expect(fps).toMatchObject({
      range: "documented example 30 FPS; 24, 25, 30, 60, 0, and 1000 have no readback-confirmed acceptance",
      valueRange: {
        unit: "frames per second",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(fps?.valueRange).not.toHaveProperty("min");
    expect(fps?.valueRange).not.toHaveProperty("max");

    for (const commandName of ["ProTrackDisk", "ProTrackDiskShift", "StartTvMode"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships conservative stop, fade, and blackout range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const commandName of ["StopAllAsync", "StopAllSync"]) {
      const time = findParam(commandName, `${commandName} <time>`, "time");
      expect(time, `${commandName}.time`).toMatchObject({
        range: "seconds; 0, 1.0, and 60 have no readback-confirmed acceptance",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(time?.valueRange).not.toHaveProperty("min");
      expect(time?.valueRange).not.toHaveProperty("max");
    }

    for (const signature of ["StopCueType <mask>", "StopCueType <mask>, <fadeSeconds>"]) {
      const mask = findParam("StopCueType", signature, "mask");
      expect(mask, signature).toMatchObject({
        range: "documented cue-type bit mask: 1 Image, 2 Timeline, 4 DMX, 8 Sequence, 16 Beams, 32 Capture; 255 all",
        valueRange: {
          unit: "cue type mask",
          boundaryBehavior: "unknown",
          evidenceLevel: "documented",
        },
      });
      expect(mask?.acceptedValues).toEqual([
        expect.objectContaining({ value: 1, label: "Image" }),
        expect.objectContaining({ value: 2, label: "Timeline" }),
        expect.objectContaining({ value: 4, label: "DMX" }),
        expect.objectContaining({ value: 8, label: "Sequence" }),
        expect.objectContaining({ value: 16, label: "Beams" }),
        expect.objectContaining({ value: 32, label: "Capture" }),
        expect.objectContaining({ value: 255, label: "All documented cue types" }),
      ]);
    }

    const fadeSeconds = findParam("StopCueType", "StopCueType <mask>, <fadeSeconds>", "fadeSeconds");
    expect(fadeSeconds).toMatchObject({
      range: "seconds; zero means immediate; 0.5, 2.0, and -1 have no readback-confirmed acceptance",
      valueRange: {
        unit: "seconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(fadeSeconds?.valueRange).not.toHaveProperty("min");
    expect(fadeSeconds?.valueRange).not.toHaveProperty("max");

    const blackoutState = findParam("StopOnBlackout", "StopOnBlackout <state>", "state");
    expect(blackoutState).toMatchObject({
      range: "0/1 and OFF/ON documented; TOGGLE behavior unverified",
      valueRange: {
        min: 0,
        max: 1,
        unit: "blackout stop state",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(blackoutState?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "OFF" }),
      expect.objectContaining({ value: 1, label: "ON" }),
      expect.objectContaining({ value: "OFF", label: "OFF" }),
      expect.objectContaining({ value: "ON", label: "ON" }),
    ]);

    const fxLine = findParam("StopProTrackFX", "StopProTrackFX [<indexOrName>[, <fxLine>, ...]]", "fxLine1..N");
    expect(fxLine).toMatchObject({
      range: "1-based FX line index; upper bound and out-of-range behavior unverified",
      valueRange: {
        min: 1,
        unit: "ProTrack FX line index",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(fxLine?.valueRange).not.toHaveProperty("max");

    for (const commandName of ["StopAllAsync", "StopAllSync", "StopCueType", "StopOnBlackout", "StopProTrackFX"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships conservative preview and UMax page range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const previewLayout = findParam("PreviewNxN", "PreviewNxN <layout>", "layout");
    expect(previewLayout).toMatchObject({
      range: "documented layout enum values 1, 2, 3, 4, 11, 12, 13; out-of-range behavior unverified",
      valueRange: {
        unit: "preview layout code",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(previewLayout?.acceptedValues).toEqual([
      expect.objectContaining({ value: 1, label: "Single laser" }),
      expect.objectContaining({ value: 2, label: "2x2" }),
      expect.objectContaining({ value: 3, label: "3x3" }),
      expect.objectContaining({ value: 4, label: "4x4" }),
      expect.objectContaining({ value: 11, label: "Custom 1" }),
      expect.objectContaining({ value: 12, label: "Custom 2" }),
      expect.objectContaining({ value: 13, label: "Custom 3" }),
    ]);
    expect(previewLayout?.valueRange).not.toHaveProperty("min");
    expect(previewLayout?.valueRange).not.toHaveProperty("max");

    const matrixIndex = findParam("PreviewZoneMatrix", "PreviewZoneMatrix <matrixIndex>", "matrixIndex");
    expect(matrixIndex).toMatchObject({
      range: "0 default preview; 1..N zone matrix index; upper bound and out-of-range behavior unverified",
      valueRange: {
        min: 0,
        unit: "zone matrix index",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(matrixIndex?.valueRange).not.toHaveProperty("max");

    const previewColor = findParam("DisplayPreview", "DisplayPreview <expression>, <color>", "color");
    expect(previewColor).toMatchObject({
      range: "packed RGB integer; hex literals documented; out-of-range behavior unverified",
      valueRange: {
        unit: "packed RGB color",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(previewColor?.valueRange).not.toHaveProperty("min");
    expect(previewColor?.valueRange).not.toHaveProperty("max");

    const uiFps = findParam("SetUiFPS", "SetUiFPS <fps>", "fps");
    expect(uiFps).toMatchObject({
      range: "documented default and example 25 FPS; 1, 30, 60, and 0 have no readback-confirmed acceptance",
      valueRange: {
        unit: "frames per second",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(uiFps?.valueRange).not.toHaveProperty("min");
    expect(uiFps?.valueRange).not.toHaveProperty("max");

    for (const commandName of [
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
    ]) {
      const delta = findParam(commandName, `${commandName} <delta>`, "delta");
      expect(delta, `${commandName}.delta`).toMatchObject({
        range: "integer page delta; +1 next page and -1 previous page documented; 0 and large deltas unverified",
        valueRange: {
          unit: "page offset",
          boundaryBehavior: "unknown",
          evidenceLevel: "exported",
        },
      });
      expect(delta?.valueRange).not.toHaveProperty("min");
      expect(delta?.valueRange).not.toHaveProperty("max");
    }

    for (const commandName of [
      "DisplayPreview",
      "PreviewNxN",
      "PreviewZoneMatrix",
      "SetUiFPS",
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
    ]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships packed color command range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const codeMarkerColor = findParam("CodeColorMarker", "CodeColorMarker <packedColor>", "packedColor");
    expect(codeMarkerColor).toMatchObject({
      range: "0x000000..0xFFFFFF documented GDI RGB color; 0xFFFFFFFF behavior unverified",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(codeMarkerColor?.acceptedValues).toEqual([
      expect.objectContaining({ value: 255, label: "Red, documented GDI RGB low byte" }),
      expect.objectContaining({ value: 65280, label: "Green" }),
      expect.objectContaining({ value: 16711680, label: "Blue, documented GDI RGB high byte" }),
      expect.objectContaining({ value: 16777215, label: "White" }),
    ]);
    expect(merged.commands.CodeColorMarker?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unverified",
          method: "operatorSupervised",
        }),
      ]),
    );

    const page = findParam("SetCueCaptionColor", "SetCueCaptionColor <page>, <cell>, <packedColor>", "page");
    expect(page).toMatchObject({
      range:
        "1-based workspace page index; pages 1 and 2 observed in lab, page 0 no-op, pages 3, 9, 10, and 11 had no matching WS readback change in this workspace",
      valueRange: {
        min: 1,
        unit: "workspace page index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(page?.valueRange).not.toHaveProperty("max");

    const cell = findParam("SetCueCaptionColor", "SetCueCaptionColor <page>, <cell>, <packedColor>", "cell");
    expect(cell).toMatchObject({
      range:
        "1-based cue cell index; cells 1, 9, 10, 11, 60, and 61 observed; cell 0 no-op; upper bound not established",
      valueRange: {
        min: 1,
        unit: "cue cell index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(cell?.valueRange).not.toHaveProperty("max");

    const captionColor = findParam(
      "SetCueCaptionColor",
      "SetCueCaptionColor <page>, <cell>, <packedColor>",
      "packedColor",
    );
    expect(captionColor).toMatchObject({
      range:
        "0x000000..0xFFFFFF documented GDI RGB color; 0xFFFFFFFF stores as signed -1; visual alpha/reset behavior unverified",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(captionColor?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "Black" }),
      expect.objectContaining({ value: 255, label: "Red, documented GDI RGB low byte" }),
      expect.objectContaining({ value: 65280, label: "Green" }),
      expect.objectContaining({ value: 16711680, label: "Blue, documented GDI RGB high byte" }),
      expect.objectContaining({ value: 16777215, label: "White" }),
      expect.objectContaining({
        value: 4294967295,
        label: "Observed readback as signed -1; visual alpha or reset behavior unverified",
      }),
    ]);

    expect(merged.commands.SetCueCaptionColor?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "observed",
          method: "controlledWriteReadback",
        }),
      ]),
    );
  });

  it("classifies grid, page, tab, cue, and universe command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of [
      "ClickFlash",
      "ClickRestart",
      "ClickSelect",
      "ClickSoloFlash",
      "ClickToggle",
      "ClickTrack",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["Grid.ClickMode", "Grid2.ClickMode"]);
    }

    for (const command of [
      "SelectNextPage",
      "SelectNextPageGrid1",
      "SelectNextTab",
      "SelectNextTabGrid1",
      "SelectPage",
      "SelectPageName",
      "SelectPrevPage",
      "SelectPrevPageGrid1",
      "SelectPrevTab",
      "SelectPrevTabGrid1",
      "SelectTab",
      "SelectTabName",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["Grid.PageIndex"]);
    }

    expect(merged.commands.SetCueCaptionColor?.setsProperty).toEqual(["WS.N.N.CaptionColor"]);
    expect(merged.commands.SetGridSize?.setsProperty).toEqual(["Grid.GetColCount", "Grid.GetRowCount", "Grid.Count"]);

    for (const command of [
      "ClickLive",
      "ClickTCTabMode",
      "CloseUmax",
      "CueDown",
      "CueUp",
      "GoGridMode",
      "GoPlayListMode",
      "GoTimelineMode",
      "GoUniverseMode",
      "GroupCue",
      "HoldClick",
      "MultiCue",
      "OneCue",
      "OnePer",
      "PasteToCue",
      "PauseCue",
      "RestartCue",
      "SelectAllCat",
      "SelectCat",
      "SelectCatName",
      "SelectCue",
      "SelectNextCat",
      "SelectNextCatGrid1",
      "SelectPrevCat",
      "SelectPrevCatGrid1",
      "SetActiveGrid",
      "SetGridView",
      "SetPage",
      "SetPlayListView",
      "SetTimelineView",
      "SetUCenterPage",
      "SetUEditPage",
      "SetUMaxPage",
      "SetUniverseView",
      "SetUPreviewPage",
      "SetURightPage",
      "SetUToolPage",
      "StartCue",
      "StartCueMulti",
      "StartPrevious",
      "StopCue",
      "ToggleCue",
      "ToggleCueMulti",
      "TogglePrevious",
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
      "UnselectAllCue",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships grid and click range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const gridColumns = findParam("SetGridSize", "SetGridSize <columns>, <rows>", "columns");
    const gridRows = findParam("SetGridSize", "SetGridSize <columns>, <rows>", "rows");
    const moveHorizontal = findParam("MoveFocus", "MoveFocus <horizontal>, <vertical>", "horizontal");
    const moveVertical = findParam("MoveFocus", "MoveFocus <horizontal>, <vertical>", "vertical");
    const shiftCells = findParam("ShiftFocus", "ShiftFocus <cells>", "cells");
    const selectCatIndex = findParam("SelectCat", "SelectCat <index>", "index");
    const holdState = findParam("HoldClick", "HoldClick <state>", "state");

    expect(gridColumns).toMatchObject({
      range: "1..16",
      valueRange: {
        min: 1,
        max: 16,
        unit: "columns",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(gridRows).toMatchObject({
      range: "1..16",
      valueRange: {
        min: 1,
        max: 16,
        unit: "rows",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(moveHorizontal).toMatchObject({
      range: "relative; result wraps modulo Grid.Count",
      valueRange: {
        unit: "columns",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(moveVertical).toMatchObject({
      range: "relative rows; result wraps modulo Grid.Count",
      valueRange: {
        unit: "rows",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(shiftCells).toMatchObject({
      range: "relative; result wraps modulo Grid.Count",
      valueRange: {
        unit: "cells",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(selectCatIndex).toMatchObject({
      range: "-1 or 1..category count; no readable category count property",
      valueRange: {
        min: 1,
        unit: "category index",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(selectCatIndex?.acceptedValues).toEqual([expect.objectContaining({ value: -1, label: "All categories" })]);
    expect(holdState).toMatchObject({
      range:
        "0..1 documented; representative writes sent for -1, 0, 1, 2, and 999 with no readable hold-state property",
      valueRange: {
        min: 0,
        max: 1,
        unit: "hold state",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(holdState?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "OFF" }),
      expect.objectContaining({ value: 1, label: "ON" }),
    ]);
  });

  it("classifies timeline, playlist, player, and transition command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.PlayListSetTime?.setsProperty).toEqual(["PlayListState.Position"]);
    expect(merged.commands.PlayListStop?.setsProperty).toEqual(["PlayListState.Playing"]);
    expect(merged.commands.TimelineEnableTC?.setsProperty).toEqual(["Master.TcInEnabled"]);
    expect(merged.commands.Transition?.setsProperty).toEqual(["Master.TransitionState"]);

    for (const command of ["LoadPlaylist", "TimelineAddMarker", "TimelineMarker", "TimelineQuickSave"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "InvertPlayersTime",
      "PlayListFirst",
      "PlayListLast",
      "PlayTimeline",
      "PlayersDisk",
      "PlayersDiskShift",
      "PlayersResetJump",
      "PlayersSetJump",
      "PlayersSetLoop",
      "RestorePlayer",
      "SetTransitionTime",
      "StopTimeline",
      "TimelineFirstTab",
      "TimelineJumpDelta",
      "TimelineJumpToEnd",
      "TimelineJumpToStart",
      "TimelineLastTab",
      "TimelineNextEditPoint",
      "TimelineNextMarker",
      "TimelineNextTab",
      "TimelinePlay",
      "TimelinePlayFromMarker",
      "TimelinePrevEditPoint",
      "TimelinePrevMarker",
      "TimelinePrevTab",
      "TimelineSetPos",
      "TimelineSetTabIndex",
      "TimelineSetTabName",
      "TimelineSetViewRange",
      "TimelineShiftViewRange",
      "TimelineShowItNow",
      "TimelineStop",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships timeline, playlist, and player position range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("PlayListSetTime", "PlayListSetTime <seconds>", "seconds")).toMatchObject({
      type: "number",
      range: ">=0 observed; negative clamps to 0; upper pass-through observed through 5000 with duration 3000",
      valueRange: {
        min: 0,
        unit: "seconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, signature, paramName, unit, range] of [
      [
        "TimelineSetPos",
        "TimelineSetPos <seconds>",
        "seconds",
        "seconds",
        "no readable range evidence; representative writes sent for -1, 0, 10, and 100000",
      ],
      [
        "TimelineJumpDelta",
        "TimelineJumpDelta <seconds>",
        "seconds",
        "seconds delta",
        "no readable range evidence; representative writes sent for -5, 1, and 100000",
      ],
      [
        "TimelineSetTabIndex",
        "TimelineSetTabIndex <index>",
        "index",
        "tab index",
        "no readable range evidence; representative writes sent for 0, 1, and 1000",
      ],
      [
        "TimelineShiftViewRange",
        "TimelineShiftViewRange <seconds>",
        "seconds",
        "seconds delta",
        "no readable range evidence; representative writes sent for -10, 10, and 100000",
      ],
      [
        "PlayersDiskShift",
        "PlayersDiskShift <positionDelta>",
        "positionDelta",
        "radians delta",
        "no readable range evidence; representative writes sent for -0.1, 0, and 0.1",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }

    for (const paramName of ["fromSeconds", "toSeconds"] as const) {
      expect(
        findParam("TimelineSetViewRange", "TimelineSetViewRange <fromSeconds>, <toSeconds>", paramName),
      ).toMatchObject({
        range: "no readable range evidence; representative writes sent for 0..30, 30..0, and 0..60",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("ships blocked player and blob-load range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const loadCuePage = findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "page");
    expect(loadCuePage).toMatchObject({
      range: "zero-based page index per BEYOND documentation; upper bound and PangoScript usability unverified",
      valueRange: {
        min: 0,
        unit: "blob target page index",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(loadCuePage?.valueRange).not.toHaveProperty("max");

    const loadCueCell = findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "cue");
    expect(loadCueCell).toMatchObject({
      range: "zero-based cue index per BEYOND documentation; upper bound and PangoScript usability unverified",
      valueRange: {
        min: 0,
        unit: "blob target cue index",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(loadCueCell?.valueRange).not.toHaveProperty("max");

    expect(findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "stream")).toMatchObject({
      type: "unknown",
      range: "binary stream argument; explicitly not supported by PangoScript",
    });

    for (const [commandName, paramName, type, unit, range] of [
      [
        "LoadZoneFromBlob",
        "param1",
        "integer",
        "internal blob-load selector",
        "undocumented HTTP/blob parameter; selector meaning and bounds unverified",
      ],
      [
        "LoadZoneFromBlob",
        "param2",
        "unknown",
        "internal blob-load argument",
        "undocumented HTTP/blob parameter; type and bounds unverified",
      ],
    ] as const) {
      const param = findParam(commandName, "LoadZoneFromBlob <param1>, <param2>", paramName);
      expect(param, `${commandName}.${paramName}`).toMatchObject({
        type,
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    for (const [paramName, unit, range] of [
      [
        "page",
        "captured player page index",
        "deprecated captured-state page index; indexing basis and bounds unverified",
      ],
      ["cue", "captured player cue index", "deprecated captured-state cue index; indexing basis and bounds unverified"],
      ["options", "restore option bit mask", "deprecated options bit mask; flag meanings and bounds unverified"],
      ["UserID", "caller ID", "deprecated caller ID; 0, 1, and out-of-range behavior unverified"],
      ["Clock", "seconds, likely", "deprecated captured clock value; units likely seconds; 0.0 and bounds unverified"],
      [
        "param7",
        "unknown restore parameter",
        "deprecated final numeric parameter; purpose, units, and bounds unverified",
      ],
    ] as const) {
      const param = findParam(
        "RestorePlayer",
        "RestorePlayer <page>, <cue>, <options>, <UserID>, <Routing>, <Clock>, <param7>",
        paramName,
      );
      expect(param, `RestorePlayer.${paramName}`).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    expect(
      findParam(
        "RestorePlayer",
        "RestorePlayer <page>, <cue>, <options>, <UserID>, <Routing>, <Clock>, <param7>",
        "Routing",
      ),
    ).toMatchObject({
      range: "deprecated routing token/string; accepted values unverified",
    });

    for (const commandName of ["LoadCueFromBlob", "LoadZoneFromBlob", "RestorePlayer"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            method: "operatorSupervised",
            expectedCallback: expect.stringContaining(
              "PangoLint lint acceptance and Talk UDP transmission are not range evidence",
            ),
          }),
        ]),
      );
    }
  });

  it("keeps private source labels out of merged command text", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const text = JSON.stringify(merged.commands).toLowerCase();

    expect(text).not.toContain("doc cache");
    expect(text).not.toContain("doc-cache");
    expect(text).not.toContain("local help doc");
    expect(text).not.toContain("help doc");
    expect(text).not.toContain("help-doc");
    expect(text).not.toContain("beyond commands doc");
  });

  it("classifies MIDI, DMX, OSC, trigger, and channel I/O command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.ChannelOut?.setsProperty).toEqual(["Channels.N.Value"]);
    expect(merged.commands.DmxOut?.setsProperty).toEqual(["DmxOutput.N"]);
    expect(merged.commands.DmxOutRange?.setsProperty).toEqual(["DmxOutput.N"]);
    expect(merged.commands.EnableDmxIn?.setsProperty).toEqual(["Master.DmxInEnabled"]);
    expect(merged.commands.SetButtonMSL?.setsProperty).toEqual(["MIDI1.ButtonMSL"]);
    expect(merged.commands.SetChannelToChannelRatio?.setsProperty).toEqual(["Master.ChannelToChannelRatio"]);
    expect(merged.commands.SetDmxToChannelRatio?.setsProperty).toEqual(["Master.DmxToChannelRatio"]);
    expect(merged.commands.SetEffectChannelAction?.setsProperty).toEqual(effectActionProps());
    expect(merged.commands.SetFFTToChannelRatio?.setsProperty).toEqual(["Master.FFTToChannelRatio"]);
    expect(merged.commands.SetGrid1MSL?.setsProperty).toEqual(["MIDI1.Grid1MSL"]);
    expect(merged.commands.SetGrid2MSL?.setsProperty).toEqual(["MIDI1.Grid2MSL"]);
    expect(merged.commands.SetMidiLayer?.setsProperty).toEqual(["MIDI1.Layer"]);
    expect(merged.commands.SetSliderMSL?.setsProperty).toEqual(["MIDI1.SliderMSL"]);
    expect(merged.commands.SetVdjToChannelRatio?.setsProperty).toEqual(["Master.VdjToChannelRatio"]);

    for (let index = 1; index <= 6; index += 1) {
      expect(merged.commands[`SetFX${index}MSL`]?.setsProperty).toEqual([`MIDI1.FX${index}MSL`]);
    }

    for (const command of ["Fb4DiscoveryMode", "RebootConnectedFB4", "StartFb4Discovery", "StopFb4Discovery"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "DecreaseTrigger",
      "DefineDmxTrigger",
      "DefineMidiTrigger",
      "DefineTcTrigger",
      "DefineTrigger",
      "DmxInMute",
      "EnableFb3StyleDmxIn",
      "InRangeTrigger",
      "InRangeTriggerCmd",
      "IncreaseTrigger",
      "LessThanTrigger",
      "MidiOut",
      "MidiOutLong",
      "MidiSysexAdd",
      "MidiSysexSend",
      "MidiSysexStart",
      "MoreThanTrigger",
      "OscOut",
      "OscOutTTS",
      "OutOfRangeTrigger",
      "OutOfRangeTriggerCmd",
      "RefreshDmxIn",
      "RegisterOscFeedback",
      "ResetMidiFeedback",
      "ResetOscFeedback",
      "SelectMidi",
      "SetDmxEditorChannel",
      "WaitForAudioBeat",
      "WaitForBeat",
      "WaitForCellDown",
      "WaitForCellUp",
      "WaitForChannel",
      "WaitForCueStart",
      "WaitForCueStop",
      "WaitForDmx",
      "WaitForEvent",
      "WaitForHotKey",
      "WaitForManualBeat",
      "WaitForMidi",
      "WaitForPageChange",
      "WaitForTC",
      "WaitForTime",
      "WaitForTimePos",
      "WaitForTimerBeat",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("classifies object animation, limiter, mesh, preview, and utility command property coverage", () => {
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "AnimateProp",
      "AnimatePropDelta",
      "DeletePropAni",
      "MasterSpeed",
      "MasterTransitionTime",
      "PreviewAsUninverse",
      "PreviewMaster",
      "PreviewNxN",
      "SetLimiterBeam",
      "SetLimiterDMX",
      "SetLimiterFlash",
      "SetLimiterHold",
      "SetLimiterPerGrid",
      "SetLimiterProfile",
      "SetLimiterShow",
      "VLJFX",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("classifies runtime, host, UI, logging, and remaining action command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.DisableLaserOutput?.setsProperty).toEqual(["Status.LaserEnabled"]);
    expect(merged.commands.EnableLaserOutput?.setsProperty).toEqual(["Status.LaserEnabled"]);
    expect(merged.commands.FocusCell?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.FocusCellIndex?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.LockScreen?.setsProperty).toEqual(["Status.Locked"]);
    expect(merged.commands.MoveFocus?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.SetLocation?.setsProperty).toEqual(["Location.N.X", "Location.N.Y", "Location.N.Z"]);
    expect(merged.commands.ShiftFocus?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.UnLockScreen?.setsProperty).toEqual(["Status.Locked"]);

    for (const command of [
      "ExitBEYOND",
      "LoadCue",
      "LoadCueFromBlob",
      "LoadWorkspace",
      "MakeSecuredFile",
      "RunApp",
      "ShutDownWindows",
      "StartAudioRecord",
      "StartQuickRecord",
    ]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "AddSms",
      "AudioBeat",
      "Autostart",
      "BeatResync",
      "BeatTap",
      "BlackOut",
      "CaptureToClipboard",
      "Chat",
      "ClickScrollA",
      "ClickScrollAniSpeed",
      "ClickScrollB",
      "ClickScrollBeamBrush",
      "ClickScrollColor",
      "ClickScrollFade",
      "ClickScrollG",
      "ClickScrollHue",
      "ClickScrollHueShift",
      "ClickScrollR",
      "ClickScrollSaturation",
      "ClickScrollScanRate",
      "ClickScrollSize",
      "ClickScrollVPoints",
      "ClickScrollZoom",
      "CodeColorMarker",
      "CodeName",
      "CodeShortcut",
      "DisplayPopup",
      "DisplayPopupOnTop",
      "DisplayPreview",
      "Echo",
      "ExecCmd",
      "Exit",
      "Hello",
      "HtmlBody",
      "HtmlClearBody",
      "HtmlClearHead",
      "HtmlHead",
      "HtmlHide",
      "HtmlUpdate",
      "LinePerCycle",
      "LogError",
      "LogInfo",
      "LogWarning",
      "ManualBeat",
      "MoboNotify",
      "Password",
      "Pub",
      "PubObject",
      "PulseEvent",
      "QLog",
      "ReStartCell",
      "Restart",
      "ResyncByCueClick",
      "SelectGrid",
      "SetRecordFile",
      "SetUiFPS",
      "ShowHint",
      "ShowItNowSMS",
      "ShowMasterHelpFile",
      "Sleep",
      "StartCell",
      "StartCode",
      "StartTalkClient",
      "StartTalkServer",
      "StopAllAsync",
      "StopAllNow",
      "StopAllSync",
      "StopAudioRecord",
      "StopCell",
      "StopCode",
      "StopCueNow",
      "StopCueSync",
      "StopCueType",
      "StopOnBlackout",
      "StopQuickRecord",
      "StopTalkClient",
      "StopTalkServer",
      "SubCmd",
      "SubJson",
      "SubProp",
      "TapByCueClick",
      "TimerBeat",
      "ToggleCell",
      "Version",
      "VirtualLJ",
      "Write",
      "WriteLn",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });
});
