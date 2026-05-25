import { describe, expect, it } from "vitest";
import {
  assertObjectPropertyBehaviorClassification,
  assertObjectPropertyReadbackMetadata,
  assertObjectPropertyValueMetadata,
  hasManualReadyValueMetadata,
  type ObjectPropertyBehaviorClassification,
  type ObjectPropertyBehaviorClassificationOverlayFile,
  type ObjectPropertyReadbackMetadata,
  type ObjectPropertyValueMetadata,
  readJson,
  readObjectPropertyReadbackOverlayFiles,
  readObjectReadbackEvidenceFiles,
} from "./readKnowledgeTestData";

describe("checked-in Object Tree readback metadata data", () => {
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
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.AngleY",
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.AngleZ",
        { valueType: "number", min: -100, max: 100, unit: "scaled angle readback", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.AudioMode",
        { valueType: "number", min: -1, max: 10, unit: "audio mode", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.Color",
        {
          valueType: "integer",
          min: 0,
          max: 16777215,
          unit: "RGB color integer",
          boundaryBehavior: "mixed",
          evidenceBoundaryBehavior: "unknown",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.Image.Radius",
        { valueType: "number", min: 0, max: 6553400, unit: "radius readback", boundaryBehavior: "clamp" },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionX",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "pass-through",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionY",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "pass-through",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.PositionZ",
        {
          valueType: "number",
          min: -1073676288,
          max: 1073676288,
          unit: "internal position coordinate",
          boundaryBehavior: "pass-through",
        },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeX",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeY",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "pass-through" },
      ],
      [
        "WS.N.N.Image.LIST.0.SizeZ",
        { valueType: "number", min: -1, max: 1, unit: "internal size scale", boundaryBehavior: "pass-through" },
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
        boundaryBehavior: expectedRange?.evidenceBoundaryBehavior ?? expectedRange?.boundaryBehavior,
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
      ["WS.N.N.Image.0.SizeMOD1", { min: -200, max: 199, unit: "size modulation", boundaryBehavior: "mixed" }],
      ["WS.N.N.Image.0.SizeMOD2", { min: -200, max: 199, unit: "size modulation", boundaryBehavior: "mixed" }],
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
        { contextId: "cue-type:shape", valueType: "number", min: 0, max: 6553400, behavior: "clamp" },
      ],
      [
        "WS.N.N.Image.RotoDeceleration",
        { contextId: "cue-type:particles", valueType: "number", min: -1, max: 1, behavior: "pass-through" },
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

  it("ships issue 124 WS image numeric boundary spot checks", () => {
    const rangeEvidence = readJson<{
      parentIssue: number;
      batchIssue: number;
      runtime: {
        observedAt: string;
        notes: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        boundaryBehavior: string;
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
      }>;
    }>("object-range-evidence/issue-124-ws-image-numeric-boundary-spot-checks.json");
    const byPath = new Map(rangeEvidence.entries.map((entry) => [entry.objectPath, entry]));

    expect(rangeEvidence).toMatchObject({
      parentIssue: 216,
      batchIssue: 124,
      runtime: {
        observedAt: "2026-05-25",
        notes: expect.stringContaining("Talk TCP Echo 2"),
      },
    });
    expect(rangeEvidence.entries).toHaveLength(11);
    expect(byPath.get("WS.N.N.Image.0.SizeMOD1")).toMatchObject({
      boundaryBehavior: "mixed",
      testedValues: [expect.objectContaining({ input: 200, readback: -200, behavior: "wrap" })],
    });

    for (const axis of ["X", "Y", "Z"]) {
      expect(byPath.get(`WS.N.N.Image.LIST.0.Angle${axis}`)).toMatchObject({
        boundaryBehavior: "pass-through",
        testedValues: [
          expect.objectContaining({ input: -10001, readback: -100.01000213623048 }),
          expect.objectContaining({ input: 10001, readback: 100.01000213623048 }),
        ],
      });
      expect(byPath.get(`WS.N.N.Image.LIST.0.Position${axis}`)).toMatchObject({
        boundaryBehavior: "pass-through",
        testedValues: [
          expect.objectContaining({ input: -10001, readback: -1073783680 }),
          expect.objectContaining({ input: 10001, readback: 1073783680 }),
        ],
      });
      expect(byPath.get(`WS.N.N.Image.LIST.0.Size${axis}`)).toMatchObject({
        boundaryBehavior: "pass-through",
        testedValues: [
          expect.objectContaining({ input: -10001, readback: -1.000100016593933 }),
          expect.objectContaining({ input: 10001, readback: 1.000100016593933 }),
        ],
      });
    }

    expect(byPath.get("WS.N.N.Image.RotoDeceleration")).toMatchObject({
      boundaryBehavior: "pass-through",
      testedValues: [
        expect.objectContaining({ input: -10001, readback: -1.000100016593933 }),
        expect.objectContaining({ input: 10001, readback: 1.000100016593933 }),
      ],
    });
    for (const entry of rangeEvidence.entries) {
      expect(entry.restore).toMatchObject({
        strategy: "command-restore",
        restoredValue: 0,
      });
      expect(entry.restore.notes).toContain("verified final readback 0");
    }
  });
});
