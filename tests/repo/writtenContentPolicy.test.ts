import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface TrackedTextFile {
  path: string;
  text: string;
}

const MAINTAINED_TEXT_FILE =
  /^(README\.md|CHANGELOG\.md|\.github\/.+\.(md|yml|yaml)|data\/pangoscript\/(commands\.overlay\.json|schema\.json)|docs\/(?!references\/beyond\/pangoscript\/working-examples\/).+\.(md|txt|html|BeyondCode)|media\/sidebar\/.+\.css|snippets\/.+\.json|src\/.+\.(ts|tsx|js|cjs|mjs|md|css)|mcp\/(README\.md|src\/.+\.(ts|js|mjs)|tests\/.+\.ts)|scripts\/.+\.(ts|js|cjs|mjs)|tests\/.+\.ts)$/;

const BLOCKED_WORDING = [
  { label: "agentic", pattern: /\bagentic\b/i },
  { label: "orchestrator", pattern: /\borchestrator\b/i },
  { label: "magic", pattern: /\bmagic\b/i },
  { label: "smart wrapper", pattern: /\bsmart wrapper\b/i },
  { label: "universal manager", pattern: /\buniversal manager\b/i },
  { label: "vertical slice", pattern: /\bvertical slice\b/i },
  { label: "seam", pattern: /\bseam\b/i },
];

const BLOCKED_WORDING_POLICY_TEST = "tests/repo/writtenContentPolicy.test.ts";
const ENGINEERING_STANDARDS = "docs/specs/2026-05-05-engineering-standards.md";

function trackedTextFiles(): TrackedTextFile[] {
  const trackedPaths = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => MAINTAINED_TEXT_FILE.test(path));
  return trackedPaths.map((path) => ({
    path,
    text: readFileSync(path, "utf8"),
  }));
}

describe("written content policy", () => {
  it("documents GitHub issue and pull request wording rules in the maintainer workflow", () => {
    const workflow = readFileSync("docs/runbooks/maintainer-workflow.md", "utf8");

    expect(workflow).toContain("Written Content Policy");
    expect(workflow).toContain("issue bodies");
    expect(workflow).toContain("PR descriptions");
    expect(workflow).toContain("long dash");
  });

  it("keeps maintained written content free of long dash characters", () => {
    const offenders = trackedTextFiles().flatMap(({ path, text }) =>
      text
        .split(/\r?\n/)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => /[\u2013\u2014]/.test(line))
        .map(({ line, lineNumber }) => `${path}:${lineNumber}: ${line.trim()}`),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps maintained written content free of blocked planning wording", () => {
    const offenders = trackedTextFiles().flatMap(({ path, text }) =>
      text
        .split(/\r?\n/)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => !allowedBlockedWordingLine(path, line))
        .flatMap(({ line, lineNumber }) =>
          BLOCKED_WORDING.filter(({ pattern }) => pattern.test(line)).map(
            ({ label }) => `${path}:${lineNumber}: blocked '${label}': ${line.trim()}`,
          ),
        ),
    );

    expect(offenders).toEqual([]);
  });
});

function allowedBlockedWordingLine(path: string, line: string): boolean {
  if (path === BLOCKED_WORDING_POLICY_TEST) return true;
  if (path !== ENGINEERING_STANDARDS) return false;
  const trimmed = line.trim();
  return BLOCKED_WORDING.some(({ label }) => trimmed === label);
}
