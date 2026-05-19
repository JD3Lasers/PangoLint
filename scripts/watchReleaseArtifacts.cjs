#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { normalizeVersionInput } = require("./releaseSemver.cjs");

const root = path.resolve(__dirname, "..");

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
  node scripts/watchReleaseArtifacts.cjs --tag v0.4.4 [--timeout 600] [--interval 15] [--once] [--allow-published]

Waits for the draft GitHub Release to contain the expected VSIX, MCP tarball,
package reports, and checksum assets. Published releases fail unless
--allow-published is set.`;
}

function parseArgs(argv) {
  const parsed = {
    timeoutSeconds: 600,
    intervalSeconds: 15,
    once: false,
    allowPublished: false,
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
      case "--tag":
        parsed.tag = next();
        break;
      case "--timeout":
        parsed.timeoutSeconds = Number.parseInt(next(), 10);
        break;
      case "--interval":
        parsed.intervalSeconds = Number.parseInt(next(), 10);
        break;
      case "--once":
        parsed.once = true;
        break;
      case "--allow-published":
        parsed.allowPublished = true;
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

function normalizeReleaseTag(tag) {
  const version = normalizeVersionInput(tag, { allowLeadingV: true });
  if (!version) fail(`Invalid release tag: ${tag}`);
  return { tag: `v${version}`, version };
}

function expectedReleaseAssetNames(version) {
  return [
    `pangolint-${version}.vsix`,
    `pangolint-${version}.vsix.sha256`,
    `pangolint-mcp-${version}.tgz`,
    "release-vsix-contents.txt",
    "release-mcp-tarball.json",
    "SHA256SUMS",
  ];
}

function missingReleaseAssets(release, version) {
  const names = new Set((release.assets ?? []).map((asset) => asset.name));
  return expectedReleaseAssetNames(version).filter((name) => !names.has(name));
}

function publishedReleaseFailure(release, allowPublished) {
  if (allowPublished || release.isDraft === true) return null;
  return `Release ${release.tagName} is already published. Use --allow-published only for post-publish asset checks.`;
}

function readRelease(tag) {
  try {
    return JSON.parse(run("gh", ["release", "view", tag, "--json", "assets,isDraft,isPrerelease,tagName,url"]));
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("release not found") || stderr.includes("Not Found")) return null;
    throw error;
  }
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function watchReleaseArtifacts(args) {
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!args.tag) fail(`Missing --tag.\n\n${usage()}`);
  if (!Number.isFinite(args.timeoutSeconds) || args.timeoutSeconds < 1) fail("--timeout must be a positive number.");
  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds < 1) fail("--interval must be a positive number.");

  const { tag, version } = normalizeReleaseTag(args.tag);
  const startedAt = Date.now();
  while (true) {
    const release = readRelease(tag);
    if (release) {
      const draftFailure = publishedReleaseFailure(release, args.allowPublished);
      if (draftFailure) fail(draftFailure);

      const missing = missingReleaseAssets(release, version);
      if (missing.length === 0) {
        process.stdout.write(`Release ${tag} has all expected assets.\n${release.url}\n`);
        return;
      }
      if (args.once) fail(`Release ${tag} is missing assets:\n${missing.join("\n")}`);
      process.stdout.write(`Release ${tag} is missing ${missing.length} asset(s): ${missing.join(", ")}\n`);
    } else {
      if (args.once) fail(`Release ${tag} was not found.`);
      process.stdout.write(`Release ${tag} was not found yet.\n`);
    }

    if (Date.now() - startedAt > args.timeoutSeconds * 1000) {
      fail(`Timed out waiting for release ${tag} assets.`);
    }
    sleep(args.intervalSeconds);
  }
}

if (require.main === module) {
  watchReleaseArtifacts(parseArgs(process.argv.slice(2)));
}

module.exports = {
  expectedReleaseAssetNames,
  missingReleaseAssets,
  normalizeReleaseTag,
  parseArgs,
  publishedReleaseFailure,
};
