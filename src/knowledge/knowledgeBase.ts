import { existsSync, readFileSync } from "node:fs";
import { countArgs } from "../language/parser";
import type { CommandCatalog, CommandEntry } from "./catalog";

export type EvidenceLevel = "exported" | "documented" | "observed" | "inferred" | "unverified";
type Confidence = "high" | "medium" | "low";
export type SafetyTier = "T0" | "T1" | "T2" | "T3" | "T4" | "unknown";
type VerificationStatus = "unverified" | "planned" | "observed" | "blocked";
type VerificationMethod = "oscOutTTS" | "registerOscFeedback" | "controlledWriteReadback" | "operatorSupervised";
type VerificationCleanup = "none" | "restoreScript" | "prefixRetire" | "beyondRestartOrPrefixRetire" | "operatorReset";
export type PropertyMappingCoverageStatus = "mapped" | "no-direct-property" | "deferred" | "unknown";
type ValueBoundaryBehavior = "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";

interface KnowledgeAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

interface KnowledgeValueRange {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: ValueBoundaryBehavior;
  evidenceLevel?: EvidenceLevel;
  notes?: string;
}

interface KnowledgeParameter {
  name: string;
  type: "number" | "integer" | "float" | "string" | "boolean" | "variadic" | "unknown";
  required: boolean;
  range?: string;
  valueRange?: KnowledgeValueRange;
  acceptedValues?: KnowledgeAcceptedValue[];
  description?: string;
}

export interface KnowledgeForm {
  signature: string;
  description?: string;
  parameters?: KnowledgeParameter[];
}

export interface KnowledgeNote {
  text: string;
}

interface KnowledgeVerification {
  status: VerificationStatus;
  method: VerificationMethod;
  safetyTier: SafetyTier;
  verificationScript?: string;
  expectedCallback?: string;
  feedbackAddress?: string;
  feedbackProperty?: string;
  triggerScript?: string;
  restoreScript?: string;
  cleanup: VerificationCleanup;
  operatorRequired: boolean;
  notes?: string;
}

export interface PropertyMappingProbe {
  setupScript?: string;
  triggerScript?: string;
  readbackPaths?: string[];
  restoreScript?: string;
  notes?: string;
}

interface PropertyMappingCoverage {
  status: PropertyMappingCoverageStatus;
  evidenceLevel?: EvidenceLevel;
  safetyTier?: SafetyTier;
  notes?: string;
  probe?: PropertyMappingProbe;
}

export interface CommandKnowledgeEntry {
  canonical: string;
  aliases?: string[];
  description?: string;
  evidenceLevel: EvidenceLevel;
  confidence: Confidence;
  safetyTier?: SafetyTier;
  forms?: KnowledgeForm[];
  notes?: KnowledgeNote[];
  verification?: KnowledgeVerification[];
  tags?: string[];
  /**
   * Resolved BEYOND category from data/pangoscript/beyond-category-tree.json
   * (or overlay override). Required - the build fails if any command is
   * unresolved (see resolveCategoriesStrict).
   */
  category: string;
  /**
   * Object property paths this command writes (dot notation, e.g. "Master.BPM").
   * Indexed paths use N as placeholder (e.g. "Zone.N.Muted").
   * Populated from the curated overlay; used by the Objects sidebar for "Written by" lookups.
   */
  setsProperty?: string[];
  /**
   * Explicit coverage metadata for command-to-property mapping work.
   * Commands with setsProperty are treated as mapped even when this field
   * is omitted. Unmapped commands can be marked no-direct-property,
   * deferred, or unknown to make mapping coverage measurable.
   */
  propertyMappingCoverage?: PropertyMappingCoverage;
}

export interface PangoKnowledgeBase {
  schemaVersion: 1;
  generatedAt?: string;
  commands: Record<string, CommandKnowledgeEntry>;
}

export interface BuildGeneratedOptions {
  generatedAt: string;
}

export interface ValidateOverlayOptions {
  overlay: PangoKnowledgeBase;
}

export function buildGeneratedKnowledgeBase(
  catalog: CommandCatalog,
  options: BuildGeneratedOptions,
): PangoKnowledgeBase {
  const commands: Record<string, CommandKnowledgeEntry> = {};
  for (const command of catalog.commands) {
    const parameters = deriveParameters(command);
    commands[command.canonical] = {
      canonical: command.canonical,
      aliases: command.aliases,
      description: command.description,
      evidenceLevel: "exported",
      confidence: "medium",
      safetyTier: "unknown",
      // category is left as empty string here; the build pipeline
      // (generateKnowledgeBase.ts) overwrites it via resolveCategoriesStrict
      // before writing commands.merged.json.
      category: "",
      forms: [
        {
          signature: command.example || command.canonical,
          description: command.description || undefined,
          ...(parameters ? { parameters } : {}),
        },
      ],
    };
  }

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt,
    commands,
  };
}

const VARIADIC_HINTS = /\b(?:optional|variadic|args?|\.\.\.|etc|any\s+number)\b/i;

function deriveParameters(command: CommandEntry): KnowledgeParameter[] | undefined {
  const example = command.example?.trim() ?? "";
  if (!example) return undefined;

  const namePattern = new RegExp(`^${escapeRegex(command.canonical)}\\s*`, "i");
  const argsString = example.replace(namePattern, "").trim();
  if (!argsString) return undefined;

  if (VARIADIC_HINTS.test(command.description ?? "")) return undefined;

  const argCount = countArgs(argsString);
  if (argCount === 0) return undefined;

  // Auto-derived parameters are marked optional. The example shows one valid
  // arity for the command; smaller arities are often also valid in practice
  // (e.g. DisplayPreview accepts 1-3 args though the export shows 2). Only
  // hand-curated forms with explicit required:true catch missing-arg bugs.
  const parameters: KnowledgeParameter[] = [];
  for (let i = 0; i < argCount; i += 1) {
    parameters.push({ name: `arg${i + 1}`, type: "unknown", required: false });
  }
  return parameters;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mergeKnowledgeBase(generated: PangoKnowledgeBase, overlay: PangoKnowledgeBase): PangoKnowledgeBase {
  const commands: Record<string, CommandKnowledgeEntry> = { ...generated.commands };

  for (const [key, overlayEntry] of Object.entries(overlay.commands)) {
    const base = commands[key] ??
      commands[overlayEntry.canonical] ?? {
        canonical: overlayEntry.canonical,
        evidenceLevel: "unverified" as const,
        confidence: "low" as const,
        // category resolved by build pipeline after merge
        category: "",
      };

    commands[base.canonical] = {
      ...base,
      ...definedFields(overlayEntry),
      aliases: mergeStrings(base.aliases ?? [], overlayEntry.aliases ?? []),
      forms: mergeForms(base.forms ?? [], overlayEntry.forms ?? []),
      notes: [...(base.notes ?? []), ...(overlayEntry.notes ?? [])],
      verification: mergeVerification(base.verification ?? [], overlayEntry.verification ?? []),
      tags: mergeStrings(base.tags ?? [], overlayEntry.tags ?? []),
    };
  }

  return {
    schemaVersion: 1,
    generatedAt: generated.generatedAt,
    commands,
  };
}

export function overlayCategoriesByCanonical(overlay: PangoKnowledgeBase): Record<string, string | undefined> {
  const categories: Record<string, string | undefined> = {};
  for (const [key, entry] of Object.entries(overlay.commands ?? {})) {
    if (!Object.hasOwn(entry, "category")) continue;
    categories[entry.canonical || key] = entry.category;
  }
  return categories;
}

const VALID_EVIDENCE_LEVELS = new Set<string>(["exported", "documented", "observed", "inferred", "unverified"]);
const VALID_CONFIDENCES = new Set<string>(["high", "medium", "low"]);
const VALID_SAFETY_TIERS = new Set<string>(["T0", "T1", "T2", "T3", "T4", "unknown"]);
const VALID_PARAM_TYPES = new Set<string>(["number", "integer", "float", "string", "boolean", "variadic", "unknown"]);
const VALID_VALUE_BOUNDARY_BEHAVIORS = new Set<string>(["clamp", "reject", "no-op", "wrap", "pass-through", "unknown"]);
const VALID_VERIFICATION_STATUSES = new Set<string>(["unverified", "planned", "observed", "blocked"]);
const VALID_VERIFICATION_METHODS = new Set<string>([
  "oscOutTTS",
  "registerOscFeedback",
  "controlledWriteReadback",
  "operatorSupervised",
]);
const VALID_VERIFICATION_CLEANUPS = new Set<string>([
  "none",
  "restoreScript",
  "prefixRetire",
  "beyondRestartOrPrefixRetire",
  "operatorReset",
]);
const VALID_PROPERTY_MAPPING_COVERAGE_STATUSES = new Set<string>([
  "mapped",
  "no-direct-property",
  "deferred",
  "unknown",
]);
const DEPRECATED_PROVENANCE_FIELDS = ["sourceRef", "sourceRefs"];

export function validateCuratedOverlay(options: ValidateOverlayOptions): void {
  rejectDeprecatedProvenanceFields("overlay", options.overlay);

  for (const [key, command] of Object.entries(options.overlay.commands)) {
    if (!command.canonical) {
      throw new Error(`${key}: missing required field 'canonical'.`);
    }
    const label = command.canonical;
    if (!VALID_EVIDENCE_LEVELS.has(command.evidenceLevel)) {
      throw new Error(`${label}: invalid evidenceLevel '${command.evidenceLevel}'.`);
    }
    if (!VALID_CONFIDENCES.has(command.confidence)) {
      throw new Error(`${label}: invalid confidence '${command.confidence}'.`);
    }
    if (command.safetyTier !== undefined && !VALID_SAFETY_TIERS.has(command.safetyTier)) {
      throw new Error(`${label}: invalid safetyTier '${command.safetyTier}'.`);
    }
    for (const form of command.forms ?? []) {
      for (const param of form.parameters ?? []) {
        if (!VALID_PARAM_TYPES.has(param.type)) {
          throw new Error(`${label} form '${form.signature}' param '${param.name}': invalid type '${param.type}'.`);
        }
        validateParameterRangeMetadata(label, form.signature, param);
      }
    }
    for (const verification of command.verification ?? []) {
      validateVerification(label, verification);
    }
    validatePropertyMappingCoverage(label, command);
  }
}

function validateParameterRangeMetadata(label: string, signature: string, param: KnowledgeParameter): void {
  const range = param.valueRange;
  const paramLabel = `${label} form '${signature}' param '${param.name}'`;
  if (range) {
    if (range.min !== undefined && typeof range.min !== "number") {
      throw new Error(`${paramLabel}: invalid valueRange.min '${range.min}'.`);
    }
    if (range.max !== undefined && typeof range.max !== "number") {
      throw new Error(`${paramLabel}: invalid valueRange.max '${range.max}'.`);
    }
    if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
      throw new Error(`${paramLabel}: valueRange.min must be <= valueRange.max.`);
    }
    if (range.boundaryBehavior !== undefined && !VALID_VALUE_BOUNDARY_BEHAVIORS.has(range.boundaryBehavior)) {
      throw new Error(`${paramLabel}: invalid valueRange.boundaryBehavior '${range.boundaryBehavior}'.`);
    }
    if (range.evidenceLevel !== undefined && !VALID_EVIDENCE_LEVELS.has(range.evidenceLevel)) {
      throw new Error(`${paramLabel}: invalid valueRange.evidenceLevel '${range.evidenceLevel}'.`);
    }
  }
  for (const [index, accepted] of (param.acceptedValues ?? []).entries()) {
    const valueType = typeof accepted.value;
    if (valueType !== "string" && valueType !== "number" && valueType !== "boolean") {
      throw new Error(`${paramLabel}: acceptedValues[${index}].value must be string, number, or boolean.`);
    }
  }
}

function rejectDeprecatedProvenanceFields(path: string, value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      rejectDeprecatedProvenanceFields(`${path}[${index}]`, value[index]);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const field of DEPRECATED_PROVENANCE_FIELDS) {
    if (Object.hasOwn(value, field)) {
      throw new Error(`${path}: deprecated provenance field '${field}' is not allowed.`);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    rejectDeprecatedProvenanceFields(`${path}.${key}`, child);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function commandCatalogFromKnowledgeBase(knowledgeBase: PangoKnowledgeBase): CommandCatalog {
  const commands: CommandEntry[] = Object.values(knowledgeBase.commands)
    .sort((left, right) => left.canonical.localeCompare(right.canonical))
    .map((entry) => ({
      canonical: entry.canonical,
      aliases: mergeStrings([entry.canonical], entry.aliases ?? []),
      example: entry.forms?.[0]?.signature ?? entry.canonical,
      description: entry.description ?? entry.forms?.[0]?.description ?? "",
      rawLine: entry.forms?.[0]?.signature ?? entry.canonical,
    }));
  const byName = new Map<string, CommandEntry>();
  for (const command of commands) {
    byName.set(command.canonical.trim().toLowerCase(), command);
  }
  for (const command of commands) {
    for (const alias of command.aliases) {
      const key = alias.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, command);
    }
  }
  return { commands, byName };
}

export function loadJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function definedFields(entry: CommandKnowledgeEntry): Partial<CommandKnowledgeEntry> {
  return Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value !== undefined),
  ) as Partial<CommandKnowledgeEntry>;
}

function mergeStrings(left: string[], right: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of [...left, ...right]) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    result.push(trimmed);
    seen.add(trimmed);
  }
  return result;
}

function mergeForms(left: KnowledgeForm[], right: KnowledgeForm[]): KnowledgeForm[] {
  const result = [...left];
  const indexBySignature = new Map<string, number>();
  for (let index = 0; index < result.length; index += 1) {
    const form = result[index];
    if (form) indexBySignature.set(form.signature, index);
  }
  for (const form of right) {
    const existingIndex = indexBySignature.get(form.signature);
    if (existingIndex !== undefined) {
      // Same signature on both sides - merge fields with right (overlay) winning.
      // Without this, curated descriptions/parameters on zero-arg commands
      // (where canonical-name == signature == auto-generated signature) get
      // silently dropped on top of the generated form.
      const existing = result[existingIndex];
      if (!existing) continue;
      result[existingIndex] = {
        signature: form.signature,
        description: form.description ?? existing.description,
        parameters: form.parameters ?? existing.parameters,
      };
    } else {
      indexBySignature.set(form.signature, result.length);
      result.push(form);
    }
  }
  return result;
}

function mergeVerification(left: KnowledgeVerification[], right: KnowledgeVerification[]): KnowledgeVerification[] {
  const result = [...left];
  const seen = new Set(left.map((item) => verificationKey(item)));
  for (const item of right) {
    const key = verificationKey(item);
    if (seen.has(key)) {
      continue;
    }
    result.push(item);
    seen.add(key);
  }
  return result;
}

function verificationKey(item: KnowledgeVerification): string {
  return [
    item.method,
    item.verificationScript ?? "",
    item.feedbackAddress ?? "",
    item.feedbackProperty ?? "",
    item.expectedCallback ?? "",
  ].join("|");
}

function validateVerification(label: string, verification: KnowledgeVerification): void {
  if (!VALID_VERIFICATION_STATUSES.has(verification.status)) {
    throw new Error(`${label}: invalid verification status '${verification.status}'.`);
  }
  if (!VALID_VERIFICATION_METHODS.has(verification.method)) {
    throw new Error(`${label}: invalid verification method '${verification.method}'.`);
  }
  if (!VALID_VERIFICATION_CLEANUPS.has(verification.cleanup)) {
    throw new Error(`${label}: invalid verification cleanup '${verification.cleanup}'.`);
  }
  if (verification.method === "registerOscFeedback") {
    if (verification.cleanup !== "beyondRestartOrPrefixRetire") {
      throw new Error(`${label}: registerOscFeedback cleanup must be beyondRestartOrPrefixRetire.`);
    }
    if (!verification.feedbackAddress || !verification.feedbackProperty) {
      throw new Error(`${label}: registerOscFeedback verification requires feedbackAddress and feedbackProperty.`);
    }
  }
}

function validatePropertyMappingCoverage(label: string, command: CommandKnowledgeEntry): void {
  const coverage = command.propertyMappingCoverage;
  if (!coverage) return;

  if (!VALID_PROPERTY_MAPPING_COVERAGE_STATUSES.has(coverage.status)) {
    throw new Error(`${label}: invalid propertyMappingCoverage.status '${coverage.status}'.`);
  }
  if (coverage.evidenceLevel !== undefined && !VALID_EVIDENCE_LEVELS.has(coverage.evidenceLevel)) {
    throw new Error(`${label}: invalid propertyMappingCoverage.evidenceLevel '${coverage.evidenceLevel}'.`);
  }
  if (coverage.safetyTier !== undefined && !VALID_SAFETY_TIERS.has(coverage.safetyTier)) {
    throw new Error(`${label}: invalid propertyMappingCoverage.safetyTier '${coverage.safetyTier}'.`);
  }

  const hasPropertyMapping = (command.setsProperty?.length ?? 0) > 0;
  if (hasPropertyMapping && coverage.status !== "mapped") {
    throw new Error(`${label}: setsProperty requires propertyMappingCoverage.status to be mapped.`);
  }
  if (!hasPropertyMapping && coverage.status === "mapped") {
    throw new Error(`${label}: propertyMappingCoverage.status mapped requires setsProperty.`);
  }
}
