import { describe, expect, it } from "vitest";
import { issue338FxCellEffectControlPaths } from "../../fixtures/knowledge/objectMetadataPathGroups";
import {
  assertObjectPropertyReadbackMetadata,
  assertObjectPropertyValueMetadata,
  hasManualReadyValueMetadata,
  type ObjectPropertyProbeContext,
  type ObjectPropertyReadbackMetadata,
  type ObjectPropertyValueMetadata,
  readJson,
  readObjectPropertyRangeOverlayFiles,
} from "../readKnowledgeTestData";

describe("checked-in Object Tree device value metadata data", () => {
  it("keeps object-property range overlay entries structurally valid", () => {
    const overlayFiles = readObjectPropertyRangeOverlayFiles();
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        osc?: string;
        variants?: Array<{ path: string; osc?: string }>;
        probeContexts?: ObjectPropertyProbeContext[];
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set(objectPropertyIndex.entries.map((entry) => entry.path));
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const seen = new Set<string>();
    for (const source of overlayFiles) {
      expect(source.overlay.schemaVersion, source.relativePath).toBe(1);
      for (const entry of source.overlay.entries) {
        expect(knownPaths.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(true);
        const overlayKey = `${entry.path}\0${entry.contextId ?? ""}`;
        expect(seen.has(overlayKey), `${source.relativePath} ${entry.path} ${entry.contextId ?? ""}`.trim()).toBe(
          false,
        );
        seen.add(overlayKey);
        if (entry.contextId) {
          const indexedEntry = byPath.get(entry.path);
          expect(
            indexedEntry?.probeContexts?.some((context) => context.id === entry.contextId),
            `${source.relativePath} ${entry.path} ${entry.contextId}`,
          ).toBe(true);
        }
        assertObjectPropertyValueMetadata(entry);
        expect(
          hasManualReadyValueMetadata(entry),
          `${source.relativePath} ${entry.path} ${entry.contextId ?? ""}`.trim(),
        ).toBe(true);
      }
    }

    expect(byPath.get("WS.N.N.Image.Text")).toMatchObject({
      osc: "/b/WS/0/2/Image/Text",
      variants: [{ path: "WS.0.2.Image.Text", osc: "/b/WS/0/2/Image/Text" }],
      probeContexts: [
        expect.objectContaining({
          id: "cue-type:text",
          kind: "cue-type",
          label: "Text",
          probePrefix: "WS.0.2",
          probeOscPrefix: "/b/WS/0/2",
        }),
      ],
    });
    expect(byPath.get("WS.N.N.Image.Amplitude")).toMatchObject({
      osc: "/b/WS/1/0/Image/Amplitude",
      variants: [{ path: "WS.1.0.Image.Amplitude", osc: "/b/WS/1/0/Image/Amplitude" }],
      probeContexts: [
        expect.objectContaining({
          id: "cue-shape:parametric-image:wave",
          kind: "cue-shape",
          label: "wave",
          parentLabel: "Parametric-Image",
          probePrefix: "WS.1.0",
          probeOscPrefix: "/b/WS/1/0",
        }),
      ],
    });
    expect(byPath.get("FX.N.N.N.Oscillator.Period")?.probeContexts).toContainEqual(
      expect.objectContaining({
        id: "quickfx:oscillating-effect:zoom:fx-0-0-0",
        kind: "quickfx-effect",
        label: "Zoom",
        parentLabel: "Oscillating effect",
        probePrefix: "FX.0.0.0",
        probeOscPrefix: "/b/FX/0/0/0",
      }),
    );
    expect(byPath.get("FX.N.N.Name")?.probeContexts).toHaveLength(60);
    expect(byPath.get("FX.N.N.Name")?.probeContexts).toContainEqual(
      expect.objectContaining({
        id: "quickfx-cell:fx-0-0",
        kind: "quickfx-cell",
        label: "OSCILLATING EFFECTS",
        probePrefix: "FX.0.0",
        probeOscPrefix: "/b/FX/0/0",
      }),
    );
  }, 30_000);

  it("seeds exact object-property ranges from command value metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commandDerived = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Command-derived seed"),
    );

    expect(commandDerived).toHaveLength(54);
    for (const entry of commandDerived) {
      expect(byPath.has(entry.path), entry.path).toBe(true);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.notes).toContain("exact setsProperty target");
      expect(entry.valueMetadata?.notes).toContain("not same-name propagation");
    }
    expect(byPath.get("Grid.CellIndex")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.AudioVolumeMute")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.CueBeatShift")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.ShowShift")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("WS.N.N.CaptionColor")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Grid.Count")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Grid.GetColCount")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Grid.GetRowCount")?.valueMetadata?.notes).not.toContain("Command-derived seed");

    expect(byPath.get("Master.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.CaptionColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.CaptionColor")?.valueMetadata?.acceptedValues).toContainEqual(
      expect.objectContaining({ value: 0, label: "Black" }),
    );
    expect(byPath.get("Grid.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 256,
        unit: "cue slots",
        boundaryBehavior: "mixed",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Master.Red")?.valueMetadata?.notes).toContain("RGBA r parameter");
    expect(byPath.get("ZoneAlias.Mute")?.valueMetadata?.notes).not.toContain("Command-derived seed");
  });

  it("ships directly observed FX quick-effect ranges only on the probed placement", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const contextId = "quickfx:oscillating-effect:zoom:fx-0-0-0";
    const directFx = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.contextId === contextId)
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const legacyDirectFx = directFx.filter((entry) =>
      entry.metadata.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(legacyDirectFx).toHaveLength(4);
    for (const entry of legacyDirectFx) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.defaultValue).toBeUndefined();
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      });
    }

    expect(byPath.get("FX.N.N.N.Oscillator.Period")?.valueMetadata?.valueRange).toBeUndefined();
    expect(
      byPath.get("FX.N.N.N.Oscillator.Period")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.1,
        max: 16,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath.get("FX.N.N.N.Oscillator.Waveform")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 6,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath.get("FX.N.N.N.Enabled")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath.get("FX.N.N.N.TimeEnabled")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.N.Oscillator.CENTERX")?.contextValueMetadata).toBeUndefined();
  });

  it("ships issue 295 FX common and oscillator ranges only for populated QuickFX contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue295 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #295 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const expectedCounts = new Map([
      ["FX.N.N.N.Enabled", 144],
      ["FX.N.N.N.Oscillator.Absinvert", 27],
      ["FX.N.N.N.Oscillator.Absrevwave", 27],
      ["FX.N.N.N.Oscillator.Damping", 27],
      ["FX.N.N.N.Oscillator.Finish", 7],
      ["FX.N.N.N.Oscillator.Period", 26],
      ["FX.N.N.N.Oscillator.Phase", 27],
      ["FX.N.N.N.Oscillator.Secondwave", 27],
      ["FX.N.N.N.Oscillator.Start", 7],
      ["FX.N.N.N.Oscillator.Waveform", 26],
      ["FX.N.N.N.Oscillator.Waveperiod", 27],
      ["FX.N.N.N.Oscillator.Wavespeed", 27],
      ["FX.N.N.N.Oscillator.Width", 27],
      ["FX.N.N.N.TimeActive", 145],
      ["FX.N.N.N.TimeDurationInBeat", 145],
      ["FX.N.N.N.TimeEnabled", 144],
    ]);
    const actualCounts = new Map<string, number>();
    for (const entry of issue295) actualCounts.set(entry.path, (actualCounts.get(entry.path) ?? 0) + 1);

    expect(issue295).toHaveLength(860);
    expect(actualCounts).toEqual(expectedCounts);
    expect(new Set(issue295.map((entry) => entry.metadata.contextId)).size).toBe(145);

    for (const entry of issue295) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.defaultValue).toBeUndefined();
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      });
    }

    const zoomContext = "quickfx:oscillating-effect:zoom:fx-0-0-0";
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Phase")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Waveperiod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.1,
        max: 10,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.TimeDurationInBeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Start")
        ?.contextValueMetadata?.find(
          (metadata) => metadata.contextId === "quickfx:oscillating-effect:beam-brush:fx-0-0-19",
        ),
    ).toMatchObject({
      valueRange: {
        min: 0,
        max: 100,
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Start")
        ?.contextValueMetadata?.find(
          (metadata) => metadata.contextId === "quickfx:oscillating-effect:blue-channel:fx-0-0-18",
        ),
    ).toMatchObject({
      valueRange: {
        min: -100,
        max: 100,
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.RouterMode")
        ?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #295 confirmed "),
        ) ?? false,
    ).toBe(false);
  });

  it("ships issue 338 FX cell effect controls only after all generated cells agree", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue338 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime command-write/readback on 2026-05-14 issue #338 confirmed "),
    );

    expect(issue338).toHaveLength(7);
    expect(new Set(issue338.map((entry) => entry.path))).toEqual(issue338FxCellEffectControlPaths);

    for (const entry of issue338) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N uses QuickFX panel index then cell index.",
      });
    }

    expect(byPath.get("FX.N.N.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("FX.N.N.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("FX.N.N.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("FX.N.N.ChaseTimeMode")?.valueMetadata?.notes?.includes("2026-05-14 issue #338")).not.toBe(true);
  });

  it("ships issue 375 FX RouterMode only after all generated effect paths agree", () => {
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
    }>("object-range-evidence/issue-375-fx-routing-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const routerMode = byPath.get("FX.N.N.N.RouterMode")?.valueMetadata as ObjectPropertyValueMetadata | undefined;

    expect(evidence.entries).toHaveLength(151);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(145);
    expect(new Set(evidence.entries.filter((entry) => entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      new Set(["FX.N.N.N.RouterMode"]),
    );
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    assertObjectPropertyValueMetadata(routerMode as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(routerMode as ObjectPropertyValueMetadata)).toBe(true);
    expect(routerMode).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      },
    });

    for (const path of [
      "FX.N.N.ChaseTimeMode",
      "FX.N.N.Zone",
      "FX.N.N.ZoneMode",
      "FX.N.N.N.RouterInZone",
      "FX.N.N.N.RouterOutZone",
      "FX.N.N.N.TimeStateCanRestart",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("2026-05-14 issue #375") ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("does not ship QShift A/B readback-only range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");

    const qShiftMetadata = objectPropertyIndex.entries.filter(
      (entry) => entry.root === "QShift" && /^QShift\.N\.[AB]\./.test(entry.path) && entry.valueMetadata !== undefined,
    );

    expect(qShiftMetadata).toEqual([]);
  });

  it("ships only manual-ready hardware metadata without placeholder propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issueHardware = objectPropertyIndex.entries.filter(
      (entry) =>
        (entry.root === "Projector" || entry.root === "Status") && entry.valueMetadata?.notes?.includes("2026-05-12"),
    );

    expect(issueHardware.map((entry) => entry.path)).toEqual(["Projector.N.InvertX"]);
    assertObjectPropertyValueMetadata(issueHardware[0]?.valueMetadata as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(issueHardware[0]?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);

    expect(byPath.get("Projector.N.InvertX")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "mixed",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
        indexBasis: "Projector.N uses the zero-based Object Tree projector index.",
      },
    });
    for (const path of [
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
      "Projector.N.Serial",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(byPath.get("Projector.N.SizeX")?.valueMetadata?.notes).not.toContain("2026-05-12");
  });

  it("ships issue 298 Beam and Projector rows without hardware placeholder propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue298 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #298 confirmed "),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue298) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
    }

    expect(issue298).toHaveLength(22);
    expect(countsByRoot).toEqual(
      new Map([
        ["Beam", 10],
        ["Projector", 12],
      ]),
    );
    expect(byPath.get("Beam.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "BGR packed color",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Beam.N.ColorPalette")?.valueMetadata).toMatchObject({
      valueType: "enum",
      valueRange: {
        min: 0,
        max: 4,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "PALETTE_0" },
        { value: 1, label: "PALETTE_1" },
        { value: 2, label: "PALETTE_2" },
        { value: 3, label: "PALETTE_3" },
        { value: 4, label: "PALETTE_4" },
      ],
    });
    expect(byPath.get("Beam.N.PosX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -32767,
        max: 32767,
        unit: "beam coordinate",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Projector.N.IdleCenterOffsetX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    for (const path of ["Projector.N.InvertY", "Projector.N.SwapXY"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "mixed",
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
      });
    }
    for (const path of [
      "Projector.N.ColorShift",
      "Projector.N.MaxBlue",
      "Projector.N.MaxGreen",
      "Projector.N.MaxRed",
      "Projector.N.MinBlue",
      "Projector.N.MinGreen",
      "Projector.N.MinRed",
      "Projector.N.MinimumPoints",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -32768,
          max: 32767,
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }
    for (const path of [
      "Beam.N.Power",
      "Beam.N.IsGroup",
      "Projector.N.SizeX",
      "Projector.N.Optimisation.EnableAngleTable",
      "Status.LaserEnabled",
      "FB3_XXXXX.InvertY",
      "FB4_XXXXX.InvertY",
    ]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #298 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 298 FB hardware rows from connected hardware probes", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue298Fb = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime command-write/readback on 2026-05-14 issue #298 confirmed FB"),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue298Fb) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "hardware-instance",
        populationDependent: true,
      });
    }

    expect(issue298Fb).toHaveLength(28);
    expect(countsByRoot).toEqual(
      new Map([
        ["FB3_XXXXX", 14],
        ["FB4_XXXXX", 14],
      ]),
    );
    expect(byPath.get("FB3_XXXXX.ColorShift")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -32768,
        max: 32767,
        unit: "hardware color shift",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("FB4_XXXXX.IdleCenterOffsetX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("FB3_XXXXX.InvertX")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("FB4_XXXXX.SwapXY")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of ["FB3_XXXXX.Name", "FB4_XXXXX.Name"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "string",
        valueRange: {
          min: 0,
          max: 254,
          unit: "characters",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }
    for (const path of ["FB3_XXXXX.Connected", "FB4_XXXXX.Connected"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 0, label: "DISCONNECTED" },
          { value: 1, label: "CONNECTED" },
        ],
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      assertObjectPropertyValueMetadata(byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of [
      "FB3_XXXXX.Serial",
      "FB4_XXXXX.Serial",
      "FB3_XXXXX.Optimisation.EnableAngleTable",
      "FB4_XXXXX.Optimisation.EnableAngleTable",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("completes issue 298 FB Projector-equivalent rows from direct write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/fb-projector-equivalent-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/fb-projector-equivalent-readbacks.json");
    const fbEvidence = readJson<{
      runtime: {
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        baseline: {
          value: string | number | boolean | null;
          typeTag: string;
        };
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          command?: string;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-fb-projector-equivalent-controls.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const roots = ["FB3_XXXXX", "FB4_XXXXX"];
    const expectedValueEntries = new Map<
      string,
      { valueType: string; unit: string; min: number; max: number; boundaryBehavior: string }
    >();
    const expectedReadbackOnly = new Set<string>();
    for (const root of roots) {
      for (const [property, expected] of [
        [
          "DefaultSampleRate",
          {
            valueType: "integer",
            unit: "samples per second",
            min: -2147483648,
            max: 2147483647,
            boundaryBehavior: "wrap",
          },
        ],
        [
          "MaxSampleRate",
          {
            valueType: "integer",
            unit: "samples per second",
            min: -2147483648,
            max: 2147483647,
            boundaryBehavior: "wrap",
          },
        ],
        [
          "PositionX",
          {
            valueType: "number",
            unit: "projector coordinate",
            min: -1000000,
            max: 1000000,
            boundaryBehavior: "unknown",
          },
        ],
        [
          "PositionY",
          {
            valueType: "number",
            unit: "projector coordinate",
            min: -1000000,
            max: 1000000,
            boundaryBehavior: "unknown",
          },
        ],
        [
          "PostRotation",
          { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
        ],
        [
          "PreRotation",
          { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
        ],
        ["SizeX", { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" }],
        ["SizeY", { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" }],
      ] as const) {
        expectedValueEntries.set(`${root}.${property}`, expected);
      }
      for (const property of [
        "Optimisation.AngleRepeats",
        "Optimisation.AngleTable",
        "Optimisation.BlankDensity",
        "Optimisation.BlankEnd",
        "Optimisation.BlankOverlap",
        "Optimisation.BlankStart",
        "Optimisation.CornerRepeats",
        "Optimisation.DisableCornerFlag",
        "Optimisation.Enable3dDensity",
        "Optimisation.EnableAngleTable",
        "Optimisation.EnableBlankDensity",
        "Optimisation.EnableSinBlank",
        "Optimisation.EnableSinVisible",
        "Optimisation.EnableVisibleDensity",
        "Optimisation.ForceVectorMode",
        "Optimisation.IgnoreOriginal",
        "Optimisation.MinimumPoints",
        "Optimisation.NoDot",
        "Optimisation.VisibleDensity",
        "Optimisation.VisibleEnd",
        "Optimisation.VisibleOverlap",
        "Optimisation.VisibleStart",
        "Serial",
      ]) {
        expectedReadbackOnly.add(`${root}.${property}`);
      }
    }
    const evidenceByPath = new Map(fbEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(fbEvidence.runtime.notes).toContain("Object Tree surfaces match Projector.N property-for-property");
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedValueEntries.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expected = expectedValueEntries.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(metadata).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
        },
      });
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: metadata.path,
        shipsMetadata: true,
        boundaryBehavior: expected?.boundaryBehavior,
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
        },
      });
      expect(evidence?.testedValues).toContainEqual(
        expect.objectContaining({ input: 120000, readback: 120000, behavior: "pass-through" }),
      );
      if (expected?.boundaryBehavior === "wrap") {
        expect(metadata.valueRange?.notes, metadata.path).toContain("UI maximum");
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      } else {
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -1000000, readback: -1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: -2147483648, behavior: "unknown" }),
          ]),
        );
      }
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidence, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        evidence?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    for (const serialPath of ["FB3_XXXXX.Serial", "FB4_XXXXX.Serial"]) {
      expect(byPath.get(serialPath)?.readbackMetadata).toMatchObject({
        valueType: "string",
        typeTag: "s",
        notes: expect.stringContaining("redacted serial string"),
      });
      expect(byPath.get(serialPath)?.readbackMetadata?.observedValue).toBeUndefined();
      expect(evidenceByPath.get(serialPath)).toMatchObject({
        baseline: {
          value: "[redacted serial string]",
          typeTag: "s",
        },
      });
    }

    for (const root of roots) {
      const rootGaps = objectPropertyIndex.entries.filter(
        (entry) =>
          entry.root === root && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
      );
      expect(rootGaps).toHaveLength(0);
    }
  });

  it("completes issue 298 Status rows from direct write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/status-memory-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/status-readbacks.json");
    const evidence = readJson<{
      runtime: {
        notes: string;
      };
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
    }>("object-range-evidence/issue-298-status-memory-and-readbacks.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const expectedIntegerRows = new Map([
      ["Status.MemAvailExtendedVirtual", "megabytes"],
      ["Status.MemAvailPageFile", "megabytes"],
      ["Status.MemAvailPhys", "megabytes"],
      ["Status.MemAvailVirtual", "megabytes"],
      ["Status.MemoryLoad", "percent"],
      ["Status.MemTotalPageFile", "megabytes"],
      ["Status.MemTotalPhys", "megabytes"],
      ["Status.MemTotalVirtual", "megabytes"],
      ["Status.MemVirtualUsed", "megabytes"],
    ]);
    const expectedValueRows = new Set([...expectedIntegerRows.keys(), "Status.MemoryInfo"]);
    const expectedReadbackRows = new Set([
      "Status.CpuUseLong",
      "Status.CpuUseShort",
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
    ]);

    expect(evidence.runtime.notes).toContain("SetProp followed by immediate Object Tree readback");
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(expectedValueRows);
    for (const metadata of rangeOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        probePath: metadata.path,
      });

      if (metadata.path === "Status.MemoryInfo") {
        expect(metadata).toMatchObject({
          valueType: "string",
          valueRange: {
            min: 0,
            max: 254,
            unit: "characters",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
          evidenceLevel: "observed",
        });
        expect(row?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              input: "string length 254",
              readback: "string length 254",
              behavior: "pass-through",
            }),
            expect.objectContaining({ input: "string length 255", readback: "string length 254", behavior: "clamp" }),
            expect.objectContaining({ input: "string length 512", readback: "string length 254", behavior: "clamp" }),
          ]),
        );
      } else {
        expect(metadata).toMatchObject({
          valueType: "integer",
          valueRange: {
            min: -2147483648,
            max: 2147483647,
            unit: expectedIntegerRows.get(metadata.path),
            boundaryBehavior: "wrap",
            evidenceLevel: "observed",
          },
          evidenceLevel: "observed",
        });
        expect(row?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: 100000, readback: 100000, behavior: "pass-through" }),
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      }

      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: metadata.valueType,
        valueRange: metadata.valueRange,
        evidenceLevel: metadata.evidenceLevel,
        notes: metadata.notes,
      });
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackRows);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
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

    const statusGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Status" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(statusGaps).toHaveLength(0);
  });

  it("ships issue 298 Beam size rows with runtime clamp evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const beamSize = ["Beam.N.SizeX", "Beam.N.SizeY"].map((path) => byPath.get(path));

    expect(
      beamSize.map((entry) => ({
        path: entry?.path,
        metadata: entry?.valueMetadata,
      })),
    ).toEqual([
      {
        path: "Beam.N.SizeX",
        metadata: expect.objectContaining({
          valueType: "number",
          evidenceLevel: "observed",
          valueRange: expect.objectContaining({
            min: -200,
            max: 200,
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          }),
          notes: expect.stringContaining("2026-05-14 issue #298 confirmed Beam.N.SizeX at Beam.0.SizeX"),
          locationContext: expect.objectContaining({
            kind: "indexed-root",
            populationDependent: true,
          }),
        }),
      },
      {
        path: "Beam.N.SizeY",
        metadata: expect.objectContaining({
          valueType: "number",
          evidenceLevel: "observed",
          valueRange: expect.objectContaining({
            min: -200,
            max: 200,
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          }),
          notes: expect.stringContaining("2026-05-14 issue #298 confirmed Beam.N.SizeY at Beam.0.SizeY"),
          locationContext: expect.objectContaining({
            kind: "indexed-root",
            populationDependent: true,
          }),
        }),
      },
    ]);

    for (const entry of beamSize) {
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }
  });

  it("completes issue 298 Beam leftovers from write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/beam-leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/beam-leftover-readbacks.json");
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
    }>("object-range-evidence/issue-298-beam-leftovers.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const expectedReadbackRows = new Set(["Beam.N.IsGroup", "Beam.N.Name"]);

    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(["Beam.N.Power", "Beam.N.RotoZ"]));
    expect(byPath.get("Beam.N.Power")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "percent",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(evidenceByPath.get("Beam.N.Power")).toMatchObject({
      shipsMetadata: true,
      boundaryBehavior: "wrap",
      valueType: "integer",
    });
    expect(evidenceByPath.get("Beam.N.Power")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    expect(byPath.get("Beam.N.RotoZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1000000,
        max: 1000000,
        unit: "degrees",
        boundaryBehavior: "unknown",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(evidenceByPath.get("Beam.N.RotoZ")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -1.5, readback: -1.5, behavior: "pass-through" }),
        expect.objectContaining({ input: 1.5, readback: 1.5, behavior: "pass-through" }),
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
        expect.objectContaining({ input: 2147483647, readback: 2147483648, behavior: "unknown" }),
      ]),
    );

    for (const path of ["Beam.N.Power", "Beam.N.RotoZ"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(byPath.get(path)?.readbackMetadata, path).toBeUndefined();
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackRows);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
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

    const beamGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Beam" && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );
    expect(beamGaps).toHaveLength(0);
  });

  it("ships issue 298 command-driven Status domains", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const statusMetadata = ["Status.LaserEnabled", "Status.Locked"].map((path) => byPath.get(path));

    for (const entry of statusMetadata) {
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry?.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "unknown",
        },
      });
    }

    expect(String(byPath.get("Status.LaserEnabled")?.valueMetadata?.notes)).toContain("DisableLaserOutput");
    expect(String(byPath.get("Status.Locked")?.valueMetadata?.notes)).toContain("did not re-run LockScreen");
    for (const path of [
      "Status.CpuUseLong",
      "Status.CpuUseShort",
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 298 Projector connected readback domain", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const metadata = byPath.get("Projector.N.Connected")?.valueMetadata as ObjectPropertyValueMetadata | undefined;

    expect(metadata).toBeDefined();
    assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    expect(metadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "DISCONNECTED" },
        { value: 1, label: "CONNECTED" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      evidenceLevel: "observed",
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    expect(metadata?.notes).toContain("2026-05-14 issue #298");

    for (const path of ["Projector.N.Serial"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    for (const path of ["Projector.N.DefaultSampleRate", "Projector.N.MaxSampleRate"]) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).not.toContain("Projector connected readback domain");
    }
  });

  it("completes issue 298 Projector remaining rows from write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/projector-pass-through-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/projector-optimisation-and-serial-readbacks.json");
    const projectorEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-projector-pass-through-and-optimisation.json");
    const projectorBoundaryEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-133-projector-numeric-boundary-behavior.json");
    const serialEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        baseline: {
          value: string;
          typeTag: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-projector-serial-write-readback.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedPassThrough = new Map([
      [
        "Projector.N.DefaultSampleRate",
        {
          valueType: "integer",
          unit: "samples per second",
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "wrap",
        },
      ],
      [
        "Projector.N.MaxSampleRate",
        {
          valueType: "integer",
          unit: "samples per second",
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "wrap",
        },
      ],
      [
        "Projector.N.PositionX",
        {
          valueType: "number",
          unit: "projector coordinate",
          min: -2147483648,
          max: 2147483648,
          boundaryBehavior: "mixed",
        },
      ],
      [
        "Projector.N.PositionY",
        {
          valueType: "number",
          unit: "projector coordinate",
          min: -2147483648,
          max: 2147483648,
          boundaryBehavior: "mixed",
        },
      ],
      [
        "Projector.N.PostRotation",
        { valueType: "number", unit: "degrees", min: -2147483648, max: 2147483648, boundaryBehavior: "mixed" },
      ],
      [
        "Projector.N.PreRotation",
        { valueType: "number", unit: "degrees", min: -2147483648, max: 2147483648, boundaryBehavior: "mixed" },
      ],
      [
        "Projector.N.SizeX",
        { valueType: "number", unit: "percent", min: -2147483648, max: 2147483648, boundaryBehavior: "mixed" },
      ],
      [
        "Projector.N.SizeY",
        { valueType: "number", unit: "percent", min: -2147483648, max: 2147483648, boundaryBehavior: "mixed" },
      ],
    ]);
    const expectedReadbackOnly = new Set([
      "Projector.N.Optimisation.AngleRepeats",
      "Projector.N.Optimisation.AngleTable",
      "Projector.N.Optimisation.BlankDensity",
      "Projector.N.Optimisation.BlankEnd",
      "Projector.N.Optimisation.BlankOverlap",
      "Projector.N.Optimisation.BlankStart",
      "Projector.N.Optimisation.CornerRepeats",
      "Projector.N.Optimisation.DisableCornerFlag",
      "Projector.N.Optimisation.Enable3dDensity",
      "Projector.N.Optimisation.EnableAngleTable",
      "Projector.N.Optimisation.EnableBlankDensity",
      "Projector.N.Optimisation.EnableSinBlank",
      "Projector.N.Optimisation.EnableSinVisible",
      "Projector.N.Optimisation.EnableVisibleDensity",
      "Projector.N.Optimisation.ForceVectorMode",
      "Projector.N.Optimisation.IgnoreOriginal",
      "Projector.N.Optimisation.MinimumPoints",
      "Projector.N.Optimisation.NoDot",
      "Projector.N.Optimisation.VisibleDensity",
      "Projector.N.Optimisation.VisibleEnd",
      "Projector.N.Optimisation.VisibleOverlap",
      "Projector.N.Optimisation.VisibleStart",
      "Projector.N.Serial",
    ]);
    const evidenceByPath = new Map(
      [...projectorEvidence.entries, ...serialEvidence.entries, ...projectorBoundaryEvidence.entries].map((entry) => [
        entry.objectPath,
        entry,
      ]),
    );

    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedPassThrough.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expected = expectedPassThrough.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(metadata).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
        },
      });
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringContaining("Projector.0."),
        shipsMetadata: true,
        boundaryBehavior: expected?.boundaryBehavior,
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
        },
      });
      if (expected?.boundaryBehavior === "wrap") {
        expect(evidence?.testedValues).toContainEqual(
          expect.objectContaining({ input: 120000, readback: 120000, behavior: "pass-through" }),
        );
        expect(metadata.valueRange?.notes, metadata.path).toContain("not hardware-specific UI limits");
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      } else {
        expect(metadata.valueRange?.notes, metadata.path).toContain("issue #133");
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -2147483649, readback: -2147483648, behavior: "clamp" }),
            expect.objectContaining({ input: -1000001, readback: -1000001, behavior: "pass-through" }),
            expect.objectContaining({ input: 0.5, readback: 0.5, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: 2147483648, behavior: "unknown" }),
            expect.objectContaining({ input: 2147483649, readback: 2147483648, behavior: "clamp" }),
          ]),
        );
      }
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidence, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        evidence?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Projector.N.Optimisation.EnableAngleTable")?.readbackMetadata).toMatchObject({
      probePath: "Projector.0.Optimisation.EnableAngleTable",
      valueType: "number",
      observedValue: 0,
      typeTag: "f",
    });
    expect(byPath.get("Projector.N.Serial")?.readbackMetadata).toMatchObject({
      probePath: "Projector.0.Serial",
      valueType: "string",
      typeTag: "s",
      notes: expect.stringContaining("redacted serial string"),
    });
    expect(byPath.get("Projector.N.Serial")?.readbackMetadata?.observedValue).toBeUndefined();
    expect(serialEvidence.entries[0]).toMatchObject({
      objectPath: "Projector.N.Serial",
      probePath: "Projector.0.Serial",
      shipsMetadata: false,
      boundaryBehavior: "no-op",
      valueType: "string",
      baseline: {
        value: "[redacted serial string]",
        typeTag: "s",
      },
    });

    const projectorGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Projector" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(projectorGaps).toHaveLength(0);
  });

  it("ships only manual-ready DMX, channel, and color-channel metadata without index propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        variantCount?: number;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const roots = new Set(["DmxMasters", "Channels", "ColorChannel"]);
    const directDmx = objectPropertyIndex.entries.filter(
      (entry) => roots.has(entry.root) && entry.valueMetadata?.notes?.includes("2026-05-12"),
    );

    expect(directDmx.map((entry) => entry.path).sort()).toEqual(
      [
        "Channels.N.Attraction",
        "Channels.N.Color",
        "Channels.N.Friction",
        "Channels.N.Mass",
        "Channels.N.Name",
        "Channels.N.PhActive",
        "Channels.N.Reflection",
        "Channels.N.Value",
        "ColorChannel.N.B",
        "ColorChannel.N.Color",
        "ColorChannel.N.G",
        "ColorChannel.N.Mode",
        "ColorChannel.N.Name",
        "ColorChannel.N.R",
        "ColorChannel.N.VideoX",
        "ColorChannel.N.VideoY",
        "DmxMasters.N.Value",
      ].sort(),
    );
    for (const entry of directDmx) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
    }

    const dmxOutput = byPath.get("DmxOutput.N")?.valueMetadata;
    assertObjectPropertyValueMetadata(dmxOutput as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(dmxOutput as ObjectPropertyValueMetadata)).toBe(true);
    expect(dmxOutput).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("DmxMasters.N.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Attraction")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 50,
        unit: "physics scalar",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Friction")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 30,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Mass")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 30,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.PhActive")?.valueMetadata).toMatchObject({
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
    expect(byPath.get("Channels.N.Reflection")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed color integer",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    for (const path of ["ColorChannel.N.R", "ColorChannel.N.G", "ColorChannel.N.B"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 0,
          max: 255,
          unit: "8-bit color component",
          boundaryBehavior: "clamp",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
    }
    expect(byPath.get("ColorChannel.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed BGR color integer",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ColorChannel.N.Mode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 0,
        unit: "mode",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ColorChannel.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    for (const path of ["ColorChannel.N.VideoX", "ColorChannel.N.VideoY"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "video coordinate",
          boundaryBehavior: "wrap",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
    }
    for (const path of ["DmxIO.MuteOutput", "DmxIO.DoBeep", "DmxIO.MuteInput"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("does not ship misc-root readback-only range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const roots = new Set([
      "Gamepad",
      "MobSensor",
      "Skeleton1",
      "Skeleton2",
      "TouchPoints",
      "Grid",
      "Grid2",
      "Config",
      "UserInterface",
      "VideoOutput1",
      "MIDI1",
      "MIDI2",
      "MIDI3",
      "MIDI4",
      "CoreManager",
      "PlayListState",
      "OneCue",
      "MultiCue",
      "Location",
      "Beam",
      "Status",
    ]);
    const directMisc = objectPropertyIndex.entries.filter(
      (entry) => roots.has(entry.root) && entry.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12"),
    );

    expect(directMisc).toEqual([]);
  });

  it("ships observed safe small global root range metadata from issue 289", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const path of [
      "Config.CaptureAsLocal",
      "Config.FocusMidiClicks",
      "Config.HideOutputPreviewInMutedProjectionZones",
      "Config.ShowAudioTab",
      "VideoOutput1.Visible",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "boolean",
        evidenceLevel: "observed",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of ["Location.N.X", "Location.N.Y", "Location.N.Z"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 1,
          unit: "normalized",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    const locationName = byPath.get("Location.N.Name")?.valueMetadata;
    assertObjectPropertyValueMetadata(locationName as ObjectPropertyValueMetadata);
    expect(locationName).toMatchObject({
      valueType: "string",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(locationName as ObjectPropertyValueMetadata)).toBe(true);

    const touchActive = byPath.get("TouchPoints.N.Active")?.valueMetadata;
    assertObjectPropertyValueMetadata(touchActive as ObjectPropertyValueMetadata);
    expect(touchActive).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(touchActive as ObjectPropertyValueMetadata)).toBe(true);

    expect(byPath.has("Config.ScanRateSliderMax")).toBe(true);
    expect(byPath.has("Config.Scan RateSliderMax")).toBe(false);

    for (const path of [
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.FxRowCount",
      "Config.ScanRateSliderMax",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "Location.N.LastTick",
    ]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #289") ??
          false,
        path,
      ).toBe(false);
      expect(byPath.get(path)?.readbackMetadata?.notes?.includes("issue #289") ?? false, path).toBe(false);
    }
  });

  it("ships readback count domains from issue 399", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Grid2.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "inferred",
      valueRange: {
        min: 1,
        max: 256,
        unit: "cue slots",
        boundaryBehavior: "mixed",
        evidenceLevel: "inferred",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });

    for (const [path, fixedCount, unit] of [
      ["ColorChannel.Count", 256, "color channels"],
      ["Location.Count", 1024, "locations"],
      ["TouchPoints.Count", 10, "touch points"],
    ] as const) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: fixedCount,
          max: fixedCount,
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of [
      "TouchPoints.ActiveCount",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
    ]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime readback-only evidence on 2026-05-15 issue #399") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 216 TouchPoints leftover write/readback coverage", () => {
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
    }>("object-property-ranges/touchpoints/leftover-controls.json");
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
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-touchpoints-leftovers.json");

    const expectedValuePaths = new Set([
      "TouchPoints.ActiveCount",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(evidence.entries).toHaveLength(7);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedValuePaths);

    for (const metadata of valueOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      const expectedMax = metadata.path === "TouchPoints.ActiveCount" ? 2147483647 : 1000000;
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: expectedMax,
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
        row?.testedValues.some(
          (testedValue) => testedValue.behavior === "pass-through" && Number(testedValue.input) > 100000,
        ),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata?.valueRange?.min, metadata.path).toBe(row?.valueRange?.min);
      expect(entry?.valueMetadata?.valueRange?.max, metadata.path).toBe(row?.valueRange?.max);
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata), metadata.path).toBe(
        true,
      );
    }

    expect(byPath.get("TouchPoints.ActiveCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        max: 2147483647,
        unit: "active touch point count",
      },
    });
    expect(byPath.get("TouchPoints.N.WindowX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        unit: "touch point window coordinate",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "TouchPoints.N uses the zero-based Object Tree touch point index.",
      },
    });
    expect(byPath.get("TouchPoints.N.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        unit: "touch point coordinate",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("TouchPoints.WindowWidth")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        unit: "touch point window size",
      },
    });
    expect(evidenceByPath.get("TouchPoints.N.X")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "TouchPoints.0",
    });

    const gaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "TouchPoints" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(gaps).toHaveLength(0);
  });

  it("ships issue 216 final Object Tree gap write/readback coverage", () => {
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
    }>("object-property-ranges/final-gaps/leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/final-gaps/leftover-readbacks.json");
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
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-final-gaps.json");

    const expectedValuePaths = new Set([
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.ScanRateSliderMax",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "Location.N.LastTick",
    ]);
    const expectedReadbackPaths = new Set([
      "Config.FxRowCount",
      "DmxIO.DoBeep",
      "DmxIO.MuteInput",
      "DmxIO.MuteOutput",
      "MasterLC.FX7",
      "MasterLC.FX8",
      "MasterLC.SatShift",
      "MasterLC.VisiblePointsEnd",
      "MasterLC.VisiblePointsStart",
      "PlayListState.Duration",
    ]);
    const expectedPaths = new Set([...expectedValuePaths, ...expectedReadbackPaths]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackPaths);
    expect(evidence.entries).toHaveLength(16);
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
        row?.testedValues.some(
          (testedValue) => testedValue.behavior === "pass-through" && Number(testedValue.input) > 100000,
        ),
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

    expect(byPath.get("Location.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Location.N uses the zero-based Object Tree location index.",
      },
    });
    expect(evidenceByPath.get("Location.N.Color")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "Location.0",
    });

    const roots = new Set(["Config", "DmxIO", "Location", "MasterLC", "PlayListState"]);
    const gaps = objectPropertyIndex.entries.filter(
      (entry) =>
        roots.has(entry.root) && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );
    expect(gaps).toHaveLength(0);
  });

  it("ships observed MultiCue and OneCue cue limit ranges from issue 367", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedPaths = [
      "MultiCue.BeamCueLimit",
      "MultiCue.DmxCueLimit",
      "MultiCue.FlashCueLimit",
      "MultiCue.HoldCueLimit",
      "MultiCue.PerGridLimit",
      "MultiCue.PerZoneLimit",
      "MultiCue.ScriptCueLimit",
      "MultiCue.ShowCueLimit",
      "OneCue.BeamCueLimit",
      "OneCue.DmxCueLimit",
      "OneCue.FlashCueLimit",
      "OneCue.HoldCueLimit",
      "OneCue.PerGridLimit",
      "OneCue.PerZoneLimit",
      "OneCue.ScriptCueLimit",
      "OneCue.ShowCueLimit",
    ];
    const issue367 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #367 confirmed "),
    );

    expect(issue367.map((entry) => entry.path).sort()).toEqual([...expectedPaths].sort());
    for (const path of expectedPaths) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "cue limit count",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
      expect(metadata.locationContext, path).toBeUndefined();
      expect(metadata.notes, path).toContain("baseline restore");
    }
  });

  it("ships observed CoreManager and VideoOutput range metadata from issue 326", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue326 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #326 confirmed "),
    );

    expect(issue326.map((entry) => entry.path).sort()).toEqual([
      "CoreManager.OnlineMode",
      "VideoOutput1.Height",
      "VideoOutput1.Left",
      "VideoOutput1.Top",
      "VideoOutput1.Width",
    ]);
    for (const entry of issue326) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("CoreManager.OnlineMode")?.valueMetadata).toMatchObject({
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
        evidenceLevel: "observed",
      },
    });
    for (const path of ["VideoOutput1.Left", "VideoOutput1.Top"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -32768,
          max: 32767,
          unit: "screen coordinate",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }
    for (const path of ["VideoOutput1.Width", "VideoOutput1.Height"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 48,
          max: 65535,
          unit: "pixels",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const path of [
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.FxRowCount",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
      "Gamepad.AxisX",
      "Gamepad.Buttons",
      "MultiCue.BeamCueLimit",
      "OneCue.BeamCueLimit",
    ]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #326 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships observed UserInterface front-view domain metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const frontView = byPath.get("UserInterface.FrontView")?.valueMetadata;
    assertObjectPropertyValueMetadata(frontView as ObjectPropertyValueMetadata);
    expect(frontView).toMatchObject({
      valueType: "enum",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 3,
        unit: "main view mode",
        boundaryBehavior: "no-op",
      },
      acceptedValues: [
        {
          value: 0,
          label: "GRID",
        },
        {
          value: 1,
          label: "TIMELINE",
        },
        {
          value: 2,
          label: "PLAYLIST",
        },
        {
          value: 3,
          label: "UNIVERSE",
        },
      ],
    });
    expect(hasManualReadyValueMetadata(frontView as ObjectPropertyValueMetadata)).toBe(true);
  });

  it("ships observed PlayListState playing domain without DmxIO no-op metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const playing = byPath.get("PlayListState.Playing")?.valueMetadata;
    assertObjectPropertyValueMetadata(playing as ObjectPropertyValueMetadata);
    expect(playing).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      acceptedValues: [
        {
          value: 0,
          label: "STOPPED",
        },
        {
          value: 1,
          label: "PLAYING",
        },
      ],
    });
    expect(hasManualReadyValueMetadata(playing as ObjectPropertyValueMetadata)).toBe(true);

    const position = byPath.get("PlayListState.Position")?.valueMetadata;
    assertObjectPropertyValueMetadata(position as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(position as ObjectPropertyValueMetadata)).toBe(false);

    for (const path of ["DmxIO.DoBeep", "DmxIO.MuteInput", "DmxIO.MuteOutput", "PlayListState.Duration"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed grid click-mode enum metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const path of ["Grid.ClickMode", "Grid2.ClickMode"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: 1,
          max: 6,
          unit: "click mode",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 1, label: "Select" },
          { value: 2, label: "Flash" },
          { value: 3, label: "SoloFlash" },
          { value: 4, label: "Toggle" },
          { value: 5, label: "Restart" },
          { value: 6, label: "Track" },
        ],
      });
      expect(metadata?.defaultValue).toBeUndefined();
      expect(metadata?.notes).toContain("Runtime command write/readback on 2026-05-12");
    }
  });

  it("ships directly observed Grid2 size metadata and dynamic workspace index ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Grid2.GetColCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 16,
        unit: "columns",
        boundaryBehavior: "mixed",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid2.GetRowCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 16,
        unit: "rows",
        boundaryBehavior: "mixed",
        evidenceLevel: "observed",
      },
    });

    expect(byPath.get("Grid2.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "inferred",
      valueRange: {
        min: 1,
        max: 256,
        unit: "cue slots",
        boundaryBehavior: "mixed",
        evidenceLevel: "inferred",
      },
    });

    expect(byPath.get("Grid.PageIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "loaded workspace page count" },
        unit: "page index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });
    expect(
      hasManualReadyValueMetadata(byPath.get("Grid.PageIndex")?.valueMetadata as ObjectPropertyValueMetadata),
    ).toBe(true);
    expect(byPath.get("Grid2.PageIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "loaded workspace page count" },
        unit: "page index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid.CellIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "Grid.Count", sourcePaths: ["Grid.Count"] },
        unit: "cell index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid2.CellIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "Grid2.GetColCount * Grid2.GetRowCount" },
        unit: "cell index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const path of [
      "ProTrack.N.PageIndex",
      "ProTrack1.PageIndex",
      "ProTrack2.PageIndex",
      "ProTrack3.PageIndex",
      "ProTrack4.PageIndex",
      "ProTrack5.PageIndex",
      "ProTrack6.PageIndex",
      "ProTrack7.PageIndex",
      "ProTrack8.PageIndex",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata)).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          dynamicMax: { expression: "loaded workspace page count - 1" },
          unit: "page index",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          {
            value: -1,
            label: "DISABLED",
          },
        ],
      });
    }
  });

  it("ships directly observed MIDI1 layer metadata without sibling-device propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const metadata = byPath.get("MIDI1.Layer")?.valueMetadata;
    assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
    expect(metadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 12,
        unit: "MIDI layer",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);

    for (const path of ["MIDI2.Layer", "MIDI3.Layer", "MIDI4.Layer"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("issue #281"), path).toBe(false);
    }
  });

  it("ships observed input-device and sensor rows from issue 299", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue299 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #299 confirmed "),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue299) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "hardware-instance",
        populationDependent: true,
      });
    }

    expect(issue299).toHaveLength(113);
    expect(countsByRoot).toEqual(
      new Map([
        ["Gamepad", 32],
        ["MIDI2", 13],
        ["MIDI3", 13],
        ["MIDI4", 13],
        ["Skeleton1", 21],
        ["Skeleton2", 21],
      ]),
    );

    expect(byPath.get("Gamepad.Button31")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "gamepad button state",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of ["MIDI2.ButtonMSL", "MIDI3.Layer", "MIDI4.ZoneSelMSL"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 1,
          max: 12,
          unit: "layer index",
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("MobSensor.ButtonA")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "mobile app button state",
        boundaryBehavior: "mixed",
      },
    });
    expect(byPath.get("MobSensor.ButtonA")?.valueMetadata?.notes).toContain("2026-05-25 issue #118");
    for (const path of ["Skeleton1.HeadActive", "Skeleton2.SpineActive"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "skeleton tracking state",
          boundaryBehavior: "clamp",
        },
      });
    }

    for (const path of ["Gamepad.AxisX", "MobSensor.AccelX", "MobSensor.Buttons", "MobSensor.Timestamp"]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #299 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships observed Skeleton coordinate boundary behavior from issue 120 follow-up", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const boundaryEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-120-skeleton-coordinate-boundary-behavior.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const boundaryEvidenceByPath = new Map(boundaryEvidence.entries.map((entry) => [entry.objectPath, entry]));
    const skeletonCoordinates = objectPropertyIndex.entries.filter(
      (entry) =>
        (entry.root === "Skeleton1" || entry.root === "Skeleton2") &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-25 issue #120 confirmed "),
    );
    const countsByRoot = new Map<string, number>();

    expect(boundaryEvidence.entries).toHaveLength(120);

    for (const entry of skeletonCoordinates) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata), entry.path).toBe(true);
      expect(entry.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -999,
          max: 10000000,
          unit: "skeleton coordinate value",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }

    expect(skeletonCoordinates).toHaveLength(120);
    expect(countsByRoot).toEqual(
      new Map([
        ["Skeleton1", 60],
        ["Skeleton2", 60],
      ]),
    );

    for (const path of ["Skeleton1.HeadX", "Skeleton1.SpineZ", "Skeleton2.HeadX", "Skeleton2.SpineZ"]) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata | undefined;
      const evidenceRow = boundaryEvidenceByPath.get(path);

      expect(metadata?.valueRange?.notes, path).toContain("Below-min samples -1000 and -999.5 made WriteLn report");
      expect(evidenceRow, path).toMatchObject({
        shipsMetadata: true,
        valueType: "number",
        boundaryBehavior: "mixed",
      });
      expect(evidenceRow?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -1000, readback: null, behavior: "reject" }),
          expect.objectContaining({ input: -999.5, readback: null, behavior: "reject" }),
          expect.objectContaining({ input: -999, readback: -999, behavior: "pass-through" }),
          expect.objectContaining({ input: 20000000, readback: 20000000, behavior: "pass-through" }),
        ]),
      );
    }
  });

  it("ships observed Gamepad aggregate ranges from issue 299 follow-up", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const [path, unit] of [
      ["Gamepad.Buttons", "signed button bitmask"],
      ["Gamepad.POV", "signed POV value"],
    ] as const) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata | undefined;
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(metadata?.notes).toContain("2026-05-14 issue #299");
    }

    for (const path of [
      "Gamepad.AxisR",
      "Gamepad.AxisU",
      "Gamepad.AxisV",
      "Gamepad.AxisX",
      "Gamepad.AxisY",
      "Gamepad.AxisZ",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("completes Gamepad axis coverage from issue 299 write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/input/gamepad-axis-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-299-gamepad-axis-readbacks.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(readbackOverlay.entries).toHaveLength(6);
    expect(evidence.entries).toHaveLength(6);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(
      new Set(evidence.entries.map((entry) => entry.objectPath)),
    );

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidenceRow = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        valueType: "number",
        probeMode: "readback-only",
        observedValue: 0,
        typeTag: "f",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      expect(evidenceRow, metadata.path).toMatchObject({
        shipsMetadata: false,
        valueType: "number",
        boundaryBehavior: "no-op",
      });
      expect(evidenceRow?.testedValues.every((testedValue) => testedValue.behavior === "no-op")).toBe(true);
      expect(evidenceRow?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -2147483648, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: -1.5, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: 1000000, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: 2147483648, readback: 0, behavior: "no-op" }),
        ]),
      );
    }

    const gamepadRows = objectPropertyIndex.entries.filter((entry) => entry.root === "Gamepad");
    const gamepadGaps = gamepadRows.filter(
      (entry) => !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );

    expect(gamepadRows).toHaveLength(40);
    expect(gamepadRows.filter((entry) => entry.valueMetadata).length).toBe(34);
    expect(gamepadRows.filter((entry) => entry.readbackMetadata).length).toBe(6);
    expect(gamepadGaps).toHaveLength(0);
  });

  it("completes MobSensor coverage from issue 299 and issue 118 write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/input/mobsensor-leftover-controls.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-299-mobsensor-leftovers.json");
    const boundaryEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-118-mobsensor-boundary-behavior.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const boundaryEvidenceByPath = new Map(boundaryEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(18);
    expect(evidence.entries).toHaveLength(18);
    expect(boundaryEvidence.entries).toHaveLength(20);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(
      new Set(evidence.entries.map((entry) => entry.objectPath)),
    );

    for (const entry of rangeOverlay.entries) {
      const metadata = byPath.get(entry.path)?.valueMetadata;

      expect(metadata, entry.path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidenceByPath.get(entry.path), entry.path).toMatchObject({
        shipsMetadata: true,
        evidenceLevel: "observed",
      });
    }

    for (const path of ["MobSensor.AccelX", "MobSensor.GravityZ", "MobSensor.GyroY", "MobSensor.MagnetometerZ"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -4294967296,
          max: 4294967296,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(boundaryEvidenceByPath.get(path)?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -4294967296, readback: -4294967296, behavior: "pass-through" }),
          expect.objectContaining({ input: 4294967296, readback: 4294967296, behavior: "pass-through" }),
        ]),
      );
    }

    for (const path of ["MobSensor.Pitch", "MobSensor.Roll", "MobSensor.Yaw"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -4294967296,
          max: 4294967296,
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      });
      expect(boundaryEvidenceByPath.get(path)?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -2147483649, readback: -2147483648, behavior: "unknown" }),
          expect.objectContaining({ input: 4294967296, readback: 4294967296, behavior: "pass-through" }),
        ]),
      );
    }

    for (const path of ["MobSensor.ButtonA", "MobSensor.ButtonB", "MobSensor.ButtonC", "MobSensor.ButtonD"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "mobile app button state",
          boundaryBehavior: "mixed",
        },
      });
      expect(boundaryEvidenceByPath.get(path)?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: 0, readback: 0, behavior: "pass-through" }),
          expect.objectContaining({ input: 1, readback: 1, behavior: "pass-through" }),
          expect.objectContaining({ input: 2, readback: 1, behavior: "unknown" }),
        ]),
      );
    }

    expect(byPath.get("MobSensor.Buttons")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed mobile app button bitmask",
        boundaryBehavior: "wrap",
      },
    });
    expect(evidenceByPath.get("MobSensor.Buttons")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    expect(byPath.get("MobSensor.Timestamp")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed mobile app timestamp value",
        boundaryBehavior: "wrap",
      },
    });
    expect(evidenceByPath.get("MobSensor.Timestamp")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -1.5, readback: -2, behavior: "unknown" }),
        expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    const mobSensorGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "MobSensor" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(mobSensorGaps).toHaveLength(0);
  });

  it("ships directly observed MasterLC object-property ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directMasterLc = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.path.startsWith("MasterLC.") &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directMasterLc).toHaveLength(23);
    for (const entry of directMasterLc) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
    }

    expect(byPath.get("MasterLC.BeamBrush")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.PositionX")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.RotoSpeedZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1440,
        max: 1440,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX7")?.valueMetadata).toBeUndefined();
  });

  it("ships manual-ready Master state object-property metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Master.Pause")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      defaultValue: 0,
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Master.TransitionState")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 1,
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Master.ShowSpeed")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -2147483648,
        max: 1000000,
        unit: "show speed",
        boundaryBehavior: "pass-through",
      },
    });
  });

  it("ships observed Master numeric boundary behavior from issue 128", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        valueRange: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue: number;
        };
      }>;
    }>("object-range-evidence/issue-128-master-numeric-boundary-behavior.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const expectedPaths = [
      "Master.CueLcSpeed",
      "Master.CueSpeed",
      "Master.FXSpeed",
      "Master.LCSpeed",
      "Master.MasterEffectClockShift",
      "Master.MasterEffectMetroShift",
      "Master.ShowShift",
      "Master.ZoneFxSpeed",
    ];

    expect(evidence.entries).toHaveLength(expectedPaths.length);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(new Set(expectedPaths));

    for (const path of expectedPaths) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata | undefined;
      const evidenceRow = evidenceByPath.get(path);

      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483648,
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      });
      expect(metadata?.valueRange?.notes, path).toContain("issue #128");
      expect(evidenceRow, path).toMatchObject({
        probeMode: "write-readback",
        shipsMetadata: true,
        valueType: "number",
        evidenceLevel: "observed",
        boundaryBehavior: "mixed",
        valueRange: {
          min: -2147483648,
          max: 2147483648,
          unit: metadata?.valueRange?.unit,
        },
        restore: {
          strategy: "restored-baseline",
        },
      });
      expect(evidenceRow?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -2147483649, readback: -2147483648, behavior: "clamp" }),
          expect.objectContaining({ input: -2147483647, readback: -2147483648, behavior: "unknown" }),
          expect.objectContaining({ input: -120000, readback: -120000, behavior: "pass-through" }),
          expect.objectContaining({ input: 1.5, readback: 1.5, behavior: "pass-through" }),
          expect.objectContaining({ input: 2147483647, readback: 2147483648, behavior: "unknown" }),
          expect.objectContaining({ input: 2147483649, readback: 2147483648, behavior: "clamp" }),
        ]),
      );
    }
  });

  it("ships directly observed issue 291 Master and MasterLC range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue291 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #291"),
    );

    expect(issue291).toHaveLength(177);
    expect(issue291.filter((entry) => entry.root === "Master")).toHaveLength(101);
    expect(issue291.filter((entry) => entry.root === "MasterLC")).toHaveLength(76);
    for (const entry of issue291) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Master.FX1Mute")?.valueMetadata).toMatchObject({
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
    expect(byPath.get("Master.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.FX1TimeScaleClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.EffectChannelAction8")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "action value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.Pan")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.DropDuration")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.01,
        max: 30,
        unit: "seconds",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.DmxMaster")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1Mute")?.valueMetadata).toMatchObject({
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
    expect(byPath.get("MasterLC.FX1TimeMulClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time multiplier",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1TimeScaleMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1TimeShiftClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.HueShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "Master.FX7",
      "Master.FX8",
      "Master.MasterBrightness",
      "MasterLC.FX7",
      "MasterLC.FX8",
      "MasterLC.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed issue 322 Master remaining range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue322 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #322"),
    );

    expect(issue322).toHaveLength(13);
    expect(issue322.filter((entry) => entry.root === "Master")).toHaveLength(8);
    expect(issue322.filter((entry) => entry.root === "MasterLC")).toHaveLength(5);
    for (const entry of issue322) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Master.CueFinishTime")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0,
        max: 5,
        unit: "seconds",
      },
    });
    expect(byPath.get("Master.CueRule")?.valueMetadata).toMatchObject({
      valueType: "enum",
      valueRange: {
        min: 0,
        max: 2,
        unit: "cue rule",
      },
      acceptedValues: [
        { value: 0, label: "RULE_0" },
        { value: 1, label: "RULE_1" },
        { value: 2, label: "RULE_2" },
      ],
    });
    expect(byPath.get("Master.DisplayPopupTimeout")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0.1,
        max: 60,
        unit: "seconds",
      },
    });
    expect(byPath.get("Master.RotoAccX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
      },
    });
    expect(byPath.get("MasterLC.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("MasterLC.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
      },
    });
    expect(byPath.get("MasterLC.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
      },
    });

    for (const path of [
      "Master.CueUnPauseTime",
      "Master.MasterBrightness",
      "Master.VisiblePointsEnd",
      "MasterLC.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed issue 368 MasterLC saturation range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue368 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #368"),
    );

    expect(issue368.map((entry) => entry.path)).toEqual(["MasterLC.Saturation"]);
    const saturation = byPath.get("MasterLC.Saturation")?.valueMetadata;
    assertObjectPropertyValueMetadata(saturation as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(saturation as ObjectPropertyValueMetadata)).toBe(true);
    expect(saturation).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -100,
        max: 100,
        unit: "saturation",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const path of ["Master.SatShift", "MasterLC.SatShift", "MasterLC.VisiblePointsEnd"]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #368") ??
          false,
        path,
      ).toBe(false);
    }
  });
});
