import { readFileSync } from "node:fs";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createOnigScanner, createOnigString, loadWASM } from "vscode-oniguruma";
import { INITIAL, parseRawGrammar, Registry } from "vscode-textmate";

type TokenInfo = { text: string; scopes: string[] };

let tokenizeLine: (line: string) => TokenInfo[];

beforeAll(async () => {
  // __dirname is available in CJS (NodeNext .ts without "type":"module")
  const wasmPath = path.resolve(process.cwd(), "node_modules/vscode-oniguruma/release/onig.wasm");
  await loadWASM(readFileSync(wasmPath));

  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName: string) => {
      if (scopeName === "source.pangoscript") {
        const grammarPath = path.resolve(process.cwd(), "syntaxes/pangoscript.tmLanguage.json");
        return parseRawGrammar(readFileSync(grammarPath, "utf8"), grammarPath);
      }
      return null;
    },
  });

  const grammar = await registry.loadGrammar("source.pangoscript");
  if (!grammar) throw new Error("Failed to load pangoscript grammar");

  tokenizeLine = (line: string): TokenInfo[] => {
    const result = grammar.tokenizeLine(line, INITIAL);
    return result.tokens.map((token) => ({
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes,
    }));
  };
}, 10000);

function hasScope(tokens: TokenInfo[], text: string, scope: string): boolean {
  return tokens.some((t) => t.text === text && t.scopes.includes(scope));
}

describe("pangoscript grammar", () => {
  describe("comments", () => {
    it("colors // comment to end of line", () => {
      const tokens = tokenizeLine("// a comment");
      expect(hasScope(tokens, "// a comment", "comment.line.double-slash.pangoscript")).toBe(true);
    });

    it("does not color code before // as comment", () => {
      const tokens = tokenizeLine("SelectZone 1 // note");
      expect(hasScope(tokens, "SelectZone", "comment.line.double-slash.pangoscript")).toBe(false);
    });

    it("colors trailing // comment on a command line", () => {
      const tokens = tokenizeLine("Sleep 50 // delay");
      expect(
        tokens.some((t) => t.text.includes("delay") && t.scopes.includes("comment.line.double-slash.pangoscript")),
      ).toBe(true);
    });
  });

  describe("strings", () => {
    it("colors double-quoted string content", () => {
      const tokens = tokenizeLine('"hello world"');
      expect(tokens.some((t) => t.scopes.includes("string.quoted.double.pangoscript"))).toBe(true);
    });

    it("does not color code outside string as string", () => {
      const tokens = tokenizeLine('DisplayPopup "msg"');
      expect(hasScope(tokens, "DisplayPopup", "string.quoted.double.pangoscript")).toBe(false);
    });
  });

  describe("labels", () => {
    it("colors standalone label identifier", () => {
      const tokens = tokenizeLine("LoopStart:");
      expect(hasScope(tokens, "LoopStart", "entity.name.label.pangoscript")).toBe(true);
    });

    it("colors the colon as punctuation", () => {
      const tokens = tokenizeLine("LoopStart:");
      expect(hasScope(tokens, ":", "punctuation.separator.label.pangoscript")).toBe(true);
    });

    it("colors label in inline-label form", () => {
      const tokens = tokenizeLine("mylabel: WaitForBeat 4");
      expect(hasScope(tokens, "mylabel", "entity.name.label.pangoscript")).toBe(true);
    });

    it("does not color the command after inline label as a label", () => {
      const tokens = tokenizeLine("mylabel: WaitForBeat 4");
      const waitToken = tokens.find((t) => t.text === "WaitForBeat");
      expect(waitToken?.scopes).not.toContain("entity.name.label.pangoscript");
    });

    it("colors ALL_CAPS standalone label", () => {
      const tokens = tokenizeLine("DECK1:");
      expect(hasScope(tokens, "DECK1", "entity.name.label.pangoscript")).toBe(true);
    });
  });

  describe("osc-address", () => {
    it("colors OSC command at line start", () => {
      const tokens = tokenizeLine("/beyond/zone/select 1");
      expect(tokens.some((t) => t.scopes.includes("string.other.osc-address.pangoscript"))).toBe(true);
    });

    it("does not color non-OSC lines as OSC", () => {
      const tokens = tokenizeLine("SelectZone 1");
      expect(tokens.some((t) => t.scopes.includes("string.other.osc-address.pangoscript"))).toBe(false);
    });
  });

  describe("object-path", () => {
    it("colors dotted property access", () => {
      const tokens = tokenizeLine("Master.BPM");
      expect(hasScope(tokens, "Master.BPM", "variable.other.member.pangoscript")).toBe(true);
    });

    it("colors multi-level paths", () => {
      const tokens = tokenizeLine("Channels.101.Value");
      expect(hasScope(tokens, "Channels.101.Value", "variable.other.member.pangoscript")).toBe(true);
    });

    it("colors long object paths", () => {
      const tokens = tokenizeLine("SHOWKONTROL.PangoBlock.Caption");
      expect(hasScope(tokens, "SHOWKONTROL.PangoBlock.Caption", "variable.other.member.pangoscript")).toBe(true);
    });
  });

  describe("commands", () => {
    it("colors PascalCase command", () => {
      const tokens = tokenizeLine("SelectZone 1");
      expect(hasScope(tokens, "SelectZone", "entity.name.function.pangoscript")).toBe(true);
    });

    it("colors mixed-case command", () => {
      const tokens = tokenizeLine('DisplayPopup "ok"');
      expect(hasScope(tokens, "DisplayPopup", "entity.name.function.pangoscript")).toBe(true);
    });

    it("colors WaitForBeat command after inline label", () => {
      const tokens = tokenizeLine("mylabel: WaitForBeat 4");
      expect(hasScope(tokens, "WaitForBeat", "entity.name.function.pangoscript")).toBe(true);
    });

    it("does not color lowercase identifier as command", () => {
      const tokens = tokenizeLine("var beatRate");
      expect(hasScope(tokens, "beatRate", "entity.name.function.pangoscript")).toBe(false);
    });
  });

  describe("keywords", () => {
    it("colors if keyword", () => {
      const tokens = tokenizeLine("if (x > 0) goto done");
      expect(hasScope(tokens, "if", "keyword.control.pangoscript")).toBe(true);
    });

    it("colors goto keyword", () => {
      const tokens = tokenizeLine("goto LoopStart");
      expect(hasScope(tokens, "goto", "keyword.control.pangoscript")).toBe(true);
    });

    it("colors var keyword", () => {
      const tokens = tokenizeLine("var beatRate");
      expect(hasScope(tokens, "var", "keyword.control.pangoscript")).toBe(true);
    });

    it("colors restart keyword case-insensitively", () => {
      const tokens = tokenizeLine("Restart");
      expect(hasScope(tokens, "Restart", "keyword.control.pangoscript")).toBe(true);
    });
  });

  describe("operators", () => {
    it("colors = assignment operator", () => {
      const tokens = tokenizeLine("x = 1");
      expect(hasScope(tokens, "=", "keyword.operator.pangoscript")).toBe(true);
    });

    it("colors > comparison operator", () => {
      const tokens = tokenizeLine("if (x > 0)");
      expect(hasScope(tokens, ">", "keyword.operator.pangoscript")).toBe(true);
    });

    it("colors <> not-equal operator", () => {
      const tokens = tokenizeLine("x <> y");
      expect(hasScope(tokens, "<>", "keyword.operator.pangoscript")).toBe(true);
    });

    it("colors and word operator", () => {
      const tokens = tokenizeLine("if (a and b)");
      expect(hasScope(tokens, "and", "keyword.operator.word.pangoscript")).toBe(true);
    });

    it("colors ; statement separator", () => {
      const tokens = tokenizeLine("var x; x = 1");
      expect(hasScope(tokens, ";", "keyword.operator.pangoscript")).toBe(true);
    });
  });

  describe("constants", () => {
    it("colors true constant", () => {
      const tokens = tokenizeLine("true");
      expect(hasScope(tokens, "true", "constant.language.pangoscript")).toBe(true);
    });

    it("colors false constant", () => {
      const tokens = tokenizeLine("false");
      expect(hasScope(tokens, "false", "constant.language.pangoscript")).toBe(true);
    });

    it("colors on constant case-insensitively", () => {
      const tokens = tokenizeLine("ON");
      expect(hasScope(tokens, "ON", "constant.language.pangoscript")).toBe(true);
    });
  });

  describe("numbers", () => {
    it("colors integer literals", () => {
      const tokens = tokenizeLine("Sleep 2000");
      expect(hasScope(tokens, "2000", "constant.numeric.pangoscript")).toBe(true);
    });

    it("colors float literals", () => {
      const tokens = tokenizeLine("x = 0.5");
      expect(hasScope(tokens, "0.5", "constant.numeric.pangoscript")).toBe(true);
    });

    it("colors hex literals", () => {
      const tokens = tokenizeLine("Color 0xFF0000");
      expect(hasScope(tokens, "0xFF0000", "constant.numeric.pangoscript")).toBe(true);
    });
  });
});
