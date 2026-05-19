#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  return commandOutputText(output);
}

function commandOutputText(output) {
  return typeof output === "string" ? output.trim() : "";
}

function usage() {
  return `Usage:
  node scripts/startIssueWork.cjs --title "Issue title" [--body "text"] [--body-file path] [--label name]
  node scripts/startIssueWork.cjs --issue 123 [--branch issue-123-name]

Creates or reuses a GitHub issue, verifies main is clean and current, then
checks out an issue branch named issue-<number>-<slug>.`;
}

function parseArgs(argv) {
  const parsed = {
    labels: [],
    base: "main",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`Missing value for ${arg}\n\n${usage()}`);
      index += 1;
      return value;
    };
    switch (arg) {
      case "--issue":
        parsed.issue = next();
        break;
      case "--title":
        parsed.title = next();
        break;
      case "--body":
        parsed.body = next();
        break;
      case "--body-file":
        parsed.bodyFile = next();
        break;
      case "--label":
        parsed.labels.push(next());
        break;
      case "--branch":
        parsed.branch = next();
        break;
      case "--base":
        parsed.base = next();
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        fail(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }
  return parsed;
}

function slugifyTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "work";
}

function branchNameForIssue(issueNumber, title) {
  return `issue-${issueNumber}-${slugifyTitle(title)}`;
}

function normalizeIssueNumber(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/^#/, "");
  if (!/^[1-9]\d*$/.test(text)) fail(`Invalid issue number: ${value}`);
  return text;
}

function readBody(args) {
  if (args.bodyFile) {
    const filePath = path.resolve(root, args.bodyFile);
    if (!existsSync(filePath)) fail(`Body file not found: ${args.bodyFile}`);
    return readFileSync(filePath, "utf8");
  }
  return args.body ?? "";
}

function remoteTrackingFetchArgs(base) {
  return ["fetch", "--prune", "origin", `refs/heads/${base}:refs/remotes/origin/${base}`];
}

function assertCleanCurrentBase(base) {
  const branch = run("git", ["branch", "--show-current"]);
  if (branch !== base) fail(`Start from ${base}. Current branch is ${branch || "(detached)"}.`);

  const status = run("git", ["status", "--porcelain"]);
  if (status) fail("Working tree is not clean. Commit, stash, or discard local changes before starting issue work.");

  run("git", remoteTrackingFetchArgs(base), { stdio: ["ignore", "ignore", "pipe"] });
  const localHead = run("git", ["rev-parse", base]);
  const remoteHead = run("git", ["rev-parse", `origin/${base}`]);
  if (localHead !== remoteHead) fail(`${base} is not up to date with origin/${base}. Run git pull --ff-only first.`);
}

function createIssue(title, body, labels) {
  const args = ["issue", "create", "--title", title, "--body", body];
  for (const label of labels) args.push("--label", label);
  const output = run("gh", args);
  const match = output.match(/\/issues\/(\d+)\b/);
  if (!match) fail(`Unable to parse issue number from gh output: ${output}`);
  return { number: match[1], url: output };
}

function readIssueTitle(issueNumber) {
  return run("gh", ["issue", "view", issueNumber, "--json", "title", "--jq", ".title"]);
}

function startIssueWork(args) {
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  assertCleanCurrentBase(args.base);

  let issueNumber;
  let issueUrl;
  let title = args.title;
  if (args.issue) {
    issueNumber = normalizeIssueNumber(args.issue);
    title = title || readIssueTitle(issueNumber);
    issueUrl = run("gh", ["issue", "view", issueNumber, "--json", "url", "--jq", ".url"]);
  } else {
    if (!title) fail(`Missing --title for new issue.\n\n${usage()}`);
    const issue = createIssue(title, readBody(args), args.labels);
    issueNumber = issue.number;
    issueUrl = issue.url;
  }

  const branch = args.branch || branchNameForIssue(issueNumber, title);
  run("git", ["switch", "-c", branch]);

  process.stdout.write(`Issue: ${issueUrl}\nBranch: ${branch}\n`);
}

if (require.main === module) {
  startIssueWork(parseArgs(process.argv.slice(2)));
}

module.exports = {
  branchNameForIssue,
  commandOutputText,
  parseArgs,
  remoteTrackingFetchArgs,
  slugifyTitle,
};
