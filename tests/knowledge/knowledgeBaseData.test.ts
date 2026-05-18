import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks } from "../../scripts/publicArtifactPolicy";
import { analyzeCatalogGaps } from "../../src/knowledge/catalogGaps";
import { loadCategoryTree, resolveCategoryMap, resolveCommandCategory } from "../../src/knowledge/categoryResolution";
import {
  mergeKnowledgeBase,
  overlayCategoriesByCanonical,
  type PangoKnowledgeBase,
  validateCuratedOverlay,
} from "../../src/knowledge/knowledgeBase";

const dataDir = path.join(process.cwd(), "data", "pangoscript");
const issue294WsCueEffectControlPaths = new Set([
  "WS.N.N.ClickMode",
  "WS.N.N.Effect.ChasePeriod",
  "WS.N.N.Effect.ClockLimit",
  "WS.N.N.Effect.ClockShift",
  "WS.N.N.Effect.EnableClockLimit",
  "WS.N.N.Effect.EnableMetroLimit",
  "WS.N.N.Effect.MetroLimit",
  "WS.N.N.Effect.MetroShift",
]);
const issue294WsStringControlPaths = new Set([
  "WS.N.N.Caption",
  "WS.N.N.Effect.Name",
  "WS.N.N.Image.Effect.Name",
  "WS.N.N.Image.LIST.0.Effect.Name",
]);
const issue294WsSingleVariantStatePaths = new Set([
  "WS.N.N.Image.BeamConnect",
  "WS.N.N.Image.BeamRepeat",
  "WS.N.N.Image.EnableRecording",
  "WS.N.N.Image.EnableStaticMode",
  "WS.N.N.Image.FftMode",
  "WS.N.N.Image.Mode",
  "WS.N.N.Image.MonoSpaced",
  "WS.N.N.Image.NGonCount",
  "WS.N.N.Image.PhysicsActive",
  "WS.N.N.Image.ShowCorners",
  "WS.N.N.Image.StartShape",
  "WS.N.N.Image.LIST.0.Image.BeamConnect",
  "WS.N.N.Image.LIST.0.Image.BeamRepeat",
  "WS.N.N.Image.LIST.0.Image.EnableRecording",
  "WS.N.N.Image.LIST.0.Image.FftMode",
  "WS.N.N.Image.LIST.0.Image.Loops",
  "WS.N.N.Image.LIST.0.Image.Mode",
  "WS.N.N.Image.LIST.0.Image.NGonCount",
  "WS.N.N.Image.LIST.0.Image.PhysicsActive",
  "WS.N.N.Image.LIST.0.Image.PointCount",
  "WS.N.N.Image.LIST.0.Image.ShowCorners",
  "WS.N.N.Image.LIST.0.Image.StartShape",
  "WS.N.N.Image.LIST.0.Muted",
]);
const issue294WsSingleVariantStateDeferredPaths = new Set([
  "WS.N.N.Ani.0.Muted",
  "WS.N.N.Ani.0.PreventReroute",
  "WS.N.N.Ani.0.Solo",
  "WS.N.N.Image.AudioMode",
  "WS.N.N.Image.AutoRecord",
  "WS.N.N.Image.EnableRecord",
  "WS.N.N.Image.MultiLaser",
  "WS.N.N.Image.LIST.0.Image.AudioMode",
]);
const issue294WsNestedEffectControlPaths = new Set([
  "WS.N.N.Image.Effect.ChasePeriod",
  "WS.N.N.Image.LIST.0.Effect.ChasePeriod",
  "WS.N.N.Image.LIST.0.Effect.ClockLimit",
  "WS.N.N.Image.LIST.0.Effect.ClockShift",
  "WS.N.N.Image.LIST.0.Effect.EnableClockLimit",
  "WS.N.N.Image.LIST.0.Effect.EnableMetroLimit",
  "WS.N.N.Image.LIST.0.Effect.MetroLimit",
  "WS.N.N.Image.LIST.0.Effect.MetroShift",
]);
const issue294WsNestedEffectDeferredPaths = new Set([
  "WS.N.N.Image.Effect.ChaseTimeMode",
  "WS.N.N.Image.LIST.0.Effect.ChaseTimeMode",
  "WS.N.N.Image.LIST.0.Effect.Zone",
  "WS.N.N.Image.LIST.0.Effect.ZoneMode",
]);
const issue338FxCellEffectControlPaths = new Set([
  "FX.N.N.ChasePeriod",
  "FX.N.N.ClockLimit",
  "FX.N.N.ClockShift",
  "FX.N.N.EnableClockLimit",
  "FX.N.N.EnableMetroLimit",
  "FX.N.N.MetroLimit",
  "FX.N.N.MetroShift",
]);

describe("checked-in PangoScript knowledge data", () => {
  it("keeps curated overlay metadata valid", () => {
    const overlay = readJson<PangoKnowledgeBase>("commands.overlay.json");

    expect(() =>
      validateCuratedOverlay({
        overlay,
      }),
    ).not.toThrow();
  });

  it("keeps public command artifacts free of maintainer provenance fields", () => {
    const artifacts = ["commands.generated.json", "commands.overlay.json", "commands.merged.json"];
    const provenanceField = ["source", "Refs"].join("");

    for (const artifact of artifacts) {
      const parsed = readJson<unknown>(artifact);
      expect(findPropertyPaths(parsed, provenanceField), artifact).toEqual([]);
    }
  });

  it("keeps merged command descriptions free of public verification labels and source provenance", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(findForbiddenDescriptionClaims(merged)).toEqual([]);
  });

  it("keeps the public command category tree free of capture provenance", () => {
    const tree = readJson<Record<string, unknown>>("beyond-category-tree.json");

    expect(Object.keys(tree).sort()).toEqual(["categories"]);
  });

  it("keeps the public known-properties artifact free of capture provenance", () => {
    const knownProperties = readJson<Record<string, unknown>>("known-properties.json");

    expect(Object.keys(knownProperties).sort()).toEqual(["schemaVersion", "schemas"]);
  });

  it("keeps the public object-property index free of capture provenance", () => {
    const index = readJson<Record<string, unknown>>("object-property-index.json");

    expect(Object.keys(index).sort()).toEqual(["entries", "schemaVersion"]);
  });

  it("keeps object-property range overlay entries structurally valid", () => {
    const overlayFiles = readObjectPropertyRangeOverlayFiles();
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        osc?: string;
        variants?: Array<{ path: string; osc?: string }>;
        probeContexts?: ObjectPropertyProbeContext[];
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set(objectPropertyIndex.entries.map((entry) => entry.path));
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const seen = new Set<string>();
    for (const source of overlayFiles) {
      expect(source.overlay.schemaVersion, source.relativePath).toBe(1);
      for (const entry of source.overlay.entries) {
        expect(knownPaths.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(true);
        const overlayKey = `${entry.path}\0${entry.contextId ?? ""}`;
        expect(seen.has(overlayKey), `${source.relativePath} ${entry.path} ${entry.contextId ?? ""}`.trim()).toBe(
          false,
        );
        seen.add(overlayKey);
        if (entry.contextId) {
          const indexedEntry = byPath.get(entry.path);
          expect(
            indexedEntry?.probeContexts?.some((context) => context.id === entry.contextId),
            `${source.relativePath} ${entry.path} ${entry.contextId}`,
          ).toBe(true);
        }
        assertObjectPropertyValueMetadata(entry);
        expect(
          hasManualReadyValueMetadata(entry),
          `${source.relativePath} ${entry.path} ${entry.contextId ?? ""}`.trim(),
        ).toBe(true);
      }
    }

    expect(byPath.get("WS.N.N.Image.Text")).toMatchObject({
      osc: "/b/WS/0/2/Image/Text",
      variants: [{ path: "WS.0.2.Image.Text", osc: "/b/WS/0/2/Image/Text" }],
      probeContexts: [
        expect.objectContaining({
          id: "cue-type:text",
          kind: "cue-type",
          label: "Text",
          probePrefix: "WS.0.2",
          probeOscPrefix: "/b/WS/0/2",
        }),
      ],
    });
    expect(byPath.get("WS.N.N.Image.Amplitude")).toMatchObject({
      osc: "/b/WS/1/0/Image/Amplitude",
      variants: [{ path: "WS.1.0.Image.Amplitude", osc: "/b/WS/1/0/Image/Amplitude" }],
      probeContexts: [
        expect.objectContaining({
          id: "cue-shape:parametric-image:wave",
          kind: "cue-shape",
          label: "wave",
          parentLabel: "Parametric-Image",
          probePrefix: "WS.1.0",
          probeOscPrefix: "/b/WS/1/0",
        }),
      ],
    });
    expect(byPath.get("FX.N.N.N.Oscillator.Period")?.probeContexts).toContainEqual(
      expect.objectContaining({
        id: "quickfx:oscillating-effect:zoom:fx-0-0-0",
        kind: "quickfx-effect",
        label: "Zoom",
        parentLabel: "Oscillating effect",
        probePrefix: "FX.0.0.0",
        probeOscPrefix: "/b/FX/0/0/0",
      }),
    );
    expect(byPath.get("FX.N.N.Name")?.probeContexts).toHaveLength(60);
    expect(byPath.get("FX.N.N.Name")?.probeContexts).toContainEqual(
      expect.objectContaining({
        id: "quickfx-cell:fx-0-0",
        kind: "quickfx-cell",
        label: "OSCILLATING EFFECTS",
        probePrefix: "FX.0.0",
        probeOscPrefix: "/b/FX/0/0",
      }),
    );
  });

  it("keeps object-property readback overlay entries structurally valid", () => {
    const overlayFiles = readObjectPropertyReadbackOverlayFiles();
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set(objectPropertyIndex.entries.map((entry) => entry.path));

    expect(overlayFiles.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const source of overlayFiles) {
      expect(source.overlay.schemaVersion, source.relativePath).toBe(1);
      for (const entry of source.overlay.entries) {
        expect(knownPaths.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(true);
        expect(seen.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(false);
        seen.add(entry.path);
        assertObjectPropertyReadbackMetadata(entry);
      }
    }
  });

  it("keeps object-property behavior classification overlay entries structurally valid", () => {
    const overlayFiles = readObjectPropertyClassificationOverlayFiles();
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set(objectPropertyIndex.entries.map((entry) => entry.path));
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(overlayFiles.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const source of overlayFiles) {
      expect(source.overlay.schemaVersion, source.relativePath).toBe(1);
      for (const entry of source.overlay.entries) {
        expect(knownPaths.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(true);
        expect(seen.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(false);
        seen.add(entry.path);
        assertObjectPropertyBehaviorClassification(entry);
        expect(byPath.get(entry.path)?.classification, entry.path).toMatchObject({
          accessMode: entry.accessMode,
          behaviorKind: entry.behaviorKind,
          writeTestStatus: entry.writeTestStatus,
          readbackStatus: entry.readbackStatus,
          evidenceLevel: entry.evidenceLevel,
        });
      }
    }
  });

  it("keeps object readback evidence reports structurally valid", () => {
    const reports = readObjectReadbackEvidenceFiles();

    expect(reports.length).toBeGreaterThan(0);
    for (const source of reports) {
      expect(source.report.schemaVersion, source.relativePath).toBe(1);
      expect(source.report.runtime.operatorSupervised, source.relativePath).toBe(true);
      expect(source.report.runtime.observedAt, source.relativePath).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(source.report.entries.length, source.relativePath).toBeGreaterThan(0);
      for (const entry of source.report.entries) {
        expect(entry.objectPath.trim().length, `${source.relativePath} objectPath`).toBeGreaterThan(0);
        expect(entry.probePath.trim().length, `${source.relativePath} ${entry.objectPath}`).toBeGreaterThan(0);
        expect(entry.probeMode, `${source.relativePath} ${entry.objectPath}`).toBe("readback-only");
        expect(["number", "integer", "float", "string", "boolean", "enum", "unknown"]).toContain(entry.valueType);
        expect(["string", "number", "boolean", "object"]).toContain(typeof entry.baseline.value);
        if (entry.baseline.typeTag !== undefined) expect(["f", "i", "s"]).toContain(entry.baseline.typeTag);
        expect(entry.restore.notes.trim().length, `${source.relativePath} ${entry.objectPath}`).toBeGreaterThan(0);
        expect(["not-needed", "restored-baseline", "command-restore", "manual-restore", "prefix-retired"]).toContain(
          entry.restore.strategy,
        );
        expect(entry.evidenceNote.trim().length, `${source.relativePath} ${entry.objectPath}`).toBeGreaterThan(0);
        expect(typeof entry.locationAware, `${source.relativePath} ${entry.objectPath}`).toBe("boolean");
        if (entry.locationAware) {
          expect(entry.locationContext, `${source.relativePath} ${entry.objectPath}`).toBeDefined();
          expect(entry.probePath.split(".").includes("N"), `${source.relativePath} ${entry.objectPath}`).toBe(false);
        }
      }
    }
  }, 30_000);

  it("ships Zone count readbacks with write-tested metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const readbackIssuePrefix =
      "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";
    const valueIssuePrefix = "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";
    const zoneReadbackPaths = ["Zone.Count", "Zone.N.OutputPointCount", "ZoneAlias.OutputPointCount"];
    const zoneValuePaths = ["Zone.N.Count", "ZoneAlias.Count"];

    for (const path of zoneReadbackPaths) {
      const entry = byPath.get(path);
      expect(entry?.readbackMetadata, path).toMatchObject({
        readable: true,
        valueType: "integer",
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(readbackIssuePrefix) ?? false, path).toBe(true);
      expect(entry?.valueMetadata, path).toBeUndefined();
      expect(entry?.contextValueMetadata, path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    for (const path of zoneValuePaths) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 1000000,
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(entry?.valueMetadata?.notes?.startsWith(valueIssuePrefix) ?? false, path).toBe(true);
      expect(entry?.readbackMetadata, path).toBeUndefined();
      expect(entry?.contextValueMetadata, path).toBeUndefined();
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
    }
  });

  it("ships Zone effect readbacks as lookup metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime readback-only evidence on 2026-05-15 issue #410 confirmed ";
    const readbackPaths = new Map([
      ["Zone.N.Effect.ChaseTimeMode", "integer"],
      ["Zone.N.Effect.ZoneMode", "integer"],
      ["Zone.N.Effect.N.TimeStateCanRestart", "boolean"],
      ["Zone.N.Effect.Zone", "string"],
      ["Zone.N.Effect.N.RouterInZone", "string"],
      ["Zone.N.Effect.N.RouterOutZone", "string"],
      ["Zone.N.Effect.N.TimeName", "string"],
      ["ZoneAlias.Effect.ChaseTimeMode", "integer"],
      ["ZoneAlias.Effect.ZoneMode", "integer"],
      ["ZoneAlias.Effect.N.TimeStateCanRestart", "boolean"],
      ["ZoneAlias.Effect.Zone", "string"],
      ["ZoneAlias.Effect.N.RouterInZone", "string"],
      ["ZoneAlias.Effect.N.RouterOutZone", "string"],
      ["ZoneAlias.Effect.N.TimeName", "string"],
    ] as const);

    for (const [path, valueType] of readbackPaths) {
      const entry = byPath.get(path);
      expect(entry?.readbackMetadata, path).toMatchObject({
        readable: true,
        valueType,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(true);
      expect(entry?.valueMetadata, path).toBeUndefined();
      expect(entry?.contextValueMetadata, path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }
  });

  it("ships Zone name readbacks as lookup metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const originalIssuePrefix = "Runtime readback-only evidence on 2026-05-15 issue #412 confirmed ";
    const retestIssuePrefix =
      "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";

    for (const path of ["Zone.N.Name", "ZoneAlias.Name"]) {
      const entry = byPath.get(path);
      expect(entry?.readbackMetadata, path).toMatchObject({
        readable: true,
        valueType: "string",
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      const expectedPrefix = path === "ZoneAlias.Name" ? retestIssuePrefix : originalIssuePrefix;
      expect(entry?.readbackMetadata?.notes?.startsWith(expectedPrefix) ?? false, path).toBe(true);
      expect(entry?.valueMetadata, path).toBeUndefined();
      expect(entry?.contextValueMetadata, path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }
  });

  it("ships Zone direct leftover retest results", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/zone/direct-leftover-readbacks.json",
    );
    const zonePromotions = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/zone/readback-retest-promotions.json",
    );
    const zoneAliasPromotions = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/zone-alias/readback-retest-promotions.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486";

    expect(readbackOverlay.entries).toHaveLength(20);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    const directPromotions = zonePromotions.entries
      .concat(zoneAliasPromotions.entries)
      .filter((entry) => entry.path.includes(".Preview.") || entry.path.includes(".UGC."));
    expect(directPromotions).toHaveLength(60);
    for (const metadata of directPromotions) {
      const entry = byPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
    }

    expect(byPath.get("Universe.N.Button1.CenterX")?.valueMetadata).toMatchObject({
      valueType: "number",
    });
    expect(byPath.get("Universe.N.Button1.ColorOn")?.valueMetadata).toMatchObject({
      valueType: "integer",
    });
    expect(byPath.get("Universe.N.N.CenterX")?.valueMetadata?.notes).toContain("issue #486");
  });

  it("ships final Zone nested write/readback results and fully classifies Zone roots", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/zone/remaining-nested-readbacks.json",
    );
    const zonePromotions = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/zone/readback-retest-promotions.json",
    );
    const zoneAliasPromotions = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/zone-alias/readback-retest-promotions.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(0);
    const nestedPromotions = zonePromotions.entries
      .concat(zoneAliasPromotions.entries)
      .filter((entry) => entry.path.includes(".Effect.N.Keys.") || entry.path.includes(".Effect.N.Time"));
    expect(nestedPromotions).toHaveLength(15);
    for (const metadata of nestedPromotions) {
      const entry = byPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          evidenceLevel: "observed",
        },
      });
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
    }

    expect(byPath.get("ZoneAlias.Effect.N.TimeClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1000000,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.N.TimeDuration")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1000000,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.N.TimeMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1000000,
        boundaryBehavior: "clamp",
      },
    });

    for (const root of ["Zone", "ZoneAlias"]) {
      const rootEntries = objectPropertyIndex.entries.filter((entry) => entry.root === root);
      const unclassified = rootEntries.filter(
        (entry) => !entry.valueMetadata && !entry.readbackMetadata && !entry.contextValueMetadata?.length,
      );
      expect(unclassified, root).toEqual([]);
    }
  });

  it("ships Universe effect leftover readbacks as lookup metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/universe/effect-leftover-readbacks.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime readback-only evidence on 2026-05-15 issue #296 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(30);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }
  });

  it("ships Universe common write/readback results with ColorOff retained as no-op readback metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/universe/common-control-readbacks.json",
    );
    const rangeOverlay = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/universe/common-write-readbacks.json",
    );
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        testedValues: Array<{ input: string | number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-486-universe-common-write-readbacks.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(25);
    expect(readbackOverlay.entries.every((entry) => entry.path.endsWith(".ColorOff"))).toBe(true);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-mostly",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(rangeOverlay.entries).toHaveLength(250);
    expect(evidence.entries).toHaveLength(275);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(250);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(25);

    for (const metadata of rangeOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(byPath.get("Universe.N.Button1.CenterX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("Universe.N.Button1.ColorActive")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "raw signed 32-bit integer",
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("Universe.N.Button1.ColorOff")?.readbackMetadata).toMatchObject({
      probePath: "Universe.0.Button1.ColorOff",
      valueType: "integer",
      typeTag: "i",
    });
    expect(byPath.get("Universe.N.Button1.ColorOff")?.valueMetadata).toBeUndefined();

    const colorOffEvidence = evidence.entries.find((entry) => entry.objectPath === "Universe.N.Button1.ColorOff");
    expect(colorOffEvidence).toMatchObject({
      shipsMetadata: false,
      boundaryBehavior: "unknown",
    });
    expect(colorOffEvidence?.testedValues.some((value) => value.behavior === "no-op")).toBe(true);
  });

  it("ships Universe nested Zone write/readback no-op results without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/universe/zone-nested-readbacks.json",
    );
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        testedValues: Array<{ input?: string | number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-486-universe-zone-write-readbacks.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(606);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-only",
        behaviorKind: "computed-status",
        writeTestStatus: "write-no-op-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(evidence.entries).toHaveLength(606);
    expect(evidence.entries.every((entry) => entry.shipsMetadata === false)).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "no-op")).toBe(true);
    expect(evidence.entries.some((entry) => entry.testedValues.some((value) => value.behavior === "no-op"))).toBe(true);
    expect(
      evidence.entries.some((entry) =>
        entry.testedValues.some((value) => typeof value.input === "number" && value.input > 100000),
      ),
    ).toBe(true);
    expect(
      evidence.entries.some((entry) =>
        entry.testedValues.some((value) => typeof value.input === "string" && value.input.length >= 254),
      ),
    ).toBe(true);

    expect(byPath.get("Universe.N.N.Zone.Preview.PositionX")?.readbackMetadata).toMatchObject({
      probePath: "Universe.0.22.Zone.Preview.PositionX",
      valueType: "number",
      typeTag: "f",
    });
    expect(byPath.get("Universe.N.ZonePad1.Zone.Active")?.readbackMetadata).toMatchObject({
      probePath: "Universe.0.ZonePad1.Zone.Active",
      valueType: "boolean",
      typeTag: "i",
    });
    expect(byPath.get("Universe.N.ZonePad2.Zone.Effect.N.TimeName")?.readbackMetadata).toMatchObject({
      probePath: "Universe.0.ZonePad2.Zone.Effect.0.TimeName",
      valueType: "string",
      typeTag: "s",
    });
  });

  it("ships typed UniversePanelAlias readbacks and promoted common alias ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/universe-panel-alias/typed-control-readbacks.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime write/readback evidence on 2026-05-17 issue #486 confirmed ";
    const promotedPaths = [
      "UniversePanelAlias.Control.CenterX",
      "UniversePanelAlias.Control.CenterY",
      "UniversePanelAlias.Control.ColorActive",
      "UniversePanelAlias.Control.ColorOn",
      "UniversePanelAlias.Control.DropDuration",
      "UniversePanelAlias.Control.MaxValue",
      "UniversePanelAlias.Control.MinValue",
      "UniversePanelAlias.Control.Radius",
      "UniversePanelAlias.Control.Tag",
      "UniversePanelAlias.Control.TimeShift",
    ];

    expect(readbackOverlay.entries).toHaveLength(523);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    for (const promotedPath of promotedPaths) {
      const entry = byPath.get(promotedPath);
      expect(entry?.valueMetadata, promotedPath).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "pass-through",
        },
      });
      expect(entry?.readbackMetadata, promotedPath).toBeUndefined();
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
    }

    expect(byPath.get("UniversePanelAlias.Control.ColorOff")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.Button1.ColorOff",
      valueType: "integer",
      typeTag: "i",
    });
    expect(byPath.get("UniversePanelAlias.Control.CenterX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.ColorActive")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Alpha")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.0.Alpha",
      valueType: "integer",
      typeTag: "i",
    });
    expect(byPath.get("UniversePanelAlias.Control.Zone.Effect.N.TimeName")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.ZonePad1.Zone.Effect.0.TimeName",
      valueType: "string",
      typeTag: "s",
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Ani.N.MaxValue")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.13.Ani.0.MaxValue",
      valueType: "number",
      typeTag: "f",
    });
    expect(byPath.get("UniversePanelAlias.Control.N.ContainStartScript")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.0.ContainStartScript",
      valueType: "number",
      typeTag: "f",
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Image.Amplitude")?.readbackMetadata).toMatchObject({
      probePath: "Untitled.6.Image.Amplitude",
      valueType: "number",
      typeTag: "f",
    });
  });

  it("ships remaining identifier-safe FX readbacks as lookup metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/fx/identifier-safe-readbacks.json",
    );
    const issue513Overlay = readJson<ObjectPropertyBehaviorClassificationOverlayFile>(
      "object-property-classifications/issue-513-fx-readback-retest.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime readback-only evidence on 2026-05-15 issue #319 confirmed ";
    const writeAuditPrefix = "Runtime SetProp write/readback evidence on 2026-05-17 issue #216 confirmed ";
    const retestPrefix = "Fresh BEYOND issue #513 ";
    const promotedPaths = new Set([
      "FX.N.N.N.Keys.N.Value1",
      "FX.N.N.N.Keys.N.Value2",
      "FX.N.N.N.Keys.N.Value3",
      "FX.N.N.N.Keys.X",
      "FX.N.N.N.Keys.Y",
      "FX.N.N.N.Keys.Z",
      "FX.N.N.N.TimeClock",
      "FX.N.N.N.TimeDuration",
      "FX.N.N.N.TimeMetro",
      ...issue513Overlay.entries.filter((entry) => entry.accessMode === "read-write").map((entry) => entry.path),
    ]);

    expect(readbackOverlay.entries).toHaveLength(11);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      const notes = entry?.readbackMetadata?.notes ?? "";
      expect(
        notes.startsWith(issuePrefix) || notes.startsWith(writeAuditPrefix) || notes.startsWith(retestPrefix),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(promotedPaths.has(metadata.path), metadata.path).toBe(false);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    for (const promotedPath of promotedPaths) {
      const entry = byPath.get(promotedPath);
      expect(entry?.readbackMetadata, promotedPath).toBeUndefined();
      expect(entry?.valueMetadata, promotedPath).toMatchObject({
        evidenceLevel: "observed",
        valueRange: expect.objectContaining({
          max: 120000,
        }),
      });
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
    }

    expect(byPath.get("FX.CAPTION")?.readbackMetadata).toMatchObject({
      probePath: "FX.CAPTION",
      valueType: "string",
      typeTag: "s",
    });
    expect(byPath.get("FX.N.N.N.Oscillator.CENTERX")?.readbackMetadata).toMatchObject({
      probePath: "FX.0.0.0.Oscillator.CENTERX",
      valueType: "number",
      typeTag: "f",
    });
    expect(byPath.get("FX.N.N.N.RouterInZone")?.readbackMetadata).toMatchObject({
      probePath: "FX.0.0.0.RouterInZone",
      valueType: "string",
      typeTag: "s",
    });

    for (const specialKeyPath of ["FX.N.N.N.Keys.-Z", "FX.N.N.N.Keys.CenterX(%)", "FX.N.N.N.Keys.B<-B*"]) {
      const entry = byPath.get(specialKeyPath);
      expect(entry?.readbackMetadata, specialKeyPath).toBeUndefined();
    }
  });

  it("ships issue 319 FX special-character key write/readback metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/fx/special-key-controls.json");
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        baseline: { value: number | null; typeTag?: string };
        testedValues: Array<{ input: number; readback: number; behavior: string }>;
        restore: { strategy: string; restoredValue?: number | null; notes: string };
        valueRange?: { min: number; max: number; unit: string };
      }>;
    }>("object-range-evidence/issue-319-fx-special-key-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime RegisterOscFeedback SetProp write/readback on 2026-05-16 issue #319 confirmed ";
    const classified = (entry: {
      valueMetadata?: ObjectPropertyValueMetadata;
      contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      readbackMetadata?: ObjectPropertyReadbackMetadata;
    }): boolean => Boolean(entry.valueMetadata || entry.contextValueMetadata?.length || entry.readbackMetadata);

    expect(rangeOverlay.entries).toHaveLength(64);
    expect(rangeEvidence).toMatchObject({ parentIssue: 216, batchIssue: 319 });
    expect(rangeEvidence.entries).toHaveLength(64);
    expect(
      new Set(rangeEvidence.entries.filter((entry) => entry.shipsMetadata).map((entry) => entry.objectPath)),
    ).toEqual(new Set(rangeOverlay.entries.map((entry) => entry.path)));
    expect(objectPropertyIndex.entries.filter((entry) => entry.root === "FX" && !classified(entry))).toHaveLength(0);

    for (const metadata of rangeOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const contextMetadata = entry?.contextValueMetadata?.find((context) => context.contextId === metadata.contextId);
      expect(contextMetadata, `${metadata.path} ${metadata.contextId}`).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "quickfx-slot",
          populationDependent: true,
        },
      });
      expect(contextMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyValueMetadata(contextMetadata as ObjectPropertyValueMetadata);
    }

    expect(byPath.get("FX.N.N.N.Keys.B<-G*")?.contextValueMetadata?.[0]).toMatchObject({
      valueRange: {
        min: -100000,
        max: 100000,
        unit: "matrix coefficient",
      },
      notes: expect.stringContaining("zero-state feedback suppression"),
    });
    expect(byPath.get("FX.N.N.N.Keys.-Z")?.contextValueMetadata?.[0]).toMatchObject({
      valueRange: {
        min: -100000,
        max: 100000,
        unit: "perspective coefficient",
      },
      notes: expect.stringContaining("observed baseline"),
    });
    expect(byPath.get("FX.N.N.N.Keys.CenterX(%)")?.contextValueMetadata?.[0]).toMatchObject({
      valueRange: {
        min: -10000,
        max: 10000,
        unit: "percent",
      },
    });

    const zeroSuppressedEvidence = rangeEvidence.entries.filter((entry) => entry.baseline.value === null);
    expect(zeroSuppressedEvidence).toHaveLength(36);
    for (const entry of zeroSuppressedEvidence) {
      expect(entry.restore).toMatchObject({
        strategy: "command-restore",
        restoredValue: 0,
      });
      expect(
        entry.testedValues.every((value) => value.input === value.readback && value.behavior === "pass-through"),
      ).toBe(true);
    }
  });

  it("remediates WS Synthesized Image LIST.0 rows with write/readback metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/ws/synthesized-image-list0-write-remediation-controls.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/ws/synthesized-image-list0-readbacks.json",
    );
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        deferReason?: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input: number | string;
          readback: number | string | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue?: number | string;
          notes: string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-451-ws-synthesized-image-list0-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedWritable = new Map([
      [
        "WS.N.N.Image.LIST.0.AngleX",
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.AngleY",
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.AngleZ",
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.AudioMode",
        { valueType: "number", min: -1, max: 10, unit: "audio mode", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.Color",
        { valueType: "integer", min: 0, max: 16777215, unit: "RGB color integer", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.Radius",
        { valueType: "number", min: 0, max: 6553400, unit: "radius readback", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionX",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "unknown",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionY",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "unknown",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionZ",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "unknown",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeX",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeY",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "unknown" },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeZ",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "unknown" },
      ],
    ]);
    const expectedReadbackOnly = new Set([
      "WS.N.N.Image.LIST.0.Effect.ChaseTimeMode",
      "WS.N.N.Image.LIST.0.Effect.Zone",
      "WS.N.N.Image.LIST.0.Effect.ZoneMode",
    ]);
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(12);
    expect(readbackOverlay.entries).toHaveLength(3);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 451,
    });
    expect(rangeEvidence.entries).toHaveLength(15);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedWritable.keys()));

    for (const metadata of rangeOverlay.entries) {
      const expectedRange = expectedWritable.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const contextMetadata = entry?.contextValueMetadata?.find(
        (context) => context.contextId === "cue-type:synthesized-image",
      );
      const evidence = evidenceByPath.get(metadata.path);

      expect(expectedRange, metadata.path).toBeDefined();
      expect(metadata).toMatchObject({
        contextId: "cue-type:synthesized-image",
        valueType: expectedRange?.valueType,
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          boundaryBehavior: expectedRange?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      const { path: _path, ...metadataWithoutPath } = metadata;
      expect(contextMetadata, metadata.path).toMatchObject(metadataWithoutPath);
      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringContaining("WS.0.8.Image.LIST.0"),
        probeMode: "write-readback",
        shipsMetadata: true,
        valueType: expectedRange?.valueType,
        evidenceLevel: "observed",
        boundaryBehavior: expectedRange?.boundaryBehavior,
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
        },
        restore: {
          strategy: "command-restore",
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
    }

    expect(evidenceByPath.get("WS.N.N.Image.LIST.0.AngleX")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 10000, readback: 100, behavior: "unknown" }),
    );
    expect(evidenceByPath.get("WS.N.N.Image.LIST.0.Image.AudioMode")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 10, readback: 10, behavior: "pass-through" }),
    );
    expect(evidenceByPath.get("WS.N.N.Image.LIST.0.Image.Color")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -1, readback: 16777215, behavior: "wrap" }),
        expect.objectContaining({ input: 16777216, readback: 16777215, behavior: "clamp" }),
      ]),
    );
    expect(evidenceByPath.get("WS.N.N.Image.LIST.0.SizeX")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 10000, readback: 1, behavior: "unknown" }),
    );

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        notes: expect.stringMatching(/^Runtime write\/readback evidence on 2026-05-16 issue #451 confirmed /),
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probeMode: "write-readback",
        shipsMetadata: false,
        evidenceLevel: "observed",
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("remains readback-only"),
      });
      expect(
        evidence?.testedValues.some((value) => value.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("WS.N.N.Image.LIST.0.Effect.Zone")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.8.Image.LIST.0.Effect.Zone",
      valueType: "string",
      typeTag: "s",
      observedValue: "",
    });
  });

  it("remediates WS Ani.0 rows with write/readback value metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/ws/ani0-write-remediation-controls.json");
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        valueRange: {
          min: number;
          max: number;
          unit: string;
          minInclusive: boolean;
          maxInclusive: boolean;
        };
        testedValues: Array<{
          input: number;
          readback: number;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue: number;
          notes: string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-447-ws-ani0-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedRangeByPath = new Map([
      ["WS.N.N.Ani.0.MaxValue", { min: -101, max: 101, unit: "animator value" }],
      ["WS.N.N.Ani.0.MinValue", { min: -101, max: 101, unit: "animator value" }],
      ["WS.N.N.Ani.0.Period", { min: -1, max: 1000, unit: "period" }],
      ["WS.N.N.Ani.0.tsBuddy", { min: -1, max: 2, unit: "time shift state" }],
      ["WS.N.N.Ani.0.tsGrouping", { min: -1, max: 2, unit: "time shift state" }],
      ["WS.N.N.Ani.0.tsPhase", { min: -101, max: 101, unit: "phase" }],
      ["WS.N.N.Ani.0.tsShiftBetweenItems", { min: -101, max: 101, unit: "shift" }],
      ["WS.N.N.Ani.0.tsWindowTime", { min: -1, max: 101, unit: "time" }],
      ["WS.N.N.Ani.0.WavePhase", { min: -361, max: 361, unit: "phase" }],
      ["WS.N.N.Ani.0.WaveStillState", { min: -1, max: 2, unit: "wave state" }],
    ]);
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(10);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 447,
    });
    expect(rangeEvidence.entries).toHaveLength(10);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedRangeByPath.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expectedRange = expectedRangeByPath.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const contextMetadata = entry?.contextValueMetadata?.find(
        (context) => context.contextId === "cue-type:object-animator",
      );
      const evidence = evidenceByPath.get(metadata.path);

      expect(expectedRange, metadata.path).toBeDefined();
      expect(metadata).toMatchObject({
        contextId: "cue-type:object-animator",
        valueType: "number",
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(contextMetadata, metadata.path).toMatchObject({
        contextId: "cue-type:object-animator",
        valueType: "number",
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      assertObjectPropertyValueMetadata(contextMetadata as ObjectPropertyValueMetadata);
      assertObjectPropertyValueMetadata(metadata);

      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringMatching(/^WS\.0\.13\.Ani\.0\./),
        probeMode: "write-readback",
        shipsMetadata: true,
        valueType: "number",
        evidenceLevel: "observed",
        boundaryBehavior: "pass-through",
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          minInclusive: true,
          maxInclusive: true,
        },
        restore: {
          strategy: "command-restore",
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
      for (const testedValue of evidence?.testedValues ?? []) {
        expect(testedValue.behavior, `${metadata.path} ${testedValue.input}`).toBe("pass-through");
        expect(
          Math.abs(testedValue.readback - testedValue.input),
          `${metadata.path} ${testedValue.input}`,
        ).toBeLessThan(0.00001);
      }
    }
  });

  it("remediates WS Image.0 rows with write/readback metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/ws/image0-write-remediation-controls.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/ws/image0-readbacks.json",
    );
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        deferReason?: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
          minInclusive: boolean;
          maxInclusive: boolean;
        };
        testedValues: Array<{
          input: number;
          readback: number;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue?: number;
          notes: string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-449-ws-image0-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedWritable = new Map([
      ["WS.N.N.Image.0.SizeMOD1", { min: -200, max: 199, unit: "size modulation", boundaryBehavior: "unknown" }],
      ["WS.N.N.Image.0.SizeMOD2", { min: -200, max: 199, unit: "size modulation", boundaryBehavior: "unknown" }],
      ["WS.N.N.Image.0.WaveMOD1", { min: -1000, max: 1000, unit: "wave modulation", boundaryBehavior: "pass-through" }],
      ["WS.N.N.Image.0.WaveMOD2", { min: -1000, max: 1000, unit: "wave modulation", boundaryBehavior: "pass-through" }],
    ]);
    const expectedReadbackOnly = new Set([
      "WS.N.N.Image.0.WaveOSC1",
      "WS.N.N.Image.0.WaveOSC2",
      "WS.N.N.Image.0.WaveOSC3",
    ]);
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(4);
    expect(readbackOverlay.entries).toHaveLength(3);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 449,
    });
    expect(rangeEvidence.entries).toHaveLength(7);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedWritable.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expectedRange = expectedWritable.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const contextMetadata = entry?.contextValueMetadata?.find(
        (context) => context.contextId === "cue-type:classic-ld2000-abstract",
      );
      const evidence = evidenceByPath.get(metadata.path);

      expect(expectedRange, metadata.path).toBeDefined();
      expect(metadata).toMatchObject({
        contextId: "cue-type:classic-ld2000-abstract",
        valueType: "number",
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          boundaryBehavior: expectedRange?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(contextMetadata, metadata.path).toMatchObject({
        contextId: "cue-type:classic-ld2000-abstract",
        valueType: "number",
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          boundaryBehavior: expectedRange?.boundaryBehavior,
          evidenceLevel: "observed",
        },
      });
      assertObjectPropertyValueMetadata(contextMetadata as ObjectPropertyValueMetadata);
      assertObjectPropertyValueMetadata(metadata);

      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringMatching(/^WS\.0\.5\.Image\.0\./),
        probeMode: "write-readback",
        shipsMetadata: true,
        valueType: "number",
        evidenceLevel: "observed",
        boundaryBehavior: expectedRange?.boundaryBehavior,
        valueRange: {
          min: expectedRange?.min,
          max: expectedRange?.max,
          unit: expectedRange?.unit,
          minInclusive: true,
          maxInclusive: true,
        },
        restore: {
          strategy: "command-restore",
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
      if (metadata.path.includes("SizeMOD")) {
        expect(
          evidence?.testedValues.some((tested) => tested.behavior === "clamp"),
          metadata.path,
        ).toBe(true);
        expect(
          evidence?.testedValues.some((tested) => tested.behavior === "wrap"),
          metadata.path,
        ).toBe(true);
        expect(
          evidence?.testedValues.some((tested) => tested.behavior === "pass-through"),
          metadata.path,
        ).toBe(true);
      } else {
        for (const testedValue of evidence?.testedValues ?? []) {
          expect(testedValue.behavior, `${metadata.path} ${testedValue.input}`).toBe("pass-through");
          expect(
            Math.abs(testedValue.readback - testedValue.input),
            `${metadata.path} ${testedValue.input}`,
          ).toBeLessThan(0.00001);
        }
      }
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        observedValue: 0,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(
        entry?.readbackMetadata?.notes?.startsWith("Runtime write/readback evidence on 2026-05-16 issue #449") ?? false,
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);

      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringMatching(/^WS\.0\.5\.Image\.0\.WaveOSC/),
        probeMode: "write-readback",
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
        restore: {
          strategy: "not-needed",
        },
      });
      expect(
        evidence?.testedValues.some((tested) => tested.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      expect(
        evidence?.testedValues.every((tested) => tested.readback === 0),
        metadata.path,
      ).toBe(true);
    }
  });

  it("ships WS Image.Effect readbacks after write/readback no-op evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/ws/image-effect-readbacks.json",
    );
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        deferReason?: string;
        testedValues: Array<{
          input: number | string;
          readback: number | string | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue?: number | string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-455-ws-image-effect-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));
    const issuePrefix = "Runtime write/readback evidence on 2026-05-16 issue #455 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(3);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 455,
    });
    expect(rangeEvidence.entries).toHaveLength(3);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: metadata.probePath,
        probeMode: "write-readback",
        shipsMetadata: false,
        valueType: metadata.valueType,
        evidenceLevel: "observed",
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("remains readback-only"),
        restore: {
          strategy: "command-restore",
          restoredValue: metadata.observedValue,
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
      expect(
        evidence?.testedValues.every((value) => value.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("WS.N.N.Image.Effect.ChaseTimeMode")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.6.Image.Effect.ChaseTimeMode",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(byPath.get("WS.N.N.Image.Effect.Zone")?.readbackMetadata).toMatchObject({
      probePath: "WS.1.0.Image.Effect.Zone",
      valueType: "string",
      typeTag: "s",
      observedValue: "",
    });
    expect(byPath.get("WS.N.N.Image.Effect.ZoneMode")?.readbackMetadata).toMatchObject({
      probePath: "WS.1.0.Image.Effect.ZoneMode",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(evidenceByPath.get("WS.N.N.Image.Effect.ChaseTimeMode")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 10, readback: 0, behavior: "no-op" }),
    );
    expect(evidenceByPath.get("WS.N.N.Image.Effect.Zone")?.testedValues).toContainEqual(
      expect.objectContaining({ input: "pangolint", readback: "", behavior: "no-op" }),
    );
  });

  it("ships WS top-level common readbacks after write/readback no-op evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/ws/top-level-common-readbacks.json",
    );
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        deferReason?: string;
        testedValues: Array<{
          input: number | string;
          readback: number | string | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue?: number | string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-453-ws-common-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));
    const issuePrefix = "Runtime write/readback evidence on 2026-05-16 issue #453 confirmed ";

    expect(readbackOverlay.entries).toHaveLength(11);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 453,
    });
    expect(rangeEvidence.entries).toHaveLength(11);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probePath: expect.stringMatching(/^WS\.0\.0\./),
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: metadata.probePath,
        probeMode: "write-readback",
        shipsMetadata: false,
        valueType: metadata.valueType,
        evidenceLevel: "observed",
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("remains readback-only"),
        restore: {
          strategy: "command-restore",
          restoredValue: metadata.observedValue,
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
      expect(
        evidence?.testedValues.every((value) => value.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("WS.N.N.ContainEndScript")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.0.ContainEndScript",
      valueType: "string",
      typeTag: "s",
      observedValue: "0",
    });
    expect(byPath.get("WS.N.N.ContainStartScript")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.0.ContainStartScript",
      valueType: "string",
      typeTag: "s",
      observedValue: "0",
    });
    expect(byPath.get("WS.N.N.CueType")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.0.CueType",
      valueType: "number",
      typeTag: "f",
      observedValue: 1,
    });
    expect(byPath.get("WS.N.N.Effect.Zone")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.0.Effect.Zone",
      valueType: "string",
      typeTag: "s",
      observedValue: "",
    });
    expect(byPath.get("WS.N.N.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      probePath: "WS.0.0.VisiblePointsEnd",
      valueType: "number",
      typeTag: "f",
      observedValue: 100,
    });
    expect(evidenceByPath.get("WS.N.N.SatShift")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 10000, readback: 0, behavior: "no-op" }),
    );
    expect(evidenceByPath.get("WS.N.N.VisiblePointsEnd")?.testedValues).toContainEqual(
      expect.objectContaining({ input: 101, readback: 100, behavior: "no-op" }),
    );
  });

  it("records WS Particles image first-pass rows as deferred writable evidence", () => {
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        deferReason?: string;
        testedValues: Array<{
          input: number;
          readback: number | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue?: number;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-457-ws-particles-write-remediation.json");

    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 457,
    });
    expect(rangeEvidence.entries).toHaveLength(32);
    for (const evidence of rangeEvidence.entries) {
      expect(evidence, evidence.objectPath).toMatchObject({
        probePath: expect.stringMatching(/^WS\.0\.10\.Image\./),
        probeMode: "write-readback",
        shipsMetadata: false,
        valueType: "number",
        evidenceLevel: "observed",
        deferReason: expect.stringContaining("without proving a finite manual-ready range"),
        restore: {
          strategy: "command-restore",
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence.testedValues.length, evidence.objectPath).toBeGreaterThan(0);
    }

    expect(rangeEvidence.entries.find((entry) => entry.objectPath === "WS.N.N.Image.Brightness")).toMatchObject({
      probePath: "WS.0.10.Image.Brightness",
      boundaryBehavior: "pass-through",
      baseline: {
        value: 100,
      },
      testedValues: expect.arrayContaining([
        expect.objectContaining({ input: -1, readback: -1, behavior: "pass-through" }),
        expect.objectContaining({ input: 200, readback: 200, behavior: "pass-through" }),
      ]),
    });
    expect(rangeEvidence.entries.find((entry) => entry.objectPath === "WS.N.N.Image.Gravity")).toMatchObject({
      probePath: "WS.0.10.Image.Gravity",
      boundaryBehavior: "pass-through",
      baseline: {
        value: 18.310546875,
      },
      testedValues: expect.arrayContaining([
        expect.objectContaining({ input: -1000, readback: -1000, behavior: "pass-through" }),
        expect.objectContaining({ input: 10000, readback: 10000, behavior: "pass-through" }),
      ]),
    });
    expect(rangeEvidence.entries.find((entry) => entry.objectPath === "WS.N.N.Image.RotoDeceleration")).toMatchObject({
      probePath: "WS.0.10.Image.RotoDeceleration",
      boundaryBehavior: "unknown",
      testedValues: expect.arrayContaining([
        expect.objectContaining({ input: -100, readback: -0.009999999776482582, behavior: "unknown" }),
        expect.objectContaining({ input: 10000, readback: 1, behavior: "unknown" }),
      ]),
    });
  });

  it("completes WS Image gap coverage with issue 459 write/readback metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/ws/image-gap-sampled-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<{
        path: string;
        probePath: string;
        observedValue: number;
        notes: string;
      }>;
    }>("object-property-readbacks/ws/image-gap-noop-readbacks.json");
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input: number;
          readback: number | null;
          behavior: string;
        }>;
        restore: {
          strategy: string;
        };
      }>;
    }>("object-range-evidence/issue-459-ws-image-gap-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    const wsGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "WS" && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );
    expect(wsGaps).toHaveLength(0);
    expect(rangeOverlay.entries).toHaveLength(96);
    expect(readbackOverlay.entries).toHaveLength(4);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 459,
    });
    expect(rangeEvidence.entries).toHaveLength(100);
    expect(new Set(rangeEvidence.entries.map((entry) => entry.objectPath)).size).toBe(100);

    const expectedRanges = new Map([
      [
        "WS.N.N.Image.Brightness",
        { contextId: "cue-type:particles", valueType: "number", min: -10000, max: 10000, behavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.Color",
        { contextId: "cue-type:text", valueType: "integer", min: -1, max: 16777216, behavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.Point/Line",
        {
          contextId: "cue-shape:parametric-image:horizontal-lines",
          valueType: "integer",
          min: -1000,
          max: 1000,
          behavior: "pass-through",
        },
      ],
      [
        "WS.N.N.Image.Radius",
        { contextId: "cue-type:shape", valueType: "number", min: 0, max: 6553400, behavior: "unknown" },
      ],
      [
        "WS.N.N.Image.RotoDeceleration",
        { contextId: "cue-type:particles", valueType: "number", min: -1, max: 1, behavior: "unknown" },
      ],
      [
        "WS.N.N.Image.StaticDisplayTime",
        { contextId: "cue-type:text", valueType: "number", min: 0, max: 10000, behavior: "clamp" },
      ],
      [
        "WS.N.N.Image.Turns(%)",
        {
          contextId: "cue-shape:parametric-image:elipse-multi-loop",
          valueType: "number",
          min: -10000,
          max: 10000,
          behavior: "pass-through",
        },
      ],
    ]);

    for (const [path, expected] of expectedRanges) {
      const metadata = byPath
        .get(path)
        ?.contextValueMetadata?.find((candidate) => candidate.contextId === expected.contextId);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: expected.valueType,
        evidenceLevel: "observed",
        valueRange: {
          min: expected.min,
          max: expected.max,
          boundaryBehavior: expected.behavior,
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
          indexBasis: "WS.N.N uses page index then cue slot index.",
        },
      });

      const evidence = evidenceByPath.get(path);
      expect(evidence, path).toBeDefined();
      expect(evidence).toMatchObject({
        shipsMetadata: true,
        valueType: expected.valueType,
        boundaryBehavior: expected.behavior,
        valueRange: {
          min: expected.min,
          max: expected.max,
        },
      });
    }

    expect(evidenceByPath.get("WS.N.N.Image.Point/Line")).toMatchObject({
      probeMode: "command-write-readback",
      restore: {
        strategy: "prefix-retired",
      },
      testedValues: expect.arrayContaining([
        expect.objectContaining({ input: 0, readback: null, behavior: "unknown" }),
        expect.objectContaining({ input: 1000, readback: 1000, behavior: "pass-through" }),
      ]),
    });
    expect(evidenceByPath.get("WS.N.N.Image.MultiLaser")).toMatchObject({
      shipsMetadata: false,
      boundaryBehavior: "no-op",
      testedValues: expect.arrayContaining([expect.objectContaining({ input: 10000, readback: 0, behavior: "no-op" })]),
    });

    expect(readbackOverlay.entries.map((entry) => entry.path).sort()).toEqual([
      "WS.N.N.Image.MultiLaser",
      "WS.N.N.Image.SpaceY",
      "WS.N.N.Image.TextSizeX",
      "WS.N.N.Image.TextSizeY",
    ]);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        probePath: metadata.probePath,
        observedValue: metadata.observedValue,
        valueType: "number",
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
    }
  });

  it("remediates WS Image rows with write/readback value metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { contextId: string; path: string }>;
    }>("object-property-ranges/ws/image-write-remediation-controls.json");
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        evidenceLevel: string;
        boundaryBehavior: string;
        valueRange: {
          min: number;
          max: number;
          unit: string;
          minInclusive: boolean;
          maxInclusive: boolean;
        };
        testedValues: Array<{
          input: number;
          readback: number;
          behavior: string;
        }>;
        restore: {
          strategy: string;
          restoredValue: number;
          notes: string;
        };
        locationAware: boolean;
        locationContext: {
          kind: string;
          populationDependent?: boolean;
        };
      }>;
    }>("object-range-evidence/issue-445-ws-image-write-remediation.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const expectedContextByPath = new Map([
      [
        "WS.N.N.Image.AngleX",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.AngleY",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.AngleZ",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.CursorColor",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "integer", min: -1, max: 99999999 },
      ],
      [
        "WS.N.N.Image.PosX",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.PosY",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.PosZ",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.SizeX",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.SizeY",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.SizeZ",
        { contextId: "cue-type:fifo-image", probePrefix: "WS.0.11.", valueType: "number", min: -10000, max: 10000 },
      ],
      [
        "WS.N.N.Image.AnchBrigh",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.AnchHue",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.AnchSat",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.Angle",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.EndAnch",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.LineBright",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.LineHue",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.LineSat",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.Size",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
      [
        "WS.N.N.Image.StartAnch",
        {
          contextId: "cue-shape:parametric-image:centered-line",
          probePrefix: "WS.1.2.",
          valueType: "number",
          min: -10000,
          max: 10000,
        },
      ],
    ]);
    const evidenceByPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(20);
    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 445,
    });
    expect(rangeEvidence.entries).toHaveLength(20);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedContextByPath.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expectation = expectedContextByPath.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const contextMetadata = entry?.contextValueMetadata?.find((context) => context.contextId === metadata.contextId);
      const evidence = evidenceByPath.get(metadata.path);

      expect(expectation, metadata.path).toBeDefined();
      expect(metadata).toMatchObject({
        contextId: expectation?.contextId,
        valueType: expectation?.valueType,
        valueRange: {
          min: expectation?.min,
          max: expectation?.max,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(contextMetadata, metadata.path).toMatchObject({
        contextId: expectation?.contextId,
        valueType: expectation?.valueType,
        valueRange: {
          min: expectation?.min,
          max: expectation?.max,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      assertObjectPropertyValueMetadata(contextMetadata as ObjectPropertyValueMetadata);
      assertObjectPropertyValueMetadata(metadata);

      expect(evidence, metadata.path).toMatchObject({
        probeMode: "write-readback",
        shipsMetadata: true,
        valueType: expectation?.valueType,
        evidenceLevel: "observed",
        boundaryBehavior: "pass-through",
        valueRange: {
          min: expectation?.min,
          max: expectation?.max,
          minInclusive: true,
          maxInclusive: true,
        },
        restore: {
          strategy: "command-restore",
        },
        locationAware: true,
        locationContext: {
          kind: "workspace-slot",
          populationDependent: true,
        },
      });
      expect(evidence?.probePath.startsWith(`${expectation?.probePrefix}Image.`), metadata.path).toBe(true);
      expect(evidence?.testedValues.length, metadata.path).toBeGreaterThan(0);
      for (const testedValue of evidence?.testedValues ?? []) {
        expect(testedValue.behavior, `${metadata.path} ${testedValue.input}`).toBe("pass-through");
        expect(testedValue.readback, `${metadata.path} ${testedValue.input}`).toBe(testedValue.input);
      }
    }
  });

  it("ships QShift A readbacks as write-tested no-op metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/qshift/a-control-readbacks.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix =
      "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed sampled writes to ";

    expect(readbackOverlay.entries).toHaveLength(113);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-only",
        behaviorKind: "computed-status",
        writeTestStatus: "write-no-op-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(byPath.get("QShift.N.A.Alpha")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.A.Alpha",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(byPath.get("QShift.N.A.FX8TimeShiftMetro")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.A.FX8TimeShiftMetro",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(byPath.get("QShift.N.A.Zoom")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.A.Zoom",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
  });

  it("ships QShift B readbacks as write-tested no-op metadata without value coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{ entries: Array<ObjectPropertyReadbackMetadata & { path: string }> }>(
      "object-property-readbacks/qshift/b-control-readbacks.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix =
      "Runtime SetProp and direct assignment write/readback on 2026-05-17 issue #486 confirmed non-baseline sampled writes to ";

    expect(readbackOverlay.entries).toHaveLength(113);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(entry?.readbackMetadata?.notes?.startsWith(issuePrefix) ?? false, metadata.path).toBe(true);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-only",
        behaviorKind: "computed-status",
        writeTestStatus: "write-no-op-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(byPath.get("QShift.N.B.Alpha")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.B.Alpha",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(byPath.get("QShift.N.B.FX8TimeShiftMetro")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.B.FX8TimeShiftMetro",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
    expect(byPath.get("QShift.N.B.Zoom")?.readbackMetadata).toMatchObject({
      probePath: "QShift.0.B.Zoom",
      valueType: "number",
      typeTag: "f",
      observedValue: 0,
    });
  });

  it("ships direct QShift write/readback value metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{ entries: Array<ObjectPropertyValueMetadata & { path: string }> }>(
      "object-property-ranges/qshift/direct-controls.json",
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(rangeOverlay.entries).toHaveLength(6);
    for (const metadata of rangeOverlay.entries) {
      const entry = byPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
      });
      expect(entry?.valueMetadata?.notes?.includes("issue #486") ?? false, metadata.path).toBe(true);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.classification, metadata.path).toMatchObject({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      });
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      assertObjectPropertyBehaviorClassification(entry?.classification as ObjectPropertyBehaviorClassification);
    }

    expect(byPath.get("QShift.N.Action")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -2147483648,
        max: 1000000,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("QShift.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 1000000,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("QShift.N.PhaseDir")?.valueMetadata).toMatchObject({
      valueType: "number",
    });
    expect(byPath.get("QShift.N.Width")?.valueMetadata).toMatchObject({
      valueType: "number",
    });

    const qshiftGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.path.startsWith("QShift.") &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(qshiftGaps).toHaveLength(0);
  });

  it("seeds exact object-property ranges from command value metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commandDerived = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Command-derived seed"),
    );

    expect(commandDerived).toHaveLength(58);
    for (const entry of commandDerived) {
      expect(byPath.has(entry.path), entry.path).toBe(true);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.notes).toContain("exact setsProperty target");
      expect(entry.valueMetadata?.notes).toContain("not same-name propagation");
    }
    expect(byPath.get("Grid.CellIndex")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.AudioVolumeMute")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.CueBeatShift")?.valueMetadata?.notes).not.toContain("Command-derived seed");
    expect(byPath.get("Master.ShowShift")?.valueMetadata?.notes).not.toContain("Command-derived seed");

    expect(byPath.get("Master.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.CaptionColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
      },
    });
    expect(byPath.get("WS.N.N.CaptionColor")?.valueMetadata?.acceptedValues).toContainEqual(
      expect.objectContaining({ value: 0, label: "Black" }),
    );
    expect(byPath.get("Grid.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "inferred",
      valueRange: {
        min: 1,
        max: 256,
        unit: "cue slots",
        evidenceLevel: "inferred",
      },
    });
    expect(byPath.get("Master.Red")?.valueMetadata?.notes).toContain("RGBA r parameter");
    expect(byPath.get("ZoneAlias.Mute")?.valueMetadata?.notes).not.toContain("Command-derived seed");
  });

  it("ships directly observed FX quick-effect ranges only on the probed placement", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const contextId = "quickfx:oscillating-effect:zoom:fx-0-0-0";
    const directFx = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.contextId === contextId)
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const legacyDirectFx = directFx.filter((entry) =>
      entry.metadata.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(legacyDirectFx).toHaveLength(4);
    for (const entry of legacyDirectFx) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.defaultValue).toBeUndefined();
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      });
    }

    expect(byPath.get("FX.N.N.N.Oscillator.Period")?.valueMetadata?.valueRange).toBeUndefined();
    expect(
      byPath.get("FX.N.N.N.Oscillator.Period")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.1,
        max: 16,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath.get("FX.N.N.N.Oscillator.Waveform")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 6,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath.get("FX.N.N.N.Enabled")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath.get("FX.N.N.N.TimeEnabled")?.contextValueMetadata?.find((entry) => entry.contextId === contextId),
    ).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.N.Oscillator.CENTERX")?.contextValueMetadata).toBeUndefined();
  });

  it("ships issue 295 FX common and oscillator ranges only for populated QuickFX contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue295 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #295 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const expectedCounts = new Map([
      ["FX.N.N.N.Enabled", 144],
      ["FX.N.N.N.Oscillator.Absinvert", 27],
      ["FX.N.N.N.Oscillator.Absrevwave", 27],
      ["FX.N.N.N.Oscillator.Damping", 27],
      ["FX.N.N.N.Oscillator.Finish", 7],
      ["FX.N.N.N.Oscillator.Period", 26],
      ["FX.N.N.N.Oscillator.Phase", 27],
      ["FX.N.N.N.Oscillator.Secondwave", 27],
      ["FX.N.N.N.Oscillator.Start", 7],
      ["FX.N.N.N.Oscillator.Waveform", 26],
      ["FX.N.N.N.Oscillator.Waveperiod", 27],
      ["FX.N.N.N.Oscillator.Wavespeed", 27],
      ["FX.N.N.N.Oscillator.Width", 27],
      ["FX.N.N.N.TimeActive", 145],
      ["FX.N.N.N.TimeDurationInBeat", 145],
      ["FX.N.N.N.TimeEnabled", 144],
    ]);
    const actualCounts = new Map<string, number>();
    for (const entry of issue295) actualCounts.set(entry.path, (actualCounts.get(entry.path) ?? 0) + 1);

    expect(issue295).toHaveLength(860);
    expect(actualCounts).toEqual(expectedCounts);
    expect(new Set(issue295.map((entry) => entry.metadata.contextId)).size).toBe(145);

    for (const entry of issue295) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.defaultValue).toBeUndefined();
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      });
    }

    const zoomContext = "quickfx:oscillating-effect:zoom:fx-0-0-0";
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Phase")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Waveperiod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.1,
        max: 10,
        boundaryBehavior: "clamp",
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.TimeDurationInBeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === zoomContext),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Start")
        ?.contextValueMetadata?.find(
          (metadata) => metadata.contextId === "quickfx:oscillating-effect:beam-brush:fx-0-0-19",
        ),
    ).toMatchObject({
      valueRange: {
        min: 0,
        max: 100,
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.Oscillator.Start")
        ?.contextValueMetadata?.find(
          (metadata) => metadata.contextId === "quickfx:oscillating-effect:blue-channel:fx-0-0-18",
        ),
    ).toMatchObject({
      valueRange: {
        min: -100,
        max: 100,
      },
    });
    expect(
      byPath
        .get("FX.N.N.N.RouterMode")
        ?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #295 confirmed "),
        ) ?? false,
    ).toBe(false);
  });

  it("ships issue 338 FX cell effect controls only after all generated cells agree", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue338 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime command-write/readback on 2026-05-14 issue #338 confirmed "),
    );

    expect(issue338).toHaveLength(7);
    expect(new Set(issue338.map((entry) => entry.path))).toEqual(issue338FxCellEffectControlPaths);

    for (const entry of issue338) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N uses QuickFX panel index then cell index.",
      });
    }

    expect(byPath.get("FX.N.N.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("FX.N.N.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("FX.N.N.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("FX.N.N.ChaseTimeMode")?.valueMetadata?.notes?.includes("2026-05-14 issue #338")).not.toBe(true);
  });

  it("ships issue 375 FX RouterMode only after all generated effect paths agree", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-375-fx-routing-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const routerMode = byPath.get("FX.N.N.N.RouterMode")?.valueMetadata as ObjectPropertyValueMetadata | undefined;

    expect(evidence.entries).toHaveLength(151);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(145);
    expect(new Set(evidence.entries.filter((entry) => entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      new Set(["FX.N.N.N.RouterMode"]),
    );
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    assertObjectPropertyValueMetadata(routerMode as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(routerMode as ObjectPropertyValueMetadata)).toBe(true);
    expect(routerMode).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
        indexBasis: "FX.N.N.N uses QuickFX panel, cell, and effect indices.",
      },
    });

    for (const path of [
      "FX.N.N.ChaseTimeMode",
      "FX.N.N.Zone",
      "FX.N.N.ZoneMode",
      "FX.N.N.N.RouterInZone",
      "FX.N.N.N.RouterOutZone",
      "FX.N.N.N.TimeStateCanRestart",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("2026-05-14 issue #375") ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("does not ship QShift A/B readback-only range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");

    const qShiftMetadata = objectPropertyIndex.entries.filter(
      (entry) => entry.root === "QShift" && /^QShift\.N\.[AB]\./.test(entry.path) && entry.valueMetadata !== undefined,
    );

    expect(qShiftMetadata).toEqual([]);
  });

  it("ships only manual-ready hardware metadata without placeholder propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issueHardware = objectPropertyIndex.entries.filter(
      (entry) =>
        (entry.root === "Projector" || entry.root === "Status") && entry.valueMetadata?.notes?.includes("2026-05-12"),
    );

    expect(issueHardware.map((entry) => entry.path)).toEqual(["Projector.N.InvertX"]);
    assertObjectPropertyValueMetadata(issueHardware[0]?.valueMetadata as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(issueHardware[0]?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);

    expect(byPath.get("Projector.N.InvertX")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        boundaryBehavior: "unknown",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
        indexBasis: "Projector.N uses the zero-based Object Tree projector index.",
      },
    });
    for (const path of [
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
      "Projector.N.Serial",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(byPath.get("Projector.N.SizeX")?.valueMetadata?.notes).not.toContain("2026-05-12");
  });

  it("ships issue 298 Beam and Projector rows without hardware placeholder propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue298 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #298 confirmed "),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue298) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
    }

    expect(issue298).toHaveLength(22);
    expect(countsByRoot).toEqual(
      new Map([
        ["Beam", 10],
        ["Projector", 12],
      ]),
    );
    expect(byPath.get("Beam.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "BGR packed color",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Beam.N.ColorPalette")?.valueMetadata).toMatchObject({
      valueType: "enum",
      valueRange: {
        min: 0,
        max: 4,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "PALETTE_0" },
        { value: 1, label: "PALETTE_1" },
        { value: 2, label: "PALETTE_2" },
        { value: 3, label: "PALETTE_3" },
        { value: 4, label: "PALETTE_4" },
      ],
    });
    expect(byPath.get("Beam.N.PosX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -32767,
        max: 32767,
        unit: "beam coordinate",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Projector.N.IdleCenterOffsetX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    expect(byPath.get("Projector.N.InvertY")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of [
      "Projector.N.ColorShift",
      "Projector.N.MaxBlue",
      "Projector.N.MaxGreen",
      "Projector.N.MaxRed",
      "Projector.N.MinBlue",
      "Projector.N.MinGreen",
      "Projector.N.MinRed",
      "Projector.N.MinimumPoints",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -32768,
          max: 32767,
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }
    for (const path of [
      "Beam.N.Power",
      "Beam.N.IsGroup",
      "Projector.N.SizeX",
      "Projector.N.Optimisation.EnableAngleTable",
      "Status.LaserEnabled",
      "FB3-XXXXX.InvertY",
      "FB4-XXXXX.InvertY",
    ]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #298 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 298 FB hardware rows from connected hardware probes", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue298Fb = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime command-write/readback on 2026-05-14 issue #298 confirmed FB"),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue298Fb) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "hardware-instance",
        populationDependent: true,
      });
    }

    expect(issue298Fb).toHaveLength(28);
    expect(countsByRoot).toEqual(
      new Map([
        ["FB3-XXXXX", 14],
        ["FB4-XXXXX", 14],
      ]),
    );
    expect(byPath.get("FB3-XXXXX.ColorShift")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -32768,
        max: 32767,
        unit: "hardware color shift",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("FB4-XXXXX.IdleCenterOffsetX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("FB3-XXXXX.InvertX")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("FB4-XXXXX.SwapXY")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of ["FB3-XXXXX.Name", "FB4-XXXXX.Name"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "string",
        valueRange: {
          min: 0,
          max: 254,
          unit: "characters",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }
    for (const path of ["FB3-XXXXX.Connected", "FB4-XXXXX.Connected"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 0, label: "DISCONNECTED" },
          { value: 1, label: "CONNECTED" },
        ],
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      assertObjectPropertyValueMetadata(byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of [
      "FB3-XXXXX.Serial",
      "FB4-XXXXX.Serial",
      "FB3-XXXXX.Optimisation.EnableAngleTable",
      "FB4-XXXXX.Optimisation.EnableAngleTable",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("completes issue 298 FB Projector-equivalent rows from direct write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/fb-projector-equivalent-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/fb-projector-equivalent-readbacks.json");
    const fbEvidence = readJson<{
      runtime: {
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        baseline: {
          value: string | number | boolean | null;
          typeTag: string;
        };
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          command?: string;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-fb-projector-equivalent-controls.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const roots = ["FB3-XXXXX", "FB4-XXXXX"];
    const expectedValueEntries = new Map<
      string,
      { valueType: string; unit: string; min: number; max: number; boundaryBehavior: string }
    >();
    const expectedReadbackOnly = new Set<string>();
    for (const root of roots) {
      for (const [property, expected] of [
        [
          "DefaultSampleRate",
          {
            valueType: "integer",
            unit: "samples per second",
            min: -2147483648,
            max: 2147483647,
            boundaryBehavior: "wrap",
          },
        ],
        [
          "MaxSampleRate",
          {
            valueType: "integer",
            unit: "samples per second",
            min: -2147483648,
            max: 2147483647,
            boundaryBehavior: "wrap",
          },
        ],
        [
          "PositionX",
          {
            valueType: "number",
            unit: "projector coordinate",
            min: -1000000,
            max: 1000000,
            boundaryBehavior: "unknown",
          },
        ],
        [
          "PositionY",
          {
            valueType: "number",
            unit: "projector coordinate",
            min: -1000000,
            max: 1000000,
            boundaryBehavior: "unknown",
          },
        ],
        [
          "PostRotation",
          { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
        ],
        [
          "PreRotation",
          { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
        ],
        ["SizeX", { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" }],
        ["SizeY", { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" }],
      ] as const) {
        expectedValueEntries.set(`${root}.${property}`, expected);
      }
      for (const property of [
        "Optimisation.AngleRepeats",
        "Optimisation.AngleTable",
        "Optimisation.BlankDensity",
        "Optimisation.BlankEnd",
        "Optimisation.BlankOverlap",
        "Optimisation.BlankStart",
        "Optimisation.CornerRepeats",
        "Optimisation.DisableCornerFlag",
        "Optimisation.Enable3dDensity",
        "Optimisation.EnableAngleTable",
        "Optimisation.EnableBlankDensity",
        "Optimisation.EnableSinBlank",
        "Optimisation.EnableSinVisible",
        "Optimisation.EnableVisibleDensity",
        "Optimisation.ForceVectorMode",
        "Optimisation.IgnoreOriginal",
        "Optimisation.MinimumPoints",
        "Optimisation.NoDot",
        "Optimisation.VisibleDensity",
        "Optimisation.VisibleEnd",
        "Optimisation.VisibleOverlap",
        "Optimisation.VisibleStart",
        "Serial",
      ]) {
        expectedReadbackOnly.add(`${root}.${property}`);
      }
    }
    const evidenceByPath = new Map(fbEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(fbEvidence.runtime.notes).toContain("Object Tree surfaces match Projector.N property-for-property");
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedValueEntries.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expected = expectedValueEntries.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(metadata).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
        },
      });
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: metadata.path,
        shipsMetadata: true,
        boundaryBehavior: expected?.boundaryBehavior,
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
        },
      });
      expect(evidence?.testedValues).toContainEqual(
        expect.objectContaining({ input: 120000, readback: 120000, behavior: "pass-through" }),
      );
      if (expected?.boundaryBehavior === "wrap") {
        expect(metadata.valueRange?.notes, metadata.path).toContain("UI maximum");
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      } else {
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -1000000, readback: -1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: -2147483648, behavior: "unknown" }),
          ]),
        );
      }
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidence, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        evidence?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    for (const serialPath of ["FB3-XXXXX.Serial", "FB4-XXXXX.Serial"]) {
      expect(byPath.get(serialPath)?.readbackMetadata).toMatchObject({
        valueType: "string",
        typeTag: "s",
        notes: expect.stringContaining("redacted serial string"),
      });
      expect(byPath.get(serialPath)?.readbackMetadata?.observedValue).toBeUndefined();
      expect(evidenceByPath.get(serialPath)).toMatchObject({
        baseline: {
          value: "[redacted serial string]",
          typeTag: "s",
        },
      });
    }

    for (const root of roots) {
      const rootGaps = objectPropertyIndex.entries.filter(
        (entry) =>
          entry.root === root && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
      );
      expect(rootGaps).toHaveLength(0);
    }
  });

  it("completes issue 298 Status rows from direct write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/status-memory-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/status-readbacks.json");
    const evidence = readJson<{
      runtime: {
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-status-memory-and-readbacks.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const expectedIntegerRows = new Map([
      ["Status.MemAvailExtendedVirtual", "megabytes"],
      ["Status.MemAvailPageFile", "megabytes"],
      ["Status.MemAvailPhys", "megabytes"],
      ["Status.MemAvailVirtual", "megabytes"],
      ["Status.MemoryLoad", "percent"],
      ["Status.MemTotalPageFile", "megabytes"],
      ["Status.MemTotalPhys", "megabytes"],
      ["Status.MemTotalVirtual", "megabytes"],
      ["Status.MemVirtualUsed", "megabytes"],
    ]);
    const expectedValueRows = new Set([...expectedIntegerRows.keys(), "Status.MemoryInfo"]);
    const expectedReadbackRows = new Set([
      "Status.CpuUseLong",
      "Status.CpuUseShort",
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
    ]);

    expect(evidence.runtime.notes).toContain("SetProp followed by immediate Object Tree readback");
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(expectedValueRows);
    for (const metadata of rangeOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        probePath: metadata.path,
      });

      if (metadata.path === "Status.MemoryInfo") {
        expect(metadata).toMatchObject({
          valueType: "string",
          valueRange: {
            min: 0,
            max: 254,
            unit: "characters",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
          evidenceLevel: "observed",
        });
        expect(row?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              input: "string length 254",
              readback: "string length 254",
              behavior: "pass-through",
            }),
            expect.objectContaining({ input: "string length 255", readback: "string length 254", behavior: "clamp" }),
            expect.objectContaining({ input: "string length 512", readback: "string length 254", behavior: "clamp" }),
          ]),
        );
      } else {
        expect(metadata).toMatchObject({
          valueType: "integer",
          valueRange: {
            min: -2147483648,
            max: 2147483647,
            unit: expectedIntegerRows.get(metadata.path),
            boundaryBehavior: "wrap",
            evidenceLevel: "observed",
          },
          evidenceLevel: "observed",
        });
        expect(row?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: 100000, readback: 100000, behavior: "pass-through" }),
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      }

      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: metadata.valueType,
        valueRange: metadata.valueRange,
        evidenceLevel: metadata.evidenceLevel,
        notes: metadata.notes,
      });
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackRows);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    const statusGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Status" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(statusGaps).toHaveLength(0);
  });

  it("ships issue 298 Beam size rows with runtime clamp evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const beamSize = ["Beam.N.SizeX", "Beam.N.SizeY"].map((path) => byPath.get(path));

    expect(
      beamSize.map((entry) => ({
        path: entry?.path,
        metadata: entry?.valueMetadata,
      })),
    ).toEqual([
      {
        path: "Beam.N.SizeX",
        metadata: expect.objectContaining({
          valueType: "number",
          evidenceLevel: "observed",
          valueRange: expect.objectContaining({
            min: -200,
            max: 200,
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          }),
          notes: expect.stringContaining("2026-05-14 issue #298 confirmed Beam.N.SizeX at Beam.0.SizeX"),
          locationContext: expect.objectContaining({
            kind: "indexed-root",
            populationDependent: true,
          }),
        }),
      },
      {
        path: "Beam.N.SizeY",
        metadata: expect.objectContaining({
          valueType: "number",
          evidenceLevel: "observed",
          valueRange: expect.objectContaining({
            min: -200,
            max: 200,
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          }),
          notes: expect.stringContaining("2026-05-14 issue #298 confirmed Beam.N.SizeY at Beam.0.SizeY"),
          locationContext: expect.objectContaining({
            kind: "indexed-root",
            populationDependent: true,
          }),
        }),
      },
    ]);

    for (const entry of beamSize) {
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }
  });

  it("completes issue 298 Beam leftovers from write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/beam-leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/beam-leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-beam-leftovers.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));
    const expectedReadbackRows = new Set(["Beam.N.IsGroup", "Beam.N.Name"]);

    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(["Beam.N.Power", "Beam.N.RotoZ"]));
    expect(byPath.get("Beam.N.Power")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "percent",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(evidenceByPath.get("Beam.N.Power")).toMatchObject({
      shipsMetadata: true,
      boundaryBehavior: "wrap",
      valueType: "integer",
    });
    expect(evidenceByPath.get("Beam.N.Power")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    expect(byPath.get("Beam.N.RotoZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1000000,
        max: 1000000,
        unit: "degrees",
        boundaryBehavior: "unknown",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(evidenceByPath.get("Beam.N.RotoZ")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -1.5, readback: -1.5, behavior: "pass-through" }),
        expect.objectContaining({ input: 1.5, readback: 1.5, behavior: "pass-through" }),
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
        expect.objectContaining({ input: 2147483647, readback: 2147483648, behavior: "unknown" }),
      ]),
    );

    for (const path of ["Beam.N.Power", "Beam.N.RotoZ"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(byPath.get(path)?.readbackMetadata, path).toBeUndefined();
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackRows);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    const beamGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Beam" && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );
    expect(beamGaps).toHaveLength(0);
  });

  it("ships issue 298 command-driven Status domains", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const statusMetadata = ["Status.LaserEnabled", "Status.Locked"].map((path) => byPath.get(path));

    for (const entry of statusMetadata) {
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry?.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "unknown",
        },
      });
    }

    expect(String(byPath.get("Status.LaserEnabled")?.valueMetadata?.notes)).toContain("DisableLaserOutput");
    expect(String(byPath.get("Status.Locked")?.valueMetadata?.notes)).toContain("did not re-run LockScreen");
    for (const path of [
      "Status.CpuUseLong",
      "Status.CpuUseShort",
      "Status.Projector.Count",
      "Status.Projector.N.Connected",
      "Status.Projector.N.FPS",
      "Status.Projector.N.Model",
      "Status.Projector.N.Points",
      "Status.Projector.N.Serial",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 298 Projector connected readback domain", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const metadata = byPath.get("Projector.N.Connected")?.valueMetadata as ObjectPropertyValueMetadata | undefined;

    expect(metadata).toBeDefined();
    assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    expect(metadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "DISCONNECTED" },
        { value: 1, label: "CONNECTED" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      evidenceLevel: "observed",
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    expect(metadata?.notes).toContain("2026-05-14 issue #298");

    for (const path of ["Projector.N.Serial"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    for (const path of ["Projector.N.DefaultSampleRate", "Projector.N.MaxSampleRate"]) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).not.toContain("Projector connected readback domain");
    }
  });

  it("completes issue 298 Projector remaining rows from write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/hardware/projector-pass-through-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/hardware/projector-optimisation-and-serial-readbacks.json");
    const projectorEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min: number;
          max: number;
          unit: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-projector-pass-through-and-optimisation.json");
    const serialEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        baseline: {
          value: string;
          typeTag: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-298-projector-serial-write-readback.json");

    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedPassThrough = new Map([
      [
        "Projector.N.DefaultSampleRate",
        {
          valueType: "integer",
          unit: "samples per second",
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "wrap",
        },
      ],
      [
        "Projector.N.MaxSampleRate",
        {
          valueType: "integer",
          unit: "samples per second",
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "wrap",
        },
      ],
      [
        "Projector.N.PositionX",
        { valueType: "number", unit: "projector coordinate", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
      [
        "Projector.N.PositionY",
        { valueType: "number", unit: "projector coordinate", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
      [
        "Projector.N.PostRotation",
        { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
      [
        "Projector.N.PreRotation",
        { valueType: "number", unit: "degrees", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
      [
        "Projector.N.SizeX",
        { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
      [
        "Projector.N.SizeY",
        { valueType: "number", unit: "percent", min: -1000000, max: 1000000, boundaryBehavior: "unknown" },
      ],
    ]);
    const expectedReadbackOnly = new Set([
      "Projector.N.Optimisation.AngleRepeats",
      "Projector.N.Optimisation.AngleTable",
      "Projector.N.Optimisation.BlankDensity",
      "Projector.N.Optimisation.BlankEnd",
      "Projector.N.Optimisation.BlankOverlap",
      "Projector.N.Optimisation.BlankStart",
      "Projector.N.Optimisation.CornerRepeats",
      "Projector.N.Optimisation.DisableCornerFlag",
      "Projector.N.Optimisation.Enable3dDensity",
      "Projector.N.Optimisation.EnableAngleTable",
      "Projector.N.Optimisation.EnableBlankDensity",
      "Projector.N.Optimisation.EnableSinBlank",
      "Projector.N.Optimisation.EnableSinVisible",
      "Projector.N.Optimisation.EnableVisibleDensity",
      "Projector.N.Optimisation.ForceVectorMode",
      "Projector.N.Optimisation.IgnoreOriginal",
      "Projector.N.Optimisation.MinimumPoints",
      "Projector.N.Optimisation.NoDot",
      "Projector.N.Optimisation.VisibleDensity",
      "Projector.N.Optimisation.VisibleEnd",
      "Projector.N.Optimisation.VisibleOverlap",
      "Projector.N.Optimisation.VisibleStart",
      "Projector.N.Serial",
    ]);
    const evidenceByPath = new Map(
      [...projectorEvidence.entries, ...serialEvidence.entries].map((entry) => [entry.objectPath, entry]),
    );

    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(new Set(expectedPassThrough.keys()));
    for (const metadata of rangeOverlay.entries) {
      const expected = expectedPassThrough.get(metadata.path);
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(metadata).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
          boundaryBehavior: expected?.boundaryBehavior,
        },
      });
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(evidence, metadata.path).toMatchObject({
        probePath: expect.stringContaining("Projector.0."),
        shipsMetadata: true,
        boundaryBehavior: expected?.boundaryBehavior,
        valueType: expected?.valueType,
        valueRange: {
          min: expected?.min,
          max: expected?.max,
          unit: expected?.unit,
        },
      });
      expect(evidence?.testedValues).toContainEqual(
        expect.objectContaining({ input: 120000, readback: 120000, behavior: "pass-through" }),
      );
      if (expected?.boundaryBehavior === "wrap") {
        expect(metadata.valueRange?.notes, metadata.path).toContain("not hardware-specific UI limits");
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
            expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
          ]),
        );
      } else {
        expect(evidence?.testedValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ input: -1000000, readback: -1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
            expect.objectContaining({ input: 2147483647, readback: -2147483648, behavior: "unknown" }),
          ]),
        );
      }
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackOnly);
    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidence = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidence, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        evidence?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Projector.N.Optimisation.EnableAngleTable")?.readbackMetadata).toMatchObject({
      probePath: "Projector.0.Optimisation.EnableAngleTable",
      valueType: "number",
      observedValue: 0,
      typeTag: "f",
    });
    expect(byPath.get("Projector.N.Serial")?.readbackMetadata).toMatchObject({
      probePath: "Projector.0.Serial",
      valueType: "string",
      typeTag: "s",
      notes: expect.stringContaining("redacted serial string"),
    });
    expect(byPath.get("Projector.N.Serial")?.readbackMetadata?.observedValue).toBeUndefined();
    expect(serialEvidence.entries[0]).toMatchObject({
      objectPath: "Projector.N.Serial",
      probePath: "Projector.0.Serial",
      shipsMetadata: false,
      boundaryBehavior: "no-op",
      valueType: "string",
      baseline: {
        value: "[redacted serial string]",
        typeTag: "s",
      },
    });

    const projectorGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Projector" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(projectorGaps).toHaveLength(0);
  });

  it("ships only manual-ready DMX, channel, and color-channel metadata without index propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        variantCount?: number;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const roots = new Set(["DmxMasters", "Channels", "ColorChannel"]);
    const directDmx = objectPropertyIndex.entries.filter(
      (entry) => roots.has(entry.root) && entry.valueMetadata?.notes?.includes("2026-05-12"),
    );

    expect(directDmx.map((entry) => entry.path).sort()).toEqual(
      [
        "Channels.N.Attraction",
        "Channels.N.Color",
        "Channels.N.Friction",
        "Channels.N.Mass",
        "Channels.N.Name",
        "Channels.N.PhActive",
        "Channels.N.Reflection",
        "Channels.N.Value",
        "ColorChannel.N.B",
        "ColorChannel.N.Color",
        "ColorChannel.N.G",
        "ColorChannel.N.Mode",
        "ColorChannel.N.Name",
        "ColorChannel.N.R",
        "ColorChannel.N.VideoX",
        "ColorChannel.N.VideoY",
        "DmxMasters.N.Value",
      ].sort(),
    );
    for (const entry of directDmx) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
    }

    const dmxOutput = byPath.get("DmxOutput.N")?.valueMetadata;
    assertObjectPropertyValueMetadata(dmxOutput as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(dmxOutput as ObjectPropertyValueMetadata)).toBe(true);
    expect(dmxOutput).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("DmxMasters.N.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Attraction")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 50,
        unit: "physics scalar",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Friction")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 30,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Mass")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 1,
        max: 30,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.PhActive")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Reflection")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Channels.N.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed color integer",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Channels.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    for (const path of ["ColorChannel.N.R", "ColorChannel.N.G", "ColorChannel.N.B"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 0,
          max: 255,
          unit: "8-bit color component",
          boundaryBehavior: "clamp",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
    }
    expect(byPath.get("ColorChannel.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed BGR color integer",
        boundaryBehavior: "wrap",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ColorChannel.N.Mode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 0,
        unit: "mode",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ColorChannel.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    for (const path of ["ColorChannel.N.VideoX", "ColorChannel.N.VideoY"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "video coordinate",
          boundaryBehavior: "wrap",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
    }
    for (const path of ["DmxIO.MuteOutput", "DmxIO.DoBeep", "DmxIO.MuteInput"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("does not ship misc-root readback-only range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const roots = new Set([
      "Gamepad",
      "MobSensor",
      "Skeleton1",
      "Skeleton2",
      "TouchPoints",
      "Grid",
      "Grid2",
      "Config",
      "UserInterface",
      "VideoOutput1",
      "MIDI1",
      "MIDI2",
      "MIDI3",
      "MIDI4",
      "CoreManager",
      "PlayListState",
      "OneCue",
      "MultiCue",
      "Location",
      "Beam",
      "Status",
    ]);
    const directMisc = objectPropertyIndex.entries.filter(
      (entry) => roots.has(entry.root) && entry.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12"),
    );

    expect(directMisc).toEqual([]);
  });

  it("ships observed safe small global root range metadata from issue 289", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const path of [
      "Config.CaptureAsLocal",
      "Config.FocusMidiClicks",
      "Config.HideOutputPreviewInMutedProjectionZones",
      "Config.ShowAudioTab",
      "VideoOutput1.Visible",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "boolean",
        evidenceLevel: "observed",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of ["Location.N.X", "Location.N.Y", "Location.N.Z"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 1,
          unit: "normalized",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    const locationName = byPath.get("Location.N.Name")?.valueMetadata;
    assertObjectPropertyValueMetadata(locationName as ObjectPropertyValueMetadata);
    expect(locationName).toMatchObject({
      valueType: "string",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(locationName as ObjectPropertyValueMetadata)).toBe(true);

    const touchActive = byPath.get("TouchPoints.N.Active")?.valueMetadata;
    assertObjectPropertyValueMetadata(touchActive as ObjectPropertyValueMetadata);
    expect(touchActive).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(touchActive as ObjectPropertyValueMetadata)).toBe(true);

    expect(byPath.has("Config.ScanRateSliderMax")).toBe(true);
    expect(byPath.has("Config.Scan RateSliderMax")).toBe(false);

    for (const path of [
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.FxRowCount",
      "Config.ScanRateSliderMax",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "Location.N.LastTick",
    ]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #289") ??
          false,
        path,
      ).toBe(false);
      expect(byPath.get(path)?.readbackMetadata?.notes?.includes("issue #289") ?? false, path).toBe(false);
    }
  });

  it("ships readback count domains from issue 399", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Grid2.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: {
          expression: "Grid2.GetColCount * Grid2.GetRowCount",
          sourcePaths: ["Grid2.GetColCount", "Grid2.GetRowCount"],
        },
        unit: "cue slots",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });

    for (const [path, fixedCount, unit] of [
      ["ColorChannel.Count", 256, "color channels"],
      ["Location.Count", 1024, "locations"],
      ["TouchPoints.Count", 10, "touch points"],
    ] as const) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata, path).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: fixedCount,
          max: fixedCount,
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);
    }

    for (const path of [
      "TouchPoints.ActiveCount",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
    ]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime readback-only evidence on 2026-05-15 issue #399") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 216 TouchPoints leftover write/readback coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const valueOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/touchpoints/leftover-controls.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min?: number;
          max?: number;
          unit?: string;
          minInclusive?: boolean;
          maxInclusive?: boolean;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-touchpoints-leftovers.json");

    const expectedValuePaths = new Set([
      "TouchPoints.ActiveCount",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(evidence.entries).toHaveLength(7);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedValuePaths);

    for (const metadata of valueOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      const expectedMax = metadata.path === "TouchPoints.ActiveCount" ? 2147483647 : 1000000;
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: expectedMax,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        boundaryBehavior: "pass-through",
      });
      expect(entry?.valueMetadata?.valueType, metadata.path).toBe(row?.valueType);
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.some(
          (testedValue) => testedValue.behavior === "pass-through" && Number(testedValue.input) > 100000,
        ),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata?.valueRange?.min, metadata.path).toBe(row?.valueRange?.min);
      expect(entry?.valueMetadata?.valueRange?.max, metadata.path).toBe(row?.valueRange?.max);
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata), metadata.path).toBe(
        true,
      );
    }

    expect(byPath.get("TouchPoints.ActiveCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        max: 2147483647,
        unit: "active touch point count",
      },
    });
    expect(byPath.get("TouchPoints.N.WindowX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        unit: "touch point window coordinate",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "TouchPoints.N uses the zero-based Object Tree touch point index.",
      },
    });
    expect(byPath.get("TouchPoints.N.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        unit: "touch point coordinate",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("TouchPoints.WindowWidth")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        unit: "touch point window size",
      },
    });
    expect(evidenceByPath.get("TouchPoints.N.X")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "TouchPoints.0",
    });

    const gaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "TouchPoints" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(gaps).toHaveLength(0);
  });

  it("ships issue 216 final Object Tree gap write/readback coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const valueOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/final-gaps/leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/final-gaps/leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min?: number;
          max?: number;
          unit?: string;
          minInclusive?: boolean;
          maxInclusive?: boolean;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-final-gaps.json");

    const expectedValuePaths = new Set([
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.ScanRateSliderMax",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "Location.N.LastTick",
    ]);
    const expectedReadbackPaths = new Set([
      "Config.FxRowCount",
      "DmxIO.DoBeep",
      "DmxIO.MuteInput",
      "DmxIO.MuteOutput",
      "MasterLC.FX7",
      "MasterLC.FX8",
      "MasterLC.SatShift",
      "MasterLC.VisiblePointsEnd",
      "MasterLC.VisiblePointsStart",
      "PlayListState.Duration",
    ]);
    const expectedPaths = new Set([...expectedValuePaths, ...expectedReadbackPaths]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackPaths);
    expect(evidence.entries).toHaveLength(16);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of valueOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        boundaryBehavior: "pass-through",
      });
      expect(entry?.valueMetadata?.valueType, metadata.path).toBe(row?.valueType);
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.some(
          (testedValue) => testedValue.behavior === "pass-through" && Number(testedValue.input) > 100000,
        ),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata?.valueRange?.min, metadata.path).toBe(row?.valueRange?.min);
      expect(entry?.valueMetadata?.valueRange?.max, metadata.path).toBe(row?.valueRange?.max);
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata), metadata.path).toBe(
        true,
      );
    }

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Location.N.Color")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Location.N uses the zero-based Object Tree location index.",
      },
    });
    expect(evidenceByPath.get("Location.N.Color")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "Location.0",
    });

    const roots = new Set(["Config", "DmxIO", "Location", "MasterLC", "PlayListState"]);
    const gaps = objectPropertyIndex.entries.filter(
      (entry) =>
        roots.has(entry.root) && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );
    expect(gaps).toHaveLength(0);
  });

  it("ships observed MultiCue and OneCue cue limit ranges from issue 367", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const expectedPaths = [
      "MultiCue.BeamCueLimit",
      "MultiCue.DmxCueLimit",
      "MultiCue.FlashCueLimit",
      "MultiCue.HoldCueLimit",
      "MultiCue.PerGridLimit",
      "MultiCue.PerZoneLimit",
      "MultiCue.ScriptCueLimit",
      "MultiCue.ShowCueLimit",
      "OneCue.BeamCueLimit",
      "OneCue.DmxCueLimit",
      "OneCue.FlashCueLimit",
      "OneCue.HoldCueLimit",
      "OneCue.PerGridLimit",
      "OneCue.PerZoneLimit",
      "OneCue.ScriptCueLimit",
      "OneCue.ShowCueLimit",
    ];
    const issue367 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #367 confirmed "),
    );

    expect(issue367.map((entry) => entry.path).sort()).toEqual([...expectedPaths].sort());
    for (const path of expectedPaths) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "cue limit count",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
      expect(metadata.locationContext, path).toBeUndefined();
      expect(metadata.notes, path).toContain("baseline restore");
    }
  });

  it("ships observed CoreManager and VideoOutput range metadata from issue 326", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue326 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #326 confirmed "),
    );

    expect(issue326.map((entry) => entry.path).sort()).toEqual([
      "CoreManager.OnlineMode",
      "VideoOutput1.Height",
      "VideoOutput1.Left",
      "VideoOutput1.Top",
      "VideoOutput1.Width",
    ]);
    for (const entry of issue326) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("CoreManager.OnlineMode")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    for (const path of ["VideoOutput1.Left", "VideoOutput1.Top"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -32768,
          max: 32767,
          unit: "screen coordinate",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }
    for (const path of ["VideoOutput1.Width", "VideoOutput1.Height"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 48,
          max: 65535,
          unit: "pixels",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const path of [
      "Config.AnimationSliderMax",
      "Config.AnimationSliderMin",
      "Config.FxRowCount",
      "Config.SizeSliderMax",
      "Location.N.Color",
      "TouchPoints.N.WindowX",
      "TouchPoints.N.WindowY",
      "TouchPoints.N.X",
      "TouchPoints.N.Y",
      "TouchPoints.WindowHeight",
      "TouchPoints.WindowWidth",
      "Gamepad.AxisX",
      "Gamepad.Buttons",
      "MultiCue.BeamCueLimit",
      "OneCue.BeamCueLimit",
    ]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #326 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships observed UserInterface front-view domain metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const frontView = byPath.get("UserInterface.FrontView")?.valueMetadata;
    assertObjectPropertyValueMetadata(frontView as ObjectPropertyValueMetadata);
    expect(frontView).toMatchObject({
      valueType: "enum",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 3,
        unit: "main view mode",
        boundaryBehavior: "no-op",
      },
      acceptedValues: [
        {
          value: 0,
          label: "GRID",
        },
        {
          value: 1,
          label: "TIMELINE",
        },
        {
          value: 2,
          label: "PLAYLIST",
        },
        {
          value: 3,
          label: "UNIVERSE",
        },
      ],
    });
    expect(hasManualReadyValueMetadata(frontView as ObjectPropertyValueMetadata)).toBe(true);
  });

  it("ships observed PlayListState playing domain without DmxIO no-op metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const playing = byPath.get("PlayListState.Playing")?.valueMetadata;
    assertObjectPropertyValueMetadata(playing as ObjectPropertyValueMetadata);
    expect(playing).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      acceptedValues: [
        {
          value: 0,
          label: "STOPPED",
        },
        {
          value: 1,
          label: "PLAYING",
        },
      ],
    });
    expect(hasManualReadyValueMetadata(playing as ObjectPropertyValueMetadata)).toBe(true);

    const position = byPath.get("PlayListState.Position")?.valueMetadata;
    assertObjectPropertyValueMetadata(position as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(position as ObjectPropertyValueMetadata)).toBe(false);

    for (const path of ["DmxIO.DoBeep", "DmxIO.MuteInput", "DmxIO.MuteOutput", "PlayListState.Duration"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed grid click-mode enum metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const path of ["Grid.ClickMode", "Grid2.ClickMode"]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: 1,
          max: 6,
          unit: "click mode",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 1, label: "Select" },
          { value: 2, label: "Flash" },
          { value: 3, label: "SoloFlash" },
          { value: 4, label: "Toggle" },
          { value: 5, label: "Restart" },
          { value: 6, label: "Track" },
        ],
      });
      expect(metadata?.defaultValue).toBeUndefined();
      expect(metadata?.notes).toContain("Runtime command write/readback on 2026-05-12");
    }
  });

  it("ships directly observed Grid2 size metadata and dynamic workspace index ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Grid2.GetColCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 16,
        unit: "columns",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid2.GetRowCount")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 16,
        unit: "rows",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    expect(byPath.get("Grid2.Count")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "Grid2.GetColCount * Grid2.GetRowCount" },
        unit: "cue slots",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    expect(byPath.get("Grid.PageIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "loaded workspace page count" },
        unit: "page index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });
    expect(
      hasManualReadyValueMetadata(byPath.get("Grid.PageIndex")?.valueMetadata as ObjectPropertyValueMetadata),
    ).toBe(true);
    expect(byPath.get("Grid2.PageIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "loaded workspace page count" },
        unit: "page index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid.CellIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "Grid.Count", sourcePaths: ["Grid.Count"] },
        unit: "cell index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(byPath.get("Grid2.CellIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        dynamicMax: { expression: "Grid2.GetColCount * Grid2.GetRowCount" },
        unit: "cell index",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const path of [
      "ProTrack.N.PageIndex",
      "ProTrack1.PageIndex",
      "ProTrack2.PageIndex",
      "ProTrack3.PageIndex",
      "ProTrack4.PageIndex",
      "ProTrack5.PageIndex",
      "ProTrack6.PageIndex",
      "ProTrack7.PageIndex",
      "ProTrack8.PageIndex",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata)).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          dynamicMax: { expression: "loaded workspace page count - 1" },
          unit: "page index",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          {
            value: -1,
            label: "DISABLED",
          },
        ],
      });
    }
  });

  it("ships directly observed MIDI1 layer metadata without sibling-device propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    const metadata = byPath.get("MIDI1.Layer")?.valueMetadata;
    assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
    expect(metadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 1,
        max: 12,
        unit: "MIDI layer",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      locationContext: {
        kind: "hardware-instance",
        populationDependent: true,
      },
    });
    expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata)).toBe(true);

    for (const path of ["MIDI2.Layer", "MIDI3.Layer", "MIDI4.Layer"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("issue #281"), path).toBe(false);
    }
  });

  it("ships observed input-device and sensor rows from issue 299", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue299 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #299 confirmed "),
    );
    const countsByRoot = new Map<string, number>();
    for (const entry of issue299) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "hardware-instance",
        populationDependent: true,
      });
    }

    expect(issue299).toHaveLength(117);
    expect(countsByRoot).toEqual(
      new Map([
        ["Gamepad", 32],
        ["MIDI2", 13],
        ["MIDI3", 13],
        ["MIDI4", 13],
        ["MobSensor", 4],
        ["Skeleton1", 21],
        ["Skeleton2", 21],
      ]),
    );

    expect(byPath.get("Gamepad.Button31")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "gamepad button state",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of ["MIDI2.ButtonMSL", "MIDI3.Layer", "MIDI4.ZoneSelMSL"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: 1,
          max: 12,
          unit: "layer index",
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("MobSensor.ButtonA")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "mobile sensor button state",
        boundaryBehavior: "unknown",
      },
    });
    for (const path of ["Skeleton1.HeadActive", "Skeleton2.SpineActive"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "skeleton tracking state",
          boundaryBehavior: "clamp",
        },
      });
    }

    for (const path of ["Gamepad.AxisX", "MobSensor.AccelX", "MobSensor.Buttons", "MobSensor.Timestamp"]) {
      expect(
        byPath
          .get(path)
          ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #299 confirmed ") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships observed Skeleton coordinate ranges from issue 299 follow-up", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const skeletonCoordinates = objectPropertyIndex.entries.filter(
      (entry) =>
        (entry.root === "Skeleton1" || entry.root === "Skeleton2") &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-16 issue #299 confirmed "),
    );
    const countsByRoot = new Map<string, number>();

    for (const entry of skeletonCoordinates) {
      countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata), entry.path).toBe(true);
      expect(entry.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -999,
          max: 10000000,
          unit: "skeleton coordinate value",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
    }

    expect(skeletonCoordinates).toHaveLength(120);
    expect(countsByRoot).toEqual(
      new Map([
        ["Skeleton1", 60],
        ["Skeleton2", 60],
      ]),
    );

    for (const path of ["Skeleton1.HeadX", "Skeleton1.SpineZ", "Skeleton2.HeadX", "Skeleton2.SpineZ"]) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata | undefined;
      expect(metadata?.valueRange?.notes, path).toContain("Samples below -999 read back 0 instead of clamping");
    }
  });

  it("ships observed Gamepad aggregate ranges from issue 299 follow-up", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    for (const [path, unit] of [
      ["Gamepad.Buttons", "signed button bitmask"],
      ["Gamepad.POV", "signed POV value"],
    ] as const) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata | undefined;
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(metadata?.notes).toContain("2026-05-14 issue #299");
    }

    for (const path of [
      "Gamepad.AxisR",
      "Gamepad.AxisU",
      "Gamepad.AxisV",
      "Gamepad.AxisX",
      "Gamepad.AxisY",
      "Gamepad.AxisZ",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("completes Gamepad axis coverage from issue 299 write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/input/gamepad-axis-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-299-gamepad-axis-readbacks.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(readbackOverlay.entries).toHaveLength(6);
    expect(evidence.entries).toHaveLength(6);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(
      new Set(evidence.entries.map((entry) => entry.objectPath)),
    );

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const evidenceRow = evidenceByPath.get(metadata.path);

      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        valueType: "number",
        probeMode: "readback-only",
        observedValue: 0,
        typeTag: "f",
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
      expect(evidenceRow, metadata.path).toMatchObject({
        shipsMetadata: false,
        valueType: "number",
        boundaryBehavior: "no-op",
      });
      expect(evidenceRow?.testedValues.every((testedValue) => testedValue.behavior === "no-op")).toBe(true);
      expect(evidenceRow?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: -2147483648, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: -1.5, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: 1000000, readback: 0, behavior: "no-op" }),
          expect.objectContaining({ input: 2147483648, readback: 0, behavior: "no-op" }),
        ]),
      );
    }

    const gamepadRows = objectPropertyIndex.entries.filter((entry) => entry.root === "Gamepad");
    const gamepadGaps = gamepadRows.filter(
      (entry) => !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
    );

    expect(gamepadRows).toHaveLength(40);
    expect(gamepadRows.filter((entry) => entry.valueMetadata).length).toBe(34);
    expect(gamepadRows.filter((entry) => entry.readbackMetadata).length).toBe(6);
    expect(gamepadGaps).toHaveLength(0);
  });

  it("completes MobSensor coverage from issue 299 write/readback evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const rangeOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/input/mobsensor-leftover-controls.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
      }>;
    }>("object-range-evidence/issue-299-mobsensor-leftovers.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeOverlay.entries).toHaveLength(18);
    expect(evidence.entries).toHaveLength(18);
    expect(new Set(rangeOverlay.entries.map((entry) => entry.path))).toEqual(
      new Set(evidence.entries.map((entry) => entry.objectPath)),
    );

    for (const entry of rangeOverlay.entries) {
      const metadata = byPath.get(entry.path)?.valueMetadata;

      expect(metadata, entry.path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        evidenceLevel: "observed",
        locationContext: {
          kind: "hardware-instance",
          populationDependent: true,
        },
      });
      expect(evidenceByPath.get(entry.path), entry.path).toMatchObject({
        shipsMetadata: true,
        evidenceLevel: "observed",
      });
    }

    for (const path of ["MobSensor.AccelX", "MobSensor.GravityZ", "MobSensor.GyroY", "MobSensor.MagnetometerZ"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -2147483648,
          max: 2147483648,
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(evidenceByPath.get(path)?.testedValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
          expect.objectContaining({ input: 2147483648, readback: 2147483648, behavior: "pass-through" }),
        ]),
      );
    }

    expect(byPath.get("MobSensor.Buttons")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed mobile sensor button bitmask",
        boundaryBehavior: "wrap",
      },
    });
    expect(evidenceByPath.get("MobSensor.Buttons")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    expect(byPath.get("MobSensor.Timestamp")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        unit: "signed mobile sensor timestamp value",
        boundaryBehavior: "wrap",
      },
    });
    expect(evidenceByPath.get("MobSensor.Timestamp")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -1.5, readback: -2, behavior: "unknown" }),
        expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      ]),
    );

    const mobSensorGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "MobSensor" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(mobSensorGaps).toHaveLength(0);
  });

  it("ships directly observed MasterLC object-property ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directMasterLc = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.path.startsWith("MasterLC.") &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directMasterLc).toHaveLength(23);
    for (const entry of directMasterLc) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
    }

    expect(byPath.get("MasterLC.BeamBrush")?.valueMetadata).toMatchObject({
      valueType: "integer",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.PositionX")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.RotoSpeedZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1440,
        max: 1440,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX7")?.valueMetadata).toBeUndefined();
  });

  it("ships manual-ready Master state object-property metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Master.Pause")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      defaultValue: 0,
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Master.TransitionState")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      evidenceLevel: "observed",
      valueRange: {
        min: 0,
        max: 1,
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Master.ShowSpeed")?.valueMetadata).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -2147483648,
        max: 1000000,
        unit: "show speed",
        boundaryBehavior: "pass-through",
      },
    });
  });

  it("ships directly observed issue 291 Master and MasterLC range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue291 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #291"),
    );

    expect(issue291).toHaveLength(177);
    expect(issue291.filter((entry) => entry.root === "Master")).toHaveLength(101);
    expect(issue291.filter((entry) => entry.root === "MasterLC")).toHaveLength(76);
    for (const entry of issue291) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Master.FX1Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Master.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.FX1TimeScaleClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.EffectChannelAction8")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "action value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.Pan")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.DropDuration")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0.01,
        max: 30,
        unit: "seconds",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Master.DmxMaster")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("MasterLC.FX1TimeMulClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time multiplier",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1TimeScaleMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.FX1TimeShiftClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("MasterLC.HueShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "Master.FX7",
      "Master.FX8",
      "Master.MasterBrightness",
      "MasterLC.FX7",
      "MasterLC.FX8",
      "MasterLC.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed issue 322 Master remaining range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue322 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #322"),
    );

    expect(issue322).toHaveLength(13);
    expect(issue322.filter((entry) => entry.root === "Master")).toHaveLength(8);
    expect(issue322.filter((entry) => entry.root === "MasterLC")).toHaveLength(5);
    for (const entry of issue322) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Master.CueFinishTime")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0,
        max: 5,
        unit: "seconds",
      },
    });
    expect(byPath.get("Master.CueRule")?.valueMetadata).toMatchObject({
      valueType: "enum",
      valueRange: {
        min: 0,
        max: 2,
        unit: "cue rule",
      },
      acceptedValues: [
        { value: 0, label: "RULE_0" },
        { value: 1, label: "RULE_1" },
        { value: 2, label: "RULE_2" },
      ],
    });
    expect(byPath.get("Master.DisplayPopupTimeout")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0.1,
        max: 60,
        unit: "seconds",
      },
    });
    expect(byPath.get("Master.RotoAccX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
      },
    });
    expect(byPath.get("MasterLC.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("MasterLC.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
      },
    });
    expect(byPath.get("MasterLC.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
      },
    });

    for (const path of [
      "Master.CueUnPauseTime",
      "Master.MasterBrightness",
      "Master.VisiblePointsEnd",
      "MasterLC.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed issue 368 MasterLC saturation range metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue368 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #368"),
    );

    expect(issue368.map((entry) => entry.path)).toEqual(["MasterLC.Saturation"]);
    const saturation = byPath.get("MasterLC.Saturation")?.valueMetadata;
    assertObjectPropertyValueMetadata(saturation as ObjectPropertyValueMetadata);
    expect(hasManualReadyValueMetadata(saturation as ObjectPropertyValueMetadata)).toBe(true);
    expect(saturation).toMatchObject({
      valueType: "number",
      evidenceLevel: "observed",
      valueRange: {
        min: -100,
        max: 100,
        unit: "saturation",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const path of ["Master.SatShift", "MasterLC.SatShift", "MasterLC.VisiblePointsEnd"]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #368") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 393 Live Control position alias ranges from routed command readback", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-393-livecontrol-position-aliases.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #393 confirmed ";
    const issue393 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const countsByRoot = new Map<string, number>();
    for (const entry of issue393) countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);

    expect(issue393).toHaveLength(39);
    expect(countsByRoot).toEqual(
      new Map([
        ["Master", 3],
        ["MasterLC", 3],
        ["ProTrack", 3],
        ["ProTrack1", 3],
        ["ProTrack2", 3],
        ["ProTrack3", 3],
        ["ProTrack4", 3],
        ["ProTrack5", 3],
        ["ProTrack6", 3],
        ["ProTrack7", 3],
        ["ProTrack8", 3],
        ["WS", 3],
        ["Zone", 3],
      ]),
    );
    expect(evidence.entries).toHaveLength(90);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const path of [
      "Master.PosX",
      "MasterLC.PosY",
      "Zone.N.PosZ",
      "ProTrack.N.PosX",
      "ProTrack8.PosZ",
      "WS.N.N.PosY",
    ]) {
      const metadata = byPath.get(path)?.valueMetadata;
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "number",
        evidenceLevel: "observed",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("WS.N.N.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("Zone.N.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.PosX")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });

    for (const path of [
      "Master.SatShift",
      "Master.VisiblePointsEnd",
      "MasterLC.SatShift",
      "ProTrack.N.SatShift",
      "WS.N.N.SatShift",
      "ZoneAlias.PosX",
      "ActGridFocusedCue.PosX",
      "Grid1FocusedCue.PosX",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });

  it("ships issue 216 Master leftover write/readback coverage", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const valueOverlay = readJson<{
      entries: Array<ObjectPropertyValueMetadata & { path: string }>;
    }>("object-property-ranges/master/leftover-controls.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/master/leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        valueRange?: {
          min?: number;
          max?: number;
          unit?: string;
          minInclusive?: boolean;
          maxInclusive?: boolean;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-master-leftovers.json");

    const expectedValuePaths = new Set(["Master.LCScrollSpeed", "Master.ShowSpeed", "Master.TimecodeShift"]);
    const expectedReadbackPaths = new Set([
      "Master.CueUnPauseTime",
      "Master.FX7",
      "Master.FX8",
      "Master.MasterBrightness",
      "Master.SatShift",
      "Master.VisiblePointsEnd",
      "Master.VisiblePointsStart",
    ]);
    const expectedPaths = new Set([...expectedValuePaths, ...expectedReadbackPaths]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(valueOverlay.entries.map((entry) => entry.path))).toEqual(expectedValuePaths);
    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedReadbackPaths);
    expect(evidence.entries).toHaveLength(10);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of valueOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.readbackMetadata, metadata.path).toBeUndefined();
      expect(entry?.valueMetadata, metadata.path).toMatchObject({
        evidenceLevel: "observed",
        valueRange: {
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: true,
        boundaryBehavior: "pass-through",
      });
      expect(entry?.valueMetadata?.valueType, metadata.path).toBe(row?.valueType);
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.some((testedValue) => testedValue.behavior === "pass-through"),
        metadata.path,
      ).toBe(true);
      expect(entry?.valueMetadata?.valueRange?.min, metadata.path).toBe(row?.valueRange?.min);
      expect(entry?.valueMetadata?.valueRange?.max, metadata.path).toBe(row?.valueRange?.max);
      assertObjectPropertyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry?.valueMetadata as ObjectPropertyValueMetadata), metadata.path).toBe(
        true,
      );
    }

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(testedInputs, metadata.path).toEqual(
        expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
      );
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Master.CueUnPauseTime")?.readbackMetadata).toMatchObject({
      valueType: "float",
      observedValue: 0,
    });
    expect(byPath.get("Master.FX7")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(byPath.get("Master.MasterBrightness")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(byPath.get("Master.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });

    const masterGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Master" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(masterGaps).toHaveLength(0);
  });

  it("ships manual-ready cue and player object-property ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issueRoots = new Set([
      "ActGridFocusedCue",
      "Grid1FocusedCue",
      "Grid2FocusedCue",
      "WS",
      "ProTrack",
      "ProTrack1",
    ]);
    const directCuePlayer = objectPropertyIndex.entries.filter(
      (entry) =>
        issueRoots.has(entry.root) &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directCuePlayer.map((entry) => entry.path).sort()).toEqual(
      [
        "ActGridFocusedCue.Brightness",
        "ActGridFocusedCue.SizeX",
        "ActGridFocusedCue.Zoom",
        "Grid1FocusedCue.Brightness",
        "Grid1FocusedCue.SizeX",
        "Grid1FocusedCue.Zoom",
        "Grid2FocusedCue.Brightness",
        "Grid2FocusedCue.SizeX",
        "Grid2FocusedCue.Zoom",
        "ProTrack.N.Brightness",
        "ProTrack.N.Mute",
        "ProTrack.N.Selected",
        "ProTrack.N.SizeX",
        "ProTrack.N.Solo",
        "ProTrack.N.Zoom",
        "ProTrack1.Brightness",
        "ProTrack1.Mute",
        "ProTrack1.Selected",
        "ProTrack1.SizeX",
        "ProTrack1.Solo",
        "ProTrack1.Zoom",
        "WS.N.N.Brightness",
        "WS.N.N.SizeX",
        "WS.N.N.Zoom",
      ].sort(),
    );
    for (const entry of directCuePlayer) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
    }

    expect(byPath.get("WS.N.N.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      },
    });
    expect(byPath.get("WS.N.N.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Zoom")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    const readbackOnly = objectPropertyIndex.entries.filter(
      (entry) =>
        issueRoots.has(entry.root) && entry.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12"),
    );
    expect(readbackOnly).toEqual([]);
    for (const path of ["WS.N.N.Caption", "WS.N.N.Effect.Name", "WS.N.N.FX1", "WS.N.N.Image.Text"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.includes("readback-only probe on 2026-05-12") ?? false).toBe(
        false,
      );
    }
  });

  it("ships issue 294 WS cue-type common control ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            !entry.path.startsWith("WS.N.N.Image.") &&
            !issue294WsCueEffectControlPaths.has(entry.path) &&
            !issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294).toHaveLength(1746);
    expect(new Set(issue294.map((entry) => entry.path)).size).toBe(97);
    expect(new Set(issue294.map((entry) => entry.metadata.contextId)).size).toBe(18);

    for (const entry of issue294) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.FX1")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(
      byPath
        .get("WS.N.N.FX1Mute")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.PositionX")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });

    for (const path of [
      "WS.N.N.ColorSlider",
      "WS.N.N.Hue",
      "WS.N.N.PosX",
      "WS.N.N.RotoAccX",
      "WS.N.N.SatShift",
      "WS.N.N.VisiblePointsEnd",
      "WS.N.N.VisiblePointsStart",
    ]) {
      expect(
        byPath
          .get(path)
          ?.contextValueMetadata?.some((metadata) =>
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
          ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS cue effect controls as cue-type context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Effect = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsCueEffectControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const countsByPath = new Map<string, number>();
    for (const entry of issue294Effect) countsByPath.set(entry.path, (countsByPath.get(entry.path) ?? 0) + 1);

    expect(issue294Effect).toHaveLength(144);
    expect(countsByPath).toEqual(new Map([...issue294WsCueEffectControlPaths].map((path) => [path, 18])));
    expect(new Set(issue294Effect.map((entry) => entry.metadata.contextId)).size).toBe(18);

    for (const entry of issue294Effect) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.ClickMode")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ChasePeriod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ClockShift")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.Effect.ChaseTimeMode")
        ?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        ),
    ).not.toBe(true);
  });

  it("ships issue 294 WS Parametric Image effect ranges as shape context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Parametric = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            entry.path.startsWith("WS.N.N.Image.") &&
            !issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294Parametric).toHaveLength(192);
    expect(new Set(issue294Parametric.map((entry) => entry.path)).size).toBe(6);
    expect(new Set(issue294Parametric.map((entry) => entry.metadata.contextId)).size).toBe(32);

    for (const entry of issue294Parametric) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.Effect.ClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.ClockShift")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });

    for (const path of [
      "WS.N.N.Image.Brightness",
      "WS.N.N.Image.PointCount",
      "WS.N.N.Image.Effect.Zone",
      "WS.N.N.Image.Effect.ZoneMode",
    ]) {
      expect(
        byPath
          .get(path)
          ?.contextValueMetadata?.some((metadata) =>
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
          ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS single-variant state ranges only for completed probe paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294State = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsSingleVariantStatePaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294State).toHaveLength(23);
    expect(new Set(issue294State.map((entry) => entry.path))).toEqual(issue294WsSingleVariantStatePaths);
    expect(new Set(issue294State.map((entry) => entry.metadata.contextId))).toEqual(
      new Set(["cue-type:shape", "cue-type:text", "cue-type:synthesized-image"]),
    );

    for (const entry of issue294State) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata), entry.path).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      if (entry.path.endsWith("BeamRepeat")) {
        expect(entry.metadata.valueRange?.boundaryBehavior).toBe("unknown");
      } else {
        expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      }
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.BeamConnect")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath
        .get("WS.N.N.Image.FftMode")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 6,
        unit: "FFT mode",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.Loops")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 16,
        unit: "loop count",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.BeamRepeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:shape"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 2,
        max: 200,
        unit: "beam repeat count",
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.BeamRepeat")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 2,
        max: 200,
        unit: "beam repeat count",
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Image.PointCount")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 1000,
        unit: "point count",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of issue294WsSingleVariantStateDeferredPaths) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.includes("2026-05-14 issue #294"), path).not.toBe(true);
      expect(
        entry?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS image leftover ranges only for direct clamp evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-leftover-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.Image.BeamSpeed", { contextId: "cue-type:shape", valueType: "number", min: -360, max: 360 }],
      ["WS.N.N.Image.CharAlignX", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 4 }],
      ["WS.N.N.Image.CharAlignY", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 4 }],
      ["WS.N.N.Image.CharEffDelay", { contextId: "cue-type:text", valueType: "number", min: -10, max: 10 }],
      ["WS.N.N.Image.GlobalCharTime", { contextId: "cue-type:text", valueType: "integer", min: 0, max: 1 }],
      [
        "WS.N.N.Image.LIST.0.Image.BeamSpeed",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -360, max: 360 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorX",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorY",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.CursorZ",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.RecordInterval",
        { contextId: "cue-type:synthesized-image", valueType: "integer", min: 5, max: 500 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedX",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedY",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.ScrollSpeedZ",
        { contextId: "cue-type:synthesized-image", valueType: "number", min: -20, max: 20 },
      ],
      ["WS.N.N.Image.RangeScale", { contextId: "cue-type:text", valueType: "integer", min: 1, max: 2 }],
      ["WS.N.N.Image.ScaleX", { contextId: "cue-type:text", valueType: "number", min: 1, max: 200 }],
      ["WS.N.N.Image.ScaleY", { contextId: "cue-type:text", valueType: "number", min: 1, max: 200 }],
      ["WS.N.N.Image.ScrollSpeedX", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.ScrollSpeedY", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.ScrollSpeedZ", { contextId: "cue-type:shape", valueType: "number", min: -20, max: 20 }],
      ["WS.N.N.Image.VertOffset", { contextId: "cue-type:text", valueType: "number", min: -50, max: 50 }],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadata = byPath
        .get(path)
        ?.contextValueMetadata?.find((candidate) => candidate.contextId === range.contextId);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of [
      "WS.N.N.Image.0.FreqX1",
      "WS.N.N.Image.BounceMaxX",
      "WS.N.N.Image.LIST.0.AngleX",
      "WS.N.N.Image.MultiLaser",
      "WS.N.N.Image.Turns(%)",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS leftover size and boolean controls as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
      }>;
    }>("object-range-evidence/issue-294-ws-leftover-size-boolean-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 size/boolean confirmed ";
    const expectedRanges = new Map([
      [
        "WS.N.N.Image.0.SizeX1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeX2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeX3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeY3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ1",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ2",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
      [
        "WS.N.N.Image.0.SizeZ3",
        { contextId: "cue-type:classic-ld2000-abstract", valueType: "number", min: -100, max: 100 },
      ],
    ]);
    const expectedBooleans = new Map([
      ["WS.N.N.Image.BounceMaxX", "cue-type:particles"],
      ["WS.N.N.Image.BounceMaxY", "cue-type:particles"],
      ["WS.N.N.Image.BounceMaxZ", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinX", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinY", "cue-type:particles"],
      ["WS.N.N.Image.BounceMinZ", "cue-type:particles"],
      ["WS.N.N.Ani.0.tsStretchGrouping", "cue-type:object-animator"],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size + expectedBooleans.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size + expectedBooleans.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.filter((entry) => entry.boundaryBehavior === "clamp")).toHaveLength(expectedRanges.size);
    expect(evidence.entries.filter((entry) => entry.boundaryBehavior === "unknown")).toHaveLength(
      expectedBooleans.size,
    );

    for (const [path, range] of expectedRanges) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find((candidate) => candidate.contextId === range.contextId);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const [path, contextId] of expectedBooleans) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find((candidate) => candidate.contextId === contextId);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("boolean");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata?.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of ["WS.N.N.Image.0.FreqX1", "WS.N.N.Image.MultiLaser", "WS.N.N.Ani.0.MaxValue"]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS Classic LD2000 Abstract frequency ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-abstract-frequency-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 frequency confirmed ";
    const expectedPaths = [
      "WS.N.N.Image.0.FreqColor",
      "WS.N.N.Image.0.FreqMOD1",
      "WS.N.N.Image.0.FreqMOD2",
      "WS.N.N.Image.0.FreqX1",
      "WS.N.N.Image.0.FreqX2",
      "WS.N.N.Image.0.FreqX3",
      "WS.N.N.Image.0.FreqY1",
      "WS.N.N.Image.0.FreqY2",
      "WS.N.N.Image.0.FreqY3",
      "WS.N.N.Image.0.FreqZ1",
      "WS.N.N.Image.0.FreqZ2",
      "WS.N.N.Image.0.FreqZ3",
    ];
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedPaths.length);
    expect(evidence.entries).toHaveLength(expectedPaths.length);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const path of expectedPaths) {
      const entry = byPath.get(path);
      const metadata = entry?.contextValueMetadata?.find(
        (candidate) =>
          candidate.contextId === "cue-type:classic-ld2000-abstract" && candidate.notes?.startsWith(issuePrefix),
      );
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("number");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1200,
        unit: "abstract frequency",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of ["WS.N.N.Image.PlayLoopCount", "WS.N.N.Image.StaticDisplayTime"]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS image multivariant ranges only for completed contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-multivariant-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 multivariant confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.Image.Count", { contextId: "cue-type:particles", valueType: "integer", min: 1, max: 200 }],
      ["WS.N.N.Image.CursorX", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.CursorY", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.CursorZ", { contextId: "cue-type:shape", valueType: "number", min: -100, max: 100 }],
      ["WS.N.N.Image.Loops", { contextId: "cue-type:shape", valueType: "integer", min: 1, max: 16 }],
      ["WS.N.N.Image.RecordInterval", { contextId: "cue-type:shape", valueType: "integer", min: 5, max: 500 }],
    ]);
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.size);
    expect(evidence.entries).toHaveLength(expectedRanges.size);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadata = byPath
        .get(path)
        ?.contextValueMetadata?.find(
          (candidate) => candidate.contextId === range.contextId && candidate.notes?.startsWith(issuePrefix),
        );
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const path of [
      "WS.N.N.Image.CenterX",
      "WS.N.N.Image.Color",
      "WS.N.N.Image.Point/Line",
      "WS.N.N.Image.Size(%)",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 294 WS image point count contexts only for completed bounds", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-image-pointcount-context-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #294 point-count contexts confirmed ";
    const expectedRanges = [
      {
        path: "WS.N.N.Image.PointCount",
        contextId: "cue-type:shape",
        valueType: "integer",
        min: 1,
        max: 1000,
      },
      {
        path: "WS.N.N.Image.PointCount",
        contextId: "cue-type:particles",
        valueType: "integer",
        min: 1,
        max: 200,
      },
    ];
    const issueRows = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issueRows).toHaveLength(expectedRanges.length);
    expect(evidence.entries).toHaveLength(expectedRanges.length);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(new Set(evidence.entries.map((entry) => entry.probePath))).toEqual(
      new Set(["WS.0.3.Image.PointCount", "WS.0.10.Image.PointCount"]),
    );

    for (const range of expectedRanges) {
      const metadata = byPath
        .get(range.path)
        ?.contextValueMetadata?.find(
          (candidate) => candidate.contextId === range.contextId && candidate.notes?.startsWith(issuePrefix),
        );
      expect(metadata, `${range.path} ${range.contextId}`).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), range.contextId).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe(range.valueType);
      expect(metadata?.valueRange).toMatchObject({
        min: range.min,
        max: range.max,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      });
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    for (const contextId of ["cue-type:fifo-image", "cue-shape:parametric-image:wave"]) {
      expect(
        byPath
          .get("WS.N.N.Image.PointCount")
          ?.contextValueMetadata?.some(
            (metadata) => metadata.contextId === contextId && metadata.notes?.startsWith(issuePrefix),
          ) ?? false,
        contextId,
      ).toBe(false);
    }

    for (const path of [
      "WS.N.N.Image.Anchors",
      "WS.N.N.Image.Lines",
      "WS.N.N.Image.Points",
      "WS.N.N.Image.SizeX",
      "WS.N.N.Image.SizeY",
      "WS.N.N.Image.StartAngle",
      "WS.N.N.Image.Brightness",
      "WS.N.N.Image.Effect.Zone",
      "WS.N.N.Image.Effect.ZoneMode",
      "WS.N.N.Image.Hue",
      "WS.N.N.Image.Saturation",
    ]) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(
        entry?.contextValueMetadata?.some((metadata) => metadata.notes?.startsWith(issuePrefix)) ?? false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 362 WS boolean accepted values only for verified contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
        locationContext?: { concreteContext?: string };
      }>;
    }>("object-range-evidence/issue-362-ws-boolean-accepted-values.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #362 confirmed ";
    const expectedContexts = new Map([
      ["WS.N.N.Ani.0.Muted", "cue-type:object-animator"],
      ["WS.N.N.Ani.0.PreventReroute", "cue-type:object-animator"],
      ["WS.N.N.Ani.0.Solo", "cue-type:object-animator"],
      ["WS.N.N.Image.AutoRecord", "cue-type:fifo-image"],
      ["WS.N.N.Image.EnableRecord", "cue-type:fifo-image"],
    ]);
    const issue362 = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue362).toHaveLength(5);
    expect(new Set(issue362.map((entry) => entry.path))).toEqual(new Set(expectedContexts.keys()));
    expect(evidence.entries).toHaveLength(5);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "unknown")).toBe(true);
    expect(
      evidence.entries.every((entry) =>
        [0, 1].every((value) => entry.acceptedValues?.some((acceptedValue) => acceptedValue.value === value)),
      ),
    ).toBe(true);

    for (const [path, contextId] of expectedContexts) {
      const metadata = byPath.get(path)?.contextValueMetadata?.find((candidate) => candidate.contextId === contextId);
      expect(metadata, path).toBeDefined();
      assertObjectPropertyValueMetadata(metadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(metadata as ObjectPropertyValueMetadata), path).toBe(true);
      expect(metadata?.evidenceLevel).toBe("observed");
      expect(metadata?.valueType).toBe("boolean");
      expect(metadata?.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata?.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata?.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
      });
    }
  });

  it("ships issue 294 WS scalar controls only for verified top-level cue contexts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-294-ws-scalar-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime SetProp write/readback on 2026-05-14 issue #294 confirmed ";
    const expectedRanges = new Map([
      ["WS.N.N.ColorSlider", { valueType: "integer", min: 0, max: 255, unit: "8-bit channel" }],
      ["WS.N.N.Hue", { valueType: "number", min: -1, max: 720, unit: "degrees" }],
      ["WS.N.N.RotoAccX", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
      ["WS.N.N.RotoAccY", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
      ["WS.N.N.RotoAccZ", { valueType: "number", min: -36000, max: 36000, unit: "rotation acceleration" }],
    ]);
    const issue294Scalar = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294Scalar).toHaveLength(90);
    expect(evidence.entries).toHaveLength(90);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const [path, range] of expectedRanges) {
      const metadataRows = issue294Scalar.filter((entry) => entry.path === path);
      expect(metadataRows, path).toHaveLength(18);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
      for (const { metadata } of metadataRows) {
        assertObjectPropertyValueMetadata(metadata);
        expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
        expect(metadata.evidenceLevel).toBe("observed");
        expect(metadata.valueType).toBe(range.valueType);
        expect(metadata.valueRange).toMatchObject({
          min: range.min,
          max: range.max,
          unit: range.unit,
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        });
        expect(metadata.locationContext).toMatchObject({
          kind: "workspace-slot",
          populationDependent: true,
        });
      }
    }

    for (const path of ["WS.N.N.SatShift", "WS.N.N.VisiblePointsEnd", "WS.N.N.FX7"]) {
      const issueMetadata = byPath
        .get(path)
        ?.contextValueMetadata?.filter((metadata) => metadata.notes?.startsWith(issuePrefix));
      expect(issueMetadata ?? [], path).toHaveLength(0);
    }
  });

  it("ships issue 294 WS nested effect controls only for completed probe paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294NestedEffect = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsNestedEffectControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(issue294NestedEffect).toHaveLength(8);
    expect(new Set(issue294NestedEffect.map((entry) => entry.path))).toEqual(issue294WsNestedEffectControlPaths);
    expect(new Set(issue294NestedEffect.map((entry) => entry.metadata.contextId))).toEqual(
      new Set(["cue-type:parametric-image", "cue-type:synthesized-image"]),
    );

    for (const entry of issue294NestedEffect) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata), entry.path).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Image.Effect.ChasePeriod")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:parametric-image"),
    ).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Effect.EnableClockLimit")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });

    for (const path of issue294WsNestedEffectDeferredPaths) {
      const entry = byPath.get(path);
      expect(entry?.valueMetadata?.notes?.includes("2026-05-14 issue #294"), path).not.toBe(true);
      expect(
        entry?.contextValueMetadata?.some((metadata) =>
          metadata.notes?.startsWith("Runtime object write/readback on 2026-05-14 issue #294 confirmed "),
        ),
        path,
      ).not.toBe(true);
    }
  });

  it("ships issue 294 WS string ranges as context metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue294Strings = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter(
          (metadata) =>
            issue294WsStringControlPaths.has(entry.path) &&
            metadata.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #294 confirmed "),
        )
        .map((metadata) => ({ path: entry.path, metadata })),
    );
    const countsByPath = new Map<string, number>();
    for (const entry of issue294Strings) countsByPath.set(entry.path, (countsByPath.get(entry.path) ?? 0) + 1);

    expect(issue294Strings).toHaveLength(69);
    expect(countsByPath).toEqual(
      new Map([
        ["WS.N.N.Caption", 18],
        ["WS.N.N.Effect.Name", 18],
        ["WS.N.N.Image.Effect.Name", 32],
        ["WS.N.N.Image.LIST.0.Effect.Name", 1],
      ]),
    );

    for (const entry of issue294Strings) {
      assertObjectPropertyValueMetadata(entry.metadata);
      expect(hasManualReadyValueMetadata(entry.metadata)).toBe(true);
      expect(entry.metadata.evidenceLevel).toBe("observed");
      expect(entry.metadata.valueType).toBe("string");
      expect(entry.metadata.valueRange).toMatchObject({
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      });
      expect(entry.metadata.locationContext).toMatchObject({
        kind: "workspace-slot",
        populationDependent: true,
        indexBasis: "WS.N.N uses page index then cue slot index.",
      });
    }

    expect(
      byPath
        .get("WS.N.N.Caption")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:frames-simple"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.Effect.Name")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-shape:parametric-image:wave"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
    expect(
      byPath
        .get("WS.N.N.Image.LIST.0.Effect.Name")
        ?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:synthesized-image"),
    ).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
      },
    });
  });

  it("ships issue 293 ProTrack common ranges without sibling or focused-cue propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #293 confirmed "),
    );

    expect(issue293).toHaveLength(218);
    expect(issue293.filter((entry) => entry.root === "ProTrack")).toHaveLength(109);
    expect(issue293.filter((entry) => entry.root === "ProTrack1")).toHaveLength(109);
    expect(issue293.filter((entry) => entry.root.endsWith("FocusedCue"))).toHaveLength(0);

    for (const entry of issue293) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
    }
    for (const entry of issue293.filter((entry) => entry.root === "ProTrack")) {
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "ProTrack.N uses the zero-based Object Tree track index.",
      });
    }
    for (const entry of issue293.filter((entry) => entry.root === "ProTrack1")) {
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("ProTrack.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("ProTrack1.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    for (const path of ["ProTrack.N.FX1Mute", "ProTrack1.FX1Mute"]) {
      expect(byPath.get(path)?.valueMetadata, path).toMatchObject({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
      });
    }
    expect(byPath.get("ProTrack.N.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("ProTrack1.Param12")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "parameter flag",
      },
    });
    expect(byPath.get("ProTrack.N.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("ProTrack1.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("ProTrack.N.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
      },
    });
    expect(byPath.get("ProTrack1.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack.N.VisiblePointStart")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ProTrack.N.FX7",
      "ProTrack.N.FX8",
      "ProTrack.N.SatShift",
      "ProTrack.N.VisiblePointsEnd",
      "ProTrack.N.VisiblePointsStart",
      "ProTrack1.FX7",
      "ProTrack1.FX8",
      "ProTrack1.SatShift",
      "ProTrack1.VisiblePointsEnd",
      "ProTrack1.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 293 ProTrack2 through ProTrack8 ranges without focused-cue propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293ProTrack28 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(
        "Runtime object write/readback on 2026-05-13 issue #293 ProTrack2-8 confirmed ",
      ),
    );

    expect(issue293ProTrack28).toHaveLength(805);
    for (const root of ["ProTrack2", "ProTrack3", "ProTrack4", "ProTrack5", "ProTrack6", "ProTrack7", "ProTrack8"]) {
      expect(
        issue293ProTrack28.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(115);
    }
    expect(issue293ProTrack28.filter((entry) => entry.root.endsWith("FocusedCue"))).toHaveLength(0);
    for (const entry of issue293ProTrack28) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toBeUndefined();
    }

    expect(byPath.get("ProTrack2.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack8.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("ProTrack3.Param12")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "parameter flag",
      },
    });
    expect(byPath.get("ProTrack4.Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("ProTrack5.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("ProTrack6.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("ProTrack7.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
      },
    });
    expect(byPath.get("ProTrack8.Zoom")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ProTrack2.FX7",
      "ProTrack8.FX8",
      "ProTrack6.SatShift",
      "ProTrack7.VisiblePointsEnd",
      "ProTrack8.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 348 remaining ProTrack controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-348-protrack-remaining-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #348 confirmed ";
    const issue348 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedRoots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];

    expect(issue348).toHaveLength(45);
    for (const root of expectedRoots) {
      expect(
        issue348.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(5);
    }
    expect(evidence.entries).toHaveLength(153);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(45);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(108);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue348) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("ProTrack.N.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack8.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "ProTrack.N.Caption",
      "ProTrack.N.FX7",
      "ProTrack3.SatShift",
      "ProTrack4.VisiblePointsEnd",
      "ProTrack5.VisiblePointsStart",
      "ProTrack6.Zones",
      "ProTrack8.FX8",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(byPath.get("ProTrack2.PosX")?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false).toBe(false);
  });

  it("ships issue 373 ProTrack cue and preset index metadata", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #373 confirmed ";
    const issue373 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedRoots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];

    expect(issue373).toHaveLength(18);
    for (const root of expectedRoots) {
      expect(
        issue373.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(2);
    }

    for (const entry of issue373) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.acceptedValues).toEqual([
        expect.objectContaining({
          value: -1,
          label: "DISABLED",
        }),
      ]);
    }

    expect(byPath.get("ProTrack.N.CueIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        dynamicMax: {
          expression: "Grid.Count - 1",
          sourcePaths: ["Grid.Count"],
        },
        unit: "cue index",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack8.CueIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        dynamicMax: {
          expression: "Grid.Count - 1",
          sourcePaths: ["Grid.Count"],
        },
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ProTrack1.PresetIndex")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "preset index",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ProTrack.N.Caption")?.valueMetadata, "Caption remains a no-op string gap").toBeUndefined();
    expect(byPath.get("ProTrack2.SatShift")?.valueMetadata, "SatShift remains a no-op gap").toBeUndefined();
  });

  it("ships issue 216 ProTrack leftover readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/protrack/leftover-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
        };
      }>;
    }>("object-range-evidence/issue-216-protrack-leftovers.json");

    const roots = ["ProTrack", ...Array.from({ length: 8 }, (_, index) => `ProTrack${index + 1}`)];
    const properties = ["Caption", "FX7", "FX8", "SatShift", "VisiblePointsEnd", "VisiblePointsStart", "Zones"];
    const expectedPaths = new Set(
      roots.flatMap((root) =>
        properties.map((property) => (root === "ProTrack" ? `ProTrack.N.${property}` : `${root}.${property}`)),
      ),
    );
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(readbackOverlay.entries).toHaveLength(63);
    expect(evidence.entries).toHaveLength(63);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      const testedInputs = row?.testedValues.map((testedValue) => testedValue.input);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      if (metadata.path.endsWith(".Caption")) {
        expect(testedInputs, metadata.path).toEqual(expect.arrayContaining([0, 1, 32, 254, 255]));
      } else {
        expect(testedInputs, metadata.path).toEqual(
          expect.arrayContaining([-2147483648, 100000, 120000, 1000000, 2147483647]),
        );
      }
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("ProTrack.N.Caption")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "ProTrack.N uses the zero-based Object Tree ProTrack index.",
      },
    });
    expect(byPath.get("ProTrack.N.FX7")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(byPath.get("ProTrack1.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ProTrack1 is a direct ProTrack alias in the loaded show.",
      },
    });
    expect(byPath.get("ProTrack8.Zones")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 0,
    });
    expect(evidenceByPath.get("ProTrack.N.Caption")?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
      concreteContext: "ProTrack.0",
    });
    expect(evidenceByPath.get("ProTrack8.Caption")?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
      concreteContext: "ProTrack8",
    });

    for (const root of roots) {
      const gaps = objectPropertyIndex.entries.filter(
        (entry) =>
          entry.root === root && !entry.valueMetadata && !entry.contextValueMetadata?.length && !entry.readbackMetadata,
      );
      expect(gaps, root).toHaveLength(0);
    }
  });

  it("ships issue 293 focused-cue ranges only on directly probed aliases", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue293FocusedCue = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(
        "Runtime object write/readback on 2026-05-13 issue #293 focused-cue confirmed ",
      ),
    );

    expect(issue293FocusedCue).toHaveLength(291);
    for (const root of ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"]) {
      expect(
        issue293FocusedCue.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(97);
    }
    for (const entry of issue293FocusedCue) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("ActGridFocusedCue.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
      },
    });
    expect(byPath.get("Grid1FocusedCue.FX8Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Grid2FocusedCue.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("Grid1FocusedCue.PositionZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("ActGridFocusedCue.VisiblePointStart")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
      },
    });

    for (const path of [
      "ActGridFocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "ActGridFocusedCue.PosX",
      "Grid2FocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
    expect(
      byPath
        .get("WS.N.N.FX1")
        ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #293 confirmed ") ??
        false,
      "WS.N.N.FX1",
    ).toBe(false);
  });

  it("ships issue 328 focused-cue effect control ranges only for completed write-readback paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #328 confirmed ";
    const focusedCueRoots = ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"];
    const issue328FocusedCue = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith(issuePrefix),
    );

    expect(issue328FocusedCue).toHaveLength(27);
    for (const root of focusedCueRoots) {
      expect(
        issue328FocusedCue.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(9);
    }
    for (const entry of issue328FocusedCue) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    const expectedSuffixes = [
      "CaptionColor",
      "ClickMode",
      "Effect.ChasePeriod",
      "Effect.ClockLimit",
      "Effect.ClockShift",
      "Effect.EnableClockLimit",
      "Effect.EnableMetroLimit",
      "Effect.MetroLimit",
      "Effect.MetroShift",
    ];
    const expectedPaths = new Set(
      focusedCueRoots.flatMap((root) => expectedSuffixes.map((suffix) => `${root}.${suffix}`)),
    );
    expect(new Set(issue328FocusedCue.map((entry) => entry.path))).toEqual(expectedPaths);

    expect(byPath.get("ActGridFocusedCue.CaptionColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "caption color integer",
      },
    });
    expect(byPath.get("Grid1FocusedCue.ClickMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Effect.ClockLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Grid1FocusedCue.Effect.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Grid1FocusedCue.Effect.MetroLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Grid2FocusedCue.Effect.MetroShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });

    for (const root of focusedCueRoots) {
      for (const suffix of ["Effect.ChaseTimeMode", "Effect.Zone", "Effect.ZoneMode"]) {
        const path = `${root}.${suffix}`;
        expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
        expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
      }
      for (const suffix of ["ContainStartScript", "ContainEndScript", "CueType"]) {
        const path = `${root}.${suffix}`;
        expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      }
    }
  });

  it("ships issue 350 focused-cue remaining controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-350-focused-cue-remaining-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #350 confirmed ";
    const focusedCueRoots = ["ActGridFocusedCue", "Grid1FocusedCue", "Grid2FocusedCue"];
    const issue350 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue350).toHaveLength(15);
    for (const root of focusedCueRoots) {
      expect(
        issue350.filter((entry) => entry.root === root),
        root,
      ).toHaveLength(5);
    }
    expect(evidence.entries).toHaveLength(57);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(15);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(42);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.objectPath === entry.probePath)).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue350) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("ActGridFocusedCue.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("Grid1FocusedCue.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("Grid2FocusedCue.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of [
      "ActGridFocusedCue.ContainStartScript",
      "ActGridFocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "Grid2FocusedCue.PosX",
      "Grid2FocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 216 ActGridFocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/act-grid-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-act-grid-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "ActGridFocusedCue.ContainEndScript",
      "ActGridFocusedCue.ContainStartScript",
      "ActGridFocusedCue.CueType",
      "ActGridFocusedCue.Effect.ChaseTimeMode",
      "ActGridFocusedCue.Effect.Zone",
      "ActGridFocusedCue.Effect.ZoneMode",
      "ActGridFocusedCue.FX7",
      "ActGridFocusedCue.FX8",
      "ActGridFocusedCue.PosX",
      "ActGridFocusedCue.PosY",
      "ActGridFocusedCue.PosZ",
      "ActGridFocusedCue.SatShift",
      "ActGridFocusedCue.VisiblePointsEnd",
      "ActGridFocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("ActGridFocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("ActGridFocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("ActGridFocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("ActGridFocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("ActGridFocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const actGridFocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "ActGridFocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(actGridFocusedCueGaps).toHaveLength(0);
  });

  it("ships issue 216 Grid1FocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/grid1-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-grid1-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "Grid1FocusedCue.ContainEndScript",
      "Grid1FocusedCue.ContainStartScript",
      "Grid1FocusedCue.CueType",
      "Grid1FocusedCue.Effect.ChaseTimeMode",
      "Grid1FocusedCue.Effect.Zone",
      "Grid1FocusedCue.Effect.ZoneMode",
      "Grid1FocusedCue.FX7",
      "Grid1FocusedCue.FX8",
      "Grid1FocusedCue.PosX",
      "Grid1FocusedCue.PosY",
      "Grid1FocusedCue.PosZ",
      "Grid1FocusedCue.SatShift",
      "Grid1FocusedCue.VisiblePointsEnd",
      "Grid1FocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Grid1FocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("Grid1FocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("Grid1FocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("Grid1FocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("Grid1FocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const grid1FocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Grid1FocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(grid1FocusedCueGaps).toHaveLength(0);
  });

  it("ships issue 216 Grid2FocusedCue no-op readbacks after sampled write attempts", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
      }>;
    }>("object-property-index.json");
    const readbackOverlay = readJson<{
      entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
    }>("object-property-readbacks/focused-cue/grid2-focused-cue-readbacks.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior: string;
        valueType: string;
        testedValues: Array<{
          input?: string | number | boolean;
          readback: string | number | boolean | null;
          behavior: string;
        }>;
        deferReason?: string;
      }>;
    }>("object-range-evidence/issue-216-grid2-focused-cue-readbacks.json");

    const expectedPaths = new Set([
      "Grid2FocusedCue.ContainEndScript",
      "Grid2FocusedCue.ContainStartScript",
      "Grid2FocusedCue.CueType",
      "Grid2FocusedCue.Effect.ChaseTimeMode",
      "Grid2FocusedCue.Effect.Zone",
      "Grid2FocusedCue.Effect.ZoneMode",
      "Grid2FocusedCue.FX7",
      "Grid2FocusedCue.FX8",
      "Grid2FocusedCue.PosX",
      "Grid2FocusedCue.PosY",
      "Grid2FocusedCue.PosZ",
      "Grid2FocusedCue.SatShift",
      "Grid2FocusedCue.VisiblePointsEnd",
      "Grid2FocusedCue.VisiblePointsStart",
    ]);
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const evidenceByPath = new Map(evidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(new Set(readbackOverlay.entries.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(14);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);

    for (const metadata of readbackOverlay.entries) {
      const entry = byPath.get(metadata.path);
      const row = evidenceByPath.get(metadata.path);
      expect(entry?.valueMetadata, metadata.path).toBeUndefined();
      expect(entry?.contextValueMetadata, metadata.path).toBeUndefined();
      expect(entry?.readbackMetadata, metadata.path).toMatchObject({
        readable: true,
        probeMode: "readback-only",
        evidenceLevel: "observed",
        observedAt: "2026-05-16",
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("write/readback evidence");
      expect(entry?.readbackMetadata?.notes, metadata.path).toContain("readback-only after write attempts");
      expect(row, metadata.path).toMatchObject({
        shipsMetadata: false,
        boundaryBehavior: "no-op",
        deferReason: expect.stringContaining("readback-only"),
      });
      expect(
        row?.testedValues.every((testedValue) => testedValue.behavior === "no-op"),
        metadata.path,
      ).toBe(true);
      assertObjectPropertyReadbackMetadata(entry?.readbackMetadata as ObjectPropertyReadbackMetadata);
    }

    expect(byPath.get("Grid2FocusedCue.ContainEndScript")?.readbackMetadata).toMatchObject({
      valueType: "string",
      observedValue: "0",
      typeTag: "s",
    });
    expect(byPath.get("Grid2FocusedCue.CueType")?.readbackMetadata).toMatchObject({
      valueType: "integer",
      observedValue: 1,
    });
    expect(byPath.get("Grid2FocusedCue.PosX")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 0,
    });
    expect(byPath.get("Grid2FocusedCue.VisiblePointsEnd")?.readbackMetadata).toMatchObject({
      valueType: "number",
      observedValue: 100,
    });
    expect(evidenceByPath.get("Grid2FocusedCue.CueType")?.testedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: -2147483648, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 100000, readback: 1, behavior: "no-op" }),
        expect.objectContaining({ input: 2147483647, readback: 1, behavior: "no-op" }),
      ]),
    );

    const grid2FocusedCueGaps = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Grid2FocusedCue" &&
        !entry.valueMetadata &&
        !entry.contextValueMetadata?.length &&
        !entry.readbackMetadata,
    );
    expect(grid2FocusedCueGaps).toHaveLength(0);
  });

  it("ships directly observed Zone object-property ranges without alias propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directZone = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Zone" && entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );
    const zoneAliasWithMetadata = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "ZoneAlias" &&
        entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12"),
    );

    expect(directZone).toHaveLength(22);
    expect(zoneAliasWithMetadata).toHaveLength(0);
    for (const entry of directZone) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.Brightness")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.SizeX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.Red")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
      },
    });
    expect(byPath.get("Zone.N.Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(
      byPath
        .get("ZoneAlias.Brightness")
        ?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-12") ?? false,
    ).toBe(false);
  });

  it("ships issue 292 Zone effect and transform ranges without ZoneAlias propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue292 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #292"),
    );

    expect(issue292).toHaveLength(88);
    expect(issue292.filter((entry) => entry.root === "Zone")).toHaveLength(88);
    expect(issue292.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(0);
    for (const entry of issue292) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.valueRange?.boundaryBehavior).toBe("clamp");
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.FX1Action")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "action value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Zone.N.FX1Mute")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Zone.N.FX1TimeScaleClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 100,
        unit: "time scale",
      },
    });
    expect(byPath.get("Zone.N.FX1TimeShiftMetro")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
      },
    });
    expect(byPath.get("Zone.N.Pan")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
      },
    });
    expect(byPath.get("Zone.N.RGBColor")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "RGB color integer",
      },
    });
    expect(byPath.get("Zone.N.RotoAngleY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -2880,
        max: 2880,
        unit: "degrees",
      },
    });
    expect(byPath.get("Zone.N.RotoSpeedY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1440,
        max: 1440,
        unit: "rotation speed",
      },
    });
    expect(byPath.get("Zone.N.Mesh.IndexX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1,
        unit: "mesh index",
      },
    });
    expect(byPath.get("Zone.N.Saturation")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -100,
        max: 100,
        unit: "percent",
      },
    });
    expect(byPath.get("Zone.N.TestFrame")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 2,
        unit: "test frame",
      },
    });

    for (const path of ["Zone.N.FX7", "Zone.N.FX8"]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }

    for (const path of ["ZoneAlias.FX1", "ZoneAlias.Pan", "ZoneAlias.RGBColor"]) {
      expect(
        byPath.get(path)?.valueMetadata?.notes?.startsWith("Runtime object write/readback on 2026-05-13 issue #292") ??
          false,
        path,
      ).toBe(false);
    }
  });

  it("ships issue 331 Zone effect controls only for completed Zone.0 write-readback paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-14 issue #331 confirmed ";
    const issue331 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.Effect.ChasePeriod",
      "Zone.N.Effect.ClockLimit",
      "Zone.N.Effect.ClockShift",
      "Zone.N.Effect.EnableClockLimit",
      "Zone.N.Effect.EnableMetroLimit",
      "Zone.N.Effect.MetroLimit",
      "Zone.N.Effect.MetroShift",
    ]);

    expect(issue331).toHaveLength(7);
    expect(new Set(issue331.map((entry) => entry.path))).toEqual(expectedPaths);
    for (const entry of issue331) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index.",
      });
    }

    expect(byPath.get("Zone.N.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("Zone.N.Effect.ClockLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Zone.N.Effect.ClockShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });
    expect(byPath.get("Zone.N.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.MetroLimit")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect limit",
      },
    });
    expect(byPath.get("Zone.N.Effect.MetroShift")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -10,
        max: 10,
        unit: "effect shift",
      },
    });

    for (const path of ["Zone.N.Effect.ChaseTimeMode", "Zone.N.Effect.Zone", "Zone.N.Effect.ZoneMode"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 340 Zone nested effect controls only for completed Zone.0 Effect.0 paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const timeBoundaryEvidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        testedValues: Array<{ input: number; readback: number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-340-zone-nested-time-boundary-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issue340 = objectPropertyIndex.entries.filter((entry) =>
      entry.valueMetadata?.notes?.includes(" issue #340 confirmed "),
    );
    const expectedPaths = new Set([
      "Zone.N.Effect.N.Enabled",
      "Zone.N.Effect.N.RouterMode",
      "Zone.N.Effect.N.TimeActive",
      "Zone.N.Effect.N.TimeClock",
      "Zone.N.Effect.N.TimeDuration",
      "Zone.N.Effect.N.TimeDurationInBeat",
      "Zone.N.Effect.N.TimeEnabled",
      "Zone.N.Effect.N.TimeMetro",
    ]);

    expect(issue340).toHaveLength(8);
    expect(new Set(issue340.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(timeBoundaryEvidence.entries).toHaveLength(3);
    expect(timeBoundaryEvidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(timeBoundaryEvidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    for (const entry of timeBoundaryEvidence.entries) {
      expect(entry.testedValues).toContainEqual(expect.objectContaining({ input: -1, readback: 0, behavior: "clamp" }));
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 1000000, readback: 1000000, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 1000001, readback: 1000000, behavior: "clamp" }),
      );
    }
    for (const entry of issue340) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Zone.N uses the zero-based Object Tree zone index, and Effect.N uses the zone effect slot index.",
      });
    }

    expect(byPath.get("Zone.N.Effect.N.RouterMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeEnabled")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 1000000,
        unit: "clock value",
      },
    });
    expect(byPath.get("Zone.N.Effect.N.TimeDuration")?.valueMetadata).toMatchObject({
      valueType: "float",
      valueRange: {
        min: 0,
        max: 1000000,
        unit: "time duration",
      },
    });

    for (const path of [
      "Zone.N.Effect.N.RouterInZone",
      "Zone.N.Effect.N.RouterOutZone",
      "Zone.N.Effect.N.TimeStateCanRestart",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 359 ZoneAlias nested effect controls through zone-name alias equivalence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      runtime: {
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
        locationContext?: {
          kind: string;
          populationDependent?: boolean;
          concreteContext?: string;
          notes?: string;
        };
      }>;
    }>("object-range-evidence/issue-359-zonealias-nested-effect-alias-equivalence.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #359 confirmed ";
    const issue359 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "ZoneAlias.Effect.N.Enabled",
      "ZoneAlias.Effect.N.RouterMode",
      "ZoneAlias.Effect.N.TimeActive",
      "ZoneAlias.Effect.N.TimeDurationInBeat",
      "ZoneAlias.Effect.N.TimeEnabled",
    ]);
    const deferredSiblingPaths = [
      "ZoneAlias.Effect.N.RouterInZone",
      "ZoneAlias.Effect.N.RouterOutZone",
      "ZoneAlias.Effect.N.TimeStateCanRestart",
    ];
    const retestedSiblingPaths = [
      "ZoneAlias.Effect.N.TimeClock",
      "ZoneAlias.Effect.N.TimeDuration",
      "ZoneAlias.Effect.N.TimeMetro",
    ];

    expect(issue359).toHaveLength(5);
    expect(new Set(issue359.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.runtime.notes).toContain("ZoneAlias denotes a user-configured zone-name alias");
    expect(evidence.runtime.notes).toContain("Zone.2");
    expect(evidence.entries).toHaveLength(5);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(expectedPaths);
    expect(new Set(evidence.entries.map((entry) => entry.probePath))).toEqual(
      new Set([
        "Zone.0.Effect.0.Enabled",
        "Zone.0.Effect.0.RouterMode",
        "Zone.0.Effect.0.TimeActive",
        "Zone.0.Effect.0.TimeDurationInBeat",
        "Zone.0.Effect.0.TimeEnabled",
      ]),
    );

    for (const entry of issue359) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "ZoneAlias denotes a user-configured zone name that resolves to the same Object Tree zone as Zone.N by index.",
      });
    }

    for (const entry of evidence.entries) {
      expect(entry.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
      expect(entry.locationContext?.notes).toContain("not a stable literal root");
    }

    expect(byPath.get("ZoneAlias.Effect.N.RouterMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "router mode",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.N.TimeEnabled")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });

    for (const path of deferredSiblingPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }

    for (const path of retestedSiblingPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: 0,
        max: 1000000,
        boundaryBehavior: "clamp",
      });
    }
  });

  it("ships issue 343 ZoneAlias effect controls only for completed SetProp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #343 confirmed ";
    const issue343 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "ZoneAlias.Effect.ChasePeriod",
      "ZoneAlias.Effect.ClockLimit",
      "ZoneAlias.Effect.ClockShift",
      "ZoneAlias.Effect.EnableClockLimit",
      "ZoneAlias.Effect.EnableMetroLimit",
      "ZoneAlias.Effect.MetroLimit",
      "ZoneAlias.Effect.MetroShift",
    ]);

    expect(issue343).toHaveLength(7);
    expect(new Set(issue343.map((entry) => entry.path))).toEqual(expectedPaths);
    for (const entry of issue343) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ZoneAlias resolves through BEYOND's current zone alias state for the loaded show.",
      });
    }

    expect(byPath.get("ZoneAlias.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
      },
    });
    expect(byPath.get("ZoneAlias.Effect.EnableMetroLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
      },
    });

    expect(byPath.get("ZoneAlias.Effect.ChaseTimeMode")?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false).toBe(
      false,
    );
    expect(byPath.get("ZoneAlias.Effect.ChaseTimeMode")?.valueMetadata).toBeUndefined();
  });

  it("ships issue 346 ZoneAlias direct controls only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-346-zonealias-direct-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #346 confirmed ";
    const issue346 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const deferredPaths = new Set(["ZoneAlias.Active", "ZoneAlias.BlockZone", "ZoneAlias.Mute", "ZoneAlias.Visible"]);

    expect(issue346).toHaveLength(106);
    expect(evidence.entries).toHaveLength(110);
    expect(new Set(evidence.entries.filter((entry) => !entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      deferredPaths,
    );
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue346) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior, entry.path).toBe("clamp");
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis: "ZoneAlias resolves through BEYOND's current zone alias state for the loaded show.",
      });
    }

    expect(byPath.get("ZoneAlias.Alpha")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.PositionX")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.PreviewAsBeams")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.ScanRate")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.FX8TimeShiftClock")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -100,
        max: 100,
        unit: "time shift",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of deferredPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });

  it("ships issue 352 Zone and ZoneAlias scalar aliases only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-352-zone-scalar-alias-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #352 confirmed ";
    const issue352 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const deferredPaths = new Set([
      "Zone.N.PosX",
      "Zone.N.PosY",
      "Zone.N.PosZ",
      "Zone.N.SatShift",
      "Zone.N.VisiblePointsEnd",
      "Zone.N.VisiblePointsStart",
      "ZoneAlias.PosX",
      "ZoneAlias.PosY",
      "ZoneAlias.PosZ",
      "ZoneAlias.SatShift",
      "ZoneAlias.VisiblePointsEnd",
      "ZoneAlias.VisiblePointsStart",
    ]);

    expect(issue352).toHaveLength(10);
    expect(issue352.filter((entry) => entry.root === "Zone")).toHaveLength(5);
    expect(issue352.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(5);
    expect(evidence.entries).toHaveLength(22);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(10);
    expect(new Set(evidence.entries.filter((entry) => !entry.shipsMetadata).map((entry) => entry.objectPath))).toEqual(
      deferredPaths,
    );
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);

    for (const entry of issue352) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
    }

    expect(byPath.get("Zone.N.ColorSlider")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("Zone.N.RotoAccY")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("ZoneAlias.Hue")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
      },
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });
    expect(byPath.get("ZoneAlias.RotoAccZ")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: -36000,
        max: 36000,
        unit: "rotation acceleration",
        boundaryBehavior: "clamp",
      },
    });

    for (const path of deferredPaths) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }

    for (const path of [...deferredPaths].filter(
      (candidate) => !/^Zone\.N\.Pos[XYZ]$/.test(candidate) && !/^ZoneAlias\.Pos[XYZ]$/.test(candidate),
    )) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 395 ZoneAlias position ranges from concrete alias readback", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-395-alias-cleanup-ranges.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #395 confirmed ";
    const issue395 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue395).toHaveLength(3);
    expect(issue395.filter((entry) => entry.root === "ZoneAlias")).toHaveLength(3);
    expect(evidence.entries).toHaveLength(3);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);

    for (const entry of issue395) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.defaultValue).toBeUndefined();
    }

    for (const path of ["ZoneAlias.PosX", "ZoneAlias.PosY", "ZoneAlias.PosZ"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
        },
        locationContext: {
          kind: "showfile-alias",
          populationDependent: true,
        },
      });
    }

    for (const path of ["ZoneAlias.SatShift", "ZoneAlias.VisiblePointsEnd", "ZoneAlias.FX7"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 357 Zone and ZoneAlias UGC indexes only for completed clamp paths", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-357-zone-ugc-correction-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #357 confirmed ";
    const issue357 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.UGC.IndexX",
      "Zone.N.UGC.IndexY",
      "ZoneAlias.UGC.IndexX",
      "ZoneAlias.UGC.IndexY",
    ]);

    expect(issue357).toHaveLength(4);
    expect(new Set(issue357.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(50);
    expect(evidence.entries.filter((entry) => entry.shipsMetadata)).toHaveLength(4);
    expect(evidence.entries.filter((entry) => !entry.shipsMetadata)).toHaveLength(46);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(
      evidence.entries.filter((entry) => entry.shipsMetadata).every((entry) => entry.boundaryBehavior === "clamp"),
    ).toBe(true);
    expect(
      evidence.entries
        .filter((entry) => !entry.shipsMetadata)
        .every((entry) => entry.boundaryBehavior === "pass-through"),
    ).toBe(true);

    for (const entry of issue357) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior).toBe("clamp");
      expect(metadata.valueRange).toMatchObject({
        min: -1,
        max: 0,
        unit: "UGC index",
      });
    }

    expect(byPath.get("Zone.N.UGC.IndexX")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "indexed-root",
        populationDependent: true,
      },
    });
    expect(byPath.get("ZoneAlias.UGC.IndexY")?.valueMetadata).toMatchObject({
      valueType: "integer",
      locationContext: {
        kind: "showfile-alias",
        populationDependent: true,
      },
    });

    for (const path of ["Zone.N.UGC.BowX", "Zone.N.UGC.SizeX", "ZoneAlias.UGC.PositionX", "ZoneAlias.UGC.SymmetryY"]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      });
    }
  });

  it("ships issue 366 Zone VisualizationId rows only after extended upper-bound evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-366-zone-visualization-id-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #366 confirmed ";
    const issue366 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue366.map((entry) => entry.path).sort()).toEqual(
      ["Zone.N.VisualizationId", "ZoneAlias.VisualizationId"].sort(),
    );
    expect(evidence.entries).toHaveLength(2);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "clamp")).toBe(true);

    for (const entry of issue366) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -1,
          max: 255,
          unit: "visualization id",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("Zone.N.VisualizationId")?.valueMetadata?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
    });
    expect(byPath.get("ZoneAlias.VisualizationId")?.valueMetadata?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
    });

    for (const path of [
      "Zone.N.ProjectorIndex",
      "ZoneAlias.ProjectorIndex",
      "Zone.N.Mesh.NodeX",
      "ZoneAlias.Mesh.NodeX",
      "Zone.N.FX7",
      "ZoneAlias.FX7",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 366 Zone Preview and Ratio signed32 rows after integer boundary evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        evidenceLevel: string;
        baseline: { typeTag: string };
        testedValues: Array<{ input: number; readback: number; behavior: string }>;
      }>;
    }>("object-range-evidence/issue-366-zone-preview-ratio-signed32-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-15 issue #366 confirmed ";
    const issue366 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const expectedPaths = new Set([
      "Zone.N.Preview.AsBeams",
      "Zone.N.Preview.BeamDiameter",
      "Zone.N.Preview.ColorOverride",
      "Zone.N.Preview.FogFrontBrightness",
      "Zone.N.Preview.FogRearBrightness",
      "Zone.N.Preview.GauzeSizeX",
      "Zone.N.Preview.MirrorXProjector",
      "Zone.N.Preview.MirroXOutput",
      "Zone.N.Preview.TextureIntencity",
      "Zone.N.Preview.TextureScrollSpeed",
      "Zone.N.RatioX",
      "Zone.N.RatioY",
      "ZoneAlias.Preview.AsBeams",
      "ZoneAlias.Preview.BeamDiameter",
      "ZoneAlias.Preview.ColorOverride",
      "ZoneAlias.Preview.FogFrontBrightness",
      "ZoneAlias.Preview.FogRearBrightness",
      "ZoneAlias.Preview.GauzeSizeX",
      "ZoneAlias.Preview.MirrorXProjector",
      "ZoneAlias.Preview.MirroXOutput",
      "ZoneAlias.Preview.TextureIntencity",
      "ZoneAlias.Preview.TextureScrollSpeed",
      "ZoneAlias.RatioX",
      "ZoneAlias.RatioY",
    ]);

    expect(issue366).toHaveLength(24);
    expect(new Set(issue366.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(24);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.evidenceLevel === "observed")).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "wrap")).toBe(true);
    expect(evidence.entries.every((entry) => entry.baseline.typeTag === "i")).toBe(true);

    for (const entry of evidence.entries) {
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: -2147483649, readback: 2147483647, behavior: "wrap" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: -2147483648, readback: -2147483648, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 2147483647, readback: 2147483647, behavior: "pass-through" }),
      );
      expect(entry.testedValues).toContainEqual(
        expect.objectContaining({ input: 2147483648, readback: -2147483648, behavior: "wrap" }),
      );
    }

    for (const entry of issue366) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "integer",
        evidenceLevel: "observed",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          unit: "raw signed 32-bit integer",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
    }

    expect(byPath.get("Zone.N.RatioX")?.valueMetadata?.locationContext).toMatchObject({
      kind: "indexed-root",
      populationDependent: true,
    });
    expect(byPath.get("ZoneAlias.RatioX")?.valueMetadata?.locationContext).toMatchObject({
      kind: "showfile-alias",
      populationDependent: true,
    });

    for (const path of [
      "Zone.N.Preview.PositionX",
      "Zone.N.Preview.SizeX",
      "ZoneAlias.Preview.PositionX",
      "ZoneAlias.Preview.SizeX",
      "Zone.N.UGC.BowX",
      "ZoneAlias.UGC.PositionX",
      "Zone.N.Effect.N.Keys.X",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes, path).toContain("issue #486");
      expect(byPath.get(path)?.valueMetadata?.valueRange, path).toMatchObject({
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      });
    }
  });

  it("ships issue 360 ZoneAlias boolean accepted values only with verified domains", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        shipsMetadata: boolean;
        boundaryBehavior?: string;
        acceptedValues?: Array<{ value: number; label: string }>;
      }>;
    }>("object-range-evidence/issue-360-zonealias-boolean-controls.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime command-write/readback on 2026-05-14 issue #360 confirmed ";
    const expectedPaths = new Set(["ZoneAlias.Active", "ZoneAlias.BlockZone", "ZoneAlias.Mute", "ZoneAlias.Visible"]);
    const issue360 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));

    expect(issue360).toHaveLength(4);
    expect(new Set(issue360.map((entry) => entry.path))).toEqual(expectedPaths);
    expect(evidence.entries).toHaveLength(4);
    expect(evidence.entries.every((entry) => entry.shipsMetadata)).toBe(true);
    expect(evidence.entries.every((entry) => entry.boundaryBehavior === "unknown")).toBe(true);
    expect(
      evidence.entries.every((entry) =>
        [0, 1].every((value) => entry.acceptedValues?.some((acceptedValue) => acceptedValue.value === value)),
      ),
    ).toBe(true);

    for (const path of expectedPaths) {
      const metadata = byPath.get(path)?.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueType).toBe("boolean");
      expect(metadata.valueRange).toMatchObject({
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      });
      expect(metadata.acceptedValues).toEqual([
        expect.objectContaining({ value: 0, label: "OFF" }),
        expect.objectContaining({ value: 1, label: "ON" }),
      ]);
      expect(metadata.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }
  });

  it("ships directly observed Universe Image1 ranges without control propagation", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directUniverse = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Universe" &&
        entry.valueMetadata?.notes?.startsWith(
          "Runtime object write/readback on 2026-05-12 confirmed baseline restore on concrete Universe.0.Image1.",
        ),
    );

    expect(directUniverse).toHaveLength(3);
    for (const entry of directUniverse) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "indexed-root",
        populationDependent: true,
        indexBasis: "Universe.N uses the zero-based Object Tree Universe page index.",
      });
    }

    expect(byPath.get("Universe.N.Image1.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "control value",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Image1.Visible")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(byPath.get("Universe.N.Image1.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Universe.N.Image1.ColorActive")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -2147483648,
        max: 2147483647,
        boundaryBehavior: "pass-through",
      },
    });
    expect(byPath.get("Universe.N.Image1.ColorOff")?.valueMetadata).toBeUndefined();
  });

  it("generates Universe ZonePad2 by-name component paths from the ZonePad1 tree", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        variants: Array<{ path: string; osc?: string }>;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const zonePad1Suffixes = objectPropertyIndex.entries
      .filter((entry) => entry.path.startsWith("Universe.N.ZonePad1."))
      .map((entry) => entry.path.slice("Universe.N.ZonePad1.".length))
      .sort();
    const zonePad2Suffixes = objectPropertyIndex.entries
      .filter((entry) => entry.path.startsWith("Universe.N.ZonePad2."))
      .map((entry) => entry.path.slice("Universe.N.ZonePad2.".length))
      .sort();

    expect(zonePad1Suffixes).toHaveLength(222);
    expect(zonePad2Suffixes).toEqual(zonePad1Suffixes);
    expect(byPath.get("Universe.N.ZonePad2.Selected")?.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "Universe.0.ZonePad2.Selected",
          osc: "/b/Universe/0/ZonePad2/Selected",
        }),
      ]),
    );
    expect(byPath.get("Universe.N.ZonePad2.Zone.Active")).toBeDefined();
    expect(byPath.get("Universe.N.ZonePad2.Zone.Active")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.N.Zone.Active")?.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "Universe.0.23.Zone.Active",
          osc: "/b/Universe/0/23/Zone/Active",
        }),
      ]),
    );
  });

  it("ships issue 296 Universe common control ranges for the loaded show controls", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commonLeaves = new Set(["Selected", "Value", "Visible", "X", "Y"]);
    const issue296 = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.valueMetadata?.notes?.includes(" issue #296 confirmed ") &&
        commonLeaves.has(entry.property.split(".").at(-1) ?? entry.property),
    );
    const actualCounts = new Map<string, number>();
    for (const entry of issue296) {
      const leaf = entry.property.split(".").at(-1) ?? entry.property;
      actualCounts.set(leaf, (actualCounts.get(leaf) ?? 0) + 1);
    }

    expect(issue296).toHaveLength(122);
    expect(actualCounts).toEqual(
      new Map([
        ["Selected", 24],
        ["Value", 24],
        ["Visible", 24],
        ["X", 25],
        ["Y", 25],
      ]),
    );
    for (const entry of issue296) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "Universe.N uses the zero-based Universe page index, while control names depend on the loaded show.",
      });
    }

    expect(byPath.get("Universe.N.Button1.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized position",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Button1.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.Button1.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(byPath.get("Universe.N.ZonePad2.X")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        unit: "normalized position",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    expect(
      byPath.get("Universe.N.N.Zone.Visible")?.valueMetadata?.notes?.includes(" issue #296 confirmed ") ?? false,
    ).toBe(false);
    expect(byPath.get("Universe.N.ZonePad2.Zone.Visible")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Button1.ColorOff")?.valueMetadata).toBeUndefined();
  });

  it("ships issue 296 Universe effect and string ranges from concrete show controls", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        property: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const commonLeaves = new Set(["Selected", "Value", "Visible", "X", "Y"]);
    const issue296 = objectPropertyIndex.entries.filter(
      (entry) =>
        entry.root === "Universe" &&
        entry.valueMetadata?.notes?.includes(" issue #296 confirmed ") &&
        !commonLeaves.has(entry.property.split(".").at(-1) ?? entry.property),
    );
    const actualCounts = new Map<string, number>();
    for (const entry of issue296) {
      const bucket = entry.property.endsWith("Effect.Name")
        ? "Effect.Name"
        : entry.property.endsWith("Caption")
          ? "Caption"
          : (entry.property.split(".").at(-1) ?? entry.property);
      actualCounts.set(bucket, (actualCounts.get(bucket) ?? 0) + 1);
    }

    expect(issue296).toHaveLength(81);
    expect(actualCounts).toEqual(
      new Map([
        ["Caption", 25],
        ["ChasePeriod", 7],
        ["ClockLimit", 7],
        ["ClockShift", 7],
        ["Effect.Name", 7],
        ["EnableClockLimit", 7],
        ["EnableMetroLimit", 7],
        ["MetroLimit", 7],
        ["MetroShift", 7],
      ]),
    );
    for (const entry of issue296) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(hasManualReadyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata)).toBe(true);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
        indexBasis:
          "Universe.N uses the zero-based Universe page index, while control names depend on the loaded show.",
      });
    }

    expect(byPath.get("Universe.N.Button1.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Universe.N.ZonePad2.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Universe.N.DropEff1.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        unit: "chase period",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("Universe.N.DropEff1.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
    });
    for (const path of [
      "Universe.N.Button1.ColorOff",
      "Universe.N.N.Zone.Effect.ChasePeriod",
      "Universe.N.N.Zone.Name",
      "Universe.N.ZonePad1.Zone.Name",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships issue 317 remaining string control ranges from direct probes", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Runtime object write/readback on 2026-05-13 issue #317 confirmed ";
    const globals = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const contexts = objectPropertyIndex.entries.flatMap((entry) =>
      (entry.contextValueMetadata ?? [])
        .filter((metadata) => metadata.notes?.startsWith(issuePrefix))
        .map((metadata) => ({ path: entry.path, metadata })),
    );

    expect(globals).toHaveLength(10);
    expect(contexts).toHaveLength(61);
    expect(contexts.filter((entry) => entry.path === "FX.N.N.Name")).toHaveLength(60);
    expect(
      contexts.some((entry) => entry.path === "WS.N.N.Image.Text" && entry.metadata.contextId === "cue-type:text"),
    ).toBe(true);

    for (const metadata of [
      ...globals.map((entry) => entry.valueMetadata as ObjectPropertyValueMetadata),
      ...contexts.map((entry) => entry.metadata),
    ]) {
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata)).toBe(true);
      expect(metadata).toMatchObject({
        valueType: "string",
        evidenceLevel: "observed",
        valueRange: {
          min: 0,
          max: 254,
          unit: "characters",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(metadata.defaultValue).toBeUndefined();
    }

    expect(byPath.get("FX.N.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("FX.N.N.Name")?.contextValueMetadata?.[0]).toMatchObject({
      contextId: "quickfx-cell:fx-0-0",
      locationContext: {
        kind: "quickfx-slot",
        populationDependent: true,
      },
    });
    expect(byPath.get("QShift.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("Projector.N.Name")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "hardware-instance",
      },
    });
    expect(byPath.get("ActGridFocusedCue.Caption")?.valueMetadata).toMatchObject({
      locationContext: {
        kind: "showfile-alias",
      },
    });
    expect(
      byPath.get("WS.N.N.Image.Text")?.contextValueMetadata?.find((metadata) => metadata.contextId === "cue-type:text"),
    ).toMatchObject({
      locationContext: {
        kind: "workspace-slot",
      },
    });

    for (const path of [
      "Beam.N.Name",
      "ProTrack2.Caption",
      "Universe.N.Button1.ColorOff",
      "Zone.N.Name",
      "ZoneAlias.Name",
    ]) {
      expect(byPath.get(path)?.valueMetadata, path).toBeUndefined();
    }
  });

  it("ships directly observed UniversePanelAlias ranges", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        valueMetadata?: ObjectPropertyValueMetadata;
      }>;
    }>("object-property-index.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const directAliases = objectPropertyIndex.entries.filter(
      (entry) => entry.root === "UniversePanelAlias" && entry.valueMetadata,
    );

    expect(directAliases.map((entry) => entry.path).sort()).toEqual([
      "UniversePanelAlias.Control.Caption",
      "UniversePanelAlias.Control.CenterX",
      "UniversePanelAlias.Control.CenterY",
      "UniversePanelAlias.Control.ColorActive",
      "UniversePanelAlias.Control.ColorOn",
      "UniversePanelAlias.Control.DropDuration",
      "UniversePanelAlias.Control.Effect.ChasePeriod",
      "UniversePanelAlias.Control.Effect.ClockLimit",
      "UniversePanelAlias.Control.Effect.ClockShift",
      "UniversePanelAlias.Control.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.Effect.EnableMetroLimit",
      "UniversePanelAlias.Control.Effect.MetroLimit",
      "UniversePanelAlias.Control.Effect.MetroShift",
      "UniversePanelAlias.Control.Effect.Name",
      "UniversePanelAlias.Control.MaxValue",
      "UniversePanelAlias.Control.MinValue",
      "UniversePanelAlias.Control.N.Caption",
      "UniversePanelAlias.Control.N.Effect.ChasePeriod",
      "UniversePanelAlias.Control.N.Effect.ClockLimit",
      "UniversePanelAlias.Control.N.Effect.ClockShift",
      "UniversePanelAlias.Control.N.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.N.Effect.EnableMetroLimit",
      "UniversePanelAlias.Control.N.Effect.MetroLimit",
      "UniversePanelAlias.Control.N.Effect.MetroShift",
      "UniversePanelAlias.Control.N.Effect.Name",
      "UniversePanelAlias.Control.Radius",
      "UniversePanelAlias.Control.Selected",
      "UniversePanelAlias.Control.Tag",
      "UniversePanelAlias.Control.TimeShift",
      "UniversePanelAlias.Control.Value",
      "UniversePanelAlias.Control.Visible",
      "UniversePanelAlias.Control.X",
      "UniversePanelAlias.Control.Y",
    ]);
    for (const entry of directAliases) {
      assertObjectPropertyValueMetadata(entry.valueMetadata as ObjectPropertyValueMetadata);
      expect(entry.valueMetadata?.evidenceLevel).toBe("observed");
      expect(entry.valueMetadata?.defaultValue).toBeUndefined();
      expect(entry.valueMetadata?.locationContext).toMatchObject({
        kind: "showfile-alias",
        populationDependent: true,
      });
    }

    expect(byPath.get("UniversePanelAlias.Control.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        boundaryBehavior: "clamp",
      },
    });
    for (const path of [
      "UniversePanelAlias.Control.Effect.ClockLimit",
      "UniversePanelAlias.Control.Effect.MetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.Effect.ClockShift",
      "UniversePanelAlias.Control.Effect.MetroShift",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.Effect.EnableMetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.Effect.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Caption")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ChasePeriod")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 1,
        max: 10,
        boundaryBehavior: "clamp",
      },
      locationContext: {
        indexBasis:
          "UniversePanelAlias.Control.N collapses a show-defined Universe panel alias, zero-based control index, and property path.",
      },
    });
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.ClockLimit",
      "UniversePanelAlias.Control.N.Effect.MetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.ClockShift",
      "UniversePanelAlias.Control.N.Effect.MetroShift",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: -10,
          max: 10,
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of [
      "UniversePanelAlias.Control.N.Effect.EnableClockLimit",
      "UniversePanelAlias.Control.N.Effect.EnableMetroLimit",
    ]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "boolean",
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "clamp",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Selected")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Value")?.valueMetadata).toMatchObject({
      valueType: "number",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("UniversePanelAlias.Control.Visible")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "unknown",
      },
    });
    for (const path of ["UniversePanelAlias.Control.X", "UniversePanelAlias.Control.Y"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "number",
        valueRange: {
          min: 0,
          max: 1,
          unit: "normalized position",
          boundaryBehavior: "clamp",
        },
      });
    }
    for (const path of ["UniversePanelAlias.Control.ColorActive", "UniversePanelAlias.Control.ColorOn"]) {
      expect(byPath.get(path)?.valueMetadata).toMatchObject({
        valueType: "integer",
        valueRange: {
          min: -2147483648,
          max: 2147483647,
          boundaryBehavior: "pass-through",
        },
      });
    }
    expect(byPath.get("UniversePanelAlias.Control.ColorOff")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ChaseTimeMode")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.Zone")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.N.Effect.ZoneMode")?.valueMetadata).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.Zone.Active")?.valueMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Image1.Value")?.valueMetadata).toBeDefined();
  });

  it("keeps shipped public artifacts free of private lab identifiers", () => {
    const artifacts = [
      "README.md",
      "CHANGELOG.md",
      "package.json",
      "data/pangoscript/commands.generated.json",
      "data/pangoscript/commands.overlay.json",
      "data/pangoscript/commands.merged.json",
      "data/pangoscript/command-property-coverage.json",
      "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
      "data/pangoscript/object-tree/evidence/readback.schema.json",
      "data/pangoscript/object-tree/evidence/readback/issue-407-zone-count-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-410-zone-effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-412-zone-name-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-414-zone-direct-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-416-zone-remaining-nested-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-common-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-zone-nested-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-297-universe-panel-alias-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-319-fx-identifier-safe-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-425-qshift-a-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-427-qshift-b-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-429-qshift-direct-readbacks.json",
      "data/pangoscript/object-tree/audits/readback/issue-216-readback-write-audit.json",
      "data/pangoscript/object-tree/audits/behavior/issue-216-object-behavior-audit.json",
      "data/pangoscript/object-tree/audits/data-quality/final-object-data-quality-audit.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-panel-alias-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-zone-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-zone-zonealias-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-fx-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-universe-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-ws-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-499-gamepad-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-501-beam-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-503-small-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-513-fx-readback-retest.json",
      "data/pangoscript/object-tree/evidence/behavior/issue-513-fx-readback-retest.json",
      "data/pangoscript/object-tree/evidence/value.schema.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-act-grid-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-final-gaps.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-fx-readback-write-audit.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-grid1-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-grid2-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-master-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-protrack-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-sampled-audit.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-touchpoints-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-beam-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-fb-hardware-controls.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-status-memory-and-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-299-gamepad-axis-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-299-mobsensor-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-445-ws-image-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-447-ws-ani0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-449-ws-image0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-451-ws-synthesized-image-list0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-453-ws-common-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-455-ws-image-effect-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-457-ws-particles-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-459-ws-image-gap-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-a-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-b-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-direct-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-common-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-panel-alias-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-zone-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-zone-zonealias-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-513-fx-readback-retest-ranges.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/fx/issue-513-readback-retest-pass-through.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata.schema.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/common-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/zone-nested-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe-panel-alias/typed-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/fx/identifier-safe-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/final-gaps/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/act-grid-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/grid1-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/grid2-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/master/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/protrack/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/qshift/a-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/qshift/b-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image0-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image-effect-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image-gap-noop-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/synthesized-image-list0-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/top-level-common-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/input/gamepad-axis-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/hardware/beam-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/hardware/status-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/count-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/direct-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/name-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/remaining-nested-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/root.json",
      "data/pangoscript/object-tree/source-facts/value-metadata.schema.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/final-gaps/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/fx/readback-write-audit-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/beam-leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/fb-hardware-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/status-memory-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/input/mobsensor-leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/master/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/qshift/direct-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/touchpoints/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/universe/common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/universe-panel-alias/common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/zone/readback-retest-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/zone-alias/readback-retest-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/ani0-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image-gap-sampled-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image0-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/synthesized-image-list0-write-remediation-controls.json",
      "docs/manual.html",
      "docs/references/diagnostics/README.md",
      "docs/references/operators.md",
      "docs/references/syntax.md",
      "docs/references/beyond/pangoscript/master-object-tree.md",
      "docs/references/beyond/pangoscript/object-model.md",
      ...readdirSync(path.join(process.cwd(), "docs", "references", "beyond", "pangoscript", "command-reference"))
        .filter((fileName) => fileName.endsWith(".md"))
        .map((fileName) => path.join("docs", "references", "beyond", "pangoscript", "command-reference", fileName)),
    ];

    const leaks = artifacts.flatMap((artifact) => {
      const contents = readFileSync(path.join(process.cwd(), artifact), "utf8");
      return findPublicArtifactLeaks(contents).map((leak) => `${artifact}: ${leak.label} (${leak.match})`);
    });

    expect(leaks).toEqual([]);
  }, 120_000);

  it("detects private artifact classes without concrete lab fixtures", () => {
    const privateHost = [10, 1, 2, 3].join(".");
    const regexEscapedPrivateHost = privateHost.replaceAll(".", String.raw`\.`);
    const jsonEscapedPrivateHost = regexEscapedPrivateHost.replaceAll("\\", String.raw`\\`);
    const hardwareRoot = ["F", "B", "4"].join("");
    const hardwareDigits = [1, 2, 3, 4, 5].join("");
    const sourcePortValue = [4, 5, 6, 7, 8].join("");
    const highPortValue = [5, 6, 7, 8, 9].join("");
    const commandBuildExportLabel = `${["build", "2044"].join("-")} export`;
    const sparseEntryLabel = ["bare", "entry"].join(" ");
    const pairingPort = [8, 1, 2, 3].join("");
    const appPairingPort = [9, 8, 7, 6].join("");
    const appVersion = [1, 2, 3, 4].join(".");
    const leakSamples = [
      `BEYOND host ${privateHost}`,
      `pattern: /\\b${regexEscapedPrivateHost}\\b/`,
      `"pattern": "\\\\b${jsonEscapedPrivateHost}\\\\b"`,
      `controller ${hardwareRoot}_${hardwareDigits} connected`,
      `hardware serial ${hardwareDigits}`,
      `ClientHardwareSerial = ${hardwareDigits}`,
      `hardwareSerial = ${hardwareDigits}`,
      `mobile-device source port ${sourcePortValue}`,
      `source port ${sourcePortValue}`,
      `"sourcePort": ${sourcePortValue}`,
      `"port": ${highPortValue}`,
      `port ${highPortValue}`,
      `Appears as a ${sparseEntryLabel} in the ${commandBuildExportLabel} (line 423: \`PlayTimeline|PlayTimeline\`)`,
      `Cataloged in the ${commandBuildExportLabel} (line 515: ${sparseEntryLabel} \`Restart|Restart\` entry)`,
      `endpoint :${pairingPort}`,
      `endpoint:${pairingPort}`,
      `example.com:${pairingPort}`,
      `laserbox:${pairingPort}`,
      `"laserbox:${pairingPort}"`,
      `"endpoint":${pairingPort}`,
      `"laserbox":${pairingPort}`,
      `port-${pairingPort}`,
      `mobile app version ${appVersion}`,
      `mobile app pairing endpoint port ${appPairingPort}`,
    ];

    for (const sample of leakSamples) {
      expect(findPublicArtifactLeaks(sample), sample).not.toEqual([]);
    }
  });

  it("keeps the public artifact leak policy free of private artifact classes", () => {
    const policySource = readFileSync(path.join(process.cwd(), "scripts", "publicArtifactPolicy.ts"), "utf8");

    expect(findPublicArtifactLeaks(policySource)).toEqual([]);
  });

  it("allows object readback numeric values that look like pairing ports", () => {
    expect(findPublicArtifactLeaks('{"observedValue":8191.75}')).toEqual([]);
    expect(findPublicArtifactLeaks('{"readValue":8123}')).toEqual([]);
    expect(findPublicArtifactLeaks("observedValue:8191.75")).toEqual([]);
    expect(findPublicArtifactLeaks("readValue:8123")).toEqual([]);
  });

  it("keeps generated and merged command counts aligned", () => {
    const generated = readJson<PangoKnowledgeBase>("commands.generated.json");
    const overlay = readJson<PangoKnowledgeBase>("commands.overlay.json");
    const checkedInMerged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const rebuiltMerged = mergeKnowledgeBase(generated, overlay);

    // Apply category resolution so rebuiltMerged matches the checked-in file,
    // which has categories populated by the build script.
    const tree = loadCategoryTree(path.join(dataDir, "beyond-category-tree.json"));
    const treeMap = resolveCategoryMap(tree);
    const overlayCategories = overlayCategoriesByCanonical(overlay);
    for (const entry of Object.values(rebuiltMerged.commands)) {
      const overlayCategory = overlayCategories[entry.canonical];
      const resolved = resolveCommandCategory(entry.canonical, overlayCategory, treeMap);
      if (resolved.category) entry.category = resolved.category;
    }

    // generated/ comes from the upstream BEYOND command export (521 commands).
    // merged/ adds overlay-only commands documented after that export:
    // currently 8 prototype/
    // internal entries (Chat, LoadCueFromBlob, LoadZoneFromBlob, Pub,
    // PubObject, SubCmd, SubJson, SubProp).
    expect(Object.keys(generated.commands)).toHaveLength(521);
    expect(Object.keys(checkedInMerged.commands).length).toBeGreaterThanOrEqual(521);
    expect(checkedInMerged.commands.OscOutTTS.confidence).toBe("high");
    const waitForBeat = checkedInMerged.commands.WaitForBeat;
    expect(waitForBeat.forms?.map((form) => form.signature)).toContain("WaitForBeat <beatMask>, <count>");
    expect(waitForBeat.forms?.[0]?.parameters?.[0]).toMatchObject({
      name: "beatMask",
      description: expect.stringContaining("1 = timer beat"),
    });
    expect(checkedInMerged).toEqual(rebuiltMerged);
  });

  it("keeps release-blocking catalog metadata gaps at zero", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const report = analyzeCatalogGaps({ knowledgeBase: merged, usages: new Map(), corpusFileCount: 0 });

    expect(report.summary.emptyDescriptions.total).toBe(0);
    expect(report.summary.missingParameters.total).toBe(0);
    expect(report.summary.terseDescriptions.total).toBe(0);
    expect(report.summary.unknownSafety.total).toBe(0);
  });

  it("ships a command property mapping coverage ledger for every command", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const ledger = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const commandNames = Object.keys(merged.commands).sort();

    expect(ledger.schemaVersion).toBe(1);
    expect(ledger.summary.total).toBe(529);
    expect(ledger.summary.total).toBe(commandNames.length);
    expect(
      ledger.summary.mapped + ledger.summary.noDirectProperty + ledger.summary.deferred + ledger.summary.unknown,
    ).toBe(ledger.summary.total);
    expect(Object.keys(ledger.commands).sort()).toEqual(commandNames);

    const mappedCount = Object.values(merged.commands).filter(
      (command) => (command.setsProperty?.length ?? 0) > 0,
    ).length;
    expect(ledger.summary.mapped).toBe(mappedCount);
    expect(ledger.commands.PositionIndex).toMatchObject({
      canonical: "PositionIndex",
      status: "mapped",
      setsProperty: ["Master.PositionX", "Master.PositionY", "Master.PositionZ"],
    });
    expect(ledger.commands.BlackOut).toMatchObject({
      canonical: "BlackOut",
      status: "no-direct-property",
    });
    expect(ledger.summary.unknown).toBe(0);
  });

  it("ships curated PreviewAsUninverse metadata from the command reference", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const command = merged.commands.PreviewAsUninverse;

    expect(command?.description).toContain("Universe page in the Main Preview panel");
    expect(command?.safetyTier).toBe("T1");
    expect(command?.forms?.[0]).toMatchObject({
      signature: "PreviewAsUninverse 1",
      description: expect.stringContaining("display the Universe page"),
      parameters: [
        {
          name: "state",
          type: "integer",
          required: true,
          range: "0..1",
        },
      ],
    });
  });

  it("ships issue 334 context-complete WS and FX promotions from complete concrete evidence", () => {
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        root: string;
        variants?: Array<{ path: string }>;
        valueMetadata?: ObjectPropertyValueMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
      }>;
    }>("object-property-index.json");
    const evidence = readJson<{
      entries: Array<{
        objectPath: string;
        probePath: string;
        shipsMetadata: boolean;
        evidenceLevel: string;
      }>;
    }>("object-range-evidence/issue-334-context-complete-ws-fx-promotions.json");
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));
    const issuePrefix = "Checked-in runtime write/readback evidence for issue #334 promoted ";
    const issue334 = objectPropertyIndex.entries.filter((entry) => entry.valueMetadata?.notes?.startsWith(issuePrefix));
    const countsByRoot = new Map<string, number>();
    for (const entry of issue334) countsByRoot.set(entry.root, (countsByRoot.get(entry.root) ?? 0) + 1);

    expect(issue334).toHaveLength(127);
    expect(countsByRoot).toEqual(
      new Map([
        ["FX", 11],
        ["WS", 116],
      ]),
    );
    expect(evidence.entries).toHaveLength(2718);
    expect(new Set(evidence.entries.map((entry) => entry.objectPath))).toEqual(
      new Set(issue334.map((entry) => entry.path)),
    );
    expect(evidence.entries.every((entry) => entry.shipsMetadata && entry.evidenceLevel === "observed")).toBe(true);

    for (const entry of issue334) {
      const metadata = entry.valueMetadata as ObjectPropertyValueMetadata;
      assertObjectPropertyValueMetadata(metadata);
      expect(hasManualReadyValueMetadata(metadata), entry.path).toBe(true);
      expect(metadata.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.evidenceLevel).toBe("observed");
      expect(metadata.valueRange?.boundaryBehavior, entry.path).not.toBe("unknown");
      expect(metadata.defaultValue, entry.path).toBeUndefined();
      expect(metadata.locationContext).toMatchObject({
        kind: entry.root === "WS" ? "workspace-slot" : "quickfx-slot",
        populationDependent: true,
      });
      expect(entry.contextValueMetadata?.length, entry.path).toBe(entry.variants?.length);
    }

    expect(byPath.get("WS.N.N.FX1")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: -1,
        max: 99,
        unit: "effect slot",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.ClickMode")?.valueMetadata).toMatchObject({
      valueType: "integer",
      valueRange: {
        min: 0,
        max: 4,
        unit: "click mode",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Effect.EnableClockLimit")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        unit: "boolean",
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("WS.N.N.Image.Text")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
      locationContext: {
        kind: "workspace-slot",
      },
    });
    expect(byPath.get("FX.N.N.N.TimeActive")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      acceptedValues: [
        { value: 0, label: "Inactive" },
        { value: 1, label: "Active" },
      ],
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.N.Oscillator.Absinvert")?.valueMetadata).toMatchObject({
      valueType: "boolean",
      valueRange: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
      },
    });
    expect(byPath.get("FX.N.N.Name")?.valueMetadata).toMatchObject({
      valueType: "string",
      valueRange: {
        min: 0,
        max: 254,
        unit: "characters",
        boundaryBehavior: "no-op",
      },
    });

    for (const path of [
      "FX.N.N.N.Enabled",
      "FX.N.N.N.TimeEnabled",
      "FX.N.N.N.Oscillator.Finish",
      "FX.N.N.N.Oscillator.Period",
      "FX.N.N.N.Oscillator.Start",
      "FX.N.N.N.Oscillator.Waveform",
      "WS.N.N.ColorSlider",
      "WS.N.N.FX7",
      "WS.N.N.FX8",
      "WS.N.N.Hue",
      "WS.N.N.VisiblePointsEnd",
    ]) {
      expect(byPath.get(path)?.valueMetadata?.notes?.startsWith(issuePrefix) ?? false, path).toBe(false);
    }
  });

  it("ships live-probed BPM command range metadata with clamp semantics", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const valueParam = findParam("SetBpm", "SetBpm <value>", "value");
    const deltaParam = findParam("SetBpmDelta", "SetBpmDelta <delta>", "delta");

    expect(valueParam).toMatchObject({
      range: "1..600",
      valueRange: {
        min: 1,
        max: 600,
        unit: "bpm",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(deltaParam).toMatchObject({
      range: "relative; result clamps to 1..600",
      valueRange: {
        unit: "bpm delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master brightness range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const brightnessParam = findParam("Brightness", "Brightness <value>", "value");
    const brightnessDeltaParam = findParam("BrightnessDelta", "BrightnessDelta <delta>", "delta");
    const showBrightnessParam = findParam("MasterShowBrightness", "MasterShowBrightness <value>", "value");

    expect(brightnessParam).toMatchObject({
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(brightnessDeltaParam).toMatchObject({
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(showBrightnessParam).toMatchObject({
      range: "nominal 0..100; runtime pass-through observed through -1000..1000000",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("2026-05-12");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("-1000");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("1000000");
    expect(String(showBrightnessParam?.valueRange?.notes)).toContain("differs from Brightness");
  });

  it("ships live-probed rotation angle range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;
    const cases = ["AngleX", "AngleY", "AngleZ"] as const;

    for (const commandName of cases) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-2880..2880",
        valueRange: {
          min: -2880,
          max: 2880,
          unit: "degrees",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const paramName of ["x", "y", "z"]) {
      expect(findParam("Angle", "Angle <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "-2880..2880",
        valueRange: {
          min: -2880,
          max: 2880,
          unit: "degrees",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("AngleDelta", "AngleDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result wraps modulo 2880",
        valueRange: {
          unit: "degrees delta",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
    }
  });

  it("ships live-probed rotation speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const paramName of ["x", "y", "z"]) {
      expect(findParam("RotoSpeed", "RotoSpeed <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "-1440..1440",
        valueRange: {
          min: -1440,
          max: 1440,
          unit: "rotation speed",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("RotoSpeedDelta", "RotoSpeedDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; resulting speed clamps to -1440..1440",
        valueRange: {
          unit: "rotation speed delta",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, property] of [
      ["RotoSpeedX", "Master.RotoSpeedX"],
      ["RotoSpeedY", "Master.RotoSpeedY"],
      ["RotoSpeedZ", "Master.RotoSpeedZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-1440..1440",
        valueRange: {
          min: -1440,
          max: 1440,
          unit: "rotation speed",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }
  });

  it("ships live-probed position and size range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["x", "y", "z"]) {
      const positionParam = findParam("Position", "Position <x>, <y>, <z>", paramName);
      expect(positionParam).toMatchObject({
        type: "number",
        range: "documented -400..400; runtime stores through +/-400.01220703125",
        valueRange: {
          min: -400.01220703125,
          max: 400.01220703125,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(String(positionParam?.valueRange?.notes)).toContain("400.01220703125");
      expect(String(positionParam?.valueRange?.notes)).toContain("not an asymptotic curve");
      expect(String(positionParam?.valueRange?.notes)).toContain("lint acceptance");
      expect(findParam("PositionDelta", "PositionDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result clamps to -400..400",
        valueRange: {
          unit: "percent delta",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("Size", "Size <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "0..400",
        valueRange: {
          max: 400,
          unit: "percent",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(findParam("SizeDelta", "SizeDelta <x>, <y>, <z>", paramName)).toMatchObject({
        type: "number",
        range: "relative; result clamps above 400, negatives pass through",
        valueRange: {
          unit: "percent delta",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, property] of [
      ["PositionX", "Master.PositionX"],
      ["PositionY", "Master.PositionY"],
      ["PositionZ", "Master.PositionZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "-400..400",
        valueRange: {
          min: -400,
          max: 400,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }

    for (const [commandName, property] of [
      ["SizeX", "Master.SizeX"],
      ["SizeY", "Master.SizeY"],
      ["SizeZ", "Master.SizeZ"],
    ] as const) {
      expect(findParam(commandName, `${commandName} <value>`, "value")).toMatchObject({
        type: "number",
        range: "nominal 0..400; values above 400 clamp, negatives pass through",
        valueRange: {
          max: 400,
          unit: "percent",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
          notes: expect.stringContaining(property),
        },
      });
    }

    for (const commandName of ["PositionIndex", "SizeIndex"] as const) {
      expect(findParam(commandName, `${commandName} <axis>, <value>`, "axis")).toMatchObject({
        type: "integer",
        range: "0..2",
        valueRange: {
          min: 0,
          max: 2,
          unit: "axis index",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 0, label: "X" },
          { value: 1, label: "Y" },
          { value: 2, label: "Z" },
        ],
      });
    }

    expect(findParam("PositionIndex", "PositionIndex <axis>, <value>", "value")).toMatchObject({
      type: "number",
      range: "-400..400",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("SizeIndex", "SizeIndex <axis>, <value>", "value")).toMatchObject({
      type: "number",
      range: "nominal 0..400; runtime stores -400..400",
      valueRange: {
        min: -400,
        max: 400,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    const sizeIndexValueParam = findParam("SizeIndex", "SizeIndex <axis>, <value>", "value");
    expect(String(sizeIndexValueParam?.valueRange?.notes)).toContain("-401 clamps to -400");
    expect(String(sizeIndexValueParam?.valueRange?.notes)).toContain("readback did not prove");
  });

  it("ships live-probed RGBA channel range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const signature of ["RGBA <r>, <g>, <b>, <a>", "RGBA <r>, <g>, <b>"]) {
      const paramNames = signature.endsWith("<a>") ? ["r", "g", "b", "a"] : ["r", "g", "b"];
      for (const paramName of paramNames) {
        expect(findParam("RGBA", signature, paramName)).toMatchObject({
          type: "integer",
          range: "0..255",
          valueRange: {
            min: 0,
            max: 255,
            unit: "8-bit channel",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
        });
      }
    }

    const channelValues = [
      { value: 0, label: "Red" },
      { value: 1, label: "Green" },
      { value: 2, label: "Blue" },
      { value: 3, label: "Alpha" },
    ];

    const rgbaIndexParam = findParam("RGBA", "RGBA <index>, <value>", "index");
    expect(rgbaIndexParam).toMatchObject({
      type: "integer",
      range: "0..3",
      valueRange: {
        min: 0,
        max: 3,
        unit: "RGBA channel index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
      acceptedValues: channelValues,
    });
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("RGBA 4,55 writes Red=55");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("RGBA 5,77");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("not a general wrap mapping");
    expect(String(rgbaIndexParam?.valueRange?.notes)).toContain("lint acceptance");
    expect(findParam("RGBA", "RGBA <index>, <value>", "value")).toMatchObject({
      type: "integer",
      range: "0..255",
      valueRange: {
        min: 0,
        max: 255,
        unit: "8-bit channel",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    for (const signature of ["RGBADelta <r>, <g>, <b>, <a>", "RGBADelta <r>, <g>, <b>"]) {
      const paramNames = signature.endsWith("<a>") ? ["r", "g", "b", "a"] : ["r", "g", "b"];
      for (const paramName of paramNames) {
        expect(findParam("RGBADelta", signature, paramName)).toMatchObject({
          type: "integer",
          valueRange: {
            unit: "channel delta",
            boundaryBehavior: "clamp",
            evidenceLevel: "observed",
          },
        });
      }
    }

    const rgbaDeltaIndexParam = findParam("RGBADelta", "RGBADelta <index>, <value>", "index");
    expect(rgbaDeltaIndexParam).toMatchObject({
      type: "integer",
      range: "0..3",
      valueRange: {
        min: 0,
        max: 3,
        unit: "RGBA channel index",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
      acceptedValues: channelValues,
    });
    expect(String(rgbaDeltaIndexParam?.valueRange?.notes)).toContain("RGBADelta 4,10");
    expect(String(rgbaDeltaIndexParam?.valueRange?.notes)).toContain("no observable channel change");
    expect(findParam("RGBADelta", "RGBADelta <index>, <value>", "value")).toMatchObject({
      type: "integer",
      valueRange: {
        unit: "channel delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed color slider and packed-color metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const colorSliderParam = findParam("ColorSlider", "ColorSlider <value>", "value");
    expect(colorSliderParam).toMatchObject({
      type: "number",
      range: "0..255",
      valueRange: {
        min: 0,
        max: 255,
        unit: "color slider",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("half values rounded to even");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("0.6 and 0.9 read back 1");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("255.5 read back 255");
    expect(String(colorSliderParam?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");

    expect(findParam("ColorSliderDelta", "ColorSliderDelta <delta>", "delta")).toMatchObject({
      type: "number",
      valueRange: {
        unit: "color slider delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("ColorOn", "ColorOn <enabled>", "enabled")).toMatchObject({
      type: "number",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
        { value: "OFF", label: "OFF" },
        { value: "ON", label: "ON" },
      ],
      valueRange: {
        unit: "enable threshold",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, description, firstProbeValue, secondProbeValue] of [
      ["ColorRGB", "low byte", "257 read Red=1", "0xFF0000FF read Red=255"],
      ["ColorBGR", "high RGB byte", "0x1FFFF read Red=1", "0xFF0000FF read Red=0"],
    ] as const) {
      const param = findParam(commandName, `${commandName} <packedColor>`, "packedColor");
      expect(param).toMatchObject({
        type: "integer",
        range: "0..16777215",
        valueRange: {
          min: 0,
          max: 16777215,
          unit: "24-bit packed color",
          boundaryBehavior: "wrap",
          evidenceLevel: "observed",
        },
      });
      expect(param?.description).toContain(description);
      expect(String(param?.valueRange?.notes)).toContain(firstProbeValue);
      expect(String(param?.valueRange?.notes)).toContain(secondProbeValue);
      expect(String(param?.valueRange?.notes)).toContain("byte masking");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");
    }
  });

  it("ships live-probed physics slider range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      ["SetAttractionSlider", "SetAttractionSlider <value>", 50, "51 or 100 clamp to 50"],
      ["SetFrictionSlider", "SetFrictionSlider <value>", 30, "31 or 100 clamp to 30"],
      ["SetMassSlider", "SetMassSlider <value>", 30, "31 or 100 clamp to 30"],
    ] as const;

    for (const [commandName, signature, max, maxEvidence] of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === "value") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range: `1..${max}`,
        valueRange: {
          min: 1,
          max,
          unit: "slider value",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain(maxEvidence);
      expect(String(param?.valueRange?.notes)).toContain("did not switch workspace or physics preset");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance was not used as runtime proof");
    }
  });

  it("ships live-probed audio gain and release range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const clampedCases = [
      ["SetAudioGain", "SetAudioGain <level>", "level", "1..15", 1, 15, "gain level"],
      ["SetAudioRelease", "SetAudioRelease <time>", "time", "0.1..99", 0.1, 99, "release time"],
    ] as const;

    for (const [commandName, signature, paramName, range, min, max, unit] of clampedCases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range,
        valueRange: {
          min,
          max,
          unit,
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    const passThroughCases = [
      [
        "SetAudioInGain",
        "SetAudioInGain <level>",
        "level",
        "normal-use 1..15; runtime pass-through observed through -1000..100000",
        "gain level",
      ],
      [
        "SetAudioInRelease",
        "SetAudioInRelease <time>",
        "time",
        "normal-use 1..99; runtime pass-through observed through -1000..100000",
        "release time",
      ],
    ] as const;

    for (const [commandName, signature, paramName, range, unit] of passThroughCases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range,
        valueRange: {
          unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
      expect(String(param?.valueRange?.notes)).toContain("100000");
      expect(String(param?.valueRange?.notes)).toContain("lint acceptance");
    }
  });

  it("ships live-probed master audio volume and mute metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    expect(findParam("MasterAudioVolume", "MasterAudioVolume <percent>", "percent")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "audio volume percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("MasterAudioVolumeMute", "MasterAudioVolumeMute <state>", "state")).toMatchObject({
      type: "integer",
      range: "0..2",
      acceptedValues: [
        { value: 0, label: "OFF" },
        { value: 1, label: "ON" },
        { value: 2, label: "TOGGLE" },
        { value: "OFF", label: "OFF" },
        { value: "ON", label: "ON" },
        { value: "TOGGLE", label: "TOGGLE" },
      ],
      valueRange: {
        min: 0,
        max: 2,
        unit: "mute state",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed visible points range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("VisiblePoints", "VisiblePoints <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "visible points percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("VisiblePointsDelta", "VisiblePointsDelta <delta>", "delta")).toMatchObject({
      type: "number",
      valueRange: {
        unit: "visible points delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed scan rate range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const scanRate = findParam("ScanRate", "ScanRate <value>", "value");
    expect(scanRate).toMatchObject({
      type: "number",
      range: "1..400",
      valueRange: {
        min: 1,
        max: 400,
        unit: "scan rate",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(scanRate?.valueRange?.notes)).toContain("2026-05-12");
    expect(String(scanRate?.valueRange?.notes)).toContain("1, 5, 10");
    expect(String(scanRate?.valueRange?.notes)).toContain("below the ScanRateDelta result floor");

    const scanRateDelta = findParam("ScanRateDelta", "ScanRateDelta <delta>", "delta");
    expect(scanRateDelta).toMatchObject({
      type: "number",
      range: "relative; result clamps to 25..200",
      valueRange: {
        unit: "scan rate delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("deltas -49, -50, and -51 all read back 25");
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("delta 1 read back 25 rather than 2");
    expect(String(scanRateDelta?.valueRange?.notes)).toContain("hardware dependence is not proven");
  });

  it("ships live-probed animation speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("AnimationSpeed", "AnimationSpeed <value>", "value")).toMatchObject({
      type: "number",
      range: "0..400",
      valueRange: {
        min: 0,
        max: 400,
        unit: "animation speed percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("AnimationSpeedDelta", "AnimationSpeedDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..400",
      valueRange: {
        unit: "animation speed delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed zoom range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("Zoom", "Zoom <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("ZoomDelta", "ZoomDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed strobe speed range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("StrobeSpeed", "StrobeSpeed <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "flickers per second",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("StrobeSpeedDelta", "StrobeSpeedDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "flickers per second delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master speed scalar range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const percentScaled = [
      ["MasterFXSpeed", "MasterFXSpeed <value>", "value", "Master.FXSpeed"],
      ["MasterCueSpeed", "MasterCueSpeed <value>", "value", "Master.CueSpeed"],
      ["MasterCueLcSpeed", "MasterCueLcSpeed <percent>", "percent", "Master.CueLcSpeed"],
      ["MasterLCSpeed", "MasterLCSpeed <value>", "value", "Master.LCSpeed"],
      ["MasterZoneFxSpeed", "MasterZoneFxSpeed <value>", "value", "Master.ZoneFxSpeed"],
    ] as const;

    for (const [commandName, signature, paramName, propertyPath] of percentScaled) {
      expect(merged.commands[commandName]?.setsProperty).toEqual([propertyPath]);
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range: "pass-through; input percent stores input / 100 at least -1..9999",
        valueRange: {
          unit: "percent input",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("MasterSpeed", "MasterSpeed <ratio>", "ratio")).toMatchObject({
      range: "no exposed readback effect observed for -1, 0, 50, 100, and 9999",
      valueRange: {
        unit: "documented ratio",
        boundaryBehavior: "no-op",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed master timing shift range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature, paramName, propertyPath, unit, range] of [
      [
        "MasterClockShift",
        "MasterClockShift <seconds>",
        "seconds",
        "Master.CueClockShift",
        "seconds",
        "pass-through; absolute setter observed -3.5..10000",
      ],
      [
        "MasterEffectClockShift",
        "MasterEffectClockShift <seconds>",
        "seconds",
        "Master.MasterEffectClockShift",
        "seconds",
        "pass-through; absolute setter observed -3.5..10000",
      ],
      [
        "MasterEffectMetroShift",
        "MasterEffectMetroShift <beats>",
        "beats",
        "Master.MasterEffectMetroShift",
        "beats",
        "pass-through; absolute setter observed -2.5..10000",
      ],
      [
        "MasterMetroShift",
        "MasterMetroShift <beats>",
        "beats",
        "Master.CueBeatShift",
        "beats",
        "pass-through; absolute setter observed -2.5..10000",
      ],
      [
        "MasterShowShift",
        "MasterShowShift <ms>",
        "ms",
        "Master.ShowShift",
        "milliseconds input",
        "pass-through; absolute setter observed -250..100000",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toEqual([propertyPath]);
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
    }

    expect(merged.commands.MasterPauseTime?.setsProperty).toEqual(["Master.PauseTime"]);
    expect(findParam("MasterPauseTime", "MasterPauseTime <ms>", "ms")).toMatchObject({
      type: "integer",
      range: "0..5000",
      valueRange: {
        min: 0,
        max: 5000,
        unit: "milliseconds",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships transition index range metadata and transition time readback limits", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["MasterTransitionIndex", "MasterTransitionIndex <value>"],
      ["SetTransitionIndex", "SetTransitionIndex <value>"],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toEqual(["Master.TransitionIndex"]);
      expect(findParam(commandName, signature, "value")).toMatchObject({
        type: "integer",
        range: "0..24",
        valueRange: {
          min: 0,
          max: 24,
          unit: "transition preset index",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, signature] of [
      ["MasterTransitionTime", "MasterTransitionTime <seconds>"],
      ["SetTransitionTime", "SetTransitionTime <seconds>"],
    ] as const) {
      expect(merged.commands[commandName]?.setsProperty).toBeUndefined();
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
        safetyTier: "T2",
      });
      expect(findParam(commandName, signature, "seconds")).toMatchObject({
        type: "number",
        range: "no readable range evidence; representative writes sent for -1, 0, 0.5, 2, and 10000",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("ships live-probed BeamBrush range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("BeamBrush", "BeamBrush <value>", "value")).toMatchObject({
      type: "number",
      range: "0..100",
      valueRange: {
        min: 0,
        max: 100,
        unit: "percent",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("BeamBrushDelta", "BeamBrushDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to 0..100",
      valueRange: {
        unit: "percent delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed hue and saturation range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    expect(findParam("Hue", "Hue <value>", "value")).toMatchObject({
      type: "number",
      range: "-1..720",
      valueRange: {
        min: -1,
        max: 720,
        unit: "degrees",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
      acceptedValues: [expect.objectContaining({ value: -1, label: "DISABLED" })],
    });

    expect(findParam("HueDelta", "HueDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to -1..720",
      valueRange: {
        unit: "degrees delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("HueShift", "HueShift <value>", "value")).toMatchObject({
      type: "number",
      range: "pass-through; no clamp observed through -1000000..1000000",
      valueRange: {
        unit: "degrees",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("HueShiftDelta", "HueShiftDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; resulting value passed through at -1000000 and 1000000",
      valueRange: {
        unit: "degrees delta",
        boundaryBehavior: "pass-through",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("Saturation", "Saturation <value>", "value")).toMatchObject({
      type: "number",
      range: "-100..100",
      valueRange: {
        min: -100,
        max: 100,
        unit: "signed saturation offset",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });

    expect(findParam("SaturationDelta", "SaturationDelta <delta>", "delta")).toMatchObject({
      type: "number",
      range: "relative; result clamps to -100..100",
      valueRange: {
        unit: "signed saturation delta",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("ships live-probed channel input ratio range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      "SetChannelToChannelRatio",
      "SetDmxToChannelRatio",
      "SetFFTToChannelRatio",
      "SetVdjToChannelRatio",
    ] as const;

    for (const commandName of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <ratio>`)
        ?.parameters?.find((candidate) => candidate.name === "ratio") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "number",
        range: "0..100",
        valueRange: {
          min: 0,
          max: 100,
          unit: "percent",
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
      });
    }
  });

  it("ships live-probed FX MSL range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    for (let index = 1; index <= 6; index += 1) {
      const commandName = `SetFX${index}MSL`;
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <layer>`)
        ?.parameters?.find((candidate) => candidate.name === "layer") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "integer",
        range: "0..11",
        valueRange: {
          min: 0,
          max: 11,
          unit: "MSL input layer",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain("2026-05-12");
      expect(String(param?.valueRange?.notes)).toContain("-2");
      expect(String(param?.valueRange?.notes)).toContain("100");
      expect(String(param?.description)).toContain("Inputs -2 through 100 pass through to storage");
    }
  });

  it("ships live-probed surface MSL range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const cases = [
      "SetGrid1MSL",
      "SetGrid2MSL",
      "SetSliderMSL",
      "SetButtonMSL",
      "SetZoneMuteMSL",
      "SetZoneSelMSL",
    ] as const;

    for (const commandName of cases) {
      const param = merged.commands[commandName]?.forms
        ?.find((form) => form.signature === `${commandName} <layer>`)
        ?.parameters?.find((candidate) => candidate.name === "layer") as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

      expect(param).toMatchObject({
        type: "integer",
        range: "0..11",
        valueRange: {
          min: 0,
          max: 11,
          unit: "MSL input layer",
          boundaryBehavior: "pass-through",
          evidenceLevel: "observed",
        },
      });
      expect(String(param?.valueRange?.notes)).toContain("2026-05-12");
      expect(String(param?.valueRange?.notes)).toContain("-2");
      expect(String(param?.valueRange?.notes)).toContain("100");
      expect(String(param?.description)).toContain("Inputs -2 through 100 pass through to storage");
    }
  });

  it("keeps LockScreen metadata tied to BEYOND UI security, not PangoScript Password", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const command = merged.commands.LockScreen;

    expect(command?.description).toContain("UI-side password");
    expect(command?.description).toContain("NOT the PangoScript `Password` command");
    expect(command?.forms?.[0]?.description).toContain("BEYOND Configuration/Security");
    expect(command?.forms?.[0]?.description).toContain("PangoScript Password command is unrelated");
    expect(command?.forms?.[0]?.parameters).toEqual([]);
  });

  it("keeps working-example command arities represented in curated metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    const muteSelectedZones = merged.commands.MuteSelectedZones?.forms?.find(
      (form) => form.signature === "MuteSelectedZones <action>",
    );
    const waitForTimerBeat = merged.commands.WaitForTimerBeat?.forms?.find(
      (form) => form.signature === "WaitForTimerBeat <beats>",
    );

    expect(muteSelectedZones).toMatchObject({
      signature: "MuteSelectedZones <action>",
      parameters: [
        {
          name: "action",
          required: true,
        },
      ],
    });
    expect(waitForTimerBeat).toMatchObject({
      signature: "WaitForTimerBeat <beats>",
      parameters: [
        {
          name: "beats",
          required: true,
        },
      ],
    });
  });

  it("ships timing wait range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const sleepTime = findParam("Sleep", "Sleep <timeMs>", "timeMs");
    const waitMask = findParam("WaitForBeat", "WaitForBeat <beatMask>, <count>", "beatMask");
    const waitCount = findParam("WaitForBeat", "WaitForBeat <beatMask>, <count>", "count");
    const timerBeats = findParam("WaitForTimerBeat", "WaitForTimerBeat <beats>", "beats");

    expect(sleepTime).toMatchObject({
      range: "milliseconds; lower and upper bounds not established",
      valueRange: {
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(waitMask).toMatchObject({
      range: "bit mask 1..7 using timer=1, manual=2, audio=4",
      valueRange: {
        min: 1,
        max: 7,
        unit: "beat-source bit mask",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(waitMask?.acceptedValues).toEqual([
      expect.objectContaining({ value: 1, label: "Timer beat" }),
      expect.objectContaining({ value: 2, label: "Manual beat" }),
      expect.objectContaining({ value: 4, label: "Audio beat" }),
      expect.objectContaining({ value: 7, label: "Any documented beat source" }),
    ]);
    expect(waitCount).toMatchObject({
      range: "documented whole-event count; fractional and zero behavior unverified",
      valueRange: {
        unit: "matching beat events",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(timerBeats).toMatchObject({
      range: "timer beats; fractional, zero, and upper-bound behavior unverified",
      valueRange: {
        unit: "timer beats",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
  });

  it("ships source-dependent trigger threshold metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.flatMap((form) => form.parameters ?? [])
        .find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const commandName of [
      "DecreaseTrigger",
      "IncreaseTrigger",
      "InRangeTrigger",
      "InRangeTriggerCmd",
      "OutOfRangeTrigger",
      "OutOfRangeTriggerCmd",
    ]) {
      for (const paramName of ["minValue", "maxValue"]) {
        const param = findParam(commandName, paramName);
        expect(param, `${commandName}.${paramName}`).toMatchObject({
          range: "source-dependent watched value",
          valueRange: {
            unit: "watched trigger value",
            boundaryBehavior: "unknown",
            evidenceLevel: "documented",
          },
        });
        expect(param?.valueRange).not.toHaveProperty("min");
        expect(param?.valueRange).not.toHaveProperty("max");
      }
    }

    for (const commandName of ["LessThanTrigger", "MoreThanTrigger"]) {
      const param = findParam(commandName, "threshold");
      expect(param, `${commandName}.threshold`).toMatchObject({
        range: "source-dependent watched value",
        valueRange: {
          unit: "watched trigger value",
          boundaryBehavior: "unknown",
          evidenceLevel: "documented",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }
  });

  it("ships observed AnimateProp range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.flatMap((form) => form.parameters ?? [])
        .find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["startValue", "finishValue"]) {
      const param = findParam("AnimateProp", paramName);
      expect(param, `AnimateProp.${paramName}`).toMatchObject({
        range: "target-property-dependent numeric value",
        valueRange: {
          unit: "target property value",
          boundaryBehavior: "unknown",
          evidenceLevel: "observed",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    const animateDuration = findParam("AnimateProp", "durationMS");
    expect(animateDuration).toMatchObject({
      range: "0 and positive milliseconds observed; upper bound not established",
      valueRange: {
        min: 0,
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(animateDuration?.valueRange).not.toHaveProperty("max");

    const animateFinishEvent = findParam("AnimateProp", "finishEvent");
    expect(animateFinishEvent).toMatchObject({
      range: "free-form event name; empty string accepted",
    });

    const delta = findParam("AnimatePropDelta", "totalDelta");
    expect(delta).toMatchObject({
      range: "target-property-dependent numeric delta",
      valueRange: {
        unit: "target property delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(delta?.valueRange).not.toHaveProperty("min");
    expect(delta?.valueRange).not.toHaveProperty("max");

    const deltaDuration = findParam("AnimatePropDelta", "durationMS");
    expect(deltaDuration).toMatchObject({
      range: "0 and positive milliseconds observed; upper bound not established",
      valueRange: {
        min: 0,
        unit: "milliseconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(deltaDuration?.valueRange).not.toHaveProperty("max");

    const deltaFinishEvent = findParam("AnimatePropDelta", "finishEvent");
    expect(deltaFinishEvent).toMatchObject({
      range: "free-form event name; empty string behavior inferred from AnimateProp",
    });
  });

  it("pins conservative safety tiers for dynamic and state-changing command families", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.ExecCmd?.safetyTier).toBe("T4");
    expect(merged.commands.SetZoneMeshPointPos?.safetyTier).toBe("T4");

    for (const commandName of ["HtmlBody", "HtmlClearBody", "HtmlClearHead", "HtmlHead", "HtmlHide", "HtmlUpdate"]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T2");
    }

    for (const commandName of [
      "ClickFlash",
      "ClickLive",
      "ClickRestart",
      "ClickSelect",
      "ClickSoloFlash",
      "ClickToggle",
      "ClickTrack",
      "HoldClick",
      "MultiCue",
      "OneCue",
      "OnePer",
    ]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T2");
    }

    for (const commandName of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(merged.commands[commandName]?.safetyTier, commandName).toBe("T4");
    }
  });

  it("ships blocked mesh geometry range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const paramName of ["x", "y"]) {
      const param = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', paramName);
      expect(param, `MeshPoint.${paramName}`).toMatchObject({
        range:
          "export example uses -100..100 coordinate space; accepted bounds and normalized 0..1 behavior unverified",
        valueRange: {
          unit: "mesh coordinate",
          boundaryBehavior: "unknown",
          evidenceLevel: "exported",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    const z = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', "z");
    expect(z).toMatchObject({
      range: "export example uses 0 for Z; accepted bounds and normalized 0..1 behavior unverified",
      valueRange: {
        unit: "mesh coordinate",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(z?.valueRange).not.toHaveProperty("min");
    expect(z?.valueRange).not.toHaveProperty("max");

    const name = findParam("MeshPoint", 'MeshPoint <x>, <y>, <z>, "<name>"', "name");
    expect(name).toMatchObject({
      range: "free-form point label; name-reference behavior unverified",
    });

    for (const [paramName, range] of [
      ["a", "undocumented numeric parameter; export example a=1; coordinate or channel meaning unverified"],
      ["b", "undocumented numeric parameter; export example b=0; coordinate or channel meaning unverified"],
      ["c", "undocumented numeric parameter; export example c=0; coordinate or channel meaning unverified"],
    ]) {
      const param = findParam("MeshPointChan", "MeshPointChan <a>, <b>, <c>", paramName);
      expect(param, `MeshPointChan.${paramName}`).toMatchObject({
        range,
        valueRange: {
          unit: "undocumented mesh-point channel parameter",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    for (const [commandName, signature, paramNames] of [
      ["MeshCurve", "MeshCurve <pt1>, <pt2>, <pt3>", ["pt1", "pt2", "pt3"]],
      ["MeshPolygon", "MeshPolygon <pt1>, <pt2>", ["pt1", "pt2"]],
      ["MeshRect", "MeshRect <pt1>, <pt2>, <pt3>, <pt4>", ["pt1", "pt2", "pt3", "pt4"]],
      ["MeshSpline", "MeshSpline <base1>, <handle1>, <handle2>, <base2>", ["base1", "handle1", "handle2", "base2"]],
      ["MeshTriangle", "MeshTriangle <pt1>, <pt2>, <pt3>", ["pt1", "pt2", "pt3"]],
    ] as const) {
      for (const paramName of paramNames) {
        const param = findParam(commandName, signature, paramName);
        expect(param, `${commandName}.${paramName}`).toMatchObject({
          range: "1-based mesh point index; export examples reference points 1..N; zero and upper bound unverified",
          valueRange: {
            min: 1,
            unit: "mesh point index",
            boundaryBehavior: "unknown",
            evidenceLevel: "exported",
          },
        });
        expect(param?.valueRange).not.toHaveProperty("max");
      }
    }

    for (const commandName of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships a compact object-property search index for agents", () => {
    const index = readJson<{
      schemaVersion: number;
      entries: Array<{
        path: string;
        normalizedPath: string;
        root: string;
        property: string;
        kind: string;
        searchText: string;
        variantCount: number;
        variants: Array<{ path: string; osc?: string }>;
      }>;
    }>("object-property-index.json");

    expect(index.schemaVersion).toBe(1);
    expect(index.entries.length).toBeGreaterThan(1000);
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "Master.ShowSpeed",
        normalizedPath: "Master.ShowSpeed",
        root: "Master",
        property: "ShowSpeed",
        kind: "object",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "Master.ShowShift",
        normalizedPath: "Master.ShowShift",
        root: "Master",
        property: "ShowShift",
        kind: "object",
      }),
    );
    const dmxOutput = index.entries.find((entry) => entry.path === "DmxOutput.N");
    expect(dmxOutput?.variantCount).toBe(2047);
    expect(dmxOutput?.variants).toContainEqual({ path: "DmxOutput.2046", osc: "/b/DmxOutput/2046" });
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "FX.N.N.N.Oscillator.Period",
        normalizedPath: "FX.N.N.N.Oscillator.Period",
        root: "FX",
        property: "Oscillator.Period",
        kind: "fx",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "WS.N.N.Caption",
        normalizedPath: "WS.N.N.Caption",
        root: "WS",
        property: "Caption",
        kind: "object",
      }),
    );
  });

  it("keeps object-property index paths unique under case-insensitive lookup", () => {
    const index = readJson<{
      entries: Array<{ path: string }>;
    }>("object-property-index.json");
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const entry of index.entries) {
      const key = entry.path.toLowerCase();
      const prior = seen.get(key);
      if (prior) duplicates.push(`${prior} / ${entry.path}`);
      else seen.set(key, entry.path);
    }

    expect(duplicates).toEqual([]);
  });

  it("collapses showfile-specific Object Tree roots before shipping the agent index", () => {
    const index = readJson<{
      entries: Array<{
        path: string;
        root: string;
        searchText: string;
        variants: Array<{ path: string; osc?: string }>;
      }>;
    }>("object-property-index.json");
    const showfileSpecificNames = [
      "---DUMMYZONE---",
      "---GROUPS---",
      "---PAIRS---",
      "---PIXELMAPS---",
      "HardwareMuter",
      "COLORPICKER",
      "SHOWKONTROL",
    ];

    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "ZoneAlias.Active",
        root: "ZoneAlias",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "UniversePanelAlias.Control.Caption",
        root: "UniversePanelAlias",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "FB4-XXXXX.Connected",
        root: "FB4-XXXXX",
      }),
    );
    const redactedHardwareEntry = index.entries.find((entry) => entry.path === "FB4-XXXXX.Connected");
    expect(redactedHardwareEntry).toBeDefined();
    expect(redactedHardwareEntry).not.toHaveProperty("osc");
    expect(redactedHardwareEntry?.variants).toContainEqual({ path: "FB4-XXXXX.Connected" });

    const serialized = JSON.stringify(index.entries);
    for (const name of showfileSpecificNames) {
      expect(serialized).not.toContain(name);
    }
    expect(serialized).not.toMatch(/\/b\/FB[34]_\d+/);
    expect(serialized).not.toMatch(/\/b\/FB[34]_XXXXX/);
  });

  it("marks user-configurable Object Tree alias placeholders", () => {
    const index = readJson<{
      entries: Array<{
        path: string;
        addressMetadata?: {
          mode: string;
          placeholder: string;
          aliasOf: string;
          userConfigured: boolean;
          componentPlaceholder?: string;
        };
      }>;
    }>("object-property-index.json");
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("ZoneAlias.Active")?.addressMetadata).toMatchObject({
      mode: "user-configured-name",
      placeholder: "ZoneAlias",
      aliasOf: "Zone.N",
      userConfigured: true,
    });
    expect(byPath.get("ZoneAlias.Active")?.addressMetadata?.componentPlaceholder).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.Caption")?.addressMetadata).toMatchObject({
      mode: "user-configured-name",
      placeholder: "UniversePanelAlias",
      aliasOf: "Universe.N",
      userConfigured: true,
      componentPlaceholder: "Control",
    });

    expect(byPath.get("Zone.N.Active")?.addressMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Button1.Caption")?.addressMetadata).toBeUndefined();
    expect(byPath.get("Master.Brightness")?.addressMetadata).toBeUndefined();
  });

  it("carries runtime-backed object schema corrections for hovers and completions", () => {
    const knownProperties = readJson<{
      schemas: Array<{
        object: string;
        propertyCount: number;
        properties: string[];
      }>;
    }>("known-properties.json");

    const master = knownProperties.schemas.find((schema) => schema.object === "Master");
    expect(master?.properties).toContain("ShowShift");
    expect(master?.propertyCount).toBe(master?.properties.length);

    const dmxOutput = knownProperties.schemas.find((schema) => schema.object === "DmxOutput");
    expect(dmxOutput?.propertyCount).toBe(2047);
    expect(dmxOutput?.properties).toContain("2046");
    expect(dmxOutput?.properties).not.toContain("2047");
  });

  it("keeps command setsProperty paths resolvable through shipped object schemas", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const knownProperties = readJson<{
      schemas: Array<{
        object: string;
        isArray: boolean;
        properties: string[];
      }>;
    }>("known-properties.json");
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        normalizedPath?: string;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set<string>();
    for (const schema of knownProperties.schemas) {
      for (const property of schema.properties) {
        knownPaths.add(`${schema.object}${schema.isArray ? ".N" : ""}.${property}`);
      }
    }
    for (const entry of objectPropertyIndex.entries) {
      knownPaths.add(entry.normalizedPath ?? entry.path);
      knownPaths.add(entry.path);
    }

    const missing: string[] = [];
    for (const command of Object.values(merged.commands)) {
      for (const property of command.setsProperty ?? []) {
        if (!knownPaths.has(property)) missing.push(`${command.canonical}:${property}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("ships lab-confirmed setter mappings for indexed live-control commands", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.PositionIndex?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(merged.commands.PositionDelta?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(merged.commands.PositionX?.setsProperty).toEqual(["Master.PositionX"]);
    expect(merged.commands.PositionY?.setsProperty).toEqual(["Master.PositionY"]);
    expect(merged.commands.PositionZ?.setsProperty).toEqual(["Master.PositionZ"]);
    expect(merged.commands.SizeDelta?.setsProperty).toEqual(["Master.SizeX", "Master.SizeY", "Master.SizeZ"]);
    expect(merged.commands.SizeIndex?.setsProperty).toEqual(["Master.SizeX", "Master.SizeY", "Master.SizeZ"]);
    expect(merged.commands.SizeX?.setsProperty).toContain("Master.SizeX");
    expect(merged.commands.SizeY?.setsProperty).toEqual(["Master.SizeY"]);
    expect(merged.commands.SizeZ?.setsProperty).toEqual(["Master.SizeZ"]);
    expect(merged.commands.AnimationSpeed?.setsProperty).toEqual(["Master.AnimationSpeed"]);
    expect(merged.commands.VisiblePoints?.setsProperty).toEqual(["Master.VisiblePoints"]);
  });

  it("ships lab-confirmed setter mappings for live-control color and rotation-speed commands", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");

    expect(merged.commands.ColorRGB?.setsProperty).toEqual(["Master.Red", "Master.RGBColor"]);
    expect(merged.commands.ColorBGR?.setsProperty).toEqual(["Master.Red", "Master.RGBColor"]);
    expect(merged.commands.RGBA?.setsProperty).toEqual([
      "Master.Red",
      "Master.Green",
      "Master.Blue",
      "Master.Alpha",
      "Master.RGBColor",
    ]);
    expect(merged.commands.RGBADelta?.setsProperty).toEqual([
      "Master.Red",
      "Master.Green",
      "Master.Blue",
      "Master.Alpha",
      "Master.RGBColor",
    ]);
    expect(merged.commands.RotoSpeed?.setsProperty).toEqual([
      "Master.RotoSpeedX",
      "Master.RotoSpeedY",
      "Master.RotoSpeedZ",
    ]);
    expect(merged.commands.RotoSpeedX?.setsProperty).toEqual(["Master.RotoSpeedX"]);
    expect(merged.commands.RotoSpeedY?.setsProperty).toEqual(["Master.RotoSpeedY"]);
    expect(merged.commands.RotoSpeedZ?.setsProperty).toEqual(["Master.RotoSpeedZ"]);
  });

  it("classifies live-control reset, button, and tab state coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.ResetPosition?.setsProperty).toEqual([
      "Master.PositionX",
      "Master.PositionY",
      "Master.PositionZ",
    ]);
    expect(coverage.commands.ClickLCTabMode?.status).toBe("no-direct-property");
    expect(coverage.commands.ClickLockSize?.status).toBe("no-direct-property");
    expect(coverage.commands.ResetLCTab?.status).toBe("no-direct-property");
    expect(coverage.commands.ResetLiveControl?.status).toBe("deferred");
    expect(coverage.commands.ResetLiveControl?.notes).toContain("Sweeping multi-property reset");
  });

  it("classifies FX command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const fxAssignments = fxProps("");
    const fxActions = fxProps("Action", 8);
    const fxTimeMul = [...fxProps("TimeMulClock", 8), ...fxProps("TimeMulMetro", 8)];
    const fxTimeScale = [...fxProps("TimeScaleClock", 8), ...fxProps("TimeScaleMetro", 8)];
    const fxTimeShift = [...fxProps("TimeShiftClock", 8), ...fxProps("TimeShiftMetro", 8)];

    expect(merged.commands.ClickFXStopAll?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.FX?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.ResetMasterFX?.setsProperty).toEqual(fxAssignments);
    expect(merged.commands.FXAction?.setsProperty).toEqual(fxActions);
    expect(merged.commands.SetFXMul?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.SetFXMulAx?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.MulFXMulAx?.setsProperty).toEqual(fxTimeMul);
    expect(merged.commands.FXTimeScaleAx?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.FXTimeScaleAxReset?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.FXTimeScaleDeltaAx?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.ZoneFXTimeScale?.setsProperty).toEqual(fxTimeScale);
    expect(merged.commands.ZoneFXTimeShift?.setsProperty).toEqual(fxTimeShift);

    for (const command of [
      "ClickFXTabMode",
      "ClickFxVlj",
      "DropFX",
      "FXCellClick",
      "FXCellDown",
      "FXClick",
      "FXScroll",
      "FXScrollDelta",
      "Set1FxPerLine",
      "Set4FxPerLine",
      "SetDropFxMode",
      "ShiftFX",
      "StopFX",
      "StopFxCell",
      "ToggleFX",
      "ZoneFXTimeScaleDelta",
      "ZoneFXTimeShiftDelta",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }

    for (const command of ["FXTimeSync", "ResetCuesFX", "ResetFxTiming", "ResetProTrackFX", "ResetZonesFX"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }
  });

  it("ships zone FX timing and FX scroll range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>"],
      ["ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>"],
    ] as const) {
      expect(findParam(commandName, signature, "layer")).toMatchObject({
        type: "integer",
        range: "1..8",
        valueRange: {
          min: 1,
          max: 8,
          unit: "FX layer",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>", "clockMul")).toMatchObject({
      range: "0 accepted; pass-through observed for 0, 2, and 4",
      valueRange: {
        min: 0,
        unit: "clock multiplier",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeScale", "ZoneFXTimeScale <layer>, <clockMul>, <metroMul>", "metroMul")).toMatchObject({
      range: "0 accepted; pass-through observed for 0, 2, and 4",
      valueRange: {
        min: 0,
        unit: "metro multiplier",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>", "clockMul")).toMatchObject({
      range: "pass-through observed for 0, 2, and 4",
      valueRange: {
        unit: "clock shift value",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(findParam("ZoneFXTimeShift", "ZoneFXTimeShift <layer>, <clockMul>, <metroMul>", "metroMul")).toMatchObject({
      range: "pass-through observed for 0, 2, and 4",
      valueRange: {
        unit: "metro shift value",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, signature, clockName, metroName, clockRange, metroRange] of [
      [
        "ZoneFXTimeScaleDelta",
        "ZoneFXTimeScaleDelta <layer>, <clockDelta>, <metroDelta>",
        "clockDelta",
        "metroDelta",
        "no direct write target observed for delta 2",
        "no direct write target observed for delta 3",
      ],
      [
        "ZoneFXTimeShiftDelta",
        "ZoneFXTimeShiftDelta <layer>, <clockDelta>, <metroDelta>",
        "clockDelta",
        "metroDelta",
        "no direct write target observed for delta 4",
        "no direct write target observed for delta 5",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, "layer")).toMatchObject({
        valueRange: {
          unit: "FX layer",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(findParam(commandName, signature, clockName)).toMatchObject({
        range: clockRange,
        valueRange: {
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
      expect(findParam(commandName, signature, metroName)).toMatchObject({
        range: metroRange,
        valueRange: {
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    expect(findParam("FXScroll", "FXScroll <baseIndex>", "baseIndex")).toMatchObject({
      range: "no readable range evidence; representative writes sent for 0, 4, and 999",
      valueRange: {
        unit: "QuickFX base index",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(findParam("FXScrollDelta", "FXScrollDelta <delta>", "delta")).toMatchObject({
      range: "no readable range evidence; representative writes sent for -999, -1, 1, and 999",
      valueRange: {
        unit: "QuickFX base-index delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
  });

  it("classifies projection-zone routing, selection, mute, and mesh coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");
    const zoneSelection = ["Zone.N.Selected"];
    const zoneMute = ["Zone.N.Mute", "Zone.N.Muted"];

    for (const command of [
      "ReStoreZoneSelection",
      "SelectAndFocusZone",
      "SelectZone",
      "SelectZoneName",
      "ToggleSelectZone",
      "UnSelectZone",
      "UnSelectZoneName",
      "UnselectAllZones",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(zoneSelection);
    }

    for (const command of [
      "MuteAllZones",
      "MuteSelectedZones",
      "MuteZone",
      "MuteZonesOfProjector",
      "ToggleMuteZone",
      "ToggleMuteZoneOfProjector",
      "UnMuteZonesOfProjector",
      "UnmuteAllZone",
      "UnmuteZone",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(zoneMute);
    }

    expect(merged.commands.SetProTrackZones?.setsProperty).toEqual(["ProTrack.N.Zones"]);
    expect(merged.commands.SetZoneMuteMSL?.setsProperty).toEqual(["MIDI1.ZoneMuteMSL"]);
    expect(merged.commands.SetZoneSelMSL?.setsProperty).toEqual(["MIDI1.ZoneSelMSL"]);

    for (const command of [
      "ControlCue",
      "ControlFromFxTab",
      "ControlFromLcTab",
      "ControlFromTcTab",
      "ControlFromUI",
      "ControlMaster",
      "ControlProTrack",
      "ControlProjector",
      "ControlSelCues",
      "ControlSelProTracks",
      "ControlSelZones",
      "ControlZone",
      "FocusProjector",
      "FocusZone",
      "GetFxControl",
      "GetLiveControl",
      "GetPage",
      "GetTimeControl",
      "PreviewZoneGrid",
      "PreviewZoneMatrix",
      "ProjectionZonesDialog",
      "SelectFixt",
      "SelectProjector",
      "SetLimiterPerZone",
      "StoreZoneSelection",
      "ToggleSelectFixt",
      "ToggleSelectProjector",
      "UnselectAllFixt",
      "UnselectAllProjectors",
      "UnselectFixt",
      "UnselectProjector",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }

    for (const command of ["LoadZoneFromBlob", "MuteSelected", "SetZoneMeshPointPos"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }
  });

  it("ships projector index range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    for (const [commandName, signature] of [
      ["MuteZonesOfProjector", "MuteZonesOfProjector <projectorIndex>"],
      ["ToggleMuteZoneOfProjector", "ToggleMuteZoneOfProjector <projectorIndex>"],
      ["UnMuteZonesOfProjector", "UnMuteZonesOfProjector <projectorIndex>"],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "mapped",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, "projectorIndex")).toMatchObject({
        range: "1..max Zone.N.ProjectorIndex (1..3 observed in lab)",
        valueRange: {
          min: 1,
          unit: "projector index",
          boundaryBehavior: "no-op",
          evidenceLevel: "observed",
        },
      });
    }

    for (const [commandName, signature, range] of [
      [
        "FocusProjector",
        "FocusProjector <projectorIndex>",
        "1..configured projector indices; no readable focus property",
      ],
      [
        "SelectProjector",
        "SelectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "ToggleSelectProjector",
        "ToggleSelectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "UnselectProjector",
        "UnselectProjector <projectorIndex>",
        "1..configured projector indices; no readable selection property",
      ],
      [
        "ControlProjector",
        "ControlProjector <projectorIndex>",
        "historical projector index; representative writes sent for 0, 1, and 4 with no readable route state",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
      });
      expect(findParam(commandName, signature, "projectorIndex")).toMatchObject({
        range,
        valueRange: {
          min: 1,
          unit: "projector index",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("classifies ProTrack command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of ["SelectProTrack", "ToggleSelectProTrack", "UnselectAllProTracks", "UnselectProTrack"]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Selected"]);
    }

    for (const command of [
      "MuteAllProTracks",
      "MuteProTrack",
      "ToggleMuteProTrack",
      "UnmuteAllProTracks",
      "UnmuteProTrack",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Mute"]);
    }

    for (const command of ["SoloProTrack", "ToggleSoloProTrack", "UnSoloAllProTrack", "UnSoloProTrack"]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["ProTrack.N.Solo"]);
    }

    for (const command of [
      "FocusProTrack",
      "InvertProTrackTime",
      "ProTrackDisk",
      "ProTrackDiskShift",
      "ProTrackResetJump",
      "ProTrackSetJump",
      "ProTrackSetLoop",
      "StartTvMode",
      "StopProTrack",
      "StopProTrackFX",
      "StopTvMode",
      "SynchronizePlayerToBeat",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships documented LinePerCycle scheduler range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const lines = merged.commands.LinePerCycle?.forms
      ?.find((form) => form.signature === "LinePerCycle <lines>")
      ?.parameters?.find((param) => param.name === "lines") as
      | (Record<string, unknown> & {
          acceptedValues?: Array<Record<string, unknown>>;
          valueRange?: Record<string, unknown>;
        })
      | undefined;

    expect(lines).toMatchObject({
      type: "integer",
      range: "documented default 30 lines per cycle; accepted bounds, 0 behavior, and maximum unverified",
      valueRange: {
        unit: "script lines per scheduling cycle",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(lines?.valueRange).not.toHaveProperty("min");
    expect(lines?.valueRange).not.toHaveProperty("max");
    expect(lines?.acceptedValues).toEqual([expect.objectContaining({ value: 30, label: "Documented default" })]);
    expect(merged.commands.LinePerCycle?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unverified",
          method: "operatorSupervised",
          expectedCallback: expect.stringContaining(
            "PangoLint lint acceptance and Talk UDP transmission are not range evidence",
          ),
        }),
      ]),
    );
  });

  it("ships conservative ProTrack disk and TV mode range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const position = findParam("ProTrackDisk", "ProTrackDisk <indexOrName>, <position>", "position");
    expect(position).toMatchObject({
      range: "fractional disk position; export example 0.1; bounds and clamp behavior unverified",
      valueRange: {
        unit: "fractional disk position",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(position?.valueRange).not.toHaveProperty("min");
    expect(position?.valueRange).not.toHaveProperty("max");

    const diskShiftForm = merged.commands.ProTrackDiskShift?.forms?.find(
      (form) => form.signature === "ProTrackDiskShift <delta>",
    );
    expect(diskShiftForm?.parameters?.map((param) => param.name)).toEqual(["delta"]);

    const delta = findParam("ProTrackDiskShift", "ProTrackDiskShift <delta>", "delta");
    expect(delta).toMatchObject({
      range: "fractional disk-position delta; export example 0.1; negative and clamp behavior unverified",
      valueRange: {
        unit: "fractional disk-position delta",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(delta?.valueRange).not.toHaveProperty("min");
    expect(delta?.valueRange).not.toHaveProperty("max");

    const fps = findParam("StartTvMode", "StartTvMode <fps>", "fps");
    expect(fps).toMatchObject({
      range: "documented example 30 FPS; 24, 25, 30, 60, 0, and 1000 have no readback-confirmed acceptance",
      valueRange: {
        unit: "frames per second",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(fps?.valueRange).not.toHaveProperty("min");
    expect(fps?.valueRange).not.toHaveProperty("max");

    for (const commandName of ["ProTrackDisk", "ProTrackDiskShift", "StartTvMode"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships conservative stop, fade, and blackout range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    for (const commandName of ["StopAllAsync", "StopAllSync"]) {
      const time = findParam(commandName, `${commandName} <time>`, "time");
      expect(time, `${commandName}.time`).toMatchObject({
        range: "seconds; 0, 1.0, and 60 have no readback-confirmed acceptance",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(time?.valueRange).not.toHaveProperty("min");
      expect(time?.valueRange).not.toHaveProperty("max");
    }

    for (const signature of ["StopCueType <mask>", "StopCueType <mask>, <fadeSeconds>"]) {
      const mask = findParam("StopCueType", signature, "mask");
      expect(mask, signature).toMatchObject({
        range: "documented cue-type bit mask: 1 Image, 2 Timeline, 4 DMX, 8 Sequence, 16 Beams, 32 Capture; 255 all",
        valueRange: {
          unit: "cue type mask",
          boundaryBehavior: "unknown",
          evidenceLevel: "documented",
        },
      });
      expect(mask?.acceptedValues).toEqual([
        expect.objectContaining({ value: 1, label: "Image" }),
        expect.objectContaining({ value: 2, label: "Timeline" }),
        expect.objectContaining({ value: 4, label: "DMX" }),
        expect.objectContaining({ value: 8, label: "Sequence" }),
        expect.objectContaining({ value: 16, label: "Beams" }),
        expect.objectContaining({ value: 32, label: "Capture" }),
        expect.objectContaining({ value: 255, label: "All documented cue types" }),
      ]);
    }

    const fadeSeconds = findParam("StopCueType", "StopCueType <mask>, <fadeSeconds>", "fadeSeconds");
    expect(fadeSeconds).toMatchObject({
      range: "seconds; zero means immediate; 0.5, 2.0, and -1 have no readback-confirmed acceptance",
      valueRange: {
        unit: "seconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(fadeSeconds?.valueRange).not.toHaveProperty("min");
    expect(fadeSeconds?.valueRange).not.toHaveProperty("max");

    const blackoutState = findParam("StopOnBlackout", "StopOnBlackout <state>", "state");
    expect(blackoutState).toMatchObject({
      range: "0/1 and OFF/ON documented; TOGGLE behavior unverified",
      valueRange: {
        min: 0,
        max: 1,
        unit: "blackout stop state",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(blackoutState?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "OFF" }),
      expect.objectContaining({ value: 1, label: "ON" }),
      expect.objectContaining({ value: "OFF", label: "OFF" }),
      expect.objectContaining({ value: "ON", label: "ON" }),
    ]);

    const fxLine = findParam("StopProTrackFX", "StopProTrackFX [<indexOrName>[, <fxLine>, ...]]", "fxLine1..N");
    expect(fxLine).toMatchObject({
      range: "1-based FX line index; upper bound and out-of-range behavior unverified",
      valueRange: {
        min: 1,
        unit: "ProTrack FX line index",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(fxLine?.valueRange).not.toHaveProperty("max");

    for (const commandName of ["StopAllAsync", "StopAllSync", "StopCueType", "StopOnBlackout", "StopProTrackFX"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships conservative preview and UMax page range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const previewLayout = findParam("PreviewNxN", "PreviewNxN <layout>", "layout");
    expect(previewLayout).toMatchObject({
      range: "documented layout enum values 1, 2, 3, 4, 11, 12, 13; out-of-range behavior unverified",
      valueRange: {
        unit: "preview layout code",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(previewLayout?.acceptedValues).toEqual([
      expect.objectContaining({ value: 1, label: "Single laser" }),
      expect.objectContaining({ value: 2, label: "2x2" }),
      expect.objectContaining({ value: 3, label: "3x3" }),
      expect.objectContaining({ value: 4, label: "4x4" }),
      expect.objectContaining({ value: 11, label: "Custom 1" }),
      expect.objectContaining({ value: 12, label: "Custom 2" }),
      expect.objectContaining({ value: 13, label: "Custom 3" }),
    ]);
    expect(previewLayout?.valueRange).not.toHaveProperty("min");
    expect(previewLayout?.valueRange).not.toHaveProperty("max");

    const matrixIndex = findParam("PreviewZoneMatrix", "PreviewZoneMatrix <matrixIndex>", "matrixIndex");
    expect(matrixIndex).toMatchObject({
      range: "0 default preview; 1..N zone matrix index; upper bound and out-of-range behavior unverified",
      valueRange: {
        min: 0,
        unit: "zone matrix index",
        boundaryBehavior: "unknown",
        evidenceLevel: "exported",
      },
    });
    expect(matrixIndex?.valueRange).not.toHaveProperty("max");

    const previewColor = findParam("DisplayPreview", "DisplayPreview <expression>, <color>", "color");
    expect(previewColor).toMatchObject({
      range: "packed RGB integer; hex literals documented; out-of-range behavior unverified",
      valueRange: {
        unit: "packed RGB color",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(previewColor?.valueRange).not.toHaveProperty("min");
    expect(previewColor?.valueRange).not.toHaveProperty("max");

    const uiFps = findParam("SetUiFPS", "SetUiFPS <fps>", "fps");
    expect(uiFps).toMatchObject({
      range: "documented default and example 25 FPS; 1, 30, 60, and 0 have no readback-confirmed acceptance",
      valueRange: {
        unit: "frames per second",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(uiFps?.valueRange).not.toHaveProperty("min");
    expect(uiFps?.valueRange).not.toHaveProperty("max");

    for (const commandName of [
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
    ]) {
      const delta = findParam(commandName, `${commandName} <delta>`, "delta");
      expect(delta, `${commandName}.delta`).toMatchObject({
        range: "integer page delta; +1 next page and -1 previous page documented; 0 and large deltas unverified",
        valueRange: {
          unit: "page offset",
          boundaryBehavior: "unknown",
          evidenceLevel: "exported",
        },
      });
      expect(delta?.valueRange).not.toHaveProperty("min");
      expect(delta?.valueRange).not.toHaveProperty("max");
    }

    for (const commandName of [
      "DisplayPreview",
      "PreviewNxN",
      "PreviewZoneMatrix",
      "SetUiFPS",
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
    ]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "unverified",
            method: "operatorSupervised",
          }),
        ]),
      );
    }
  });

  it("ships packed color command range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const codeMarkerColor = findParam("CodeColorMarker", "CodeColorMarker <packedColor>", "packedColor");
    expect(codeMarkerColor).toMatchObject({
      range: "0x000000..0xFFFFFF documented GDI RGB color; 0xFFFFFFFF behavior unverified",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(codeMarkerColor?.acceptedValues).toEqual([
      expect.objectContaining({ value: 255, label: "Red, documented GDI RGB low byte" }),
      expect.objectContaining({ value: 65280, label: "Green" }),
      expect.objectContaining({ value: 16711680, label: "Blue, documented GDI RGB high byte" }),
      expect.objectContaining({ value: 16777215, label: "White" }),
    ]);
    expect(merged.commands.CodeColorMarker?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unverified",
          method: "operatorSupervised",
        }),
      ]),
    );

    const page = findParam("SetCueCaptionColor", "SetCueCaptionColor <page>, <cell>, <packedColor>", "page");
    expect(page).toMatchObject({
      range:
        "1-based workspace page index; pages 1 and 2 observed in lab, page 0 no-op, pages 3, 9, 10, and 11 had no matching WS readback change in this workspace",
      valueRange: {
        min: 1,
        unit: "workspace page index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(page?.valueRange).not.toHaveProperty("max");

    const cell = findParam("SetCueCaptionColor", "SetCueCaptionColor <page>, <cell>, <packedColor>", "cell");
    expect(cell).toMatchObject({
      range:
        "1-based cue cell index; cells 1, 9, 10, 11, 60, and 61 observed; cell 0 no-op; upper bound not established",
      valueRange: {
        min: 1,
        unit: "cue cell index",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(cell?.valueRange).not.toHaveProperty("max");

    const captionColor = findParam(
      "SetCueCaptionColor",
      "SetCueCaptionColor <page>, <cell>, <packedColor>",
      "packedColor",
    );
    expect(captionColor).toMatchObject({
      range:
        "0x000000..0xFFFFFF documented GDI RGB color; 0xFFFFFFFF stores as signed -1; visual alpha/reset behavior unverified",
      valueRange: {
        min: 0,
        max: 16777215,
        unit: "GDI RGB packed color",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(captionColor?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "Black" }),
      expect.objectContaining({ value: 255, label: "Red, documented GDI RGB low byte" }),
      expect.objectContaining({ value: 65280, label: "Green" }),
      expect.objectContaining({ value: 16711680, label: "Blue, documented GDI RGB high byte" }),
      expect.objectContaining({ value: 16777215, label: "White" }),
      expect.objectContaining({
        value: 4294967295,
        label: "Observed readback as signed -1; visual alpha or reset behavior unverified",
      }),
    ]);

    expect(merged.commands.SetCueCaptionColor?.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "observed",
          method: "controlledWriteReadback",
        }),
      ]),
    );
  });

  it("classifies grid, page, tab, cue, and universe command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of [
      "ClickFlash",
      "ClickRestart",
      "ClickSelect",
      "ClickSoloFlash",
      "ClickToggle",
      "ClickTrack",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["Grid.ClickMode", "Grid2.ClickMode"]);
    }

    for (const command of [
      "SelectNextPage",
      "SelectNextPageGrid1",
      "SelectNextTab",
      "SelectNextTabGrid1",
      "SelectPage",
      "SelectPageName",
      "SelectPrevPage",
      "SelectPrevPageGrid1",
      "SelectPrevTab",
      "SelectPrevTabGrid1",
      "SelectTab",
      "SelectTabName",
    ]) {
      expect(merged.commands[command]?.setsProperty).toEqual(["Grid.PageIndex"]);
    }

    expect(merged.commands.SetCueCaptionColor?.setsProperty).toEqual(["WS.N.N.CaptionColor"]);
    expect(merged.commands.SetGridSize?.setsProperty).toEqual(["Grid.GetColCount", "Grid.GetRowCount", "Grid.Count"]);

    for (const command of [
      "ClickLive",
      "ClickTCTabMode",
      "CloseUmax",
      "CueDown",
      "CueUp",
      "GoGridMode",
      "GoPlayListMode",
      "GoTimelineMode",
      "GoUniverseMode",
      "GroupCue",
      "HoldClick",
      "MultiCue",
      "OneCue",
      "OnePer",
      "PasteToCue",
      "PauseCue",
      "RestartCue",
      "SelectAllCat",
      "SelectCat",
      "SelectCatName",
      "SelectCue",
      "SelectNextCat",
      "SelectNextCatGrid1",
      "SelectPrevCat",
      "SelectPrevCatGrid1",
      "SetActiveGrid",
      "SetGridView",
      "SetPage",
      "SetPlayListView",
      "SetTimelineView",
      "SetUCenterPage",
      "SetUEditPage",
      "SetUMaxPage",
      "SetUniverseView",
      "SetUPreviewPage",
      "SetURightPage",
      "SetUToolPage",
      "StartCue",
      "StartCueMulti",
      "StartPrevious",
      "StopCue",
      "ToggleCue",
      "ToggleCueMulti",
      "TogglePrevious",
      "ToggleUCenterPage",
      "ToggleUEditPage",
      "ToggleUMaxPage",
      "ToggleUPreviewPage",
      "ToggleURightPage",
      "ToggleUToolPage",
      "UnselectAllCue",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships grid and click range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((param) => param.name === paramName) as
        | (Record<string, unknown> & {
            acceptedValues?: Array<Record<string, unknown>>;
            valueRange?: Record<string, unknown>;
          })
        | undefined;

    const gridColumns = findParam("SetGridSize", "SetGridSize <columns>, <rows>", "columns");
    const gridRows = findParam("SetGridSize", "SetGridSize <columns>, <rows>", "rows");
    const moveHorizontal = findParam("MoveFocus", "MoveFocus <horizontal>, <vertical>", "horizontal");
    const moveVertical = findParam("MoveFocus", "MoveFocus <horizontal>, <vertical>", "vertical");
    const shiftCells = findParam("ShiftFocus", "ShiftFocus <cells>", "cells");
    const selectCatIndex = findParam("SelectCat", "SelectCat <index>", "index");
    const holdState = findParam("HoldClick", "HoldClick <state>", "state");

    expect(gridColumns).toMatchObject({
      range: "1..16",
      valueRange: {
        min: 1,
        max: 16,
        unit: "columns",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(gridRows).toMatchObject({
      range: "1..16",
      valueRange: {
        min: 1,
        max: 16,
        unit: "rows",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });
    expect(moveHorizontal).toMatchObject({
      range: "relative; result wraps modulo Grid.Count",
      valueRange: {
        unit: "columns",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(moveVertical).toMatchObject({
      range: "relative rows; result wraps modulo Grid.Count",
      valueRange: {
        unit: "rows",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(shiftCells).toMatchObject({
      range: "relative; result wraps modulo Grid.Count",
      valueRange: {
        unit: "cells",
        boundaryBehavior: "wrap",
        evidenceLevel: "observed",
      },
    });
    expect(selectCatIndex).toMatchObject({
      range: "-1 or 1..category count; no readable category count property",
      valueRange: {
        min: 1,
        unit: "category index",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(selectCatIndex?.acceptedValues).toEqual([expect.objectContaining({ value: -1, label: "All categories" })]);
    expect(holdState).toMatchObject({
      range:
        "0..1 documented; representative writes sent for -1, 0, 1, 2, and 999 with no readable hold-state property",
      valueRange: {
        min: 0,
        max: 1,
        unit: "hold state",
        boundaryBehavior: "unknown",
        evidenceLevel: "unverified",
      },
    });
    expect(holdState?.acceptedValues).toEqual([
      expect.objectContaining({ value: 0, label: "OFF" }),
      expect.objectContaining({ value: 1, label: "ON" }),
    ]);
  });

  it("classifies timeline, playlist, player, and transition command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.PlayListSetTime?.setsProperty).toEqual(["PlayListState.Position"]);
    expect(merged.commands.PlayListStop?.setsProperty).toEqual(["PlayListState.Playing"]);
    expect(merged.commands.TimelineEnableTC?.setsProperty).toEqual(["Master.TcInEnabled"]);
    expect(merged.commands.Transition?.setsProperty).toEqual(["Master.TransitionState"]);

    for (const command of ["LoadPlaylist", "TimelineAddMarker", "TimelineMarker", "TimelineQuickSave"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "InvertPlayersTime",
      "PlayListFirst",
      "PlayListLast",
      "PlayTimeline",
      "PlayersDisk",
      "PlayersDiskShift",
      "PlayersResetJump",
      "PlayersSetJump",
      "PlayersSetLoop",
      "RestorePlayer",
      "SetTransitionTime",
      "StopTimeline",
      "TimelineFirstTab",
      "TimelineJumpDelta",
      "TimelineJumpToEnd",
      "TimelineJumpToStart",
      "TimelineLastTab",
      "TimelineNextEditPoint",
      "TimelineNextMarker",
      "TimelineNextTab",
      "TimelinePlay",
      "TimelinePlayFromMarker",
      "TimelinePrevEditPoint",
      "TimelinePrevMarker",
      "TimelinePrevTab",
      "TimelineSetPos",
      "TimelineSetTabIndex",
      "TimelineSetTabName",
      "TimelineSetViewRange",
      "TimelineShiftViewRange",
      "TimelineShowItNow",
      "TimelineStop",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("ships timeline, playlist, and player position range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    expect(findParam("PlayListSetTime", "PlayListSetTime <seconds>", "seconds")).toMatchObject({
      type: "number",
      range: ">=0 observed; negative clamps to 0; upper pass-through observed through 5000 with duration 3000",
      valueRange: {
        min: 0,
        unit: "seconds",
        boundaryBehavior: "unknown",
        evidenceLevel: "observed",
      },
    });

    for (const [commandName, signature, paramName, unit, range] of [
      [
        "TimelineSetPos",
        "TimelineSetPos <seconds>",
        "seconds",
        "seconds",
        "no readable range evidence; representative writes sent for -1, 0, 10, and 100000",
      ],
      [
        "TimelineJumpDelta",
        "TimelineJumpDelta <seconds>",
        "seconds",
        "seconds delta",
        "no readable range evidence; representative writes sent for -5, 1, and 100000",
      ],
      [
        "TimelineSetTabIndex",
        "TimelineSetTabIndex <index>",
        "index",
        "tab index",
        "no readable range evidence; representative writes sent for 0, 1, and 1000",
      ],
      [
        "TimelineShiftViewRange",
        "TimelineShiftViewRange <seconds>",
        "seconds",
        "seconds delta",
        "no readable range evidence; representative writes sent for -10, 10, and 100000",
      ],
      [
        "PlayersDiskShift",
        "PlayersDiskShift <positionDelta>",
        "positionDelta",
        "radians delta",
        "no readable range evidence; representative writes sent for -0.1, 0, and 0.1",
      ],
    ] as const) {
      expect(merged.commands[commandName]?.propertyMappingCoverage).toMatchObject({
        status: "no-direct-property",
        evidenceLevel: "observed",
      });
      expect(findParam(commandName, signature, paramName)).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }

    for (const paramName of ["fromSeconds", "toSeconds"] as const) {
      expect(
        findParam("TimelineSetViewRange", "TimelineSetViewRange <fromSeconds>, <toSeconds>", paramName),
      ).toMatchObject({
        range: "no readable range evidence; representative writes sent for 0..30, 30..0, and 0..60",
        valueRange: {
          unit: "seconds",
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
    }
  });

  it("ships blocked player and blob-load range metadata", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const findParam = (commandName: string, signature: string, paramName: string) =>
      merged.commands[commandName]?.forms
        ?.find((form) => form.signature === signature)
        ?.parameters?.find((candidate) => candidate.name === paramName) as
        | (Record<string, unknown> & { valueRange?: Record<string, unknown> })
        | undefined;

    const loadCuePage = findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "page");
    expect(loadCuePage).toMatchObject({
      range: "zero-based page index per BEYOND documentation; upper bound and PangoScript usability unverified",
      valueRange: {
        min: 0,
        unit: "blob target page index",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(loadCuePage?.valueRange).not.toHaveProperty("max");

    const loadCueCell = findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "cue");
    expect(loadCueCell).toMatchObject({
      range: "zero-based cue index per BEYOND documentation; upper bound and PangoScript usability unverified",
      valueRange: {
        min: 0,
        unit: "blob target cue index",
        boundaryBehavior: "unknown",
        evidenceLevel: "documented",
      },
    });
    expect(loadCueCell?.valueRange).not.toHaveProperty("max");

    expect(findParam("LoadCueFromBlob", "LoadCueFromBlob <page>, <cue>, <stream>", "stream")).toMatchObject({
      type: "unknown",
      range: "binary stream argument; explicitly not supported by PangoScript",
    });

    for (const [commandName, paramName, type, unit, range] of [
      [
        "LoadZoneFromBlob",
        "param1",
        "integer",
        "internal blob-load selector",
        "undocumented HTTP/blob parameter; selector meaning and bounds unverified",
      ],
      [
        "LoadZoneFromBlob",
        "param2",
        "unknown",
        "internal blob-load argument",
        "undocumented HTTP/blob parameter; type and bounds unverified",
      ],
    ] as const) {
      const param = findParam(commandName, "LoadZoneFromBlob <param1>, <param2>", paramName);
      expect(param, `${commandName}.${paramName}`).toMatchObject({
        type,
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    for (const [paramName, unit, range] of [
      [
        "page",
        "captured player page index",
        "deprecated captured-state page index; indexing basis and bounds unverified",
      ],
      ["cue", "captured player cue index", "deprecated captured-state cue index; indexing basis and bounds unverified"],
      ["options", "restore option bit mask", "deprecated options bit mask; flag meanings and bounds unverified"],
      ["UserID", "caller ID", "deprecated caller ID; 0, 1, and out-of-range behavior unverified"],
      ["Clock", "seconds, likely", "deprecated captured clock value; units likely seconds; 0.0 and bounds unverified"],
      [
        "param7",
        "unknown restore parameter",
        "deprecated final numeric parameter; purpose, units, and bounds unverified",
      ],
    ] as const) {
      const param = findParam(
        "RestorePlayer",
        "RestorePlayer <page>, <cue>, <options>, <UserID>, <Routing>, <Clock>, <param7>",
        paramName,
      );
      expect(param, `RestorePlayer.${paramName}`).toMatchObject({
        range,
        valueRange: {
          unit,
          boundaryBehavior: "unknown",
          evidenceLevel: "unverified",
        },
      });
      expect(param?.valueRange).not.toHaveProperty("min");
      expect(param?.valueRange).not.toHaveProperty("max");
    }

    expect(
      findParam(
        "RestorePlayer",
        "RestorePlayer <page>, <cue>, <options>, <UserID>, <Routing>, <Clock>, <param7>",
        "Routing",
      ),
    ).toMatchObject({
      range: "deprecated routing token/string; accepted values unverified",
    });

    for (const commandName of ["LoadCueFromBlob", "LoadZoneFromBlob", "RestorePlayer"]) {
      expect(merged.commands[commandName]?.verification).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "blocked",
            method: "operatorSupervised",
            expectedCallback: expect.stringContaining(
              "PangoLint lint acceptance and Talk UDP transmission are not range evidence",
            ),
          }),
        ]),
      );
    }
  });

  it("keeps private source labels out of merged command text", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const text = JSON.stringify(merged.commands).toLowerCase();

    expect(text).not.toContain("doc cache");
    expect(text).not.toContain("doc-cache");
    expect(text).not.toContain("local help doc");
    expect(text).not.toContain("help doc");
    expect(text).not.toContain("help-doc");
    expect(text).not.toContain("beyond commands doc");
  });

  it("classifies MIDI, DMX, OSC, trigger, and channel I/O command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.ChannelOut?.setsProperty).toEqual(["Channels.N.Value"]);
    expect(merged.commands.DmxOut?.setsProperty).toEqual(["DmxOutput.N"]);
    expect(merged.commands.DmxOutRange?.setsProperty).toEqual(["DmxOutput.N"]);
    expect(merged.commands.EnableDmxIn?.setsProperty).toEqual(["Master.DmxInEnabled"]);
    expect(merged.commands.SetButtonMSL?.setsProperty).toEqual(["MIDI1.ButtonMSL"]);
    expect(merged.commands.SetChannelToChannelRatio?.setsProperty).toEqual(["Master.ChannelToChannelRatio"]);
    expect(merged.commands.SetDmxToChannelRatio?.setsProperty).toEqual(["Master.DmxToChannelRatio"]);
    expect(merged.commands.SetEffectChannelAction?.setsProperty).toEqual(effectActionProps());
    expect(merged.commands.SetFFTToChannelRatio?.setsProperty).toEqual(["Master.FFTToChannelRatio"]);
    expect(merged.commands.SetGrid1MSL?.setsProperty).toEqual(["MIDI1.Grid1MSL"]);
    expect(merged.commands.SetGrid2MSL?.setsProperty).toEqual(["MIDI1.Grid2MSL"]);
    expect(merged.commands.SetMidiLayer?.setsProperty).toEqual(["MIDI1.Layer"]);
    expect(merged.commands.SetSliderMSL?.setsProperty).toEqual(["MIDI1.SliderMSL"]);
    expect(merged.commands.SetVdjToChannelRatio?.setsProperty).toEqual(["Master.VdjToChannelRatio"]);

    for (let index = 1; index <= 6; index += 1) {
      expect(merged.commands[`SetFX${index}MSL`]?.setsProperty).toEqual([`MIDI1.FX${index}MSL`]);
    }

    for (const command of ["Fb4DiscoveryMode", "RebootConnectedFB4", "StartFb4Discovery", "StopFb4Discovery"]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "DecreaseTrigger",
      "DefineDmxTrigger",
      "DefineMidiTrigger",
      "DefineTcTrigger",
      "DefineTrigger",
      "DmxInMute",
      "EnableFb3StyleDmxIn",
      "InRangeTrigger",
      "InRangeTriggerCmd",
      "IncreaseTrigger",
      "LessThanTrigger",
      "MidiOut",
      "MidiOutLong",
      "MidiSysexAdd",
      "MidiSysexSend",
      "MidiSysexStart",
      "MoreThanTrigger",
      "OscOut",
      "OscOutTTS",
      "OutOfRangeTrigger",
      "OutOfRangeTriggerCmd",
      "RefreshDmxIn",
      "RegisterOscFeedback",
      "ResetMidiFeedback",
      "ResetOscFeedback",
      "SelectMidi",
      "SetDmxEditorChannel",
      "WaitForAudioBeat",
      "WaitForBeat",
      "WaitForCellDown",
      "WaitForCellUp",
      "WaitForChannel",
      "WaitForCueStart",
      "WaitForCueStop",
      "WaitForDmx",
      "WaitForEvent",
      "WaitForHotKey",
      "WaitForManualBeat",
      "WaitForMidi",
      "WaitForPageChange",
      "WaitForTC",
      "WaitForTime",
      "WaitForTimePos",
      "WaitForTimerBeat",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("classifies object animation, limiter, mesh, preview, and utility command property coverage", () => {
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    for (const command of [
      "MeshCurve",
      "MeshPoint",
      "MeshPointChan",
      "MeshPolygon",
      "MeshRect",
      "MeshSpline",
      "MeshTriangle",
    ]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "AnimateProp",
      "AnimatePropDelta",
      "DeletePropAni",
      "MasterSpeed",
      "MasterTransitionTime",
      "PreviewAsUninverse",
      "PreviewMaster",
      "PreviewNxN",
      "SetLimiterBeam",
      "SetLimiterDMX",
      "SetLimiterFlash",
      "SetLimiterHold",
      "SetLimiterPerGrid",
      "SetLimiterProfile",
      "SetLimiterShow",
      "VLJFX",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });

  it("classifies runtime, host, UI, logging, and remaining action command property coverage", () => {
    const merged = readJson<PangoKnowledgeBase>("commands.merged.json");
    const coverage = readJson<CommandPropertyCoverageFile>("command-property-coverage.json");

    expect(merged.commands.DisableLaserOutput?.setsProperty).toEqual(["Status.LaserEnabled"]);
    expect(merged.commands.EnableLaserOutput?.setsProperty).toEqual(["Status.LaserEnabled"]);
    expect(merged.commands.FocusCell?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.FocusCellIndex?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.LockScreen?.setsProperty).toEqual(["Status.Locked"]);
    expect(merged.commands.MoveFocus?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.SetLocation?.setsProperty).toEqual(["Location.N.X", "Location.N.Y", "Location.N.Z"]);
    expect(merged.commands.ShiftFocus?.setsProperty).toEqual(["Grid.CellIndex"]);
    expect(merged.commands.UnLockScreen?.setsProperty).toEqual(["Status.Locked"]);

    for (const command of [
      "ExitBEYOND",
      "LoadCue",
      "LoadCueFromBlob",
      "LoadWorkspace",
      "MakeSecuredFile",
      "RunApp",
      "ShutDownWindows",
      "StartAudioRecord",
      "StartQuickRecord",
    ]) {
      expect(coverage.commands[command]?.status).toBe("deferred");
    }

    for (const command of [
      "AddSms",
      "AudioBeat",
      "Autostart",
      "BeatResync",
      "BeatTap",
      "BlackOut",
      "CaptureToClipboard",
      "Chat",
      "ClickScrollA",
      "ClickScrollAniSpeed",
      "ClickScrollB",
      "ClickScrollBeamBrush",
      "ClickScrollColor",
      "ClickScrollFade",
      "ClickScrollG",
      "ClickScrollHue",
      "ClickScrollHueShift",
      "ClickScrollR",
      "ClickScrollSaturation",
      "ClickScrollScanRate",
      "ClickScrollSize",
      "ClickScrollVPoints",
      "ClickScrollZoom",
      "CodeColorMarker",
      "CodeName",
      "CodeShortcut",
      "DisplayPopup",
      "DisplayPopupOnTop",
      "DisplayPreview",
      "Echo",
      "ExecCmd",
      "Exit",
      "Hello",
      "HtmlBody",
      "HtmlClearBody",
      "HtmlClearHead",
      "HtmlHead",
      "HtmlHide",
      "HtmlUpdate",
      "LinePerCycle",
      "LogError",
      "LogInfo",
      "LogWarning",
      "ManualBeat",
      "MoboNotify",
      "Password",
      "Pub",
      "PubObject",
      "PulseEvent",
      "QLog",
      "ReStartCell",
      "Restart",
      "ResyncByCueClick",
      "SelectGrid",
      "SetRecordFile",
      "SetUiFPS",
      "ShowHint",
      "ShowItNowSMS",
      "ShowMasterHelpFile",
      "Sleep",
      "StartCell",
      "StartCode",
      "StartTalkClient",
      "StartTalkServer",
      "StopAllAsync",
      "StopAllNow",
      "StopAllSync",
      "StopAudioRecord",
      "StopCell",
      "StopCode",
      "StopCueNow",
      "StopCueSync",
      "StopCueType",
      "StopOnBlackout",
      "StopQuickRecord",
      "StopTalkClient",
      "StopTalkServer",
      "SubCmd",
      "SubJson",
      "SubProp",
      "TapByCueClick",
      "TimerBeat",
      "ToggleCell",
      "Version",
      "VirtualLJ",
      "Write",
      "WriteLn",
    ]) {
      expect(coverage.commands[command]?.status).toBe("no-direct-property");
    }
  });
});

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, runtimeIndexPath(fileName)), "utf8")) as T;
}

function runtimeIndexPath(fileName: string): string {
  if (fileName === "known-properties.json" || fileName === "object-property-index.json") {
    return path.join("object-tree", "runtime-indexes", fileName);
  }
  return objectTreeSourceFactPath(fileName);
}

function objectTreeSourceFactPath(fileName: string): string {
  if (fileName === "object-range-evidence.schema.json") {
    return path.join("object-tree", "evidence", "value.schema.json");
  }
  if (fileName.startsWith("object-range-evidence/")) {
    return path.join("object-tree", "evidence", "value", fileName.slice("object-range-evidence/".length));
  }
  if (fileName === "object-readback-evidence.schema.json") {
    return path.join("object-tree", "evidence", "readback.schema.json");
  }
  if (fileName.startsWith("object-readback-evidence/")) {
    return path.join("object-tree", "evidence", "readback", fileName.slice("object-readback-evidence/".length));
  }
  if (fileName.startsWith("object-behavior-evidence/")) {
    return path.join("object-tree", "evidence", "behavior", fileName.slice("object-behavior-evidence/".length));
  }
  if (fileName === "object-behavior-audits/issue-216-object-behavior-audit.json") {
    return path.join("object-tree", "audits", "behavior", "issue-216-object-behavior-audit.json");
  }
  if (fileName === "object-behavior-audits/final-object-data-quality-audit.json") {
    return path.join("object-tree", "audits", "data-quality", "final-object-data-quality-audit.json");
  }
  if (fileName.startsWith("object-readback-audits/")) {
    return path.join("object-tree", "audits", "readback", fileName.slice("object-readback-audits/".length));
  }
  if (fileName === "object-property-ranges.json") {
    return path.join("object-tree", "source-facts", "value-metadata", "root.json");
  }
  if (fileName === "object-property-ranges.schema.json") {
    return path.join("object-tree", "source-facts", "value-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-ranges/")) {
    const childPath =
      fileName === "object-property-ranges/zone/direct-leftover-controls.json"
        ? path.join("zone", "visualization-id-range.json")
        : fileName.slice("object-property-ranges/".length);
    return path.join("object-tree", "source-facts", "value-metadata", childPath);
  }
  if (fileName === "object-property-readbacks.json") {
    return path.join("object-tree", "source-facts", "readback-metadata", "root.json");
  }
  if (fileName === "object-property-readbacks.schema.json") {
    return path.join("object-tree", "source-facts", "readback-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-readbacks/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "readback-metadata",
      fileName.slice("object-property-readbacks/".length),
    );
  }
  if (fileName === "object-property-classifications.json") {
    return path.join("object-tree", "source-facts", "behavior-metadata", "root.json");
  }
  if (fileName === "object-property-classifications.schema.json") {
    return path.join("object-tree", "source-facts", "behavior-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-classifications/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "behavior-metadata",
      fileName.slice("object-property-classifications/".length),
    );
  }
  return fileName;
}

function readObjectPropertyRangeOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyRangeOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "value-metadata", "root.json");
  return [
    rootOverlayPath,
    ...objectPropertyRangeOverlayPaths(path.join(dataDir, "object-tree", "source-facts", "value-metadata")).filter(
      (filePath) => filePath !== rootOverlayPath,
    ),
  ].map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyRangeOverlayFile,
  }));
}

function objectPropertyRangeOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyRangeOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readObjectPropertyReadbackOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyReadbackOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "readback-metadata", "root.json");
  const filePaths = [
    ...(existsSync(rootOverlayPath) ? [rootOverlayPath] : []),
    ...objectPropertyReadbackOverlayPaths(
      path.join(dataDir, "object-tree", "source-facts", "readback-metadata"),
    ).filter((filePath) => filePath !== rootOverlayPath),
  ];
  return filePaths.map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyReadbackOverlayFile,
  }));
}

function objectPropertyReadbackOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyReadbackOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readObjectPropertyClassificationOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyBehaviorClassificationOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "behavior-metadata", "root.json");
  const filePaths = [
    ...(existsSync(rootOverlayPath) ? [rootOverlayPath] : []),
    ...objectPropertyClassificationOverlayPaths(
      path.join(dataDir, "object-tree", "source-facts", "behavior-metadata"),
    ).filter((filePath) => filePath !== rootOverlayPath),
  ];
  return filePaths.map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyBehaviorClassificationOverlayFile,
  }));
}

function objectPropertyClassificationOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyClassificationOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readObjectReadbackEvidenceFiles(): Array<{
  relativePath: string;
  report: ObjectReadbackEvidenceReport;
}> {
  const evidenceDirectory = path.join(dataDir, "object-tree", "evidence", "readback");
  return objectReadbackEvidencePaths(evidenceDirectory).map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    report: JSON.parse(readFileSync(filePath, "utf8")) as ObjectReadbackEvidenceReport,
  }));
}

function objectReadbackEvidencePaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectReadbackEvidencePaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function fxProps(suffix: string, count = 6): string[] {
  return Array.from({ length: count }, (_, index) => `Master.FX${index + 1}${suffix}`);
}

function effectActionProps(): string[] {
  return [
    "Master.EffectChannelAction",
    ...Array.from({ length: 8 }, (_, index) => `Master.EffectChannelAction${index + 1}`),
  ];
}

interface CommandPropertyCoverageFile {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    mapped: number;
    noDirectProperty: number;
    deferred: number;
    unknown: number;
  };
  commands: Record<
    string,
    {
      canonical: string;
      category: string;
      status: "mapped" | "no-direct-property" | "deferred" | "unknown";
      evidenceLevel: string;
      safetyTier: string;
      setsProperty?: string[];
      notes?: string;
      probe?: {
        setupScript?: string;
        triggerScript?: string;
        readbackPaths?: string[];
        restoreScript?: string;
        notes?: string;
      };
    }
  >;
}

interface ObjectPropertyRangeOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyValueMetadata & { contextId?: string; path: string }>;
}

interface ObjectPropertyReadbackOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
}

interface ObjectPropertyBehaviorClassificationOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyBehaviorClassification & { path: string }>;
}

interface ObjectReadbackEvidenceReport {
  schemaVersion: 1;
  parentIssue?: number;
  batchIssue?: number;
  runtime: {
    observedAt: string;
    beyondVersion?: string;
    operatorSupervised: boolean;
    noLaserConnected?: boolean;
    talkHost?: string;
    talkPort?: number;
    oscListenHost?: string;
    oscListenPort?: number;
    notes?: string;
  };
  entries: ObjectReadbackEvidenceEntry[];
}

interface ObjectReadbackEvidenceEntry {
  objectPath: string;
  probePath: string;
  probeMode: "readback-only";
  valueType: string;
  baseline: {
    value: string | number | boolean | null;
    typeTag?: string;
  };
  evidenceNote: string;
  locationAware: boolean;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    concreteContext?: string;
    notes?: string;
  };
  restore: {
    strategy: string;
    restoredValue?: string | number | boolean | null;
    notes: string;
  };
}

interface ObjectPropertyProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
  populationDependent?: boolean;
  notes?: string;
}

interface ObjectPropertyValueMetadata {
  valueType?: string;
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: {
      expression: string;
      sourcePaths?: string[];
      notes?: string;
    };
    minInclusive?: boolean;
    maxInclusive?: boolean;
    unit?: string;
    boundaryBehavior?: string;
    evidenceLevel?: string;
    notes?: string;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
    label?: string;
    description?: string;
  }>;
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel: string;
  notes?: string;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

interface ObjectPropertyReadbackMetadata {
  readable: true;
  valueType?: string;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: string;
  evidenceLevel: string;
  observedAt?: string;
  notes?: string;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

interface ObjectPropertyBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel: string;
  notes?: string;
}

function assertObjectPropertyValueMetadata(metadata: ObjectPropertyValueMetadata): void {
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  if (metadata.valueType !== undefined) {
    expect(["number", "integer", "float", "string", "boolean", "enum", "unknown"]).toContain(metadata.valueType);
  }
  if (metadata.valueRange) {
    const { min, max, dynamicMax, boundaryBehavior, evidenceLevel } = metadata.valueRange;
    if (min !== undefined && max !== undefined) expect(min).toBeLessThanOrEqual(max);
    if (dynamicMax !== undefined) {
      expect(dynamicMax.expression.trim().length).toBeGreaterThan(0);
      if (dynamicMax.sourcePaths !== undefined) {
        expect(dynamicMax.sourcePaths.length).toBeGreaterThan(0);
        for (const sourcePath of dynamicMax.sourcePaths) expect(sourcePath.trim().length).toBeGreaterThan(0);
      }
    }
    if (boundaryBehavior !== undefined) {
      expect(["clamp", "reject", "no-op", "wrap", "pass-through", "unknown"]).toContain(boundaryBehavior);
    }
    if (evidenceLevel !== undefined) {
      expect(["documented", "observed", "inferred", "unverified"]).toContain(evidenceLevel);
    }
  }
  for (const accepted of metadata.acceptedValues ?? []) {
    expect(["string", "number", "boolean"]).toContain(typeof accepted.value);
  }
  if (metadata.locationContext) {
    expect(["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"]).toContain(
      metadata.locationContext.kind,
    );
  }
}

function assertObjectPropertyReadbackMetadata(metadata: ObjectPropertyReadbackMetadata): void {
  expect(metadata.readable).toBe(true);
  expect(metadata.probeMode).toBe("readback-only");
  expect(metadata.probePath.trim().length).toBeGreaterThan(0);
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  if (metadata.valueType !== undefined) {
    expect(["number", "integer", "float", "string", "boolean", "enum", "unknown"]).toContain(metadata.valueType);
  }
  if (metadata.observedValue !== undefined && metadata.observedValue !== null) {
    expect(["string", "number", "boolean"]).toContain(typeof metadata.observedValue);
  }
  if (metadata.typeTag !== undefined) expect(["f", "i", "s"]).toContain(metadata.typeTag);
  if (metadata.observedAt !== undefined) expect(metadata.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  if (metadata.notes !== undefined) expect(metadata.notes.trim().length).toBeGreaterThan(0);
  if (metadata.locationContext) {
    expect(["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"]).toContain(
      metadata.locationContext.kind,
    );
  }
}

function assertObjectPropertyBehaviorClassification(metadata: ObjectPropertyBehaviorClassification): void {
  expect(["read-write", "read-only", "write-only", "read-mostly", "unknown"]).toContain(metadata.accessMode);
  expect([
    "state-value",
    "flag-state",
    "momentary-action",
    "enum-state",
    "string-state",
    "computed-status",
    "alias-status",
    "fixture-dependent",
    "unknown",
  ]).toContain(metadata.behaviorKind);
  expect([
    "not-tested",
    "write-readback-tested",
    "command-readback-tested",
    "write-no-op-tested",
    "write-rejected-tested",
    "documented-writable",
    "documented-read-only",
    "not-applicable",
  ]).toContain(metadata.writeTestStatus);
  expect([
    "not-tested",
    "readback-tested",
    "readback-not-available",
    "documented-readable",
    "not-applicable",
  ]).toContain(metadata.readbackStatus);
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  expect(metadata.notes?.trim().length ?? 0).toBeGreaterThan(0);
}

function hasManualReadyValueMetadata(metadata: ObjectPropertyValueMetadata): boolean {
  return (
    (metadata.valueRange?.min !== undefined && metadata.valueRange.max !== undefined) ||
    (metadata.valueRange?.min !== undefined && metadata.valueRange.dynamicMax !== undefined) ||
    Boolean(metadata.acceptedValues?.length)
  );
}

function findPropertyPaths(value: unknown, propertyName: string, prefix = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findPropertyPaths(item, propertyName, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    if (key === propertyName) paths.push(path);
    paths.push(...findPropertyPaths(child, propertyName, path));
  }
  return paths;
}

const forbiddenDescriptionVerificationPatterns: Array<[string, RegExp]> = [
  ["positive verified wording", /\b(?:runtime-)?verified\b|\bverification\[\]|by visual observation/i],
  [
    "runtime proof wording",
    /\b(?:Runtime readback|readback probe confirmed|probe confirmed|readback probe observed|Fresh MCP probe|MCP probe|Probed live|freshly observed|operator confirmation|tested span)\b/i,
  ],
  ["dated proof wording", /\b\d{4}-\d{2}-\d{2}\b/],
  ["private build label", /\b(?:post-)?build-\d{4}\b/i],
  ["observed proof wording", /\bobserved\b/i],
];

const forbiddenDescriptionSourcePatterns: Array<[string, RegExp]> = [
  ["Pangolin Wiki source label", /\bPangolin Wiki\b/i],
  ["BEYOND export source label", /\bBEYOND export\b|\bexport\b/i],
  ["private doc cache label", /\b(?:local help doc|doc[- ]cache|documentation cache|commands doc cache)\b/i],
  ["private source line label", /\b(?:line|lines)\s+\d{2,}\b/i],
];

function findForbiddenDescriptionClaims(value: unknown, prefix = "$", key = ""): string[] {
  if (typeof value === "string") {
    if (key !== "description") return [];
    const normalized = stripNegativeVerificationWording(value);
    return [...forbiddenDescriptionVerificationPatterns, ...forbiddenDescriptionSourcePatterns]
      .filter(([, pattern]) => pattern.test(normalized))
      .map(([label]) => `${prefix}: ${label}`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenDescriptionClaims(item, `${prefix}[${index}]`, String(index)));
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([childKey, child]) =>
    findForbiddenDescriptionClaims(child, `${prefix}.${childKey}`, childKey),
  );
}

function stripNegativeVerificationWording(value: string): string {
  return value
    .replace(/\bunverified\b/gi, "")
    .replace(/\bnot verified\b/gi, "")
    .replace(/\bnot directly verified\b/gi, "")
    .replace(/\bcannot be directly verified\b/gi, "")
    .replace(/\bhas not been verified\b/gi, "");
}
