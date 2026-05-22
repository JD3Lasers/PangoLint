# Extension Host

This folder owns stable VS Code extension identifiers and packaged-file paths
used by the extension host.

- `extensionIds.ts`: command IDs, view IDs, configuration section names, output
  channel names, and workspace-state keys.
- `packagePaths.ts`: extension-relative paths for packaged HTML, CSS,
  JavaScript, docs, and data files.

Keep behavior in the responsibility folders that consume these identifiers.
This folder should stay focused on names that need to match `package.json`,
VS Code contribution points, or package contents.
