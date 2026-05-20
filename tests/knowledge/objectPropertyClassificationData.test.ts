import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dataDir = path.join(process.cwd(), "data", "pangoscript");
const issue484OverlayPath = dataPath("object-property-classifications/issue-484-observed-state-rows.json");
const issue485OverlayPath = dataPath("object-property-classifications/issue-485-write-tested-readbacks.json");
const issue486DirectOverlayPath = dataPath(
  "object-property-classifications/issue-486-qshift-direct-write-readbacks.json",
);
const issue486QShiftAOverlayPath = dataPath("object-property-classifications/issue-486-qshift-a-write-readbacks.json");
const issue486QShiftBOverlayPath = dataPath("object-property-classifications/issue-486-qshift-b-write-readbacks.json");
const issue486UniverseCommonOverlayPath = dataPath(
  "object-property-classifications/issue-486-universe-common-write-readbacks.json",
);
const issue486UniverseZoneOverlayPath = dataPath(
  "object-property-classifications/issue-486-universe-zone-write-readbacks.json",
);
const issue486UniversePanelAliasOverlayPath = dataPath(
  "object-property-classifications/issue-486-universe-panel-alias-write-readbacks.json",
);
const issue486ZoneZoneAliasOverlayPath = dataPath(
  "object-property-classifications/issue-486-zone-zonealias-write-readbacks.json",
);
const issue499GamepadFlagStateOverlayPath = dataPath(
  "object-property-classifications/issue-499-gamepad-flag-state.json",
);
const issue501BeamFlagStateOverlayPath = dataPath("object-property-classifications/issue-501-beam-flag-state.json");
const issue503SmallBehaviorRowsOverlayPath = dataPath(
  "object-property-classifications/issue-503-small-behavior-rows.json",
);
const issue487FxFlagStateOverlayPath = dataPath("object-property-classifications/issue-487-fx-flag-state.json");
const issue487WsBehaviorRowsOverlayPath = dataPath("object-property-classifications/issue-487-ws-behavior-rows.json");
const issue487UniverseBehaviorRowsOverlayPath = dataPath(
  "object-property-classifications/issue-487-universe-behavior-rows.json",
);
const issue513FxReadbackRetestOverlayPath = dataPath(
  "object-property-classifications/issue-513-fx-readback-retest.json",
);
const issue513FxReadbackRetestEvidencePath = path.join(
  dataDir,
  "object-tree",
  "evidence",
  "behavior",
  "issue-513-fx-readback-retest.json",
);
const issue513FxReadbackRetestRangePath = dataPath(
  "object-property-ranges/fx/issue-513-readback-retest-pass-through.json",
);
const issue513FxReadbackRetestRangeEvidencePath = path.join(
  dataDir,
  "object-tree",
  "evidence",
  "value",
  "issue-513-fx-readback-retest-ranges.json",
);

describe("Object Tree behavior classification data", () => {
  it("classifies observed non-boolean read-write state rows for issue 484", () => {
    expect(existsSync(issue484OverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const existingRootOverlay = readJson<ClassificationOverlayFile>("object-property-classifications.json");
    const overlay = JSON.parse(readFileSync(issue484OverlayPath, "utf8")) as ClassificationOverlayFile;
    const issue486DirectOverlay = JSON.parse(
      readFileSync(issue486DirectOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486UniverseCommonOverlay = JSON.parse(
      readFileSync(issue486UniverseCommonOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486UniversePanelAliasOverlay = JSON.parse(
      readFileSync(issue486UniversePanelAliasOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486ZoneZoneAliasOverlay = JSON.parse(
      readFileSync(issue486ZoneZoneAliasOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue513FxReadbackRetestOverlay = JSON.parse(
      readFileSync(issue513FxReadbackRetestOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const previouslyClassified = new Set(existingRootOverlay.entries.map((entry) => entry.path));
    const laterClassified = new Set(
      issue486DirectOverlay.entries
        .concat(issue486UniverseCommonOverlay.entries)
        .concat(issue486UniversePanelAliasOverlay.entries)
        .concat(issue486ZoneZoneAliasOverlay.entries)
        .concat(issue513FxReadbackRetestOverlay.entries)
        .map((entry) => entry.path),
    );
    const expectedRows = index.entries
      .filter((entry) => !previouslyClassified.has(entry.path))
      .filter((entry) => !laterClassified.has(entry.path))
      .map((entry) => ({
        entry,
        valueRows: candidateValueRows(entry),
      }))
      .filter((row) => row.valueRows.length > 0);

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedRows.map((row) => row.entry.path));
    expect(overlay.entries.length).toBe(2539);

    const expectedByPath = new Map(expectedRows.map((row) => [row.entry.path, row.valueRows]));
    for (const entry of overlay.entries) {
      const valueRows = expectedByPath.get(entry.path) ?? [];
      expect(valueRows.length, entry.path).toBeGreaterThan(0);
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.behaviorKind, entry.path).toBe(behaviorKindForRows(valueRows));
      expect(entry.writeTestStatus, entry.path).toBe(writeTestStatusForRows(valueRows));
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("Value domain evidence remains in value metadata.");
    }

    expect(overlay.entries.find((entry) => entry.path === "ActGridFocusedCue.Caption")?.behaviorKind).toBe(
      "string-state",
    );
    expect(overlay.entries.find((entry) => entry.path === "Master.CueRule")?.behaviorKind).toBe("enum-state");
    expect(overlay.entries.find((entry) => entry.path === "Master.BPM")?.writeTestStatus).toBe(
      "command-readback-tested",
    );
    expect(overlay.entries.some((entry) => entry.path === "Master.AudioVolumeMute")).toBe(false);
    expect(overlay.entries.some((entry) => entry.path === "ColorChannel.Count")).toBe(false);
  });

  it("classifies write-tested readback rows for issue 485", () => {
    expect(existsSync(issue485OverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const rootOverlay = readJson<ClassificationOverlayFile>("object-property-classifications.json");
    const issue484Overlay = JSON.parse(readFileSync(issue484OverlayPath, "utf8")) as ClassificationOverlayFile;
    const issue485Overlay = JSON.parse(readFileSync(issue485OverlayPath, "utf8")) as ClassificationOverlayFile;
    const issue486QShiftAOverlay = JSON.parse(
      readFileSync(issue486QShiftAOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486QShiftBOverlay = JSON.parse(
      readFileSync(issue486QShiftBOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486UniverseCommonOverlay = JSON.parse(
      readFileSync(issue486UniverseCommonOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486UniverseZoneOverlay = JSON.parse(
      readFileSync(issue486UniverseZoneOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486UniversePanelAliasOverlay = JSON.parse(
      readFileSync(issue486UniversePanelAliasOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue486ZoneZoneAliasOverlay = JSON.parse(
      readFileSync(issue486ZoneZoneAliasOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const issue513FxReadbackRetestOverlay = JSON.parse(
      readFileSync(issue513FxReadbackRetestOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const previouslyClassified = new Set(
      rootOverlay.entries.concat(issue484Overlay.entries).map((entry) => entry.path),
    );
    const laterClassified = new Set(
      issue486QShiftAOverlay.entries
        .concat(issue486QShiftBOverlay.entries)
        .concat(issue486UniverseCommonOverlay.entries)
        .concat(issue486UniverseZoneOverlay.entries)
        .concat(issue486UniversePanelAliasOverlay.entries)
        .concat(issue486ZoneZoneAliasOverlay.entries)
        .concat(issue513FxReadbackRetestOverlay.entries)
        .map((entry) => entry.path),
    );
    const expectedRows = index.entries
      .filter((entry) => !previouslyClassified.has(entry.path))
      .filter((entry) => !laterClassified.has(entry.path))
      .filter((entry) => entry.readbackMetadata && hasWriteTestedReadbackEvidence(entry.readbackMetadata));

    expect(issue485Overlay.schemaVersion).toBe(1);
    expect(issue485Overlay.entries.map((entry) => entry.path)).toEqual(expectedRows.map((entry) => entry.path));
    expect(issue485Overlay.entries.length).toBe(284);
    expect(issue485Overlay.entries.filter((entry) => entry.accessMode === "read-only").length).toBe(284);
    expect(issue485Overlay.entries.filter((entry) => entry.accessMode === "unknown").length).toBe(0);

    const readbackByPath = new Map(expectedRows.map((entry) => [entry.path, entry.readbackMetadata]));
    for (const entry of issue485Overlay.entries) {
      const readbackMetadata = readbackByPath.get(entry.path);
      expect(readbackMetadata, entry.path).toBeDefined();
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.notes, entry.path).toContain("Readback evidence remains in readback metadata.");

      if (isStrongNoOpReadback(readbackMetadata)) {
        expect(entry.accessMode, entry.path).toBe("read-only");
        expect(entry.behaviorKind, entry.path).toBe("computed-status");
        expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
        expect(entry.evidenceLevel, entry.path).toBe("observed");
      } else {
        expect(entry.accessMode, entry.path).toBe("unknown");
        expect(entry.behaviorKind, entry.path).toBe("unknown");
        expect(entry.writeTestStatus, entry.path).toBe("not-tested");
        expect(entry.evidenceLevel, entry.path).toBe("unverified");
      }
    }

    expect(issue485Overlay.entries.find((entry) => entry.path === "DmxIO.DoBeep")?.accessMode).toBe("read-only");
    expect(issue485Overlay.entries.some((entry) => entry.path === "FX.N.N.N.Keys.A")).toBe(false);
    expect(issue485Overlay.entries.some((entry) => entry.path === "QShift.N.A.Alpha")).toBe(false);
    expect(issue485Overlay.entries.some((entry) => entry.path === "QShift.N.B.Alpha")).toBe(false);
  });

  it("classifies Gamepad button flag-state rows for issue 499", () => {
    expect(existsSync(issue499GamepadFlagStateOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue499GamepadFlagStateOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expectedPaths = ["Gamepad.Active", ...Array.from({ length: 31 }, (_, index) => `Gamepad.Button${index + 1}`)];

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedPaths);
    expect(overlay.entries.length).toBe(32);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.behaviorKind, entry.path).toBe("flag-state");
      expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #299");
      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies Beam boolean flag-state rows for issue 501", () => {
    expect(existsSync(issue501BeamFlagStateOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue501BeamFlagStateOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expectedPaths = ["Beam.N.Active", "Beam.N.AllowRecolor", "Beam.N.LockPos", "Beam.N.Mute"];

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedPaths);
    expect(overlay.entries.length).toBe(4);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.behaviorKind, entry.path).toBe("flag-state");
      expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #298");
      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies FX boolean flag-state rows for issue 487", () => {
    expect(existsSync(issue487FxFlagStateOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue487FxFlagStateOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expectedPaths = [
      "FX.N.N.EnableClockLimit",
      "FX.N.N.EnableMetroLimit",
      "FX.N.N.N.Enabled",
      "FX.N.N.N.Oscillator.Absinvert",
      "FX.N.N.N.Oscillator.Absrevwave",
      "FX.N.N.N.TimeActive",
      "FX.N.N.N.TimeDurationInBeat",
      "FX.N.N.N.TimeEnabled",
    ];

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedPaths);
    expect(overlay.entries.length).toBe(8);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      const valueRows = [
        ...(indexEntry?.valueMetadata ? [indexEntry.valueMetadata] : []),
        ...(indexEntry?.contextValueMetadata ?? []),
      ];
      expect(valueRows.length, entry.path).toBeGreaterThan(0);
      expect(
        valueRows.every((row) => row.valueType === "boolean"),
        entry.path,
      ).toBe(true);
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.behaviorKind, entry.path).toBe("flag-state");
      expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("Value domain evidence remains in value metadata.");
      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies FX readback retest rows for issue 513", () => {
    expect(existsSync(issue513FxReadbackRetestOverlayPath)).toBe(true);
    expect(existsSync(issue513FxReadbackRetestEvidencePath)).toBe(true);
    expect(existsSync(issue513FxReadbackRetestRangePath)).toBe(true);
    expect(existsSync(issue513FxReadbackRetestRangeEvidencePath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const audit = readJson<{
      summary: {
        unverifiedUnknownRows: number;
        hardViolationCount: number;
        entriesWithBothValueAndReadbackMetadata: number;
      };
    }>("object-tree/audits/data-quality/final-object-data-quality-audit.json");
    const overlay = JSON.parse(readFileSync(issue513FxReadbackRetestOverlayPath, "utf8")) as ClassificationOverlayFile;
    const rangeOverlay = JSON.parse(readFileSync(issue513FxReadbackRetestRangePath, "utf8")) as RangeOverlayFile;
    const evidence = JSON.parse(readFileSync(issue513FxReadbackRetestEvidencePath, "utf8")) as BehaviorEvidenceFile;
    const fxReadbacks = readJson<{ entries: Array<{ path: string }> }>(
      "object-property-readbacks/fx/identifier-safe-readbacks.json",
    );

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries).toHaveLength(154);
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.summary.rowsProbed).toBe(154);
    expect(evidence.summary.rowsClassified).toBe(154);
    expect(evidence.summary.rowsDeferred).toBe(0);
    expect(audit.summary.unverifiedUnknownRows).toBe(0);
    expect(audit.summary.hardViolationCount).toBe(0);
    expect(audit.summary.entriesWithBothValueAndReadbackMetadata).toBe(0);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-write")).toHaveLength(151);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-mostly")).toHaveLength(2);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-only")).toHaveLength(1);
    expect(rangeOverlay.schemaVersion).toBe(1);
    expect(rangeOverlay.entries).toHaveLength(151);

    const indexByPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const readbackPaths = new Set(fxReadbacks.entries.map((entry) => entry.path));
    const evidenceByPath = new Map(evidence.results.map((entry) => [entry.objectPath, entry]));
    const rangeByPath = new Map(rangeOverlay.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = indexByPath.get(entry.path);
      const evidenceEntry = evidenceByPath.get(entry.path);
      expect(entry.path.startsWith("FX."), entry.path).toBe(true);
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #513");
      expect(evidenceEntry?.baselineOk, entry.path).toBe(true);
      expect(evidenceEntry?.setPropResults.length, entry.path).toBeGreaterThan(0);
      expect(evidenceEntry?.directAssignmentResults.length, entry.path).toBeGreaterThan(0);
      expect(evidenceEntry?.restore?.ok, entry.path).toBe(true);
      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: entry.accessMode,
        behaviorKind: entry.behaviorKind,
        writeTestStatus: entry.writeTestStatus,
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });

      if (entry.accessMode === "read-write") {
        const rangeEntry = rangeByPath.get(entry.path);
        expect(rangeEntry, entry.path).toBeDefined();
        expect(readbackPaths.has(entry.path), entry.path).toBe(false);
        expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
        expect(indexEntry?.valueMetadata?.valueRange?.min, entry.path).toBe(-2147483648);
        expect(indexEntry?.valueMetadata?.valueRange?.max, entry.path).toBe(120000);
        expect(indexEntry?.valueMetadata?.valueRange?.boundaryBehavior, entry.path).toBe("pass-through");
      } else {
        expect(readbackPaths.has(entry.path), entry.path).toBe(true);
        expect(rangeByPath.has(entry.path), entry.path).toBe(false);
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("issue #513");
      }
    }

    expect(overlay.entries.find((entry) => entry.path === "FX.N.N.N.Keys.A")?.accessMode).toBe("read-write");
    expect(overlay.entries.find((entry) => entry.path === "FX.N.N.N.Chase.Manual")?.accessMode).toBe("read-mostly");
    expect(overlay.entries.find((entry) => entry.path === "FX.N.N.N.Oscillator.Channel")?.accessMode).toBe(
      "read-mostly",
    );
    expect(overlay.entries.find((entry) => entry.path === "FX.N.N.N.Oscillator.CENTERX")?.accessMode).toBe("read-only");
  });

  it("classifies WS boolean-like behavior rows for issue 487", () => {
    expect(existsSync(issue487WsBehaviorRowsOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue487WsBehaviorRowsOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expectedPaths = [
      "WS.N.N.Ani.0.Muted",
      "WS.N.N.Ani.0.PreventReroute",
      "WS.N.N.Ani.0.Solo",
      "WS.N.N.Ani.0.tsStretchGrouping",
      "WS.N.N.Effect.EnableClockLimit",
      "WS.N.N.Effect.EnableMetroLimit",
      "WS.N.N.FX1Mute",
      "WS.N.N.FX2Mute",
      "WS.N.N.FX3Mute",
      "WS.N.N.FX4Mute",
      "WS.N.N.FX5Mute",
      "WS.N.N.FX6Mute",
      "WS.N.N.FX7Mute",
      "WS.N.N.FX8Mute",
      "WS.N.N.Image.AutoRecord",
      "WS.N.N.Image.BeamConnect",
      "WS.N.N.Image.BounceMaxX",
      "WS.N.N.Image.BounceMaxY",
      "WS.N.N.Image.BounceMaxZ",
      "WS.N.N.Image.BounceMinX",
      "WS.N.N.Image.BounceMinY",
      "WS.N.N.Image.BounceMinZ",
      "WS.N.N.Image.Effect.EnableClockLimit",
      "WS.N.N.Image.Effect.EnableMetroLimit",
      "WS.N.N.Image.EnableRecord",
      "WS.N.N.Image.EnableRecording",
      "WS.N.N.Image.EnableStaticMode",
      "WS.N.N.Image.GlobalCharTime",
      "WS.N.N.Image.LIST.0.Effect.EnableClockLimit",
      "WS.N.N.Image.LIST.0.Effect.EnableMetroLimit",
      "WS.N.N.Image.LIST.0.Image.BeamConnect",
      "WS.N.N.Image.LIST.0.Image.EnableRecording",
      "WS.N.N.Image.LIST.0.Image.PhysicsActive",
      "WS.N.N.Image.LIST.0.Image.ShowCorners",
      "WS.N.N.Image.LIST.0.Muted",
      "WS.N.N.Image.MonoSpaced",
      "WS.N.N.Image.PhysicsActive",
      "WS.N.N.Image.ShowCorners",
    ];
    const commandReadbackPaths = new Set([
      "WS.N.N.Ani.0.tsStretchGrouping",
      "WS.N.N.Image.BounceMaxX",
      "WS.N.N.Image.BounceMaxY",
      "WS.N.N.Image.BounceMaxZ",
      "WS.N.N.Image.BounceMinX",
      "WS.N.N.Image.BounceMinY",
      "WS.N.N.Image.BounceMinZ",
      "WS.N.N.Image.GlobalCharTime",
    ]);

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedPaths);
    expect(overlay.entries.length).toBe(38);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      const valueRows = [
        ...(indexEntry?.valueMetadata ? [indexEntry.valueMetadata] : []),
        ...(indexEntry?.contextValueMetadata ?? []),
      ];
      expect(valueRows.length, entry.path).toBeGreaterThan(0);
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("Value domain evidence remains in value metadata.");
      expect(entry.writeTestStatus, entry.path).toBe(
        commandReadbackPaths.has(entry.path) ? "command-readback-tested" : "write-readback-tested",
      );

      if (entry.path === "WS.N.N.Image.GlobalCharTime") {
        expect(
          valueRows.every((row) => row.valueType === "integer"),
          entry.path,
        ).toBe(true);
        expect(entry.behaviorKind, entry.path).toBe("state-value");
      } else {
        expect(
          valueRows.every((row) => row.valueType === "boolean"),
          entry.path,
        ).toBe(true);
        expect(entry.behaviorKind, entry.path).toBe("flag-state");
      }

      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: "read-write",
        behaviorKind: entry.behaviorKind,
        writeTestStatus: entry.writeTestStatus,
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies Universe control behavior rows for issue 487", () => {
    expect(existsSync(issue487UniverseBehaviorRowsOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const audit = readJson<{ byRoot: Array<{ root: string; needsActionFlagReviewRows: number }> }>(
      "object-tree/audits/behavior/issue-216-object-behavior-audit.json",
    );
    const overlay = JSON.parse(
      readFileSync(issue487UniverseBehaviorRowsOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.length).toBe(139);
    expect(new Set(overlay.entries.map((entry) => entry.path)).size).toBe(139);
    expect(overlay.entries.every((entry) => entry.path.startsWith("Universe."))).toBe(true);
    expect(overlay.entries.filter((entry) => entry.behaviorKind === "flag-state").length).toBe(64);
    expect(overlay.entries.filter((entry) => entry.behaviorKind === "state-value").length).toBe(75);
    expect(audit.byRoot.find((row) => row.root === "Universe")?.needsActionFlagReviewRows).toBe(0);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const byOverlayPath = new Map(overlay.entries.map((entry) => [entry.path, entry]));
    expect(byOverlayPath.get("Universe.N.Button1.Selected")?.behaviorKind).toBe("flag-state");
    expect(byOverlayPath.get("Universe.N.Button1.Value")?.behaviorKind).toBe("state-value");
    expect(byOverlayPath.get("Universe.N.DropEff1.Effect.EnableClockLimit")?.behaviorKind).toBe("flag-state");
    expect(byOverlayPath.get("Universe.N.ZonePad2.X")?.behaviorKind).toBe("state-value");

    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      const valueRows = [
        ...(indexEntry?.valueMetadata ? [indexEntry.valueMetadata] : []),
        ...(indexEntry?.contextValueMetadata ?? []),
      ];
      expect(indexEntry?.root, entry.path).toBe("Universe");
      expect(valueRows.length, entry.path).toBeGreaterThan(0);
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("checked-in Universe value metadata");
      expect(entry.notes, entry.path).toContain("Value domain evidence remains in value metadata.");

      if (entry.behaviorKind === "flag-state") {
        expect(
          valueRows.every((row) => row.valueType === "boolean"),
          entry.path,
        ).toBe(true);
      } else {
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(
          valueRows.every((row) => row.valueType === "number"),
          entry.path,
        ).toBe(true);
      }

      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: "read-write",
        behaviorKind: entry.behaviorKind,
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies small Object Tree behavior rows for issue 503", () => {
    expect(existsSync(issue503SmallBehaviorRowsOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue503SmallBehaviorRowsOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expected = new Map<string, ExpectedClassification>([
      ...classificationRows(
        [
          "Channels.N.PhActive",
          "Config.CaptureAsLocal",
          "Config.FocusMidiClicks",
          "Config.HideOutputPreviewInMutedProjectionZones",
          "Config.ShowAudioTab",
          "CoreManager.OnlineMode",
          "FB3_XXXXX.InvertX",
          "FB3_XXXXX.InvertY",
          "FB3_XXXXX.SwapXY",
          "FB4_XXXXX.InvertX",
          "FB4_XXXXX.InvertY",
          "FB4_XXXXX.SwapXY",
          "MobSensor.ButtonA",
          "MobSensor.ButtonB",
          "MobSensor.ButtonC",
          "MobSensor.ButtonD",
          "Projector.N.InvertX",
          "Projector.N.InvertY",
          "Projector.N.SwapXY",
          "TouchPoints.N.Active",
          "VideoOutput1.Visible",
        ],
        { accessMode: "read-write", behaviorKind: "flag-state", writeTestStatus: "write-readback-tested" },
      ),
      ...classificationRows(
        ["Channels.N.Reflection", "Channels.N.Value", "Location.N.X", "Location.N.Y", "Location.N.Z"],
        {
          accessMode: "read-write",
          behaviorKind: "state-value",
          writeTestStatus: "write-readback-tested",
        },
      ),
      ...classificationRows(
        ["FB3_XXXXX.Connected", "FB4_XXXXX.Connected", "Location.Count", "Projector.N.Connected", "TouchPoints.Count"],
        { accessMode: "read-only", behaviorKind: "computed-status", writeTestStatus: "not-applicable" },
      ),
      ...classificationRows(["PlayListState.Playing", "Status.LaserEnabled", "Status.Locked"], {
        accessMode: "read-mostly",
        behaviorKind: "flag-state",
        writeTestStatus: "command-readback-tested",
      }),
    ]);

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries).toHaveLength(34);
    expect(new Set(overlay.entries.map((entry) => entry.path))).toEqual(new Set(expected.keys()));

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const expectedClassification = expected.get(entry.path);
      const indexEntry = byPath.get(entry.path);
      expect(expectedClassification, entry.path).toBeDefined();
      expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
      expect(entry).toMatchObject({
        ...expectedClassification,
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      expect(entry.notes, entry.path).toContain("Value domain evidence remains in value metadata.");
      expect(indexEntry?.classification, entry.path).toEqual({
        accessMode: entry.accessMode,
        behaviorKind: entry.behaviorKind,
        writeTestStatus: entry.writeTestStatus,
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
        notes: entry.notes,
      });
    }
  });

  it("classifies direct QShift write/readback rows for issue 486", () => {
    expect(existsSync(issue486DirectOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486DirectOverlayPath, "utf8")) as ClassificationOverlayFile;
    const expectedPaths = [
      "QShift.N.Action",
      "QShift.N.Color",
      "QShift.N.DivValue",
      "QShift.N.ModValue",
      "QShift.N.PhaseDir",
      "QShift.N.Width",
    ];

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(expectedPaths);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
      expect(entry.accessMode, entry.path).toBe("read-write");
      expect(entry.behaviorKind, entry.path).toBe("state-value");
      expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #486");
    }

    expect(byPath.get("QShift.N.Action")?.valueMetadata?.valueType).toBe("number");
    expect(byPath.get("QShift.N.Color")?.valueMetadata?.valueType).toBe("integer");
    expect(byPath.get("QShift.N.Width")?.valueMetadata?.valueRange?.max).toBe(1000000);
  });

  it("classifies QShift A write/readback no-op rows for issue 486", () => {
    expect(existsSync(issue486QShiftAOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486QShiftAOverlayPath, "utf8")) as ClassificationOverlayFile;
    const qshiftAReadbacks = index.entries.filter((entry) => entry.path.startsWith("QShift.N.A."));

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(qshiftAReadbacks.map((entry) => entry.path));
    expect(overlay.entries).toHaveLength(113);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("sampled writes");
      expect(entry.accessMode, entry.path).toBe("read-only");
      expect(entry.behaviorKind, entry.path).toBe("computed-status");
      expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
    }
  });

  it("classifies QShift B write/readback no-op rows for issue 486", () => {
    expect(existsSync(issue486QShiftBOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486QShiftBOverlayPath, "utf8")) as ClassificationOverlayFile;
    const qshiftBReadbacks = index.entries.filter((entry) => entry.path.startsWith("QShift.N.B."));

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(qshiftBReadbacks.map((entry) => entry.path));
    expect(overlay.entries).toHaveLength(113);

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("non-baseline sampled writes");
      expect(entry.accessMode, entry.path).toBe("read-only");
      expect(entry.behaviorKind, entry.path).toBe("computed-status");
      expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
    }
  });

  it("classifies Universe common write/readback rows for issue 486", () => {
    expect(existsSync(issue486UniverseCommonOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486UniverseCommonOverlayPath, "utf8")) as ClassificationOverlayFile;
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const universeCommonRows = index.entries.filter(
      (entry) =>
        entry.path.startsWith("Universe.N.") &&
        [
          "CenterX",
          "CenterY",
          "ColorActive",
          "ColorOff",
          "ColorOn",
          "DropDuration",
          "MaxValue",
          "MinValue",
          "Radius",
          "Tag",
          "TimeShift",
        ].includes(entry.path.split(".").at(-1) ?? ""),
    );

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(universeCommonRows.map((entry) => entry.path));
    expect(overlay.entries).toHaveLength(275);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-write")).toHaveLength(250);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-mostly")).toHaveLength(25);

    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #486");

      if (entry.path.endsWith(".ColorOff")) {
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(entry.accessMode, entry.path).toBe("read-mostly");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      } else {
        expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
        expect(entry.accessMode, entry.path).toBe("read-write");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      }
    }
  });

  it("classifies Universe nested Zone write/readback no-op rows for issue 486", () => {
    expect(existsSync(issue486UniverseZoneOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486UniverseZoneOverlayPath, "utf8")) as ClassificationOverlayFile;
    const readbackOverlay = readJson<{ entries: Array<{ path: string }> }>(
      "object-property-readbacks/universe/zone-nested-readbacks.json",
    );
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries.map((entry) => entry.path)).toEqual(readbackOverlay.entries.map((entry) => entry.path));
    expect(overlay.entries).toHaveLength(606);

    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
      expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
      expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("non-baseline sampled writes");
      expect(entry.accessMode, entry.path).toBe("read-only");
      expect(entry.behaviorKind, entry.path).toBe("computed-status");
      expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #486");
    }
  });

  it("classifies UniversePanelAlias write/readback rows for issue 486", () => {
    expect(existsSync(issue486UniversePanelAliasOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(
      readFileSync(issue486UniversePanelAliasOverlayPath, "utf8"),
    ) as ClassificationOverlayFile;
    const readbackOverlay = readJson<{ entries: Array<{ path: string }> }>(
      "object-property-readbacks/universe-panel-alias/typed-control-readbacks.json",
    );
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const promotedPaths = new Set([
      "UniversePanelAlias.Control.CenterX",
      "UniversePanelAlias.Control.CenterY",
      "UniversePanelAlias.Control.ColorActive",
      "UniversePanelAlias.Control.ColorOn",
      "UniversePanelAlias.Control.DropDuration",
      "UniversePanelAlias.Control.MaxValue",
      "UniversePanelAlias.Control.MinValue",
      "UniversePanelAlias.Control.Radius",
      "UniversePanelAlias.Control.Tag",
      "UniversePanelAlias.Control.TimeShift",
    ]);

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries).toHaveLength(533);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-write")).toHaveLength(10);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-mostly")).toHaveLength(1);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-only")).toHaveLength(522);
    expect(readbackOverlay.entries).toHaveLength(523);

    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #486");

      if (promotedPaths.has(entry.path)) {
        expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
        expect(entry.accessMode, entry.path).toBe("read-write");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      } else if (entry.path === "UniversePanelAlias.Control.ColorOff") {
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("color samples");
        expect(entry.accessMode, entry.path).toBe("read-mostly");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      } else {
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata?.notes, entry.path).toContain("non-baseline sampled writes");
        expect(entry.accessMode, entry.path).toBe("read-only");
        expect(entry.behaviorKind, entry.path).toBe("computed-status");
        expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
      }
    }
  });

  it("classifies Zone and ZoneAlias write/readback rows for issue 486", () => {
    expect(existsSync(issue486ZoneZoneAliasOverlayPath)).toBe(true);

    const index = readJson<ObjectIndexFile>("object-property-index.json");
    const overlay = JSON.parse(readFileSync(issue486ZoneZoneAliasOverlayPath, "utf8")) as ClassificationOverlayFile;
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const promotedPaths = new Set(
      [
        readJson<{ entries: Array<{ path: string }> }>("object-property-ranges/zone/readback-retest-promotions.json"),
        readJson<{ entries: Array<{ path: string }> }>(
          "object-property-ranges/zone-alias/readback-retest-promotions.json",
        ),
      ].flatMap((file) => file.entries.map((entry) => entry.path)),
    );
    const transformedPaths = new Set(["Zone.N.ProjectorIndex", "ZoneAlias.ProjectorIndex"]);

    expect(overlay.schemaVersion).toBe(1);
    expect(overlay.entries).toHaveLength(101);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-write")).toHaveLength(77);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-mostly")).toHaveLength(2);
    expect(overlay.entries.filter((entry) => entry.accessMode === "read-only")).toHaveLength(22);

    for (const entry of overlay.entries) {
      const indexEntry = byPath.get(entry.path);
      expect(entry.readbackStatus, entry.path).toBe("readback-tested");
      expect(entry.evidenceLevel, entry.path).toBe("observed");
      expect(entry.notes, entry.path).toContain("issue #486");

      if (promotedPaths.has(entry.path)) {
        expect(indexEntry?.valueMetadata, entry.path).toBeDefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeUndefined();
        expect(entry.accessMode, entry.path).toBe("read-write");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      } else if (transformedPaths.has(entry.path)) {
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(entry.accessMode, entry.path).toBe("read-mostly");
        expect(entry.behaviorKind, entry.path).toBe("state-value");
        expect(entry.writeTestStatus, entry.path).toBe("write-readback-tested");
      } else {
        expect(indexEntry?.valueMetadata, entry.path).toBeUndefined();
        expect(indexEntry?.readbackMetadata, entry.path).toBeDefined();
        expect(entry.accessMode, entry.path).toBe("read-only");
        expect(entry.behaviorKind, entry.path).toBe("computed-status");
        expect(entry.writeTestStatus, entry.path).toBe("write-no-op-tested");
      }
    }
  });
});

interface ObjectIndexFile {
  entries: ObjectIndexEntry[];
}

interface ObjectIndexEntry {
  path: string;
  root?: string;
  valueMetadata?: ValueMetadata;
  readbackMetadata?: ReadbackMetadata;
  contextValueMetadata?: ValueMetadata[];
  classification?: Omit<ClassificationEntry, "path">;
}

interface ValueMetadata {
  valueType?: string;
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: unknown;
    boundaryBehavior?: string;
    notes?: string;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
    label?: string;
  }>;
  evidenceLevel?: string;
  notes?: string;
}

interface ClassificationOverlayFile {
  schemaVersion: 1;
  entries: ClassificationEntry[];
}

interface ReadbackMetadata {
  notes?: string;
}

interface ClassificationEntry {
  path: string;
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel: string;
  notes: string;
}

interface BehaviorEvidenceFile {
  schemaVersion: 1;
  summary: {
    rowsProbed: number;
    rowsClassified: number;
    rowsDeferred: number;
  };
  results: BehaviorEvidenceEntry[];
}

interface BehaviorEvidenceEntry {
  objectPath: string;
  baselineOk: boolean;
  setPropResults: Array<{
    input: string | number;
    readback?: string | number;
  }>;
  directAssignmentResults: Array<{
    input: string | number;
    readback?: string | number;
  }>;
  restore?: {
    ok: boolean;
  };
}

interface RangeOverlayFile {
  schemaVersion: 1;
  entries: RangeOverlayEntry[];
}

interface RangeOverlayEntry {
  path: string;
  valueRange: {
    min?: number;
    max?: number;
    boundaryBehavior?: string;
  };
}

type ExpectedClassification = Omit<ClassificationEntry, "path" | "notes" | "evidenceLevel" | "readbackStatus">;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, runtimeIndexPath(relativePath)), "utf8")) as T;
}

function runtimeIndexPath(relativePath: string): string {
  if (relativePath === "object-property-index.json") {
    return path.join("object-tree", "runtime-indexes", relativePath);
  }
  return objectTreeSourceFactPath(relativePath);
}

function dataPath(relativePath: string): string {
  return path.join(dataDir, objectTreeSourceFactPath(relativePath));
}

function objectTreeSourceFactPath(relativePath: string): string {
  if (relativePath === "object-property-ranges.json") {
    return path.join("object-tree", "source-facts", "value-metadata", "root.json");
  }
  if (relativePath.startsWith("object-property-ranges/")) {
    const childPath =
      relativePath === "object-property-ranges/zone/direct-leftover-controls.json"
        ? path.join("zone", "visualization-id-range.json")
        : relativePath.slice("object-property-ranges/".length);
    return path.join("object-tree", "source-facts", "value-metadata", childPath);
  }
  if (relativePath === "object-property-readbacks.json") {
    return path.join("object-tree", "source-facts", "readback-metadata", "root.json");
  }
  if (relativePath.startsWith("object-property-readbacks/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "readback-metadata",
      relativePath.slice("object-property-readbacks/".length),
    );
  }
  if (relativePath === "object-property-classifications.json") {
    return path.join("object-tree", "source-facts", "behavior-metadata", "root.json");
  }
  if (relativePath.startsWith("object-property-classifications/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "behavior-metadata",
      relativePath.slice("object-property-classifications/".length),
    );
  }
  return relativePath;
}

function classificationRows(
  paths: string[],
  classification: ExpectedClassification,
): Array<[string, ExpectedClassification]> {
  return paths.map((path) => [path, classification]);
}

function candidateValueRows(entry: ObjectIndexEntry): Array<ValueMetadata & { writeTestStatus: string }> {
  const rows = [...(entry.valueMetadata ? [entry.valueMetadata] : []), ...(entry.contextValueMetadata ?? [])];
  return rows.flatMap((metadata) => {
    const writeTestStatus = writeTestStatusForMetadata(metadata);
    return writeTestStatus ? [{ ...metadata, writeTestStatus }] : [];
  });
}

function writeTestStatusForMetadata(metadata: ValueMetadata): string | undefined {
  const evidenceText = [metadata.notes, metadata.valueRange?.notes].filter(Boolean).join(" ");
  if (
    metadata.evidenceLevel !== "observed" ||
    !hasValueDomainEvidence(metadata) ||
    isBooleanLike(metadata) ||
    hasFlagActionTokens(metadata) ||
    /readback-only/i.test(evidenceText)
  ) {
    return undefined;
  }

  if (
    /command-derived seed/i.test(evidenceText) ||
    /command[-/]write\/readback|command\/readback|command readback|Fresh MCP (?:write\/read )?probe|Fresh MCP write\/read probes|SetPlayListView|four main view commands/i.test(
      evidenceText,
    )
  ) {
    return "command-readback-tested";
  }

  if (
    /object write\/readback|runtime .*write\/readback|SetProp write\/readback|Direct object writes|Direct assignment write\/readback|Checked-in runtime write\/readback evidence|readbacks:|baseline restore/i.test(
      evidenceText,
    )
  ) {
    return "write-readback-tested";
  }

  return undefined;
}

function hasWriteTestedReadbackEvidence(metadata: ReadbackMetadata): boolean {
  return /write\/readback|SetProp|write attempts|sampled writes|writes behaved|did not change|no-op|stayed at baseline|stayed at observed baseline|stayed at the observed baseline/i.test(
    metadata.notes ?? "",
  );
}

function isStrongNoOpReadback(metadata: ReadbackMetadata | undefined): boolean {
  return /did not change|no-op|no op|behaved as no-op|stayed at baseline|stayed at observed baseline|stayed at the observed baseline|read back baseline|read back the same/i.test(
    metadata?.notes ?? "",
  );
}

function hasValueDomainEvidence(metadata: ValueMetadata): boolean {
  return Boolean(
    (metadata.valueRange &&
      ((metadata.valueRange.min !== undefined && metadata.valueRange.max !== undefined) ||
        (metadata.valueRange.min !== undefined && metadata.valueRange.dynamicMax !== undefined))) ||
      metadata.acceptedValues?.length,
  );
}

function isBooleanLike(metadata: ValueMetadata): boolean {
  if (metadata.valueType === "boolean") return true;
  const acceptedValues = new Set((metadata.acceptedValues ?? []).map((entry) => String(entry.value)));
  if (acceptedValues.size === 2 && acceptedValues.has("0") && acceptedValues.has("1")) return true;
  return metadata.valueRange?.min === 0 && metadata.valueRange.max === 1;
}

function hasFlagActionTokens(metadata: ValueMetadata): boolean {
  return (metadata.acceptedValues ?? [])
    .flatMap((entry) => [entry.value, entry.label])
    .filter((value) => value !== undefined)
    .some((value) => ["on", "off", "toggle"].includes(String(value).toLowerCase()));
}

function behaviorKindForRows(rows: ValueMetadata[]): string {
  const valueType = rows[0]?.valueType;
  if (valueType === "string") return "string-state";
  if (valueType === "enum") return "enum-state";
  return "state-value";
}

function writeTestStatusForRows(rows: Array<ValueMetadata & { writeTestStatus: string }>): string {
  const statuses = new Set(rows.map((row) => row.writeTestStatus));
  expect(statuses.size).toBe(1);
  return rows[0]?.writeTestStatus ?? "not-tested";
}
