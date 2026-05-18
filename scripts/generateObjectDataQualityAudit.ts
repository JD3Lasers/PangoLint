import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
  }>;
}

interface ReadbackMetadata {
  readable: true;
  probePath: string;
}

interface BehaviorClassification {
  accessMode?: string;
  behaviorKind?: string;
  writeTestStatus?: string;
  readbackStatus?: string;
  evidenceLevel?: string;
}

interface ControlCrosswalkSummary {
  propertiesWithObjectContext: number;
  propertiesWithBehaviorClassification: number;
  propertiesMissingBehaviorClassification: number;
}

interface QualityCheck {
  id: string;
  severity: "error" | "warning";
  status: "pass" | "warn" | "fail";
  count: number;
  examples: string[];
  message: string;
}

interface ReviewBucket {
  id: string;
  count: number;
  roots: Array<{ root: string; count: number }>;
  examples: string[];
  nextAction: string;
}

interface SpotCheckRow {
  path: string;
  root: string;
  accessMode: string;
  behaviorKind: string;
  evidenceLevel: string;
  reason: string;
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
const crosswalkSummaryPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "control-reference",
  "control-crosswalk",
  "summary.json",
);
const outputPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "object-tree",
  "audits",
  "data-quality",
  "final-object-data-quality-audit.json",
);

const reportGeneratedAt = "2026-05-17T00:00:00.000Z";

const allowedAccessModes = new Set(["read-write", "read-only", "write-only", "read-mostly", "unknown"]);
const allowedBehaviorKinds = new Set([
  "state-value",
  "flag-state",
  "momentary-action",
  "enum-state",
  "string-state",
  "computed-status",
  "alias-status",
  "fixture-dependent",
  "unknown",
]);
const allowedWriteStatuses = new Set([
  "not-tested",
  "write-readback-tested",
  "command-readback-tested",
  "write-no-op-tested",
  "write-rejected-tested",
  "documented-writable",
  "documented-read-only",
  "not-applicable",
]);
const allowedReadbackStatuses = new Set([
  "not-tested",
  "readback-tested",
  "readback-not-available",
  "documented-readable",
  "not-applicable",
]);
const allowedEvidenceLevels = new Set(["documented", "observed", "inferred", "unverified"]);

const index = readJson<ObjectIndexFile>(indexPath);
const crosswalkSummary = readJson<ControlCrosswalkSummary>(crosswalkSummaryPath);
const entries = [...index.entries].sort(compareEntries);
const checks = buildChecks(entries, crosswalkSummary);
const unverifiedRows = entries.filter(isUnverifiedUnknownReadbackOnly);
const readOnlyDomainRows = entries.filter(isReadOnlyWithDomainMetadata);

const hardViolationCount = checks
  .filter((check) => check.severity === "error")
  .reduce((sum, check) => sum + check.count, 0);
const warningCount = checks.filter((check) => check.severity === "warning" && check.count > 0).length;

const report = {
  schemaVersion: 1,
  generatedAt: reportGeneratedAt,
  sourceFiles: {
    objectPropertyIndex: "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
    controlCrosswalkSummary: "data/pangoscript/control-reference/control-crosswalk/summary.json",
  },
  summary: {
    totalEntries: entries.length,
    classifiedEntries: entries.filter((entry) => entry.classification).length,
    unclassifiedEntries: entries.filter((entry) => !entry.classification).length,
    entriesWithValueMetadata: entries.filter(hasValueMetadata).length,
    entriesWithReadbackMetadata: entries.filter((entry) => entry.readbackMetadata).length,
    entriesWithBothValueAndReadbackMetadata: entries.filter(
      (entry) => hasValueMetadata(entry) && entry.readbackMetadata,
    ).length,
    hardViolationCount,
    warningCount,
    unverifiedUnknownRows: unverifiedRows.length,
    readOnlyRowsWithDomainMetadata: readOnlyDomainRows.length,
    crosswalkPropertiesWithBehaviorClassification: crosswalkSummary.propertiesWithBehaviorClassification,
    crosswalkPropertiesMissingBehaviorClassification: crosswalkSummary.propertiesMissingBehaviorClassification,
  },
  behaviorCounts: {
    accessMode: countClassificationField(entries, "accessMode"),
    behaviorKind: countClassificationField(entries, "behaviorKind"),
    writeTestStatus: countClassificationField(entries, "writeTestStatus"),
    readbackStatus: countClassificationField(entries, "readbackStatus"),
    evidenceLevel: countClassificationField(entries, "evidenceLevel"),
  },
  checks,
  reviewBuckets: [
    buildReviewBucket(
      "unverified-unknown-readback-only",
      unverifiedRows,
      unverifiedRows.length > 0
        ? "Freshly test write/readback behavior for these FX lookup-only rows before documenting them as read-only or read-write."
        : "No unverified unknown readback-only rows remain after the FX write/readback retest.",
    ),
    buildReviewBucket(
      "read-only-domain-metadata-review",
      readOnlyDomainRows,
      "Keep these as computed-status rows, but review wording so domain metadata is not mistaken for writable range metadata.",
    ),
  ],
  spotCheckPlan: buildSpotCheckPlan(entries),
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath).replaceAll(path.sep, "/")}`);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function buildChecks(currentEntries: ObjectIndexEntry[], summary: ControlCrosswalkSummary): QualityCheck[] {
  return [
    buildCheck(
      "classification-complete",
      "error",
      currentEntries.filter((entry) => !entry.classification),
      "Every Object Tree entry must carry a behavior classification object.",
    ),
    buildCheck(
      "classification-fields-known",
      "error",
      currentEntries.filter((entry) => !hasKnownClassificationFields(entry.classification)),
      "Classification fields must use the documented Object Tree behavior vocabulary.",
    ),
    buildCheck(
      "read-write-has-value-metadata",
      "error",
      currentEntries.filter((entry) => entry.classification?.accessMode === "read-write" && !hasValueMetadata(entry)),
      "Read-write rows must have writable value metadata or context value metadata.",
    ),
    buildCheck(
      "read-only-has-readback-or-domain",
      "error",
      currentEntries.filter(
        (entry) =>
          entry.classification?.accessMode === "read-only" && !entry.readbackMetadata && !hasValueMetadata(entry),
      ),
      "Read-only rows must have readback metadata or explicit computed domain metadata.",
    ),
    buildCheck(
      "flag-state-domain",
      "error",
      currentEntries.filter((entry) => entry.classification?.behaviorKind === "flag-state" && !hasFlagDomain(entry)),
      "Flag-state rows must have boolean, 0/1 accepted value, or 0..1 integer domain metadata.",
    ),
    buildCheck(
      "computed-status-access",
      "error",
      currentEntries.filter(
        (entry) =>
          entry.classification?.behaviorKind === "computed-status" && entry.classification.accessMode !== "read-only",
      ),
      "Computed-status rows must be read-only in the current behavior model.",
    ),
    buildCheck(
      "observed-classifications-prove-known-behavior",
      "error",
      currentEntries.filter(
        (entry) =>
          entry.classification?.evidenceLevel === "observed" &&
          (entry.classification.accessMode === "unknown" ||
            entry.classification.behaviorKind === "unknown" ||
            entry.classification.writeTestStatus === "not-tested"),
      ),
      "Observed classifications must not still say access, behavior, or write status is unknown.",
    ),
    buildCheck(
      "control-crosswalk-classification-parity",
      "error",
      summary.propertiesWithObjectContext === currentEntries.length &&
        summary.propertiesWithBehaviorClassification === currentEntries.length &&
        summary.propertiesMissingBehaviorClassification === 0
        ? []
        : currentEntries.slice(0, 1),
      "Control-reference crosswalk behavior classification counts must match the Object Tree index.",
    ),
    buildCheck(
      "unverified-unknown-readback-only",
      "warning",
      currentEntries.filter(isUnverifiedUnknownReadbackOnly),
      "Unverified unknown rows are explicit lookup-only documentation and need runtime retest before stronger wording.",
    ),
    buildCheck(
      "read-only-domain-metadata-review",
      "warning",
      currentEntries.filter(isReadOnlyWithDomainMetadata),
      "Read-only rows with domain metadata need careful public wording so computed domains are not read as writable ranges.",
    ),
  ];
}

function buildCheck(
  id: string,
  severity: "error" | "warning",
  rows: ObjectIndexEntry[],
  message: string,
): QualityCheck {
  const count = rows.length;
  return {
    id,
    severity,
    status: count === 0 ? "pass" : severity === "error" ? "fail" : "warn",
    count,
    examples: rows.map((entry) => entry.path).slice(0, 12),
    message,
  };
}

function hasKnownClassificationFields(classification: BehaviorClassification | undefined): boolean {
  return Boolean(
    classification &&
      allowedAccessModes.has(classification.accessMode ?? "") &&
      allowedBehaviorKinds.has(classification.behaviorKind ?? "") &&
      allowedWriteStatuses.has(classification.writeTestStatus ?? "") &&
      allowedReadbackStatuses.has(classification.readbackStatus ?? "") &&
      allowedEvidenceLevels.has(classification.evidenceLevel ?? ""),
  );
}

function hasValueMetadata(entry: ObjectIndexEntry): boolean {
  return Boolean(entry.valueMetadata || entry.contextValueMetadata?.length);
}

function hasFlagDomain(entry: ObjectIndexEntry): boolean {
  return valueRowsForEntry(entry).some((metadata) => {
    if (metadata.valueType === "boolean") return true;
    const acceptedValues = new Set((metadata.acceptedValues ?? []).map((value) => String(value.value)));
    if (acceptedValues.size === 2 && acceptedValues.has("0") && acceptedValues.has("1")) return true;
    return metadata.valueType === "integer" && metadata.valueRange?.min === 0 && metadata.valueRange.max === 1;
  });
}

function valueRowsForEntry(entry: ObjectIndexEntry): ValueMetadata[] {
  return [entry.valueMetadata, ...(entry.contextValueMetadata ?? [])].filter((metadata): metadata is ValueMetadata =>
    Boolean(metadata),
  );
}

function isUnverifiedUnknownReadbackOnly(entry: ObjectIndexEntry): boolean {
  return Boolean(
    entry.classification?.accessMode === "unknown" &&
      entry.classification.behaviorKind === "unknown" &&
      entry.classification.writeTestStatus === "not-tested" &&
      entry.classification.readbackStatus === "readback-tested" &&
      entry.classification.evidenceLevel === "unverified" &&
      entry.readbackMetadata,
  );
}

function isReadOnlyWithDomainMetadata(entry: ObjectIndexEntry): boolean {
  return entry.classification?.accessMode === "read-only" && hasValueMetadata(entry);
}

function countClassificationField(
  currentEntries: ObjectIndexEntry[],
  field: keyof BehaviorClassification,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of currentEntries) {
    const value = entry.classification?.[field] ?? "missing";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function buildReviewBucket(id: string, rows: ObjectIndexEntry[], nextAction: string): ReviewBucket {
  return {
    id,
    count: rows.length,
    roots: rootCounts(rows),
    examples: rows.map((entry) => entry.path).slice(0, 12),
    nextAction,
  };
}

function rootCounts(rows: ObjectIndexEntry[]): Array<{ root: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.root, (counts.get(row.root) ?? 0) + 1);
  return [...counts.entries()]
    .map(([root, count]) => ({ root, count }))
    .sort((left, right) => right.count - left.count || left.root.localeCompare(right.root));
}

function buildSpotCheckPlan(currentEntries: ObjectIndexEntry[]): SpotCheckRow[] {
  const selected = new Map<string, SpotCheckRow>();
  addNamedSpotCheck(selected, currentEntries, "Master.ShowSpeed", "representative read-write state-value observed row");
  addNamedSpotCheck(selected, currentEntries, "DmxIO.DoBeep", "representative read-only computed-status observed row");
  addNamedSpotCheck(
    selected,
    currentEntries,
    "FX.N.N.N.Keys.A",
    "representative FX row promoted by write/readback retest",
  );
  addNamedSpotCheck(
    selected,
    currentEntries,
    "Universe.N.Button1.ColorOff",
    "representative read-mostly color state row",
  );
  addNamedSpotCheck(
    selected,
    currentEntries,
    "PlayListState.Position",
    "representative context-dependent computed domain row",
  );

  const byBehaviorKind = firstEntryBy(currentEntries, (entry) => entry.classification?.behaviorKind);
  for (const entry of byBehaviorKind.values()) {
    addSpotCheck(selected, entry, `first ${entry.classification?.behaviorKind ?? "missing"} behavior row`);
  }

  const byAccessMode = firstEntryBy(currentEntries, (entry) => entry.classification?.accessMode);
  for (const entry of byAccessMode.values()) {
    addSpotCheck(selected, entry, `first ${entry.classification?.accessMode ?? "missing"} access row`);
  }

  const byRoot = firstEntryBy(currentEntries, (entry) => entry.root);
  for (const entry of byRoot.values()) {
    addSpotCheck(selected, entry, "first row for root coverage");
  }

  return [...selected.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function addNamedSpotCheck(
  selected: Map<string, SpotCheckRow>,
  currentEntries: ObjectIndexEntry[],
  objectPath: string,
  reason: string,
): void {
  const entry = currentEntries.find((candidate) => candidate.path === objectPath);
  if (entry) addSpotCheck(selected, entry, reason);
}

function addSpotCheck(selected: Map<string, SpotCheckRow>, entry: ObjectIndexEntry, reason: string): void {
  if (selected.has(entry.path)) return;
  selected.set(entry.path, {
    path: entry.path,
    root: entry.root,
    accessMode: entry.classification?.accessMode ?? "missing",
    behaviorKind: entry.classification?.behaviorKind ?? "missing",
    evidenceLevel: entry.classification?.evidenceLevel ?? "missing",
    reason,
  });
}

function firstEntryBy(
  currentEntries: ObjectIndexEntry[],
  keyForEntry: (entry: ObjectIndexEntry) => string | undefined,
): Map<string, ObjectIndexEntry> {
  const first = new Map<string, ObjectIndexEntry>();
  for (const entry of currentEntries) {
    const key = keyForEntry(entry);
    if (!key || first.has(key)) continue;
    first.set(key, entry);
  }
  return first;
}

function compareEntries(left: ObjectIndexEntry, right: ObjectIndexEntry): number {
  return left.root.localeCompare(right.root) || left.path.localeCompare(right.path);
}
