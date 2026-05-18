import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface AuditReport {
  schemaVersion: 1;
  parentIssue: number;
  generatedAt: string;
  summary: {
    totalReadbackRows: number;
    writeTestedReadbackRows: number;
    baselineOnlyReadbackRows: number;
    retestPriorityRows: number;
  };
  bySourceFile: SourceFileSummary[];
  retestCandidates: RetestCandidate[];
}

interface SourceFileSummary {
  sourceFile: string;
  totalRows: number;
  writeTestedRows: number;
  baselineOnlyRows: number;
  retestPriorityRows: number;
}

interface RetestCandidate {
  path: string;
  probePath: string;
  valueType?: string;
  typeTag?: string;
  observedValue?: string | number | boolean | null;
  sourceFile: string;
  root: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

interface ReadbackOverlayFile {
  entries: ReadbackOverlayEntry[];
}

interface ReadbackOverlayEntry {
  path: string;
  probePath: string;
  valueType?: string;
  typeTag?: string;
  observedValue?: string | number | boolean | null;
  notes?: string;
}

describe("Object Tree readback write-test audit", () => {
  it("keeps the readback retest inventory in sync with readback overlays", () => {
    const reportPath = path.join(
      process.cwd(),
      "data",
      "pangoscript",
      "object-tree",
      "audits",
      "readback",
      "issue-216-readback-write-audit.json",
    );
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as AuditReport;
    const overlayRows = readReadbackOverlayRows();
    const baselineOnlyRows = overlayRows.filter((row) => !hasWriteTestedReadbackNote(row.entry));

    expect(report.schemaVersion).toBe(1);
    expect(report.parentIssue).toBe(216);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(report.summary.totalReadbackRows).toBe(overlayRows.length);
    expect(report.summary.writeTestedReadbackRows).toBe(
      overlayRows.filter((row) => hasWriteTestedReadbackNote(row.entry)).length,
    );
    expect(report.summary.baselineOnlyReadbackRows).toBe(baselineOnlyRows.length);
    expect(report.summary.retestPriorityRows).toBe(report.retestCandidates.length);
    expect(report.summary.baselineOnlyReadbackRows).toBe(0);

    const sourceFiles = new Set(overlayRows.map((row) => row.sourceFile));
    expect(new Set(report.bySourceFile.map((summary) => summary.sourceFile))).toEqual(sourceFiles);

    const sourceSummaries = new Map(report.bySourceFile.map((summary) => [summary.sourceFile, summary]));
    for (const sourceFile of sourceFiles) {
      const rows = overlayRows.filter((row) => row.sourceFile === sourceFile);
      const baselineOnly = rows.filter((row) => !hasWriteTestedReadbackNote(row.entry));
      expect(sourceSummaries.get(sourceFile), sourceFile).toEqual({
        sourceFile,
        totalRows: rows.length,
        writeTestedRows: rows.length - baselineOnly.length,
        baselineOnlyRows: baselineOnly.length,
        retestPriorityRows: baselineOnly.length,
      });
    }

    const expectedCandidateKeys = baselineOnlyRows
      .map((row) => `${row.sourceFile}\0${row.entry.path}`)
      .sort((left, right) => left.localeCompare(right));
    const reportedCandidateKeys = report.retestCandidates
      .map((candidate) => `${candidate.sourceFile}\0${candidate.path}`)
      .sort((left, right) => left.localeCompare(right));
    expect(reportedCandidateKeys).toEqual(expectedCandidateKeys);

    for (const candidate of report.retestCandidates) {
      expect(candidate.probePath.trim(), candidate.path).toBe(candidate.probePath);
      expect(candidate.reason, candidate.path).toContain("Baseline-only");
    }
  });
});

function readReadbackOverlayRows(): Array<{ sourceFile: string; entry: ReadbackOverlayEntry }> {
  const root = path.join(process.cwd(), "data", "pangoscript", "object-tree", "source-facts", "readback-metadata");
  return readJsonFiles(root).flatMap((filePath) => {
    const report = JSON.parse(readFileSync(filePath, "utf8")) as ReadbackOverlayFile;
    const sourceFile = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
    return report.entries.map((entry) => ({ sourceFile, entry }));
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

function hasWriteTestedReadbackNote(entry: ReadbackOverlayEntry): boolean {
  return /write\/readback|SetProp|write attempts|sampled writes|writes behaved|did not change|no-op/i.test(
    entry.notes ?? "",
  );
}
