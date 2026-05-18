---
category: Projection Zone - the destination
order: 16
---
# Projection Zone - the destination

Projection Zone commands configure, select, and manipulate BEYOND projection zones - the destination objects that route laser output to physical projectors. Commands cover zone selection, geometry settings, output controls, FB4 hardware parameters, mesh geometry, and zone-level resets. T3-tier commands that activate or route output require operator supervision.

## Commands

### UnselectAllZones

Signature: `UnselectAllZones`

Clear the entire zone selection set.

Example:

    UnselectAllZones
    SelectZone 1
    SelectZone 2

Safety: T1 - UI selection state only.

Related: `SelectZone`.

### StoreZoneSelection

Signature: `StoreZoneSelection`

Save the current zone selection set into the **calling scripter's
local storage**. Use as the start of a "do something with a
different selection, then restore" pattern.

Per Pangolin Wiki: "Since Projection Zones are stored in a global
array, other scripts may modify the zone selection state at the
same time." `StoreZoneSelection` snapshots into per-scripter
storage, so concurrent modifications by other scripts won't
corrupt the saved state - but the **restored** selection from
`ReStoreZoneSelection` only reflects what was selected at the
moment of the store call.

Example:

    StoreZoneSelection
    UnselectAllZones
    SelectZone 5
    MuteSelectedZones
    ReStoreZoneSelection // back to whatever was selected before

Safety: T1 - script-local snapshot.

Runtime probe confirmed this command itself does not write a durable
object property. The later `ReStoreZoneSelection` command writes the
saved selection back to `Zone.N.Selected`.

Related: `ReStoreZoneSelection`.

### ReStoreZoneSelection

Signature: `ReStoreZoneSelection`

Restore the zone selection set previously captured by
`StoreZoneSelection` in the same scripter. No-op if no prior
`StoreZoneSelection` has been called.

Example:

    StoreZoneSelection
    SelectZoneName "Drum Pad"
    StartCue 1, 1
    ReStoreZoneSelection

Safety: T1 - script-local restore.

Runtime readback confirmed the restore writes `Zone.N.Selected` from
the script-local snapshot: after storing a selection containing zone
1, clearing all zones, then calling `ReStoreZoneSelection`,
`Zone.0.Selected` returned to 1.

Related: `StoreZoneSelection`.

## Focus

UI focus is independent of selection - focus is "the current zone
the operator is editing", while selection is "the set of zones bulk
operations act on."

### SelectZone

Signature: `SelectZone <index>`

Add a zone to the current selection by 1-based index. Doesn't
replace the current selection - pair with `UnselectAllZones` first
if you want a clean state.

Parameters:
- index (integer, 1..N): zone index where N is the number of
 configured zones.

Example:

    UnselectAllZones
    SelectZone 1
    SelectZone 2

Safety: T1 - UI selection state only.

Runtime readback confirms zone selection writes `Zone.N.Selected`.
The command argument is 1-based while the Object Tree path is
zero-based: `SelectZone 1` produced `Zone.0.Selected = 1`.

Related: `SelectZoneName`, `UnSelectZone`, `UnselectAllZones`,
`ToggleSelectZone`, `SelectAndFocusZone`.

### UnSelectZone

Signature: `UnSelectZone <index>`

Remove a single zone from the current selection by index. Inverse
of `SelectZone`.

Parameters:
- index (integer, 1..N): zone index.

Example:

    UnSelectZone 1

Safety: T1 - UI selection state only.

Runtime readback confirms this clears `Zone.N.Selected` for the
named zone. In the probe, `UnSelectZone 1` cleared
`Zone.0.Selected`.

Related: `UnSelectZoneName`, `UnselectAllZones`, `SelectZone`.

### ToggleSelectZone

Signature: `ToggleSelectZone <index>`

If the zone is selected, deselect it; if not, select it. Convenient
for MIDI-button-style toggles.

Parameters:
- index (integer, 1..N): zone index.

Example:

    ToggleSelectZone 1

Safety: T1 - UI selection state only.

Runtime readback confirms this toggles `Zone.N.Selected` for the
named zone, using the same 1-based argument convention as
`SelectZone`.

Related: `SelectZone`, `UnSelectZone`.

### MuteSelectedZones

Signature: `MuteSelectedZones <action>`

Set the muted state for every zone in the current selection set.
Convenient for "set up a selection, then bulk-mute" patterns without
having to enumerate zone indices yourself.

Parameters:
- action: mute action. BEYOND examples use `OFF` and `Toggle`; numeric
 `0`, `1`, and `2` mirror related mute commands.

Example:

    UnselectAllZones
    SelectZone 1
    SelectZoneName "Main Graphics"
    MuteSelectedZones Toggle // toggles both zone 1 and "Main Graphics"

Safety: T3 - affects laser output for every selected zone.

This is a selection-driven write to `Zone.N.Mute` and the mirror
`Zone.N.Muted` for every selected zone. Selection membership is
global UI state, so prefer explicit `MuteZone` calls when the target
set is known.

Related: `MuteZone`, `MuteAllZones`, `SelectZone`.

### FocusProjector

Signature: `FocusProjector <index>`

Move UI focus to the named projector index. Make it the
"current" projector for any subsequent operator action that operates
on a single focused target.

Parameters:
- index (integer, 1..configured projector indices): projector index.

Example:

    FocusProjector 1

Safety: T1: UI focus state only.

Runtime probe 2026-05-11 sent `FocusProjector -1`, `0`, `1`,
`3`, and `4`. The current Object Tree exposes no projector focus
property, and `Zone.N.Selected` plus `Zone.N.Mute` stayed unchanged.

Related: `SelectProjector`.

## Projector zone muting

These commands mute all zones assigned to a specific projector. This is a
faster, projector-scoped alternative to muting individual zones one
at a time. Affects laser output for every fixture in the affected
zones, so they're T3.

Runtime probe 2026-05-11 read `Zone.Count = 3` with
`Zone.0.ProjectorIndex = 1`, `Zone.1.ProjectorIndex = 2`, and
`Zone.2.ProjectorIndex = 3`. The projector-scoped mute commands
accepted projector indices 1..3 and left all three zone mute
readbacks unchanged for `-1`, `0`, and `4`. In the same workspace,
`Projector.Count` read 2, so these command ranges are based on
`Zone.N.ProjectorIndex`.

### FocusZone

Signature: `FocusZone <index>`

Move UI focus to a zone by 1-based index - make it the "current"
zone for subsequent operator actions that operate on a single
focused target.

Parameters:
- index (integer, 1..N): zone index.

Example:

    FocusZone 1

Safety: T1 - UI focus state only.

Related: `SelectAndFocusZone`, `SelectZone`.

### MuteAllZones

Signature: `MuteAllZones`

Mute every projection zone. Equivalent to calling `MuteZone` for
each configured zone. Distinct from `BlackOut` - `BlackOut` is a
system-wide reset, while `MuteAllZones` only flips the per-zone
mute flags (faster, doesn't reset internal state).

Example:

    MuteAllZones

Safety: T3 - affects laser output across every zone.

PangoLint maps this to the exposed zone mute properties
`Zone.N.Mute` and `Zone.N.Muted` across configured zones.

Related: `UnmuteAllZone`, `MuteSelectedZones`, `BlackOut`.

### MuteSelected

Signature: `MuteSelected`

Mute the currently-selected set. The export shows no parameters
and does not specify which selection set this targets - companion
commands `MuteSelectedZones` (in
[projection-zone.md](./projection-zone.md#muteselectedzones)) explicitly scope to zones,
suggesting `MuteSelected` may target a different selection set
(cues, fixtures, or "whichever is active"). Behavior is unverified.

Example:

    SelectFixt 1, 2
    MuteSelected

Safety: T3 - affects laser output for the muted set.

Related: `MuteSelectedZones` (zones-scoped, in
[projection-zone.md](./projection-zone.md#muteselectedzones)),
`UnselectAllCue`, `UnselectAllFixt`.

### MuteZone

Signature: `MuteZone <index>`
Signature: `MuteZone "<zoneName>"`

Mute a single zone by index or name. The zone produces no laser
output until unmuted. Per the BEYOND export comment, the command
accepts multiple arguments - `MuteZone 1, 2, 3` mutes three zones
in one call (verify variadic form before relying on it).

Parameters:
- index (integer, 1..N): zone index.
- zoneName (string): zone name as configured in BEYOND.

Example:

    MuteZone 1
    MuteZone "Main Graphics"

Safety: T3 - affects laser output.

Runtime readback confirms the durable targets are `Zone.N.Mute` and
`Zone.N.Muted`. Note the command argument behaved as zero-based in
the probe: `UnmuteZone 0` changed `Zone.0.Mute` from 1 to 0, while
`MuteZone 0` restored it to 1. `MuteZone 1` changed `Zone.1.Mute`.

Related: `UnmuteZone`, `ToggleMuteZone`, `MuteAllZones`,
`MuteSelectedZones`, `MuteZonesOfProjector`.

### MuteZonesOfProjector

Signature: `MuteZonesOfProjector <projectorIndex>`

Mute every zone assigned to the named projector. Equivalent to
calling `MuteZone` for each of the projector's zones.

Parameters:
- projectorIndex (integer, 1..max `Zone.N.ProjectorIndex`): projector index.

Example:

    MuteZonesOfProjector 1 // mute all zones on projector 1

Safety: T3: affects laser output for every fixture in the
projector's zones.

This maps to `Zone.N.Mute` and `Zone.N.Muted` for the zones assigned
to the named projector. Projector membership is dynamic, so the
specific zone indices depend on the workspace configuration. In the
lab probe, `MuteZonesOfProjector 1`, `2`, and `3` muted only
`Zone.0`, `Zone.1`, and `Zone.2` respectively.

Related: `UnMuteZonesOfProjector`, `ToggleMuteZoneOfProjector`,
`MuteZone`, `MuteAllZones`.

### ProjectionZonesDialog

Signature: `ProjectionZonesDialog`

Open the **Projection Zones** configuration dialog. Per Pangolin
Wiki (entry 1493): "Call Projection Zone Settings dialog. Suggested
use - from UMAX, sometimes you may need to give access to zone
adjustments."

Useful for letting an operator configure projection zones from a
custom UMAX surface that doesn't otherwise expose the dialog.

Example:

    ProjectionZonesDialog

Safety: T1 - opens a configuration dialog; UI only.

Related: zone commands (see [projection-zone.md](./projection-zone.md)).

### SelectAndFocusZone

Signature: `SelectAndFocusZone <index>`

Convenience: select the zone (add to selection set) **and** move UI
focus to it in one call.

Parameters:
- index (integer, 1..N): zone index.

Example:

    SelectAndFocusZone 3

Safety: T1 - UI selection + focus state.

Runtime readback confirms the selection half writes
`Zone.N.Selected`: `SelectAndFocusZone 1` selected `Zone.0`.
No separate focus-state property is exposed in the Object Tree
index.

Related: `SelectZone`, `FocusZone`.

## Muting

These commands directly control whether a zone produces laser
output. **All T3** - affects every fixture in the affected zone(s).

### SelectFixt

Signature: `SelectFixt <indexOrName>[, <indexOrName>,...]`

Add one or more fixtures to the current selection by 1-based index
or configured name. Per BEYOND export comment: "index(es) or
name(s)" - mixed integer/string args allowed in one call.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-fixture
 1-based index or configured name.

Example:

    SelectFixt 1
    SelectFixt 1, 2, "Wash Center"

Safety: T1 - UI selection state only.

Related: `UnselectFixt`, `ToggleSelectFixt`, `UnselectAllFixt`.

### SelectProjector

Signature: `SelectProjector <index>`
Signature: `SelectProjector "<name>"`

Select a projector by 1-based index or by its configured name. Adds
the projector to the selection set; doesn't replace it.

Parameters:
- index (integer, 1..configured projector indices): projector index.
- name (string): projector name as configured in BEYOND.

Example:

    SelectProjector 1
    SelectProjector "Stage Left"

Safety: T1: UI selection state only.

Runtime probe 2026-05-11 sent `SelectProjector -1`, `0`, `1`,
`3`, and `4` after `UnselectAllProjectors`. The current Object Tree
exposes zone selection readback, but no reliable projector selection
property; `Zone.N.Selected` stayed 0 in the probe.

Related: `UnselectProjector`, `UnselectAllProjectors`,
`ToggleSelectProjector`, `FocusProjector`.

### SelectZoneName

Signature: `SelectZoneName "<zoneName>"`

Add a zone to the current selection by its configured name (as
shown in the BEYOND zone list). Same selection-set semantics as
`SelectZone`.

Parameters:
- zoneName (string): zone name as configured in BEYOND.

Example:

    SelectZoneName "Main Graphics"

Safety: T1 - UI selection state only.

Related: `SelectZone`, `UnSelectZoneName`.

### SetZoneMeshPointPos

Signature: `SetZoneMeshPointPos <zoneIndex>, <xNodeIndex>, <yNodeIndex>, <xCoord>, <yCoord>`

Reposition a single node in a projection zone's warp grid. Per the
BEYOND export comment: "Zone index, X node index, Y node index, X
coordinate (-32K..32K), y coordinate."

The warp grid for each zone is a 2D lattice - `xNodeIndex` and
`yNodeIndex` identify which node to move. Coordinates are in a
wide ±32 768 range (presumably 16-bit signed for sub-pixel
precision).

Parameters:
- zoneIndex (integer): 1-based projection zone index.
- xNodeIndex (integer): X position in the warp grid lattice.
- yNodeIndex (integer): Y position in the warp grid lattice.
- xCoord (integer, -32768..32767): new X coordinate for the node.
- yCoord (integer, -32768..32767): new Y coordinate for the node.

Example:

    SetZoneMeshPointPos 1, 1, 1, 0, 0 // move zone 1's (1,1) node to origin

Safety: T4 - output geometry/zoning write; affects how content is
mapped to laser output for the named zone.

The Object Tree exposes candidate mesh fields such as
`Zone.N.Mesh.NodeX` and `Zone.N.Mesh.NodeY`, but this command writes
a specific mesh node by two indices. PangoLint keeps the mapping
deferred until a dedicated geometry fixture can read, write, and
restore the exact node target safely.

Related: zone selection (see [projection-zone.md](./projection-zone.md)),
`PreviewZoneGrid` (see [universe-page-navigation.md](./universe-page-navigation.md)).

### ToggleMuteZone

Signature: `ToggleMuteZone <index>`

Toggle the mute state of a single zone. Convenient for
MIDI-button-style on/off control.

Parameters:
- index (integer, 1..N): zone index.

Example:

    ToggleMuteZone 1

Safety: T3 - flips laser-output state for the zone.

Runtime readback maps this family to `Zone.N.Mute` and
`Zone.N.Muted`. See `MuteZone` for the observed zero-based argument
behavior.

Related: `MuteZone`, `UnmuteZone`, `ToggleMuteZoneOfProjector`.

### ToggleMuteZoneOfProjector

Signature: `ToggleMuteZoneOfProjector <projectorIndex>`

Toggle the mute state of all zones assigned to the named projector.
Convenient for MIDI-button-style on/off control of projector output.

Parameters:
- projectorIndex (integer, 1..max `Zone.N.ProjectorIndex`): projector index.

Example:

    ToggleMuteZoneOfProjector 1

Safety: T3: flips laser-output state for every fixture in the
projector's zones.

This maps to `Zone.N.Mute` and `Zone.N.Muted` for zones assigned to
the named projector. The affected zone set depends on projector
membership in the workspace. In the lab probe,
`ToggleMuteZoneOfProjector 1`, `2`, and `3` toggled only `Zone.0`,
`Zone.1`, and `Zone.2` respectively. Inputs `-1`, `0`, and `4`
left those mute readbacks unchanged.

Related: `MuteZonesOfProjector`, `UnMuteZonesOfProjector`.

## Deprecated

### ToggleSelectFixt

Signature: `ToggleSelectFixt <indexOrName>[, <indexOrName>,...]`

Toggle the selected state of one or more fixtures. The export's
example signature shows no parameter, but by analogy with
`ToggleSelectZone` and `ToggleSelectProTrack` the variadic
index-or-name form is the expected shape.

Parameters:
- indexOrName1..N (integer | string, repeatable, inferred):
 per-fixture index or name.

Example:

    ToggleSelectFixt 1
    ToggleSelectFixt "Wash Center"

Safety: T1 - UI selection state only.

Related: `SelectFixt`, `UnselectFixt`.

### ToggleSelectProjector

Signature: `ToggleSelectProjector <index>`
Signature: `ToggleSelectProjector "<name>"`

If the projector is selected, unselect it; if it's not selected,
select it. Convenient for MIDI-button-style toggles.

Parameters:
- index (integer, 1..configured projector indices): projector index.
- name (string): projector name.

Example:

    ToggleSelectProjector 1
    ToggleSelectProjector "Stage Left"

Safety: T1: UI selection state only.

Runtime probe 2026-05-11 sent `ToggleSelectProjector 1` and `3`
after selection setup commands. The current Object Tree exposes no
reliable projector selection property, and `Zone.N.Selected` stayed
0 in the probe.

Related: `SelectProjector`, `UnselectProjector`.

### UnMuteZonesOfProjector

Signature: `UnMuteZonesOfProjector <projectorIndex>`

Inverse of `MuteZonesOfProjector`: unmute every zone assigned to
the named projector.

Parameters:
- projectorIndex (integer, 1..max `Zone.N.ProjectorIndex`): projector index.

Example:

    UnMuteZonesOfProjector 1

Safety: T3: restores laser output for every fixture in the
projector's zones.

This maps to `Zone.N.Mute` and `Zone.N.Muted` for zones assigned to
the named projector. The affected zone set depends on projector
membership in the workspace. In the lab probe,
`UnMuteZonesOfProjector 1`, `2`, and `3` unmuted only `Zone.0`,
`Zone.1`, and `Zone.2` respectively. Inputs `-1`, `0`, and `4`
left those mute readbacks unchanged.

Related: `MuteZonesOfProjector`, `ToggleMuteZoneOfProjector`.

### UnSelectZoneName

Signature: `UnSelectZoneName "<zoneName>"`

Remove a zone from the current selection by name.

Parameters:
- zoneName (string): zone name as configured in BEYOND.

Example:

    UnSelectZoneName "Main Graphics"

Safety: T1 - UI selection state only.

Runtime readback using `Zone.0.Name = "TEST ZONE"` confirmed this
writes `Zone.N.Selected` for the named zone.

Related: `SelectZoneName`, `UnselectAllZones`.

### UnmuteAllZone

Signature: `UnmuteAllZone`

Unmute every projection zone. Note: the BEYOND export's preferred
name uses singular `Zone` at the end, almost certainly a Pangolin
typo (the symmetric command is `MuteAllZones`, plural). PangoScript
is case-insensitive but is not letter-flexible - the preferred
spelling is the one that parses cleanly.

Example:

    UnmuteAllZone // preferred spelling per BEYOND export

Safety: T3 - restores laser output across every zone.

PangoLint maps this to the exposed zone mute properties
`Zone.N.Mute` and `Zone.N.Muted` across configured zones.

Related: `MuteAllZones`.

### UnmuteZone

Signature: `UnmuteZone <index>`
Signature: `UnmuteZone "<zoneName>"`

Unmute a single zone by index or name. Restores laser output for
that zone.

Parameters:
- index (integer, 1..N): zone index.
- zoneName (string): zone name.

Example:

    UnmuteZone 1
    UnmuteZone "Main Graphics"

Safety: T3 - restores laser output.

Runtime readback maps this to `Zone.N.Mute` and `Zone.N.Muted`. See
`MuteZone` for the observed zero-based argument behavior.

Related: `MuteZone`, `ToggleMuteZone`, `UnmuteAllZone`.

### UnselectAllFixt

Signature: `UnselectAllFixt`

Clear the entire fixture selection set.

Example:

    UnselectAllFixt

Safety: T1 - UI selection state only.

Related: `SelectFixt`.

## Bulk operations

These commands act on the currently-selected set rather than naming
a specific target.

### UnselectAllProjectors

Signature: `UnselectAllProjectors`

Clear the entire projector selection set. Convenience for "start
fresh" before building a new selection.

Example:

    UnselectAllProjectors
    SelectProjector 1
    SelectProjector 2

Safety: T1 - UI selection state only.

Related: `SelectProjector`.

### UnselectFixt

Signature: `UnselectFixt <indexOrName>[, <indexOrName>,...]`

Remove one or more fixtures from the current selection. Inverse of
`SelectFixt`.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-fixture
 1-based index or configured name.

Example:

    UnselectFixt 1
    UnselectFixt "Wash Center"

Safety: T1 - UI selection state only.

Related: `SelectFixt`, `UnselectAllFixt`.

### UnselectProjector

Signature: `UnselectProjector <index>`
Signature: `UnselectProjector "<name>"`

Remove a single projector from the current selection. Inverse of
`SelectProjector`.

Parameters:
- index (integer, 1..configured projector indices): projector index.
- name (string): projector name.

Example:

    UnselectProjector 1
    UnselectProjector "Stage Left"

Safety: T1: UI selection state only.

Runtime probe 2026-05-11 sent `UnselectProjector 1` and `3` after
selection setup commands. The current Object Tree exposes no
reliable projector selection property, and `Zone.N.Selected` stayed
0 in the probe.

Related: `SelectProjector`, `UnselectAllProjectors`.
