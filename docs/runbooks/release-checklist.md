# PangoLint release checklist

Run through this list before publishing a new release artifact set. The default
path is a GitHub Release with VSIX, standalone MCP tarball, and checksums. npm
and VS Code Marketplace publishing are separate protected phases.

Open a release issue before broad readiness work such as regression-script
promotion, dependency audit cleanup, MCP package readiness, or manual runtime
smoke checks.

## 1. Pre-flight code checks

- [ ] Working tree clean (`git status --short --branch`).
- [ ] Branch is `main` and up to date with `origin/main`.
- [ ] If this release will seed or update the public repo, publish from a scrubbed
  history or a fresh public repository. Do not expose old commits containing
  verbatim Pangolin reference exports or OSC/help docs.
- [ ] `npm run check` passes on the maintainer machine. This is the strict
  verification gate for generated data, packaging, public checks, and MCP
  tarball verification.
- [ ] `npm run check:release` passes. This is the clean-runner release gate
  used by GitHub Actions. It verifies the checked-in release data and package
  contents from public tracked files.
- [ ] `npm run check:public` passes from public tracked files.
- [ ] `npm run check:mcp` verifies the `pangolint-mcp` package tarball.
- [ ] `npm run audit:prod` reports no runtime dependency vulnerabilities.
- [ ] No `TODO`/`FIXME`/`XXX` word markers left over from the release work
  (`rg -n "\b(TODO|FIXME|XXX)\b" src/ scripts/ tests/`).
- [ ] No new entries under `.trash/`.

## 2. Knowledge base sanity

- [ ] `data/pangoscript/commands.merged.json` and
  `data/pangoscript/object-tree/runtime-indexes/known-properties.json` are
  deterministic: re-running `npm run build:knowledge` and
  `npm run build:known-properties` produces no diff.
- [ ] Public command knowledge contains no maintainer provenance fields or
  private-tooling paths.
- [ ] Internal corpus stays diagnostic-free
  (`PANGOLINT_CORPUS_VERBOSE=1 npm run lint:examples`).

## 3. Version bump + changelog

- [ ] Apply the [Version selection policy](versioning-policy.md): choose
  `PATCH`, `MINOR`, or a `prerelease` suffix before packaging.
- [ ] For normal PR work, apply this bump after implementation and focused
  verification are stable, before final review and merge. Do not bump again for
  review fixes inside the same PR.
- [ ] Bump `version` in [package.json](../../package.json) and
  [mcp/package.json](../../mcp/package.json) together. Keep root and MCP
  versions lockstep unless the release issue explicitly says otherwise:

  ```bash
  npm run release:version -- <version>
  ```

- [ ] Move `Unreleased` items in [CHANGELOG.md](../../CHANGELOG.md) under
  the new version heading with today's date.
- [ ] Update the link references at the bottom of `CHANGELOG.md`.
- [ ] After committing version/changelog changes, run the release preflight from
  a clean tree:

  ```bash
  npm run release:preflight -- <version>
  ```

## 4. Artifact build + smoke test

- [ ] Build the VSIX:

  ```bash
  npm run package:vsix
  ```

  This re-runs the public-clone gate, packages with `vsce`, and writes
  `pangolint.vsix.sha256`.
- [ ] Inspect the VSIX contents:

  ```bash
  npx vsce ls --no-dependencies
  ```

  Confirm no `dist/` debug artifacts, no maintainer-only input paths, no
  `*.exe`, no `.vscode/` settings leaked in.
- [ ] Build the standalone MCP tarball:

  ```bash
  npm run package:mcp
  ```

  The tarball is written under `mcp/` as `pangolint-mcp-<version>.tgz`.
- [ ] Verify MCP tarball contents:

  ```bash
  npm --workspace mcp run verify:tarball
  ```

  Confirm the tarball contains only the intended runtime bundle, CLI shim,
  copied `data/`, copied `docs/`, `README.md`, and `LICENSE`.
- [ ] Confirm the MCP package does not require the VS Code extension:

  ```bash
  npm install -g ./mcp/pangolint-mcp-<version>.tgz
  pangolint-mcp
  ```

  Knowledge-only startup is sufficient; runtime tools should remain disabled
  unless explicit env vars are set.
- [ ] Install in a clean Extension Development Host:

  ```bash
  code --install-extension pangolint-<version>.vsix --force
  ```

- [ ] Walk the [vsix-smoke-test runbook](vsix-smoke-test.md) end to end
  with [vsix-smoke-test.BeyondCode](vsix-smoke-test.BeyondCode).
- [ ] On a Windows host: install the same VSIX, open the smoke-test
  fixture, confirm grammar, hover, completion, formatting, and the
  outline view all render.

## 5. Runtime checks (only if BEYOND is reachable)

- [ ] `PangoLint: Test BEYOND Connection` returns a green `requestId` callback
  within timeout.
- [ ] If the play button is enabled in the test workspace
  (`pangolint.beyond.allowScriptExecution: true`), sending a known-safe
  straight-line callback (e.g.
  `OscOutTTS "/pangolint/release/smoke", "s", "release-smoke"`) round-trips
  cleanly and the modal confirm fires before transmission.

## 6. Tag + GitHub Release

- [ ] Commit any version-bump / changelog edits with a tidy message.
- [ ] Tag the release:

  ```bash
  git tag -a v<version> -m "PangoLint v<version>"
  git push origin main --tags
  ```

- [ ] Confirm the `Release Artifacts` workflow succeeds for the tag. The
  workflow runs the clean-runner gate directly
  (`npm run check:public && npm run check:mcp`); it intentionally does not
  regenerate private-source command knowledge in the clean GitHub runner.
- [ ] Confirm the workflow created a **draft** GitHub Release with:
  - `pangolint-<version>.vsix`
  - `pangolint-<version>.vsix.sha256`
  - `pangolint-mcp-<version>.tgz`
  - `release-vsix-contents.txt`
  - `release-mcp-tarball.json`
  - `SHA256SUMS`
- [ ] Verify the draft release assets from the command line:

  ```bash
  npm run workflow:watch-release -- --tag v<version> --once
  ```

- [ ] Review the draft release notes and publish the release when ready.
- [ ] Remember that GitHub Release assets are a manual installation channel
  only. They do not provide automatic VS Code or npm updates.

## 7. Optional registry publishes

- [ ] npm publish for `pangolint-mcp` only after the npm publishing plan is
  selected for this release:

  ```bash
  npm publish --workspace mcp
  ```

- [ ] Marketplace publish only after Azure DevOps / Visual Studio Marketplace
  publisher setup is complete and public-facing listing content has been
  reviewed:

  ```bash
  npx vsce publish --packagePath pangolint-<version>.vsix
  ```

## 8. Post-publish

- [ ] Verify the GitHub Release assets install cleanly from a fresh download.
- [ ] If npm was published, verify `npm install -g pangolint-mcp` in a clean
  shell or profile.
- [ ] If Marketplace was published, verify the listing shows the icon, README,
  and CHANGELOG correctly.
- [ ] If Marketplace was published, open `Extensions: Show Recommended
  Extensions` in a clean VS Code profile to confirm the keywords surface
  PangoLint for `pangoscript`, `pangolin`, and `beyond`.
- [ ] Add a `Released v<version>` entry to the project memory if the
  release introduces any operator-facing behavior change.
