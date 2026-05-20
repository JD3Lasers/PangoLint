# sidebar

Activity-bar view container for PangoLint. The Commands and Objects views are
rendered by custom webviews: Commands needs virtualized catalog search, and
Objects needs searchable/collapsible property-path browsing plus contextual
insert actions. Diagnostics keeps a TreeView renderer because it is well served
by VS Code's native tree.

## Layout

- `model/` - renderer-agnostic. Catalog queries, object queries,
  diagnostic summarization, Markdown formatting for tooltips, and
  action command IDs / payload shapes. Must not import
  `vscode.TreeItem`, `vscode.TreeView`, or `vscode.WebviewView`.
- `view/treeview/` - Diagnostics TreeView renderer plus provider
  registration for Commands, Objects, and Diagnostics. Also centralizes the
  `pangolint.sidebar.*` command bindings shared by webviews and TreeViews.
- `view/webview/` - webview renderers for Commands and Objects.
  - `commandsWebview.ts` - `WebviewViewProvider` host. Loads the
    bundled HTML/JS/CSS, sends the catalog snapshot on `ready`, and
    dispatches webview action messages to existing `pangolint.sidebar.*`
    command handlers.
  - `objectsWebview.ts` - `WebviewViewProvider` host. Builds the property
    tree, dispatches property insertion, and bridges mapped setter-command
    actions back into the Commands webview.
  - `messages.ts` - typed `HostToWebviewMessage` /
    `WebviewToHostMessage` discriminated unions. The only
    renderer-aware contract between extension and Commands webview.
  - `objectsMessages.ts` - typed Objects webview message protocol.
  - `bundle/` - Commands webview TypeScript app source compiled by esbuild
    to a single JS bundle (`dist/sidebar-commands-webview.js`). Vanilla TS - no
    framework dependency. Has its own tsconfig (`bundle/tsconfig.json`)
    that swaps in DOM lib so the parent `tsc --noEmit` stays
    node-shaped.
  - `objects-bundle/` - Objects webview TypeScript app source compiled to
    `dist/sidebar-objects-webview.js`.

The webview bundle:

- `dom.ts` - tiny `el` / `replaceChildren` / `setClass` / `debounce`
  helpers (replaces a framework dependency).
- `state.ts` - in-webview store: catalog, filter, derived list, view
  model. Filtering / scoring / grouping run locally so search is
  keystroke-responsive without round-tripping to the host.
- `filters.ts` - search input + safety-tier and evidence-level chip
  rows + group-by-object toggle.
- `list.ts` - virtual-scroll command list (only rows in the visible
  window + small overscan render). Switches to a non-virtualized
  grouped layout when group-by is on.
- `detail.ts` - full-overlay detail panel with back button. Renders
  signature, parameters table, example, action buttons (Insert /
  Copy / View in full reference).
- `main.ts` - bootstraps the bundle, wires message protocol.

Confidence is surfaced as evidence level and safety tier only; maintainer
provenance is intentionally not part of the user-facing UI or public command
payloads.

See
[docs/specs/2026-05-05-engineering-standards.md](../../docs/specs/2026-05-05-engineering-standards.md)
for the model/view split rule.
