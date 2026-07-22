import type { ObjectPropertyIndex } from "../../knowledge/objectPropertyIndex";
import {
  canonicalizeObjectPropertyHardwareRootPath,
  concretizeObjectPropertyShape,
  objectPropertyShapeForPath,
} from "../../knowledge/objectPropertyIndex";
import { type PropertyIndex, perIndexSchemaName } from "../../knowledge/propertyIndex";
import { lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "../analysisLimits";
import type { PangoDiagnostic } from "./pangoDiagnostic";
import { levenshteinDistance } from "./stringDistance";

const PROPERTY_PATH_LINE_RE =
  /(?:^|[^A-Za-z0-9_#])((?:FB[34][-_][A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)((?:\.(?:[A-Za-z0-9_]+|\d+))+)\b)/g;

export function findPropertyTypoDiagnostics(
  lineText: string,
  lineNumber: number,
  propertyIndex: PropertyIndex,
  sourceOffset = 0,
  objectPropertyIndex?: ObjectPropertyIndex,
): PangoDiagnostic[] {
  if (lineAnalysisLimitReason(lineText)) return [];
  const out: PangoDiagnostic[] = [];
  const seen = new Set<string>();
  let pathCount = 0;
  for (const match of lineText.matchAll(PROPERTY_PATH_LINE_RE)) {
    const fullPath = match[1];
    if (seen.has(fullPath)) continue;
    seen.add(fullPath);
    pathCount += 1;
    if (pathCount > PANGO_ANALYSIS_LIMITS.maxPropertyPathsPerLine) break;
    const matchStart = (match.index ?? 0) + match[0].indexOf(fullPath);
    if (objectPropertyIndex?.lookup(fullPath)) continue;
    const objectTreeDiagnostic = findObjectTreePathTypoDiagnostic(
      fullPath,
      matchStart,
      lineNumber,
      sourceOffset,
      objectPropertyIndex,
    );
    const root = fullPath.split(".", 1)[0];
    const schema = propertyIndex.getObject(root);
    if (!schema) {
      if (objectTreeDiagnostic) out.push(objectTreeDiagnostic);
      continue;
    }

    const parts = fullPath.split(".");
    const directRootProperty =
      schema.isArray && schema.rootProperties?.some((property) => property.toLowerCase() === parts[1].toLowerCase());
    if (directRootProperty) {
      if (parts.length === 2) continue;
      out.push({
        line: lineNumber,
        start: sourceOffset + matchStart,
        length: fullPath.length,
        severity: "hint",
        code: "property-typo",
        message: `Did you mean ${schema.object}.${parts[1]}? (${schema.object}.${parts[1]} is a direct property with no nested path)`,
      });
      continue;
    }
    const propParts = schema.isArray ? parts.slice(2) : parts.slice(1);
    if (propParts.length === 0) continue;
    const propPath = propParts.join(".");

    let verifyAgainst = schema;
    if (schema.isArray && parts.length >= 2) {
      const targetName = perIndexSchemaName(schema, parts[1]);
      if (targetName) {
        const target = propertyIndex.getObject(targetName);
        if (target) verifyAgainst = target;
      }
    }
    if (verifyAgainst.properties.includes(propPath)) continue;
    if (objectTreeDiagnostic) {
      out.push(objectTreeDiagnostic);
      continue;
    }

    let bestProp: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    let candidateCount = 0;
    for (const known of verifyAgainst.properties) {
      candidateCount += 1;
      if (candidateCount > PANGO_ANALYSIS_LIMITS.maxPropertyTypoCandidates) break;
      const d = levenshteinDistance(propPath, known);
      if (d < bestDist) {
        bestDist = d;
        bestProp = known;
      }
    }
    if (bestProp === null) continue;

    const threshold = Math.max(2, Math.ceil(propPath.length * 0.3));
    if (bestDist > threshold) continue;
    if (bestDist === 0) continue;
    if (propPath.toLowerCase() === bestProp.toLowerCase()) continue;

    out.push({
      line: lineNumber,
      start: sourceOffset + matchStart,
      length: fullPath.length,
      severity: "hint",
      code: "property-typo",
      message: `Did you mean ${schema.object}${schema.isArray ? `.${parts[1]}` : ""}.${bestProp}? (no '${propPath}' in ${schema.object} schema)`,
    });
  }
  return out;
}

function findObjectTreePathTypoDiagnostic(
  fullPath: string,
  matchStart: number,
  lineNumber: number,
  sourceOffset: number,
  objectPropertyIndex: ObjectPropertyIndex | undefined,
): PangoDiagnostic | undefined {
  if (!objectPropertyIndex) return undefined;
  const root = fullPath.split(".", 1)[0]?.toLowerCase();
  if (!root) return undefined;

  let bestSuggestion: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const entry of objectPropertyIndex.entriesForRoot(root)) {
    const candidate = objectTreeTypoCandidate(fullPath, entry.normalizedPath);
    if (!candidate) continue;
    if (
      candidate.distance < bestDist ||
      (candidate.distance === bestDist && (!bestSuggestion || candidate.suggestion.localeCompare(bestSuggestion) < 0))
    ) {
      bestDist = candidate.distance;
      bestSuggestion = candidate.suggestion;
    }
  }
  if (!bestSuggestion) return undefined;

  return {
    line: lineNumber,
    start: sourceOffset + matchStart,
    length: fullPath.length,
    severity: "hint",
    code: "property-typo",
    message: `Did you mean ${bestSuggestion}? (no '${fullPath}' in Object Tree index)`,
  };
}

function objectTreeTypoCandidate(
  fullPath: string,
  normalizedPath: string,
): { suggestion: string; distance: number } | undefined {
  const comparisonPath = canonicalizeObjectPropertyHardwareRootPath(fullPath);
  const shapedPath = objectPropertyShapeForPath(comparisonPath, normalizedPath);
  const shapedSuggestion = concretizeObjectPropertyShape(normalizedPath, comparisonPath);
  if (!shapedPath || !shapedSuggestion) return undefined;
  const suggestion = restoreOriginalHardwareRoot(shapedSuggestion, fullPath, comparisonPath);

  const shapedSegments = shapedPath.split(".");
  const targetSegments = normalizedPath.split(".");
  if (shapedSegments.length !== targetSegments.length) return undefined;

  let mismatch: { typed: string; target: string } | undefined;
  for (let index = 0; index < shapedSegments.length; index += 1) {
    const typed = shapedSegments[index];
    const target = targetSegments[index];
    if (typed.toLowerCase() === target.toLowerCase()) continue;
    if (mismatch) return undefined;
    mismatch = { typed, target };
  }
  if (!mismatch) return undefined;
  if (/^(?:#?\d+|#?N)$/i.test(mismatch.typed) || /^(?:#?\d+|#?N)$/i.test(mismatch.target)) return undefined;

  const distance = levenshteinDistance(mismatch.typed, mismatch.target);
  const threshold = Math.max(2, Math.ceil(Math.max(mismatch.typed.length, mismatch.target.length) * 0.3));
  if (distance === 0 || distance > threshold) return undefined;
  if (fullPath.toLowerCase() === suggestion.toLowerCase()) return undefined;
  return { suggestion, distance };
}

function restoreOriginalHardwareRoot(suggestion: string, fullPath: string, comparisonPath: string): string {
  const originalRoot = fullPath.split(".", 1)[0];
  const comparisonRoot = comparisonPath.split(".", 1)[0];
  if (!originalRoot || !comparisonRoot || originalRoot === comparisonRoot) return suggestion;
  if (!suggestion.toLowerCase().startsWith(`${comparisonRoot.toLowerCase()}.`)) return suggestion;
  return `${originalRoot}${suggestion.slice(comparisonRoot.length)}`;
}
