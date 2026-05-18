---
category: Cue clicking
order: 2
---
# Cue clicking

Cue clicking commands replicate every mouse gesture the operator can perform on the BEYOND cue grid: start, stop, toggle, pause, restart, mouse-down/up, hold-click mode, and cue selection by name. T3-tier: every command in this category has the potential to activate live laser output. Operator supervision is a precondition for scripted use.

## Commands

Cue playback actions do not expose a stable Object Tree property for
running/paused/pressed state. PangoLint classifies `StartCue`,
`StopCue`, `ToggleCue`, `PauseCue`, `RestartCue`, `CueDown`,
`CueUp`, and related previous/multi variants as action commands with
no direct property target.

### StartCue

Signature: `StartCue <page>, <cell>`
Signature: `StartCue "<cueName>"`

Start a single cue.

The `<page>, <cell>` form is the preferred address (page index 1..100,
cell index 1..100). The `<cueName>` form looks up a cue by the name shown
in the grid - BEYOND searches the current page first and then walks pages
from the top until a match is found. No-op if the addressed cue is already
playing.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.
- cueName (string): cue name as displayed in the grid cell.

Example:

    StartCue 1, 1
    StartCue "Opener"

Safety: T3 - activates live laser output.

Related: `StartCueMulti`, `StopCue`, `ToggleCue`, `RestartCue`.

### StartCueMulti

Signature: `StartCueMulti <page>, <cell>`

Start a cue while allowing multiple cues to be active simultaneously.
Equivalent to enabling multi-cue mode and then issuing `StartCue`.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.

Example:

    StartCueMulti 1, 1
    StartCueMulti 1, 2

Safety: T3 - activates live laser output.

Related: `StartCue`, `ToggleCueMulti`.

### StopCue

Signature: `StopCue <page>, <cell>`
Signature: `StopCue "<cueName>"`

Stop a single cue. Uses BEYOND's default soft-stop time. No-op if the
addressed cue is not currently playing. Both addressing forms behave as
described for `StartCue`.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.
- cueName (string): cue name as displayed in the grid cell.

Example:

    StopCue 1, 1
    StopCue "Opener"

Safety: T3 - affects live laser output.

Related: `StopCueNow`, `StopCueSync`, `StopAllNow`.

### ToggleCue

Signature: `ToggleCue <page>, <cell>`
Signature: `ToggleCue "<cueName>"`

Start the cue if it is not currently playing; stop it if it is.
Convenient for MIDI-button-style toggles where one input drives both
states.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.
- cueName (string): cue name as displayed in the grid cell.

Example:

    ToggleCue 1, 1
    ToggleCue "Strobe"

Safety: T3 - may activate live laser output.

Related: `StartCue`, `StopCue`, `ToggleCueMulti`.

### ToggleCueMulti

Signature: `ToggleCueMulti <page>, <cell>`

Toggle a cue in multi-cue mode (multiple cues may remain active
simultaneously). Otherwise identical to `ToggleCue`.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.

Example:

    ToggleCueMulti 1, 1

Safety: T3 - may activate live laser output.

Related: `ToggleCue`, `StartCueMulti`.

### PauseCue

Signature: `PauseCue <page>, <cell>, <state>`

Set the pause state on a running cue. The `state` argument is best
written as one of the named constants `OFF` (0), `ON` (1), or
`TOGGLE` (2).

Verified at runtime in BEYOND 2030 with a `StartCue / Sleep /
PauseCue ..., 1 / Sleep / PauseCue ..., 0` probe: `state = 0` is
**OFF / resume from current position**, NOT a restart. The
Pangolin documentation OFF/ON/TOGGLE labels are correct; the Pangolin
Wiki's `0 = renew` label is incorrect for current builds.

Pause and resume both apply BEYOND's transition curve - the cue
eases into and out of the paused state with a short dwell rather
than freezing or unfreezing instantaneously. Plan accordingly if
you are sequencing other commands tightly around the
`PauseCue ..., 1 / PauseCue ..., 0` boundary.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.
- state (integer, 0..2): `0` = OFF (resume from current position
 - verified, NOT a restart); `1` = ON (pause); `2` = TOGGLE (flip).

Example:

    PauseCue 1, 1, ON // pause the cue at (1, 1)
    PauseCue 1, 1, OFF // resume from where it was paused
    PauseCue 1, 1, TOGGLE // flip pause state

Safety: T3 - affects live laser output.

Related: `StartCue`, `StopCue`, `RestartCue`.

### RestartCue

Signature: `RestartCue <page>, <cell>`

Reset a running cue's playback time to the beginning. No-op if the cue
is not currently playing. Works on cues in both the Grid and ProTrack
per the Pangolin Wiki. Useful inside an event-driven script where you
want a beat-tap or MIDI hit to reset a running cue without
stopping/starting it.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page. Range matches the
 rest of the cue family. Note: Pangolin's documentation lists this
 parameter as `1..60` for RestartCue specifically, but a runtime probe
 in BEYOND 2030 (10x10 page, all 100 cells populated) confirmed
 `RestartCue 1, 100` is accepted with no parser error and the cue at
 cell 100 restarts - the 1..60 entry is a documentation typo, not a real
 range cap.

Example:

    RestartCue 1, 1

Safety: T3 - affects live laser output (resets cue position).

Related: `StartCue`, `RestartCell`.

### CueDown

Signature: `CueDown <page>, <cell>`

Simulate a mouse-down event ("press" action) on a cue cell. BEYOND's
input manager interprets a real click as down + up, so `CueDown` only
halfway-triggers the cue - pair it with `CueUp` for a full click, or
use it on its own to emulate hold-style cue triggers (e.g. for
momentary grid buttons on a MIDI controller).

The Pangolin Wiki documents an optional `src` argument whose meaning
is not specified.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.

Example:

    CueDown 1, 1
    Sleep 200
    CueUp 1, 1

Safety: T3 - may activate live laser output (depending on configured grid mode).

Related: `CueUp`, `StartCue`, `HoldClick`.

### CueUp

Signature: `CueUp <page>, <cell>`

Simulate a mouse-up event ("release" action) on a cue cell. See
`CueDown` for usage.

The Pangolin Wiki documents an optional `src` argument whose meaning
is not specified.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.

Example:

    CueUp 1, 1

Safety: T3 - may affect live laser output (depending on configured grid mode).

Related: `CueDown`, `StopCue`.

## Bulk cue control

### SelectCue

Signature: `SelectCue "<name>"`

Add a cue to the current cue selection by configured name. Per
BEYOND export comment: "Enter correct Cue name!" - by-name
selection only; the export shows no index-form variant.

Parameters:
- name (string): cue name as configured in BEYOND.

Example:

    SelectCue "Cue01"
    SelectCue "Drop"

Safety: T1 - UI selection state only.

Related: `UnselectAllCue`, `ControlSelCues` (see
[selecting-live-control.md](./selecting-live-control.md#controlselcues)),
`GroupCue`.

### HoldClick

Signature: `HoldClick <state>`

Enable HOLD mode for cue playback, the eighth member of the click-mode
family. BEYOND documentation: "Enable HOLD
mode for Cue playback." documentation example: `HoldClick 1` (Enable
Hold mode for Grid click).

Distinct from the other click-mode setters in that the parameter is
0/1 (enable/disable) rather than a grid index. The documented states
are OFF=0 and ON=1.

Fresh runtime writes on 2026-05-11 sent `HoldClick -1`, `HoldClick 0`,
`HoldClick 1`, `HoldClick 2`, and `HoldClick 999`, then restored with
`HoldClick 0`. `Grid.ClickMode` stayed at 4, and the current Object
Tree exposes no HoldClick or HoldMode property. Other integer values
parse, but their behavior has no readable confirmation path.

Parameters:
- state (integer, 0..1): OFF=0, ON=1.

Example:

    HoldClick 1 // enable hold mode
    HoldClick 0 // disable hold mode

Safety: T2: changes future cue-click behavior (per the `Click*`
family).

Related: `ClickFlash`, `ClickRestart`, `ClickToggle`, `ClickSelect`,
`ClickLive`, `ClickTrack`, `ClickSoloFlash`.

## Cue playback mode

These three commands set how many cues can play at once. Only one
mode is active at a time; the toolbar exposes a single button that
cycles between modes, but each script command sets the mode
explicitly.

### PasteToCue

Signature: `PasteToCue`

Paste clipboard content into a cue. The export shows no parameters;
target cue is presumably the focused cell, and clipboard content
must have been populated by a prior copy operation (UI- or
script-driven).

Example:

    PasteToCue

Safety: T2: modifies the target cue's content.

### SetCueCaptionColor

Signature: `SetCueCaptionColor <page>, <cell>, <packedColor>`

Set the caption background color of an individual cue cell. Per BEYOND export
example: `SetCueCaptionColor 1, 2, 0x0000FF | page 1, cue 2,
color (windows, 24bit color)`. Pages are 1-based, cells are
1-based within the page (same convention as `StartCue`).

**Persists with workspace save** (verified 2026-05-06 by operator
report): script-set caption colors survive workspace save/reload.
Treat this command as a workspace-mutating write: running it in a
production show that touches a shared workspace will permanently
alter the saved caption colors on next save.

The indexed Object Tree target is `WS.N.N.CaptionColor`, where the
first `N` is the zero-based page index and the second `N` is the
zero-based cue index. Focused-cue paths such as
`ActGridFocusedCue.CaptionColor` mirror the currently focused cue
but are not the indexed target path.

Parameters:
- page (integer): 1-based page index. Pages 1 and 2 were writable
 in the lab workspace; page 0 and pages 3, 9, 10, and 11 produced
 no matching `WS` readback change. The maximum page is
 workspace-dependent.
- cell (integer): 1-based cell index within the page. Cells 1, 9,
 10, 11, 60, and 61 wrote to zero-based `WS` cell indices 0, 8,
 9, 10, 59, and 60. Cell 0 produced no matching `WS.0.0`
 readback change. No upper bound was established.
- packedColor (integer): packed 24-bit color in documented GDI RGB
 encoding. Hex literal accepted. BEYOND docs say `0x0000FF` is
 red, `0x00FF00` is green, `0xFF0000` is blue, `0xFFFFFF` is
 white, and `0x000000` is black.

Evidence note: runtime readback confirmed that the supplied integer
is stored at `WS.N.N.CaptionColor` without byte swapping:
`0x000000` read back as `0`, `0x0000FF` as `255`, `0x00FF00` as
`65280`, `0xFF0000` as `16711680`, `0xFFFFFF` as `16777215`, and
`0xFFFFFFFF` as signed `-1`. This proves stored integer behavior and
indexing, not visual byte-channel rendering. Do not treat PangoLint
lint acceptance or Talk UDP transmission as color proof.

Example:

    SetCueCaptionColor 1, 2, 0x0000FF // export example: red caption background per GDI RGB docs
    SetCueCaptionColor 1, 5, 0x00FF00 // green caption on page 1, cell 5
    SetCueCaptionColor 2, 10, 0x808080 // gray caption on page 2, cell 10

Safety: T1: UI annotation only; no laser-output effect.

Related: `CodeColorMarker` (same documented GDI RGB convention),
`SetCueCaptionColor` is **not** related to the routed-color
properties `ColorSlider` / `RGBA` (those affect output color, not
caption appearance).

### StartPrevious

Signature: `StartPrevious`

Start the cue that was most recently started before the current one.
Bound to the toolbar Back button in Grid mode.

Example:

    StartPrevious

Safety: T3 - activates live laser output.

Related: `TogglePrevious`, `StartCue`.

### TogglePrevious

Signature: `TogglePrevious`

Stop the currently-running cue and start the previously-running one.
Bound to the toolbar Swap button in Grid mode.

Example:

    TogglePrevious

Safety: T3 - affects live laser output.

Related: `StartPrevious`, `ToggleCue`.

## Focused-cell operations

These commands act on whichever cell currently has UI focus (the
selection rectangle in the grid). Useful when a script doesn't know the
target cell address ahead of time - e.g. a hotkey-driven script that
operates on whatever the operator has selected.

### UnselectAllCue

Signature: `UnselectAllCue`

Clear the entire cue selection set.

Example:

    UnselectAllCue
    SelectCue "Cue01"
    SelectCue "Cue05"

Safety: T1 - UI selection state only.

Related: `SelectCue`.

## Fixture selection

These three commands manage the operator-visible fixture selection
set. Variadic - accept multiple arguments where each is either a
1-based index or a configured fixture name.
