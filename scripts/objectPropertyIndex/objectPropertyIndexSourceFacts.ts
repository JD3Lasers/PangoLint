import { existsSync, readFileSync } from "node:fs";
import { splitPath } from "./objectPropertyIndexPaths";
import type {
  CacheObjectTree,
  CachePathEntry,
  FxCellLabel,
  FxEffectMenuEntry,
  FxEffectTypeReferenceEntry,
} from "./objectPropertyIndexTypes";

export function loadCacheObjectTree(filePath: string): CacheObjectTree {
  return JSON.parse(readFileSync(filePath, "utf8")) as CacheObjectTree;
}

export function loadFxEffectMenuEntries(filePath: string): Map<string, FxEffectMenuEntry> {
  if (!existsSync(filePath)) return new Map();
  const entries = JSON.parse(readFileSync(filePath, "utf8")) as FxEffectTypeReferenceEntry[];
  const labels = new Map<string, FxEffectMenuEntry>();
  for (const entry of entries) {
    const label = entry.lookup?.label ?? entry.label;
    const group = entry.lookup?.group ?? entry.group ?? undefined;
    for (const address of entry.addressForms ?? []) {
      const segments = splitPath(address);
      if (segments.length !== 4 || segments[0] !== "FX") continue;
      labels.set(segments.join("."), {
        ...(label ? { label } : {}),
        ...(group ? { group } : {}),
      });
    }
  }
  return labels;
}

export function loadFxEffectLabels(sourceFacts: CacheObjectTree): Map<string, NonNullable<CachePathEntry["fx"]>> {
  const labels = new Map<string, NonNullable<CachePathEntry["fx"]>>();
  for (const entry of sourceFacts.paths) {
    const segments = splitPath(entry.path);
    if (!entry.fx || segments.length < 4 || segments[0] !== "FX") continue;
    labels.set(segments.slice(0, 4).join("."), {
      ...(entry.fx.qfxPanel ? { qfxPanel: entry.fx.qfxPanel } : {}),
      ...(entry.fx.cellCaption ? { cellCaption: entry.fx.cellCaption } : {}),
      ...(entry.fx.label ? { label: entry.fx.label } : {}),
      ...(entry.fx.channel ? { channel: entry.fx.channel } : {}),
    });
  }
  for (const [cell, cellInfo] of Object.entries(sourceFacts.fxLabels?.cells ?? {})) {
    const [row, column] = cell.split(".");
    if (row === undefined || column === undefined) continue;
    for (const effect of cellInfo.effects ?? []) {
      const key = `FX.${row}.${column}.${effect.index}`;
      const existing = labels.get(key) ?? {};
      const qfxPanel = cellInfo.qfxPanel ?? cellInfo.qfx_panel ?? existing.qfxPanel;
      const cellCaption = cellInfo.cellCaption ?? cellInfo.caption ?? existing.cellCaption;
      labels.set(key, {
        ...(qfxPanel ? { qfxPanel } : {}),
        ...(cellCaption ? { cellCaption } : {}),
        ...(effect.label ? { label: effect.label } : {}),
        ...(effect.channel ? { channel: effect.channel } : {}),
      });
    }
  }
  return labels;
}

export function loadFxCellLabels(sourceFacts: CacheObjectTree): Map<string, FxCellLabel> {
  const labels = new Map<string, FxCellLabel>();
  for (const entry of sourceFacts.paths) {
    const segments = splitPath(entry.path);
    if (!entry.fx || segments.length < 4 || segments[0] !== "FX") continue;
    const key = segments.slice(0, 3).join(".");
    const existing = labels.get(key) ?? {};
    labels.set(key, {
      ...(existing.qfxPanel ? { qfxPanel: existing.qfxPanel } : {}),
      ...(existing.cellCaption ? { cellCaption: existing.cellCaption } : {}),
      ...(entry.fx.qfxPanel ? { qfxPanel: entry.fx.qfxPanel } : {}),
      ...(entry.fx.cellCaption ? { cellCaption: entry.fx.cellCaption } : {}),
    });
  }
  for (const [cell, cellInfo] of Object.entries(sourceFacts.fxLabels?.cells ?? {})) {
    const [row, column] = cell.split(".");
    if (row === undefined || column === undefined) continue;
    const key = `FX.${row}.${column}`;
    const existing = labels.get(key) ?? {};
    labels.set(key, {
      ...(existing.qfxPanel ? { qfxPanel: existing.qfxPanel } : {}),
      ...(existing.cellCaption ? { cellCaption: existing.cellCaption } : {}),
      ...((cellInfo.qfxPanel ?? cellInfo.qfx_panel) ? { qfxPanel: cellInfo.qfxPanel ?? cellInfo.qfx_panel } : {}),
      ...((cellInfo.cellCaption ?? cellInfo.caption) ? { cellCaption: cellInfo.cellCaption ?? cellInfo.caption } : {}),
    });
  }
  return labels;
}
