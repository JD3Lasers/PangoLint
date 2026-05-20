---
category: Tabs
order: 17
---
# Tabs

Tabs commands navigate the Live Control tab strip in the BEYOND workspace, selecting one of the numbered LC tabs (1-8) or switching the active tab mode. They map directly to the tab row visible above the Live Control sliders.

## Commands

In the cue-grid context, tab navigation changes the same visible
Grid1 page readback as page navigation: `Grid.PageIndex`. Runtime
readback confirmed `SelectTab`, `SelectNextTab`, and
`SelectPrevTab` move that property; the Grid1-explicit variants use
the same exposed state surface.

### SelectTabName

Signature: `SelectTabName "<name>"`

Select a tab by configured name within the current category.

Parameters:
- name (string): tab name as configured in BEYOND.

Example:

    SelectTabName "Graphics"

Safety: T1 - UI focus only.

Related: `SelectTab`, `SelectPageName`.

### SelectTab

Signature: `SelectTab <index>`

Select a tab by 1-based linear index within the current category.

Parameters:
- index (integer, 1..N): tab index in the current category.

Example:

    SelectTab 1
    SelectTab 5

Safety: T1 - UI focus only.

Related: `SelectTabName`, `SelectNextTab`, `SelectPrevTab`,
`SelectPage`.

### SelectNextTab

Signature: `SelectNextTab`

Move to the next tab relative to the current one, within the current
category.

Example:

    SelectNextTab

Safety: T1 - UI focus only.

Related: `SelectPrevTab`, `SelectNextTabGrid1`.

### SelectPrevTab

Signature: `SelectPrevTab`

Move to the previous tab relative to the current one, within the
current category.

Example:

    SelectPrevTab

Safety: T1 - UI focus only.

Related: `SelectNextTab`, `SelectPrevTabGrid1`.

## Page selection (independent of category)

These four commands navigate pages **independently of the current
category** - they walk every page across every category in the
active grid.

### GoGridMode

Signature: `GoGridMode`

Switch BEYOND's main workspace into Grid mode (the cue-cell layout
used in the operator's default view).

Example:

    GoGridMode

Safety: T1 - UI mode change only.

Related: `GoTimelineMode`, `GoUniverseMode`.

### GoPlayListMode

Signature: `GoPlayListMode`

Switch BEYOND's main workspace into PlayList mode.

Example:

    GoPlayListMode

Safety: T1 - UI mode change only.

Related: `GoGridMode`, `GoTimelineMode`.

### GoTimelineMode

Signature: `GoTimelineMode`

Switch BEYOND's main workspace into Timeline mode (DAW-style cue
sequence layout).

Example:

    GoTimelineMode

Safety: T1 - UI mode change only.

Related: `GoGridMode`, `SetTimelineView`.

### GoUniverseMode

Signature: `GoUniverseMode`

Switch BEYOND into universe mode (a high-level operating-mode toggle
related to BEYOND's universe-handling features). Wiki and documentation
coverage is absent; the precise mode this enters is unverified.

Example:

    GoUniverseMode

Safety: T1 - UI / mode toggle; no laser output effect.

Related: `SetUniverseView`.

### SelectNextTabGrid1

Signature: `SelectNextTabGrid1`

Move to the next tab on Grid1 (within the current category),
ignoring other `SelectGrid` state.

Example:

    SelectNextTabGrid1

Safety: T1 - UI focus only.

Related: `SelectNextTab`, `SelectPrevTabGrid1`.

### SelectPrevTabGrid1

Signature: `SelectPrevTabGrid1`

Move to the previous tab on Grid1 (within the current category),
ignoring other `SelectGrid` state.

Example:

    SelectPrevTabGrid1

Safety: T1 - UI focus only.

Related: `SelectPrevTab`, `SelectNextTabGrid1`.

### SetActiveGrid

Signature: `SetActiveGrid <index>`

Switch BEYOND's visible/focused grid. Per BEYOND export comment:
`1 | or 2`. The two-value range matches `SelectGrid`'s 1/2 tokens
but excludes the `0` (recently active) option.

**Out-of-range tolerance** (verified 2026-05-06): the parser accepts
`SetActiveGrid 0`, `SetActiveGrid 999`, and other out-of-range
values without an error popup or runtime diagnostic. None of those
out-of-range calls affect either grid's page readback
(`Grid.PageIndex` and `Grid2.PageIndex` are unchanged after each
call). Whether the **active grid focus** itself changes for these
values isn't observable via PangoScript readback (no
`Master.ActiveGrid` or equivalent is exposed in BEYOND's object
tree). Confirming visible grid focus behavior would require
UI-screenshot verification.

Parameters:
- index (integer, 1..2): `1` = main grid, `2` = secondary grid.
 Out-of-range values are accepted by the parser without error;
 their effect on the visible grid focus is unverified - confirmed
 only that they don't disturb either grid's page state.

Example:

    SetActiveGrid 1 // focus main grid
    SetActiveGrid 2 // focus secondary grid

Safety: T1 - UI focus change.

Related: `SelectGrid` (different scope - routing register, not UI
focus), `SetGrid1Page`, `SetGrid2Page` (page mutation per grid; not
affected by `SetActiveGrid`).

### SetGridSize

Signature: `SetGridSize <columns>, <rows>`

Set the cue grid's dimensions. Per the BEYOND export example
(`SetGridSize 8, 5`), the parameters are columns x rows. Resizing
the grid affects how many cue cells are addressable per page and
combines with the cell range used by `StartCue`, `RestartCue`, and
related commands. See [cue-clicking.md](./cue-clicking.md).

Runtime readback confirmed `SetGridSize` updates
`Grid.GetColCount`, `Grid.GetRowCount`, and `Grid.Count`. A fresh
probe on 2026-05-11 confirmed 1x1, 10x10, 11x11, and 16x16 pass
through. Inputs 0 and -1 clamp to 1, and 20 clamps to 16. A 100x100
write produced 16x5, so upper out-of-range behavior is not a clean
clamp. The probe restored the starting 10x6 grid shape.

Parameters:
- columns (integer, 1..16): number of grid columns. Lower
 out-of-range values clamp to 1; upper behavior beyond 16 is
 unknown.
- rows (integer, 1..16): number of grid rows. Lower out-of-range
 values clamp to 1; upper behavior beyond 16 is unknown.

Example:

    SetGridSize 8, 5 // 8 columns x 5 rows = 40 cells per page
    SetGridSize 10, 10 // 10x10 grid, 100 cells per page

Safety: T2: changes addressable cell range for cue commands. May
invalidate scripts that hardcoded cell indices for the previous
size.

Related: `SetPage`, `StartCue` (see
[cue-clicking.md](./cue-clicking.md#startcue)).

### SetGridView

Signature: `SetGridView`

Switch the grid view mode. Takes no parameters in the export. The
exact view-mode toggle behavior is undocumented in both the export
and the Pangolin Wiki.

Example:

    SetGridView

Safety: T1 - UI view change only.

Related: `SetTimelineView`, `SetUniverseView`.

The Object Tree exposes grid/page data but no stable main-view mode
property. View-switching commands in this section are classified as
UI presentation actions rather than direct property setters.

## View switching

### SetPlayListView

Signature: `SetPlayListView`

Switch the playlist view mode. Per BEYOND export: zero arguments
and no comment on what the modes are. Likely toggles between two
or more presentation styles for the playlist panel.

Exact mode set is unverified.

Example:

    SetPlayListView // switch playlist view mode

Safety: T1 - UI presentation only.

Related: `GoPlayListMode` (workspace mode switch - in
[universe-page-navigation.md](./universe-page-navigation.md)).

### SetTimelineView

Signature: `SetTimelineView`

Switch the timeline view mode. No documented parameters; behavior
unverified.

Example:

    SetTimelineView

Safety: T1 - UI view change only.

Related: `GoTimelineMode`, `SetGridView`.

### SetUniverseView

Signature: `SetUniverseView`

Switch BEYOND's universe-view mode. Wiki coverage of this command is
absent and the PangoScript documentation has no dedicated entry;
its parameter shape (if any) is unverified.

Example:

    SetUniverseView

Safety: T1 - changes UI view mode; no laser output effect.

Related: `GoUniverseMode`.
