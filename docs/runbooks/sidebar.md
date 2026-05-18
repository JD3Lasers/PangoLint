# PangoLint sidebar runbook

The sidebar lives behind the PangoLint icon in the VS Code activity bar.
It is implemented as three stacked `vscode.TreeDataProvider`s — Commands,
Objects, Diagnostics — sharing a renderer-agnostic model layer so the
renderer can be swapped (for example, to a webview) without touching the
data, queries, or formatting.

## Views

| View ID | What it shows | Source |
| --- | --- | --- |
| `pangolint.commandsView` | Every PangoScript command in the bundled catalog. Each row is collapsible — children are detail rows (Signature / Safety / Evidence / Object / Example) and action rows (Insert at cursor / Copy signature / View in full reference). Hover yields a Markdown tooltip with the syntax-highlighted example. | `data/pangoscript/commands.merged.json` |
| `pangolint.objectsView` | BEYOND object schemas (Master, Zone, UniversePanel, and related roots) with property counts and array/scalar shape. Hover yields a Markdown property listing. | `data/pangoscript/object-tree/runtime-indexes/known-properties.json` |
| `pangolint.diagnosticsView` | Active `.BeyondCode` file's diagnostics, grouped by rule. Each entry jumps to the source range. Each group exposes a `Why?` action that opens `docs/references/diagnostics/README.md` scrolled to the rule's heading. | `vscode.languages.getDiagnostics` for the active editor URI |

## Title-bar actions

| View | Actions (in order) |
| --- | --- |
| Commands | Filter… (`pangolint.sidebar.filterCommands`), Clear filter (`pangolint.sidebar.clearFilter`), Refresh (`pangolint.sidebar.refresh`) |
| Objects | Refresh |
| Diagnostics | Refresh |

## Keybindings

| Binding (macOS / others) | When | Effect |
| --- | --- | --- |
| `Cmd+Enter` / `Ctrl+Enter` | `focusedView == pangolint.commandsView && editorIsOpen` | Inserts the focused command's primary example at the active editor cursor (via `pangolint.sidebar.insertSelectedCommand`). |

## Code layout

```
src/sidebar/
  model/                    ← renderer-agnostic. No vscode.TreeItem.
    types.ts                CommandSummary/Detail, ObjectSummary/Detail,
                            DiagnosticInput, FilterState,
                            SIDEBAR_COMMAND_IDS, payload shapes.
    catalog.ts              buildSidebarCatalog, getCommands(filter),
                            getCommandDetail, groupByObject.
    objects.ts              buildSidebarObjects, getObjectTree,
                            getObjectDetail.
    diagnostics.ts          summarizeDiagnostics — pure grouping.
    formatting.ts           renderCommandMarkdown, renderObjectMarkdown
                            for tooltips today and webview detail
                            panels tomorrow.
    actions.ts              Action descriptor helpers + the
                            isSidebarCommandId guard.
  view/treeview/            ← TreeView renderer. The only place that
                            constructs vscode.TreeItem.
    treeItems.ts            All TreeItem builders live here. Other
                            files in this folder must not call
                            `new vscode.TreeItem` directly.
    commandsView.ts         CommandsTreeProvider. Hosts the filter
                            state and exposes `detailForSelection`
                            for keybinding-driven commands.
    objectsView.ts          ObjectsTreeProvider.
    diagnosticsView.ts      DiagnosticsTreeProvider. Subscribes to
                            vscode.languages.onDidChangeDiagnostics
                            and onDidChangeActiveTextEditor.
    register.ts             Single registerSidebar(context, options)
                            entry. Owns view registration, the
                            pangolint.sidebar.* command bindings, and
                            the createTreeView for Commands (so
                            keybindings can read selection).
```

The rule that keeps the renderer swappable: `src/sidebar/model/` may not
import `vscode.TreeItem`, `vscode.TreeView`, or `vscode.WebviewView`.
The audit checklist in
[docs/specs/2026-05-05-engineering-standards.md](../specs/2026-05-05-engineering-standards.md)
enforces this.

## Adding a new view

1. **Decide whether to extend the model.** If the new view surfaces
   data the model already exposes, skip ahead. Otherwise add the
   query helpers to `src/sidebar/model/` (typed with `vscode`-free
   shapes) and unit-test them under `tests/sidebar/`.
2. **Add the TreeDataProvider.** Create
   `src/sidebar/view/treeview/<name>View.ts`. Construct TreeItems only
   through helpers in `treeItems.ts` — extend `treeItems.ts` if a new
   shape is needed.
3. **Register the view.** Add the view ID to the `pangolint` container
   in `package.json` under `contributes.views.pangolint`. Wire the
   provider in `register.ts`. If you need selection (e.g. for
   keybindings), use `vscode.window.createTreeView` instead of
   `vscode.window.registerTreeDataProvider`.
4. **Pin the file in `tests/sourceLayout.test.ts`.** The
   `expectedSidebarSubfolders["view/treeview"]` array enforces the
   file list — drift breaks the test on purpose.
5. **Add an extension-host smoke test.** Extend
   `src/test/suite/sidebar.test.ts` so command-registration changes
   surface in CI.

## Migration path: TreeView → webview

A future webview renderer would live at `src/sidebar/view/webview/`
beside `treeview/` and would consume the same model exports. Steps:

1. Add the renderer with its own `register.ts` analog.
2. Decide per-view whether to swap renderer. The activity-bar container
   can host TreeViews and Webviews side-by-side, so partial migration
   is allowed (e.g. Commands → webview, Objects + Diagnostics stay
   TreeView).
3. The `pangolint.sidebar.*` action command IDs are unchanged. The
   webview posts a message that invokes the same registered command.
4. `model/formatting.renderCommandMarkdown` is reused as-is for the
   webview's detail pane.

The model layer is the contract.
