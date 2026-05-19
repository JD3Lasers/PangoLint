import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const startIssueWork = require("../../scripts/startIssueWork.cjs") as {
  branchNameForIssue: (issueNumber: string | number, title: string) => string;
  commandOutputText: (output: string | null) => string;
  parseArgs: (argv: string[]) => { issue?: string; title?: string; bodyFile?: string; labels: string[]; base: string };
  remoteTrackingFetchArgs: (base: string) => string[];
  slugifyTitle: (title: string) => string;
};

const checkPullRequestReady = require("../../scripts/checkPullRequestReady.cjs") as {
  activeUnresolvedThreads: (
    reviewThreads: Array<{ isResolved: boolean; isOutdated: boolean }>,
  ) => Array<{ isResolved: boolean; isOutdated: boolean }>;
  collectReviewThreadsPages: (
    readPage: (cursor: string | undefined) => {
      nodes: Array<{ id: string }>;
      pageInfo: { hasNextPage: boolean; endCursor?: string };
    },
  ) => Array<{ id: string }>;
  findLatestCodexResult: (pr: {
    headRefOid: string;
    headCommittedAt?: string;
    reviews: Array<{
      author?: { login?: string };
      body?: string;
      commit?: { oid?: string };
      reactionGroups?: Array<{
        content: string;
        users?: { nodes?: Array<{ login?: string }> };
      }>;
      submittedAt?: string;
    }>;
    comments: Array<{
      author?: { login?: string };
      body?: string;
      createdAt?: string;
      reactionGroups?: Array<{
        content: string;
        users?: { nodes?: Array<{ login?: string }> };
      }>;
    }>;
  }) => { ok: boolean; reason?: string };
  hasCodexThumbsUpReaction: (entry: {
    reactionGroups?: Array<{
      content: string;
      users?: { nodes?: Array<{ login?: string }> };
    }>;
  }) => boolean;
  passedCheckNames: (rollup: Array<{ name?: string; status?: string; conclusion?: string }>) => {
    passed: string[];
    failed: string[];
  };
  responseMatchesHead: (entry: { body?: string; commitOid?: string; kind?: string }, head: string) => boolean;
};

const watchReleaseArtifacts = require("../../scripts/watchReleaseArtifacts.cjs") as {
  expectedReleaseAssetNames: (version: string) => string[];
  missingReleaseAssets: (release: { assets?: Array<{ name: string }> }, version: string) => string[];
  normalizeReleaseTag: (tag: string) => { tag: string; version: string };
  publishedReleaseFailure: (release: { isDraft: boolean; tagName: string }, allowPublished: boolean) => string | null;
};

describe("maintainer workflow scripts", () => {
  it("builds issue branch names from issue numbers and readable titles", () => {
    expect(startIssueWork.slugifyTitle("Add workflow scripts for issue, PR, and release checks")).toBe(
      "add-workflow-scripts-for-issue-pr-and-release-checks",
    );
    expect(startIssueWork.branchNameForIssue(8, "Add workflow scripts for issue, PR, and release checks")).toBe(
      "issue-8-add-workflow-scripts-for-issue-pr-and-release-checks",
    );
    expect(
      startIssueWork.parseArgs(["--title", "A title", "--body-file", "body.md", "--label", "enhancement"]),
    ).toMatchObject({
      title: "A title",
      bodyFile: "body.md",
      labels: ["enhancement"],
      base: "main",
    });
    expect(startIssueWork.remoteTrackingFetchArgs("main")).toEqual([
      "fetch",
      "--prune",
      "origin",
      "refs/heads/main:refs/remotes/origin/main",
    ]);
  });

  it("normalizes command output when stdout is ignored", () => {
    expect(startIssueWork.commandOutputText(null)).toBe("");
    expect(startIssueWork.commandOutputText("  main\n")).toBe("main");
  });

  it("summarizes hosted check state for PR readiness", () => {
    expect(checkPullRequestReady.passedCheckNames([])).toEqual({ passed: [], failed: ["No hosted checks found."] });

    expect(
      checkPullRequestReady.passedCheckNames([
        { name: "Public gate", status: "COMPLETED", conclusion: "SUCCESS" },
        { name: "Version policy", status: "COMPLETED", conclusion: "SUCCESS" },
      ]),
    ).toEqual({ passed: ["Public gate", "Version policy"], failed: [] });

    expect(
      checkPullRequestReady.passedCheckNames([{ name: "Public gate", status: "IN_PROGRESS", conclusion: undefined }]),
    ).toEqual({ passed: [], failed: ["Public gate: IN_PROGRESS/pending"] });
  });

  it("requires active review threads to be resolved before PR readiness passes", () => {
    expect(
      checkPullRequestReady.activeUnresolvedThreads([
        { isResolved: false, isOutdated: false },
        { isResolved: false, isOutdated: true },
        { isResolved: true, isOutdated: false },
      ]),
    ).toEqual([{ isResolved: false, isOutdated: false }]);
  });

  it("collects every review thread page before checking PR readiness", () => {
    expect(
      checkPullRequestReady.collectReviewThreadsPages((cursor) => {
        if (!cursor) {
          return {
            nodes: [{ id: "thread-1" }],
            pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
          };
        }
        return {
          nodes: [{ id: "thread-2" }],
          pageInfo: { hasNextPage: false },
        };
      }),
    ).toEqual([{ id: "thread-1" }, { id: "thread-2" }]);
  });

  it("recognizes a clear Codex response after a current-head request", () => {
    const pr = {
      headRefOid: "abc123",
      reviews: [
        {
          author: { login: "JD3Lasers" },
          body: "@codex",
          commit: { oid: "abc123" },
          submittedAt: "2026-05-19T02:31:27Z",
        },
      ],
      comments: [
        {
          author: { login: "chatgpt-codex-connector" },
          body: "Codex Review: Didn't find any major issues.",
          createdAt: "2026-05-19T02:35:58Z",
        },
      ],
    };

    expect(checkPullRequestReady.findLatestCodexResult(pr)).toMatchObject({ ok: true });
  });

  it("rejects Codex responses that contain suggestions", () => {
    const pr = {
      headRefOid: "abc123",
      reviews: [
        {
          author: { login: "JD3Lasers" },
          body: "@codex",
          commit: { oid: "abc123" },
          submittedAt: "2026-05-19T02:31:27Z",
        },
        {
          author: { login: "chatgpt-codex-connector" },
          body: "Here are some automated review suggestions for this pull request.",
          commit: { oid: "abc123" },
          submittedAt: "2026-05-19T02:35:58Z",
        },
      ],
      comments: [],
    };

    expect(checkPullRequestReady.findLatestCodexResult(pr)).toMatchObject({ ok: false });
  });

  it("ignores stale Codex responses from older commits", () => {
    const pr = {
      headRefOid: "abc123",
      reviews: [
        {
          author: { login: "JD3Lasers" },
          body: "@codex",
          commit: { oid: "abc123" },
          submittedAt: "2026-05-19T02:31:27Z",
        },
        {
          author: { login: "chatgpt-codex-connector" },
          body: "Codex Review: Didn't find any major issues.",
          commit: { oid: "older" },
          submittedAt: "2026-05-19T02:35:58Z",
        },
      ],
      comments: [],
    };

    expect(checkPullRequestReady.responseMatchesHead({ commitOid: "abc123" }, "abc123")).toBe(true);
    expect(
      checkPullRequestReady.responseMatchesHead(
        { body: "### Codex Review\n\n**Reviewed commit:** `abc123`" },
        "abc123ffff",
      ),
    ).toBe(true);
    expect(
      checkPullRequestReady.responseMatchesHead(
        { body: "Codex Review: Didn't find any major issues.", kind: "comment" },
        "abc123",
      ),
    ).toBe(true);
    expect(checkPullRequestReady.findLatestCodexResult(pr)).toMatchObject({ ok: false });
  });

  it("recognizes a Codex thumbs-up reaction as a clear current-head review", () => {
    const pr = {
      headRefOid: "abc123",
      reviews: [
        {
          author: { login: "JD3Lasers" },
          body: "@codex",
          commit: { oid: "abc123" },
          submittedAt: "2026-05-19T02:31:27Z",
          reactionGroups: [
            {
              content: "THUMBS_UP",
              users: { nodes: [{ login: "chatgpt-codex-connector" }] },
            },
          ],
        },
      ],
      comments: [],
    };

    expect(checkPullRequestReady.hasCodexThumbsUpReaction(pr.reviews[0])).toBe(true);
    expect(checkPullRequestReady.findLatestCodexResult(pr)).toMatchObject({ ok: true, kind: "reaction" });
  });

  it("recognizes a PR comment Codex request with a clear reaction after the current head", () => {
    const pr = {
      headRefOid: "abc123",
      headCommittedAt: "2026-05-19T02:30:00Z",
      reviews: [],
      comments: [
        {
          author: { login: "JD3Lasers" },
          body: "@codex review",
          createdAt: "2026-05-19T02:31:27Z",
          reactionGroups: [
            {
              content: "THUMBS_UP",
              users: { nodes: [{ login: "chatgpt-codex-connector" }] },
            },
          ],
        },
      ],
    };

    expect(checkPullRequestReady.findLatestCodexResult(pr)).toMatchObject({ ok: true, kind: "reaction" });
  });

  it("reports expected release assets by package version", () => {
    expect(watchReleaseArtifacts.normalizeReleaseTag("v0.4.4")).toEqual({ tag: "v0.4.4", version: "0.4.4" });
    expect(watchReleaseArtifacts.expectedReleaseAssetNames("0.4.4")).toEqual([
      "pangolint-0.4.4.vsix",
      "pangolint-0.4.4.vsix.sha256",
      "pangolint-mcp-0.4.4.tgz",
      "release-vsix-contents.txt",
      "release-mcp-tarball.json",
      "SHA256SUMS",
    ]);
    expect(
      watchReleaseArtifacts.missingReleaseAssets(
        {
          assets: [
            { name: "pangolint-0.4.4.vsix" },
            { name: "pangolint-0.4.4.vsix.sha256" },
            { name: "pangolint-mcp-0.4.4.tgz" },
          ],
        },
        "0.4.4",
      ),
    ).toEqual(["release-vsix-contents.txt", "release-mcp-tarball.json", "SHA256SUMS"]);
    expect(watchReleaseArtifacts.publishedReleaseFailure({ isDraft: true, tagName: "v0.4.4" }, false)).toBeNull();
    expect(watchReleaseArtifacts.publishedReleaseFailure({ isDraft: false, tagName: "v0.4.4" }, true)).toBeNull();
    expect(watchReleaseArtifacts.publishedReleaseFailure({ isDraft: false, tagName: "v0.4.4" }, false)).toContain(
      "already published",
    );
  });

  it("wires maintainer workflow commands into package scripts and runbook docs", () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const runbook = readFileSync(path.join(repoRoot, "docs", "runbooks", "maintainer-workflow.md"), "utf8");

    expect(packageJson.scripts?.["workflow:start-issue"]).toBe("node scripts/startIssueWork.cjs");
    expect(packageJson.scripts?.["workflow:check-pr"]).toBe("node scripts/checkPullRequestReady.cjs");
    expect(packageJson.scripts?.["workflow:watch-release"]).toBe("node scripts/watchReleaseArtifacts.cjs");
    expect(runbook).toContain("npm run workflow:start-issue");
    expect(runbook).toContain("npm run workflow:check-pr");
    expect(runbook).toContain("npm run workflow:watch-release");
  });
});
