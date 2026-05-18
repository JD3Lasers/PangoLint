// Lints every .BeyondCode file in the project's regression corpus.
//
// - JD3 corpus (docs/references/beyond/pangoscript/working-examples/jd3/**)
//   is gate-enforced: any diagnostic exits non-zero. These scripts are known
//   to run in BEYOND, so a diagnostic means PangoLint has regressed (false
//   positive in the parser/diagnostics).
//
// - jvyduna corpus (docs/references/beyond/pangoscript/working-examples/jvyduna/**)
//   is checked in with attribution and linted as informational. It preserves
//   upstream script content apart from line-ending/trailing-whitespace
//   normalization, so known diagnostics are reported but do not fail the gate.
//
// - PangoLint pass regression scripts
//   (docs/references/beyond/pangoscript/linter-regressions/pass/**)
//   are gate-enforced and must remain diagnostic-free.
//
// - PangoLint fail regression scripts
//   (docs/references/beyond/pangoscript/linter-regressions/fail/**)
//   are gate-enforced in the opposite direction: each file declares one or
//   more `// PangoLint expect: <code>` comments, and the linter must emit
//   exactly those diagnostic codes.
//
// - PangoLint advisory regression scripts
//   (docs/references/beyond/pangoscript/linter-regressions/advisory/**)
//   are BEYOND-accepted scripts where PangoLint intentionally emits one or
//   more best-practice diagnostics. They use the same exact expectation check
//   as fail fixtures, but document accepted-with-advice behavior.
//
// - PangoLint candidate regression scripts
//   (docs/references/beyond/pangoscript/linter-regressions/candidate/**)
//   are informational only. They are queued for manual paste/run validation in
//   BEYOND before promotion to pass/ or fail/.
//
// Run via `npm run lint:examples` or directly:
//   node dist/lintCorpus.cjs
//
// Set PANGOLINT_CORPUS_VERBOSE=1 to print every diagnostic instead of just
// summaries.

import { existsSync, lstatSync, readdirSync, readFileSync, type Stats } from "node:fs";
import { join, relative, resolve } from "node:path";

import { loadBundledCatalog } from "../src/knowledge/catalogLoader";
import type { CommandKnowledgeEntry, PangoKnowledgeBase } from "../src/knowledge/knowledgeBase";
import { loadBundledPropertyIndex, type PropertyIndex } from "../src/knowledge/propertyIndex";
import { lintPangoScript, type PangoDiagnostic } from "../src/language/diagnostics";

function knowledgeIndexFrom(kb: PangoKnowledgeBase): Map<string, CommandKnowledgeEntry> {
  const map = new Map<string, CommandKnowledgeEntry>();
  for (const [name, entry] of Object.entries(kb.commands)) {
    map.set(name.toLowerCase(), entry);
  }
  return map;
}

const VERBOSE = process.env.PANGOLINT_CORPUS_VERBOSE === "1";
const ROOT = resolve(".");
const JD3_CORPUS = "docs/references/beyond/pangoscript/working-examples/jd3";
const JVYDUNA_CORPUS = "docs/references/beyond/pangoscript/working-examples/jvyduna";
const REGRESSION_PASS_CORPUS = "docs/references/beyond/pangoscript/linter-regressions/pass";
const REGRESSION_FAIL_CORPUS = "docs/references/beyond/pangoscript/linter-regressions/fail";
const REGRESSION_ADVISORY_CORPUS = "docs/references/beyond/pangoscript/linter-regressions/advisory";
const REGRESSION_CANDIDATE_CORPUS = "docs/references/beyond/pangoscript/linter-regressions/candidate";
const EXPECTED_DIAGNOSTIC_RE = /^\s*\/\/\s*PangoLint expect:\s*([A-Za-z0-9_, -]+)\s*$/gim;
const MAX_CORPUS_FILES = 10_000;
const MAX_CORPUS_ENTRIES = 25_000;
const MAX_CORPUS_DEPTH = 32;
const MAX_CORPUS_FILE_BYTES = 500_000;

interface CorpusReport {
  label: string;
  required: boolean;
  present: boolean;
  fileCount: number;
  diagCount: number;
  filesWithDiagnostics: Array<{ path: string; diagnostics: PangoDiagnostic[] }>;
}

interface ExpectedFailureReport extends CorpusReport {
  expectationFailures: Array<{ path: string; message: string }>;
}

interface CorpusWalkState {
  fileCount: number;
  entryCount: number;
}

function* walkBeyondCodeFiles(
  dir: string,
  depth = 0,
  state: CorpusWalkState = { fileCount: 0, entryCount: 0 },
): Generator<string> {
  if (!existsSync(dir)) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (state.fileCount >= MAX_CORPUS_FILES || state.entryCount >= MAX_CORPUS_ENTRIES) return;
    state.entryCount++;
    const full = join(dir, entry);
    let stats: Stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) {
      if (depth >= MAX_CORPUS_DEPTH) continue;
      yield* walkBeyondCodeFiles(full, depth + 1, state);
    } else if (entry.endsWith(".BeyondCode") && stats.isFile() && stats.size <= MAX_CORPUS_FILE_BYTES) {
      state.fileCount++;
      yield full;
    }
  }
}

function lintCorpus(
  label: string,
  dir: string,
  required: boolean,
  catalog: ReturnType<typeof loadBundledCatalog>["catalog"],
  knowledgeIndex: Map<string, CommandKnowledgeEntry>,
  propertyIndex: PropertyIndex,
): CorpusReport {
  const report: CorpusReport = {
    label,
    required,
    present: existsSync(dir),
    fileCount: 0,
    diagCount: 0,
    filesWithDiagnostics: [],
  };

  if (!report.present) {
    return report;
  }

  for (const path of walkBeyondCodeFiles(dir)) {
    report.fileCount++;
    const text = readFileSync(path, "utf8");
    const diagnostics = lintPangoScript(text, catalog, knowledgeIndex, propertyIndex);
    if (diagnostics.length > 0) {
      report.diagCount += diagnostics.length;
      report.filesWithDiagnostics.push({ path, diagnostics });
    }
  }

  return report;
}

function expectedDiagnosticCodes(text: string): string[] {
  const codes: string[] = [];
  for (const match of text.matchAll(EXPECTED_DIAGNOSTIC_RE)) {
    codes.push(
      ...match[1]
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    );
  }
  return codes;
}

function lintExpectedFailureCorpus(
  label: string,
  dir: string,
  catalog: ReturnType<typeof loadBundledCatalog>["catalog"],
  knowledgeIndex: Map<string, CommandKnowledgeEntry>,
  propertyIndex: PropertyIndex,
): ExpectedFailureReport {
  const report: ExpectedFailureReport = {
    label,
    required: true,
    present: existsSync(dir),
    fileCount: 0,
    diagCount: 0,
    filesWithDiagnostics: [],
    expectationFailures: [],
  };

  if (!report.present) {
    return report;
  }

  for (const path of walkBeyondCodeFiles(dir)) {
    report.fileCount++;
    const text = readFileSync(path, "utf8");
    const expectedCodes = expectedDiagnosticCodes(text);
    const expected = new Set(expectedCodes);
    const diagnostics = lintPangoScript(text, catalog, knowledgeIndex, propertyIndex);
    const actual = new Set(diagnostics.map((diagnostic) => diagnostic.code));

    if (diagnostics.length > 0) {
      report.diagCount += diagnostics.length;
      report.filesWithDiagnostics.push({ path, diagnostics });
    }

    if (expected.size === 0) {
      report.expectationFailures.push({ path, message: "missing `// PangoLint expect: <code>` comment" });
      continue;
    }

    for (const code of expected) {
      if (!actual.has(code)) {
        report.expectationFailures.push({ path, message: `expected diagnostic '${code}' was not emitted` });
      }
    }

    for (const diagnostic of diagnostics) {
      if (!expected.has(diagnostic.code)) {
        report.expectationFailures.push({ path, message: `unexpected diagnostic '${diagnostic.code}' was emitted` });
      }
    }
  }

  return report;
}

function isExpectedFailureReport(report: CorpusReport): report is ExpectedFailureReport {
  return "expectationFailures" in report;
}

function main(): void {
  const loaded = loadBundledCatalog(ROOT);
  if (loaded.error) {
    console.error(`(loader warning: ${loaded.error})`);
  }
  const knowledgeIndex = knowledgeIndexFrom(loaded.knowledgeBase);
  const propLoad = loadBundledPropertyIndex(ROOT);
  if (propLoad.error) console.error(`(property-index loader warning: ${propLoad.error})`);
  const propertyIndex = propLoad.index;

  const jd3 = lintCorpus("JD3 working examples", JD3_CORPUS, true, loaded.catalog, knowledgeIndex, propertyIndex);
  const jvyduna = lintCorpus(
    "jvyduna attributed examples",
    JVYDUNA_CORPUS,
    false,
    loaded.catalog,
    knowledgeIndex,
    propertyIndex,
  );
  const regressions = lintCorpus(
    "PangoLint pass regression scripts",
    REGRESSION_PASS_CORPUS,
    true,
    loaded.catalog,
    knowledgeIndex,
    propertyIndex,
  );
  const expectedFailures = lintExpectedFailureCorpus(
    "PangoLint fail regression scripts",
    REGRESSION_FAIL_CORPUS,
    loaded.catalog,
    knowledgeIndex,
    propertyIndex,
  );
  const advisories = lintExpectedFailureCorpus(
    "PangoLint advisory regression scripts",
    REGRESSION_ADVISORY_CORPUS,
    loaded.catalog,
    knowledgeIndex,
    propertyIndex,
  );
  const candidates = lintCorpus(
    "PangoLint candidate regression scripts",
    REGRESSION_CANDIDATE_CORPUS,
    false,
    loaded.catalog,
    knowledgeIndex,
    propertyIndex,
  );

  for (const report of [jd3, jvyduna, regressions, expectedFailures, advisories, candidates]) {
    if (!report.present) {
      console.log(`${report.label}: not present (skipped)`);
      continue;
    }
    console.log(`${report.label}: ${report.fileCount} files, ${report.diagCount} diagnostics`);
    if (VERBOSE || report.required) {
      for (const file of report.filesWithDiagnostics) {
        console.log(`  ${relative(ROOT, file.path)}`);
        for (const d of file.diagnostics) {
          console.log(`    L${d.line + 1}:${d.start}  ${d.severity.toUpperCase().padEnd(7)} [${d.code}] ${d.message}`);
        }
      }
    } else if (report.filesWithDiagnostics.length > 0) {
      console.log(
        `  (${report.filesWithDiagnostics.length} files have diagnostics — set PANGOLINT_CORPUS_VERBOSE=1 to print)`,
      );
    }
    if (isExpectedFailureReport(report) && report.expectationFailures.length > 0) {
      for (const failure of report.expectationFailures) {
        console.log(`  ${relative(ROOT, failure.path)}: ${failure.message}`);
      }
    }
  }

  const requiredFailures = [jd3, regressions].filter((report) => report.diagCount > 0);
  const expectedFailureProblems = expectedFailures.expectationFailures.length;
  const advisoryExpectationProblems = advisories.expectationFailures.length;
  const expectationProblems = expectedFailureProblems + advisoryExpectationProblems;
  if (requiredFailures.length > 0 || expectationProblems > 0) {
    const summaryParts = requiredFailures.map((report) => `${report.label}: ${report.diagCount}`);
    if (expectedFailureProblems > 0) {
      summaryParts.push(`${expectedFailures.label}: ${expectedFailureProblems} expectation failures`);
    }
    if (advisoryExpectationProblems > 0) {
      summaryParts.push(`${advisories.label}: ${advisoryExpectationProblems} expectation failures`);
    }
    const summary = summaryParts.join(", ");
    console.error(`\nFAIL: required corpora did not meet expectations (${summary}).`);
    process.exit(1);
  }
}

main();
