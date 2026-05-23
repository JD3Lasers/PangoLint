import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/live-beyond-smoke.yml";

function workflowText(): string {
  return readFileSync(workflowPath, "utf8");
}

describe("Live BEYOND Smoke workflow policy", () => {
  it("keeps live BEYOND smoke manually confirmed and self-hosted", () => {
    const workflow = workflowText();
    const confirmCondition = ["if: $", "{{ inputs.confirm_live_beyond }}"].join("");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_live_beyond:");
    expect(workflow).toContain("required: true");
    expect(workflow).toContain("type: boolean");
    expect(workflow).toContain(confirmCondition);
    expect(workflow).toContain("- self-hosted");
    expect(workflow).toContain("- pangolint-live-beyond");
  });

  it("keeps supported smoke modes visible in the manual workflow input", () => {
    const workflow = workflowText();

    expect(workflow).toContain("smoke_mode:");
    expect(workflow).toContain("- all");
    expect(workflow).toContain("- connection");
    expect(workflow).toContain("- readback");
    expect(workflow).toContain("- udp");
  });

  it("uses Node for cross-platform bench variable setup", () => {
    const workflow = workflowText();

    expect(workflow).toContain("name: Apply optional bench variables");
    expect(workflow).toContain("shell: node {0}");
    expect(workflow).toContain('const fs = require("node:fs");');
    expect(workflow).toContain("PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST");
    expect(workflow).toContain("PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST");
  });

  it("does not check lab bench endpoint values into the workflow", () => {
    const workflow = workflowText();

    expect(workflow).not.toMatch(/\b(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\./);
  });
});
