import { describe, expect, it } from "vitest";

import { parseCommandCatalog } from "../../src/knowledge/catalog";
import {
  buildGeneratedKnowledgeBase,
  commandCatalogFromKnowledgeBase,
  mergeKnowledgeBase,
  overlayCategoriesByCanonical,
  validateCuratedOverlay,
} from "../../src/knowledge/knowledgeBase";

describe("PangoScript knowledge base", () => {
  it("builds generated command knowledge from the BEYOND separator export", () => {
    const catalog = parseCommandCatalog(
      [
        'OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)',
        "Brightness|Brightness 100 | 0..100 (percents)",
      ].join("\n"),
    );

    const generated = buildGeneratedKnowledgeBase(catalog, {
      generatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(generated.commands.OscOutTTS).toEqual(
      expect.objectContaining({
        canonical: "OscOutTTS",
        aliases: ["OscOutTTS"],
        evidenceLevel: "exported",
        confidence: "medium",
        forms: [
          expect.objectContaining({
            signature: 'OscOutTTS "",""',
          }),
        ],
      }),
    );
  });

  it("auto-derives optional parameters matching the example arg count", () => {
    const catalog = parseCommandCatalog(
      ["Brightness|Brightness 100", "Angle|Angle 0,0,0 | X,Y,Z angles in degrees", "AudioBeat|AudioBeat"].join("\n"),
    );
    const generated = buildGeneratedKnowledgeBase(catalog, {
      generatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(generated.commands.Brightness.forms?.[0].parameters).toEqual([
      { name: "arg1", type: "unknown", required: false },
    ]);
    expect(generated.commands.Angle.forms?.[0].parameters).toHaveLength(3);
    expect(generated.commands.Angle.forms?.[0].parameters?.every((p) => !p.required)).toBe(true);
    expect(generated.commands.AudioBeat.forms?.[0].parameters).toBeUndefined();
  });

  it("skips parameter derivation when the description hints at variadic or optional args", () => {
    const catalog = parseCommandCatalog(
      [
        'OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)',
        "ClickFlash|ClickFlash   | optional argument: 1 or 2 (Grid number)",
      ].join("\n"),
    );
    const generated = buildGeneratedKnowledgeBase(catalog, {
      generatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(generated.commands.OscOutTTS.forms?.[0].parameters).toBeUndefined();
    expect(generated.commands.ClickFlash.forms?.[0].parameters).toBeUndefined();
  });

  it("merges curated overlay fields without losing generated baseline evidence", () => {
    const catalog = parseCommandCatalog(
      ['OscOutTTS|OscOutTTS "","" | Address, Type Tag String, Arguments (optional)'].join("\n"),
    );
    const generated = buildGeneratedKnowledgeBase(catalog, {
      generatedAt: "2026-05-03T00:00:00.000Z",
    });

    const merged = mergeKnowledgeBase(generated, {
      schemaVersion: 1,
      commands: {
        OscOutTTS: {
          canonical: "OscOutTTS",
          evidenceLevel: "observed",
          confidence: "high",
          category: "",
          safetyTier: "T1",
          forms: [
            {
              signature: 'OscOutTTS "/pangolint/ping", "s", "<request-id>"',
              description: "Readback-only ping callback used by PangoLint.",
              parameters: [
                { name: "address", type: "string", required: true },
                { name: "typeTags", type: "string", required: true },
                { name: "arguments", type: "variadic", required: false },
              ],
            },
          ],
          notes: [
            {
              text: "Used for Talk UDP-triggered OSC callback confirmation.",
            },
          ],
          verification: [
            {
              status: "observed",
              method: "oscOutTTS",
              safetyTier: "T1",
              verificationScript: 'OscOutTTS "/pangolint/ping", "s", "<request-id>"',
              expectedCallback: "/pangolint/ping s <request-id>",
              cleanup: "none",
              operatorRequired: false,
            },
          ],
        },
      },
    });

    expect(merged.commands.OscOutTTS.safetyTier).toBe("T1");
    expect(merged.commands.OscOutTTS.forms?.map((form) => form.signature)).toEqual([
      'OscOutTTS "",""',
      'OscOutTTS "/pangolint/ping", "s", "<request-id>"',
    ]);
    expect(merged.commands.OscOutTTS.verification?.[0]).toEqual(
      expect.objectContaining({
        method: "oscOutTTS",
        cleanup: "none",
      }),
    );
  });

  it("merges curated form description into generated form when signatures match", () => {
    // Regression: zero-arg commands like Restart have generated and overlay
    // forms with identical signatures. Old mergeForms dedupe-by-signature
    // silently dropped the overlay form, losing curated description and
    // parameters. Merge must combine matching signatures with right-wins.
    const catalog = parseCommandCatalog(["Restart|Restart"].join("\n"));
    const generated = buildGeneratedKnowledgeBase(catalog, {
      generatedAt: "2026-05-05T00:00:00.000Z",
    });

    const merged = mergeKnowledgeBase(generated, {
      schemaVersion: 1,
      commands: {
        Restart: {
          canonical: "Restart",
          evidenceLevel: "documented",
          confidence: "high",
          safetyTier: "T0",
          category: "",
          forms: [
            {
              signature: "Restart",
              description: "Restart execution of the current script from the top.",
              parameters: [],
            },
          ],
        },
      },
    });

    const restartForms = merged.commands.Restart.forms ?? [];
    expect(restartForms).toHaveLength(1);
    expect(restartForms[0]?.description).toBe("Restart execution of the current script from the top.");
  });

  it("keys overlay category overrides by canonical field", () => {
    const categories = overlayCategoriesByCanonical({
      schemaVersion: 1,
      commands: {
        OverlayAliasKey: {
          canonical: "CanonicalCommand",
          aliases: [],
          description: "Overlay record intentionally keyed by an alias.",
          evidenceLevel: "documented",
          confidence: "medium",
          safetyTier: "unknown",
          category: "Cue clicking",
        },
      },
    });

    expect(categories).toEqual({ CanonicalCommand: "Cue clicking" });
  });

  it("allows high-confidence curated claims without public provenance fields", () => {
    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            MysteryCommand: {
              canonical: "MysteryCommand",
              evidenceLevel: "observed",
              confidence: "high",
              category: "",
            },
          },
        },
      }),
    ).not.toThrow();
  });

  it("rejects inconsistent property mapping coverage metadata", () => {
    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            Brightness: {
              canonical: "Brightness",
              evidenceLevel: "observed",
              confidence: "high",
              category: "",
              setsProperty: ["Master.Brightness"],
              propertyMappingCoverage: {
                status: "no-direct-property",
                evidenceLevel: "observed",
                safetyTier: "T1",
              },
            } as never,
          },
        },
      }),
    ).toThrow(/setsProperty.*propertyMappingCoverage\.status.*mapped/);

    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            BlackOut: {
              canonical: "BlackOut",
              evidenceLevel: "observed",
              confidence: "high",
              category: "",
              propertyMappingCoverage: {
                status: "no-direct-property",
                evidenceLevel: "observed",
                safetyTier: "T2",
                notes: "Button-style command with no stable direct property mapping.",
              },
            } as never,
          },
        },
      }),
    ).not.toThrow();
  });

  it("validates structured parameter range metadata", () => {
    const validRangeParam = {
      name: "value",
      type: "number",
      required: true,
      valueRange: {
        min: 1,
        max: 600,
        unit: "bpm",
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    };

    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            SetBpm: {
              canonical: "SetBpm",
              evidenceLevel: "observed",
              confidence: "high",
              category: "",
              forms: [{ signature: "SetBpm <value>", parameters: [validRangeParam] }],
            } as never,
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            SetBpm: {
              canonical: "SetBpm",
              evidenceLevel: "observed",
              confidence: "high",
              category: "",
              forms: [
                {
                  signature: "SetBpm <value>",
                  parameters: [
                    {
                      ...validRangeParam,
                      valueRange: { ...validRangeParam.valueRange, boundaryBehavior: "sometimes" },
                    },
                  ],
                },
              ],
            } as never,
          },
        },
      }),
    ).toThrow(/invalid valueRange\.boundaryBehavior/);
  });

  it("rejects deprecated provenance fields anywhere in the curated overlay", () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ["command sourceRefs", { sourceRefs: ["private-source"] }, "sourceRefs"],
      ["command sourceRef", { sourceRef: "private-source" }, "sourceRef"],
      [
        "form sourceRefs",
        {
          forms: [
            {
              signature: "MysteryCommand",
              sourceRefs: ["private-source"],
            },
          ],
        },
        "sourceRefs",
      ],
      [
        "note sourceRefs",
        {
          notes: [
            {
              text: "Probe result.",
              sourceRefs: ["private-source"],
            },
          ],
        },
        "sourceRefs",
      ],
      [
        "verification sourceRefs",
        {
          verification: [
            {
              status: "observed",
              method: "oscOutTTS",
              safetyTier: "T1",
              cleanup: "none",
              operatorRequired: false,
              sourceRefs: ["private-source"],
            },
          ],
        },
        "sourceRefs",
      ],
    ];

    for (const [label, commandPatch, field] of cases) {
      expect(
        () =>
          validateCuratedOverlay({
            overlay: {
              schemaVersion: 1,
              commands: {
                MysteryCommand: {
                  canonical: "MysteryCommand",
                  evidenceLevel: "observed",
                  confidence: "high",
                  category: "",
                  ...commandPatch,
                } as never,
              },
            },
          }),
        label,
      ).toThrow(new RegExp(`deprecated provenance field '${field}'`));
    }
  });

  it("rejects invalid curated metadata", () => {
    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            MysteryCommand: {
              canonical: "MysteryCommand",
              evidenceLevel: "impossible",
              confidence: "high",
              category: "",
            } as never,
          },
        },
      }),
    ).toThrow(/invalid evidenceLevel/);
  });

  it("requires RegisterOscFeedback verification to model restart-or-prefix cleanup", () => {
    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            RegisterOscFeedback: {
              canonical: "RegisterOscFeedback",
              evidenceLevel: "documented",
              confidence: "medium",
              category: "",
              verification: [
                {
                  status: "planned",
                  method: "registerOscFeedback",
                  safetyTier: "T1",
                  feedbackAddress: "/pangolint/verify/<run-id>/master_brightness",
                  feedbackProperty: "Master.Brightness",
                  cleanup: "none",
                  operatorRequired: true,
                },
              ],
            },
          },
        },
      }),
    ).toThrow(/RegisterOscFeedback.*cleanup.*beyondRestartOrPrefixRetire/);

    expect(() =>
      validateCuratedOverlay({
        overlay: {
          schemaVersion: 1,
          commands: {
            RegisterOscFeedback: {
              canonical: "RegisterOscFeedback",
              evidenceLevel: "documented",
              confidence: "medium",
              category: "",
              verification: [
                {
                  status: "planned",
                  method: "registerOscFeedback",
                  safetyTier: "T1",
                  feedbackAddress: "/pangolint/verify/<run-id>/master_brightness",
                  feedbackProperty: "Master.Brightness",
                  cleanup: "beyondRestartOrPrefixRetire",
                  operatorRequired: true,
                },
              ],
            },
          },
        },
      }),
    ).not.toThrow();
  });

  it("converts merged knowledge back to command catalog entries for editor services", () => {
    const catalog = commandCatalogFromKnowledgeBase({
      schemaVersion: 1,
      commands: {
        OscOutTTS: {
          canonical: "OscOutTTS",
          aliases: ["OscOut"],
          description: "Emit OSC from PangoScript.",
          evidenceLevel: "observed",
          confidence: "high",
          category: "General",
          forms: [
            {
              signature: 'OscOutTTS "<address>", "<type-tags>", <args...>',
              description: "Typed OSC callback form.",
            },
          ],
        },
      },
    });

    expect(catalog.commands[0]).toEqual(
      expect.objectContaining({
        canonical: "OscOutTTS",
        aliases: ["OscOutTTS", "OscOut"],
        example: 'OscOutTTS "<address>", "<type-tags>", <args...>',
        description: "Emit OSC from PangoScript.",
      }),
    );
  });

  it("keeps direct command names from being shadowed by another command alias", () => {
    const catalog = commandCatalogFromKnowledgeBase({
      schemaVersion: 1,
      commands: {
        SizeDelta: {
          canonical: "SizeDelta",
          aliases: ["SizeDelta"],
          description: "Size delta command.",
          evidenceLevel: "observed",
          confidence: "high",
          category: "Live Control",
        },
        SizeIndex: {
          canonical: "SizeIndex",
          aliases: ["SizeIndex", "SizeDelta"],
          description: "Indexed size command.",
          evidenceLevel: "observed",
          confidence: "high",
          category: "Live Control",
        },
      },
    });

    expect(catalog.byName.get("sizedelta")?.canonical).toBe("SizeDelta");
    expect(catalog.byName.get("sizeindex")?.canonical).toBe("SizeIndex");
  });
});
