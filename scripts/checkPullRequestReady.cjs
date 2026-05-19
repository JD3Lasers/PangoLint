#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const CODEX_REVIEWER = "chatgpt-codex-connector";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function usage() {
  return `Usage:
  node scripts/checkPullRequestReady.cjs [--pr 123]

Checks that the local branch matches the PR head, hosted checks passed, active
review threads are resolved, and the latest current-head Codex review is clear.`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--pr") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`Missing value for --pr\n\n${usage()}`);
      parsed.pr = value;
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${arg}\n\n${usage()}`);
  }
  return parsed;
}

function passedCheckNames(statusCheckRollup) {
  const passed = [];
  const failed = [];
  const checks = statusCheckRollup ?? [];
  if (checks.length === 0) {
    return { passed, failed: ["No hosted checks found."] };
  }
  for (const check of checks) {
    const name = check.name ?? check.context ?? "unnamed check";
    const conclusion = check.conclusion ?? check.state;
    const status = check.status ?? "COMPLETED";
    if (status === "COMPLETED" && ["SUCCESS", "SKIPPED", "NEUTRAL", "success"].includes(conclusion)) {
      passed.push(name);
    } else {
      failed.push(`${name}: ${status}/${conclusion ?? "pending"}`);
    }
  }
  return { passed, failed };
}

function activeUnresolvedThreads(reviewThreads) {
  return (reviewThreads ?? []).filter((thread) => !thread.isResolved && !thread.isOutdated);
}

function hasCodexThumbsUpReaction(entry) {
  return (entry.reactionGroups ?? []).some(
    (group) =>
      group.content === "THUMBS_UP" && (group.users?.nodes ?? []).some((user) => user.login === CODEX_REVIEWER),
  );
}

function isCodexRequestBody(body) {
  return body?.includes("@codex");
}

function reviewedCommitFromBody(body) {
  return body?.match(/\*\*Reviewed commit:\*\*\s*`([0-9a-f]+)`/i)?.[1];
}

function responseMatchesHead(entry, head) {
  const reviewedCommit = entry.commitOid ?? reviewedCommitFromBody(entry.body);
  if (reviewedCommit) return reviewedCommit === head || head.startsWith(reviewedCommit);
  return entry.kind === "comment" && entry.body?.includes("Didn't find any major issues");
}

function findLatestCodexResult(pr) {
  const head = pr.headRefOid;
  const headCommittedAt = Date.parse(pr.headCommittedAt ?? "");
  const requests = [
    ...(pr.reviews ?? [])
      .filter((review) => review.author?.login !== CODEX_REVIEWER)
      .filter((review) => isCodexRequestBody(review.body))
      .filter((review) => review.commit?.oid === head)
      .map((review) => ({ at: review.submittedAt, entry: review, source: "review" })),
    ...(pr.comments ?? [])
      .filter((comment) => comment.author?.login !== CODEX_REVIEWER)
      .filter((comment) => isCodexRequestBody(comment.body))
      .filter((comment) => !Number.isFinite(headCommittedAt) || Date.parse(comment.createdAt) >= headCommittedAt)
      .map((comment) => ({ at: comment.createdAt, entry: comment, source: "comment" })),
  ];

  if (requests.length === 0) {
    return { ok: false, reason: `No current-head @codex review request found for ${head}.` };
  }

  const latestRequest = requests.sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0];
  const responses = [
    ...(pr.reviews ?? []).map((review) => ({
      at: review.submittedAt,
      body: review.body ?? "",
      commitOid: review.commit?.oid,
      login: review.author?.login,
      kind: "review",
    })),
    ...(pr.comments ?? []).map((comment) => ({
      at: comment.createdAt,
      body: comment.body ?? "",
      login: comment.author?.login,
      kind: "comment",
    })),
  ]
    .filter((entry) => entry.login === CODEX_REVIEWER)
    .filter((entry) => responseMatchesHead(entry, head))
    .filter((entry) => Date.parse(entry.at) > Date.parse(latestRequest.at))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));

  if (responses.length === 0) {
    if (hasCodexThumbsUpReaction(latestRequest.entry)) {
      return { ok: true, at: latestRequest.at, kind: "reaction" };
    }
    return {
      ok: false,
      reason: "No Codex review response or clear-review reaction has arrived after the current-head request.",
    };
  }

  const latest = responses[0];
  if (latest.body.includes("Didn't find any major issues")) {
    return { ok: true, at: latest.at, kind: latest.kind };
  }
  return { ok: false, reason: "Latest Codex review response contains suggestions or has an unknown result." };
}

function collectConnectionPages(readPage) {
  const items = [];
  let cursor;
  while (true) {
    const page = readPage(cursor);
    items.push(...(page.nodes ?? []));
    if (!page.pageInfo?.hasNextPage) return items;
    cursor = page.pageInfo.endCursor;
    if (!cursor) throw new Error("GitHub did not return a cursor for the next page.");
  }
}

function readReviewThreadPage(prId, cursor) {
  const cursorVariable = cursor ? ", $cursor: String!" : "";
  const cursorArgument = cursor ? ", after: $cursor" : "";
  const query = `query($id: ID!${cursorVariable}) {
    node(id: $id) {
      ... on PullRequest {
        reviewThreads(first: 100${cursorArgument}) {
          nodes {
            id
            isResolved
            isOutdated
            path
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }`;
  const args = ["api", "graphql", "-f", `query=${query}`, "-f", `id=${prId}`];
  if (cursor) args.push("-f", `cursor=${cursor}`);
  const output = run("gh", args);
  return JSON.parse(output).data.node.reviewThreads;
}

function collectReviewThreadsPages(readPage) {
  return collectConnectionPages(readPage);
}

function readReviewThreads(prId) {
  return collectReviewThreadsPages((cursor) => readReviewThreadPage(prId, cursor));
}

function readPullRequestReviewPage(prId, cursor) {
  const cursorVariable = cursor ? ", $cursor: String!" : "";
  const cursorArgument = cursor ? ", after: $cursor" : "";
  const query = `query($id: ID!${cursorVariable}) {
    node(id: $id) {
      ... on PullRequest {
        reviews(first: 100${cursorArgument}) {
          nodes {
            author {
              login
            }
            body
            submittedAt
            commit {
              oid
            }
            reactionGroups {
              content
              users(first: 100) {
                nodes {
                  login
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }`;
  const args = ["api", "graphql", "-f", `query=${query}`, "-f", `id=${prId}`];
  if (cursor) args.push("-f", `cursor=${cursor}`);
  const output = run("gh", args);
  return JSON.parse(output).data.node.reviews;
}

function readPullRequestReviews(prId) {
  return collectConnectionPages((cursor) => readPullRequestReviewPage(prId, cursor));
}

function readPullRequestCommentPage(prId, cursor) {
  const cursorVariable = cursor ? ", $cursor: String!" : "";
  const cursorArgument = cursor ? ", after: $cursor" : "";
  const query = `query($id: ID!${cursorVariable}) {
    node(id: $id) {
      ... on PullRequest {
        comments(first: 100${cursorArgument}) {
          nodes {
            author {
              login
            }
            body
            createdAt
            reactionGroups {
              content
              users(first: 100) {
                nodes {
                  login
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }`;
  const args = ["api", "graphql", "-f", `query=${query}`, "-f", `id=${prId}`];
  if (cursor) args.push("-f", `cursor=${cursor}`);
  const output = run("gh", args);
  return JSON.parse(output).data.node.comments;
}

function readPullRequestComments(prId) {
  return collectConnectionPages((cursor) => readPullRequestCommentPage(prId, cursor));
}

function readPullRequest(prNumber) {
  const fields = [
    "headRefName",
    "headRefOid",
    "id",
    "mergeStateStatus",
    "number",
    "reviews",
    "statusCheckRollup",
    "url",
  ].join(",");
  const args = ["pr", "view", "--json", fields];
  if (prNumber) args.splice(2, 0, prNumber);
  const pr = JSON.parse(run("gh", args));
  pr.reviewThreads = readReviewThreads(pr.id);
  pr.reviews = readPullRequestReviews(pr.id);
  pr.comments = readPullRequestComments(pr.id);
  return pr;
}

function checkPullRequestReady(args) {
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const pr = readPullRequest(args.pr);
  const localHead = run("git", ["rev-parse", "HEAD"]);
  if (localHead !== pr.headRefOid) fail(`Local HEAD ${localHead} does not match PR head ${pr.headRefOid}.`);
  pr.headCommittedAt = run("git", ["show", "-s", "--format=%cI", pr.headRefOid]);

  const checks = passedCheckNames(pr.statusCheckRollup);
  if (checks.failed.length > 0) fail(`Hosted checks are not green:\n${checks.failed.join("\n")}`);

  const threads = activeUnresolvedThreads(pr.reviewThreads);
  if (threads.length > 0) {
    fail(
      `Unresolved active review threads remain:\n${threads.map((thread) => `${thread.id} ${thread.path}`).join("\n")}`,
    );
  }

  const codex = findLatestCodexResult(pr);
  if (!codex.ok) fail(codex.reason);

  if (pr.mergeStateStatus !== "CLEAN") fail(`PR merge state is ${pr.mergeStateStatus}, expected CLEAN.`);

  process.stdout.write(
    `PR #${pr.number} is ready: ${checks.passed.length} hosted checks passed, review threads resolved, Codex review clear.\n${pr.url}\n`,
  );
}

if (require.main === module) {
  checkPullRequestReady(parseArgs(process.argv.slice(2)));
}

module.exports = {
  activeUnresolvedThreads,
  collectReviewThreadsPages,
  findLatestCodexResult,
  hasCodexThumbsUpReaction,
  parseArgs,
  passedCheckNames,
  responseMatchesHead,
};
