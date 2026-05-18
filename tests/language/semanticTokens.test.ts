import { describe, expect, it } from "vitest";

import { parseCommandCatalog } from "../../src/knowledge/catalog";
import { buildPropertyIndex, type KnownObjectSchema, type PropertyIndex } from "../../src/knowledge/propertyIndex";
import { classifySemanticTokens, TOKEN_MODIFIERS, TOKEN_TYPES } from "../../src/language/semanticTokens";

const catalog = parseCommandCatalog(
  ["Brightness|Brightness 100", 'OscOutTTS|OscOutTTS "",""', "SelectZone|SelectZone 1"].join("\n"),
);

const TYPE = (name: (typeof TOKEN_TYPES)[number]): number => TOKEN_TYPES.indexOf(name);
const MOD = (name: (typeof TOKEN_MODIFIERS)[number]): number => 1 << TOKEN_MODIFIERS.indexOf(name);

function makePropertyIndex(schemas: KnownObjectSchema[]): PropertyIndex {
  return buildPropertyIndex({
    schemaVersion: 1,
    generatedAt: "2026-05-08T00:00:00Z",
    generatedFrom: "test",
    schemas,
  });
}

describe("classifySemanticTokens", () => {
  it("paints known commands with the defaultLibrary modifier", () => {
    const tokens = classifySemanticTokens("Brightness 50", catalog);
    expect(tokens).toContainEqual({
      line: 0,
      start: 0,
      length: "Brightness".length,
      typeId: TYPE("function"),
      modifiers: MOD("defaultLibrary"),
    });
  });

  it("paints unknown commands as function without defaultLibrary", () => {
    const tokens = classifySemanticTokens("BogusCommand 1", catalog);
    expect(tokens).toContainEqual({
      line: 0,
      start: 0,
      length: "BogusCommand".length,
      typeId: TYPE("function"),
      modifiers: 0,
    });
  });

  it("paints label declarations and goto references with the label type", () => {
    const tokens = classifySemanticTokens(["loopStart:", "  Brightness 50", "  goto loopStart"].join("\n"), catalog);
    const decl = tokens.find((t) => t.line === 0);
    expect(decl).toMatchObject({ typeId: TYPE("label"), modifiers: MOD("declaration") });
    const ref = tokens.find((t) => t.line === 2 && t.typeId === TYPE("label"));
    expect(ref).toBeDefined();
    expect(ref?.modifiers).toBe(0);
  });

  it("paints declared variable goto targets as variable reads", () => {
    const tokens = classifySemanticTokens(
      ["var targetName", 'targetName = "DoneSection"', "goto targetName", "DoneSection:", "exit"].join("\n"),
      catalog,
    );

    expect(tokens).toContainEqual({
      line: 2,
      start: "goto ".length,
      length: "targetName".length,
      typeId: TYPE("variable"),
      modifiers: 0,
    });
    expect(tokens.filter((t) => t.line === 2 && t.typeId === TYPE("label"))).toEqual([]);
  });

  it("paints var declarations, assignments (modification), and reads", () => {
    const tokens = classifySemanticTokens(["var x", "x = 5", 'OscOutTTS "/x", "f", x'].join("\n"), catalog);
    const decl = tokens.find((t) => t.line === 0 && t.typeId === TYPE("variable"));
    expect(decl?.modifiers).toBe(MOD("declaration"));
    const assign = tokens.find((t) => t.line === 1 && t.typeId === TYPE("variable"));
    expect(assign?.modifiers).toBe(MOD("modification"));
    const read = tokens.find((t) => t.line === 2 && t.typeId === TYPE("variable"));
    expect(read?.modifiers).toBe(0);
  });

  it("does not paint dotted property segments as variables", () => {
    const tokens = classifySemanticTokens(["var x", "x = Master.Brightness"].join("\n"), catalog);
    // 'Brightness' is a property segment, not a variable. Only the lhs `x`
    // should be a variable token on line 1.
    const line1Vars = tokens.filter((t) => t.line === 1 && t.typeId === TYPE("variable"));
    expect(line1Vars).toHaveLength(1);
    expect(line1Vars[0].start).toBe(0);
  });

  it("emits tokens in line/start order (required by SemanticTokensBuilder)", () => {
    const tokens = classifySemanticTokens(["start:", "  Brightness 50", "  goto start"].join("\n"), catalog);
    for (let i = 1; i < tokens.length; i++) {
      const prev = tokens[i - 1];
      const curr = tokens[i];
      expect(curr.line > prev.line || (curr.line === prev.line && curr.start >= prev.start)).toBe(true);
    }
  });

  it("paints registered property-path roots as class tokens (with defaultLibrary for bundled canonicals)", () => {
    const propertyIndex = makePropertyIndex([
      {
        object: "Master",
        isArray: false,
        propertyCount: 1,
        properties: ["Brightness"],
        sharedWithAliases: 0,
      },
    ]);
    const tokens = classifySemanticTokens("Master.Brightness = 100", catalog, propertyIndex);
    const classTokens = tokens.filter((t) => t.typeId === TYPE("class"));
    expect(classTokens).toContainEqual({
      line: 0,
      start: 0,
      length: "Master".length,
      typeId: TYPE("class"),
      modifiers: MOD("defaultLibrary"),
    });
  });

  it("paints folder-scoped universe roots as class without the defaultLibrary modifier", () => {
    const propertyIndex = makePropertyIndex([
      {
        object: "COLORPICKER",
        isArray: true,
        propertyCount: 17,
        properties: ["BUTTON.Caption"],
        sharedWithAliases: 0,
        inheritedFrom: "UniversePanel",
        discoverySource: "folderScope",
        observedFileCount: 39,
      },
    ]);
    const tokens = classifySemanticTokens("COLORPICKER.SECONDARYCOLOR.ColorOff = 0", catalog, propertyIndex);
    const classTokens = tokens.filter((t) => t.typeId === TYPE("class"));
    expect(classTokens).toEqual([
      {
        line: 0,
        start: 0,
        length: "COLORPICKER".length,
        typeId: TYPE("class"),
        modifiers: 0,
      },
    ]);
  });

  it("does not paint unregistered identifiers as class tokens", () => {
    const propertyIndex = makePropertyIndex([]);
    const tokens = classifySemanticTokens("UnknownThing.foo = 0", catalog, propertyIndex);
    expect(tokens.filter((t) => t.typeId === TYPE("class"))).toEqual([]);
  });

  it("does not paint property-path roots that appear inside string literals", () => {
    const propertyIndex = makePropertyIndex([
      { object: "Master", isArray: false, propertyCount: 0, properties: [], sharedWithAliases: 0 },
    ]);
    const tokens = classifySemanticTokens('OscOutTTS "/tag", "s", "Master.Brightness"', catalog, propertyIndex);
    expect(tokens.filter((t) => t.typeId === TYPE("class"))).toEqual([]);
  });

  it("does not paint property-path roots that appear inside line comments", () => {
    const propertyIndex = makePropertyIndex([
      { object: "Master", isArray: false, propertyCount: 0, properties: [], sharedWithAliases: 0 },
    ]);
    const tokens = classifySemanticTokens("// see Master.Brightness for reference", catalog, propertyIndex);
    expect(tokens.filter((t) => t.typeId === TYPE("class"))).toEqual([]);
  });

  it("paints property-path roots in expression context (not just assignment LHS)", () => {
    const propertyIndex = makePropertyIndex([
      { object: "Master", isArray: false, propertyCount: 0, properties: [], sharedWithAliases: 0 },
    ]);
    const tokens = classifySemanticTokens("var x\nx = Master.Brightness", catalog, propertyIndex);
    const classOnLine1 = tokens.filter((t) => t.line === 1 && t.typeId === TYPE("class"));
    expect(classOnLine1).toHaveLength(1);
    expect(classOnLine1[0].start).toBe("x = ".length);
  });
});
