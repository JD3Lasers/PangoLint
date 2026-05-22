// Pure analyzer for the bundled command catalog: identifies which
// commands are missing parameters, descriptions, or safety tiers, and
// joins those gaps to corpus-usage frequency so a
// human can prioritize where to spend curation time.
//
// This module never emits draft catalog entries. It produces a report.
// All curation decisions stay manual - the corpus arity stats here are
// labeled "informational only" so they never get auto-promoted.

import type { CommandKnowledgeEntry, EvidenceLevel, PangoKnowledgeBase, SafetyTier } from "./knowledgeBase";

const TERSE_DESCRIPTION_THRESHOLD = 40;
const TOP_TABLE_SIZE = 30;

export interface CommandUsage {
  canonical: string;
  totalUses: number;
  fileCount: number;
  /** Arity → count. Information-only - never used to emit catalog entries. */
  arities: Map<number, number>;
}

interface CommandGap {
  canonical: string;
  description: string;
  signature: string;
  evidenceLevel: EvidenceLevel;
  safetyTier: SafetyTier;
  /** True when the signature suggests this command takes arguments. */
  signatureImpliesArgs: boolean;
  hasParameters: boolean;
  /** Real gap: signature implies args but no parameter list is recorded. */
  missingParameters: boolean;
  hasEmptyDescription: boolean;
  hasMeaningfulDescription: boolean;
  hasMeaningfulSafety: boolean;
  usage?: CommandUsage;
}

export interface GapInput {
  knowledgeBase: PangoKnowledgeBase;
  /** Lower-cased canonical → usage. Commands not in the corpus are absent. */
  usages: Map<string, CommandUsage>;
  corpusFileCount: number;
}

interface GapSummary {
  missingParameters: GapBucket;
  emptyDescriptions: GapBucket;
  terseDescriptions: GapBucket;
  unknownSafety: GapBucket;
}

interface GapBucket {
  total: number;
  withCorpusUses: number;
}

export interface GapReport {
  generatedAt: string;
  catalogSize: number;
  corpusFileCount: number;
  corpusTotalUses: number;
  gaps: CommandGap[];
  summary: GapSummary;
}

export function analyzeCatalogGaps(input: GapInput): GapReport {
  const gaps: CommandGap[] = [];
  let corpusTotalUses = 0;
  for (const usage of input.usages.values()) corpusTotalUses += usage.totalUses;

  for (const entry of Object.values(input.knowledgeBase.commands)) {
    const usage = input.usages.get(entry.canonical.toLowerCase());
    gaps.push(toGap(entry, usage));
  }

  gaps.sort((a, b) => a.canonical.localeCompare(b.canonical));

  const summary: GapSummary = {
    missingParameters: countBucket(gaps, (g) => g.missingParameters),
    emptyDescriptions: countBucket(gaps, (g) => g.hasEmptyDescription),
    terseDescriptions: countBucket(gaps, (g) => !g.hasMeaningfulDescription && !g.hasEmptyDescription),
    unknownSafety: countBucket(gaps, (g) => !g.hasMeaningfulSafety),
  };

  return {
    generatedAt: new Date().toISOString(),
    catalogSize: gaps.length,
    corpusFileCount: input.corpusFileCount,
    corpusTotalUses,
    gaps,
    summary,
  };
}

export function formatGapReport(report: GapReport): string {
  const lines: string[] = [];
  lines.push("# PangoLint catalog gap report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Catalog: ${report.catalogSize} commands`);
  lines.push(`Corpus: ${report.corpusFileCount} files, ${report.corpusTotalUses} command uses`);
  lines.push("");
  lines.push("## How to read this report");
  lines.push("");
  lines.push(
    "This report is **informational only**. The corpus-arity columns are *not* recommended parameter shapes - they are observations of how commands are used in the bundled corpus. Always verify a signature against PangolinWiki, your local BEYOND export, or a runtime probe before adding it to `data/pangoscript/commands.overlay.json`. Blank is better than wrong.",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Gap | Total commands | …of which used in corpus |");
  lines.push("| --- | --- | --- |");
  lines.push(
    `| Empty description | ${report.summary.emptyDescriptions.total} | ${report.summary.emptyDescriptions.withCorpusUses} |`,
  );
  lines.push(
    `| Missing parameters (signature implies args) | ${report.summary.missingParameters.total} | ${report.summary.missingParameters.withCorpusUses} |`,
  );
  lines.push(
    `| Terse description (1-${TERSE_DESCRIPTION_THRESHOLD - 1} chars, non-empty) | ${report.summary.terseDescriptions.total} | ${report.summary.terseDescriptions.withCorpusUses} |`,
  );
  lines.push(
    `| Safety tier = unknown | ${report.summary.unknownSafety.total} | ${report.summary.unknownSafety.withCorpusUses} |`,
  );
  lines.push("");
  lines.push(
    "Zero-argument commands (signature equals canonical name) are not flagged as missing parameters - empty is correct for them.",
  );
  lines.push("");

  appendTopByCorpus(lines, "Top empty descriptions - by corpus frequency", report.gaps, (g) => g.hasEmptyDescription);
  appendTopByCorpus(lines, "Top missing parameters - by corpus frequency", report.gaps, (g) => g.missingParameters);
  appendTopByCorpus(
    lines,
    "Top terse (non-empty) descriptions - by corpus frequency",
    report.gaps,
    (g) => !g.hasMeaningfulDescription && !g.hasEmptyDescription,
  );

  appendAllByName(lines, "All commands with empty descriptions", report.gaps, (g) => g.hasEmptyDescription);
  appendAllByName(
    lines,
    "All commands missing parameters (signature implies args)",
    report.gaps,
    (g) => g.missingParameters,
  );

  // Trim trailing empty lines so the report stays markdownlint-clean (MD012)
  // when all gap-section appenders return early because no gaps were found.
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return `${lines.join("\n")}\n`;
}

function appendTopByCorpus(
  lines: string[],
  heading: string,
  gaps: CommandGap[],
  predicate: (gap: CommandGap) => boolean,
): void {
  const matching = gaps
    .filter(predicate)
    .filter((gap) => gap.usage && gap.usage.totalUses > 0)
    .sort((a, b) => (b.usage?.totalUses ?? 0) - (a.usage?.totalUses ?? 0))
    .slice(0, TOP_TABLE_SIZE);
  if (matching.length === 0) return;

  lines.push(`## ${heading}`);
  lines.push("");
  lines.push("| Command | Uses | Files | Arity histogram (info only) | Description | Safety | Evidence |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const gap of matching) {
    const usage = gap.usage;
    const arities = usage ? formatArityHistogram(usage.arities) : "-";
    lines.push(
      `| \`${gap.canonical}\` | ${usage?.totalUses ?? 0} | ${usage?.fileCount ?? 0} | ${arities} | ${escapeCell(gap.description) || "-"} | ${gap.safetyTier} | ${gap.evidenceLevel} |`,
    );
  }
  lines.push("");
}

function appendAllByName(
  lines: string[],
  heading: string,
  gaps: CommandGap[],
  predicate: (gap: CommandGap) => boolean,
): void {
  const matching = gaps.filter(predicate);
  if (matching.length === 0) return;

  lines.push(`## ${heading}`);
  lines.push("");
  lines.push(`Alphabetical. Corpus uses shown for prioritization. ${matching.length} commands.`);
  lines.push("");
  lines.push("| Command | Uses | Files | Arity histogram (info only) | Description | Evidence |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const gap of matching) {
    const usage = gap.usage;
    const arities = usage ? formatArityHistogram(usage.arities) : "-";
    lines.push(
      `| \`${gap.canonical}\` | ${usage?.totalUses ?? 0} | ${usage?.fileCount ?? 0} | ${arities} | ${escapeCell(gap.description) || "-"} | ${gap.evidenceLevel} |`,
    );
  }
  lines.push("");
}

function toGap(entry: CommandKnowledgeEntry, usage: CommandUsage | undefined): CommandGap {
  // Walk all forms - `forms[0]` is typically the BEYOND-export-derived
  // form with no description; the curated form usually lives in
  // `forms[1+]`. Use `||` not `??` so empty strings fall through.
  const description =
    entry.description?.trim() ||
    (entry.forms ?? []).map((form) => form.description?.trim() ?? "").find((value) => value.length > 0) ||
    "";
  const trimmedDescription = description;
  const signature = entry.forms?.[0]?.signature ?? entry.canonical;
  const signatureImpliesArgs = signatureHasArgs(signature, entry.canonical);
  const hasParameters = (entry.forms ?? []).some((form) => (form.parameters ?? []).length > 0);
  const hasEmptyDescription = trimmedDescription.length === 0;
  const hasMeaningfulDescription = trimmedDescription.length >= TERSE_DESCRIPTION_THRESHOLD;
  const hasMeaningfulSafety = entry.safetyTier !== undefined && entry.safetyTier !== "unknown";

  return {
    canonical: entry.canonical,
    description,
    signature,
    evidenceLevel: entry.evidenceLevel,
    safetyTier: entry.safetyTier ?? "unknown",
    signatureImpliesArgs,
    hasParameters,
    missingParameters: signatureImpliesArgs && !hasParameters,
    hasEmptyDescription,
    hasMeaningfulDescription,
    hasMeaningfulSafety,
    usage,
  };
}

function signatureHasArgs(signature: string, canonical: string): boolean {
  // BEYOND-export signatures are "<Name>" or "<Name> <args>" - anything
  // beyond the leading name token (case-insensitive) means the command
  // takes arguments. Also treats `Foo()` as zero-arg.
  const trimmed = signature.trim();
  if (!trimmed) return false;
  const namePattern = new RegExp(`^${escapeRegex(canonical)}\\s*`, "i");
  const remainder = trimmed.replace(namePattern, "").trim();
  if (!remainder) return false;
  if (/^\(\s*\)$/.test(remainder)) return false;
  return true;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countBucket(gaps: CommandGap[], predicate: (gap: CommandGap) => boolean): GapBucket {
  let total = 0;
  let withCorpusUses = 0;
  for (const gap of gaps) {
    if (!predicate(gap)) continue;
    total += 1;
    if (gap.usage && gap.usage.totalUses > 0) withCorpusUses += 1;
  }
  return { total, withCorpusUses };
}

function formatArityHistogram(arities: Map<number, number>): string {
  const entries = [...arities.entries()].sort(([a], [b]) => a - b);
  if (entries.length === 0) return "-";
  return entries.map(([arity, count]) => `${arity}:${count}`).join(", ");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
