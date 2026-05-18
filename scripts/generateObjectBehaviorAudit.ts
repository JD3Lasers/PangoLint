import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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
  classification?: BehaviorClassification;
}

interface ValueMetadata {
  valueType?: string;
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: unknown;
    boundaryBehavior?: string;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
  }>;
  evidenceLevel?: string;
  notes?: string;
  locationContext?: LocationContext;
}

interface ReadbackMetadata {
  readable: true;
  valueType?: string;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: string;
  evidenceLevel?: string;
  notes?: string;
  locationContext?: LocationContext;
}

interface LocationContext {
  populationDependent?: boolean;
}

interface BehaviorClassification {
  accessMode?: string;
  behaviorKind?: string;
  writeTestStatus?: string;
  readbackStatus?: string;
  evidenceLevel?: string;
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
  classification?: BehaviorClassification;
}

interface ReadbackMetadataRow {
  path: string;
  root: string;
  sourceFile: string;
  metadata: ReadbackOverlayEntry;
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

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "object-property-index.json",
);
const readbackOverlayDirectory = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "source-facts",
  "readback-metadata",
);
const outputPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "audits",
  "behavior",
  "issue-216-object-behavior-audit.json",
);

const reportGeneratedAt = "2026-05-17T00:00:00.000Z";

const index = JSON.parse(readFileSync(indexPath, "utf8")) as ObjectIndexFile;
const valueRows = readValueRows(index.entries);
const readbackRows = readReadbackOverlayRows();
const writeTestedReadbackRows = readbackRows.filter((row) => hasWriteTestedReadbackNote(row.metadata));
const baselineOnlyReadbackRows = readbackRows.filter((row) => !hasWriteTestedReadbackNote(row.metadata));
const actionFlagCandidateRows = valueRows.filter((row) => isActionFlagCandidate(row.metadata));
const provenFlagStateRows = actionFlagCandidateRows.filter((row) => row.classification?.behaviorKind === "flag-state");
const actionFlagReviewRows = actionFlagCandidateRows.filter((row) => needsActionFlagReview(row));
const rangeBoundaryRows = valueRows.filter((row) => needsBoundaryProof(row.metadata));
const contextDependentRows = readContextDependentRows(valueRows, readbackRows);
const classificationMissingEntries = index.entries.filter((entry) => !entry.classification);
const classifiedEntries = index.entries.filter(hasCurrentMetadata);

const report = {
  schemaVersion: 1,
  parentIssue: 216,
  generatedAt: reportGeneratedAt,
  summary: {
    totalEntries: index.entries.length,
    classifiedEntries: classifiedEntries.length,
    unclassifiedEntries: index.entries.length - classifiedEntries.length,
    entriesWithValueMetadata: index.entries.filter((entry) => entry.valueMetadata || entry.contextValueMetadata?.length)
      .length,
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
    needsBoundaryProofRows: rangeBoundaryRows.length,
    contextDependentRows: contextDependentRows.length,
  },
  byRoot: buildRootSummaries(index.entries, valueRows, readbackRows),
  trackingBuckets: [
    buildBucket(
      "baseline-readback-needs-write-test",
      baselineOnlyReadbackRows,
      "Run write/readback tests before calling these rows read-only or promoting them to value metadata.",
    ),
    buildBucket(
      "write-tested-no-op-readback",
      writeTestedReadbackRows,
      "Review no-op write evidence and add explicit read-only behavior classification when the schema field lands.",
    ),
    buildBucket(
      "proven-read-write-state",
      valueRows.filter((row) => !isActionFlagCandidate(row.metadata)),
      "Map these writable value rows into read-write state behavior entries after classification fields land.",
    ),
    buildBucket(
      "proven-flag-state",
      provenFlagStateRows,
      "Use these rows as resolved persistent flag-state examples when writing public operator documentation.",
    ),
    buildBucket(
      "possible-momentary-action",
      actionFlagReviewRows,
      "Review every 0/1 writable row and split persistent flag state from momentary action behavior.",
    ),
    buildBucket(
      "range-needs-boundary-proof",
      rangeBoundaryRows,
      "Add direct boundary evidence or keep these command-derived rows out of final value-range claims.",
    ),
    buildBucket(
      "context-dependent",
      contextDependentRows,
      "Record the populated cue, QuickFX, showfile alias, hardware, or universe context before retesting.",
    ),
    buildBucket(
      "classification-missing",
      classificationMissingEntries.map((entry) => ({ path: entry.path, root: entry.root })),
      "Add explicit classification objects in a later schema and overlay phase.",
    ),
  ],
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath).replaceAll(path.sep, "/")}`);

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
  return readJsonFiles(readbackOverlayDirectory).flatMap((filePath) => {
    const reportFile = JSON.parse(readFileSync(filePath, "utf8")) as ReadbackOverlayFile;
    const sourceFile = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
    return reportFile.entries.map((entry) => ({
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

function isResolvedActionFlagClassification(classification: BehaviorClassification | undefined): boolean {
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
  currentValueRows: ValueMetadataRow[],
  currentReadbackRows: ReadbackMetadataRow[],
): Array<{ path: string; root: string }> {
  const valueRows = currentValueRows
    .filter((row) => row.metadata.locationContext?.populationDependent)
    .map((row) => ({ path: row.path, root: row.root }));
  const readbackRows = currentReadbackRows
    .filter((row) => row.metadata.locationContext?.populationDependent)
    .map((row) => ({ path: row.path, root: row.root }));
  return valueRows.concat(readbackRows);
}

function buildRootSummaries(
  entries: ObjectIndexEntry[],
  currentValueRows: ValueMetadataRow[],
  currentReadbackRows: ReadbackMetadataRow[],
): RootSummary[] {
  const roots = new Set(entries.map((entry) => entry.root));
  const writeTested = currentReadbackRows.filter((row) => hasWriteTestedReadbackNote(row.metadata));
  const baselineOnly = currentReadbackRows.filter((row) => !hasWriteTestedReadbackNote(row.metadata));
  const actionFlagRows = currentValueRows.filter((row) => needsActionFlagReview(row));
  const boundaryRows = currentValueRows.filter((row) => needsBoundaryProof(row.metadata));
  const contextRows = readContextDependentRows(currentValueRows, currentReadbackRows);

  return [...roots]
    .sort((left, right) => left.localeCompare(right))
    .map((root) => ({
      root,
      totalEntries: entries.filter((entry) => entry.root === root).length,
      classifiedEntries: entries.filter((entry) => entry.root === root && hasCurrentMetadata(entry)).length,
      valueMetadataRows: currentValueRows.filter((row) => row.root === root).length,
      readbackMetadataRows: currentReadbackRows.filter((row) => row.root === root).length,
      writeTestedReadbackRows: writeTested.filter((row) => row.root === root).length,
      baselineOnlyReadbackRows: baselineOnly.filter((row) => row.root === root).length,
      needsActionFlagReviewRows: actionFlagRows.filter((row) => row.root === root).length,
      needsBoundaryProofRows: boundaryRows.filter((row) => row.root === root).length,
      contextDependentRows: contextRows.filter((row) => row.root === root).length,
    }));
}

function buildBucket(bucket: string, rows: Array<{ path: string; root: string }>, nextAction: string): TrackingBucket {
  const sortedRows = [...rows].sort(
    (left, right) => left.root.localeCompare(right.root) || left.path.localeCompare(right.path),
  );
  return {
    bucket,
    count: sortedRows.length,
    roots: rootCounts(sortedRows),
    examples: [...new Set(sortedRows.map((row) => row.path))].slice(0, 12),
    nextAction,
  };
}

function rootCounts(rows: Array<{ root: string }>): Array<{ root: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.root, (counts.get(row.root) ?? 0) + 1);
  return [...counts.entries()]
    .map(([root, count]) => ({ root, count }))
    .sort((left, right) => right.count - left.count || left.root.localeCompare(right.root));
}
