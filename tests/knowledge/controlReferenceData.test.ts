import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks } from "../../scripts/package/publicArtifactPolicy";

const dataRoot = path.join(process.cwd(), "data", "pangoscript", "control-reference");

describe("tracked BEYOND control reference data", () => {
  it("ships the organized dataset groups needed by docs and lookup work", () => {
    expect(existsSync(path.join(dataRoot, "README.md"))).toBe(true);
    expect(existsSync(path.join(dataRoot, "package-policy.json"))).toBe(true);
    expect(datasetGroups()).toEqual([
      "command-control-reference",
      "control-crosswalk",
      "mcp-control-reference",
      "object-control-reference",
      "osc-control-reference",
    ]);

    expect(readJson<SummaryFile>("object-control-reference/summary.json")).toMatchObject({
      schemaVersion: 4,
      entryCounts: {
        workspaceCueTypes: 18,
        universeComponentTypes: 24,
        fxEffectTypes: 145,
        propertyIndexEntries: 1096,
      },
    });
    expect(readJson<SummaryFile>("osc-control-reference/summary.json")).toMatchObject({
      schemaVersion: 1,
      routeCount: 192,
      propertyTargetCount: 184,
    });
    expect(readJson<SummaryFile>("command-control-reference/summary.json")).toMatchObject({
      schemaVersion: 1,
      commandCount: 529,
      commandsWithTargetProperties: 203,
    });
    expect(readJson<SummaryFile>("mcp-control-reference/summary.json")).toMatchObject({
      schemaVersion: 1,
      propertyControlCount: 5380,
      propertiesWithPangoScriptCommands: 184,
      propertiesWithOscRoutes: 94,
    });
  });

  it("documents the public checkout contract and package consumers", () => {
    const readme = readFileSync(path.join(dataRoot, "README.md"), "utf8");
    expect(readme).toContain("Normal public development");

    const policy = readJson<ControlReferencePackagePolicy>("package-policy.json");
    expect(policy.schemaVersion).toBe(1);
    expect(policy.publicCheckoutContract.trackedFilesOnly).toBe(true);
    expect(policy.publicCheckoutContract.normalPublicGates).toEqual(
      expect.arrayContaining([
        "npm run build:knowledge",
        "npm run compile",
        "npm test",
        "npm run verify:package",
        "npm --workspace mcp run verify:tarball",
        "npm run check",
      ]),
    );
    expect(policy.publicCheckoutContract.ignoredInputsNotRequired).toEqual([]);
    expect(policy.forbiddenPublicPackageInputs).toEqual(expect.arrayContaining(["maintainer-only evidence"]));

    const groupsById = new Map(policy.dataGroups.map((group) => [group.id, group]));
    for (const id of [
      "object-control-reference",
      "osc-control-reference",
      "command-control-reference",
      "control-crosswalk",
      "mcp-control-reference",
      "package-policy",
    ]) {
      const group = groupsById.get(id);
      expect(group, id).toBeDefined();
      expect(group?.intendedConsumers.length, id).toBeGreaterThan(0);
      expect(group?.vsixSurface.trim(), id).not.toBe("");
      expect(group?.mcpSurface.trim(), id).not.toBe("");
    }
  });

  it("carries Object Tree behavior classification into the property-first crosswalk", () => {
    const summary = readJson<{
      propertiesWithBehaviorClassification: number;
      propertiesMissingBehaviorClassification: number;
    }>("control-crosswalk/summary.json");
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const showSpeed = crosswalk.find((row) => row.normalizedPropertyPattern === "Master.ShowSpeed");
    const bpm = crosswalk.find((row) => row.normalizedPropertyPattern === "Master.BPM");
    const doBeep = crosswalk.find((row) => row.normalizedPropertyPattern === "DmxIO.DoBeep");
    const fxClockLimit = crosswalk.find((row) => row.normalizedPropertyPattern === "FX.N.N.EnableClockLimit");
    const fxKeyA = crosswalk.find((row) => row.normalizedPropertyPattern === "FX.N.N.N.Keys.A");
    const qshiftAAlpha = crosswalk.find((row) => row.normalizedPropertyPattern === "QShift.N.A.Alpha");
    const qshiftBAlpha = crosswalk.find((row) => row.normalizedPropertyPattern === "QShift.N.B.Alpha");
    const qshiftWidth = crosswalk.find((row) => row.normalizedPropertyPattern === "QShift.N.Width");
    const universeButtonCenterX = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "Universe.N.Button1.CenterX",
    );
    const universeButtonColorOff = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "Universe.N.Button1.ColorOff",
    );
    const universeButtonSelected = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "Universe.N.Button1.Selected",
    );
    const universeButtonValue = crosswalk.find((row) => row.normalizedPropertyPattern === "Universe.N.Button1.Value");
    const universeZoneActive = crosswalk.find((row) => row.normalizedPropertyPattern === "Universe.N.N.Zone.Active");
    const universePanelAliasCenterX = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "UniversePanelAlias.Control.CenterX",
    );
    const universePanelAliasColorOff = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "UniversePanelAlias.Control.ColorOff",
    );
    const universePanelAliasZoneActive = crosswalk.find(
      (row) => row.normalizedPropertyPattern === "UniversePanelAlias.Control.Zone.Active",
    );
    const gamepadActive = crosswalk.find((row) => row.normalizedPropertyPattern === "Gamepad.Active");
    const beamActive = crosswalk.find((row) => row.normalizedPropertyPattern === "Beam.N.Active");
    const channelsValue = crosswalk.find((row) => row.normalizedPropertyPattern === "Channels.N.Value");
    const configShowAudioTab = crosswalk.find((row) => row.normalizedPropertyPattern === "Config.ShowAudioTab");
    const fb4Connected = crosswalk.find((row) => row.normalizedPropertyPattern === "FB4_XXXXX.Connected");
    const wsFx1Mute = crosswalk.find((row) => row.normalizedPropertyPattern === "WS.N.N.FX1Mute");
    const wsBounceMaxX = crosswalk.find((row) => row.normalizedPropertyPattern === "WS.N.N.Image.BounceMaxX");
    const wsGlobalCharTime = crosswalk.find((row) => row.normalizedPropertyPattern === "WS.N.N.Image.GlobalCharTime");

    expect(summary.propertiesWithBehaviorClassification).toBe(5375);
    expect(summary.propertiesMissingBehaviorClassification).toBe(0);
    expect(showSpeed?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(bpm?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "command-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(doBeep?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(fxClockLimit?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(fxKeyA?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(qshiftAAlpha?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(qshiftBAlpha?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(qshiftWidth?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universeButtonCenterX?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universeButtonColorOff?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-mostly",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universeButtonSelected?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universeButtonValue?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universeZoneActive?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universePanelAliasCenterX?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universePanelAliasColorOff?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-mostly",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(universePanelAliasZoneActive?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(gamepadActive?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(beamActive?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(channelsValue?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(configShowAudioTab?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(fb4Connected?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "not-applicable",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(wsFx1Mute?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(wsBounceMaxX?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "flag-state",
      writeTestStatus: "command-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(wsGlobalCharTime?.objectIndexEntries[0]?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "command-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
  });

  it("keeps generated control-reference artifacts public-safe", () => {
    for (const filePath of controlReferenceFiles(dataRoot)) {
      const contents = readFileSync(filePath, "utf8");
      expect(findPublicArtifactLeaks(contents), path.relative(dataRoot, filePath)).toEqual([]);
    }
  });

  it("marks read-only computed-status domains as status domains in MCP control data", () => {
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const fb4Connected = controls.entries.find((entry) => entry.path === "FB4_XXXXX.Connected");
    const masterBrightness = controls.entries.find((entry) => entry.path === "Master.Brightness");

    expect(fb4Connected?.behavior).toMatchObject({
      accessMode: "read-only",
      behaviorKind: "computed-status",
    });
    expect(fb4Connected?.value).toMatchObject({
      role: "status-domain",
      valueType: "boolean",
      range: expect.objectContaining({ min: 0, max: 1 }),
    });
    expect(masterBrightness?.behavior?.accessMode).toBe("read-write");
    expect(masterBrightness?.value?.role).toBeUndefined();
  });

  it("includes Object Tree rows that have no command crosswalk entry", () => {
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");

    expect(crosswalk.some((row) => row.normalizedPropertyPattern === "Projector.Count")).toBe(false);
    expect(controls.entries.find((entry) => entry.path === "Projector.Count")).toMatchObject({
      root: "Projector",
      property: "Count",
      readback: {
        status: "readable",
        accessMechanism: "pangoscript-expression",
        probePath: "Projector.Count",
      },
      behavior: {
        accessMode: "unknown",
        behaviorKind: "computed-status",
      },
    });
  });

  it("keeps Projector boolean boundary behavior synchronized across control-reference surfaces", () => {
    const rangeSeeds = readJson<CommandRangeSeedRow[]>("command-control-reference/range-seeds.json");
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedRange = {
      min: 0,
      max: 1,
      boundaryBehavior: "mixed",
      evidenceLevel: "observed",
    };

    for (const propertyPath of ["Projector.N.InvertX", "Projector.N.InvertY", "Projector.N.SwapXY"]) {
      const seedRow = rangeSeeds.find((row) => row.normalizedPropertyPattern === propertyPath);
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange).toMatchObject(expectedRange);
      expect(mcpRow?.value?.range).toMatchObject(expectedRange);
      expect(crosswalkRow?.objectIndexEntries[0]?.classification).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(mcpRow?.behavior).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });

      if (seedRow?.objectPropertyRanges?.length) {
        expect(seedRow.objectPropertyRanges[0]?.valueRange).toMatchObject(expectedRange);
        expect(crosswalkRow?.rangeSeeds?.objectPropertyRanges?.[0]?.valueRange).toMatchObject(expectedRange);
      }
    }
  });

  it("keeps Gamepad aggregate boundary behavior synchronized across control-reference surfaces", () => {
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedRanges = new Map([
      [
        "Gamepad.Buttons",
        {
          min: -2147483648,
          max: 2147483647,
          unit: "signed button bitmask",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      ],
      [
        "Gamepad.POV",
        {
          min: -2147483648,
          max: 2147483647,
          unit: "signed POV value",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      ],
    ]);

    for (const [propertyPath, expectedRange] of expectedRanges) {
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange).toMatchObject(expectedRange);
      expect(mcpRow?.value?.range).toMatchObject(expectedRange);
      expect(crosswalkRow?.objectIndexEntries[0]?.classification).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(mcpRow?.behavior).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
    }
  });

  it("keeps nonzero boolean boundary behavior synchronized across control-reference surfaces", () => {
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedRange = {
      min: 0,
      max: 1,
      boundaryBehavior: "mixed",
      evidenceLevel: "observed",
    };

    for (const propertyPath of [
      "TouchPoints.N.Active",
      "Zone.N.Active",
      "Zone.N.BlockZone",
      "ZoneAlias.Active",
      "ZoneAlias.BlockZone",
    ]) {
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange).toMatchObject(expectedRange);
      expect(mcpRow?.value?.range).toMatchObject(expectedRange);
      expect(crosswalkRow?.objectIndexEntries[0]?.classification).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(mcpRow?.behavior).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
    }
  });

  it("keeps non-writable status boundary metadata synchronized across control-reference surfaces", () => {
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedNoOpRows = new Set([
      "ColorChannel.Count",
      "Grid.ClickMode",
      "Grid2.ClickMode",
      "PlayListState.Position",
    ]);
    const expectedNoBoundaryRows = new Set([
      "Location.Count",
      "Projector.N.Connected",
      "Status.LaserEnabled",
      "Status.Locked",
      "TouchPoints.Count",
    ]);

    for (const propertyPath of [...expectedNoOpRows, ...expectedNoBoundaryRows]) {
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);
      const crosswalkRange = crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange;
      const mcpRange = mcpRow?.value?.range;

      expect(crosswalkRow?.objectIndexEntries[0]?.classification?.accessMode, propertyPath).toMatch(/read-/);
      expect(mcpRow?.behavior?.accessMode, propertyPath).toMatch(/read-/);

      if (expectedNoOpRows.has(propertyPath)) {
        expect(crosswalkRange?.boundaryBehavior, propertyPath).toBe("no-op");
        expect(mcpRange?.boundaryBehavior, propertyPath).toBe("no-op");
      } else {
        expect(crosswalkRange, propertyPath).not.toHaveProperty("boundaryBehavior");
        expect(mcpRange, propertyPath).not.toHaveProperty("boundaryBehavior");
      }
    }
  });

  it("keeps Beam color palette boundary behavior synchronized across control-reference surfaces", () => {
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedRanges = new Map([
      [
        "Beam.N.ColorPalette",
        {
          min: 0,
          max: 4,
          unit: "beam color palette",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      ],
    ]);

    for (const [propertyPath, expectedRange] of expectedRanges) {
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange).toMatchObject(expectedRange);
      expect(mcpRow?.value?.range).toMatchObject(expectedRange);
      expect(crosswalkRow?.objectIndexEntries[0]?.classification).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "enum-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(mcpRow?.behavior).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "enum-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
    }
  });

  it("keeps SetGridSize parameter boundary behavior synchronized across control-reference surfaces", () => {
    const commands = readJson<CommandControlReferenceCommand[]>("command-control-reference/commands.json");
    const rangeSeeds = readJson<CommandRangeSeedRow[]>("command-control-reference/range-seeds.json");
    const crosswalk = readJson<PropertyControlRow[]>("control-crosswalk/property-control-index.json");
    const controls = readJson<McpControlReferenceFile>("mcp-control-reference/property-controls.json");
    const expectedRanges = [
      {
        commandName: "SetGridSize",
        formSignature: "SetGridSize <columns>, <rows>",
        parameterName: "columns",
        parameterType: "integer",
        range: "1..16",
        valueRange: {
          min: 1,
          max: 16,
          unit: "columns",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      },
      {
        commandName: "SetGridSize",
        formSignature: "SetGridSize <columns>, <rows>",
        parameterName: "rows",
        parameterType: "integer",
        range: "1..16",
        valueRange: {
          min: 1,
          max: 16,
          unit: "rows",
          boundaryBehavior: "mixed",
          evidenceLevel: "observed",
        },
      },
    ];
    const expectedObjectValueRanges = new Map([
      ["Grid.Count", { min: 1, max: 256, unit: "cue slots", boundaryBehavior: "mixed", evidenceLevel: "observed" }],
      ["Grid.GetColCount", { min: 1, max: 16, unit: "columns", boundaryBehavior: "mixed", evidenceLevel: "observed" }],
      ["Grid.GetRowCount", { min: 1, max: 16, unit: "rows", boundaryBehavior: "mixed", evidenceLevel: "observed" }],
      ["Grid2.Count", { min: 1, max: 256, unit: "cue slots", boundaryBehavior: "mixed", evidenceLevel: "inferred" }],
      ["Grid2.GetColCount", { min: 1, max: 16, unit: "columns", boundaryBehavior: "mixed", evidenceLevel: "observed" }],
      ["Grid2.GetRowCount", { min: 1, max: 16, unit: "rows", boundaryBehavior: "mixed", evidenceLevel: "observed" }],
    ]);
    const expectedBehavior = new Map([
      ["Grid.Count", { writeTestStatus: "write-readback-tested" }],
      ["Grid.GetColCount", { writeTestStatus: "command-readback-tested" }],
      ["Grid.GetRowCount", { writeTestStatus: "command-readback-tested" }],
      ["Grid2.Count", { writeTestStatus: "write-readback-tested" }],
      ["Grid2.GetColCount", { writeTestStatus: "command-readback-tested" }],
      ["Grid2.GetRowCount", { writeTestStatus: "command-readback-tested" }],
    ]);
    const setGridSize = commands.find((command) => command.commandName === "SetGridSize");
    const setGridSizeForm = setGridSize?.forms.find((form) => form.signature === "SetGridSize <columns>, <rows>");

    expect(
      (setGridSizeForm?.parameters ?? []).map((parameter) => ({
        parameterName: parameter.name,
        parameterType: parameter.type,
        range: parameter.range,
        valueRange: parameter.valueRange,
      })),
    ).toEqual(expectedRanges.map(({ commandName, formSignature, ...range }) => range));

    for (const propertyPath of ["Grid.Count", "Grid.GetColCount", "Grid.GetRowCount"]) {
      const seedRow = rangeSeeds.find((row) => row.normalizedPropertyPattern === propertyPath);
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(seedRow?.commandParameterRanges).toEqual(expectedRanges);
      expect(crosswalkRow?.rangeSeeds?.commandParameterRanges).toEqual(expectedRanges);
      expect(mcpRow?.pangoScript.parameterRanges).toEqual(expectedRanges);
    }

    for (const [propertyPath, expectedValueRange] of expectedObjectValueRanges) {
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const mcpRow = controls.entries.find((entry) => entry.path === propertyPath);

      expect(crosswalkRow?.objectIndexEntries[0]?.valueMetadata?.valueRange).toMatchObject(expectedValueRange);
      expect(mcpRow?.value?.range).toMatchObject(expectedValueRange);
      expect(crosswalkRow?.objectIndexEntries[0]?.classification).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        ...expectedBehavior.get(propertyPath),
      });
      expect(mcpRow?.behavior).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        ...expectedBehavior.get(propertyPath),
      });
    }

    for (const propertyPath of ["Grid2.GetColCount", "Grid2.GetRowCount"]) {
      const seedRow = rangeSeeds.find((row) => row.normalizedPropertyPattern === propertyPath);
      const crosswalkRow = crosswalk.find((row) => row.normalizedPropertyPattern === propertyPath);
      const expectedValueRange = expectedObjectValueRanges.get(propertyPath) ?? {};

      expect(seedRow?.objectPropertyRanges?.[0]?.valueRange).toMatchObject(expectedValueRange);
      expect(crosswalkRow?.rangeSeeds?.objectPropertyRanges?.[0]?.valueRange).toMatchObject(expectedValueRange);
    }
  });
});

interface SummaryFile {
  schemaVersion: number;
  [key: string]: unknown;
}

interface ControlReferencePackagePolicy {
  schemaVersion: 1;
  publicCheckoutContract: {
    trackedFilesOnly: boolean;
    ignoredInputsNotRequired: string[];
    normalPublicGates: string[];
  };
  dataGroups: Array<{
    id: string;
    intendedConsumers: string[];
    vsixSurface: string;
    mcpSurface: string;
  }>;
  forbiddenPublicPackageInputs: string[];
}

interface PropertyControlRow {
  normalizedPropertyPattern: string;
  objectIndexEntries: Array<{
    path: string;
    valueMetadata?: {
      valueRange?: {
        min?: number;
        max?: number;
        unit?: string;
        boundaryBehavior?: string;
        evidenceLevel?: string;
      };
    };
    classification?: {
      accessMode: string;
      behaviorKind: string;
      writeTestStatus: string;
      readbackStatus: string;
      evidenceLevel: string;
    };
  }>;
  rangeSeeds?: {
    objectPropertyRanges?: Array<{
      valueRange?: {
        min?: number;
        max?: number;
        unit?: string;
        boundaryBehavior?: string;
        evidenceLevel?: string;
      };
    }>;
    commandParameterRanges?: CommandParameterRange[];
  };
}

interface McpControlReferenceFile {
  entries: Array<{
    path: string;
    value?: {
      role?: string;
      valueType?: string;
      range?: {
        min?: number;
        max?: number;
        unit?: string;
        boundaryBehavior?: string;
        evidenceLevel?: string;
      };
    };
    behavior?: {
      accessMode: string;
      behaviorKind: string;
      writeTestStatus?: string;
      readbackStatus?: string;
      evidenceLevel?: string;
    };
    pangoScript: {
      parameterRanges: CommandParameterRange[];
    };
  }>;
}

interface CommandControlReferenceCommand {
  commandName: string;
  forms: Array<{
    signature: string;
    parameters?: Array<{
      name: string;
      type: string;
      range?: string;
      valueRange?: CommandParameterRange["valueRange"];
    }>;
  }>;
}

interface CommandRangeSeedRow {
  normalizedPropertyPattern: string;
  objectPropertyRanges: Array<{
    valueRange?: {
      min?: number;
      max?: number;
      unit?: string;
      boundaryBehavior?: string;
      evidenceLevel?: string;
    };
  }>;
  commandParameterRanges: CommandParameterRange[];
}

interface CommandParameterRange {
  commandName: string;
  formSignature: string;
  parameterName: string;
  parameterType: string;
  range: string;
  valueRange: {
    min: number;
    max: number;
    unit: string;
    boundaryBehavior: string;
    evidenceLevel: string;
  };
}

function datasetGroups(): string[] {
  if (!existsSync(dataRoot)) return [];
  return readdirSync(dataRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(dataRoot, relativePath), "utf8")) as T;
}

function controlReferenceFiles(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) return controlReferenceFiles(entryPath);
    return entry.isFile() && /\.(?:json|jsonl|md)$/.test(entry.name) ? [entryPath] : [];
  });
}
