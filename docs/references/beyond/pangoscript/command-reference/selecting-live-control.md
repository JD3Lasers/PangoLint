---
category: Selecting Live Control
order: 10
---
# Selecting Live Control

Selecting Live Control commands route a cue cell's Live Control parameters to a specific LC tab in the BEYOND workspace. They let a script switch the active Live Control target programmatically, mirroring the LC-tab row selection in the BEYOND Live Control panel.

## Commands

### ControlMaster

Signature: `ControlMaster`

Bind the calling script's Live Control register to the **Master**
LiveControl object. Every following Live Control command flows to
Master until another routing command overrides it.

This is the default routing - interpreters start with Master selected,
so calling `ControlMaster` is mainly useful for *resetting* routing
after a section that targeted a cue or zone.

Example:

    ControlZone 2
    Brightness 50 // affects zone 2
    ControlMaster
    Brightness 100 // back to Master

Safety: T2 - routing only, but downstream Live Control commands take
effect on Master immediately.

PangoLint classifies `Control*` routing commands as no-direct-property:
they change where subsequent Live Control writes land, but the routing
register itself has no stable Object Tree property path.

Related: `ControlCue`, `ControlZone`, `ControlProTrack`.

### ControlCue

Signature: `ControlCue <page>, <cell>`

Bind Live Control routing to a specific cue identified by 1-based
page and cell indices. The cell range matches the grid configuration
 - 1..60 for the default 10x6 grid, up to 1..100 for the 10x10 grid.

Parameters:
- page (integer, 1..N): page index where N is the number of pages
 configured in BEYOND.
- cell (integer, 1..100): cell index. The documentation specifies
 "1..100. By default the grid has 60 cells (10x6 mode). But the
 grid may have another dimension with 100 cells as max." Out-of-range
 indices for the configured grid are no-ops.

Example:

    ControlCue 1, 1
    Brightness 75 // dim cue at page 1, cell 1
    ControlMaster

Safety: T2 - routing only.

No direct property write is recorded for the routing command itself.
Subsequent Live Control commands write to the selected cue target.

Related: `ControlSelCues`, `ControlMaster`, `ControlZone`.

### ControlZone

Signature: `ControlZone <zoneIndex>`
Signature: `ControlZone "<zoneName>"`

Bind Live Control routing to a specific projection zone by 1-based
index or by configured name. String form is convenient when zone
indices change between shows but names are stable.

Parameters:
- zoneIndex (integer, 1..N): 1-based zone index, capped by the
 number of zones configured in BEYOND.
- zoneName (string): zone name as configured in the BEYOND zone list
 (e.g. `"Main Graphics"`).

Example:

    ControlZone 2
    Size 80 // shrink output of zone 2 to 80%
    ControlZone "Main Graphics"
    Size 100 // restore zone "Main Graphics"

Safety: T2 - routing only.

No direct property write is recorded for the routing command itself.
Subsequent Live Control commands write to the selected zone target.

Related: `ControlSelZones`, `SelectZone` (zone selection set, see
[projection-zone.md](./projection-zone.md#selectzone)), `ControlMaster`.

### ControlProTrack

Signature: `ControlProTrack <proTrackIndex>`

Bind Live Control routing to a specific ProTrack. **Hard cap of
1..8 verified at runtime** in BEYOND 2030: `ControlProTrack 9` and
higher are silently dropped (no parser error, no wrap, no
effect - subsequent `Brightness <n>` writes don't land anywhere
readable). BEYOND's UI confirms only 8 ProTrack slots exist (the
ProTrack panel shows tabs ProTrack 1..ProTrack 8 with no
affordance to add more). Maps to `ProTrack.<n-1>.<property>` in
the BEYOND object tree for readback.

Parameters:
- proTrackIndex (integer, 1..8): 1-based ProTrack index. Values
 outside this range are silently no-op'd by BEYOND.

Example:

    ControlProTrack 1
    Brightness 100 // ProTrack 1 brightness = 100%

    ControlProTrack 8
    Brightness 50 // ProTrack 8 brightness = 50%

    ControlProTrack 9 // silently no-op - no ProTrack 9 exists
    Brightness 33 // writes nowhere

Safety: T2 - routing only.

No direct property write is recorded for the routing command itself.
Subsequent Live Control commands write to the selected ProTrack target.

Related: `ControlSelProTracks`, `ControlMaster`.

## Selection-driven routing

These commands fan out a single subsequent Live Control command to
**every member** of BEYOND's current selection set for the named
object type. The selection set is global UI state (see the note in
[selecting-live-control.md](./selecting-live-control.md#selection-driven-routing)) - concurrent scripts can race on
the selected set, so prefer explicit `ControlZone <index>` /
`ControlCue <page>, <cell>` when the target is known and stable.

### ControlSelZones

Signature: `ControlSelZones`

Route Live Control to every currently selected projection zone.
BEYOND fans the next Live Control command out - internally "BEYOND
will send many command, by one for each selected zones."

**Zones-only - does not fan out to selected ProTracks.** The
documentation claims "Also, this command address selected
ProTracks", which is **wrong** for current BEYOND. Verified at
runtime in BEYOND 2030: with both a zone (zone 1) and a ProTrack
(ProTrack 1) in the selection set, `ControlSelZones` followed by
`Brightness 73` set `Zone.0.Brightness` to 73 while leaving
`ProTrack.0.Brightness` unchanged at 100. Use `ControlSelProTracks`
separately when you need to address ProTracks.

Example:

    UnselectAllZones
    SelectZone 1
    SelectZoneName "Main Graphics"
    ControlSelZones
    Brightness 75 // 75% on both zone 1 and "Main Graphics"

Safety: T2 - routing only.

This command routes subsequent writes to the current selected-zone set;
it does not itself write `Zone.N.Selected` or another durable routing
property.

Related: `ControlZone`, `SelectZone` (see [projection-zone.md](./projection-zone.md)),
`ControlSelProTracks`.

### ControlSelCues

Signature: `ControlSelCues`

Route Live Control to every currently selected cue. Per the local
documentation: "The action of command limited to one page only. If BEYOND
in Grid mode, then will be used the page of Main grid. If BEYOND in
Timeline/PlayList mode, then will be used page from bottom side
grid." Cross-page bulk control is not supported through this routing.

Example:

    ControlSelCues
    Brightness 50 // dim every selected cue on the active page

Safety: T2 - routing only.

Related: `ControlCue`, `ControlSelZones`.

### ControlSelProTracks

Signature: `ControlSelProTracks`

Route Live Control to every currently selected ProTrack. Symmetric
counterpart to `ControlSelZones` - verified at runtime to be
**ProTracks-only** (does not fan out to selected zones either).

Example:

    UnselectAllProTracks
    SelectProTrack 1
    ControlSelProTracks
    Brightness 100 // 100% on ProTrack 1 only

Safety: T2 - routing only.

Related: `ControlProTrack`, `ControlSelZones`.

## UI-tab-driven routing

These commands read the destination from a named BEYOND UI tab at
the moment of execution. Useful for scripts whose semantics are
"do whatever the operator is currently looking at" - e.g. a MIDI
button bound to "brighten the thing in front of me."

Because the destination is read from UI state, the same script
produces different effects depending on what the operator has
focused. That's the point, but it also means these commands are
the trickiest to debug after the fact.

### ControlFromLcTab

Signature: `ControlFromLcTab`

Bind Live Control routing to whatever destination is currently
active in BEYOND's Live Control tab (Master / Cue / Zone / ProTrack
button on that tab's toolbar).

Verified at runtime in BEYOND 2030 (LC tab focused on Master): a
`ControlFromLcTab / Brightness 65` write landed on
`Master.Brightness` (and on the co-varying `MasterLC.Brightness`),
matching the destination that `ControlMaster` writes to and
matching the deprecated `ControlFromUI` in the same probe. Confirms
the documented LC-tab destination routing.

Example:

    ControlFromLcTab
    Brightness 80 // affects whichever LC destination the operator picked

Safety: T2 - routing only.

Related: `ControlFromFxTab`, `ControlFromTcTab`, `ControlFromUI`
(deprecated; verified equivalent - see below).

### ControlFromFxTab

Signature: `ControlFromFxTab`

Bind Live Control routing to whatever destination is currently
active in BEYOND's QuickFX (FX) tab.

Example:

    ControlFromFxTab
    FX 0, 0, 0, 0 // stop all FX layers on the QuickFX-selected target

Safety: T2 - routing only.

Related: `ControlFromLcTab`, `ControlFromTcTab`.

### ControlFromTcTab

Signature: `ControlFromTcTab`

Bind Live Control routing to whatever destination is currently
active in BEYOND's Time Control tab.

Example:

    ControlFromTcTab
    Brightness 60

Safety: T2 - routing only.

Related: `ControlFromLcTab`, `ControlFromFxTab`.

## Deprecated

### ControlFromUI

Signature: `ControlFromUI`

**Deprecated.** Per the Pangolin Wiki (entry 1429): "Deprecated
command; newer versions use ControlFromLcTab." The documentation
still lists `ControlFromUI` (line 650) but with no parameters or
purpose, suggesting Pangolin orphaned the entry rather than removed
it.

**Verified observationally equivalent to `ControlFromLcTab`** in
current BEYOND 2030: with the LC tab focused on Master,
`ControlFromUI / Brightness 60` and `ControlFromLcTab / Brightness
65` both wrote to the same destination (Master.Brightness /
MasterLC.Brightness). New scripts should use `ControlFromLcTab`;
PangoLint can safely auto-suggest the rename.

Example:

    ControlFromUI // deprecated; use ControlFromLcTab instead

Safety: T2 - routing only.

Related: `ControlFromLcTab`.

### ControlProjector

See [selecting-live-control.md](./selecting-live-control.md#controlprojector)
for the full entry. Deprecated per Wiki entry 1411: "At some point
of time BEYOND had Live Control in Projectors." Use the routing
commands in this section instead.

Runtime probe 2026-05-11 sent `ControlProjector 0`, `1`, and `4`.
The current Object Tree exposes no projector Live Control route
property, and `Zone.N.Selected` plus `Zone.N.Mute` stayed unchanged.

### GetFxControl

Signature: `GetFxControl`

**Deprecated.** Despite the `Get` prefix, BEYOND documents this
command as equivalent to `ControlFromFxTab`. It binds Live Control
routing to the QuickFX tab's current destination. New scripts
should use `ControlFromFxTab` directly.

Example:

    GetFxControl // deprecated; use ControlFromFxTab instead

Safety: T2 - routing only.

Related: `ControlFromFxTab`.

### GetLiveControl

Signature: `GetLiveControl`

**Deprecated.** Despite the `Get` prefix, BEYOND documents this
command as equivalent to `ControlFromLcTab`. It binds Live Control
routing to the Live Control tab's current destination. New scripts
should use `ControlFromLcTab` directly.

Example:

    GetLiveControl // deprecated; use ControlFromLcTab instead

Safety: T2 - routing only.

Related: `ControlFromLcTab`.

### GetPage

Signature: `GetPage`

**Deprecated.** BEYOND documents this as a legacy stub kept only
so very old scripts do not fail syntax checks. It is not a
supported page query and does not expose current page state. Use
Object Tree page readback paths for page state, or `SetGrid1Page`
and `SetGrid2Page` when changing visible pages.

Example:

    GetPage // deprecated legacy stub; do not use in new scripts

Safety: T0 - read operation, no side effect on output.

Related: `SetPage`, `SetGrid1Page`, `SetGrid2Page` (all in
[universe-page-navigation.md](./universe-page-navigation.md)).

### GetTimeControl

Signature: `GetTimeControl`

**Deprecated.** Despite the `Get` prefix, BEYOND documents this
command as equivalent to `ControlFromTcTab`. It binds Live Control
routing to the Time Control tab's current destination. New scripts
should use `ControlFromTcTab` directly.

Example:

    GetTimeControl // deprecated; use ControlFromTcTab instead

Safety: T2 - routing only.

Related: `ControlFromTcTab`.
