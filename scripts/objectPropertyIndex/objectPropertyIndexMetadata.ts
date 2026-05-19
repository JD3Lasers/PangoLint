import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  ObjectPropertyBehaviorClassification,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
} from "../../src/knowledge/objectPropertyIndex";
import { repoRoot } from "./objectPropertyIndexPaths";
import {
  behaviorClassificationSearchText,
  mergeSearchText,
  readbackMetadataSearchText,
  valueMetadataSearchText,
} from "./objectPropertyIndexSearchText";
import type {
  ClassificationOverlayEntry,
  ClassificationOverlayFile,
  OutputEntry,
  RangeOverlayEntry,
  RangeOverlayFile,
  ReadbackOverlayEntry,
  ReadbackOverlayFile,
} from "./objectPropertyIndexTypes";
import {
  validateBehaviorClassification,
  validateReadbackMetadata,
  validateValueMetadata,
} from "./objectPropertyIndexValidation";

export function loadRangeOverlays(rootFilePath: string, directoryPath: string): RangeOverlayEntry[] {
  return rangeOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) => loadRangeOverlay(filePath));
}

function rangeOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [...sourcePaths, ...rangeOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath)];
}

function rangeOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return rangeOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadRangeOverlay(filePath: string): RangeOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as RangeOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

export function applyRangeOverlay(entries: OutputEntry[], overlayEntries: RangeOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    const overlayKey = `${overlay.path}\u0000${overlay.contextId ?? ""}`;
    if (seen.has(overlayKey)) {
      throw new Error(`Duplicate object-property range metadata for ${overlay.path}${overlay.contextId ?? ""}`);
    }
    seen.add(overlayKey);
    const entry = byPath.get(overlay.path);
    if (!entry) throw new Error(`value metadata references unknown Object Tree path: ${overlay.path}`);
    const valueMetadata = toValueMetadata(overlay);
    if (overlay.contextId) {
      if (!entry.probeContexts?.some((context) => context.id === overlay.contextId)) {
        throw new Error(`${overlay.path} range metadata references unknown probe context: ${overlay.contextId}`);
      }
      entry.contextValueMetadata = [
        ...(entry.contextValueMetadata ?? []),
        { ...valueMetadata, contextId: overlay.contextId },
      ];
    } else {
      entry.valueMetadata = valueMetadata;
    }
    entry.searchText = mergeSearchText(entry.searchText, valueMetadataSearchText(valueMetadata));
  }
}

export function loadReadbackOverlays(rootFilePath: string, directoryPath: string): ReadbackOverlayEntry[] {
  return readbackOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) => loadReadbackOverlay(filePath));
}

function readbackOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [...sourcePaths, ...readbackOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath)];
}

function readbackOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return readbackOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadReadbackOverlay(filePath: string): ReadbackOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ReadbackOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

export function applyReadbackOverlay(entries: OutputEntry[], overlayEntries: ReadbackOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    if (seen.has(overlay.path)) {
      throw new Error(`Duplicate object-property readback metadata for ${overlay.path}`);
    }
    seen.add(overlay.path);
    const entry = byPath.get(overlay.path);
    if (!entry) throw new Error(`readback metadata references unknown Object Tree path: ${overlay.path}`);
    const readbackMetadata = toReadbackMetadata(overlay);
    entry.readbackMetadata = readbackMetadata;
    entry.searchText = mergeSearchText(entry.searchText, readbackMetadataSearchText(readbackMetadata));
  }
}

export function loadClassificationOverlays(rootFilePath: string, directoryPath: string): ClassificationOverlayEntry[] {
  return classificationOverlaySourcePaths(rootFilePath, directoryPath).flatMap((filePath) =>
    loadClassificationOverlay(filePath),
  );
}

function classificationOverlaySourcePaths(rootFilePath: string, directoryPath: string): string[] {
  const sourcePaths = existsSync(rootFilePath) ? [rootFilePath] : [];
  return [
    ...sourcePaths,
    ...classificationOverlaySplitPaths(directoryPath).filter((filePath) => filePath !== rootFilePath),
  ];
}

function classificationOverlaySplitPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return classificationOverlaySplitPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function loadClassificationOverlay(filePath: string): ClassificationOverlayEntry[] {
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ClassificationOverlayFile;
  if (parsed.schemaVersion !== 1) {
    throw new Error(
      `${path.relative(repoRoot, filePath)} uses unsupported schemaVersion ${String(parsed.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`${path.relative(repoRoot, filePath)} must contain an entries array`);
  }
  return parsed.entries;
}

export function applyClassificationOverlay(entries: OutputEntry[], overlayEntries: ClassificationOverlayEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  for (const overlay of overlayEntries) {
    if (seen.has(overlay.path)) {
      throw new Error(`Duplicate object-property behavior classification for ${overlay.path}`);
    }
    seen.add(overlay.path);
    const entry = byPath.get(overlay.path);
    if (!entry) {
      throw new Error(`behavior metadata references unknown Object Tree path: ${overlay.path}`);
    }
    const classification = toBehaviorClassification(overlay);
    entry.classification = classification;
    entry.searchText = mergeSearchText(entry.searchText, behaviorClassificationSearchText(classification));
  }
}

function toReadbackMetadata(entry: ReadbackOverlayEntry): ObjectPropertyReadbackMetadata {
  const { path: _path, ...metadata } = entry;
  validateReadbackMetadata(entry.path, metadata);
  return metadata;
}

function toBehaviorClassification(entry: ClassificationOverlayEntry): ObjectPropertyBehaviorClassification {
  const { path: _path, ...classification } = entry;
  validateBehaviorClassification(entry.path, classification);
  return classification;
}

function toValueMetadata(entry: RangeOverlayEntry): ObjectPropertyValueMetadata {
  const { contextId: _contextId, path: _path, ...metadata } = entry;
  validateValueMetadata(entry.path, metadata);
  return metadata;
}
