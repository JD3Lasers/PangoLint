import { describe, expect, it } from "vitest";

import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import type { PropertyReadbackResult } from "../../src/runtime/readback/beyondReadback";
import {
  applyReportToCache,
  buildRuntimeIndex,
  classifyPropertyReadbackResult,
  extractValidationCandidates,
  type ReadbackReportEntry,
  runValidation,
  type ValidatedRootsCache,
} from "../../src/runtime/readback/validateObjects";

const bundledFile: PropertyIndexFile = {
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test bundled",
  schemas: [
    {
      object: "Master",
      isArray: false,
      propertyCount: 1,
      properties: ["Brightness"],
      sharedWithAliases: 0,
    },
    {
      object: "UniversePanel",
      isArray: true,
      propertyCount: 1,
      properties: ["Caption"],
      sharedWithAliases: 0,
    },
  ],
};
const bundledIndex = buildPropertyIndex(bundledFile);

describe("extractValidationCandidates", () => {
  it("collects unknown (root, button) pairs from a document", () => {
    const candidates = extractValidationCandidates(
      ['UNKNOWNPANEL.RED.Caption = "r"', 'UNKNOWNPANEL.BLUE.Caption = "b"'].join("\n"),
      bundledIndex,
    );
    expect(candidates).toEqual([
      { root: "UNKNOWNPANEL", button: "RED" },
      { root: "UNKNOWNPANEL", button: "BLUE" },
    ]);
  });

  it("skips bundled canonical roots (they don't need validation)", () => {
    const candidates = extractValidationCandidates("Master.Brightness = 50", bundledIndex);
    expect(candidates).toEqual([]);
  });

  it("includes folder-scoped auto-discoveries (not yet runtime-confirmed)", () => {
    const layered: PropertyIndexFile = {
      schemaVersion: 1,
      generatedAt: "",
      generatedFrom: "test layered",
      schemas: [
        ...bundledFile.schemas,
        {
          object: "AUTOPANEL",
          isArray: true,
          propertyCount: 1,
          properties: ["Caption"],
          sharedWithAliases: 0,
          inheritedFrom: "UniversePanel",
          discoverySource: "folderScope",
          observedFileCount: 2,
          arrayIndices: ["RED"],
        },
      ],
    };
    const candidates = extractValidationCandidates('AUTOPANEL.RED.Caption = "r"', buildPropertyIndex(layered));
    expect(candidates).toEqual([{ root: "AUTOPANEL", button: "RED" }]);
  });

  it("skips beyondReadback-confirmed (root, button) pairs already in the runtime index", () => {
    const layered: PropertyIndexFile = {
      schemaVersion: 1,
      generatedAt: "",
      generatedFrom: "test layered",
      schemas: [
        ...bundledFile.schemas,
        {
          object: "VALIDATED",
          isArray: true,
          propertyCount: 1,
          properties: ["Caption"],
          sharedWithAliases: 0,
          inheritedFrom: "UniversePanel",
          discoverySource: "beyondReadback",
          arrayIndices: ["RED"],
          validatedAt: "2026-05-04T00:00:00Z",
        },
      ],
    };
    // RED is already confirmed; BLUE is not, so BLUE should still be a candidate.
    const candidates = extractValidationCandidates(
      ['VALIDATED.RED.Caption = "r"', 'VALIDATED.BLUE.Caption = "b"'].join("\n"),
      buildPropertyIndex(layered),
    );
    expect(candidates).toEqual([{ root: "VALIDATED", button: "BLUE" }]);
  });

  it("ignores numeric segments as button names", () => {
    const candidates = extractValidationCandidates('UNKNOWN.0.Caption = "x"', bundledIndex);
    expect(candidates).toEqual([]);
  });

  it("dedupes (root, button) pairs across the document", () => {
    const candidates = extractValidationCandidates(
      ["UNKNOWN.RED.Caption = 1", "UNKNOWN.RED.ColorOff = 0"].join("\n"),
      bundledIndex,
    );
    expect(candidates).toEqual([{ root: "UNKNOWN", button: "RED" }]);
  });

  it("ignores pairs inside line comments", () => {
    const candidates = extractValidationCandidates(
      ["// UNKNOWN.RED.Caption = 1", "REAL.BLUE.Caption = 1"].join("\n"),
      bundledIndex,
    );
    expect(candidates).toEqual([{ root: "REAL", button: "BLUE" }]);
  });

  it("does not treat // inside strings as a line comment", () => {
    const candidates = extractValidationCandidates(
      ['Log "UNKNOWN.RED.Caption // still string"; REAL.BLUE.Caption = 1'].join("\n"),
      bundledIndex,
    );
    expect(candidates).toEqual([{ root: "REAL", button: "BLUE" }]);
  });
});

describe("classifyPropertyReadbackResult", () => {
  it("returns 'confirmed' for non-empty string responses", () => {
    expect(
      classifyPropertyReadbackResult({
        ok: true,
        requestId: "x",
        propertyPath: "X.Y.Caption",
        script: "",
        value: "Some Caption",
      }),
    ).toBe("confirmed");
  });

  it("returns 'silent' for empty string and numeric zero (the silent-0 footgun)", () => {
    expect(
      classifyPropertyReadbackResult({
        ok: true,
        requestId: "x",
        propertyPath: "X.Y.Caption",
        script: "",
        value: "",
      }),
    ).toBe("silent");
    expect(
      classifyPropertyReadbackResult({
        ok: true,
        requestId: "x",
        propertyPath: "X.Y.Caption",
        script: "",
        value: 0,
      }),
    ).toBe("silent");
  });

  it("returns 'unreachable' when the readback failed (timeout, transport error)", () => {
    expect(
      classifyPropertyReadbackResult({
        ok: false,
        requestId: "x",
        propertyPath: "X.Y.Caption",
        script: "",
        error: "timed out",
      }),
    ).toBe("unreachable");
  });
});

describe("applyReportToCache", () => {
  it("adds confirmed (root, button) pairs to the cache", () => {
    const cache: ValidatedRootsCache = new Map();
    const entry: ReadbackReportEntry = {
      root: "MyPanel",
      button: "RED",
      outcome: "confirmed",
      rawValue: "Red Button",
    };
    const readbackIds = new Map([[entry, "readback-1"]]);
    const fixedNow = () => new Date("2026-05-04T12:00:00Z");
    const changed = applyReportToCache(
      cache,
      { entries: [entry], confirmed: 1, silent: 0, unreachable: 0 },
      readbackIds,
      fixedNow,
    );
    expect(changed).toEqual(new Set(["MyPanel"]));
    const cached = cache.get("mypanel");
    expect(cached?.displayName).toBe("MyPanel");
    expect([...(cached?.confirmedButtons ?? [])]).toEqual(["RED"]);
    expect(cached?.validatedAt).toBe("2026-05-04T12:00:00.000Z");
    expect(cached?.lastReadbackId).toBe("readback-1");
  });

  it("ignores silent and unreachable entries", () => {
    const cache: ValidatedRootsCache = new Map();
    const silentEntry: ReadbackReportEntry = { root: "X", button: "Y", outcome: "silent" };
    const unreachable: ReadbackReportEntry = { root: "X", button: "Z", outcome: "unreachable" };
    const readbackIds = new Map<ReadbackReportEntry, string>();
    const changed = applyReportToCache(
      cache,
      { entries: [silentEntry, unreachable], confirmed: 0, silent: 1, unreachable: 1 },
      readbackIds,
    );
    expect(changed.size).toBe(0);
    expect(cache.size).toBe(0);
  });

  it("merges multiple confirmed buttons under a single root entry", () => {
    const cache: ValidatedRootsCache = new Map();
    const a: ReadbackReportEntry = { root: "P", button: "A", outcome: "confirmed", rawValue: "A" };
    const b: ReadbackReportEntry = { root: "P", button: "B", outcome: "confirmed", rawValue: "B" };
    applyReportToCache(cache, { entries: [a, b], confirmed: 2, silent: 0, unreachable: 0 }, new Map());
    expect([...(cache.get("p")?.confirmedButtons ?? [])].sort()).toEqual(["A", "B"]);
  });
});

describe("buildRuntimeIndex", () => {
  it("emits a UniversePanel-shaped schema per cached root", () => {
    const cache: ValidatedRootsCache = new Map([
      [
        "mypanel",
        {
          displayName: "MyPanel",
          confirmedButtons: new Set(["RED", "BLUE"]),
          validatedAt: "2026-05-04T12:00:00Z",
          lastReadbackId: "readback-1",
        },
      ],
    ]);
    const runtime = buildRuntimeIndex(cache, bundledIndex);
    const mp = runtime.getObject("MyPanel");
    expect(mp).toBeDefined();
    expect(mp?.discoverySource).toBe("beyondReadback");
    expect(mp?.inheritedFrom).toBe("UniversePanel");
    expect(mp?.arrayIndices).toEqual(["BLUE", "RED"]);
    expect(mp?.validatedAt).toBe("2026-05-04T12:00:00Z");
    expect(mp?.properties).toEqual(["Caption"]); // inherited from UniversePanel
  });

  it("returns an empty index when the cache is empty", () => {
    const runtime = buildRuntimeIndex(new Map(), bundledIndex);
    expect(runtime.size()).toBe(0);
  });
});

describe("runValidation", () => {
  it("uses unpredictable request IDs for each live readback", async () => {
    const requestIds: string[] = [];
    await runValidation({
      documentText: "UNKNOWN.RED.Caption = 1",
      propertyIndex: bundledIndex,
      talkHost: "127.0.0.1",
      talkPort: 16062,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 1000,
      readProperty: async (path, requestId): Promise<PropertyReadbackResult> => {
        requestIds.push(requestId);
        return { ok: true, requestId, propertyPath: path, script: "", value: "Red" };
      },
    });

    expect(requestIds).toHaveLength(1);
    expect(requestIds[0]).toMatch(/^validate-[a-f0-9]{32}$/);
    expect(requestIds[0]).not.toMatch(/^validate-\d{10,}-\d+$/);
  });

  it("walks candidates sequentially and classifies each result", async () => {
    const readbackCalls: string[] = [];
    const readProperty = async (path: string, _id: string): Promise<PropertyReadbackResult> => {
      readbackCalls.push(path);
      // Confirm RED, leave BLUE silent.
      if (path.endsWith("RED.Caption")) {
        return { ok: true, requestId: _id, propertyPath: path, script: "", value: "Red Caption" };
      }
      return { ok: true, requestId: _id, propertyPath: path, script: "", value: "" };
    };
    const { report } = await runValidation({
      documentText: ["P.RED.Caption = 1", "P.BLUE.Caption = 0"].join("\n"),
      propertyIndex: bundledIndex,
      talkHost: "",
      talkPort: 0,
      listenHost: "",
      listenPort: 0,
      timeoutMs: 0,
      readProperty,
    });
    expect(readbackCalls).toEqual(["P.RED.Caption", "P.BLUE.Caption"]);
    expect(report.confirmed).toBe(1);
    expect(report.silent).toBe(1);
    expect(report.unreachable).toBe(0);
  });

  it("aborts remaining readbacks when the first readback is unreachable", async () => {
    let calls = 0;
    const readProperty = async (_path: string, id: string): Promise<PropertyReadbackResult> => {
      calls++;
      return { ok: false, requestId: id, propertyPath: _path, script: "", error: "timed out" };
    };
    const { report } = await runValidation({
      documentText: ["P.A.Caption = 1", "P.B.Caption = 1", "P.C.Caption = 1"].join("\n"),
      propertyIndex: bundledIndex,
      talkHost: "",
      talkPort: 0,
      listenHost: "",
      listenPort: 0,
      timeoutMs: 0,
      readProperty,
    });
    expect(calls).toBe(1);
    expect(report.unreachable).toBe(3); // first plus 2 skipped
    expect(report.confirmed).toBe(0);
  });

  it("respects maxReadbacks cap", async () => {
    let calls = 0;
    const readProperty = async (path: string, id: string): Promise<PropertyReadbackResult> => {
      calls++;
      return { ok: true, requestId: id, propertyPath: path, script: "", value: "ok" };
    };
    await runValidation({
      documentText: ["P.A.Caption = 1", "P.B.Caption = 1", "P.C.Caption = 1"].join("\n"),
      propertyIndex: bundledIndex,
      talkHost: "",
      talkPort: 0,
      listenHost: "",
      listenPort: 0,
      timeoutMs: 0,
      readProperty,
      maxReadbacks: 2,
    });
    expect(calls).toBe(2);
  });
});
