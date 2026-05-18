import { describe, expect, it } from "vitest";

import { analyzeCatalogGaps, type CommandUsage, formatGapReport } from "../../src/knowledge/catalogGaps";
import type { CommandKnowledgeEntry, PangoKnowledgeBase } from "../../src/knowledge/knowledgeBase";

function entry(
  overrides: Partial<CommandKnowledgeEntry> & Pick<CommandKnowledgeEntry, "canonical">,
): CommandKnowledgeEntry {
  return {
    canonical: overrides.canonical,
    aliases: overrides.aliases ?? [],
    description: overrides.description ?? "",
    evidenceLevel: overrides.evidenceLevel ?? "exported",
    confidence: overrides.confidence ?? "medium",
    safetyTier: overrides.safetyTier,
    category: overrides.category ?? "General",
    forms: overrides.forms,
    notes: overrides.notes,
    verification: overrides.verification,
    tags: overrides.tags,
  };
}

function usage(overrides: {
  canonical: string;
  totalUses: number;
  fileCount: number;
  arities: number[][];
}): CommandUsage {
  const arities = new Map<number, number>();
  for (const [arity, count] of overrides.arities) {
    arities.set(arity, count);
  }
  return {
    canonical: overrides.canonical,
    totalUses: overrides.totalUses,
    fileCount: overrides.fileCount,
    arities,
  };
}

const fixture: PangoKnowledgeBase = {
  schemaVersion: 1,
  commands: {
    OscOutString: entry({
      canonical: "OscOutString",
      description: "Sends a single OSC message with a string payload to the configured Talk UDP target.",
      evidenceLevel: "documented",
      safetyTier: "T1",
      forms: [
        {
          signature: 'OscOutString "<addr>", "<tag>", "<value>"',
          parameters: [{ name: "address", type: "string", required: true }],
        },
      ],
    }),
    BlackOutZones: entry({
      canonical: "BlackOutZones",
      description: "Blackout all zones.", // terse
      // no parameters
      // safetyTier omitted → unknown
    }),
    NeverUsed: entry({
      canonical: "NeverUsed",
      description: "Some obscure call.",
      // no parameters, no corpus uses
    }),
  },
};

const usages = new Map<string, CommandUsage>([
  ["blackoutzones", usage({ canonical: "BlackOutZones", totalUses: 12, fileCount: 5, arities: [[0, 12]] })],
  [
    "oscoutstring",
    usage({
      canonical: "OscOutString",
      totalUses: 47,
      fileCount: 12,
      arities: [
        [3, 40],
        [4, 7],
      ],
    }),
  ],
]);

describe("analyzeCatalogGaps", () => {
  it("does not flag zero-arg commands as missing parameters", () => {
    const zeroArgFixture: PangoKnowledgeBase = {
      schemaVersion: 1,
      commands: {
        Exit: entry({
          canonical: "Exit",
          description: "Stop execution of the current script.",
          forms: [{ signature: "Exit" }],
        }),
      },
    };
    const report = analyzeCatalogGaps({ knowledgeBase: zeroArgFixture, usages: new Map(), corpusFileCount: 0 });
    const exitGap = report.gaps[0];
    expect(exitGap?.signatureImpliesArgs).toBe(false);
    expect(exitGap?.missingParameters).toBe(false);
  });

  it("flags signatures that imply args but have no parameter list", () => {
    const missingFixture: PangoKnowledgeBase = {
      schemaVersion: 1,
      commands: {
        ClickFlash: entry({
          canonical: "ClickFlash",
          description: "Flash the current cue.",
          forms: [{ signature: "ClickFlash 1" }], // no parameters
        }),
      },
    };
    const report = analyzeCatalogGaps({ knowledgeBase: missingFixture, usages: new Map(), corpusFileCount: 0 });
    const gap = report.gaps[0];
    expect(gap?.signatureImpliesArgs).toBe(true);
    expect(gap?.hasParameters).toBe(false);
    expect(gap?.missingParameters).toBe(true);
  });

  it("treats trimmed-empty descriptions as empty (not just terse)", () => {
    const report = analyzeCatalogGaps({ knowledgeBase: fixture, usages, corpusFileCount: 17 });
    const blackOut = report.gaps.find((gap) => gap.canonical === "BlackOutZones");
    const oscOutString = report.gaps.find((gap) => gap.canonical === "OscOutString");
    expect(blackOut?.hasEmptyDescription).toBe(false); // "Blackout all zones." is short but non-empty
    expect(blackOut?.hasMeaningfulDescription).toBe(false);
    expect(oscOutString?.hasMeaningfulDescription).toBe(true);
  });

  it("counts empty descriptions separately from terse non-empty descriptions", () => {
    const mixed: PangoKnowledgeBase = {
      schemaVersion: 1,
      commands: {
        EmptyDesc: entry({ canonical: "EmptyDesc", description: "" }),
        TerseDesc: entry({ canonical: "TerseDesc", description: "Short." }),
        FullDesc: entry({
          canonical: "FullDesc",
          description: "This is a sufficiently detailed description for the command.",
        }),
      },
    };
    const report = analyzeCatalogGaps({ knowledgeBase: mixed, usages: new Map(), corpusFileCount: 0 });
    expect(report.summary.emptyDescriptions.total).toBe(1);
    expect(report.summary.terseDescriptions.total).toBe(1); // TerseDesc only — empty is excluded
  });

  it("sorts gaps alphabetically", () => {
    const report = analyzeCatalogGaps({ knowledgeBase: fixture, usages, corpusFileCount: 17 });
    expect(report.gaps.map((gap) => gap.canonical)).toEqual(["BlackOutZones", "NeverUsed", "OscOutString"]);
  });
});

describe("formatGapReport", () => {
  it("renders an informational-only banner and a top-by-corpus table", () => {
    const fixtureWithEmptyDesc: PangoKnowledgeBase = {
      schemaVersion: 1,
      commands: {
        ...fixture.commands,
        Sleep: entry({
          canonical: "Sleep",
          description: "",
          forms: [{ signature: "Sleep 1000" }],
        }),
      },
    };
    const usagesWithSleep = new Map(usages);
    usagesWithSleep.set("sleep", usage({ canonical: "Sleep", totalUses: 9, fileCount: 9, arities: [[1, 9]] }));
    const report = analyzeCatalogGaps({
      knowledgeBase: fixtureWithEmptyDesc,
      usages: usagesWithSleep,
      corpusFileCount: 17,
    });
    const md = formatGapReport(report);
    expect(md).toContain("# PangoLint catalog gap report");
    expect(md).toContain("informational only");
    expect(md).toContain("## Top empty descriptions — by corpus frequency");
    expect(md).toContain("`Sleep`");
    expect(md).toContain("1:9"); // arity histogram
  });

  it("omits sections when no commands match the predicate", () => {
    const oscOutString = fixture.commands.OscOutString;
    if (!oscOutString) throw new Error("fixture missing OscOutString");
    const empty: PangoKnowledgeBase = {
      schemaVersion: 1,
      commands: { OscOutString: oscOutString },
    };
    const md = formatGapReport(analyzeCatalogGaps({ knowledgeBase: empty, usages, corpusFileCount: 17 }));
    expect(md).not.toContain("## Top empty descriptions — by corpus frequency");
    expect(md).not.toContain("## Top missing parameters — by corpus frequency");
    expect(md).not.toContain("## All commands with empty descriptions");
  });
});
