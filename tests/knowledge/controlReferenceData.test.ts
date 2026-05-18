import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks } from "../../scripts/publicArtifactPolicy";

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
      propertyControlCount: 5379,
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
    const fb4Connected = crosswalk.find((row) => row.normalizedPropertyPattern === "FB4-XXXXX.Connected");
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
    classification?: {
      accessMode: string;
      behaviorKind: string;
      writeTestStatus: string;
      readbackStatus: string;
      evidenceLevel: string;
    };
  }>;
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
