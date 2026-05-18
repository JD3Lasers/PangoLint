# Source Layout

`extension.ts` is the VS Code composition root. It should register providers,
commands, views, and watchers, then delegate behavior to responsibility-focused
modules under these folders:

- `language/`: parser, diagnostics, formatting, semantic tokens, labels,
  property-path helpers, and other editor language behavior.
- `knowledge/`: command catalog, curated command knowledge, and known-property
  index loading/validation.
- `runtime/`: Talk UDP, OSC, BEYOND readback, script-send behavior, and
  runtime command registration.
- `workspace/`: workspace-root handling, file-backed registries, workspace
  scanning, workspace symbols, trust checks, and watcher view state.

Do not add new production modules directly under `src/` unless they are another
composition root. Add new behavior to the folder that owns the responsibility,
or update the engineering standards spec if a new responsibility group is
needed.
