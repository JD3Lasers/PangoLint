import { describe, expect, it } from "vitest";

import { parseLine, parseScript } from "../../src/language/parser";

describe("PangoScript parser", () => {
  it("classifies the core line shapes used by PangoScript", () => {
    const parsed = parseScript(
      [
        "var zoneName;",
        "zoneName = Zone.0.Name;",
        'OscOutTTS "/pangolint/ping", "s", "hello"',
        "/beyond/zone/<MyVariable>/select 1",
        "When0:",
        "if (Counter=0) goto When0",
      ].join("\n"),
    );

    expect(parsed.lines.map((line) => line.kind)).toEqual([
      "declaration",
      "assignment",
      "command",
      "oscAddress",
      "label",
      "if",
    ]);
  });

  it("treats Delphi-shaped object and array accessors as assignment syntax", () => {
    const line = parseLine("pointValue = Zone.0.Points[3].X;", 0);

    expect(line.kind).toBe("assignment");
    expect(line.assignment?.target).toBe("pointValue");
    expect(line.assignment?.expression).toBe("Zone.0.Points[3].X");
  });

  it("treats numbered object-tree aliases as assignment roots", () => {
    const line = parseLine("#1.Red = 255", 0);

    expect(line.kind).toBe("assignment");
    expect(line.assignment?.target).toBe("#1.Red");
    expect(line.assignment?.expression).toBe("255");
  });

  it("treats hyphenated FB controller roots as assignment targets", () => {
    const line = parseLine("FB4-ABC123.Connected = 1", 0);

    expect(line.kind).toBe("assignment");
    expect(line.assignment?.target).toBe("FB4-ABC123.Connected");
    expect(line.assignment?.expression).toBe("1");
  });

  it("parses documented inline label plus operator lines", () => {
    const line = parseLine("mylabel: WaitForBeat 4", 0);

    expect(line.kind).toBe("command");
    expect(line.label).toBe("mylabel");
    expect(line.command?.name).toBe("WaitForBeat");
    expect(line.command?.args).toBe("4");
  });

  it("does not classify command arguments containing equals as assignments", () => {
    const line = parseLine("DisplayPopup value=1", 0);

    expect(line.kind).toBe("command");
    expect(line.command?.name).toBe("DisplayPopup");
    expect(line.command?.args).toBe("value=1");
    expect(line.assignment).toBeUndefined();
  });

  it("recognizes function-call syntax with no space before parentheses", () => {
    const line = parseLine("SetCueCaptionColor(page, 1, color1);", 0);

    expect(line.kind).toBe("command");
    expect(line.command?.name).toBe("SetCueCaptionColor");
    expect(line.command?.args).toBe("(page, 1, color1)");
  });

  it("recognizes property-path command forms used by MIDI slot scripts", () => {
    const line = parseLine("Master.PhFriction deltavalue (-1,1)", 0);

    expect(line.kind).toBe("command");
    expect(line.command?.name).toBe("Master.PhFriction");
    expect(line.command?.args).toBe("deltavalue (-1,1)");
  });

  it("preserves comments and strings when splitting code from comments", () => {
    const line = parseLine('OscOutTTS "/x//not-comment", "s", "ok" // real comment', 0);

    expect(line.code).toBe('OscOutTTS "/x//not-comment", "s", "ok"');
    expect(line.comment).toBe("// real comment");
  });

  it("classifies bare braces as block boundaries, not unknown commands", () => {
    expect(parseLine("{", 0).kind).toBe("blockBoundary");
    expect(parseLine("}", 0).kind).toBe("blockBoundary");
    expect(parseLine("   }   ", 0).kind).toBe("blockBoundary");
    expect(parseLine("{ } // empty", 0).kind).toBe("blockBoundary");
  });

  it("parses if (cond) { followed by braced block as found in working examples", () => {
    const parsed = parseScript(["if (foo > 0.5) {", "    swapActive = 0", "    foo = 0", "}"].join("\n"));
    expect(parsed.lines.map((line) => line.kind)).toEqual(["if", "assignment", "assignment", "blockBoundary"]);
  });
});
