---
category: ProTracks
order: 21
---
# ProTracks

ProTrack commands configure and control BEYOND's Pro Track system, which maps cue-grid rows to continuous playback tracks with independent speed and looping. Commands cover track assignment, transport (play/stop/seek), and track property values.

## Commands

### SelectProTrack

Signature: `SelectProTrack <indexOrName>[, <indexOrName>,...]`

Add one or more ProTracks to the current selection by 1-based index
or configured name. Per Pangolin Wiki (entry 0121): "Select one or
multiple ProTracks by index or by the name." Accepts mixed forms
(integers and strings) in a single call. Doesn't replace the
selection - pair with `UnselectAllProTracks` first if you want a
clean state.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    UnselectAllProTracks
    SelectProTrack 1
    SelectProTrack "Drums", 3

Safety: T1 - UI selection state only.

Runtime readback confirms this writes `ProTrack.N.Selected`.
`SelectProTrack 1` selected `ProTrack.0` in the zero-based Object
Tree.

Related: `UnselectProTrack`, `UnselectAllProTracks`,
`ToggleSelectProTrack`, `ControlSelProTracks` (see
[selecting-live-control.md](./selecting-live-control.md#controlselprotracks)).

### UnselectProTrack

Signature: `UnselectProTrack <indexOrName>[, <indexOrName>,...]`

Remove one or more ProTracks from the current selection. Inverse of
`SelectProTrack`. Per Pangolin Wiki (entry 0122).

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    UnselectProTrack 1
    UnselectProTrack "Drums"

Safety: T1 - UI selection state only.

Runtime readback confirms this clears `ProTrack.N.Selected` for the
named track.

Related: `SelectProTrack`, `UnselectAllProTracks`.

### ToggleSelectProTrack

Signature: `ToggleSelectProTrack <indexOrName>[, <indexOrName>,...]`

Toggle the selected state of one or more ProTracks. Per Pangolin
Wiki (entry 0123). Convenient for MIDI-button-style toggles.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    ToggleSelectProTrack 1
    ToggleSelectProTrack "Drums"

Safety: T1 - UI selection state only.

Runtime readback maps this to `ProTrack.N.Selected`, matching the
select/unselect family.

Related: `SelectProTrack`, `UnselectProTrack`.

## Focus

### UnselectAllProTracks

Signature: `UnselectAllProTracks`

Clear the entire ProTrack selection set. Per Pangolin Wiki (entry
0120).

Example:

    UnselectAllProTracks
    SelectProTrack 1
    SelectProTrack 2

Safety: T1 - UI selection state only.

Runtime readback confirms this clears `ProTrack.N.Selected` across
the selection set.

Related: `SelectProTrack`.

### MuteAllProTracks

Signature: `MuteAllProTracks`

Mute every ProTrack at once. No counterpart in the wiki, but
symmetric with `UnmuteAllProTracks` (entry 0124).

Example:

    MuteAllProTracks

Safety: T3 - affects laser output across every ProTrack.

Runtime readback confirms this writes `ProTrack.N.Mute`; after
`MuteAllProTracks`, `ProTrack.0.Mute = 1`.

Related: `UnmuteAllProTracks`, `MuteProTrack`.

### UnmuteAllProTracks

Signature: `UnmuteAllProTracks`

Unmute every ProTrack at once. Per Pangolin Wiki (entry 0124):
"Removes the muted state from all ProTracks."

Example:

    UnmuteAllProTracks

Safety: T3 - restores laser output across every ProTrack.

Runtime readback confirms this writes `ProTrack.N.Mute`; after
`UnmuteAllProTracks`, `ProTrack.0.Mute = 0`.

Related: `MuteAllProTracks`.

## Solo

Solo flips the mute on every track *except* the soloed one - the
operator's "I want to hear/see only this" button. Multiple solos
stack (multiple tracks unmuted, everything else muted). Same T3
classification as muting since the laser-output effect is identical.

### MuteProTrack

Signature: `MuteProTrack <indexOrName>[, <indexOrName>,...]`

Mute one or more ProTracks by 1-based index or name. The track
produces no laser output until unmuted. Per Pangolin Wiki (entry
0125): "Mute specified ProTracks."

Verified 1-based at runtime in BEYOND 2030: `MuteProTrack 1` mutes
the first ProTrack (ProTrack.0 in the 0-based property tree),
`MuteProTrack 2` mutes the second, and so on across the family.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    MuteProTrack 1
    MuteProTrack "Drums", 3

Safety: T3 - affects laser output for the named track(s).

Runtime readback maps the family to `ProTrack.N.Mute`.
`MuteProTrack 1` set `ProTrack.0.Mute = 1`.

Related: `UnmuteProTrack`, `ToggleMuteProTrack`, `MuteAllProTracks`,
`SoloProTrack`.

### UnmuteProTrack

Signature: `UnmuteProTrack <indexOrName>[, <indexOrName>,...]`

Unmute one or more ProTracks. Restores laser output for the named
tracks. Per Pangolin Wiki (entry 0126): "Removes the muted state
from specified ProTrack."

Verified 1-based at runtime in BEYOND 2030 - **the Wiki's separate
"Uses 0-based indexing in examples" note for this entry is
incorrect**. `UnmuteProTrack 1` unmutes the same track that
`MuteProTrack 1` muted (ProTrack.0 - the first ProTrack), making
the family uniformly 1-based.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    UnmuteProTrack 1
    UnmuteProTrack "Drums"

Safety: T3 - restores laser output for the named track(s).

Runtime readback maps the family to `ProTrack.N.Mute`.
`UnmuteProTrack 1` restored `ProTrack.0.Mute = 0`.

Related: `MuteProTrack`, `ToggleMuteProTrack`, `UnmuteAllProTracks`.

### ToggleMuteProTrack

Signature: `ToggleMuteProTrack <indexOrName>[, <indexOrName>,...]`

Toggle the mute state of one or more ProTracks. Per Pangolin Wiki
(entry 0127).

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    ToggleMuteProTrack 1
    ToggleMuteProTrack "Drums"

Safety: T3 - flips laser-output state for the named track(s).

PangoLint maps this to `ProTrack.N.Mute`, matching the mute/unmute
family.

Related: `MuteProTrack`, `UnmuteProTrack`.

### UnSoloAllProTrack

Signature: `UnSoloAllProTrack`

Clear the solo flag on every ProTrack. Note: the BEYOND export's
parser-bound name uses singular `Track` at the end, while the
symmetric `UnmuteAllProTracks` uses plural `Tracks`. Almost
certainly a Pangolin typo, preserved here so hover matches the
export.

Example:

    UnSoloAllProTrack // preferred spelling per BEYOND export

Safety: T3 - restores normal mute state across every ProTrack.

Runtime readback via `readBeyondProperty` confirms solo commands
write `ProTrack.N.Solo`. `SoloProTrack 1` changed
`ProTrack.0.Solo` from 0 to 1, `ToggleSoloProTrack 1` changed it
back to 0, and `UnSoloProTrack 1` cleared it after another
`SoloProTrack 1`.

Related: `SoloProTrack`, `UnmuteAllProTracks`.

## Stop and FX reset

### SoloProTrack

Signature: `SoloProTrack <indexOrName>[, <indexOrName>,...]`

Solo one or more ProTracks - mute every other track and unmute the
named one(s).

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    SoloProTrack 1
    SoloProTrack "Drums", "Bass" // solo two tracks

Safety: T3 - affects laser output across every ProTrack (mutes
every non-soloed track).

Runtime readback maps this to `ProTrack.N.Solo`; see
`UnSoloAllProTrack` for the family probe.

Related: `UnSoloProTrack`, `ToggleSoloProTrack`, `UnSoloAllProTrack`.

### UnSoloProTrack

Signature: `UnSoloProTrack <indexOrName>[, <indexOrName>,...]`

Remove the solo flag from one or more ProTracks. If no tracks remain
soloed, normal mute state for the others is restored.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    UnSoloProTrack 1

Safety: T3 - affects laser output for the affected track(s) and
others previously muted by the solo.

Runtime readback maps this to `ProTrack.N.Solo`; see
`UnSoloAllProTrack` for the family probe.

Related: `SoloProTrack`, `UnSoloAllProTrack`.

### ToggleSoloProTrack

Signature: `ToggleSoloProTrack <indexOrName>[, <indexOrName>,...]`

Toggle the solo state of one or more ProTracks.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    ToggleSoloProTrack 1

Safety: T3 - flips solo state.

Runtime readback maps this to `ProTrack.N.Solo`; see
`UnSoloAllProTrack` for the family probe.

Related: `SoloProTrack`, `UnSoloProTrack`.

### StopProTrack

Signature: `StopProTrack <indexOrName>[, <indexOrName>,...]`

Stop playback on one or more ProTracks. The track halts at its
current position; muting state is unaffected.

Parameters:
- indexOrName1..N (integer | string, repeatable): per-track 1-based
 index or configured name.

Example:

    StopProTrack 1
    StopProTrack "Drums", "Bass"

Safety: T3 - visible playback stop on the named track(s).

No ProTrack transport-position or stopped-state property is exposed
in the bundled Object Tree index. PangoLint classifies this as a
transport action rather than a direct property setter.

Related: `MuteProTrack`, `StopProTrackFX`.

### StopProTrackFX

Signature: `StopProTrackFX [<indexOrName>[, <fxLine>,...]]`

Stop FX layers on a ProTrack. Per the BEYOND export comment: "Track
index/name and FX line index(es). Counting from 1. If no arguments
at all - stop all FX on all tracks." The "stop everything" form
makes this a useful one-shot reset.

Parameters:
- indexOrName (integer | string, optional): track index or name.
 Omit to stop all FX on all tracks. String-name dispatch and
 out-of-range track behavior are unverified in this slice.
- fxLine1..N (integer, optional, repeatable): FX line index on the
 named track. Counting starts at 1; upper bound and out-of-range
 behavior are unverified.

Probe note 2026-05-11:
- `ProTrack.0.CueIndex` read back `-1` in this lab state, so no
 loaded track FX state could be inspected or restored.
- Representative forms `StopProTrackFX 1, 1`,
 `StopProTrackFX 1, 1, 2`, and `StopProTrackFX 1, 99` were
 transmitted against inactive content.
- No durable ProTrack FX stop state or transport-position readback
 property was found, so accepted FX-line bounds remain unverified.

Example:

    StopProTrackFX // stop all FX on every track
    StopProTrackFX 1, 1 // stop FX line 1 on track 1
    StopProTrackFX "Drums", 1, 2, 3 // stop FX lines 1-3 on "Drums"

Safety: T3: visible FX-output change.

No durable ProTrack FX stop property was identified. PangoLint
classifies this as a runtime FX stop action rather than a direct
write to `ProTrack.N.FX*` properties.

Related: `ResetProTrackFX`, `StopProTrack`.

### FocusProTrack

Signature: `FocusProTrack <indexOrName>`

Move UI focus to a single ProTrack - make it the "current" track for
operator actions that operate on a focused target. Distinct from
selection (selection is a set; focus is one).

Parameters:
- indexOrName (integer | string): 1-based index or configured name.

Example:

    FocusProTrack 1
    FocusProTrack "Drums"

Safety: T1 - UI focus state only.

No ProTrack focus-state property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `SelectProTrack`, `ControlProTrack` (see
[selecting-live-control.md](./selecting-live-control.md#controlprotrack)).

## Muting

These commands directly control whether each named ProTrack produces
laser output. **All T3** - affects every fixture in the affected
track(s)' assigned zones.

### SetProTrackZones

Signature: `SetProTrackZones <indexOrName>, <zoneIndexOrName>[, <zoneIndexOrName>,...]`

Assign which zones a ProTrack outputs to. Per the BEYOND export
comment: "Track index/name, Zone name(es)/index(es)." Reconfigures
the track's output routing - every fixture in the named zones will
play this track's content.

Parameters:
- indexOrName (integer | string): track 1-based index or configured
 name.
- zoneIndexOrName1..N (integer | string, repeatable): per-zone
 1-based index or configured name.

Example:

    SetProTrackZones 1, 1 // route track 1 to zone 1
    SetProTrackZones "Drums", "Main", "FX" // route "Drums" to two zones

Safety: T3 - reconfigures zone routing; affects which fixtures
receive the track's output.

The durable Object Tree target for this routing set is
`ProTrack.N.Zones`. PangoLint maps the command there, but the exact
stored encoding of multiple zone names/indices still depends on the
workspace configuration.

Related: `SelectZone` (see [projection-zone.md](./projection-zone.md#selectzone)),
`ControlProTrack`.

### InvertProTrackTime

Signature: `InvertProTrackTime`

Invert (reverse) the time direction on the currently focused/selected
ProTrack. Useful for backwards-playback effects. Takes no parameters
in the export.

Example:

    FocusProTrack 1
    InvertProTrackTime

Safety: T3 - visible playback-direction change.

No ProTrack direction/invert property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackDisk`, `ProTrackSetLoop`.

## Zone assignment

### ProTrackDisk

Signature: `ProTrackDisk <indexOrName>, <position>`

Set the playback "disk" position for a ProTrack. The position is a
fractional time-shift value (per the export's example
`ProTrackDisk 1, 0.1`). Bounds and clamp behavior are not readable
through the current Object Tree surface.

Parameters:
- indexOrName (integer | string): track 1-based index or configured
 name. String-name dispatch was not runtime-confirmed in this slice.
- position (number): fractional disk position. The export example is
 `0.1`; accepted bounds are unverified.

Probe note 2026-05-11:
- No ProTrack disk or transport-position readback path was found.
- `ProTrack.0.CueIndex` read back `-1` in this lab state, so no
 loaded track position could be inspected or restored.
- Representative values `0`, `0.1`, and `1` were transmitted, but
 this does not prove BEYOND accepted them as valid range values or
 reveal clamp behavior.

Example:

    ProTrackDisk 1, 0.1

Safety: T3: visible playback-position change.

No ProTrack disk/position property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackDiskShift`, `ProTrackSetJump`.

### ProTrackDiskShift

Signature: `ProTrackDiskShift <delta>`

Relative version of `ProTrackDisk`: shift the disk position by
`delta`. The BEYOND export exposes a single delta argument and gives
`ProTrackDiskShift 0.1` as the example.

Parameters:
- delta (number): fractional disk-position delta. Units match
 `ProTrackDisk`; accepted bounds are unverified.

Probe note 2026-05-11:
- No ProTrack disk or transport-position readback path was found.
- `ProTrack.0.CueIndex` read back `-1` in this lab state, so no
 loaded track position could be inspected or restored.
- Representative values `0.1` and `-0.1` were transmitted, but this
 does not prove BEYOND accepted them as valid range values or reveal
 clamp behavior.

Example:

    ProTrackDiskShift 0.1

Safety: T3: visible playback-position change.

No ProTrack disk/position property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackDisk`.

### ProTrackResetJump

Signature: `ProTrackResetJump`

Clear the playback jump point set by `ProTrackSetJump`.

Example:

    ProTrackResetJump

Safety: T2 - clears the marker.

No ProTrack jump-marker property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackSetJump`.

### ProTrackSetJump

Signature: `ProTrackSetJump`

Set the playback jump point on the currently focused/selected
ProTrack - operator marker for "jump back here." The export shows no
parameters, suggesting it operates implicitly on UI focus state.

Example:

    FocusProTrack 1
    ProTrackSetJump

Safety: T2 - sets a marker; doesn't change current playback.

No ProTrack jump-marker property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackResetJump`, `ProTrackSetLoop`.

### ProTrackSetLoop

Signature: `ProTrackSetLoop`

Set the loop region on the currently focused/selected ProTrack. Like
`ProTrackSetJump`, takes no parameters in the export - operates on
implicit UI state.

Example:

    FocusProTrack 1
    ProTrackSetLoop

Safety: T2 - defines loop region; downstream playback will repeat.

No ProTrack loop-region property is exposed in the Object Tree
index. PangoLint classifies this as no-direct-property.

Related: `ProTrackSetJump`, `InvertProTrackTime`.

### StartTvMode

Signature: `StartTvMode <fps>`

Enable TV broadcast output mode at a specified frame rate. Per
BEYOND export comment: `StartTvMode 30 | 30 FPS`. The example uses
30 (NTSC); 25 (PAL) is the other common broadcast rate.

TV mode reconfigures the output pipeline for fixed-rate frame
generation suitable for video capture, recording, or live
streaming. The exact internal effect (output buffering, scanner
timing alignment, capture-friendly framing) is unverified.

Parameters:
- fps (integer): broadcast frame rate. Common values: `30` (NTSC),
 `25` (PAL). Other values' acceptance and clamp behavior are
 unverified.

Probe note 2026-05-11:
- No TV-mode state or fps readback path was found.
- Representative values `24`, `25`, `30`, `60`, `0`, and `1000`
 were transmitted with `StopTvMode` cleanup after each start, but
 this does not prove BEYOND accepted them as valid fps values or
 reveal clamp behavior.

Example:

    StartTvMode 30 // NTSC broadcast (export example)
    StartTvMode 25 // PAL broadcast

Safety: T2: switches output pipeline mode; visible rendering
change.

No TV-mode state property is exposed in the Object Tree index.
PangoLint classifies this as no-direct-property.

Related: `StopTvMode`, `LinePerCycle`.

### StopTvMode

Signature: `StopTvMode`

Disable TV broadcast output mode and return to BEYOND's normal
output pipeline. Per BEYOND export: zero arguments. Restores
whatever rendering mode was active before `StartTvMode` was called.

Whether the prior frame rate / pipeline state is precisely
restored or whether `StopTvMode` resets to a hard default is
unverified.

Example:

    StopTvMode // exit broadcast mode

Safety: T2: switches output pipeline mode; visible rendering
change.

No TV-mode state property is exposed in the Object Tree index.
PangoLint classifies this as no-direct-property.

Related: `StartTvMode`.

### SynchronizePlayerToBeat

Signature: `SynchronizePlayerToBeat <state>`

Enable, disable, or toggle player-to-beat synchronization. When
enabled, the master player's playback time aligns to incoming beat
events (typically snapping to the next beat boundary on
`TimerBeat` / `AudioBeat` / `ManualBeat`).

Per BEYOND export comment: `SynchronizePlayerToBeat On | options:
On, Off, Toggle`. Exact alignment behavior - snap-to-next-beat,
phase-lock, or some other mode - is unverified.

Parameters:
- state (integer, 0..2): `0` = OFF, `1` = ON, `2` = TOGGLE.
 Symbolic tokens `On` / `Off` / `Toggle` also accepted
 (case-insensitive).

Example:

    SynchronizePlayerToBeat On // enable (export example)
    SynchronizePlayerToBeat Off // disable
    SynchronizePlayerToBeat Toggle // flip
    SynchronizePlayerToBeat 1 // numeric equivalent of On

Safety: T2 - changes how subsequent beat events affect player
time.

No player-to-beat synchronization state property is exposed in the
Object Tree index. PangoLint classifies this as no-direct-property.

Related: `BeatResync` (one-shot beat resync - see
[beat-timer.md](./beat-timer.md)), `ResyncByCueClick` (in
[live-control.md](./live-control.md)).
