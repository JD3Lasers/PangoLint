---
category: Pages
order: 18
---
# Pages

Pages commands navigate the cue-grid page bank: jump to a specific page number or step forward/backward. These commands control the Page selector visible in the BEYOND main grid toolbar.

## Commands

Runtime readback confirms page navigation updates Grid1's visible
page through `Grid.PageIndex`. `SelectPage 2` set
`Grid.PageIndex = 2`; the next/previous page commands moved between
page indices in the current workspace. The Grid1-explicit variants
target the same `Grid.PageIndex` surface.

### SelectPageName

Signature: `SelectPageName "<name>"`

Select a page by configured name across all categories.

Parameters:
- name (string): page name as configured in BEYOND.

Example:

    SelectPageName "Graphics"

Safety: T1 - UI focus only.

Related: `SelectPage`, `SelectTabName`.

### SelectPage

Signature: `SelectPage <index>`

Select a page by 1-based linear index across all categories.

Parameters:
- index (integer, 1..N): page index across all categories.

Example:

    SelectPage 3

Safety: T1 - UI focus only.

Related: `SelectPageName`, `SelectNextPage`, `SelectTab`.

### SelectNextPage

Signature: `SelectNextPage`

Move to the next page relative to the current one, across all
categories.

Example:

    SelectNextPage

Safety: T1 - UI focus only.

Related: `SelectPrevPage`, `SelectNextPageGrid1`.

### SelectPrevPage

Signature: `SelectPrevPage`

Move to the previous page relative to the current one, across all
categories.

Example:

    SelectPrevPage

Safety: T1 - UI focus only.

Related: `SelectNextPage`, `SelectPrevPageGrid1`.

## Category selection

Categories are user-defined groupings of pages. Names vary per
workspace ("Graphics", "Effects", "Text", etc.).

### SelectNextPageGrid1

Signature: `SelectNextPageGrid1`

Move to the next page on Grid1, ignoring other `SelectGrid` state.

Example:

    SelectNextPageGrid1

Safety: T1 - UI focus only.

Related: `SelectNextPage`, `SelectPrevPageGrid1`.

### SelectPrevPageGrid1

Signature: `SelectPrevPageGrid1`

Move to the previous page on Grid1, ignoring other `SelectGrid`
state.

Example:

    SelectPrevPageGrid1

Safety: T1 - UI focus only.

Related: `SelectPrevPage`, `SelectNextPageGrid1`.

### SetGrid1Page

Signature: `SetGrid1Page <index>`

Set the visible page on Grid1 (main grid). Verified at runtime in
BEYOND 2030: invocation moves Grid1 to the target page (observable
both via `Grid.PageIndex` readback and via the separately-running
`WaitForPageChange` waiter). Use this rather than `SetPage`, which is
a runtime no-op despite its Wiki "alias" claim - see `SetPage` above.

**Out-of-range clamping** (verified 2026-05-06 against a workspace
with two pages):

- Values > maxPage clamp to maxPage. E.g. `SetGrid1Page 999` lands
 Grid1 on page 2 when only two pages are configured.
- Values ≤ 0 clamp to 1. E.g. `SetGrid1Page 0` and `SetGrid1Page -1`
 both land Grid1 on page 1.

The clamp is silent (no error popup, no Talk-bus diagnostic). The
maxPage value is the current grid's configured page count, which can
be increased from the BEYOND UI.

Parameters:
- index (integer, 1..N): 1-based page index. Out-of-range values
 silently clamp to `[1, maxPage]`.

Example:

    SetGrid1Page 1
    SetGrid1Page 2
    SetGrid1Page 999 // clamps to maxPage (silent)

Safety: T1 - UI page change only.

Related: `SetPage`, `SetGrid2Page`, `WaitForPageChange`.

### SetGrid2Page

Signature: `SetGrid2Page <index>`

Set the visible page on Grid2 (secondary grid). Verified at runtime
in BEYOND 2030 against a workspace with two pages on Grid2:
invocation moves `Grid2.PageIndex` to the target page (observable
via OSC readback). The earlier "runtime hedge" (Grid2 panel page
tabs did not appear to flip) was a single-page workspace artifact - 
when only one page exists, all writes silently no-op (see clamping
below); with multiple pages the call works as expected.

**Out-of-range clamping** (verified 2026-05-06 with two pages
configured):

- Values > maxPage clamp to maxPage. E.g. `SetGrid2Page 999` lands
 Grid2 on page 2 when only two pages exist.
- Values ≤ 0 clamp to 1 (parallels `SetGrid1Page`'s clamp behavior).

`WaitForPageChange` does **not** fire on Grid2 page changes
regardless of whether the underlying state moves - that wait is
Grid1-only (see `WaitForPageChange` in
[waiting-for-events.md](./waiting-for-events.md)).

Parameters:
- index (integer, 1..N): 1-based page index. Out-of-range values
 silently clamp to `[1, maxPage]`.

Example:

    SetGrid2Page 1
    SetGrid2Page 2
    SetGrid2Page 999 // clamps to maxPage (silent)

Safety: T1 - UI page change only.

Related: `SetPage`, `SetGrid1Page`, `WaitForPageChange`.

## Grid configuration

### SetPage

Signature: `SetPage <index>`

Pangolin Wiki (entry 1024) describes `SetPage` as setting the
currently-visible page in the **main grid** (Grid1) - i.e. an alias
for `SetGrid1Page`. **Runtime refutes this in BEYOND 2030**:
`SetPage <n>` parses cleanly but never moves either grid's page,
regardless of `SetActiveGrid` state.

Verified 2026-05-06 against a workspace with two pages on each grid
by reading `Grid.PageIndex` and `Grid2.PageIndex` over OSC after
each command:

- After `SetGrid1Page 2 / SetPage 1` → `Grid.PageIndex` stayed at 2
 (i.e. SetPage did **not** move Grid1 from page 2 back to 1).
- After `SetActiveGrid 2 / SetGrid2Page 2 / SetPage 1` →
 `Grid2.PageIndex` stayed at 2 (i.e. SetPage doesn't target the
 active grid either).
- `SetPage 999` and `SetPage 0` both no-op identically.

Treat `SetPage` as a silent no-op in current builds; use
`SetGrid1Page` for Grid1 and `SetGrid2Page` for Grid2.

Parameters:
- index (integer, 1..N): 1-based page index per the Wiki claim. The
 parser accepts the value but the call has no observable effect on
 any grid.

Example:

    SetPage 1 // parses but no-ops in BEYOND 2030
    SetGrid1Page 1 // use this for Grid1
    SetGrid2Page 1 // use this for Grid2

Safety: T0 - runtime no-op; nothing to undo.

Related: `SetGrid1Page`, `SetGrid2Page`, `SetActiveGrid`.
