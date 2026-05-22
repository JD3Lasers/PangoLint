// On-demand BEYOND readback validation for unknown / folder-scoped property
// roots. Walks a document, collects (root, button) candidates that aren't
// strongly grounded in the bundled or registry indices, sends a T1 readback
// of `<root>.<button>.Caption` for each, and updates a session-scoped
// validated-roots map. Manual invocation only, no automatic network
// traffic. Caption is chosen as the read target because every BEYOND
// universe control declares one (string typeTag); a non-empty result is a
// high-confidence existence proof.
//
// Per the repository runtime-safety boundary:
//   - readback-only checks (no writes)
//   - explicit operator opt-in via command invocation
//   - source evidence for the read target (Caption is documented across the
//     UniversePanel / UniverseEffectControl / UniverseZonePadControl
//     canonical schemas captured in known-properties.json).

import {
  buildPropertyIndex,
  type KnownObjectSchema,
  type PropertyIndex,
  type PropertyIndexFile,
} from "../../knowledge/propertyIndex";
import { splitCodeAndComment, stripStringLiterals } from "../../language/parser";
import { readBeyondProperty } from "./beyondReadback";
import { createReadbackRequestId } from "./readbackRequestId";
import type { PropertyReadbackOptions, PropertyReadbackResult } from "./readbackTypes";

/** A single (root, button) pair to read back. */
export interface ValidationCandidate {
  root: string;
  button: string;
}

/** Per-root validated state held in the session cache. */
interface ValidatedRoot {
  /** First-observed casing of the root identifier. */
  displayName: string;
  /** Buttons whose `Caption` returned a non-empty string. */
  confirmedButtons: Set<string>;
  /** ISO timestamp of the most recent readback that touched this root. */
  validatedAt: string;
  /** Readback request ID (for telemetry / output channel correlation). */
  lastReadbackId: string;
}

export type ValidatedRootsCache = Map<string, ValidatedRoot>;

/**
 * Outcome of reading back a single (root, button) pair.
 * - `confirmed`: BEYOND returned a non-empty string for `Caption`.
 * - `silent`: BEYOND returned an empty value or zero, the silent-0 footgun.
 *   Inconclusive, treat as not-validated.
 * - `unreachable`: readback timed out or transport failed. Surfaces a separate
 *   summary so the operator knows network state, not "all your objects are
 *   missing."
 */
export type ReadbackOutcome = "confirmed" | "silent" | "unreachable";

export interface ReadbackReportEntry {
  root: string;
  button: string;
  outcome: ReadbackOutcome;
  rawValue?: string | number;
  error?: string;
}

export interface ValidationReport {
  entries: ReadbackReportEntry[];
  confirmed: number;
  silent: number;
  unreachable: number;
}

// Property-path identifier pattern; same shape used by the workspace
// scanner. We intentionally re-state it here so this module stays a single
// responsibility (no coupling to scanner internals).
const PATH_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z0-9_]+)+\b/g;

/**
 * Walks document text and yields the unique (root, button) pairs that are
 * candidates for BEYOND validation. A pair is a candidate when EITHER:
 *   - the root resolves to a folder-scoped auto-discovery (we haven't yet
 *     proven it exists in BEYOND), OR
 *   - the root doesn't resolve at all (unknown root, possibly a typo).
 *
 * Roots that resolve to a registered user object or a bundled canonical
 * schema (Master, Zone, Projector, ...) are skipped because they don't need
 * runtime validation because the user or bundled Object Tree data has
 * already vouched for them.
 *
 * Numeric segments aren't valid button names; they're skipped.
 */
export function extractValidationCandidates(documentText: string, propertyIndex: PropertyIndex): ValidationCandidate[] {
  // Strip line comments and string literals so we don't validate identifiers
  // mentioned in prose.
  const cleaned = documentText
    .split(/\r?\n/)
    .map((line) => stripStringLiterals(splitCodeAndComment(line).code))
    .join("\n");

  const seen = new Set<string>();
  const out: ValidationCandidate[] = [];
  for (const match of cleaned.matchAll(PATH_RE)) {
    const root = match[1];
    const button = match[2];
    if (/^\d+$/.test(button)) continue;

    const existing = propertyIndex.getObject(root);
    // Skip roots already grounded outside the runtime layer.
    if (existing && existing.discoverySource !== "folderScope") {
      // Already-validated beyondReadback schemas live in a separate runtime
      // index layer; if a previous readback confirmed this root, the lookup
      // resolves there with discoverySource === "beyondReadback" → also skip.
      if (existing.discoverySource === "beyondReadback" && existing.arrayIndices?.includes(button)) {
        continue;
      }
      // Bundled catalog or registry-classified, no need to revalidate.
      if (existing.discoverySource === undefined) continue;
    }

    const key = `${root.toLowerCase()}|${button.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ root, button });
  }
  return out;
}

/**
 * Classifies a single PropertyReadbackResult into a ReadbackOutcome. Non-empty
 * string is the only "confirmed" signal; everything else (empty string,
 * numeric zero, error) defers to silent or unreachable.
 */
export function classifyPropertyReadbackResult(result: PropertyReadbackResult): ReadbackOutcome {
  if (!result.ok) return "unreachable";
  const v = result.value;
  if (typeof v === "string" && v.length > 0) return "confirmed";
  // Empty string, missing value, or numeric zero: BEYOND's silent-0 footgun
  // means we cannot distinguish "object exists with empty caption" from
  // "object doesn't exist." Treat as inconclusive.
  return "silent";
}

/**
 * Mutates the cache, recording each confirmed (root, button) under its
 * root entry. Returns the set of root names whose validated state changed.
 */
export function applyReportToCache(
  cache: ValidatedRootsCache,
  report: ValidationReport,
  requestIdByEntry: Map<ReadbackReportEntry, string>,
  now: () => Date = () => new Date(),
): Set<string> {
  const changed = new Set<string>();
  for (const entry of report.entries) {
    if (entry.outcome !== "confirmed") continue;
    const key = entry.root.toLowerCase();
    let current = cache.get(key);
    if (!current) {
      current = {
        displayName: entry.root,
        confirmedButtons: new Set(),
        validatedAt: now().toISOString(),
        lastReadbackId: requestIdByEntry.get(entry) ?? "",
      };
      cache.set(key, current);
    }
    current.confirmedButtons.add(entry.button);
    current.validatedAt = now().toISOString();
    const readbackId = requestIdByEntry.get(entry);
    if (readbackId) current.lastReadbackId = readbackId;
    changed.add(current.displayName);
  }
  return changed;
}

/**
 * Builds a PropertyIndex from the session-validated roots cache. This
 * index is layered ABOVE the workspace + bundled indices in
 * mergedPropertyIndex(...), so a beyondReadback-confirmed root takes
 * precedence over a folder-scoped auto-discovery for the same name.
 *
 * The synthetic schema mirrors UniversePanel (the only universe shape we
 * can confirm via Caption alone) and exposes the confirmed buttons as
 * arrayIndices so completion still suggests them.
 */
export function buildRuntimeIndex(cache: ValidatedRootsCache, bundledIndex: PropertyIndex): PropertyIndex {
  const universePanelSchema = bundledIndex.getObject("UniversePanel");
  const schemas: KnownObjectSchema[] = [];
  for (const validated of cache.values()) {
    const buttons = [...validated.confirmedButtons].sort();
    if (universePanelSchema) {
      schemas.push({
        ...universePanelSchema,
        object: validated.displayName,
        sharedWithAliases: 0,
        arrayIndices: buttons,
        inheritedFrom: "UniversePanel",
        discoverySource: "beyondReadback",
        validatedAt: validated.validatedAt,
      });
    } else {
      schemas.push({
        object: validated.displayName,
        isArray: true,
        propertyCount: 0,
        properties: [],
        sharedWithAliases: 0,
        arrayIndices: buttons,
        discoverySource: "beyondReadback",
        validatedAt: validated.validatedAt,
      });
    }
  }
  const file: PropertyIndexFile = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedFrom: "runtime readback cache",
    schemas,
  };
  return buildPropertyIndex(file);
}

export interface RunValidationOptions
  extends Omit<PropertyReadbackOptions, "propertyPath" | "typeTag" | "requestId" | "logger"> {
  documentText: string;
  propertyIndex: PropertyIndex;
  /** Injectable for tests; defaults to the real readBeyondProperty. */
  readProperty?: (path: string, requestId: string) => Promise<PropertyReadbackResult>;
  /**
   * Limits how many readbacks we send in one validation pass. Defaults to 32.
   * Each readback is a real LAN round-trip; without a cap, a large file with
   * dozens of unknown roots could spam BEYOND.
   */
  maxReadbacks?: number;
  /**
   * Logger (output channel append). Each readback logs one line.
   */
  logger?: (msg: string) => void;
}

/**
 * Sequentially reads back each candidate (root, button) pair. Sequential,
 * not parallel, because every readback binds the same OSC listen port; per
 * the engineering standards, parallel binds on a single UDP port
 * are not allowed.
 */
export async function runValidation(options: RunValidationOptions): Promise<{
  report: ValidationReport;
  requestIdByEntry: Map<ReadbackReportEntry, string>;
}> {
  const candidates = extractValidationCandidates(options.documentText, options.propertyIndex);
  const limit = options.maxReadbacks ?? 32;
  const readProperty =
    options.readProperty ??
    ((path, requestId) =>
      readBeyondProperty({
        propertyPath: path,
        typeTag: "s",
        requestId,
        talkHost: options.talkHost,
        talkPort: options.talkPort,
        talkTransport: options.talkTransport,
        talkTcpHost: options.talkTcpHost,
        talkTcpPort: options.talkTcpPort,
        talkUdpHost: options.talkUdpHost,
        talkUdpPort: options.talkUdpPort,
        talkUdpFallbackAllowed: options.talkUdpFallbackAllowed,
        talkTcpPassword: options.talkTcpPassword,
        commandTimeoutMs: options.commandTimeoutMs,
        listenHost: options.listenHost,
        listenPort: options.listenPort,
        timeoutMs: options.timeoutMs,
      }));

  const entries: ReadbackReportEntry[] = [];
  const requestIdByEntry = new Map<ReadbackReportEntry, string>();
  let confirmed = 0;
  let silent = 0;
  let unreachable = 0;

  for (let i = 0; i < Math.min(candidates.length, limit); i++) {
    const { root, button } = candidates[i];
    const path = `${root}.${button}.Caption`;
    const requestId = createReadbackRequestId("validate");
    options.logger?.(`[validate] readback ${i + 1}/${Math.min(candidates.length, limit)} -> ${path}`);
    const result = await readProperty(path, requestId);
    const outcome = classifyPropertyReadbackResult(result);
    const entry: ReadbackReportEntry = {
      root,
      button,
      outcome,
      rawValue: result.value,
      error: result.error,
    };
    entries.push(entry);
    requestIdByEntry.set(entry, requestId);
    if (outcome === "confirmed") confirmed++;
    else if (outcome === "silent") silent++;
    else unreachable++;
    options.logger?.(
      `[validate]   → ${outcome}${entry.rawValue !== undefined ? ` (value=${JSON.stringify(entry.rawValue)})` : ""}${entry.error ? ` (error=${entry.error})` : ""}`,
    );
    // Bail early if BEYOND is unreachable so we don't waste round-trips.
    if (outcome === "unreachable" && i === 0) {
      options.logger?.("[validate] first readback unreachable, aborting remaining readbacks");
      // Mark the rest as unreachable for transparency.
      for (let j = i + 1; j < Math.min(candidates.length, limit); j++) {
        const { root: r2, button: b2 } = candidates[j];
        const skipped: ReadbackReportEntry = { root: r2, button: b2, outcome: "unreachable", error: "skipped" };
        entries.push(skipped);
        unreachable++;
      }
      break;
    }
  }

  return {
    report: { entries, confirmed, silent, unreachable },
    requestIdByEntry,
  };
}

// Re-export a transport stub indirection so tests can substitute their own
// without depending on checkBeyondConnection's transport surface.
