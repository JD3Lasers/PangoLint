---
category: Cell "navigation"
order: 6
---
# Cell "navigation"

Cell navigation commands move the keyboard focus within the BEYOND cue grid without triggering playback. They let a script reposition the focused cell to an absolute grid address or step through rows, columns, and pages using relative offsets. ReStartCell restarts the currently focused cell if it is already playing.

Runtime readback confirmed the focus-only commands write `Grid.CellIndex`.
The start/stop/toggle commands are cue-output actions; no stable shipped
Object Tree playback-state property is published for the action itself.

## Commands

### SelectGrid

Signature: `SelectGrid <index>`

Set the active grid for subsequent tab / page / category navigation
commands.

Parameters:
- index (integer, 0..2): 0 = most recently active grid, 1 = main
 grid (center of main form), 2 = secondary grid (bottom tabs).

Example:

    SelectGrid 1 // main grid
    SelectGrid 2 // secondary grid
    SelectGrid 0 // recently active grid

Safety: T1 - UI focus only.

Related: `SelectTab`, `SelectPage`, `*Grid1` variants below.

## Tab selection (within current category)

These four commands navigate tabs **within the currently-selected
category**. Combine with `SelectCat*` to choose which category's
tabs are in scope.

### FocusCell

Signature: `FocusCell <column>, <row>`

Move the UI focus to a cell by column and row inside the current page.

Parameters:
- column (integer, 1..N): column index where N is the grid's configured width.
- row (integer, 1..N): row index where N is the grid's configured height.

Example:

    FocusCell 1, 1

Safety: T1 - UI-only; no playback effect.

Property mapping: runtime readback confirmed `FocusCell 4, 1`
writes `Grid.CellIndex` to `4`.

Related: `FocusCellIndex`, `MoveFocus`, `ShiftFocus`.

### FocusCellIndex

Signature: `FocusCellIndex <cellIndex>`

Move the UI focus to a cell by linear index (1..255). Useful when the
script tracks cells by their export-order index rather than column/row.

Parameters:
- cellIndex (integer, 1..255): linear cell index.

Example:

    FocusCellIndex 7

Safety: T1 - UI-only; no playback effect.

Property mapping: runtime readback confirmed this writes
`Grid.CellIndex`.

Related: `FocusCell`, `MoveFocus`.

### StartCell

Signature: `StartCell`

Start the currently-focused cell.

Example:

    StartCell

Safety: T3 - activates live laser output.

Property mapping: action-only; no stable shipped Object Tree property
is written by the command itself.

Related: `StartCue`, `StopCell`, `ToggleCell`.

### ToggleCell

Signature: `ToggleCell`

Toggle the currently-focused cell (start if stopped, stop if running).

Example:

    ToggleCell

Safety: T3 - may activate live laser output.

Property mapping: action-only; no stable shipped Object Tree property
is written by the command itself.

Related: `ToggleCue`, `StartCell`, `StopCell`.

### ReStartCell / RestartCell

Signature: `RestartCell`

Restart the currently-focused cell if it is already playing. No-op if the
focused cell is not running.

BEYOND's exported parser-bound name is `ReStartCell`, while its example
signature and common operator spelling use `RestartCell`. PangoScript is
case-insensitive, and PangoLint keeps `RestartCell` as an alias so both
spellings resolve to this entry.

Example:

    RestartCell

Safety: T3 - affects live laser output (resets cue position).

Property mapping: action-only; no stable shipped Object Tree property
is written by the command itself.

Related: `RestartCue`, `StartCell`.

## Focus navigation

These commands move the UI focus rectangle inside the grid without
starting or stopping any cue. They are safe to call without operator
supervision (T1) - only the visible focus highlight changes.

### StopCell

Signature: `StopCell`

Stop the currently-focused cell.

Example:

    StopCell

Safety: T3 - affects live laser output.

Property mapping: action-only; no stable shipped Object Tree property
is written by the command itself.

Related: `StopCue`, `StartCell`, `ToggleCell`.

### ShiftFocus

Signature: `ShiftFocus <cells>`

Step the UI focus forward (positive) or backward (negative) by N cells in
the grid's reading order.

Runtime readback on a 10x6 grid confirmed linear relative movement
with wrap through `Grid.Count`: from cell 1, `ShiftFocus 1` moved to
2, `ShiftFocus -1` wrapped to 60, `ShiftFocus 999` wrapped to 40,
and `ShiftFocus -999` wrapped to 22.

Parameters:
- cells (integer): relative number of cells to step. Negative values
 step backward; results wrap modulo `Grid.Count`.

Example:

    ShiftFocus -5
    ShiftFocus 1

Safety: T1: UI focus only; no playback effect.

Property mapping: runtime readback confirmed this writes
`Grid.CellIndex` relative to the current focus and wraps through
`Grid.Count`.

Related: `MoveFocus`, `FocusCellIndex`.

### MoveFocus

Signature: `MoveFocus <horizontal>, <vertical>`

Move the UI focus by a relative offset. Negative values move left or up;
positive values move right or down.

Runtime readback on a 10x6 grid confirmed horizontal offsets add
directly to `Grid.CellIndex`, vertical offsets add `vertical *
Grid.GetColCount`, and the result wraps modulo `Grid.Count`.
From cell 1, `MoveFocus -1, 0` wrapped to 60, `MoveFocus 0, -1`
wrapped to 51, `MoveFocus 1, 0` moved to 2, `MoveFocus 0, 1` moved
to 11, `MoveFocus 999, 0` wrapped to 40, and `MoveFocus 0, 999`
wrapped to 31.

Parameters:
- horizontal (integer): relative cell offset. Negative values move
 left; results wrap modulo `Grid.Count`.
- vertical (integer): relative row offset. Negative values move up;
 results wrap modulo `Grid.Count`.

Example:

    MoveFocus -1, 0 // move focus one cell left with wrap
    MoveFocus 0, 1 // move focus one row down with wrap

Safety: T1: UI focus only; no playback effect.

Property mapping: runtime readback confirmed this writes
`Grid.CellIndex` relative to the current focus and wraps through
`Grid.Count`.

Related: `ShiftFocus`, `FocusCell`.
