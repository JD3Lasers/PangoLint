# PangoLint versioning policy

PangoLint ships two artifacts from the same repository:

- the VS Code extension VSIX (`pangolint-<version>.vsix`)
- the standalone MCP package tarball (`pangolint-mcp-<version>.tgz`)

Keep these versions in lockstep while GitHub Releases ship both artifacts
together. A future issue can split the release channels if npm or the VS Code
Marketplace needs independent cadence.

## Version shape

Before `1.0.0`, use disciplined pre-1.0 semver:

- `0.MINOR.PATCH` is the normal release line.
- `PATCH` is for narrow bug fixes, docs/manual corrections, packaging-only
  repairs, dependency metadata fixes, or non-behavioral catalog corrections.
- `MINOR` is for user-visible extension behavior, MCP tool/resource behavior,
  shipped knowledge-data expansions, sidebar/workflow changes,
  diagnostics/formatter behavior changes, or compatibility-risking changes.
- `prerelease` suffixes such as `0.2.0-alpha.1` or `0.2.0-rc.1` are for
  internal test builds that should not be treated as stable release artifacts.

## Artifact replacement rule

Do not replace published assets for the same version after external consumers
may have downloaded them. If the artifact contents changed materially, bump the
version.

`gh release upload --clobber` is acceptable only for an unpublished draft
release or release-candidate correction. The hosted release workflow refuses to
clobber a non-draft GitHub Release.

## Release version steps

1. Choose `PATCH`, `MINOR`, or `prerelease` before packaging.
2. Bump root and MCP package versions together:

   ```bash
   npm run release:version -- 0.2.0
   ```

3. Move `CHANGELOG.md` entries from `Unreleased` to the new version heading and
   update the comparison links.
4. Commit the version/changelog changes.
5. Run the preflight from a clean working tree:

   ```bash
   npm run release:preflight -- 0.2.0
   ```

6. Tag the exact commit as `v<version>`.

The release workflow verifies that the tag, root package version, MCP package
version, and lockfile agree before building artifacts.
