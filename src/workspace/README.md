# Workspace Modules

This folder owns workspace-specific state and file-backed behavior:

- workspace-root selection,
- workspace trust checks,
- user-object registry reads/writes,
- workspace scans and workspace symbol lookup,
- BEYOND Watcher tree state.

Workspace scanning should stay async, skip heavy directories, and avoid
assuming virtual workspaces can support local filesystem reads or writes.
