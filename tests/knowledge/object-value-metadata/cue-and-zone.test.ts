import { describe, expect, it } from "vitest";
import {
  issue294WsCueEffectControlPaths,
  issue294WsNestedEffectControlPaths,
  issue294WsNestedEffectDeferredPaths,
  issue294WsSingleVariantStateDeferredPaths,
  issue294WsSingleVariantStatePaths,
  issue294WsStringControlPaths,
} from "../../fixtures/knowledge/objectMetadataPathGroups";
import {
  assertObjectPropertyReadbackMetadata,
  assertObjectPropertyValueMetadata,
  hasManualReadyValueMetadata,
  type ObjectPropertyReadbackMetadata,
  type ObjectPropertyValueMetadata,
  readJson,
} from "../readKnowledgeTestData";

describe("checked-in Object Tree cue and zone value metadata data", () => {
  it("ships issue 393 Live Control position alias ranges from routed command readback", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-393-livecontrol-position-aliases.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #393 confirmed ";
    const issue393 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const countsByRoot = new Map<string, number>();
    for (const entry of issue393) countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);

    expect(issue393).toHaveLength(39);
    expect(countsByRoot).toEqual(
      new Map([
        ["Master", 3],
        ["MasterLC", 3],
        ["ProTrack", 3],
        ["ProTrack1", 3],
        ["ProTrack2", 3],
        ["ProTrack3", 3],
        ["ProTrack4", 3],
        ["ProTrack5", 3],
        ["ProTrack6", 3],
        ["ProTrack7", 3],
        ["ProTrack8", 3],
        ["WS", 3],
        ["Zone", 3],
      ]),
    );
    expect(evidence.entries).toHaveLength(90);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const path of [
      "Master.PosX",
      "MasterLC.PosY",
      "Zone.N.PosZ",
      "ProTrack.N.PosX",
      "ProTrack8.PosZ",
      "WS.N.N.PosY",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("WS.N.N.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("Zone.N.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });

    for (const path of [
      "Master.SatShift",
      "Master.VisiblePointsEnd",
      "MasterLC.SatShift",
      "ProTrack.N.SatShift",
      "WS.N.N.SatShift",
      "ZoneAlias.PosX",
      "ActGridFocusedCue.PosX",
      "Grid1FocusedCue.PosX",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });

  it("ships issue 216 Master leftover write/readback coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const valueOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/master/leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/master/leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min?: number;
          max?: number;
          unit?: string;
          minInclusive?: boolean;
          maxInclusive?: boolean;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-master-leftovers.json");

    const expectedValuePaths = new Set(["Master.LCScrollSpeed", "Master.ShowSpeed", "Master.TimecodeShift"]);
    const expectedReadbackPaths = new Set([
      "Master.CueUnPauseTime",
      "Master.FX7",
      "Master.FX8",
      "Master.MasterBrightness",
      "Master.SatShift",
      "Master.VisiblePointsEnd",
      "Master.VisiblePointsStart",
    ]);
    const expectedPaths = new Set([...expectedValuePaths, ...expectedReadbackPaths]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackPaths);
    expect(evidence.entries).toHaveLength(10);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of valueOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        boundaryBehavior: "pass-through",
      });
      expect(entry?.valueMetadata?.valueType, metadata.path).toBe(row?.valueType);
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.some((testedValue) => testedValue.behavior === "pass-through"),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata?.valueRange?.min, metadata.path).toBe(row?.valueRange?.min);
      expect(entry?.valueMetadata?.valueRange?.max, metadata.path).toBe(row?.valueRange?.max);
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata), metadata.path).toBe(
        true,
      );
    }

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Master.CueUnPauseTime")?.readbackMetadata).toMatchObject({
      valueType: "float",
      observedValue: 0,
    });
    expect(byPath.get("Master.FX7")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(byPath.get("Master.MasterBrightness")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(byPath.get("Master.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });

    const masterGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Master" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(masterGaps).toHaveLength(0);
  });

  it("ships manual-ready cue and player object-property ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issueRoots = new Set([
      "ActGridFocusedCue",
      "Grid1FocusedCue",
      "Grid2FocusedCue",
      "WS",
      "ProTrack",
      "ProTrack1",
    ]);
    const directCuePlayer = objectPropertyIndex.entries.filter(
      (entry) =>
        issueRoots.has(entry.root) &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directCuePlayer.map((entry) => entry.path).sort()).toEqual(
      [
        "ActGridFocusedCue.Brightness",
        "ActGridFocusedCue.SizeX",
        "ActGridFocusedCue.Zoom",
        "Grid1FocusedCue.Brightness",
        "Grid1FocusedCue.SizeX",
        "Grid1FocusedCue.Zoom",
        "Grid2FocusedCue.Brightness",
        "Grid2FocusedCue.SizeX",
        "Grid2FocusedCue.Zoom",
        "ProTrack.N.Brightness",
        "ProTrack.N.Mute",
        "ProTrack.N.Selected",
        "ProTrack.N.SizeX",
        "ProTrack.N.Solo",
        "ProTrack.N.Zoom",
        "ProTrack1.Brightness",
        "ProTrack1.Mute",
        "ProTrack1.Selected",
        "ProTrack1.SizeX",
        "ProTrack1.Solo",
        "ProTrack1.Zoom",
        "WS.N.N.Brightness",
        "WS.N.N.SizeX",
        "WS.N.N.Zoom",
      ].sort(),
    );
    for (const entry of directCuePlayer) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
    }

    expect(byPath.get("WS.N.N.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      },
    });
    expect(byPath.get("WS.N.N.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Zoom")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    const readbackOnly = objectPropertyIndex.entries.filter(
      (entry) =>
        issueRoots.has(entry.root) && entry.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12"),
    );
    expect(readbackOnly).toEqual([]);
    for (const path of ["WS.N.N.Caption", "WS.N.N.Effect.Name", "WS.N.N.FX1", "WS.N.N.Image.Text"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12") ?? false).toBe(
        false,
      );
    }
  });

  it("ships issue 294 WS cue-type common control ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            !entry.path.startsWith("WS.N.N.Image.") &&
            !issue294WsCueEffectControlPaths.has(entry.path) &&
            !issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294).toHaveLength(1746);
    expect(new Set(issue294.map((entry) => entry.path)).size).toBe(97);
    expect(new Set(issue294.map((entry) => entry.metadata.contextId)).size).toBe(18);

    for (const entry of issue294) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.FX1")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(
      byPath
        .get("WS.N.N.FX1Mute")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.PositionX")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });

    for (const path of [
      "WS.N.N.ColorSlider",
      "WS.N.N.Hue",
      "WS.N.N.PosX",
      "WS.N.N.RotoAccX",
      "WS.N.N.SatShift",
      "WS.N.N.VisiblePointsEnd",
      "WS.N.N.VisiblePointsStart",
    ]) {
      expect(
        byPath
          .get(path)
          ?.contextValueMetadata?.some((metadata) =>
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
          ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS cue effect controls as cue-type context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Effect = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsCueEffectControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const countsByPath = new Map<string, number>();
    for (const entry of issue294Effect) countsByPath.set(entry.path, (countsByPath.get(entry.path) ?? 0) + 1);

    expect(issue294Effect).toHaveLength(144);
    expect(countsByPath).toEqual(new Map([...issue294WsCueEffectControlPaths].map((path) => [path, 18])));
    expect(new Set(issue294Effect.map((entry) => entry.metadata.contextId)).size).toBe(18);

    for (const entry of issue294Effect) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.ClickMode")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ChasePeriod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ClockShift")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ChaseTimeMode")
        ?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        ),
    ).not.toBe(true);
  });

  it("ships issue 294 WS Parametric Image effect ranges as shape context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Parametric = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            entry.path.startsWith("WS.N.N.Image.") &&
            !issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294Parametric).toHaveLength(192);
    expect(new Set(issue294Parametric.map((entry) => entry.path)).size).toBe(6);
    expect(new Set(issue294Parametric.map((entry) => entry.metadata.contextId)).size).toBe(32);

    for (const entry of issue294Parametric) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.Effect.ClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.ClockShift")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });

    for (const path of [
      "WS.N.N.Image.Brightness",
      "WS.N.N.Image.PointCount",
      "WS.N.N.Image.Effect.Zone",
      "WS.N.N.Image.Effect.ZoneMode",
    ]) {
      expect(
        byPath
          .get(path)
          ?.contextValueMetadata?.some((metadata) =>
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
          ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS single-variant state ranges only for completed probe paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294State = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsSingleVariantStatePaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294State).toHaveLength(23);
    expect(new Set(issue294State.map((entry) => entry.path))).toEqual(issue294WsSingleVariantStatePaths);
    expect(new Set(issue294State.map((entry) => entry.metadata.contextId))).toEqual(
      new Set(["cue-type:shape", "cue-type:text", "cue-type:synthesized-image"]),
    );

    for (const entry of issue294State) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata), entry.path).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      if (entry.path.endsWith("BeamRepeat")) {
        expect(entry.metadata.valueRange?.boundaryBehavior).toBe("unknown");
      } else {
        expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      }
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.BeamConnect")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.Image.FftMode")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 6,
        unit: "FFT mode",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.Loops")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 16,
        unit: "loop count",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.BeamRepeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 2,
        max: 200,
        unit: "beam repeat count",
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.BeamRepeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 2,
        max: 200,
        unit: "beam repeat count",
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.PointCount")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 1000,
        unit: "point count",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of issue294WsSingleVariantStateDeferredPaths) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.includes("2026-05-14 issue #294"), path).not.toBe(true);
      expect(
        entry?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS image leftover ranges only for direct clamp evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-leftover-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.Image.BeamSpeed", { contextId: "cue-type:shape", valueType: "number", min: -360, max: 360 }],
      ["WS.N.N.Image.CharAlignX", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 4 }],
      ["WS.N.N.Image.CharAlignY", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 4 }],
      ["WS.N.N.Image.CharEffDelay", { contextId: "cue-type:text", valueType: "number", min: -10, max: 10 }],
      ["WS.N.N.Image.GlobalCharTime", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 1 }],
      [
        "WS.N.N.Image.LIST.0.Image.BeamSpeed",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -360, max: 360 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorX",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorY",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorZ",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.RecordInterval",
        { contextId: "cue-type:synthesized-image", valueType: "integer", min: 5, max: 500 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedX",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedY",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedZ",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      ["WS.N.N.Image.RangeScale", { contextId: "cue-type:text", valueType: "integer", min: 1, max: 2 }],
      ["WS.N.N.Image.ScaleX", { contextId: "cue-type:text", valueType: "number", min: 1, max: 200 }],
      ["WS.N.N.Image.ScaleY", { contextId: "cue-type:text", valueType: "number", min: 1, max: 200 }],
      ["WS.N.N.Image.ScrollSpeedX", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.ScrollSpeedY", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.ScrollSpeedZ", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.VertOffset", { contextId: "cue-type:text", valueType: "number", min: -50, max: 50 }],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadata = byPath
        .get(path)
        ?.contextValueMetadata?.find((candidate) => candidate.contextId === range.contextId);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of [
      "WS.N.N.Image.0.FreqX1",
      "WS.N.N.Image.BounceMaxX",
      "WS.N.N.Image.LIST.0.AngleX",
      "WS.N.N.Image.MultiLaser",
      "WS.N.N.Image.Turns(%)",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS leftover size and boolean controls as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
      }>;
    }>("object-range-evidence/issue-294-ws-leftover-size-boolean-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 size/boolean confirmed ";
    const expectedRanges = new Map([
      [
        "WS.N.N.Image.0.SizeX1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeX2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeX3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
    ]);
    const expectedBooleans = new Map([
      ["WS.N.N.Image.BounceMaxX", "cue-type:particles"],
      ["WS.N.N.Image.BounceMaxY", "cue-type:particles"],
      ["WS.N.N.Image.BounceMaxZ", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinX", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinY", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinZ", "cue-type:particles"],
      ["WS.N.N.Ani.0.tsStretchGrouping", "cue-type:object-animator"],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size + expectedBooleans.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size + expectedBooleans.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.filter((entry) => entry.boundaryBehavior === "clamp")).toHaveLength(expectedRanges.size);
    expect(evidence.entries.filter((entry) => entry.boundaryBehavior === "unknown")).toHaveLength(
      expectedBooleans.size,
    );

    for (const [path, range] of expectedRanges) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find((candidate) => candidate.contextId === range.contextId);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const [path, contextId] of expectedBooleans) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find((candidate) => candidate.contextId === contextId);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("boolean");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata?.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of ["WS.N.N.Image.0.FreqX1", "WS.N.N.Image.MultiLaser", "WS.N.N.Ani.0.MaxValue"]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS Classic LD2000 Abstract frequency ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-abstract-frequency-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 frequency confirmed ";
    const expectedPaths = [
      "WS.N.N.Image.0.FreqColor",
      "WS.N.N.Image.0.FreqMOD1",
      "WS.N.N.Image.0.FreqMOD2",
      "WS.N.N.Image.0.FreqX1",
      "WS.N.N.Image.0.FreqX2",
      "WS.N.N.Image.0.FreqX3",
      "WS.N.N.Image.0.FreqY1",
      "WS.N.N.Image.0.FreqY2",
      "WS.N.N.Image.0.FreqY3",
      "WS.N.N.Image.0.FreqZ1",
      "WS.N.N.Image.0.FreqZ2",
      "WS.N.N.Image.0.FreqZ3",
    ];
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedPaths.length);
    expect(evidence.entries).toHaveLength(expectedPaths.length);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const path of expectedPaths) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find(
        (candidate) =>
          candidate.contextId === "cue-type:classic-ld2000-abstract" && candidate.notes?.startsWith(issuePrefix),
      );
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("number");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1200,
        unit: "abstract frequency",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of ["WS.N.N.Image.PlayLoopCount", "WS.N.N.Image.StaticDisplayTime"]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS image multivariant ranges only for completed contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-multivariant-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 multivariant confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.Image.Count", { contextId: "cue-type:particles", valueType: "integer", min: 1, max: 200 }],
      ["WS.N.N.Image.CursorX", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.CursorY", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.CursorZ", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.Loops", { contextId: "cue-type:shape", valueType: "integer", min: 1, max: 16 }],
      ["WS.N.N.Image.RecordInterval", { contextId: "cue-type:shape", valueType: "integer", min: 5, max: 500 }],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadata = byPath
        .get(path)
        ?.contextValueMetadata?.find(
          (candidate) => candidate.contextId === range.contextId && candidate.notes?.startsWith(issuePrefix),
        );
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of [
      "WS.N.N.Image.CenterX",
      "WS.N.N.Image.Color",
      "WS.N.N.Image.Point/Line",
      "WS.N.N.Image.Size(%)",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS image point count contexts only for completed bounds", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-pointcount-context-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 point-count contexts confirmed ";
    const expectedRanges = [
      {
        path: "WS.N.N.Image.PointCount",
        contextId: "cue-type:shape",
        valueType: "integer",
        min: 1,
        max: 1000,
      },
      {
        path: "WS.N.N.Image.PointCount",
        contextId: "cue-type:particles",
        valueType: "integer",
        min: 1,
        max: 200,
      },
    ];
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.length);
    expect(evidence.entries).toHaveLength(expectedRanges.length);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(new Set(evidence.entries.map((entry) => entry.probePath))).toEqual(
      new Set(["WS.0.3.Image.PointCount", "WS.0.10.Image.PointCount"]),
    );

    for (const range of expectedRanges) {
      const metadata = byPath
        .get(range.path)
        ?.contextValueMetadata?.find(
          (candidate) => candidate.contextId === range.contextId && candidate.notes?.startsWith(issuePrefix),
        );
      expect(metadata, `${range.path} ${range.contextId}`).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), range.contextId).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const contextId of ["cue-type:fifo-image", "cue-shape:parametric-image:wave"]) {
      expect(
        byPath
          .get("WS.N.N.Image.PointCount")
          ?.contextValueMetadata?.some(
            (metadata) => metadata.contextId === contextId && metadata.notes?.startsWith(issuePrefix),
          ) ?? false,
        contextId,
      ).toBe(false);
    }

    for (const path of [
      "WS.N.N.Image.Anchors",
      "WS.N.N.Image.Lines",
      "WS.N.N.Image.Points",
      "WS.N.N.Image.SizeX",
      "WS.N.N.Image.SizeY",
      "WS.N.N.Image.StartAngle",
      "WS.N.N.Image.Brightness",
      "WS.N.N.Image.Effect.Zone",
      "WS.N.N.Image.Effect.ZoneMode",
      "WS.N.N.Image.Hue",
      "WS.N.N.Image.Saturation",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 362 WS boolean accepted values only for verified contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
        locationContext?: { concreteContext?: string };
      }>;
    }>("object-range-evidence/issue-362-ws-boolean-accepted-values.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #362 confirmed ";
    const expectedContexts = new Map([
      ["WS.N.N.Ani.0.Muted", "cue-type:object-animator"],
      ["WS.N.N.Ani.0.PreventReroute", "cue-type:object-animator"],
      ["WS.N.N.Ani.0.Solo", "cue-type:object-animator"],
      ["WS.N.N.Image.AutoRecord", "cue-type:fifo-image"],
      ["WS.N.N.Image.EnableRecord", "cue-type:fifo-image"],
    ]);
    const issue362 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue362).toHaveLength(5);
    expect(new Set(issue362.map((entry) => entry.path))).toEqual(new Set(expectedContexts.keys()));
    expect(evidence.entries).toHaveLength(5);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "unknown")).toBe(true);
    expect(
      evidence.entries.every((entry) =>
        [0, 1].every((value) => entry.acceptedValues?.some((acceptedValue) => acceptedValue.value === value)),
      ),
    ).toBe(true);

    for (const [path, contextId] of expectedContexts) {
      const metadata = byPath.get(path)?.contextValueMetadata?.find((candidate) => candidate.contextId === contextId);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("boolean");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata?.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
      });
    }
  });

  it("ships issue 294 WS scalar controls only for verified top-level cue contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-scalar-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp write/readback on 2026-05-14 issue #294 confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.ColorSlider", { valueType: "integer", min: 0, max: 255, unit: "8-bit channel" }],
      ["WS.N.N.Hue", { valueType: "number", min: -1, max: 720, unit: "degrees" }],
      ["WS.N.N.RotoAccX", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
      ["WS.N.N.RotoAccY", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
      ["WS.N.N.RotoAccZ", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
    ]);
    const issue294Scalar = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294Scalar).toHaveLength(90);
    expect(evidence.entries).toHaveLength(90);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadataRows = issue294Scalar.filter((entry) => entry.path === path);
      expect(metadataRows, path).toHaveLength(18);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
      for (const { metadata } of metadataRows) {
        assertObjectPropertyValueMetadata(metadata);
        expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
        expect(metadata.evidenceLevel).toBe("observed");
        expect(metadata.valueType).toBe(range.valueType);
        expect(metadata.valueRange).toMatchObject({
          min: range.min,
          max: range.max,
          unit: range.unit,
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        });
        expect(metadata.locationContext).toMatchObject({
          kind: "workspace-slot",
          populationDependent: true,
        });
      }
    }

    for (const path of ["WS.N.N.SatShift", "WS.N.N.VisiblePointsEnd", "WS.N.N.FX7"]) {
      const issueMetadata = byPath
        .get(path)
        ?.contextValueMetadata?.filter((metadata) => metadata.notes?.startsWith(issuePrefix));
      expect(issueMetadata ?? [], path).toHaveLength(0);
    }
  });

  it("ships issue 294 WS nested effect controls only for completed probe paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294NestedEffect = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsNestedEffectControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294NestedEffect).toHaveLength(8);
    expect(new Set(issue294NestedEffect.map((entry) => entry.path))).toEqual(issue294WsNestedEffectControlPaths);
    expect(new Set(issue294NestedEffect.map((entry) => entry.metadata.contextId))).toEqual(
      new Set(["cue-type:parametric-image", "cue-type:synthesized-image"]),
    );

    for (const entry of issue294NestedEffect) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata), entry.path).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.Effect.ChasePeriod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:parametric-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });

    for (const path of issue294WsNestedEffectDeferredPaths) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.includes("2026-05-14 issue #294"), path).not.toBe(true);
      expect(
        entry?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS string ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Strings = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const countsByPath = new Map<string, number>();
    for (const entry of issue294Strings) countsByPath.set(entry.path, (countsByPath.get(entry.path) ?? 0) + 1);

    expect(issue294Strings).toHaveLength(69);
    expect(countsByPath).toEqual(
      new Map([
        ["WS.N.N.Caption", 18],
        ["WS.N.N.Effect.Name", 18],
        ["WS.N.N.Image.Effect.Name", 32],
        ["WS.N.N.Image.LIST.0.Effect.Name", 1],
      ]),
    );

    for (const entry of issue294Strings) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueType).toBe("string");
      expect(entry.metadata.valueRange).toMatchObject({
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      });
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Caption")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.Name")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Effect.Name")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
  });

  it("ships issue 293 ProTrack common ranges without sibling or focused-cue propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #293 confirmed "),
    );

    expect(issue293).toHaveLength(218);
    expect(issue293.filter((entry) => entry.root === "ProTrack")).toHaveLength(109);
    expect(issue293.filter((entry) => entry.root === "ProTrack1")).toHaveLength(109);
    expect(issue293.filter((entry) => entry.root.endsWith("FocusedCue"))).toHaveLength(0);

    for (const entry of issue293) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }
    for (const entry of issue293.filter((entry) => entry.root === "ProTrack")) {
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "ProTrack.N uses the zero-based Object Tree track index.",
      });
    }
    for (const entry of issue293.filter((entry) => entry.root === "ProTrack1")) {
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("ProTrack.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("ProTrack1.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    for (const path of ["ProTrack.N.FX1Mute", "ProTrack1.FX1Mute"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
      });
    }
    expect(byPath.get("ProTrack.N.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("ProTrack1.Param12")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "parameter flag",
      },
    });
    expect(byPath.get("ProTrack.N.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("ProTrack1.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("ProTrack.N.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
      },
    });
    expect(byPath.get("ProTrack1.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack.N.VisiblePointStart")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ProTrack.N.FX7",
      "ProTrack.N.FX8",
      "ProTrack.N.SatShift",
      "ProTrack.N.VisiblePointsEnd",
      "ProTrack.N.VisiblePointsStart",
      "ProTrack1.FX7",
      "ProTrack1.FX8",
      "ProTrack1.SatShift",
      "ProTrack1.VisiblePointsEnd",
      "ProTrack1.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 293 ProTrack2 through ProTrack8 ranges without focused-cue propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293ProTrack28 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(
        "Runtime object write/readback on 2026-05-13 issue #293 ProTrack2-8 confirmed ",
      ),
    );

    expect(issue293ProTrack28).toHaveLength(805);
    for (const root of ["ProTrack2", "ProTrack3", "ProTrack4", "ProTrack5", "ProTrack6", "ProTrack7", "ProTrack8"]) {
      expect(
        issue293ProTrack28.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(115);
    }
    expect(issue293ProTrack28.filter((entry) => entry.root.endsWith("FocusedCue"))).toHaveLength(0);
    for (const entry of issue293ProTrack28) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("ProTrack2.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack8.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("ProTrack3.Param12")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "parameter flag",
      },
    });
    expect(byPath.get("ProTrack4.Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("ProTrack5.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack6.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("ProTrack7.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
      },
    });
    expect(byPath.get("ProTrack8.Zoom")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ProTrack2.FX7",
      "ProTrack8.FX8",
      "ProTrack6.SatShift",
      "ProTrack7.VisiblePointsEnd",
      "ProTrack8.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 348 remaining ProTrack controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-348-protrack-remaining-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #348 confirmed ";
    const issue348 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedRoots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];

    expect(issue348).toHaveLength(45);
    for (const root of expectedRoots) {
      expect(
        issue348.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(5);
    }
    expect(evidence.entries).toHaveLength(153);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(45);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(108);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue348) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("ProTrack.N.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack8.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "ProTrack.N.Caption",
      "ProTrack.N.FX7",
      "ProTrack3.SatShift",
      "ProTrack4.VisiblePointsEnd",
      "ProTrack5.VisiblePointsStart",
      "ProTrack6.Zones",
      "ProTrack8.FX8",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(byPath.get("ProTrack2.PosX")?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false).toBe(false);
  });

  it("ships issue 373 ProTrack cue and preset index metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #373 confirmed ";
    const issue373 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedRoots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];

    expect(issue373).toHaveLength(18);
    for (const root of expectedRoots) {
      expect(
        issue373.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(2);
    }

    for (const entry of issue373) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.acceptedValues).toEqual([
        expect.objectContaining({
          value: -1,
          label: "DISABLED",
        }),
      ]);
    }

    expect(byPath.get("ProTrack.N.CueIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        dynamicMax: {
          expression: "Grid.Count - 1",
          sourcePaths: ["Grid.Count"],
        },
        unit: "cue index",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack8.CueIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        dynamicMax: {
          expression: "Grid.Count - 1",
          sourcePaths: ["Grid.Count"],
        },
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.PresetIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "preset index",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ProTrack.N.Caption")?.valueMetadata, "Caption remains a no-op string gap").toBeUndefined();
    expect(byPath.get("ProTrack2.SatShift")?.valueMetadata, "SatShift remains a no-op gap").toBeUndefined();
  });

  it("ships issue 216 ProTrack leftover readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/protrack/leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-protrack-leftovers.json");

    const roots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];
    const properties = ["Caption", "FX7", "FX8", "SatShift", "VisiblePointsEnd", "VisiblePointsStart", "Zones"];
    const expectedPaths = new Set(
      roots.flatMap((root) =>
        properties.map((property) => (root === "ProTrack" ? `ProTrack.N.${property}` : `${root}.${property}`)),
      ),
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(readbackOverlay.entries).toHaveLength(63);
    expect(evidence.entries).toHaveLength(63);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      if (metadata.path.endsWith(".Caption")) {
        expect(testedInputs, metadata.path).toEqual(expect.arrayContaining([0, 1, 32, 254, 255]));
      } else {
        expect(testedInputs, metadata.path).toEqual(
          expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
        );
      }
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("ProTrack.N.Caption")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "ProTrack.N uses the zero-based Object Tree ProTrack index.",
      },
    });
    expect(byPath.get("ProTrack.N.FX7")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(byPath.get("ProTrack1.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ProTrack1 is a direct ProTrack alias in the loaded show.",
      },
    });
    expect(byPath.get("ProTrack8.Zones")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(evidenceByPath.get("ProTrack.N.Caption")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "ProTrack.0",
    });
    expect(evidenceByPath.get("ProTrack8.Caption")?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
      concreteContext: "ProTrack8",
    });

    for (const root of roots) {
      const gaps = objectPropertyIndex.entries.filter(
        (entry) =>
          entry.root === root && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
      );
      expect(gaps, root).toHaveLength(0);
    }
  });

  it("ships issue 293 focused-cue ranges only on directly probed aliases", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293FocusedCue = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(
        "Runtime object write/readback on 2026-05-13 issue #293 focused-cue confirmed ",
      ),
    );

    expect(issue293FocusedCue).toHaveLength(291);
    for (const root of ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"]) {
      expect(
        issue293FocusedCue.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(97);
    }
    for (const entry of issue293FocusedCue) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("ActGridFocusedCue.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("Grid1FocusedCue.FX8Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Grid2FocusedCue.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("Grid1FocusedCue.PositionZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ActGridFocusedCue.VisiblePointStart")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ActGridFocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "ActGridFocusedCue.PosX",
      "Grid2FocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(
      byPath
        .get("WS.N.N.FX1")
        ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #293 confirmed ") ??
        false,
      "WS.N.N.FX1",
    ).toBe(false);
  });

  it("ships issue 328 focused-cue effect control ranges only for completed write-readback paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #328 confirmed ";
    const focusedCueRoots = ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"];
    const issue328FocusedCue = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(issuePrefix),
    );

    expect(issue328FocusedCue).toHaveLength(27);
    for (const root of focusedCueRoots) {
      expect(
        issue328FocusedCue.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(9);
    }
    for (const entry of issue328FocusedCue) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    const expectedSuffixes = [
      "CaptionColor",
      "ClickMode",
      "Effect.ChasePeriod",
      "Effect.ClockLimit",
      "Effect.ClockShift",
      "Effect.EnableClockLimit",
      "Effect.EnableMetroLimit",
      "Effect.MetroLimit",
      "Effect.MetroShift",
    ];
    const expectedPaths = new Set(
      focusedCueRoots.flatMap((root) => expectedSuffixes.map((suffix) => `${root}.${suffix}`)),
    );
    expect(new Set(issue328FocusedCue.map((entry) => entry.path))).toEqual(expectedPaths);

    expect(byPath.get("ActGridFocusedCue.CaptionColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "caption color integer",
      },
    });
    expect(byPath.get("Grid1FocusedCue.ClickMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Effect.ClockLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Grid1FocusedCue.Effect.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Grid1FocusedCue.Effect.MetroLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.MetroShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });

    for (const root of focusedCueRoots) {
      for (const suffix of ["Effect.ChaseTimeMode", "Effect.Zone", "Effect.ZoneMode"]) {
        const path = `${root}.${suffix}`;
        expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
        expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
      }
      for (const suffix of ["ContainStartScript", "ContainEndScript", "CueType"]) {
        const path = `${root}.${suffix}`;
        expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      }
    }
  });

  it("ships issue 350 focused-cue remaining controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-350-focused-cue-remaining-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #350 confirmed ";
    const focusedCueRoots = ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"];
    const issue350 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue350).toHaveLength(15);
    for (const root of focusedCueRoots) {
      expect(
        issue350.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(5);
    }
    expect(evidence.entries).toHaveLength(57);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(15);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(42);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.objectPath === entry.probePath)).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue350) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("ActGridFocusedCue.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("Grid1FocusedCue.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("Grid2FocusedCue.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "ActGridFocusedCue.ContainStartScript",
      "ActGridFocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "Grid2FocusedCue.PosX",
      "Grid2FocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 216 ActGridFocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/act-grid-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-act-grid-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "ActGridFocusedCue.ContainEndScript",
      "ActGridFocusedCue.ContainStartScript",
      "ActGridFocusedCue.CueType",
      "ActGridFocusedCue.Effect.ChaseTimeMode",
      "ActGridFocusedCue.Effect.Zone",
      "ActGridFocusedCue.Effect.ZoneMode",
      "ActGridFocusedCue.FX7",
      "ActGridFocusedCue.FX8",
      "ActGridFocusedCue.PosX",
      "ActGridFocusedCue.PosY",
      "ActGridFocusedCue.PosZ",
      "ActGridFocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "ActGridFocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("ActGridFocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("ActGridFocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("ActGridFocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("ActGridFocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("ActGridFocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const actGridFocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "ActGridFocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(actGridFocusedCueGaps).toHaveLength(0);
  });

  it("ships issue 216 Grid1FocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/grid1-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-grid1-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "Grid1FocusedCue.ContainEndScript",
      "Grid1FocusedCue.ContainStartScript",
      "Grid1FocusedCue.CueType",
      "Grid1FocusedCue.Effect.ChaseTimeMode",
      "Grid1FocusedCue.Effect.Zone",
      "Grid1FocusedCue.Effect.ZoneMode",
      "Grid1FocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "Grid1FocusedCue.PosX",
      "Grid1FocusedCue.PosY",
      "Grid1FocusedCue.PosZ",
      "Grid1FocusedCue.SatShift",
      "Grid1FocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Grid1FocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("Grid1FocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("Grid1FocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("Grid1FocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("Grid1FocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const grid1FocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Grid1FocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(grid1FocusedCueGaps).toHaveLength(0);
  });

  it("ships issue 216 Grid2FocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/grid2-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-grid2-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "Grid2FocusedCue.ContainEndScript",
      "Grid2FocusedCue.ContainStartScript",
      "Grid2FocusedCue.CueType",
      "Grid2FocusedCue.Effect.ChaseTimeMode",
      "Grid2FocusedCue.Effect.Zone",
      "Grid2FocusedCue.Effect.ZoneMode",
      "Grid2FocusedCue.FX7",
      "Grid2FocusedCue.FX8",
      "Grid2FocusedCue.PosX",
      "Grid2FocusedCue.PosY",
      "Grid2FocusedCue.PosZ",
      "Grid2FocusedCue.SatShift",
      "Grid2FocusedCue.VisiblePointsEnd",
      "Grid2FocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Grid2FocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("Grid2FocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("Grid2FocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("Grid2FocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("Grid2FocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const grid2FocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Grid2FocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(grid2FocusedCueGaps).toHaveLength(0);
  });

  it("ships directly observed Zone object-property ranges without alias propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directZone = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Zone" && entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );
    const zoneAliasWithMetadata = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "ZoneAlias" &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directZone).toHaveLength(22);
    expect(zoneAliasWithMetadata).toHaveLength(0);
    for (const entry of directZone) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.Red")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("Zone.N.Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("ZoneAlias.Brightness")
        ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12") ?? false,
    ).toBe(false);
  });

  it("ships issue 292 Zone effect and transform ranges without ZoneAlias propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue292 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #292"),
    );

    expect(issue292).toHaveLength(88);
    expect(issue292.filter((entry) => entry.root === "Zone")).toHaveLength(88);
    expect(issue292.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(0);
    for (const entry of issue292) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.FX1Action")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "action value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.FX1Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Zone.N.FX1TimeScaleClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
      },
    });
    expect(byPath.get("Zone.N.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("Zone.N.Pan")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("Zone.N.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("Zone.N.RotoAngleY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -2880,
        max: 2880,
        unit: "degrees",
      },
    });
    expect(byPath.get("Zone.N.RotoSpeedY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1440,
        max: 1440,
        unit: "rotation speed",
      },
    });
    expect(byPath.get("Zone.N.Mesh.IndexX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "mesh index",
      },
    });
    expect(byPath.get("Zone.N.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("Zone.N.TestFrame")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 2,
        unit: "test frame",
      },
    });

    for (const path of ["Zone.N.FX7", "Zone.N.FX8"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }

    for (const path of ["ZoneAlias.FX1", "ZoneAlias.Pan", "ZoneAlias.RGBColor"]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #292") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 331 Zone effect controls only for completed Zone.0 write-readback paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #331 confirmed ";
    const issue331 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.Effect.ChasePeriod",
      "Zone.N.Effect.ClockLimit",
      "Zone.N.Effect.ClockShift",
      "Zone.N.Effect.EnableClockLimit",
      "Zone.N.Effect.EnableMetroLimit",
      "Zone.N.Effect.MetroLimit",
      "Zone.N.Effect.MetroShift",
    ]);

    expect(issue331).toHaveLength(7);
    expect(new Set(issue331.map((entry) => entry.path))).toEqual(expectedPaths);
    for (const entry of issue331) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("Zone.N.Effect.ClockLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Zone.N.Effect.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("Zone.N.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.MetroLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Zone.N.Effect.MetroShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });

    for (const path of ["Zone.N.Effect.ChaseTimeMode", "Zone.N.Effect.Zone", "Zone.N.Effect.ZoneMode"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 340 Zone nested effect controls only for completed Zone.0 Effect.0 paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const timeBoundaryEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        testedValues: Array<{ input: number; readback: number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-340-zone-nested-time-boundary-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue340 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.includes(" issue #340 confirmed "),
    );
    const expectedPaths = new Set([
      "Zone.N.Effect.N.Enabled",
      "Zone.N.Effect.N.RouterMode",
      "Zone.N.Effect.N.TimeActive",
      "Zone.N.Effect.N.TimeClock",
      "Zone.N.Effect.N.TimeDuration",
      "Zone.N.Effect.N.TimeDurationInBeat",
      "Zone.N.Effect.N.TimeEnabled",
      "Zone.N.Effect.N.TimeMetro",
    ]);

    expect(issue340).toHaveLength(8);
    expect(new Set(issue340.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(timeBoundaryEvidence.entries).toHaveLength(3);
    expect(timeBoundaryEvidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(timeBoundaryEvidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    for (const entry of timeBoundaryEvidence.entries) {
      expect(entry.testedValues).toContainEqual(expect.objectContaining({ input: -1, readback: 0, behavior: "clamp" }));
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 1000001, readback: 1000000, behavior: "clamp" }),
      );
    }
    for (const entry of issue340) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index, and Effect.N uses the zone effect slot index.",
      });
    }

    expect(byPath.get("Zone.N.Effect.N.RouterMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeEnabled")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1000000,
        unit: "clock value",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeDuration")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0,
        max: 1000000,
        unit: "time duration",
      },
    });

    for (const path of [
      "Zone.N.Effect.N.RouterInZone",
      "Zone.N.Effect.N.RouterOutZone",
      "Zone.N.Effect.N.TimeStateCanRestart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 359 ZoneAlias nested effect controls through zone-name alias equivalence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      runtime: {
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
          notes?: string;
        };
      }>;
    }>("object-range-evidence/issue-359-zonealias-nested-effect-alias-equivalence.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #359 confirmed ";
    const issue359 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "ZoneAlias.Effect.N.Enabled",
      "ZoneAlias.Effect.N.RouterMode",
      "ZoneAlias.Effect.N.TimeActive",
      "ZoneAlias.Effect.N.TimeDurationInBeat",
      "ZoneAlias.Effect.N.TimeEnabled",
    ]);
    const deferredSiblingPaths = [
      "ZoneAlias.Effect.N.RouterInZone",
      "ZoneAlias.Effect.N.RouterOutZone",
      "ZoneAlias.Effect.N.TimeStateCanRestart",
    ];
    const retestedSiblingPaths = [
      "ZoneAlias.Effect.N.TimeClock",
      "ZoneAlias.Effect.N.TimeDuration",
      "ZoneAlias.Effect.N.TimeMetro",
    ];

    expect(issue359).toHaveLength(5);
    expect(new Set(issue359.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.runtime.notes).toContain("ZoneAlias denotes a user-configured zone-name alias");
    expect(evidence.runtime.notes).toContain("Zone.2");
    expect(evidence.entries).toHaveLength(5);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);
    expect(new Set(evidence.entries.map((entry) => entry.probePath))).toEqual(
      new Set([
        "Zone.0.Effect.0.Enabled",
        "Zone.0.Effect.0.RouterMode",
        "Zone.0.Effect.0.TimeActive",
        "Zone.0.Effect.0.TimeDurationInBeat",
        "Zone.0.Effect.0.TimeEnabled",
      ]),
    );

    for (const entry of issue359) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "ZoneAlias denotes a user-configured zone name that resolves to the same Object Tree zone as Zone.N by index.",
      });
    }

    for (const entry of evidence.entries) {
      expect(entry.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
      expect(entry.locationContext?.notes).toContain("not a stable literal root");
    }

    expect(byPath.get("ZoneAlias.Effect.N.RouterMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.N.TimeEnabled")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });

    for (const path of deferredSiblingPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }

    for (const path of retestedSiblingPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: 0,
        max: 1000000,
        boundaryBehavior: "clamp",
      });
    }
  });

  it("ships issue 343 ZoneAlias effect controls only for completed SetProp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #343 confirmed ";
    const issue343 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "ZoneAlias.Effect.ChasePeriod",
      "ZoneAlias.Effect.ClockLimit",
      "ZoneAlias.Effect.ClockShift",
      "ZoneAlias.Effect.EnableClockLimit",
      "ZoneAlias.Effect.EnableMetroLimit",
      "ZoneAlias.Effect.MetroLimit",
      "ZoneAlias.Effect.MetroShift",
    ]);

    expect(issue343).toHaveLength(7);
    expect(new Set(issue343.map((entry) => entry.path))).toEqual(expectedPaths);
    for (const entry of issue343) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ZoneAlias resolves through BEYOND's current zone alias state for the loaded show.",
      });
    }

    expect(byPath.get("ZoneAlias.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });

    expect(byPath.get("ZoneAlias.Effect.ChaseTimeMode")?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false).toBe(
      false,
    );
    expect(byPath.get("ZoneAlias.Effect.ChaseTimeMode")?.valueMetadata).toBeUndefined();
  });

  it("ships issue 346 ZoneAlias direct controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-346-zonealias-direct-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #346 confirmed ";
    const issue346 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const deferredPaths = new Set(["ZoneAlias.Active", "ZoneAlias.BlockZone", "ZoneAlias.Mute", "ZoneAlias.Visible"]);

    expect(issue346).toHaveLength(106);
    expect(evidence.entries).toHaveLength(110);
    expect(new Set(evidence.entries.filter((entry) => !entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      deferredPaths,
    );
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue346) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior, entry.path).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ZoneAlias resolves through BEYOND's current zone alias state for the loaded show.",
      });
    }

    expect(byPath.get("ZoneAlias.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.PositionX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.PreviewAsBeams")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.FX8TimeShiftClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of deferredPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });

  it("ships issue 352 Zone and ZoneAlias scalar aliases only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-352-zone-scalar-alias-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #352 confirmed ";
    const issue352 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const deferredPaths = new Set([
      "Zone.N.PosX",
      "Zone.N.PosY",
      "Zone.N.PosZ",
      "Zone.N.SatShift",
      "Zone.N.VisiblePointsEnd",
      "Zone.N.VisiblePointsStart",
      "ZoneAlias.PosX",
      "ZoneAlias.PosY",
      "ZoneAlias.PosZ",
      "ZoneAlias.SatShift",
      "ZoneAlias.VisiblePointsEnd",
      "ZoneAlias.VisiblePointsStart",
    ]);

    expect(issue352).toHaveLength(10);
    expect(issue352.filter((entry) => entry.root === "Zone")).toHaveLength(5);
    expect(issue352.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(5);
    expect(evidence.entries).toHaveLength(22);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(10);
    expect(new Set(evidence.entries.filter((entry) => !entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      deferredPaths,
    );
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue352) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Zone.N.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Zone.N.RotoAccY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ZoneAlias.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of deferredPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }

    for (const path of [...deferredPaths].filter(
      (candidate) => !/^Zone\.N\.Pos[XYZ]$/.test(candidate) && !/^ZoneAlias\.Pos[XYZ]$/.test(candidate),
    )) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 395 ZoneAlias position ranges from concrete alias readback", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-395-alias-cleanup-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #395 confirmed ";
    const issue395 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue395).toHaveLength(3);
    expect(issue395.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(3);
    expect(evidence.entries).toHaveLength(3);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const entry of issue395) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.defaultValue).toBeUndefined();
    }

    for (const path of ["ZoneAlias.PosX", "ZoneAlias.PosY", "ZoneAlias.PosZ"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
        },
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
    }

    for (const path of ["ZoneAlias.SatShift", "ZoneAlias.VisiblePointsEnd", "ZoneAlias.FX7"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 357 Zone and ZoneAlias UGC indexes only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-357-zone-ugc-correction-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #357 confirmed ";
    const issue357 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.UGC.IndexX",
      "Zone.N.UGC.IndexY",
      "ZoneAlias.UGC.IndexX",
      "ZoneAlias.UGC.IndexY",
    ]);

    expect(issue357).toHaveLength(4);
    expect(new Set(issue357.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(50);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(4);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(46);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);
    expect(
      evidence.entries
        .filter((entry) => !entry.shipsMetadata)
        .every((entry) => entry.boundaryBehavior === "pass-through"),
    ).toBe(true);

    for (const entry of issue357) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.valueRange).toMatchObject({
        min: -1,
        max: 0,
        unit: "UGC index",
      });
    }

    expect(byPath.get("Zone.N.UGC.IndexX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ZoneAlias.UGC.IndexY")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });

    for (const path of ["Zone.N.UGC.BowX", "Zone.N.UGC.SizeX", "ZoneAlias.UGC.PositionX", "ZoneAlias.UGC.SymmetryY"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      });
    }
  });

  it("ships issue 366 Zone VisualizationId rows only after extended upper-bound evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-366-zone-visualization-id-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #366 confirmed ";
    const issue366 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue366.map((entry) => entry.path).sort()).toEqual(
      ["Zone.N.VisualizationId", "ZoneAlias.VisualizationId"].sort(),
    );
    expect(evidence.entries).toHaveLength(2);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);

    for (const entry of issue366) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -1,
          max: 255,
          unit: "visualization id",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("Zone.N.VisualizationId")?.valueMetadata?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
    });
    expect(byPath.get("ZoneAlias.VisualizationId")?.valueMetadata?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
    });

    for (const path of [
      "Zone.N.ProjectorIndex",
      "ZoneAlias.ProjectorIndex",
      "Zone.N.Mesh.NodeX",
      "ZoneAlias.Mesh.NodeX",
      "Zone.N.FX7",
      "ZoneAlias.FX7",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 366 Zone Preview and Ratio signed32 rows after integer boundary evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
        baseline: { typeTag: string };
        testedValues: Array<{ input: number; readback: number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-366-zone-preview-ratio-signed32-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-15 issue #366 confirmed ";
    const issue366 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.Preview.AsBeams",
      "Zone.N.Preview.BeamDiameter",
      "Zone.N.Preview.ColorOverride",
      "Zone.N.Preview.FogFrontBrightness",
      "Zone.N.Preview.FogRearBrightness",
      "Zone.N.Preview.GauzeSizeX",
      "Zone.N.Preview.MirrorXProjector",
      "Zone.N.Preview.MirroXOutput",
      "Zone.N.Preview.TextureIntencity",
      "Zone.N.Preview.TextureScrollSpeed",
      "Zone.N.RatioX",
      "Zone.N.RatioY",
      "ZoneAlias.Preview.AsBeams",
      "ZoneAlias.Preview.BeamDiameter",
      "ZoneAlias.Preview.ColorOverride",
      "ZoneAlias.Preview.FogFrontBrightness",
      "ZoneAlias.Preview.FogRearBrightness",
      "ZoneAlias.Preview.GauzeSizeX",
      "ZoneAlias.Preview.MirrorXProjector",
      "ZoneAlias.Preview.MirroXOutput",
      "ZoneAlias.Preview.TextureIntencity",
      "ZoneAlias.Preview.TextureScrollSpeed",
      "ZoneAlias.RatioX",
      "ZoneAlias.RatioY",
    ]);

    expect(issue366).toHaveLength(24);
    expect(new Set(issue366.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(24);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "wrap")).toBe(true);
    expect(evidence.entries.every((entry) => entry.baseline.typeTag === "i")).toBe(true);

    for (const entry of evidence.entries) {
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      );
    }

    for (const entry of issue366) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "raw signed 32-bit integer",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("Zone.N.RatioX")?.valueMetadata?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
    });
    expect(byPath.get("ZoneAlias.RatioX")?.valueMetadata?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
    });

    for (const path of [
      "Zone.N.Preview.PositionX",
      "Zone.N.Preview.SizeX",
      "ZoneAlias.Preview.PositionX",
      "ZoneAlias.Preview.SizeX",
      "Zone.N.UGC.BowX",
      "ZoneAlias.UGC.PositionX",
      "Zone.N.Effect.N.Keys.X",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      });
    }
  });

  it("ships issue 360 ZoneAlias boolean accepted values only with verified domains", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
      }>;
    }>("object-range-evidence/issue-360-zonealias-boolean-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #360 confirmed ";
    const expectedPaths = new Set(["ZoneAlias.Active", "ZoneAlias.BlockZone", "ZoneAlias.Mute", "ZoneAlias.Visible"]);
    const issue360 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue360).toHaveLength(4);
    expect(new Set(issue360.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(4);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "unknown")).toBe(true);
    expect(
      evidence.entries.every((entry) =>
        [0, 1].every((value) => entry.acceptedValues?.some((acceptedValue) => acceptedValue.value === value)),
      ),
    ).toBe(true);

    for (const path of expectedPaths) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueType).toBe("boolean");
      expect(metadata.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }
  });

  it("ships directly observed Universe Image1 ranges without control propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directUniverse = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Universe" &&
        entry.valueMetadata?.notes?.startsWith(
          "Runtime object write/readback on 2026-05-12 confirmed baseline restore on concrete Universe.0.Image1.",
        ),
    );

    expect(directUniverse).toHaveLength(3);
    for (const entry of directUniverse) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Universe.N uses the zero-based Object Tree Universe page index.",
      });
    }

    expect(byPath.get("Universe.N.Image1.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "control value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Image1.Visible")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(byPath.get("Universe.N.Image1.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Universe.N.Image1.ColorActive")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("Universe.N.Image1.ColorOff")?.valueMetadata).toBeUndefined();
  });

  it("generates Universe ZonePad2 by-name component paths from the ZonePad1 tree", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        variants: Array<{ path: string; osc?: string }>;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const zonePad1Suffixes = objectPropertyIndex.entries
      .filter((entry) => entry.path.startsWith("Universe.N.ZonePad1."))
      .map((entry) => entry.path.slice("Universe.N.ZonePad1.".length))
      .sort();
    const zonePad2Suffixes = objectPropertyIndex.entries
      .filter((entry) => entry.path.startsWith("Universe.N.ZonePad2."))
      .map((entry) => entry.path.slice("Universe.N.ZonePad2.".length))
      .sort();

    expect(zonePad1Suffixes).toHaveLength(222);
    expect(zonePad2Suffixes).toEqual(zonePad1Suffixes);
    expect(byPath.get("Universe.N.ZonePad2.Selected")?.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "Universe.0.ZonePad2.Selected",
          osc: "/b/Universe/0/ZonePad2/Selected",
        }),
      ]),
    );
    expect(byPath.get("Universe.N.ZonePad2.Zone.Active")).toBeDefined();
    expect(byPath.get("Universe.N.ZonePad2.Zone.Active")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.N.Zone.Active")?.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "Universe.0.23.Zone.Active",
          osc: "/b/Universe/0/23/Zone/Active",
        }),
      ]),
    );
  });

  it("ships issue 296 Universe common control ranges for the loaded show controls", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commonLeaves = new Set(["Selected", "Value", "Visible", "X", "Y"]);
    const issue296 = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.valueMetadata?.notes?.includes(" issue #296 confirmed ") &&
        commonLeaves.has(entry.property.split(".").at(-1) ?? entry.property),
    );
    const actualCounts = new Map<string, number>();
    for (const entry of issue296) {
      const leaf = entry.property.split(".").at(-1) ?? entry.property;
      actualCounts.set(leaf, (actualCounts.get(leaf) ?? 0) + 1);
    }

    expect(issue296).toHaveLength(122);
    expect(actualCounts).toEqual(
      new Map([
        ["Selected", 24],
        ["Value", 24],
        ["Visible", 24],
        ["X", 25],
        ["Y", 25],
      ]),
    );
    for (const entry of issue296) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "Universe.N uses the zero-based Universe page index, while control names depend on the loaded show.",
      });
    }

    expect(byPath.get("Universe.N.Button1.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized position",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Button1.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Button1.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Universe.N.ZonePad2.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized position",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath.get("Universe.N.N.Zone.Visible")?.valueMetadata?.notes?.includes(" issue #296 confirmed ") ?? false,
    ).toBe(false);
    expect(byPath.get("Universe.N.ZonePad2.Zone.Visible")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Button1.ColorOff")?.valueMetadata).toBeUndefined();
  });

  it("ships issue 296 Universe effect and string ranges from concrete show controls", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commonLeaves = new Set(["Selected", "Value", "Visible", "X", "Y"]);
    const issue296 = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Universe" &&
        entry.valueMetadata?.notes?.includes(" issue #296 confirmed ") &&
        !commonLeaves.has(entry.property.split(".").at(-1) ?? entry.property),
    );
    const actualCounts = new Map<string, number>();
    for (const entry of issue296) {
      const bucket = entry.property.endsWith("Effect.Name")
        ? "Effect.Name"
        : entry.property.endsWith("Caption")
          ? "Caption"
          : (entry.property.split(".").at(-1) ?? entry.property);
      actualCounts.set(bucket, (actualCounts.get(bucket) ?? 0) + 1);
    }

    expect(issue296).toHaveLength(81);
    expect(actualCounts).toEqual(
      new Map([
        ["Caption", 25],
        ["ChasePeriod", 7],
        ["ClockLimit", 7],
        ["ClockShift", 7],
        ["Effect.Name", 7],
        ["EnableClockLimit", 7],
        ["EnableMetroLimit", 7],
        ["MetroLimit", 7],
        ["MetroShift", 7],
      ]),
    );
    for (const entry of issue296) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "Universe.N uses the zero-based Universe page index, while control names depend on the loaded show.",
      });
    }

    expect(byPath.get("Universe.N.Button1.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Universe.N.DropEff1.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.DropEff1.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of [
      "Universe.N.Button1.ColorOff",
      "Universe.N.N.Zone.Effect.ChasePeriod",
      "Universe.N.N.Zone.Name",
      "Universe.N.ZonePad1.Zone.Name",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 317 remaining string control ranges from direct probes", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-13 issue #317 confirmed ";
    const globals = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const contexts = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(globals).toHaveLength(10);
    expect(contexts).toHaveLength(61);
    expect(contexts.filter((entry) => entry.path === "FX.N.N.Name")).toHaveLength(60);
    expect(
      contexts.some((entry) => entry.path === "WS.N.N.Image.Text" && entry.metadata.contextId === "cue-type:text"),
    ).toBe(true);

    for (const metadata of [
      ...globals.map((entry) => entry.valueMetadata as ObjectPropertyValueMetadata),
      ...contexts.map((entry) => entry.metadata),
    ]) {
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata)).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "string",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 254,
          unit: "characters",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(metadata.defaultValue).toBeUndefined();
    }

    expect(byPath.get("FX.N.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("FX.N.N.Name")?.contextValueMetadata?.[0]).toMatchObject({
      contextId: "quickfx-cell:fx-0-0",
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("QShift.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Projector.N.Name")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "hardware-instance",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Caption")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "showfile-alias",
      },
    });
    expect(
      byPath.get("WS.N.N.Image.Text")?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:text"),
    ).toMatchObject({
      locationContext: {
        kind: "workspace-slot",
      },
    });

    for (const path of [
      "Beam.N.Name",
      "ProTrack2.Caption",
      "Universe.N.Button1.ColorOff",
      "Zone.N.Name",
      "ZoneAlias.Name",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed UniversePanelAlias ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directAliases = objectPropertyIndex.entries.filter(
      (entry) => entry.root === "UniversePanelAlias" && entry.valueMetadata,
    );

    expect(directAliases.map((entry) => entry.path).sort()).toEqual([
      "UniversePanelAlias.Control.Caption",
      "UniversePanelAlias.Control.CenterX",
      "UniversePanelAlias.Control.CenterY",
      "UniversePanelAlias.Control.ColorActive",
      "UniversePanelAlias.Control.ColorOn",
      "UniversePanelAlias.Control.DropDuration",
      "UniversePanelAlias.Control.Effect.ChasePeriod",
      "UniversePanelAlias.Control.Effect.ClockLimit",
      "UniversePanelAlias.Control.Effect.ClockShift",
      "UniversePanelAlias.Control.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.Effect.EnableMetroLimit",
      "UniversePanelAlias.Control.Effect.MetroLimit",
      "UniversePanelAlias.Control.Effect.MetroShift",
      "UniversePanelAlias.Control.Effect.Name",
      "UniversePanelAlias.Control.MaxValue",
      "UniversePanelAlias.Control.MinValue",
      "UniversePanelAlias.Control.N.Caption",
      "UniversePanelAlias.Control.N.Effect.ChasePeriod",
      "UniversePanelAlias.Control.N.Effect.ClockLimit",
      "UniversePanelAlias.Control.N.Effect.ClockShift",
      "UniversePanelAlias.Control.N.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.N.Effect.EnableMetroLimit",
      "UniversePanelAlias.Control.N.Effect.MetroLimit",
      "UniversePanelAlias.Control.N.Effect.MetroShift",
      "UniversePanelAlias.Control.N.Effect.Name",
      "UniversePanelAlias.Control.Radius",
      "UniversePanelAlias.Control.Selected",
      "UniversePanelAlias.Control.Tag",
      "UniversePanelAlias.Control.TimeShift",
      "UniversePanelAlias.Control.Value",
      "UniversePanelAlias.Control.Visible",
      "UniversePanelAlias.Control.X",
      "UniversePanelAlias.Control.Y",
    ]);
    for (const entry of directAliases) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("UniversePanelAlias.Control.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        boundaryBehavior: "clamp",
      },
    });
    for (const path of [
      "UniversePanelAlias.Control.Effect.ClockLimit",
      "UniversePanelAlias.Control.Effect.MetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.Effect.ClockShift",
      "UniversePanelAlias.Control.Effect.MetroShift",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.Effect.EnableMetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.Effect.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        boundaryBehavior: "clamp",
      },
      locationContext: {
        indexBasis:
          "UniversePanelAlias.Control.N collapses a show-defined Universe panel alias, zero-based control index, and property path.",
      },
    });
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.ClockLimit",
      "UniversePanelAlias.Control.N.Effect.MetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.ClockShift",
      "UniversePanelAlias.Control.N.Effect.MetroShift",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.N.Effect.EnableMetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Visible")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    for (const path of ["UniversePanelAlias.Control.X", "UniversePanelAlias.Control.Y"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: 0,
          max: 1,
          unit: "normalized position",
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of ["UniversePanelAlias.Control.ColorActive", "UniversePanelAlias.Control.ColorOn"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "pass-through",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.ColorOff")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ChaseTimeMode")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.Zone")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ZoneMode")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.Zone.Active")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Image1.Value")?.valueMetadata).toBeDefined();
  });

  it("ships issue 334 context-complete WS and FX promotions from complete concrete evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        variants?: Array<{ path: string }>;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-334-context-complete-ws-fx-promotions.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Checked-in runtime write/readback evidence for issue #334 promoted ";
    const issue334 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const countsByRoot = new Map<string, number>();
    for (const entry of issue334) countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);

    expect(issue334).toHaveLength(127);
    expect(countsByRoot).toEqual(
      new Map([
        ["FX", 11],
        ["WS", 116],
      ]),
    );
    expect(evidence.entries).toHaveLength(2718);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(
      new Set(issue334.map((entry) => entry.path)),
    );
    expect(evidence.entries.every((entry) => entry.shipsMetadata && entry.evidenceLevel === "observed")).toBe(true);

    for (const entry of issue334) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior, entry.path).not.toBe("unknown");
      expect(metadata.defaultValue, entry.path).toBeUndefined();
      expect(metadata.locationContext).toMatchObject({
        kind: entry.root === "WS" ? "workspace-slot" : "quickfx-slot",
        populationDependent: true,
      });
      expect(entry.contextValueMetadata?.length, entry.path).toBe(entry.variants?.length);
    }

    expect(byPath.get("WS.N.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.ClickMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Image.Text")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "workspace-slot",
      },
    });
    expect(byPath.get("FX.N.N.N.TimeActive")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "Inactive" },
        { value: 1, label: "Active" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.N.Oscillator.Absinvert")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });

    for (const path of [
      "FX.N.N.N.Enabled",
      "FX.N.N.N.TimeEnabled",
      "FX.N.N.N.Oscillator.Finish",
      "FX.N.N.N.Oscillator.Period",
      "FX.N.N.N.Oscillator.Start",
      "FX.N.N.N.Oscillator.Waveform",
      "WS.N.N.ColorSlider",
      "WS.N.N.FX7",
      "WS.N.N.FX8",
      "WS.N.N.Hue",
      "WS.N.N.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });
});
