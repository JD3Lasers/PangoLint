---
category: Category selection
order: 19
---
# Category selection

Category selection commands navigate the cue-grid category strip, selecting one of the named fixture/effect categories that filter the visible cues on the current page. These commands replicate clicking a category button in the BEYOND workspace.

## Commands

Category focus/filter state is not exposed as a stable Object Tree
property. A `SelectCat` probe did not produce a durable
`Grid.PageIndex` or `Grid.CellIndex` target, so these commands are
classified as UI navigation actions with no direct property mapping.

### SelectAllCat

Signature: `SelectAllCat`

Select all categories - equivalent to clicking the "All" button on
the category bar, or calling `SelectCat -1`.

Example:

    SelectAllCat

Safety: T1 - UI focus only.

Related: `SelectCat`.

### SelectCatName

Signature: `SelectCatName "<name>"`

Select a category by user-defined name.

Parameters:
- name (string): category name as configured in the workspace.

Example:

    SelectCatName "Graphics"

Safety: T1 - UI focus only.

Related: `SelectCat`.

### SelectCat

Signature: `SelectCat <index>`

Select a category by 1-based index. "-1 mean
all, this is analog of SelectAllCat."

Fresh runtime writes on 2026-05-11 sent `SelectCat -1`, `SelectCat 0`,
`SelectCat 1`, and `SelectCat 999`. The current Object Tree exposes
no category selection or category count property, and `Grid.PageIndex`
and `Grid.CellIndex` stayed unchanged during representative writes.
Use `-1` for all categories and 1-based indices for named categories;
do not infer a maximum category count from readback.

Parameters:
- index (integer, -1 or 1..category count): category index. `-1`
 selects all categories, the same as `SelectAllCat`.

Example:

    SelectCat 1
    SelectCat -1 // all categories

Safety: T1: UI focus only.

Related: `SelectCatName`, `SelectAllCat`, `SelectNextCat`.

### SelectNextCat

Signature: `SelectNextCat`

Move to the next category relative to the current one.

Example:

    SelectNextCat

Safety: T1 - UI focus only.

Related: `SelectPrevCat`, `SelectNextCatGrid1`.

### SelectPrevCat

Signature: `SelectPrevCat`

Move to the previous category relative to the current one.

Example:

    SelectPrevCat

Safety: T1 - UI focus only.

Related: `SelectNextCat`, `SelectPrevCatGrid1`.

## Grid1-explicit variants

These six commands explicitly target Grid1, regardless of whatever
`SelectGrid` was last set to. Useful when a script needs to operate
on the main grid without depending on prior `SelectGrid` calls.

### SelectNextCatGrid1

Signature: `SelectNextCatGrid1`

Move to the next category on Grid1, ignoring any other
`SelectGrid` setting.

Example:

    SelectNextCatGrid1

Safety: T1 - UI focus only.

Related: `SelectNextCat`, `SelectPrevCatGrid1`.

### SelectPrevCatGrid1

Signature: `SelectPrevCatGrid1`

Move to the previous category on Grid1, ignoring other `SelectGrid`
state.

Example:

    SelectPrevCatGrid1

Safety: T1 - UI focus only.

Related: `SelectPrevCat`, `SelectNextCatGrid1`.
