import type { CommandKnowledgeEntry, KnowledgeForm, KnowledgeNote } from "./knowledgeBase";

export interface ExpressionFunctionEntry {
  canonical: string;
  aliases?: string[];
  description: string;
  evidenceLevel: CommandKnowledgeEntry["evidenceLevel"];
  confidence: CommandKnowledgeEntry["confidence"];
  forms: KnowledgeForm[];
  notes?: KnowledgeNote[];
  tags?: string[];
}

export const EXPRESSION_FUNCTIONS: ExpressionFunctionEntry[] = [
  {
    canonical: "ExtValue",
    description: "Return the current external control value scaled into the requested range.",
    evidenceLevel: "observed",
    confidence: "high",
    forms: [
      {
        signature: "ExtValue(<min>, <max>)",
        description: "Scale the current MIDI/DMX/external trigger value into the range between min and max.",
        parameters: [
          {
            name: "min",
            type: "number",
            required: true,
            description: "Scaled output value when the external input is at its low end.",
          },
          {
            name: "max",
            type: "number",
            required: true,
            description: "Scaled output value when the external input is at its high end.",
          },
        ],
      },
    ],
    notes: [
      {
        text: "Observed in attributed MIDI control examples. In direct editor execution without an external trigger value, BEYOND returned 0 for ExtValue(0, 127), 0 for ExtValue(0, 8.999), and 1 for ExtValue(1, -1). BEYOND accepted Master.PhFriction = ExtValue (1,2) in direct editor execution and changed Master.PhFriction from 10.000000 to 1.000000 in the observed callback. After WaitForMidi 0xB0, 0x00, -1, BEYOND scaled incoming CC 0 values 0, 64, and 127 to the expected ExtValue ranges. In a DefineMidiTrigger/InRangeTrigger label handler, BEYOND fired callbacks but ExtValue returned defaults instead of the incoming CC value.",
      },
    ],
    tags: ["expression", "external-input", "midi"],
  },
  {
    canonical: "ExtDelta",
    description: "Return the current external control delta, optionally scaled or inverted by the supplied factor.",
    evidenceLevel: "observed",
    confidence: "medium",
    forms: [
      {
        signature: "ExtDelta(<scale>)",
        description:
          "Operator-reported helper for relative MIDI/encoder deltas, for example `SetBpmDelta ExtDelta(-1)`. BEYOND accepted ExtDelta(-1) in editor assignment context and returned 1.000000 without an external delta source.",
        parameters: [
          {
            name: "scale",
            type: "number",
            required: true,
            description: "Scale or inversion factor applied to the current external delta.",
          },
        ],
      },
    ],
    notes: [
      {
        text: "Operator-reported usage: SetBpmDelta ExtDelta(-1). BEYOND accepted extDeltaValue = ExtDelta(-1) in direct editor execution and returned 1.000000; command/property argument and live relative-control contexts remain unvalidated.",
      },
    ],
    tags: ["expression", "external-input", "delta", "midi"],
  },
  {
    canonical: "DeltaValue",
    description: "Operator-reported delta-style external control helper for MIDI-slot property/control arguments.",
    evidenceLevel: "observed",
    confidence: "medium",
    forms: [
      {
        signature: "DeltaValue(<min>, <max>)",
        description:
          "Operator-reported helper for applying relative control deltas to object values. User-provided APC40 MIDI-to-PangoScript slot evidence uses the spaced command-argument shape `Master.PhFriction deltavalue (-1,1)`. Direct editor assignment/property-command probes and DefineMidiTrigger handler property-command probes are BEYOND-rejected.",
        parameters: [
          {
            name: "min",
            type: "number",
            required: true,
            description: "Scaled output value when the external delta is at its low end.",
          },
          {
            name: "max",
            type: "number",
            required: true,
            description: "Scaled output value when the external delta is at its high end.",
          },
        ],
      },
    ],
    notes: [
      {
        text: "Operator-reported usage: Master.PhFriction deltavalue (-1,1) works in an APC40 MIDI-to-PangoScript slot. BEYOND rejected DeltaValue(-1, 1) as a general assignment expression, rejected spaced deltavalue (-1,1) assignment with Operation expected: (, rejected direct editor property probes with both Master.PhFriction DeltaValue(-1, 1) and Master.PhFriction deltavalue (-1,1), and rejected the same spaced property command inside a DefineMidiTrigger/InRangeTrigger handler.",
      },
    ],
    tags: ["expression", "external-input", "delta"],
  },
  {
    canonical: "int",
    description: "Convert a numeric expression to an integer.",
    evidenceLevel: "observed",
    confidence: "high",
    forms: [
      {
        signature: "int(<value>)",
        description:
          "Integer conversion used in arithmetic, comparisons, and command arguments. BEYOND returned 3 for int(3.75) in the regression corpus.",
        parameters: [{ name: "value", type: "number", required: true, description: "Numeric expression." }],
      },
    ],
    notes: [
      {
        text: "BEYOND accepted int(sourceValue) where sourceValue was 3.75 and emitted integer callback value 3.",
      },
    ],
    tags: ["expression", "conversion"],
  },
  {
    canonical: "intstr",
    description: "Convert an integer or numeric expression to a string.",
    evidenceLevel: "observed",
    confidence: "high",
    forms: [
      {
        signature: "intstr(<value>)",
        description:
          "String conversion used when building display/debug text. BEYOND accepted nested string concatenation with intstr(intValue).",
        parameters: [{ name: "value", type: "number", required: true, description: "Numeric expression." }],
      },
    ],
    notes: [
      {
        text: 'BEYOND accepted messageText = "int=" + intstr(intValue) and emitted string callback value "int=3".',
      },
    ],
    tags: ["expression", "conversion", "string"],
  },
  {
    canonical: "max",
    description: "Return the larger of two numeric expressions.",
    evidenceLevel: "observed",
    confidence: "high",
    forms: [
      {
        signature: "max(<left>, <right>)",
        description:
          "Numeric maximum helper used in expression assignments. BEYOND accepted max around a bit-shift expression.",
        parameters: [
          { name: "left", type: "number", required: true, description: "First numeric expression." },
          { name: "right", type: "number", required: true, description: "Second numeric expression." },
        ],
      },
    ],
    notes: [
      {
        text: "BEYOND accepted max(1 << intValue, 1) after intValue = 3 and emitted integer callback value 8.",
      },
    ],
    tags: ["expression", "math"],
  },
  {
    canonical: "round",
    description: "Round a numeric expression.",
    evidenceLevel: "inferred",
    confidence: "medium",
    forms: [
      {
        signature: "round(<value>)",
        description: "Rounding helper used in numeric assignments before passing values into commands.",
        parameters: [{ name: "value", type: "number", required: true, description: "Numeric expression." }],
      },
    ],
    tags: ["expression", "math"],
  },
];

export function buildExpressionFunctionMap(
  functions: readonly ExpressionFunctionEntry[] = EXPRESSION_FUNCTIONS,
): Map<string, ExpressionFunctionEntry> {
  const map = new Map<string, ExpressionFunctionEntry>();
  for (const entry of functions) {
    map.set(entry.canonical.toLowerCase(), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(alias.toLowerCase(), entry);
    }
  }
  return map;
}

export interface ExpressionFunctionMatch {
  entry: ExpressionFunctionEntry;
  start: number;
  end: number;
}

export function expressionFunctionAtPosition(
  lineText: string,
  column: number,
  functions: readonly ExpressionFunctionEntry[] = EXPRESSION_FUNCTIONS,
): ExpressionFunctionMatch | undefined {
  const byName = buildExpressionFunctionMap(functions);
  const code = stripLineComment(lineText);
  const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  for (;;) {
    const match = callPattern.exec(code);
    if (!match) break;
    const name = match[1];
    if (!name) continue;
    const start = match.index;
    const end = start + name.length;
    if (column < start || column > end) continue;
    if (isInsideString(code, start)) continue;
    const entry = byName.get(name.toLowerCase());
    if (entry) return { entry, start, end };
  }
  return undefined;
}

function stripLineComment(lineText: string): string {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < lineText.length - 1; index += 1) {
    const char = lineText[index];
    const next = lineText[index + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && char === "/" && next === "/") {
      return lineText.slice(0, index);
    }
  }
  return lineText;
}

function isInsideString(lineText: string, column: number): boolean {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < column; index += 1) {
    const char = lineText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
    }
  }
  return inString;
}
