import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/live-beyond-smoke.yml";

function workflowText(): string {
  return readFileSync(workflowPath, "utf8");
}

describe("Live BEYOND Smoke workflow policy", () => {
  it("keeps live BEYOND smoke manually confirmed and self-hosted", () => {
    const workflow = workflowText();
    const confirmCondition = ["if: $", "{{ inputs.confirm_live_beyond && github.ref == 'refs/heads/main' }}"].join("");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_live_beyond:");
    expect(workflow).toContain("required: true");
    expect(workflow).toContain("type: boolean");
    expect(workflow).toContain(confirmCondition);
    expect(workflow).toContain("environment:\n      name: live-beyond-smoke");
    expect(workflow).toContain("- self-hosted");
    expect(workflow).toContain("- pangolint-live-beyond");
  });

  it("checks out reviewed default-branch code before touching the live bench", () => {
    const workflow = workflowText();
    const defaultBranchRef = ["ref: $", "{{ github.event.repository.default_branch }}"].join("");

    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain(defaultBranchRef);
    expect(workflow).toContain("npm ci --ignore-scripts");
  });

  it("keeps supported smoke modes visible in the manual workflow input", () => {
    const workflow = workflowText();

    expect(workflow).toContain("smoke_mode:");
    expect(workflow).toContain("- all");
    expect(workflow).toContain("- connection");
    expect(workflow).toContain("- readback");
    expect(workflow).toContain("- udp");
  });

  it("passes bench variables to the smoke command", () => {
    const workflow = workflowText();

    expect(workflow).toContain("PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST");
    expect(workflow).toContain("PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST");
  });

  it("keeps the Talk TCP password scoped to the smoke command step", () => {
    const workflow = workflowText();
    const tcpPasswordEnv = [
      "PANGOLINT_LIVE_BEYOND_TCP_PASSWORD: $",
      "{{ secrets.PANGOLINT_LIVE_BEYOND_TCP_PASSWORD }}",
    ].join("");

    expect(workflow).toContain(tcpPasswordEnv);
    expect(workflow).not.toContain('["PANGOLINT_LIVE_BEYOND_TCP_PASSWORD", "TCP_PASSWORD"]');
    expect(workflow).not.toMatch(/\n\s+TCP_PASSWORD: \$\{\{ secrets\.PANGOLINT_LIVE_BEYOND_TCP_PASSWORD \}\}/);
    expect(workflow).not.toContain("GITHUB_ENV");
  });

  it("does not check lab bench endpoint values into the workflow", () => {
    const workflow = workflowText();

    expect(workflow).not.toMatch(/\b(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\./);
  });
});
