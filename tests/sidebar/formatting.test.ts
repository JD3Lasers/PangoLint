import { describe, expect, it } from "vitest";

import { renderCommandMarkdown } from "../../src/sidebar/model/formatting";
import type { CommandDetail } from "../../src/sidebar/model/types";

const oscOutString: CommandDetail = {
  canonical: "OscOutString",
  aliases: ["OscOutString"],
  description: "Sends a single OSC message with a string payload.",
  signature: 'OscOutString "<addr>", "<tag>", "<value>"',
  safetyTier: "T1",
  evidenceLevel: "documented",
  category: "OSC output",
  signatures: [
    {
      signature: 'OscOutString "<addr>", "<tag>", "<value>"',
      parameters: [
        { name: "address", type: "string", required: true },
        { name: "tag", type: "string", required: true },
        { name: "value", type: "string", required: true },
      ],
    },
  ],
  notes: [],
  tags: [],
  setsProperty: [],
  example: 'OscOutString "/pangolint/ping", "s", "ping-001"',
};

const beyondPlay: CommandDetail = {
  canonical: "BeyondPlay",
  aliases: [],
  description: "Plays the current cue.",
  signature: "BeyondPlay",
  safetyTier: "T3",
  evidenceLevel: "exported",
  category: "General",
  signatures: [{ signature: "BeyondPlay", parameters: [] }],
  notes: [],
  tags: [],
  setsProperty: [],
  example: "BeyondPlay",
};

const setBpm: CommandDetail = {
  canonical: "SetBpm",
  aliases: ["SetBpm"],
  description: "Set the master BPM tempo.",
  signature: "SetBpm <value>",
  safetyTier: "T2",
  evidenceLevel: "observed",
  category: "Beat timer - tap and re-sync",
  signatures: [{ signature: "SetBpm <value>", parameters: [{ name: "value", type: "number", required: true }] }],
  notes: [],
  tags: [],
  setsProperty: ["Master.BPM"],
  example: "SetBpm <value>",
};

describe("sidebar formatting", () => {
  it("renders a T1 command with metadata, signature, parameters, and example", () => {
    const md = renderCommandMarkdown(oscOutString);
    expect(md).toContain("## OscOutString");
    expect(md).toContain("OSC output · safety: T1");
    expect(md).toContain("```pangoscript");
    expect(md).toContain('OscOutString "<addr>", "<tag>", "<value>"');
    expect(md).toContain("| address | string | yes |");
    expect(md).toContain('OscOutString "/pangolint/ping", "s", "ping-001"');
    expect(md).not.toContain("**Sources**");
  });

  it("renders a minimal command without parameters or example block", () => {
    const md = renderCommandMarkdown(beyondPlay);
    expect(md).toContain("## BeyondPlay");
    expect(md).toContain("General · safety: T3");
    expect(md).not.toContain("**Parameters**");
    expect(md).not.toContain("**Example**");
  });

  it("renders mapped object properties for command detail surfaces", () => {
    const md = renderCommandMarkdown(setBpm);

    expect(md).toContain("**Writes**");
    expect(md).toContain("- `Master.BPM`");
  });
});
