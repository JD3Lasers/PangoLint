import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dataRoot = path.join(process.cwd(), "data", "pangoscript");
const auditPath = path.join(dataRoot, "object-tree", "audits", "data-quality", "final-object-data-quality-audit.json");

describe("final Object Tree data quality audit", () => {
  it("captures final coverage, quality checks, and remaining advisory review buckets", () => {
    expect(existsSync(auditPath)).toBe(true);

    const report = readJson<DataQualityReport>("object-tree/audits/data-quality/final-object-data-quality-audit.json");
    const index = readJson<ObjectPropertyIndexFile>("object-property-index.json");
    const crosswalkSummary = readJson<ControlCrosswalkSummary>("control-reference/control-crosswalk/summary.json");
    const controlReference = readJson<ControlReferenceFile>(
      "control-reference/mcp-control-reference/property-controls.json",
    );
    const indexPaths = new Set(index.entries.map((entry) => entry.path));
    const sharedControlReferenceObjectRows = controlReference.entries.filter(
      (entry) => entry.kind === "object" && indexPaths.has(entry.path),
    ).length;

    expect(report.schemaVersion).toBe(1);
    expect(report.generatedAt).toBe("2026-05-17T00:00:00.000Z");
    expect(report.summary.totalEntries).toBe(index.entries.length);
    expect(report.summary.classifiedEntries).toBe(index.entries.filter((entry) => entry.classification).length);
    expect(report.summary.unclassifiedEntries).toBe(0);
    expect(report.summary.hardViolationCount).toBe(0);
    expect(report.summary.warningCount).toBe(3);
    expect(report.summary.unverifiedUnknownRows).toBe(0);
    expect(report.summary.readOnlyRowsWithDomainMetadata).toBe(9);
    expect(report.summary.readMostlyRowsWithoutValueMetadata).toBe(30);
    expect(report.summary.unknownBoundaryBehaviorRows).toBe(6);
    expect(report.summary.crosswalkPropertiesWithBehaviorClassification).toBe(
      crosswalkSummary.propertiesWithBehaviorClassification,
    );
    expect(report.summary.crosswalkPropertiesMissingBehaviorClassification).toBe(0);
    expect(report.summary.behaviorSourceFactEntries).toBe(index.entries.length);
    expect(report.summary.behaviorSourceFactDuplicateRows).toBe(0);
    expect(report.summary.behaviorSourceFactsMissingIndexRows).toBe(0);
    expect(report.summary.sharedControlReferenceObjectRows).toBe(sharedControlReferenceObjectRows);
    expect(report.summary.controlReferenceBehaviorMismatches).toBe(0);
    expect(report.summary.metadataMutualExclusionViolations).toBe(0);
    expect(report.summary.writeTestedRowsMissingOutputMetadata).toBe(0);

    expect(report.checks.map((check) => [check.id, check.severity, check.status, check.count])).toEqual([
      ["classification-complete", "error", "pass", 0],
      ["classification-fields-known", "error", "pass", 0],
      ["read-write-has-value-metadata", "error", "pass", 0],
      ["read-only-has-readback-or-domain", "error", "pass", 0],
      ["flag-state-domain", "error", "pass", 0],
      ["computed-status-access", "error", "pass", 0],
      ["observed-classifications-prove-known-behavior", "error", "pass", 0],
      ["control-crosswalk-classification-parity", "error", "pass", 0],
      ["behavior-source-fact-duplicates", "error", "pass", 0],
      ["behavior-source-facts-reach-index", "error", "pass", 0],
      ["mcp-control-behavior-parity", "error", "pass", 0],
      ["metadata-kind-exclusive", "error", "pass", 0],
      ["write-tested-has-output-metadata", "error", "pass", 0],
      ["unverified-unknown-readback-only", "warning", "pass", 0],
      ["read-only-domain-metadata-review", "warning", "warn", 9],
      ["read-mostly-value-metadata-review", "warning", "warn", 30],
      ["unknown-boundary-behavior", "warning", "warn", 6],
    ]);

    const unverifiedFx = report.reviewBuckets.find((bucket) => bucket.id === "unverified-unknown-readback-only");
    const readOnlyDomain = report.reviewBuckets.find((bucket) => bucket.id === "read-only-domain-metadata-review");
    const readMostlyValueMetadata = report.reviewBuckets.find(
      (bucket) => bucket.id === "read-mostly-value-metadata-review",
    );
    const unknownBoundary = report.reviewBuckets.find((bucket) => bucket.id === "unknown-boundary-behavior");
    expect(unverifiedFx?.count).toBe(0);
    expect(unverifiedFx?.roots).toEqual([]);
    expect(unverifiedFx?.examples).toEqual([]);
    expect(readOnlyDomain?.count).toBe(9);
    expect(readOnlyDomain?.examples).toContain("ColorChannel.Count");
    expect(readOnlyDomain?.examples).toContain("PlayListState.Position");
    expect(readMostlyValueMetadata?.count).toBe(30);
    expect(readMostlyValueMetadata?.roots).toEqual([
      { root: "Universe", count: 25 },
      { root: "FX", count: 2 },
      { root: "UniversePanelAlias", count: 1 },
      { root: "Zone", count: 1 },
      { root: "ZoneAlias", count: 1 },
    ]);
    expect(readMostlyValueMetadata?.examples).toContain("Universe.N.Button1.ColorOff");
    expect(readMostlyValueMetadata?.examples).toContain("FX.N.N.N.Chase.Manual");
    expect(readMostlyValueMetadata?.examples).not.toContain("PlayListState.Playing");
    expect(unknownBoundary?.count).toBe(6);
    expect(unknownBoundary?.roots.at(0)).toEqual({ root: "FB4_XXXXX", count: 6 });
    expect(unknownBoundary?.roots).toHaveLength(1);
    expect(unknownBoundary?.roots.some((row) => row.root === "Gamepad")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "ColorChannel")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Grid")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Grid2")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Location")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "PlayListState")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Projector")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Status")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "TouchPoints")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "Zone")).toBe(false);
    expect(unknownBoundary?.roots.some((row) => row.root === "ZoneAlias")).toBe(false);
    expect(unknownBoundary?.examples).not.toContain("Beam.N.ColorPalette");
    expect(unknownBoundary?.examples).not.toContain("Beam.N.RotoZ");
    expect(unknownBoundary?.examples).not.toContain("FB3_XXXXX.Connected");
    expect(unknownBoundary?.examples).not.toContain("FB3_XXXXX.InvertX");
    expect(unknownBoundary?.examples).not.toContain("FB3_XXXXX.PositionX");
    expect(unknownBoundary?.examples).toContain("FB4_XXXXX.PositionX");

    expect(report.spotCheckPlan.length).toBeGreaterThanOrEqual(20);
    expect(report.spotCheckPlan.map((row) => row.path)).toEqual(
      [...report.spotCheckPlan.map((row) => row.path)].sort((left, right) => left.localeCompare(right)),
    );
    expect(report.spotCheckPlan).toContainEqual(
      expect.objectContaining({
        path: "Master.ShowSpeed",
        reason: "representative read-write state-value observed row",
      }),
    );
    expect(report.spotCheckPlan).toContainEqual(
      expect.objectContaining({
        path: "DmxIO.DoBeep",
        reason: "representative read-only computed-status observed row",
      }),
    );
    expect(report.spotCheckPlan).toContainEqual(
      expect.objectContaining({
        path: "FX.N.N.N.Keys.A",
        reason: "representative FX row promoted by write/readback retest",
      }),
    );

    expect(report.boundaryProbePlan).toEqual([
      {
        root: "FB4_XXXXX",
        accessMode: "read-write",
        behaviorKind: "state-value",
        valueType: "number",
        count: 6,
        examples: [
          "FB4_XXXXX.PositionX",
          "FB4_XXXXX.PositionY",
          "FB4_XXXXX.PostRotation",
          "FB4_XXXXX.PreRotation",
          "FB4_XXXXX.SizeX",
        ],
        nextProbe:
          "Run write/readback samples around the stored min and max plus one lower and one higher sample, then restore baseline values.",
      },
    ]);
  });
});

interface DataQualityReport {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    totalEntries: number;
    classifiedEntries: number;
    unclassifiedEntries: number;
    hardViolationCount: number;
    warningCount: number;
    unverifiedUnknownRows: number;
    readOnlyRowsWithDomainMetadata: number;
    readMostlyRowsWithoutValueMetadata: number;
    unknownBoundaryBehaviorRows: number;
    crosswalkPropertiesWithBehaviorClassification: number;
    crosswalkPropertiesMissingBehaviorClassification: number;
    behaviorSourceFactEntries: number;
    behaviorSourceFactDuplicateRows: number;
    behaviorSourceFactsMissingIndexRows: number;
    sharedControlReferenceObjectRows: number;
    controlReferenceBehaviorMismatches: number;
    metadataMutualExclusionViolations: number;
    writeTestedRowsMissingOutputMetadata: number;
  };
  checks: Array<{
    id: string;
    severity: "error" | "warning";
    status: "pass" | "warn" | "fail";
    count: number;
  }>;
  reviewBuckets: Array<{
    id: string;
    count: number;
    roots: Array<{ root: string; count: number }>;
    examples: string[];
    nextAction: string;
  }>;
  spotCheckPlan: Array<{
    path: string;
    root: string;
    accessMode: string;
    behaviorKind: string;
    evidenceLevel: string;
    reason: string;
  }>;
  boundaryProbePlan: Array<{
    root: string;
    accessMode: string;
    behaviorKind: string;
    valueType: string;
    count: number;
    examples: string[];
    nextProbe: string;
  }>;
}

interface ObjectPropertyIndexFile {
  entries: Array<{
    path: string;
    classification?: unknown;
  }>;
}

interface ControlCrosswalkSummary {
  propertiesWithBehaviorClassification: number;
}

interface ControlReferenceFile {
  entries: Array<{
    path: string;
    kind: string;
  }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(dataRoot, runtimeIndexPath(relativePath)), "utf8")) as T;
}

function runtimeIndexPath(relativePath: string): string {
  if (relativePath === "object-property-index.json") {
    return path.join("object-tree", "runtime-indexes", relativePath);
  }
  return relativePath;
}
