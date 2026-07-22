import { describe, expect, it } from "vitest";

import { parseCommandCatalog } from "../../src/knowledge/catalog";
import type { CommandKnowledgeEntry } from "../../src/knowledge/knowledgeBase";
import { lintPangoScript } from "../../src/language/diagnostics";

function knowledgeMap(entries: CommandKnowledgeEntry[]): Map<string, CommandKnowledgeEntry> {
  const map = new Map<string, CommandKnowledgeEntry>();
  for (const entry of entries) map.set(entry.canonical.toLowerCase(), entry);
  return map;
}

function entry(
  overrides: Partial<CommandKnowledgeEntry> & Pick<CommandKnowledgeEntry, "canonical">,
): CommandKnowledgeEntry {
  return {
    aliases: [],
    description: "",
    evidenceLevel: "exported",
    confidence: "medium",
    category: "General",
    ...overrides,
  };
}

const catalog = parseCommandCatalog(
  [
    'OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)',
    "SelectZone|SelectZone 1",
    "Brightness|Brightness 100",
    "WaitForBeat|WaitForBeat 4",
    'DisplayPopup|DisplayPopup "Hello"',
  ].join("\n"),
);

describe("PangoScript diagnostics", () => {
  it("warns for unknown leading commands", () => {
    const diagnostics = lintPangoScript(["BogusCommand 1", "exit"].join("\n"), catalog);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "unknown-command",
        severity: "warning",
      }),
    ]);
  });

  it("does not reject documented or Delphi-shaped expression syntax", () => {
    const diagnostics = lintPangoScript(
      [
        "var zoneBrightness",
        "zoneBrightness = Zone.0.Brightness",
        "/beyond/zone/<zoneBrightness>/select 1",
        "exit",
      ].join("\n"),
      catalog,
    );

    expect(diagnostics).toEqual([]);
  });

  it("warns when a curated command is called with too few arguments", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "Brightness",
        forms: [
          {
            signature: "Brightness <value>",
            parameters: [{ name: "value", type: "number", required: true }],
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript(["Brightness", "exit"].join("\n"), catalog, knowledge);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "wrong-arg-count",
        message: expect.stringContaining("expects 1 argument, got 0"),
      }),
    ]);
  });

  it("warns when a curated command is called with too many arguments", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "Brightness",
        forms: [
          {
            signature: "Brightness <value>",
            parameters: [{ name: "value", type: "number", required: true }],
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript(["Brightness 50, 100", "exit"].join("\n"), catalog, knowledge);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "wrong-arg-count",
        message: expect.stringContaining("expects 1 argument, got 2"),
      }),
    ]);
  });

  it("does not let generated optional examples mask curated required arity", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "Brightness",
        forms: [
          {
            signature: "Brightness 100",
            parameters: [{ name: "arg1", type: "unknown", required: false }],
          },
          {
            signature: "Brightness <value>",
            parameters: [{ name: "value", type: "number", required: true }],
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript(["Brightness", "exit"].join("\n"), catalog, knowledge);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "wrong-arg-count",
        message: expect.stringContaining("expects 1 argument, got 0"),
      }),
    ]);
  });

  it("keeps generated example arities accepted when curated forms are narrower", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "StopCueSync",
        forms: [
          {
            signature: "StopCueSync 1, 1, 0.5",
            parameters: [
              { name: "arg1", type: "unknown", required: false },
              { name: "arg2", type: "unknown", required: false },
              { name: "arg3", type: "unknown", required: false },
            ],
          },
          {
            signature: "StopCueSync <page>, <cell>",
            parameters: [
              { name: "page", type: "integer", required: true },
              { name: "cell", type: "integer", required: true },
            ],
          },
        ],
      }),
    ]);
    const stopCatalog = parseCommandCatalog(["StopCueSync|StopCueSync 1, 1, 0.5"].join("\n"));

    expect(
      lintPangoScript("StopCueSync 1, 1, 0.5", stopCatalog, knowledge).filter((d) => d.code === "wrong-arg-count"),
    ).toEqual([]);
  });

  it("accepts function-call form with the correct arg count", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "SetCueCaptionColor",
        forms: [
          {
            signature: "SetCueCaptionColor <page>, <cue>, <color>",
            parameters: [
              { name: "page", type: "integer", required: true },
              { name: "cue", type: "integer", required: true },
              { name: "color", type: "integer", required: true },
            ],
          },
        ],
      }),
    ]);
    const callCatalog = parseCommandCatalog(["SetCueCaptionColor|SetCueCaptionColor 1, 1, 0"].join("\n"));
    const diagnostics = lintPangoScript("SetCueCaptionColor(page, 1, color1);", callCatalog, knowledge);

    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([]);
  });

  it("does not warn when a variadic command has at least its required arguments", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "OscOutTTS",
        forms: [
          {
            signature: 'OscOutTTS "<address>", "<types>", <args>...',
            parameters: [
              { name: "address", type: "string", required: true },
              { name: "types", type: "string", required: true },
              { name: "args", type: "variadic", required: false },
            ],
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript('OscOutTTS "/x", "ssf", "a", "b", 1, 2, 3', catalog, knowledge);

    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([]);
  });

  it("warns when a variadic command is missing required arguments", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "OscOutTTS",
        forms: [
          {
            signature: 'OscOutTTS "<address>", "<types>", <args>...',
            parameters: [
              { name: "address", type: "string", required: true },
              { name: "types", type: "string", required: true },
              { name: "args", type: "variadic", required: false },
            ],
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript(['OscOutTTS "/x",', "exit"].join("\n"), catalog, knowledge);
    const arity = diagnostics.filter((d) => d.code === "wrong-arg-count");

    expect(arity).toHaveLength(1);
    expect(arity[0].message).toContain("expects at least 2 arguments, got 1");
  });

  it("does not infer zero arity from generated literal examples without parameter metadata", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "OscOutTTS",
        forms: [
          {
            signature: 'OscOutTTS "",""',
            description: "Address, Type Tag String, Arguments (optional)",
          },
        ],
      }),
    ]);
    const diagnostics = lintPangoScript('OscOutTTS "/x", "s", "ok"', catalog, knowledge);

    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([]);
  });

  it("does not let generated bare stubs satisfy curated required arity", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "HtmlBody",
        forms: [
          { signature: "HtmlBody" },
          {
            signature: 'HtmlBody "<html>"',
            parameters: [{ name: "html", type: "string", required: true }],
          },
        ],
      }),
    ]);
    const htmlCatalog = parseCommandCatalog(["HtmlBody|HtmlBody"].join("\n"));
    const diagnostics = lintPangoScript("HtmlBody", htmlCatalog, knowledge);

    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([
      expect.objectContaining({
        code: "wrong-arg-count",
        message: expect.stringContaining("expects 1 argument, got 0"),
      }),
    ]);
  });

  it("accepts curated repeatable forms encoded as 1..N string parameters", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "PulseEvent",
        forms: [
          {
            signature: 'PulseEvent "<eventName>"',
            parameters: [{ name: "eventName", type: "string", required: true }],
          },
          {
            signature: 'PulseEvent "<eventName1>", "<eventName2>", ...',
            parameters: [
              {
                name: "eventName1..N",
                type: "string",
                required: true,
                description: "One or more event names to pulse simultaneously. Repeatable.",
              },
            ],
          },
        ],
      }),
      entry({
        canonical: "DeletePropAni",
        forms: [
          { signature: "DeletePropAni", parameters: [] },
          {
            signature: 'DeletePropAni "<propertyName>"[, "<propertyName>", ...]',
            parameters: [
              {
                name: "propertyName1..N",
                type: "string",
                required: true,
                description: "Full dotted property path of an animation to cancel. Repeatable.",
              },
            ],
          },
        ],
      }),
    ]);

    expect(
      lintPangoScript('PulseEvent "A", "B", "C"', catalog, knowledge).filter((d) => d.code === "wrong-arg-count"),
    ).toEqual([]);
    expect(
      lintPangoScript('DeletePropAni "Master.Brightness", "Master.SizeX"', catalog, knowledge).filter(
        (d) => d.code === "wrong-arg-count",
      ),
    ).toEqual([]);
    expect(lintPangoScript("DeletePropAni", catalog, knowledge).filter((d) => d.code === "wrong-arg-count")).toEqual(
      [],
    );
  });

  it("does not warn when knowledge map is omitted (back-compat)", () => {
    const diagnostics = lintPangoScript("Brightness", catalog);

    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([]);
  });

  it("does not warn on function-call syntax for known commands", () => {
    const callCatalog = parseCommandCatalog(
      [
        'OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)',
        "SetCueCaptionColor|SetCueCaptionColor 1, 1, 0",
      ].join("\n"),
    );
    const diagnostics = lintPangoScript(
      ["SetCueCaptionColor(page, 1, color1);", "SetCueCaptionColor(page, 2, color2)"].join("\n"),
      callCatalog,
    );

    expect(diagnostics.filter((d) => d.code === "unknown-command")).toEqual([]);
  });

  it("accepts zone-scoped property writes (dotted and bracket assignment)", () => {
    const diagnostics = lintPangoScript(
      ["Zone.0.Brightness = 50", "Zone[0].Brightness = 100", "Zone.0.SizeX = 75", "exit"].join("\n"),
      catalog,
    );

    expect(diagnostics).toEqual([]);
  });

  it("warns when a bare goto target has no matching label", () => {
    const diagnostics = lintPangoScript("goto MissingLabel", catalog);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("missing-label");
  });

  it("warns when a goto target is quoted", () => {
    const diagnostics = lintPangoScript(['goto "Start"', "Start:", "exit"].join("\n"), catalog);

    expect(diagnostics.filter((d) => d.code === "unsupported-quoted-goto-label")).toEqual([
      expect.objectContaining({
        line: 0,
        severity: "warning",
        message: expect.stringContaining("Illegal goto label: Start"),
      }),
    ]);
    expect(diagnostics.filter((d) => d.code === "missing-label")).toEqual([]);
  });

  it("accepts goto targets defined by inline label/operator lines", () => {
    const diagnostics = lintPangoScript(["mylabel: WaitForBeat 4", "goto mylabel", "exit"].join("\n"), catalog);

    expect(diagnostics).toEqual([]);
  });

  it("accepts goto targets resolved from initialized string variables", () => {
    const diagnostics = lintPangoScript(
      [
        "var targetName",
        'targetName = "DoneSection"',
        "goto targetName",
        "DoneSection:",
        'OscOutTTS "/x", "s", "done"',
        "exit",
      ].join("\n"),
      catalog,
    );

    expect(diagnostics).toEqual([]);
  });

  it("warns when a declared variable is read before local initialization", () => {
    const diagnostics = lintPangoScript(["var zoneName", 'OscOutTTS "/x", "s", zoneName', "exit"].join("\n"), catalog);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "uninitialized-variable",
        message: expect.stringContaining("zoneName"),
      }),
    ]);
  });

  it("reports unclosed strings and unbalanced parentheses", () => {
    const diagnostics = lintPangoScript('if ((1>0) OscOutTTS "/x, "s"', catalog);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["unclosed-string", "unbalanced-parentheses"]),
    );
  });

  it("reports premature closing parentheses even when final balance is zero", () => {
    const diagnostics = lintPangoScript(['if )( DisplayPopup "bad"', "exit"].join("\n"), catalog);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "unbalanced-parentheses",
      }),
    ]);
  });

  it("does not warn after the variable has been assigned earlier in the file", () => {
    const diagnostics = lintPangoScript(
      ["var zoneName", 'zoneName = "Main"', 'OscOutTTS "/x", "s", zoneName'].join("\n"),
      catalog,
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "uninitialized-variable")).toEqual([]);
  });

  describe("unused-* hints", () => {
    it("hints when a Var is declared but never read", () => {
      const diagnostics = lintPangoScript(["var unusedThing", "Brightness 50"].join("\n"), catalog);
      const unused = diagnostics.filter((d) => d.code === "unused-variable");
      expect(unused).toHaveLength(1);
      expect(unused[0].severity).toBe("hint");
      expect(unused[0].message).toContain("unusedThing");
    });

    it("does not hint when the Var is read anywhere in the file", () => {
      const diagnostics = lintPangoScript(
        ["var zoneName", 'zoneName = "Main"', 'OscOutTTS "/x", "s", zoneName'].join("\n"),
        catalog,
      );
      expect(diagnostics.filter((d) => d.code === "unused-variable")).toEqual([]);
    });

    it("does not hint for GlobalVar declarations (assumed externally referenced)", () => {
      const diagnostics = lintPangoScript("globalvar sharedCounter", catalog);
      expect(diagnostics.filter((d) => d.code === "unused-variable")).toEqual([]);
    });

    it("hints when a label is declared but never targeted (file has gotos)", () => {
      const diagnostics = lintPangoScript(
        ["loopStart:", "  Brightness 50", "  goto loopStart", "deadLabel:"].join("\n"),
        catalog,
      );
      const unused = diagnostics.filter((d) => d.code === "unused-label");
      expect(unused).toHaveLength(1);
      expect(unused[0].severity).toBe("hint");
      expect(unused[0].message).toContain("deadLabel");
    });

    it("stays silent for labels in files with no gotos (treated as event entry points)", () => {
      const diagnostics = lintPangoScript(["onclick:", "  Brightness 50"].join("\n"), catalog);
      expect(diagnostics.filter((d) => d.code === "unused-label")).toEqual([]);
    });

    it("does not hint OnClick / Init / Start even when the file has gotos", () => {
      const diagnostics = lintPangoScript(
        ["init:", "  Brightness 0", "loopStart:", "  Brightness 50", "  goto loopStart"].join("\n"),
        catalog,
      );
      expect(diagnostics.filter((d) => d.code === "unused-label")).toEqual([]);
    });

    it("entry-point-name match is case-insensitive", () => {
      const diagnostics = lintPangoScript(
        ["ONCLICK:", "  Brightness 0", "loopStart:", "  Brightness 50", "  goto loopStart"].join("\n"),
        catalog,
      );
      expect(diagnostics.filter((d) => d.code === "unused-label")).toEqual([]);
    });
  });

  it("warns when a zero-arity command is called with arguments", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "EnableLaserOutput",
        evidenceLevel: "documented",
        confidence: "high",
        forms: [{ signature: "EnableLaserOutput", parameters: [] }],
      }),
    ]);
    const diagnostics = lintPangoScript("EnableLaserOutput 1", catalog, knowledge);
    const arity = diagnostics.filter((d) => d.code === "wrong-arg-count");
    expect(arity).toHaveLength(1);
    expect(arity[0].message).toContain("expects 0 arguments, got 1");
  });

  it("does not warn when a zero-arity command is called bare", () => {
    const knowledge = knowledgeMap([
      entry({
        canonical: "EnableLaserOutput",
        evidenceLevel: "documented",
        confidence: "high",
        forms: [{ signature: "EnableLaserOutput", parameters: [] }],
      }),
    ]);
    const diagnostics = lintPangoScript("EnableLaserOutput", catalog, knowledge);
    expect(diagnostics.filter((d) => d.code === "wrong-arg-count")).toEqual([]);
  });

  it("does not flag For/Next as unknown commands", () => {
    const diagnostics = lintPangoScript(["For x = 1 To 10", "  Brightness x", "Next"].join("\n"), catalog);
    expect(diagnostics.filter((d) => d.code === "unknown-command")).toEqual([]);
  });

  it("flags Delphi-style For assignment ranges that BEYOND reports as an operation error", () => {
    const diagnostics = lintPangoScript(
      ["For sweepIndex = 1 To 3", "  Brightness sweepIndex", "Next"].join("\n"),
      catalog,
    );
    const rangeSyntax = diagnostics.filter((d) => d.code === "unsupported-for-range-syntax");

    expect(rangeSyntax).toHaveLength(1);
    expect(rangeSyntax[0]).toMatchObject({
      line: 0,
      severity: "error",
    });
    expect(rangeSyntax[0].message).toContain("Operation expected: to");
  });

  it("warns when textual logical operators are used in If conditions", () => {
    const andDiagnostics = lintPangoScript(
      ["if ((value > 1) and (value < 5)) goto InRange", "InRange:", "exit"].join("\n"),
      catalog,
    );
    const andOperator = andDiagnostics.filter((d) => d.code === "unsupported-logical-operator");

    expect(andOperator).toHaveLength(1);
    expect(andOperator[0]).toMatchObject({
      line: 0,
      severity: "warning",
    });
    expect(andOperator[0].message).toContain("Operation expected: and");

    const orDiagnostics = lintPangoScript(
      ["if (value < 1 or value > 5) goto OutOfRange", "OutOfRange:", "exit"].join("\n"),
      catalog,
    );
    expect(orDiagnostics.filter((d) => d.code === "unsupported-logical-operator")[0].message).toContain(
      "Operation expected: or",
    );

    const labelDiagnostics = lintPangoScript(["if (value > 1) goto OrBranch", "OrBranch:", "exit"].join("\n"), catalog);
    expect(labelDiagnostics.filter((d) => d.code === "unsupported-logical-operator")).toEqual([]);
  });

  it("warns when bang not-equal is used in If conditions", () => {
    const diagnostics = lintPangoScript(
      ["if (leftValue != rightValue) goto NotEqual", "NotEqual:", "exit"].join("\n"),
      catalog,
    );
    const bangNotEqual = diagnostics.filter((d) => d.code === "unsupported-bang-not-equal-operator");

    expect(bangNotEqual).toHaveLength(1);
    expect(bangNotEqual[0]).toMatchObject({
      line: 0,
      start: 14,
      severity: "warning",
    });
    expect(bangNotEqual[0].message).toContain("Operation expected: !");
    expect(bangNotEqual[0].message).toContain("<>");
  });

  it("warns when DeltaValue is used as a general assignment expression", () => {
    const assignmentDiagnostics = lintPangoScript(
      ["var deltaScaledValue", "deltaScaledValue = DeltaValue(-1, 1)", "exit"].join("\n"),
      catalog,
    );
    const deltaValueAssignment = assignmentDiagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-deltavalue-assignment",
    );

    expect(deltaValueAssignment).toHaveLength(1);
    expect(deltaValueAssignment[0]).toMatchObject({
      line: 1,
      severity: "warning",
    });
    expect(deltaValueAssignment[0].message).toContain("Unknown function");

    const propertyArgumentDiagnostics = lintPangoScript("Master.PhFriction DeltaValue(-1, 1)\nexit", catalog);
    expect(
      propertyArgumentDiagnostics.filter((diagnostic) => diagnostic.code === "unsupported-deltavalue-assignment"),
    ).toEqual([]);
  });

  it("does not treat spaced DeltaValue assignment syntax as a same-named variable read", () => {
    const diagnostics = lintPangoScript(
      ["var deltaValue", "deltaValue = deltavalue (-1,1)", "exit"].join("\n"),
      catalog,
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unsupported-deltavalue-assignment")).toHaveLength(1);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "uninitialized-variable")).toEqual([]);
  });

  it("warns when DeltaValue is used as a property or command argument", () => {
    const diagnostics = lintPangoScript("Master.PhFriction DeltaValue(-1, 1)\nexit", catalog);
    const deltaValueArgument = diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-deltavalue-command-argument",
    );

    expect(deltaValueArgument).toHaveLength(1);
    expect(deltaValueArgument[0]).toMatchObject({
      line: 0,
      severity: "warning",
    });
    expect(deltaValueArgument[0].message).toContain("Unknown function");
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toEqual([]);
  });

  it("keeps unknown-command diagnostics when a DeltaValue command argument is also unsupported", () => {
    const diagnostics = lintPangoScript("NotACommand DeltaValue(-1, 1)\nexit", catalog);

    expect(
      diagnostics.filter((diagnostic) => diagnostic.code === "unsupported-deltavalue-command-argument"),
    ).toHaveLength(1);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toHaveLength(1);
  });

  it("hints that spaced DeltaValue property commands are MIDI-slot scoped", () => {
    const diagnostics = lintPangoScript("Master.PhFriction deltavalue (-1,1)\nexit", catalog);
    const contextHint = diagnostics.filter((diagnostic) => diagnostic.code === "deltavalue-midi-slot-context");

    expect(contextHint).toHaveLength(1);
    expect(contextHint[0]).toMatchObject({
      line: 0,
      severity: "hint",
    });
    expect(contextHint[0].message).toContain("MIDI-to-PangoScript slot");
    expect(contextHint[0].message).toContain("editor");
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toEqual([]);
  });

  it("warns when ExtValue is used inside a DefineMidiTrigger script", () => {
    const diagnostics = lintPangoScript(
      [
        'DefineMidiTrigger 0xB0, 0x00, "PangoLint ExtValue trigger"',
        'InRangeTrigger 64, 64, "ReadExtValue"',
        "exit",
        "ReadExtValue:",
        "normalValue = ExtValue(0, 127)",
        "exit",
      ].join("\n"),
      catalog,
    );
    const extValueTriggerDefault = diagnostics.filter(
      (diagnostic) => diagnostic.code === "extvalue-define-midi-trigger-default",
    );

    expect(extValueTriggerDefault).toHaveLength(1);
    expect(extValueTriggerDefault[0]).toMatchObject({
      line: 4,
      severity: "hint",
    });
    expect(extValueTriggerDefault[0].message).toContain("returns default values");

    const midiSlotDiagnostics = lintPangoScript(["normalValue = ExtValue(0, 127)", "exit"].join("\n"), catalog);
    expect(
      midiSlotDiagnostics.filter((diagnostic) => diagnostic.code === "extvalue-define-midi-trigger-default"),
    ).toEqual([]);
  });

  it("warns on BEYOND-rejected Zone.N.Points bracket-index reads", () => {
    const diagnostics = lintPangoScript(["var pointX", "pointX = Zone.0.Points[0].X", "exit"].join("\n"), catalog);
    const propertyIndexAccess = diagnostics.filter((d) => d.code === "unsupported-property-index-access");

    expect(propertyIndexAccess).toHaveLength(1);
    expect(propertyIndexAccess[0]).toMatchObject({
      line: 1,
      severity: "warning",
    });
    expect(propertyIndexAccess[0].message).toContain("Invalid array index value");
  });

  it("does not warn for quoted Zone.N.Points property path strings", () => {
    const diagnostics = lintPangoScript('AnimateProp "Zone.0.Points[3].X", 0, 1, 1000', catalog);

    expect(diagnostics.filter((d) => d.code === "unsupported-property-index-access")).toEqual([]);
  });

  it("hints when an unsupported loop keyword (While/Do/Repeat/Until/Loop) is used", () => {
    const diagnostics = lintPangoScript(["While x > 0", "  Brightness x", "Loop"].join("\n"), catalog);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("unsupported-loop");
    // 'While' and 'Loop' should both flag; neither should also be 'unknown-command'.
    expect(diagnostics.filter((d) => d.code === "unsupported-loop")).toHaveLength(2);
    expect(codes).not.toContain("unknown-command");
  });

  it("does not flag braced if-blocks (working-example syntax) as unknown commands", () => {
    const diagnostics = lintPangoScript(
      ["var swapActive", "if (swapActive > 0.5) {", "    swapActive = 0", "    Brightness 50", "}"].join("\n"),
      catalog,
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toEqual([]);
  });

  it("hints when a script does not end with exit", () => {
    const diagnostics = lintPangoScript(["var value", "value = Master.Brightness"].join("\n"), catalog);
    const missingExit = diagnostics.filter((diagnostic) => diagnostic.code === "missing-terminal-exit");

    expect(missingExit).toHaveLength(1);
    expect(missingExit[0]).toMatchObject({
      line: 1,
      severity: "hint",
    });
    expect(missingExit[0].message).toContain("recommended");
  });

  it("warns when exit has a trailing semicolon", () => {
    const diagnostics = lintPangoScript("exit;", catalog);

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unsupported-exit-semicolon")).toEqual([
      expect.objectContaining({
        line: 0,
        severity: "warning",
        message: expect.stringContaining("Invalid expression"),
      }),
    ]);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "missing-terminal-exit")).toEqual([]);
  });

  it("accepts scripts whose final executable line is exit", () => {
    const diagnostics = lintPangoScript(["var value", "value = Master.Brightness", "Done: exit"].join("\n"), catalog);

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "missing-terminal-exit")).toEqual([]);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toEqual([]);
  });
});

import { buildObjectPropertyIndex, type ObjectPropertyIndexFile } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import { findPropertyTypoDiagnostics } from "../../src/language/diagnostics/propertyPathDiagnostics";
import { levenshteinDistance } from "../../src/language/diagnostics/stringDistance";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings (case-insensitive)", () => {
    expect(levenshteinDistance("Master.Brightness", "master.brightness")).toBe(0);
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("returns the substitution count for single-character typos", () => {
    expect(levenshteinDistance("RotoAngleX", "RotoAngleZ")).toBe(1);
    expect(levenshteinDistance("RotoAngleX", "RotoAngeX")).toBe(1);
  });

  it("returns the longer string length for empty input", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("findPropertyTypoDiagnostics", () => {
  const fixture: PropertyIndexFile = {
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    schemas: [
      {
        object: "Master",
        isArray: false,
        propertyCount: 4,
        properties: ["Brightness", "RotoAngleX", "RotoAngleY", "Pause"],
        sharedWithAliases: 0,
      },
      {
        object: "Zone",
        isArray: true,
        propertyCount: 2,
        properties: ["RotoAngleX", "Red"],
        sharedWithAliases: 23,
      },
      {
        object: "Universe",
        isArray: true,
        propertyCount: 1,
        properties: ["N.Caption"],
        sharedWithAliases: 0,
      },
      {
        object: "Projector",
        isArray: true,
        propertyCount: 2,
        properties: ["Name"],
        rootProperties: ["Count"],
        sharedWithAliases: 0,
      },
    ],
  };
  const propertyIndex = buildPropertyIndex(fixture);
  const objectPropertyIndex = buildObjectPropertyIndex({
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    entries: [
      {
        path: "WS.N.N.Caption",
        normalizedPath: "WS.N.N.Caption",
        root: "WS",
        property: "Caption",
        kind: "object",
        confidence: "observed",
        searchText: "workspace cue caption",
        variantCount: 1,
        variants: [{ path: "WS.0.0.Caption", osc: "/b/WS/0/0/Caption" }],
      },
      {
        path: "WS.N.N.Ani.0.MaxValue",
        normalizedPath: "WS.N.N.Ani.0.MaxValue",
        root: "WS",
        property: "Ani.0.MaxValue",
        kind: "object",
        confidence: "observed",
        searchText: "workspace cue animation max value",
        variantCount: 1,
        variants: [{ path: "WS.0.0.Ani.0.MaxValue", osc: "/b/WS/0/0/Ani/0/MaxValue" }],
      },
      {
        path: "UniversePanelAlias.Control.Zone.Count",
        normalizedPath: "UniversePanelAlias.Control.Zone.Count",
        root: "UniversePanelAlias",
        property: "Control.Zone.Count",
        kind: "object",
        confidence: "observed",
        searchText: "universe panel alias zone count",
        variantCount: 1,
        variants: [{ path: "UniversePanelAlias.Control.Zone.Count" }],
      },
      {
        path: "UniversePanelAlias.Control.Zone.ScanRate",
        normalizedPath: "UniversePanelAlias.Control.Zone.ScanRate",
        root: "UniversePanelAlias",
        property: "Control.Zone.ScanRate",
        kind: "object",
        confidence: "observed",
        searchText: "universe panel alias zone scan rate",
        variantCount: 1,
        variants: [{ path: "UniversePanelAlias.Control.Zone.ScanRate" }],
      },
      {
        path: "UniversePanelAlias.Control.Zone.Visible",
        normalizedPath: "UniversePanelAlias.Control.Zone.Visible",
        root: "UniversePanelAlias",
        property: "Control.Zone.Visible",
        kind: "object",
        confidence: "observed",
        searchText: "universe panel alias zone visible",
        variantCount: 1,
        variants: [{ path: "UniversePanelAlias.Control.Zone.Visible" }],
      },
      {
        path: "Universe.N.Button1.Caption",
        normalizedPath: "Universe.N.Button1.Caption",
        root: "Universe",
        property: "Button1.Caption",
        kind: "object",
        confidence: "observed",
        searchText: "universe button caption",
        variantCount: 1,
        variants: [{ path: "Universe.1.Button1.Caption" }],
      },
      {
        path: "FB4_XXXXX.Connected",
        normalizedPath: "FB4_XXXXX.Connected",
        root: "FB4_XXXXX",
        property: "Connected",
        kind: "object",
        confidence: "observed",
        searchText: "fb4 hardware controller connected",
        variantCount: 1,
        variants: [{ path: "FB4_XXXXX.Connected" }],
      },
    ],
  } satisfies ObjectPropertyIndexFile);

  it("emits a hint when a known-object property is a close typo", () => {
    const diagnostics = findPropertyTypoDiagnostics("v = Master.RotoAngeX", 0, propertyIndex);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: "hint",
      code: "property-typo",
      line: 0,
    });
    expect(diagnostics[0].message).toContain("Master.RotoAngleX");
  });

  it("stays silent for verified property paths (no false positive)", () => {
    expect(findPropertyTypoDiagnostics("v = Master.RotoAngleX", 0, propertyIndex)).toEqual([]);
    expect(findPropertyTypoDiagnostics("Zone.0.Red = 200", 0, propertyIndex)).toEqual([]);
  });

  it("accepts direct root leaves but rejects nested paths below them", () => {
    expect(findPropertyTypoDiagnostics("v = Projector.Count", 0, propertyIndex)).toEqual([]);

    const diagnostics = findPropertyTypoDiagnostics("v = Projector.Count.Name", 0, propertyIndex);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "property-typo",
      message: expect.stringContaining("Did you mean Projector.Count?"),
    });
    expect(findPropertyTypoDiagnostics("v = Projector.count.Name", 0, propertyIndex)).toHaveLength(1);
  });

  it("stays silent for unknown root objects (user-defined universes)", () => {
    expect(findPropertyTypoDiagnostics("COLORPICKER.X.Y = 1", 0, propertyIndex)).toEqual([]);
    expect(findPropertyTypoDiagnostics("SHOWKONTROL.PangoBlock.Caption = ''", 0, propertyIndex)).toEqual([]);
  });

  it("stays silent for Object Tree paths with literal numeric property members", () => {
    expect(findPropertyTypoDiagnostics("WS.1.2.Ani.0.MaxValue = 1", 0, propertyIndex, 0, objectPropertyIndex)).toEqual(
      [],
    );
  });

  it("uses concrete Object Tree paths for typo suggestions", () => {
    const diagnostics = findPropertyTypoDiagnostics(
      "WS.1.2.Captino = 'Main'",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("WS.1.2.Caption"),
      }),
    );
    expect(diagnostics[0].message).not.toContain("WS.N.N.Caption");
  });

  it("uses Object Tree typo hints for roots that also have canonical schemas", () => {
    const diagnostics = findPropertyTypoDiagnostics(
      "Universe.1.Button1.Captino = 'Main'",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("Universe.1.Button1.Caption"),
      }),
    );
  });

  it("preserves typed FB controller serial roots in Object Tree typo suggestions", () => {
    const diagnostics = findPropertyTypoDiagnostics(
      "FB4_ABC123.Conected = 1",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("FB4_ABC123.Connected"),
      }),
    );
    expect(diagnostics[0].message).not.toContain("FB4_XXXXX.Connected");
  });

  it("accepts hyphenated FB controller roots end to end when Object Tree confirms the path", () => {
    const diagnostics = lintPangoScript(
      "FB4-ABC123.Connected = 1",
      catalog,
      undefined,
      propertyIndex,
      objectPropertyIndex,
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "unknown-command")).toEqual([]);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "property-typo")).toEqual([]);
  });

  it("preserves hyphenated FB controller serial roots in Object Tree typo suggestions", () => {
    const diagnostics = findPropertyTypoDiagnostics(
      "FB4-ABC123.Conected = 1",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("FB4-ABC123.Connected"),
      }),
    );
    expect(diagnostics[0].message).not.toContain("FB4_XXXXX.Connected");
  });

  it("does not suggest Object Tree template placeholders as concrete fixes", () => {
    const diagnostics = findPropertyTypoDiagnostics(
      "WS.1.A.Captino = 'Main'",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "property-typo")).toEqual([]);
  });

  it("compares Object Tree typo candidates by the mismatched segment, not the shared prefix", () => {
    const unrelated = findPropertyTypoDiagnostics(
      "UniversePanelAlias.Control.Zone.Nonsense = 1",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );
    expect(unrelated.filter((diagnostic) => diagnostic.code === "property-typo")).toEqual([]);

    const close = findPropertyTypoDiagnostics(
      "UniversePanelAlias.Control.Zone.Visibl = 1",
      0,
      propertyIndex,
      0,
      objectPropertyIndex,
    );
    expect(close).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("UniversePanelAlias.Control.Zone.Visible"),
      }),
    );
  });

  it("scans all compatible Object Tree typo candidates before choosing the best suggestion", () => {
    const crowdedObjectPropertyIndex = buildObjectPropertyIndex({
      schemaVersion: 1,
      generatedAt: "",
      generatedFrom: "test",
      entries: [
        ...Array.from({ length: 520 }, (_, index) => ({
          path: `UniversePanelAlias.Control.Zone.Filler${index}`,
          normalizedPath: `UniversePanelAlias.Control.Zone.Filler${index}`,
          root: "UniversePanelAlias",
          property: `Control.Zone.Filler${index}`,
          kind: "object" as const,
          confidence: "observed" as const,
          searchText: `filler ${index}`,
          variantCount: 1,
          variants: [{ path: `UniversePanelAlias.Control.Zone.Filler${index}` }],
        })),
        {
          path: "UniversePanelAlias.Control.Zone.ScanRate",
          normalizedPath: "UniversePanelAlias.Control.Zone.ScanRate",
          root: "UniversePanelAlias",
          property: "Control.Zone.ScanRate",
          kind: "object",
          confidence: "observed",
          searchText: "universe panel alias zone scan rate",
          variantCount: 1,
          variants: [{ path: "UniversePanelAlias.Control.Zone.ScanRate" }],
        },
      ],
    } satisfies ObjectPropertyIndexFile);

    const diagnostics = findPropertyTypoDiagnostics(
      "UniversePanelAlias.Control.Zone.ScanRat = 1",
      0,
      propertyIndex,
      0,
      crowdedObjectPropertyIndex,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        message: expect.stringContaining("UniversePanelAlias.Control.Zone.ScanRate"),
      }),
    );
  });

  it("stays silent when there's no close match (avoids noise)", () => {
    expect(findPropertyTypoDiagnostics("v = Master.TotalNonsense", 0, propertyIndex)).toEqual([]);
  });

  it("handles array-shape paths (Zone.<index>.<prop>)", () => {
    const diagnostics = findPropertyTypoDiagnostics("Zone.0.Rede = 200", 0, propertyIndex);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Zone.0.Red");
  });

  it("reports typo ranges in original document columns when code is indented", () => {
    const diagnostics = lintPangoScript("    Master.RotoAngeX = 1", catalog, undefined, propertyIndex);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "property-typo",
        start: 4,
        length: "Master.RotoAngeX".length,
      }),
    );
  });

  it("dedupes per line - same path mentioned twice yields one hint", () => {
    const diagnostics = findPropertyTypoDiagnostics("a = Master.RotoAngeX + Master.RotoAngeX", 0, propertyIndex);
    expect(diagnostics).toHaveLength(1);
  });

  describe("per-button schema dispatch", () => {
    const dispatchFixture: PropertyIndexFile = {
      schemaVersion: 1,
      generatedAt: "",
      generatedFrom: "test",
      schemas: [
        {
          object: "UniverseEffectControl",
          isArray: true,
          propertyCount: 2,
          properties: ["Effect.IntensityX", "Effect.SpeedX"],
          sharedWithAliases: 0,
        },
        {
          object: "MyPanel",
          isArray: true,
          propertyCount: 1,
          properties: ["Caption"],
          sharedWithAliases: 0,
          inheritedFrom: "UniversePanel",
          arrayIndices: ["STROBE"],
          perIndexSchemas: { strobe: "UniverseEffectControl" },
        },
      ],
    };
    const dispatchIndex = buildPropertyIndex(dispatchFixture);

    it("verifies typos against the bound control schema, not the panel", () => {
      // Effect.IntensityZ is a typo of Effect.IntensityX in UniverseEffectControl.
      // Without dispatch this would check against MyPanel.properties (just
      // ["Caption"]) and either flag a wrong suggestion or no suggestion.
      const diagnostics = findPropertyTypoDiagnostics("MyPanel.STROBE.Effect.IntensityZ = 50", 0, dispatchIndex);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain("Effect.IntensityX");
    });

    it("stays silent for verified Effect.* paths on a classified button", () => {
      expect(findPropertyTypoDiagnostics("MyPanel.STROBE.Effect.IntensityX = 50", 0, dispatchIndex)).toEqual([]);
    });

    it("dispatches case-insensitively on the button name", () => {
      const diagnostics = findPropertyTypoDiagnostics("MyPanel.strobe.Effect.IntensityZ = 50", 0, dispatchIndex);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain("Effect.IntensityX");
    });

    it("does not treat inherited Object prototype keys as per-button schema names", () => {
      expect(() =>
        findPropertyTypoDiagnostics("MyPanel.toString.Effect.IntensityZ = 50", 0, dispatchIndex),
      ).not.toThrow();
      expect(() =>
        findPropertyTypoDiagnostics("MyPanel.constructor.Effect.IntensityZ = 50", 0, dispatchIndex),
      ).not.toThrow();
      expect(findPropertyTypoDiagnostics("MyPanel.toString.Effect.IntensityZ = 50", 0, dispatchIndex)).toEqual([]);
    });
  });
});
