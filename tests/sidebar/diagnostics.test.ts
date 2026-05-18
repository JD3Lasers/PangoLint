import { describe, expect, it } from "vitest";

import { summarizeDiagnostics, summarizePangoLintDiagnostics } from "../../src/sidebar/model/diagnostics";
import type { DiagnosticInput } from "../../src/sidebar/model/types";

const sample: DiagnosticInput[] = [
  {
    rule: "unknown-command",
    severity: "warning",
    message: "Unknown command 'Foo'",
    uri: "file:///a.bcode",
    line: 41,
    character: 0,
  },
  {
    rule: "unknown-command",
    severity: "warning",
    message: "Unknown command 'Bar'",
    uri: "file:///a.bcode",
    line: 12,
    character: 4,
  },
  {
    rule: "unbalanced-parens",
    severity: "error",
    message: "Missing ')'",
    uri: "file:///a.bcode",
    line: 57,
    character: 12,
  },
  {
    rule: "label-unused",
    severity: "hint",
    message: "Label not referenced",
    uri: "file:///a.bcode",
    line: 90,
    character: 0,
  },
];

describe("sidebar diagnostics", () => {
  it("groups by rule and sorts groups by severity (error → warning → information → hint)", () => {
    const groups = summarizeDiagnostics(sample);
    expect(groups.map((group) => group.rule)).toEqual(["unbalanced-parens", "unknown-command", "label-unused"]);
  });

  it("sorts entries within a group by uri then line then character", () => {
    const groups = summarizeDiagnostics(sample);
    const unknownCommand = groups.find((group) => group.rule === "unknown-command");
    expect(unknownCommand?.entries.map((entry) => entry.line)).toEqual([12, 41]);
  });

  it("uses the most severe severity in a mixed group", () => {
    const mixed: DiagnosticInput[] = [
      { rule: "x", severity: "warning", message: "w", uri: "file:///a", line: 1, character: 0 },
      { rule: "x", severity: "error", message: "e", uri: "file:///a", line: 2, character: 0 },
    ];
    const groups = summarizeDiagnostics(mixed);
    expect(groups[0]?.severity).toBe("error");
    expect(groups[0]?.count).toBe(2);
  });

  it("summarizes only diagnostics emitted by PangoLint", () => {
    const groups = summarizePangoLintDiagnostics([
      {
        rule: "unknown-command",
        severity: "warning",
        message: "Unknown command 'Foo'",
        uri: "file:///a.bcode",
        line: 1,
        character: 0,
        source: "PangoLint",
      },
      {
        rule: "typescript",
        severity: "error",
        message: "External diagnostic",
        uri: "file:///a.bcode",
        line: 2,
        character: 0,
        source: "OtherTool",
      },
      {
        rule: "unknown-source",
        severity: "warning",
        message: "Missing source should not be treated as PangoLint",
        uri: "file:///a.bcode",
        line: 3,
        character: 0,
      },
    ]);

    expect(groups.map((group) => group.rule)).toEqual(["unknown-command"]);
  });
});
