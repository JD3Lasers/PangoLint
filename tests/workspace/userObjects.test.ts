import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addUserObject,
  buildRegistry,
  emptyUserObjectsRegistry,
  loadUserObjects,
  removeUserObject,
  type UserObjectsFile,
  userObjectsFilePath,
} from "../../src/workspace/userObjects";

function makeWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "pangolint-userobj-"));
}

describe("buildRegistry", () => {
  it("indexes by lowercase, returns canonical case in names()", () => {
    const file: UserObjectsFile = {
      schemaVersion: 1,
      objects: {
        COLORPICKER: { kind: "universe", addedAt: "" },
        "#1": { kind: "zoneAlias", addedAt: "" },
      },
    };
    const reg = buildRegistry(file);
    expect(reg.size()).toBe(2);
    expect(reg.get("colorpicker")?.kind).toBe("universe");
    expect(reg.get("#1")?.kind).toBe("zoneAlias");
    expect(reg.universeNames()).toEqual(["COLORPICKER"]);
    expect(reg.zoneAliasNames()).toEqual(["#1"]);
    expect(reg.masterAliasNames()).toEqual([]);
  });

  it("skips malformed entries and keeps prototype keys as data", () => {
    const objects = Object.create(null) as Record<string, unknown>;
    Reflect.set(objects, "__proto__", { kind: "universe", addedAt: "" });
    objects.Broken = null;
    Reflect.set(objects, "toString", { kind: "zoneAlias", addedAt: "" });
    const file = {
      schemaVersion: 1,
      objects,
    } as unknown as UserObjectsFile;
    const reg = buildRegistry(file);
    expect(reg.size()).toBe(2);
    expect(reg.get("__proto__")?.kind).toBe("universe");
    expect(reg.get("toString")?.kind).toBe("zoneAlias");
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("emptyUserObjectsRegistry", () => {
  it("starts empty", () => {
    const reg = emptyUserObjectsRegistry();
    expect(reg.size()).toBe(0);
    expect(reg.names()).toEqual([]);
    expect(reg.get("anything")).toBeUndefined();
  });
});

describe("loadUserObjects", () => {
  it("returns absent when no file exists", () => {
    const dir = makeWorkspace();
    try {
      const result = loadUserObjects(dir);
      expect(result.source).toBe("absent");
      expect(result.registry.size()).toBe(0);
      expect(result.filePath).toContain(".pangolint");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns error when file is malformed", () => {
    const dir = makeWorkspace();
    try {
      addUserObject(dir, "Foo", "universe");
      // Corrupt the file
      const path = userObjectsFilePath(dir);
      require("node:fs").writeFileSync(path, "{ not: valid json");
      const result = loadUserObjects(dir);
      expect(result.source).toBe("error");
      expect(result.error).toContain("failed to parse");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns error without parsing oversized registries", () => {
    const dir = makeWorkspace();
    try {
      const path = userObjectsFilePath(dir);
      require("node:fs").mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, `${" ".repeat(128 * 1024 + 1)}`);
      const result = loadUserObjects(dir);
      expect(result.source).toBe("error");
      expect(result.error).toContain("limit");
      expect(result.registry.size()).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns absent when workspaceFolder is empty string", () => {
    const result = loadUserObjects("");
    expect(result.source).toBe("absent");
    expect(result.registry.size()).toBe(0);
  });
});

describe("addUserObject + removeUserObject", () => {
  it("creates the .pangolint dir and writes a fresh registry on first add", () => {
    const dir = makeWorkspace();
    try {
      const reg = addUserObject(dir, "COLORPICKER", "universe");
      expect(reg.size()).toBe(1);
      expect(reg.get("COLORPICKER")?.kind).toBe("universe");
      expect(existsSync(join(dir, ".pangolint", "user-objects.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("appends to an existing registry without losing prior entries", () => {
    const dir = makeWorkspace();
    try {
      addUserObject(dir, "COLORPICKER", "universe");
      addUserObject(dir, "#1", "zoneAlias");
      const result = loadUserObjects(dir);
      expect(result.registry.size()).toBe(2);
      expect(result.registry.get("COLORPICKER")?.kind).toBe("universe");
      expect(result.registry.get("#1")?.kind).toBe("zoneAlias");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overwrites kind when adding the same name twice", () => {
    const dir = makeWorkspace();
    try {
      addUserObject(dir, "X", "universe");
      const reg = addUserObject(dir, "X", "zoneAlias");
      expect(reg.size()).toBe(1);
      expect(reg.get("X")?.kind).toBe("zoneAlias");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes entries case-insensitively and persists", () => {
    const dir = makeWorkspace();
    try {
      addUserObject(dir, "Foo", "universe");
      addUserObject(dir, "Bar", "zoneAlias");
      const reg = removeUserObject(dir, "FOO"); // case mismatch
      expect(reg.size()).toBe(1);
      expect(reg.get("Foo")).toBeUndefined();
      expect(reg.get("Bar")).toBeDefined();
      // Check persistence
      const reloaded = loadUserObjects(dir);
      expect(reloaded.registry.size()).toBe(1);
      expect(reloaded.registry.get("Bar")).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits trailing newline in the saved JSON (POSIX-friendly)", () => {
    const dir = makeWorkspace();
    try {
      addUserObject(dir, "X", "universe");
      const text = readFileSync(userObjectsFilePath(dir), "utf8");
      expect(text.endsWith("\n")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists prototype-key names without changing the object prototype", () => {
    const dir = makeWorkspace();
    try {
      const reg = addUserObject(dir, "__proto__", "universe");
      expect(reg.get("__proto__")?.kind).toBe("universe");
      const raw = JSON.parse(readFileSync(userObjectsFilePath(dir), "utf8"));
      expect(Object.hasOwn(raw.objects, "__proto__")).toBe(true);
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an oversized existing registry", () => {
    const dir = makeWorkspace();
    try {
      const path = userObjectsFilePath(dir);
      require("node:fs").mkdirSync(join(path, ".."), { recursive: true });
      const original = `${" ".repeat(128 * 1024 + 1)}`;
      writeFileSync(path, original);

      expect(() => addUserObject(dir, "NEWPANEL", "universe")).toThrow(/refusing to overwrite/);
      expect(readFileSync(path, "utf8")).toBe(original);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
