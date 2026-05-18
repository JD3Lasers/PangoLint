import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface ObjectIndexFile {
  schemaVersion: 1;
  entries: ObjectIndexEntry[];
}

interface ObjectIndexEntry {
  path: string;
  root: string;
  valueMetadata?: ValueMetadata;
  readbackMetadata?: ReadbackMetadata;
  contextValueMetadata?: Array<ValueMetadata & { contextId: string }>;
  classification?: {
    accessMode?: string;
    behaviorKind?: string;
    writeTestStatus?: string;
    readbackStatus?: string;
    evidenceLevel?: string;
  };
}

interface ValueMetadata {
  valueType?: string;
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: unknown;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
  }>;
  notes?: string;
  locationContext?: {
    populationDependent?: boolean;
  };
}

interface ReadbackMetadata {
  readable: true;
  probePath: string;
  notes?: string;
  locationContext?: {
    populationDependent?: boolean;
  };
}

interface ReadbackOverlayFile {
  entries: ReadbackOverlayEntry[];
}

interface ReadbackOverlayEntry extends ReadbackMetadata {
  path: string;
}

interface ValueMetadataRow {
  path: string;
  root: string;
  metadata: ValueMetadata;
  classification?: ObjectIndexEntry["classification"];
}

interface ReadbackMetadataRow {
  path: string;
  root: string;
  sourceFile: string;
  metadata: ReadbackOverlayEntry;
}

interface BehaviorAuditReport {
  schemaVersion: 1;
  parentIssue: number;
  generatedAt: string;
  summary: {
    totalEntries: number;
    classifiedEntries: number;
    unclassifiedEntries: number;
    entriesWithValueMetadata: number;
    entriesWithReadbackMetadata: number;
    entriesWithBothValueAndReadbackMetadata: number;
    valueMetadataRows: number;
    readbackMetadataRows: number;
    writeTestedReadbackRows: number;
    baselineOnlyReadbackRows: number;
    accessModeKnownEntries: number;
    behaviorKnownEntries: number;
    needsWriteTestRows: number;
    needsActionFlagReviewRows: number;
    needsBoundaryProofRows: number;
    contextDependentRows: number;
  };
  byRoot: RootSummary[];
  trackingBuckets: TrackingBucket[];
}

interface RootSummary {
  root: string;
  totalEntries: number;
  classifiedEntries: number;
  valueMetadataRows: number;
  readbackMetadataRows: number;
  writeTestedReadbackRows: number;
  baselineOnlyReadbackRows: number;
  needsActionFlagReviewRows: number;
  needsBoundaryProofRows: number;
  contextDependentRows: number;
}

interface TrackingBucket {
  bucket: string;
  count: number;
  roots: Array<{ root: string; count: number }>;
  examples: string[];
  nextAction: string;
}

describe("Object Tree behavior audit", () => {
  it("keeps the generated behavior tracking report in sync with current Object Tree metadata", () => {
    const reportPath = path.join(
      process.cwd(),
      "data",
      "pangoscript",
      "object-tree",
      "audits",
      "behavior",
      "issue-216-object-behavior-audit.json",
    );
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as BehaviorAuditReport;
    const index = readIndex();
    const valueRows = readValueRows(index.entries);
    const readbackRows = readReadbackOverlayRows();
    const baselineOnlyReadbackRows = readbackRows.filter((row) => !hasWriteTestedReadbackNote(row.metadata));
    const writeTestedReadbackRows = readbackRows.filter((row) => hasWriteTestedReadbackNote(row.metadata));
    const actionFlagCandidateRows = valueRows.filter((row) => isActionFlagCandidate(row.metadata));
    const provenFlagStateRows = actionFlagCandidateRows.filter(
      (row) => row.classification?.behaviorKind === "flag-state",
    );
    const actionFlagReviewRows = actionFlagCandidateRows.filter((row) => needsActionFlagReview(row));
    const boundaryRows = valueRows.filter((row) => needsBoundaryProof(row.metadata));
    const contextRows = readContextDependentRows(valueRows, readbackRows);

    expect(report.schemaVersion).toBe(1);
    expect(report.parentIssue).toBe(216);
    expect(report.generatedAt).toBe("2026-05-17T00:00:00.000Z");
    expect(report.summary).toEqual({
      totalEntries: index.entries.length,
      classifiedEntries: index.entries.filter(hasCurrentMetadata).length,
      unclassifiedEntries: index.entries.filter((entry) => !hasCurrentMetadata(entry)).length,
      entriesWithValueMetadata: index.entries.filter(
        (entry) => entry.valueMetadata || entry.contextValueMetadata?.length,
      ).length,
      entriesWithReadbackMetadata: index.entries.filter((entry) => entry.readbackMetadata).length,
      entriesWithBothValueAndReadbackMetadata: index.entries.filter(
        (entry) => (entry.valueMetadata || entry.contextValueMetadata?.length) && entry.readbackMetadata,
      ).length,
      valueMetadataRows: valueRows.length,
      readbackMetadataRows: readbackRows.length,
      writeTestedReadbackRows: writeTestedReadbackRows.length,
      baselineOnlyReadbackRows: baselineOnlyReadbackRows.length,
      accessModeKnownEntries: index.entries.filter((entry) => entry.classification?.accessMode).length,
      behaviorKnownEntries: index.entries.filter((entry) => entry.classification?.behaviorKind).length,
      needsWriteTestRows: baselineOnlyReadbackRows.length,
      needsActionFlagReviewRows: actionFlagReviewRows.length,
      needsBoundaryProofRows: boundaryRows.length,
      contextDependentRows: contextRows.length,
    });

    expect(report.byRoot).toEqual(buildRootSummaries(index.entries, valueRows, readbackRows));

    const bucketCounts = new Map(report.trackingBuckets.map((bucket) => [bucket.bucket, bucket.count]));
    expect([...bucketCounts.keys()]).toEqual([
      "baseline-readback-needs-write-test",
      "write-tested-no-op-readback",
      "proven-read-write-state",
      "proven-flag-state",
      "possible-momentary-action",
      "range-needs-boundary-proof",
      "context-dependent",
      "classification-missing",
    ]);
    expect(bucketCounts.get("baseline-readback-needs-write-test")).toBe(baselineOnlyReadbackRows.length);
    expect(bucketCounts.get("write-tested-no-op-readback")).toBe(writeTestedReadbackRows.length);
    expect(bucketCounts.get("proven-read-write-state")).toBe(
      valueRows.filter((row) => !isActionFlagCandidate(row.metadata)).length,
    );
    expect(bucketCounts.get("proven-flag-state")).toBe(provenFlagStateRows.length);
    expect(bucketCounts.get("possible-momentary-action")).toBe(actionFlagReviewRows.length);
    expect(bucketCounts.get("range-needs-boundary-proof")).toBe(boundaryRows.length);
    expect(bucketCounts.get("context-dependent")).toBe(contextRows.length);
    expect(bucketCounts.get("classification-missing")).toBe(
      index.entries.filter((entry) => !entry.classification).length,
    );

    for (const bucket of report.trackingBuckets) {
      expect(bucket.nextAction.length, bucket.bucket).toBeGreaterThan(0);
      expect(bucket.examples.length, bucket.bucket).toBeLessThanOrEqual(12);
      expect(bucket.roots).toEqual(
        [...bucket.roots].sort((left, right) => right.count - left.count || left.root.localeCompare(right.root)),
      );
    }
  });
});

function readIndex(): ObjectIndexFile {
  return JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data", "pangoscript", "object-tree", "runtime-indexes", "object-property-index.json"),
      "utf8",
    ),
  );
}

function readValueRows(entries: ObjectIndexEntry[]): ValueMetadataRow[] {
  return entries.flatMap((entry) => {
    const rows: ValueMetadataRow[] = [];
    if (entry.valueMetadata) {
      rows.push({
        path: entry.path,
        root: entry.root,
        metadata: entry.valueMetadata,
        classification: entry.classification,
      });
    }
    for (const metadata of entry.contextValueMetadata ?? []) {
      rows.push({ path: entry.path, root: entry.root, metadata, classification: entry.classification });
    }
    return rows;
  });
}

function readReadbackOverlayRows(): ReadbackMetadataRow[] {
  const root = path.join(process.cwd(), "data", "pangoscript", "object-tree", "source-facts", "readback-metadata");
  return readJsonFiles(root).flatMap((filePath) => {
    const report = JSON.parse(readFileSync(filePath, "utf8")) as ReadbackOverlayFile;
    const sourceFile = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
    return report.entries.map((entry) => ({
      path: entry.path,
      root: rootFromPath(entry.path),
      sourceFile,
      metadata: entry,
    }));
  });
}

function readJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readJsonFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function hasCurrentMetadata(entry: ObjectIndexEntry): boolean {
  return Boolean(entry.valueMetadata || entry.readbackMetadata || entry.contextValueMetadata?.length);
}

function rootFromPath(objectPath: string): string {
  return objectPath.split(".")[0] || objectPath;
}

function hasWriteTestedReadbackNote(entry: ReadbackOverlayEntry): boolean {
  return /write\/readback|SetProp|write attempts|sampled writes|writes behaved|did not change|no-op/i.test(
    entry.notes ?? "",
  );
}

function needsActionFlagReview(row: ValueMetadataRow): boolean {
  return isActionFlagCandidate(row.metadata) && !isResolvedActionFlagClassification(row.classification);
}

function isActionFlagCandidate(metadata: ValueMetadata): boolean {
  if (metadata.valueType === "boolean") return true;
  const acceptedValues = new Set((metadata.acceptedValues ?? []).map((entry) => String(entry.value)));
  if (acceptedValues.size === 2 && acceptedValues.has("0") && acceptedValues.has("1")) return true;
  return metadata.valueRange?.min === 0 && metadata.valueRange.max === 1;
}

function isResolvedActionFlagClassification(classification: ObjectIndexEntry["classification"]): boolean {
  return Boolean(
    classification?.behaviorKind &&
      classification.behaviorKind !== "unknown" &&
      classification?.accessMode &&
      classification.accessMode !== "unknown",
  );
}

function needsBoundaryProof(metadata: ValueMetadata): boolean {
  const hasRange = Boolean(
    metadata.valueRange &&
      (Object.hasOwn(metadata.valueRange, "min") ||
        Object.hasOwn(metadata.valueRange, "max") ||
        metadata.valueRange.dynamicMax),
  );
  const hasAcceptedValues = Boolean(metadata.acceptedValues?.length);
  return !hasRange && !hasAcceptedValues;
}

function readContextDependentRows(
  valueRows: ValueMetadataRow[],
  readbackRows: ReadbackMetadataRow[],
): Array<{ path: string; root: string }> {
  return valueRows
    .filter((row) => row.metadata.locationContext?.populationDependent)
    .map((row) => ({ path: row.path, root: row.root }))
    .concat(
      readbackRows
        .filter((row) => row.metadata.locationContext?.populationDependent)
        .map((row) => ({ path: row.path, root: row.root })),
    );
}

function buildRootSummaries(
  entries: ObjectIndexEntry[],
  valueRows: ValueMetadataRow[],
  readbackRows: ReadbackMetadataRow[],
): RootSummary[] {
  const roots = new Set(entries.map((entry) => entry.root));
  const writeTestedRows = readbackRows.filter((row) => hasWriteTestedReadbackNote(row.metadata));
  const baselineOnlyRows = readbackRows.filter((row) => !hasWriteTestedReadbackNote(row.metadata));
  const actionFlagRows = valueRows.filter((row) => needsActionFlagReview(row));
  const boundaryRows = valueRows.filter((row) => needsBoundaryProof(row.metadata));
  const contextRows = readContextDependentRows(valueRows, readbackRows);

  return [...roots]
    .sort((left, right) => left.localeCompare(right))
    .map((root) => ({
      root,
      totalEntries: entries.filter((entry) => entry.root === root).length,
      classifiedEntries: entries.filter((entry) => entry.root === root && hasCurrentMetadata(entry)).length,
      valueMetadataRows: valueRows.filter((row) => row.root === root).length,
      readbackMetadataRows: readbackRows.filter((row) => row.root === root).length,
      writeTestedReadbackRows: writeTestedRows.filter((row) => row.root === root).length,
      baselineOnlyReadbackRows: baselineOnlyRows.filter((row) => row.root === root).length,
      needsActionFlagReviewRows: actionFlagRows.filter((row) => row.root === root).length,
      needsBoundaryProofRows: boundaryRows.filter((row) => row.root === root).length,
      contextDependentRows: contextRows.filter((row) => row.root === root).length,
    }));
}
