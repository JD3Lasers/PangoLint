---
category: Main toolbar
order: 4
---
# Main toolbar

Main toolbar commands bind to the mode-selection buttons across the top of the BEYOND workspace. They switch the cue-click mode (Select, Toggle, Restart, Flash, Solo Flash, Live, Track), the multi-cue policy (OneCue, OnePer, MultiCue), and toggle Transition mode. These commands mirror the toolbar button row visible in the BEYOND main window. Cue-click and multi-cue mode setters are T2 because they change how future operator cue actions affect playback, even when the setter itself does not start a cue.

## Commands

Runtime readback maps most click-mode setters to `Grid.ClickMode`
or, when a grid argument of `2` is supplied, `Grid2.ClickMode`:
`ClickSelect` = 1, `ClickFlash` = 2, `ClickSoloFlash` = 3,
`ClickToggle` = 4, `ClickRestart` = 5, and `ClickTrack` = 6.
`ClickLive` did not change `Grid.ClickMode` from a known baseline,
and no LivePRO click-mode state path is exposed in the Object Tree.

### ClickSelect

Signature: `ClickSelect [<grid>]`

Enable "Select" click mode - clicking a cue cell selects it without
starting playback. Useful for building a selection set the operator
will then drive via `ControlSelCues`.

Parameters:
- grid (integer, 1..2, optional): grid number. Omit to apply to the
 default/main grid.

Example:

    ClickSelect
    ClickSelect 2 // apply to secondary grid

Safety: T2 - changes future cue-click behavior.

Related: `ClickToggle`, `SelectCue`, `ControlSelCues`.

### ClickToggle

Signature: `ClickToggle [<grid>]`

Enable "Toggle" click mode - clicking a cue cell toggles its
playback state.

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickToggle

Safety: T2 - changes future cue-click behavior.

Related: `ClickSelect`, `ToggleCue`.

### ClickRestart

Signature: `ClickRestart [<grid>]`

Enable "Restart" click mode - clicking a cue cell restarts the cue
from the beginning.

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickRestart

Safety: T2 - changes future cue-click behavior.

Related: `ClickFlash`, `RestartCue`.

### ClickFlash

Signature: `ClickFlash [<grid>]`

Enable "Flash" click mode - clicking a cue cell plays the cue while
held and stops when released.

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickFlash

Safety: T2 - changes future cue-click behavior.

Related: `ClickSoloFlash`, `HoldClick`.

### ClickSoloFlash

Signature: `ClickSoloFlash [<grid>]`

Enable "SoloFlash" click mode - like Flash, but mutes every other
cue while the held cue plays.

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickSoloFlash

Safety: T2 - changes future cue-click behavior.

Related: `ClickFlash`.

### ClickLive

Signature: `ClickLive [<grid>]`

Enable "Live" click mode. "This button is
currently invisible, but [activates] mode of LivePRO - like tracks."
A LivePRO-style click mode hidden in the current UI.

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickLive

Safety: T2 - changes future cue-click behavior.

Related: `ClickTrack`.

### OneCue

Signature: `OneCue`

Enable "One Cue" mode - only one cue can play at a time across the
workspace. Per Pangolin Wiki (entry 0058): "Multiple cues can remain
active due to parallel DMX, VLJ, and Hold cue processing." So even
in One Cue mode, DMX/VLJ/Hold-flagged cues can persist alongside the
"main" one.

Example:

    OneCue

Safety: T2 - changes global cue playback policy.

Related: `OnePer`, `MultiCue`.

### OnePer

Signature: `OnePer`

Enable "One Per Zone" mode - one cue per projection zone. Per local
documentation: "this mode share the button with OneCue mode."

Example:

    OnePer

Safety: T2 - changes global cue playback policy.

Related: `OneCue`, `MultiCue`.

### MultiCue

Signature: `MultiCue`

Enable "Multi Cue" mode - multiple cues can run concurrently. Per
Pangolin Wiki (entry 0059).

Example:

    MultiCue

Safety: T2 - changes global cue playback policy.

Related: `OneCue`, `OnePer`.

The Object Tree roots named `OneCue` and `MultiCue` expose cue-limit
configuration properties, not the active toolbar policy. PangoLint
therefore classifies `OneCue`, `OnePer`, and `MultiCue` as toolbar
policy actions with no direct active-mode property target.

## Transition

### GroupCue

Signature: `GroupCue`

Group the currently-selected cues into a cue group. The export
shows no parameters; the operation acts on whatever cue selection
set is currently active.

Example:

    UnselectAllCue
    SelectCue "Cue01"
    SelectCue "Cue02"
    GroupCue // groups Cue01 + Cue02

Safety: T2 - modifies cue layout (creates a group); visible in the
grid.

Related: `SelectCue`, `UnselectAllCue`.

### ClickTCTabMode

Signature: `ClickTCTabMode <mode>`

Set the active destination on the Time Control tab. Not documented
in Pangolin Wiki, but follows the same pattern as the LC and FX tab
mode commands.

Parameters:
- mode (integer, 1..4): 1 = Master, 2 = Cue, 3 = Zone, 4 = ProTrack.

Example:

    ClickTCTabMode 3 // Zone mode

Safety: T1 - UI mode change.

Related: `ClickLCTabMode`, `ClickFXTabMode`, `ControlFromTcTab`
(see [selecting-live-control.md](./selecting-live-control.md#controlfromtctab)).

No `TCTab`/`TabMode` routing-state property is exposed in the
Object Tree; this command is classified like the LC/FX tab-mode
commands as UI routing state rather than a direct property setter.

## Transport navigation

### ClickTrack

Signature: `ClickTrack [<grid>]`

Enable "ProTrack" click mode - clicking a cue cell triggers the
associated ProTrack action. "enable ProTrack
click mode."

Parameters:
- grid (integer, 1..2, optional): grid number.

Example:

    ClickTrack

Safety: T2 - changes future cue-click behavior.

Related: `ClickLive`, ProTracks (see [protracks.md](./protracks.md)).
