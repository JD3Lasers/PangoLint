// Walks the public-safe PangoScript corpus, builds an arity histogram
// per command, and writes a markdown gap report at
// docs/references/catalog-gaps.md.
//
// The report is informational only - it never emits draft catalog
// entries. Use it to prioritize manual curation in
// data/pangoscript/commands.overlay.json.
//
// Run: `npm run report:gaps`.

import { readdirSync, readFileSync, type Stats, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { analyzeCatalogGaps, type CommandUsage, formatGapReport } from "../src/knowledge/catalogGaps";
import { loadBundledCatalog } from "../src/knowledge/catalogLoader";
import { countArgs, parseScript } from "../src/language/parser";

const repoRoot = path.resolve(__dirname, "..");
const corpusRoots = [path.join(repoRoot, "docs", "references", "beyond", "pangoscript", "working-examples")];
const reportPath = path.join(repoRoot, "docs", "references", "catalog-gaps.md");

const catalogResult = loadBundledCatalog(repoRoot);
if (catalogResult.error) {
  process.stderr.write(`reportCatalogGaps: ${catalogResult.error}\n`);
  process.exit(1);
}

const usages = new Map<string, CommandUsage>();
let corpusFileCount = 0;

for (const root of corpusRoots) {
  for (const filePath of walkBeyondCodeFiles(root)) {
    corpusFileCount += 1;
    countCommandsInFile(filePath, usages);
  }
}

const report = analyzeCatalogGaps({
  knowledgeBase: catalogResult.knowledgeBase,
  usages,
  corpusFileCount,
});

writeFileSync(reportPath, formatGapReport(report), "utf8");

process.stdout.write(
  [
    `reportCatalogGaps: wrote ${reportPath}`,
    `  catalog: ${report.catalogSize} commands`,
    `  corpus: ${report.corpusFileCount} files, ${report.corpusTotalUses} command uses`,
    `  empty descriptions:  ${report.summary.emptyDescriptions.total} total / ${report.summary.emptyDescriptions.withCorpusUses} used in corpus`,
    `  missing parameters:  ${report.summary.missingParameters.total} total / ${report.summary.missingParameters.withCorpusUses} used in corpus`,
    `  terse (non-empty):   ${report.summary.terseDescriptions.total} total / ${report.summary.terseDescriptions.withCorpusUses} used in corpus`,
    `  unknown safety:      ${report.summary.unknownSafety.total} total / ${report.summary.unknownSafety.withCorpusUses} used in corpus`,
    "",
  ].join("\n"),
);

function walkBeyondCodeFiles(root: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = path.join(root, name);
    let stats: Stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      out.push(...walkBeyondCodeFiles(full));
    } else if (stats.isFile() && name.endsWith(".BeyondCode")) {
      out.push(full);
    }
  }
  out.sort();
  return out;
}

function countCommandsInFile(filePath: string, accumulator: Map<string, CommandUsage>): void {
  const text = readFileSync(filePath, "utf8");
  const parsed = parseScript(text);
  const seenInFile = new Set<string>();
  for (const line of parsed.lines) {
    if (line.kind !== "command" || !line.command?.name) continue;
    const canonical = line.command.name;
    const key = canonical.toLowerCase();
    const arity = countArgs(line.command.args ?? "");
    let usage = accumulator.get(key);
    if (!usage) {
      usage = { canonical, totalUses: 0, fileCount: 0, arities: new Map() };
      accumulator.set(key, usage);
    }
    usage.totalUses += 1;
    usage.arities.set(arity, (usage.arities.get(arity) ?? 0) + 1);
    if (!seenInFile.has(key)) {
      seenInFile.add(key);
      usage.fileCount += 1;
    }
  }
}
