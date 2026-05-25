import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateObjectRangeEvidenceReport } from "../../src/knowledge/objectRangeEvidence";

describe("object range evidence validation", () => {
  it("accepts the checked-in valid evidence example", () => {
    const report = JSON.parse(
      readFileSync(path.join(process.cwd(), "tests", "fixtures", "object-range-evidence.valid.json"), "utf8"),
    ) as unknown;

    expect(validateObjectRangeEvidenceReport(report)).toEqual([]);
  });

  it("accepts checked-in object range evidence reports", () => {
    const evidenceDir = path.join(process.cwd(), "data", "pangoscript", "object-tree", "evidence", "value");
    expect(existsSync(evidenceDir)).toBe(true);

    const files = readdirSync(evidenceDir)
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toContain("issue-289-safe-small-global-roots.json");

    for (const file of files) {
      const report = JSON.parse(readFileSync(path.join(evidenceDir, file), "utf8")) as unknown;
      expect(validateObjectRangeEvidenceReport(report), file).toEqual([]);
    }
  });

  it("ships seeded final Object Tree sampled audit evidence", () => {
    const report = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "data",
          "pangoscript",
          "object-tree",
          "evidence",
          "value",
          "issue-216-sampled-audit.json",
        ),
        "utf8",
      ),
    ) as {
      runtime: {
        observedAt: string;
        notes?: string;
      };
      entries: Array<{
        objectPath: string;
        probePath: string;
        probeMode: string;
        shipsMetadata: boolean;
        valueType: string;
        boundaryBehavior?: string;
        baseline: {
          typeTag?: string;
        };
        testedValues: Array<{
          input?: string | number | boolean;
          behavior: string;
        }>;
        locationAware: boolean;
        locationContext?: {
          kind: string;
          concreteContext?: string;
        };
      }>;
    };
    const index = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "data", "pangoscript", "object-tree", "runtime-indexes", "object-property-index.json"),
        "utf8",
      ),
    ) as {
      entries: Array<{
        path: string;
        valueMetadata?: unknown;
        contextValueMetadata?: unknown[];
        readbackMetadata?: unknown;
      }>;
    };
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));

    expect(validateObjectRangeEvidenceReport(report)).toEqual([]);
    expect(report.runtime.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(report.runtime.notes).toContain("seeded sampled audit");
    expect(report.entries).toHaveLength(60);
    expect(new Set(report.entries.map((entry) => entry.objectPath)).size).toBeGreaterThan(45);
    expect(report.entries.every((entry) => entry.probeMode === "command-write-readback")).toBe(true);

    const valueTypes = Array.from(new Set(report.entries.map((entry) => entry.valueType)));
    expect(valueTypes).toEqual(expect.arrayContaining(["boolean", "integer", "number", "string"]));

    const boundaryBehaviors = Array.from(new Set(report.entries.map((entry) => entry.boundaryBehavior)));
    expect(boundaryBehaviors).toEqual(expect.arrayContaining(["clamp", "no-op", "pass-through"]));
    expect(report.entries.filter((entry) => entry.boundaryBehavior === "clamp").length).toBeGreaterThanOrEqual(20);
    expect(report.entries.filter((entry) => entry.boundaryBehavior === "pass-through").length).toBeGreaterThanOrEqual(
      10,
    );
    expect(report.entries.filter((entry) => entry.boundaryBehavior === "no-op").length).toBeGreaterThanOrEqual(10);
    expect(report.entries.filter((entry) => entry.locationAware).length).toBeGreaterThanOrEqual(8);
    expect(report.entries.filter((entry) => entry.valueType === "string").length).toBeGreaterThanOrEqual(8);
    expect(report.entries.filter((entry) => entry.valueType === "boolean").length).toBeGreaterThanOrEqual(8);
    expect(report.entries.filter((entry) => entry.baseline.typeTag === "s").length).toBeGreaterThanOrEqual(8);
    expect(report.entries.filter((entry) => entry.baseline.typeTag === "i").length).toBeGreaterThanOrEqual(5);
    expect(report.entries.filter((entry) => entry.shipsMetadata).length).toBeGreaterThanOrEqual(45);
    expect(report.entries.filter((entry) => !entry.shipsMetadata).length).toBeGreaterThanOrEqual(10);
    expect(
      report.entries.some((entry) =>
        entry.testedValues.some((testedValue) => typeof testedValue.input === "number" && testedValue.input > 100000),
      ),
    ).toBe(true);
    expect(
      report.entries.some((entry) =>
        entry.testedValues.some((testedValue) => typeof testedValue.input === "number" && testedValue.input < 0),
      ),
    ).toBe(true);
    expect(
      report.entries.some((entry) =>
        entry.testedValues.some(
          (testedValue) => typeof testedValue.input === "string" && testedValue.input.length >= 254,
        ),
      ),
    ).toBe(true);

    for (const entry of report.entries) {
      const indexed = byPath.get(entry.objectPath);
      expect(indexed, entry.objectPath).toBeDefined();
      expect(
        Boolean(indexed?.valueMetadata) ||
          Boolean(indexed?.readbackMetadata) ||
          Boolean(indexed?.contextValueMetadata?.length),
        entry.objectPath,
      ).toBe(true);
      expect(entry.testedValues.length, entry.objectPath).toBeGreaterThanOrEqual(3);
      if (entry.locationAware) {
        expect(entry.locationContext?.concreteContext, entry.objectPath).toBeTruthy();
        expect(entry.probePath, entry.objectPath).not.toBe(entry.objectPath);
      }
    }
  });

  it("requires shipped metadata evidence to include a range or domain", () => {
    const report = validReport();
    delete report.entries[0].valueRange;
    delete report.entries[0].acceptedValues;

    expect(validateObjectRangeEvidenceReport(report)).toContain(
      "entries[0] ships metadata but has neither valueRange.min/max nor acceptedValues",
    );
  });

  it("accepts shipped metadata with a dynamic maximum expression", () => {
    const report = validReport();
    delete report.entries[0].acceptedValues;
    report.entries[0].valueRange = {
      min: 0,
      unit: "page index",
      dynamicMax: {
        expression: "Grid.Count - 1",
        sourcePaths: ["Grid.Count"],
        notes: "Max follows the loaded show's grid page count.",
      },
    };

    expect(validateObjectRangeEvidenceReport(report)).toEqual([]);
  });

  it("requires deferred evidence to explain why it is not shipped", () => {
    const report = validReport();
    report.entries[0].shipsMetadata = false;
    delete report.entries[0].deferReason;

    expect(validateObjectRangeEvidenceReport(report)).toContain(
      "entries[0] does not ship metadata and must include deferReason",
    );
  });

  it("allows mixed boundary behavior only on the aggregate entry", () => {
    const report = validReport();
    report.entries[0].boundaryBehavior = "mixed";
    expect(validateObjectRangeEvidenceReport(report)).toEqual([]);

    report.entries[0].testedValues[0].behavior = "mixed";
    expect(validateObjectRangeEvidenceReport(report)).toContain(
      "entries[0].testedValues[0].behavior must be one of clamp, reject, no-op, wrap, pass-through, unknown",
    );
  });

  it("requires concrete probe paths for location-aware entries", () => {
    const report = validReport();
    report.entries[0].objectPath = "WS.N.N.PositionX";
    report.entries[0].probePath = "WS.N.N.PositionX";
    report.entries[0].locationAware = true;
    report.entries[0].locationContext = {
      kind: "workspace-slot",
      populationDependent: true,
      concreteContext: "Frame cue",
    };

    expect(validateObjectRangeEvidenceReport(report)).toContain(
      "entries[0].probePath must be a concrete populated path when locationAware is true",
    );
  });

  it("rejects unknown properties at every evidence object level", () => {
    const report = JSON.parse(JSON.stringify(validReport())) as Record<string, unknown>;
    report.internalToolPath = "private-tools/local";

    const runtime = report.runtime as Record<string, unknown>;
    runtime.captureFile = "private.json";

    const entry = ((report.entries as unknown[])[0] ?? {}) as Record<string, unknown>;
    entry.unverifiedNote = "typo";

    const baseline = entry.baseline as Record<string, unknown>;
    baseline.rawPath = "private";

    const valueRange = entry.valueRange as Record<string, unknown>;
    valueRange.observedOnly = true;

    const acceptedValue = ((entry.acceptedValues as unknown[])[0] ?? {}) as Record<string, unknown>;
    acceptedValue.extraLabel = "private";

    const testedValue = ((entry.testedValues as unknown[])[0] ?? {}) as Record<string, unknown>;
    testedValue.source = "private";

    const restore = entry.restore as Record<string, unknown>;
    restore.cleanupScript = "private";

    entry.locationContext = {
      kind: "indexed-root",
      privateSlot: "private",
    };

    expect(validateObjectRangeEvidenceReport(report)).toEqual(
      expect.arrayContaining([
        "report.internalToolPath is not allowed",
        "runtime.captureFile is not allowed",
        "entries[0].unverifiedNote is not allowed",
        "entries[0].baseline.rawPath is not allowed",
        "entries[0].valueRange.observedOnly is not allowed",
        "entries[0].acceptedValues[0].extraLabel is not allowed",
        "entries[0].testedValues[0].source is not allowed",
        "entries[0].restore.cleanupScript is not allowed",
        "entries[0].locationContext.privateSlot is not allowed",
      ]),
    );
  });
});

function validReport(): {
  schemaVersion: 1;
  parentIssue: number;
  batchIssue: number;
  runtime: {
    observedAt: string;
    beyondVersion: string;
    operatorSupervised: boolean;
    noLaserConnected: boolean;
  };
  entries: Array<{
    objectPath: string;
    probePath: string;
    probeMode: string;
    shipsMetadata: boolean;
    valueType: string;
    evidenceLevel: string;
    boundaryBehavior?: string;
    baseline: {
      value: number;
      typeTag: string;
    };
    valueRange?: {
      min: number;
      max?: number;
      unit: string;
      dynamicMax?: {
        expression: string;
        sourcePaths: string[];
        notes: string;
      };
    };
    acceptedValues?: Array<{
      value: number;
      label: string;
    }>;
    testedValues: Array<{
      command: string;
      readback: number;
      behavior: string;
    }>;
    restore: {
      strategy: string;
      restoredValue: number;
      notes: string;
    };
    evidenceNote: string;
    deferReason?: string;
    locationAware: boolean;
    locationContext?: {
      kind: string;
      populationDependent: boolean;
      concreteContext: string;
    };
  }>;
} {
  return {
    schemaVersion: 1,
    parentIssue: 216,
    batchIssue: 288,
    runtime: {
      observedAt: "2026-05-13",
      beyondVersion: "BEYOND 2030",
      operatorSupervised: true,
      noLaserConnected: true,
    },
    entries: [
      {
        objectPath: "UserInterface.FrontView",
        probePath: "UserInterface.FrontView",
        probeMode: "command-readback",
        shipsMetadata: true,
        valueType: "enum",
        evidenceLevel: "observed",
        boundaryBehavior: "no-op",
        baseline: {
          value: 2,
          typeTag: "i",
        },
        valueRange: {
          min: 0,
          max: 3,
          unit: "main view mode",
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
        ],
        testedValues: [
          {
            command: "SetGridView",
            readback: 0,
            behavior: "pass-through",
          },
        ],
        restore: {
          strategy: "command-restore",
          restoredValue: 2,
          notes: "SetPlayListView restored the observed baseline.",
        },
        evidenceNote: "T1 view commands moved UserInterface.FrontView through the observed readback domain.",
        locationAware: false,
      },
    ],
  };
}
