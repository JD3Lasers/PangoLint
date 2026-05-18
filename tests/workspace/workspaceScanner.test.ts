import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import { buildRegistry } from "../../src/workspace/userObjects";
import { scanWorkspaceForUserObjects } from "../../src/workspace/workspaceScanner";

function makeWorkspace(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "pangolint-scan-"));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(dir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

const bundledFile: PropertyIndexFile = {
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test bundled",
  schemas: [
    {
      object: "Master",
      isArray: false,
      propertyCount: 2,
      properties: ["Brightness", "RotoAngleX"],
      sharedWithAliases: 0,
    },
    {
      object: "Zone",
      isArray: true,
      propertyCount: 2,
      properties: ["Red", "RotoAngleX"],
      sharedWithAliases: 0,
    },
    {
      object: "UniversePanel",
      isArray: true,
      propertyCount: 3,
      properties: ["Caption", "ColorOn", "Value"],
      sharedWithAliases: 2,
    },
    {
      object: "UniverseEffectControl",
      isArray: true,
      propertyCount: 4,
      properties: ["Caption", "ColorOn", "Effect.IntensityX", "Effect.SpeedX"],
      sharedWithAliases: 0,
    },
    {
      object: "UniverseZonePadControl",
      isArray: true,
      propertyCount: 4,
      properties: ["Caption", "ColorOn", "Zone.Brightness", "Zone.Red"],
      sharedWithAliases: 0,
    },
  ],
};
const bundledIndex = buildPropertyIndex(bundledFile);

describe("scanWorkspaceForUserObjects", () => {
  it("returns a Promise so workspace scans do not block extension activation", async () => {
    const dir = makeWorkspace({ "a.BeyondCode": "COLORPICKER.X.Y = 1" });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const resultPromise = scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      expect(resultPromise).toBeInstanceOf(Promise);
      const result = await resultPromise;
      expect(result.fileCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty index when no user objects are registered and folder-scope is off", async () => {
    const dir = makeWorkspace({ "a.BeyondCode": "COLORPICKER.X.Y = 1" });
    try {
      const reg = buildRegistry({ schemaVersion: 1, objects: {} });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, {
        folderScopedUniverses: false,
      });
      expect(result.index.size()).toBe(0);
      expect(result.fileCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inherits UniversePanel and exposes discovered button names as arrayIndices", async () => {
    const dir = makeWorkspace({
      "scripts/a.BeyondCode": [
        "COLORPICKER.PASTELMODEPRIMARY.value = 1",
        "COLORPICKER.REDBUTTON1.ColorOff = 0",
        "OTHERTHING.shouldBeIgnored.x = 5",
      ].join("\n"),
      "scripts/b.BeyondCode": "COLORPICKER.PASTELMODEPRIMARY.value = 0",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      expect(result.fileCount).toBe(2);
      const cp = result.index.getObject("COLORPICKER");
      expect(cp).toBeDefined();
      // Inherits the canonical UniversePanel button props.
      expect(cp?.isArray).toBe(true);
      expect(cp?.properties).toEqual(["Caption", "ColorOn", "Value"]);
      // Discovered button names (deduped, sorted) appear as arrayIndices.
      expect(cp?.arrayIndices).toEqual(["PASTELMODEPRIMARY", "REDBUTTON1"]);
      // OTHERTHING is not registered → not in the index.
      expect(result.index.getObject("OTHERTHING")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not treat // inside strings as a line comment while scanning", async () => {
    const dir = makeWorkspace({
      "scripts/a.BeyondCode": 'Log "COLORPICKER.STRINGONLY.Caption // still string"; COLORPICKER.REALBUTTON.Value = 1',
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      expect(cp?.arrayIndices).toEqual(["REALBUTTON"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips .trash directories during workspace scans", async () => {
    const dir = makeWorkspace({
      ".trash/old.BeyondCode": "COLORPICKER.TRASHED.Value = 1",
      "scripts/current.BeyondCode": "COLORPICKER.CURRENT.Value = 1",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      expect(result.fileCount).toBe(1);
      expect(cp?.arrayIndices).toEqual(["CURRENT"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores numeric segments as button names", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": ['COLORPICKER.0.Caption = "x"', "COLORPICKER.MyBtn.Value = 1"].join("\n"),
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      expect(result.index.getObject("COLORPICKER")?.arrayIndices).toEqual(["MyBtn"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inherits the canonical Zone schema for zone aliases", async () => {
    const dir = makeWorkspace({});
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: {
          "#1": { kind: "zoneAlias", addedAt: "" },
          ALL: { kind: "zoneAlias", addedAt: "" },
        },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const hash1 = result.index.getObject("#1");
      expect(hash1?.properties).toEqual(["Red", "RotoAngleX"]);
      expect(hash1?.isArray).toBe(false);
      expect(hash1?.inheritedFrom).toBe("Zone");
      expect(result.index.getObject("ALL")?.properties).toEqual(["Red", "RotoAngleX"]);
      expect(result.index.getObject("ALL")?.isArray).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inherits the canonical Master schema for master aliases", async () => {
    const dir = makeWorkspace({});
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { MyMaster: { kind: "masterAlias", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const my = result.index.getObject("MyMaster");
      expect(my?.properties).toEqual(["Brightness", "RotoAngleX"]);
      expect(my?.isArray).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores property paths inside line comments", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": "// COLORPICKER.shouldNotBeIndexed.x = 1\nCOLORPICKER.realProp.value = 1",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      // Comment-source button name is excluded; only the live one survives.
      expect(cp?.arrayIndices).toEqual(["realProp"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies buttons by observed shape: Effect.* → UniverseEffectControl, Zone.* → UniverseZonePadControl", async () => {
    const dir = makeWorkspace({
      "scripts/a.BeyondCode": [
        "COLORPICKER.STROBE.Effect.IntensityX = 50",
        "COLORPICKER.RED_ZONE.Zone.Red = 255",
        'COLORPICKER.PLAINBTN.Caption = "hi"',
      ].join("\n"),
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      expect(cp?.arrayIndices).toEqual(["PLAINBTN", "RED_ZONE", "STROBE"]);
      expect(cp?.perIndexSchemas).toEqual({
        strobe: "UniverseEffectControl",
        red_zone: "UniverseZonePadControl",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not emit perIndexSchemas when no buttons exhibit Effect.* / Zone.* shape", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": 'COLORPICKER.PLAIN.Caption = "x"',
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      expect(cp?.perIndexSchemas).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies buttons case-insensitively (effect / EFFECT / Effect all valid)", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": "COLORPICKER.MyBtn.effect.IntensityX = 1",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const cp = result.index.getObject("COLORPICKER");
      expect(cp?.perIndexSchemas).toEqual({ mybtn: "UniverseEffectControl" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("folder-scoped auto-discovery", () => {
    it("auto-discovers an unregistered root that appears in 2+ files in the same folder", async () => {
      const dir = makeWorkspace({
        "panels/a.BeyondCode": 'AUTOPANEL.RED.Caption = "r"',
        "panels/b.BeyondCode": 'AUTOPANEL.BLUE.Caption = "b"',
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        const ap = result.index.getObject("AUTOPANEL");
        expect(ap).toBeDefined();
        expect(ap?.discoverySource).toBe("folderScope");
        expect(ap?.observedFileCount).toBe(2);
        expect(ap?.arrayIndices).toEqual(["BLUE", "RED"]);
        expect(ap?.inheritedFrom).toBe("UniversePanel");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("does NOT auto-discover a root that only appears in one file", async () => {
      const dir = makeWorkspace({
        "panels/a.BeyondCode": 'LONELYROOT.X.Caption = "x"\nLONELYROOT.Y.Caption = "y"',
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        expect(result.index.getObject("LONELYROOT")).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("requires the 2-file threshold within a single folder, not across folders", async () => {
      const dir = makeWorkspace({
        "folderA/a.BeyondCode": 'SCATTERED.X.Caption = "x"',
        "folderB/b.BeyondCode": 'SCATTERED.Y.Caption = "y"',
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        // Each folder has only 1 file → no auto-discovery.
        expect(result.index.getObject("SCATTERED")).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("does not auto-discover when the setting is off", async () => {
      const dir = makeWorkspace({
        "panels/a.BeyondCode": 'AUTOPANEL.RED.Caption = "r"',
        "panels/b.BeyondCode": 'AUTOPANEL.BLUE.Caption = "b"',
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, {
          folderScopedUniverses: false,
        });
        expect(result.index.getObject("AUTOPANEL")).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("does not auto-promote bundled canonical roots like Master / Zone", async () => {
      const dir = makeWorkspace({
        "a.BeyondCode": "Master.Brightness = 50",
        "b.BeyondCode": "Master.RotoAngleX = 100",
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        // Master is in bundledIndex; auto-discovery must not shadow it
        // with a UniversePanel-shaped folder-scoped schema.
        const masterFromWorkspace = result.index.getObject("Master");
        expect(masterFromWorkspace).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("auto-discovered buttons still get per-button shape dispatch", async () => {
      const dir = makeWorkspace({
        "panels/a.BeyondCode": "AUTOPANEL.STROBE.Effect.IntensityX = 50",
        "panels/b.BeyondCode": "AUTOPANEL.STROBE.Effect.SpeedX = 25",
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        const ap = result.index.getObject("AUTOPANEL");
        expect(ap?.discoverySource).toBe("folderScope");
        expect(ap?.perIndexSchemas).toEqual({ strobe: "UniverseEffectControl" });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("preserves the first-observed casing of the root name", async () => {
      const dir = makeWorkspace({
        "panels/a.BeyondCode": 'MyPanel.RED.Caption = "r"',
        "panels/b.BeyondCode": 'MyPanel.BLUE.Caption = "b"',
      });
      try {
        const reg = buildRegistry({ schemaVersion: 1, objects: {} });
        const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
        // Lookup is case-insensitive but the displayed `object` keeps the case.
        const ap = result.index.getObject("MyPanel");
        expect(ap?.object).toBe("MyPanel");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it("skips heavy directories like node_modules and .git", async () => {
    const dir = makeWorkspace({
      "real.BeyondCode": "COLORPICKER.X.Y = 1",
      "node_modules/somepkg/x.BeyondCode": "COLORPICKER.SHOULD_NOT_INDEX.z = 2",
      ".git/objects/x.BeyondCode": "COLORPICKER.ALSO_NOT.z = 3",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      expect(result.fileCount).toBe(1);
      // Only the button from the real file is discovered; node_modules/.git skipped.
      expect(result.index.getObject("COLORPICKER")?.arrayIndices).toEqual(["X"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not follow symlinked directories during workspace scans", async () => {
    const linked = makeWorkspace({ "linked.BeyondCode": "COLORPICKER.LINKED.Value = 1" });
    const dir = makeWorkspace({ "real.BeyondCode": "COLORPICKER.REAL.Value = 1" });
    try {
      try {
        symlinkSync(linked, join(dir, "linked-dir"), "dir");
      } catch (error) {
        if (isSymlinkUnavailable(error)) return;
        throw error;
      }
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      expect(result.fileCount).toBe(1);
      expect(result.index.getObject("COLORPICKER")?.arrayIndices).toEqual(["REAL"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(linked, { recursive: true, force: true });
    }
  });

  it("honors file count, depth, file size, and cancellation scan bounds", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": "COLORPICKER.A.Value = 1",
      "b.BeyondCode": "COLORPICKER.B.Value = 1",
      "sub/deep.BeyondCode": "COLORPICKER.DEEP.Value = 1",
      "huge.BeyondCode": "COLORPICKER.HUGE.Value = 1",
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });

      const cancelled = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, {
        isCancellationRequested: () => true,
      });
      expect(cancelled.fileCount).toBe(0);

      const cappedFiles = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, { maxFiles: 2 });
      expect(cappedFiles.fileCount).toBe(2);

      const cappedEntries = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, { maxEntries: 0 });
      expect(cappedEntries.fileCount).toBe(0);

      const cappedDepth = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, { maxDepth: 0 });
      expect(cappedDepth.index.getObject("COLORPICKER")?.arrayIndices).not.toContain("DEEP");

      const cappedSize = await scanWorkspaceForUserObjects(dir, reg, bundledIndex, { maxFileBytes: 1 });
      expect(cappedSize.fileCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps prototype-named buttons as own per-index schema keys", async () => {
    const dir = makeWorkspace({
      "a.BeyondCode": ["COLORPICKER.__proto__.Effect.IntensityX = 1", "COLORPICKER.toString.Zone.Red = 255"].join("\n"),
    });
    try {
      const reg = buildRegistry({
        schemaVersion: 1,
        objects: { COLORPICKER: { kind: "universe", addedAt: "" } },
      });
      const result = await scanWorkspaceForUserObjects(dir, reg, bundledIndex);
      const perIndexSchemas = result.index.getObject("COLORPICKER")?.perIndexSchemas;
      expect(perIndexSchemas).toBeDefined();
      const schemaMap = perIndexSchemas as Record<string, string>;
      expect(result.index.getObject("COLORPICKER")?.arrayIndices).toEqual(["__proto__", "toString"]);
      expect(Object.hasOwn(schemaMap, "__proto__")).toBe(true);
      expect(Reflect.get(schemaMap, "__proto__")).toBe("UniverseEffectControl");
      expect(Object.hasOwn(schemaMap, "tostring")).toBe(true);
      expect(schemaMap.tostring).toBe("UniverseZonePadControl");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function isSymlinkUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}
