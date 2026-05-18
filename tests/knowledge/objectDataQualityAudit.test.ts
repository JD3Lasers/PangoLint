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

    expect(report.schemaVersion).toBe(1);
    expect(report.generatedAt).toBe("2026-05-17T00:00:00.000Z");
    expect(report.summary.totalEntries).toBe(index.entries.length);
    expect(report.summary.classifiedEntries).toBe(index.entries.filter((entry) => entry.classification).length);
    expect(report.summary.unclassifiedEntries).toBe(0);
    expect(report.summary.hardViolationCount).toBe(0);
    expect(report.summary.warningCount).toBe(1);
    expect(report.summary.unverifiedUnknownRows).toBe(0);
    expect(report.summary.readOnlyRowsWithDomainMetadata).toBe(9);
    expect(report.summary.crosswalkPropertiesWithBehaviorClassification).toBe(
      crosswalkSummary.propertiesWithBehaviorClassification,
    );
    expect(report.summary.crosswalkPropertiesMissingBehaviorClassification).toBe(0);

    expect(report.checks.map((check) => [check.id, check.severity, check.status, check.count])).toEqual([
      ["classification-complete", "error", "pass", 0],
      ["classification-fields-known", "error", "pass", 0],
      ["read-write-has-value-metadata", "error", "pass", 0],
      ["read-only-has-readback-or-domain", "error", "pass", 0],
      ["flag-state-domain", "error", "pass", 0],
      ["computed-status-access", "error", "pass", 0],
      ["observed-classifications-prove-known-behavior", "error", "pass", 0],
      ["control-crosswalk-classification-parity", "error", "pass", 0],
      ["unverified-unknown-readback-only", "warning", "pass", 0],
      ["read-only-domain-metadata-review", "warning", "warn", 9],
    ]);

    const unverifiedFx = report.reviewBuckets.find((bucket) => bucket.id === "unverified-unknown-readback-only");
    const readOnlyDomain = report.reviewBuckets.find((bucket) => bucket.id === "read-only-domain-metadata-review");
    expect(unverifiedFx?.count).toBe(0);
    expect(unverifiedFx?.roots).toEqual([]);
    expect(unverifiedFx?.examples).toEqual([]);
    expect(readOnlyDomain?.count).toBe(9);
    expect(readOnlyDomain?.examples).toContain("ColorChannel.Count");
    expect(readOnlyDomain?.examples).toContain("PlayListState.Position");

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
    crosswalkPropertiesWithBehaviorClassification: number;
    crosswalkPropertiesMissingBehaviorClassification: number;
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
}

interface ObjectPropertyIndexFile {
  entries: Array<{
    classification?: unknown;
  }>;
}

interface ControlCrosswalkSummary {
  propertiesWithBehaviorClassification: number;
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
