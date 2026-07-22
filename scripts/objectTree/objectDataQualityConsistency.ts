import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface AuditIssue {
  path: string;
}

export interface ObjectIndexEntryForConsistency {
  path: string;
  normalizedPath?: string;
  valueMetadata?: unknown;
  readbackMetadata?: unknown;
  contextValueMetadata?: unknown[];
  classification?: BehaviorClassification;
}

export interface ObjectDataQualityConsistency {
  behaviorSourceFactEntries: number;
  behaviorSourceFactDuplicateRows: AuditIssue[];
  behaviorSourceFactIndexIssues: AuditIssue[];
  sharedControlReferenceObjectRows: number;
  controlReferenceMissingIndexRows: AuditIssue[];
  controlReferenceBehaviorMismatches: AuditIssue[];
  metadataMutualExclusionRows: AuditIssue[];
  writeTestedRowsMissingOutputMetadata: AuditIssue[];
}

interface ControlReferenceFile {
  schemaVersion: 1;
  entries: ControlReferenceEntry[];
}

interface ControlReferenceEntry {
  path: string;
  kind: string;
  behavior?: BehaviorClassification;
}

interface BehaviorClassification {
  accessMode?: string;
  behaviorKind?: string;
  writeTestStatus?: string;
  readbackStatus?: string;
  evidenceLevel?: string;
}

interface BehaviorSourceFactFile {
  schemaVersion: 1;
  entries: BehaviorSourceFactEntry[];
}

interface BehaviorSourceFactEntry extends BehaviorClassification {
  path: string;
}

interface BehaviorSourceFact extends BehaviorSourceFactEntry {
  sourceFile: string;
}

interface ControlReferenceParity {
  sharedObjectRows: number;
  missingIndexRows: AuditIssue[];
  mismatches: AuditIssue[];
}

const classificationFields = [
  "accessMode",
  "behaviorKind",
  "writeTestStatus",
  "readbackStatus",
  "evidenceLevel",
] as const satisfies Array<keyof BehaviorClassification>;
const writeTestStatusesWithOutputMetadata = new Set(["write-readback-tested", "command-readback-tested"]);

export function buildObjectDataQualityConsistency(
  repoRoot: string,
  entries: ObjectIndexEntryForConsistency[],
): ObjectDataQualityConsistency {
  const controlReferencePath = path.join(
    repoRoot,
    "data",
    "pangoscript",
    "control-reference",
    "mcp-control-reference",
    "property-controls.json",
  );
  const behaviorMetadataDir = path.join(
    repoRoot,
    "data",
    "pangoscript",
    "object-tree",
    "source-facts",
    "behavior-metadata",
  );
  const controlReference = readJson<ControlReferenceFile>(controlReferencePath);
  const behaviorSourceFacts = loadBehaviorSourceFacts(repoRoot, behaviorMetadataDir);
  const controlReferenceParity = findControlReferenceBehaviorMismatches(controlReference.entries, entries);

  return {
    behaviorSourceFactEntries: behaviorSourceFacts.length,
    behaviorSourceFactDuplicateRows: findDuplicateBehaviorSourceFactRows(behaviorSourceFacts),
    behaviorSourceFactIndexIssues: findBehaviorSourceFactIndexIssues(behaviorSourceFacts, entries),
    sharedControlReferenceObjectRows: controlReferenceParity.sharedObjectRows,
    controlReferenceMissingIndexRows: controlReferenceParity.missingIndexRows,
    controlReferenceBehaviorMismatches: controlReferenceParity.mismatches,
    metadataMutualExclusionRows: entries.filter((entry) => hasValueMetadata(entry) && Boolean(entry.readbackMetadata)),
    writeTestedRowsMissingOutputMetadata: entries.filter(isWriteTestedWithoutOutputMetadata),
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function loadBehaviorSourceFacts(repoRoot: string, dirPath: string): BehaviorSourceFact[] {
  const facts: BehaviorSourceFact[] = [];
  for (const filePath of listJsonFiles(dirPath)) {
    const sourceFile = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
    const source = readJson<BehaviorSourceFactFile>(filePath);
    for (const entry of source.entries) facts.push({ ...entry, sourceFile });
  }
  return facts.sort(
    (left, right) => left.path.localeCompare(right.path) || left.sourceFile.localeCompare(right.sourceFile),
  );
}

function listJsonFiles(dirPath: string): string[] {
  return readdirSync(dirPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return listJsonFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function findDuplicateBehaviorSourceFactRows(facts: BehaviorSourceFact[]): AuditIssue[] {
  const byPath = new Map<string, BehaviorSourceFact[]>();
  for (const fact of facts) byPath.set(fact.path, [...(byPath.get(fact.path) ?? []), fact]);
  return [...byPath.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([objectPath, rows]) => ({
      path: `${objectPath} (${rows.map((row) => row.sourceFile).join(", ")})`,
    }))
    .sort(compareAuditIssues);
}

function findBehaviorSourceFactIndexIssues(
  facts: BehaviorSourceFact[],
  currentEntries: ObjectIndexEntryForConsistency[],
): AuditIssue[] {
  const entryByPath = new Map(currentEntries.map((entry) => [entry.path, entry]));
  const issues: AuditIssue[] = [];
  for (const fact of facts) {
    const entry = entryByPath.get(fact.path);
    if (!entry) {
      issues.push({ path: `${fact.path} missing from index (${fact.sourceFile})` });
      continue;
    }
    for (const field of classificationFields) {
      if (entry.classification?.[field] !== fact[field]) {
        issues.push({
          path: `${fact.path} ${field}: source=${fact[field] ?? "missing"} index=${
            entry.classification?.[field] ?? "missing"
          } (${fact.sourceFile})`,
        });
      }
    }
  }
  return issues.sort(compareAuditIssues);
}

function findControlReferenceBehaviorMismatches(
  controlEntries: ControlReferenceEntry[],
  currentEntries: ObjectIndexEntryForConsistency[],
): ControlReferenceParity {
  const entryByPath = new Map(currentEntries.map((entry) => [entry.path, entry]));
  const controlPathSet = new Set(
    controlEntries.flatMap((entry) => [entry.path.toLowerCase(), normalizeNumericSegments(entry.path).toLowerCase()]),
  );
  const mismatches: AuditIssue[] = [];
  let sharedObjectRows = 0;
  for (const controlEntry of controlEntries) {
    if (controlEntry.kind !== "object") continue;
    const indexEntry = entryByPath.get(controlEntry.path);
    if (!indexEntry) continue;
    sharedObjectRows += 1;
    if (!controlEntry.behavior) {
      mismatches.push({ path: `${controlEntry.path} missing behavior in MCP control reference` });
      continue;
    }
    for (const field of classificationFields) {
      if (indexEntry.classification?.[field] !== controlEntry.behavior[field]) {
        mismatches.push({
          path: `${controlEntry.path} ${field}: index=${indexEntry.classification?.[field] ?? "missing"} control=${
            controlEntry.behavior[field] ?? "missing"
          }`,
        });
      }
    }
  }
  return {
    sharedObjectRows,
    missingIndexRows: currentEntries
      .filter(
        (entry) =>
          !controlPathSet.has(entry.path.toLowerCase()) &&
          !controlPathSet.has((entry.normalizedPath ?? entry.path).toLowerCase()) &&
          !controlPathSet.has(normalizeNumericSegments(entry.normalizedPath ?? entry.path).toLowerCase()),
      )
      .map((entry) => ({ path: `${entry.path} missing from MCP control reference` }))
      .sort(compareAuditIssues),
    mismatches: mismatches.sort(compareAuditIssues),
  };
}

function normalizeNumericSegments(pathValue: string): string {
  return pathValue
    .split(".")
    .map((segment, index) => (index > 0 && /^\d+$/.test(segment) ? "N" : segment))
    .join(".");
}

function hasValueMetadata(entry: ObjectIndexEntryForConsistency): boolean {
  return Boolean(entry.valueMetadata || entry.contextValueMetadata?.length);
}

function isWriteTestedWithoutOutputMetadata(entry: ObjectIndexEntryForConsistency): boolean {
  return Boolean(
    writeTestStatusesWithOutputMetadata.has(entry.classification?.writeTestStatus ?? "") &&
      !hasValueMetadata(entry) &&
      !entry.readbackMetadata,
  );
}

function compareAuditIssues(left: AuditIssue, right: AuditIssue): number {
  return left.path.localeCompare(right.path);
}
