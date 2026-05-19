# Maintainer Workflow Scripts

These scripts automate repeated repository tasks while keeping the public repo
usable without private tooling.

They are intentionally small. They do not replace GitHub issue templates,
review judgment, release notes, or manual artifact inspection.

## Start Issue Work

Use this from a clean `main` checkout when starting a normal issue branch:

```bash
npm run workflow:start-issue -- --title "Short issue title" --label enhancement
```

To start from an existing issue:

```bash
npm run workflow:start-issue -- --issue 8
```

The script:

- verifies the working tree is clean,
- verifies the current branch is `main`,
- fetches `origin/main` and requires local `main` to match it,
- creates or reuses a GitHub issue,
- checks out `issue-<number>-<slug>`.

Do not bump the package version at this phase. The version bump happens after
the implementation and focused verification are stable.

## Check Pull Request Readiness

Use this before merge after hosted checks and current-head review have had time
to settle:

```bash
npm run workflow:check-pr
```

To check a specific PR:

```bash
npm run workflow:check-pr -- --pr 8
```

The script verifies:

- local `HEAD` matches the PR head,
- hosted checks are green,
- active review threads are resolved,
- the latest current-head Codex review response is clear,
- GitHub reports a clean merge state.

If a new commit is pushed after review, request a fresh `@codex` review and run
the script again.

## Watch Release Artifacts

Use this after pushing a release tag and waiting for the release workflow:

```bash
npm run workflow:watch-release -- --tag v0.4.9
```

For a single immediate check:

```bash
npm run workflow:watch-release -- --tag v0.4.9 --once
```

The script waits for the draft GitHub Release and verifies these assets:

- `pangolint-<version>.vsix`
- `pangolint-<version>.vsix.sha256`
- `pangolint-mcp-<version>.tgz`
- `release-vsix-contents.txt`
- `release-mcp-tarball.json`
- `SHA256SUMS`

It reports missing assets by name so release workflow failures can be diagnosed
without relying only on the GitHub UI.

Published releases fail this check by default because the release checklist
requires review before publishing. Use `--allow-published` only when verifying
assets after a release has already been published.
