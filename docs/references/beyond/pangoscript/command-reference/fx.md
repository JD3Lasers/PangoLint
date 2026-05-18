---
category: FX
order: 14
---
# FX

FX commands control the effect slots in the BEYOND FX tab: load, shift, toggle, drop, stop, set FX action buttons, mute, and time-scale. They also cover per-zone FX timing and the master FX speed control. The FX tab is accessible in the BEYOND workspace toolbar.

## Commands

### ClickFXTabMode

Signature: `ClickFXTabMode <mode>`

Set the active destination on the QuickFX tab. Per Pangolin Wiki
(entry 0099).

Parameters:
- mode (integer, 1..4): 1 = Master, 2 = Cue, 3 = Zone, 4 = ProTrack.

Example:

    ClickFXTabMode 1 // Master mode

Safety: T1 - UI mode change.

Related: `ClickLCTabMode`, `ClickTCTabMode`, `ControlFromFxTab`
(see [selecting-live-control.md](./selecting-live-control.md#controlfromfxtab)).

### FX

Signature: `FX <index1>[, <index2>,...]`

Set the effect index for each FX layer in one call, left to right.
`0` stops a layer; `1..100` selects an effect from the QuickFX
grid. Pangolin Wiki (entry 0081) describes this as "Set Effect
index for FX layers."

The number of arguments can be less than the layer count - only the
named layers are updated. To set a single layer use `SetFX`.

Runtime readback in BEYOND 2030 confirms the durable assignment
surface exposed through object properties is `Master.FX1..FX6`.
Inputs are stored zero-based relative to the one-based effect number:
`FX 2, 3` produced `Master.FX1 = 1` and `Master.FX2 = 2`.
`Master.FX7` and `Master.FX8` exist in the object tree but did not
behave as persistent assignment slots in the probe.

Parameters:
- index1..N (integer, 0..100): per-layer effect index. `0` = stop;
 `1..100` = effect index in the QuickFX grid.

Example:

    FX 0, 0, 0, 0 // stop the first four layers
    FX 10 // set layer 1 to effect 10
    FX 2, 3, 4, 5 // layers 1..4 to effects 2/3/4/5

Safety: T2 - visible effect change on the routed Live Control object.

Related: `SetFX`, `ShiftFX`, `ToggleFX`, `StopFX`, `DropFX`.

### SetFX

Signature: `SetFX <layer>, <effectIndex>[, <effectIndex>,...]`

Set one layer's effect, optionally activating multiple effects in
that layer. "If EffectIndex is not defined,
then command will stop the layer. If there are multiple Effectindex
then command will activate multiple effects in this layer."

Parameters:
- layer (integer, 1..8): FX layer index.
- effectIndex (integer, 1..100, optional, repeatable): effect index
 to activate. Omit to stop the layer.

Example:

    SetFX 1, 1 // layer 1, effect 1
    SetFX 2, 5, 6, 7 // layer 2, multi-effect

Safety: T2 - visible effect change.

Related: `FX`, `ShiftFX`, `StopFX`.

### StopFX

Signature: `StopFX [<layer1>[, <layer2>,...]]`

Stop one or more FX layers on the currently routed Live Control.
Equivalent to setting their effect index to 0. Per Pangolin Wiki
(entry 0159): "Stop/reset FX of current Live Control."

Parameters:
- layer1..N (integer, 1..8, optional): per-layer index. With no
 arguments, stops all layers on the routed destination.

Example:

    StopFX // stop all layers
    StopFX 1, 2 // stop layers 1 and 2

Safety: T2 - visible effect change.

Runtime readback indicates this is not the same as clearing the
persistent `Master.FX<n>` assignment fields: after `FX 2, 3`,
`StopFX 1, 2` left `Master.FX1 = 1` and `Master.FX2 = 2`
unchanged. Treat it as a runtime stop action rather than a durable
property setter.

Related: `FX 0, 0,...`, `SetFX <layer>` (no effect index),
`ResetFxTiming`.

### StopFxCell

Signature: `StopFxCell <layer>[, <cellIndex>]`

Stop a specific cell within a layer. The cell index is **relative**
 - it accounts for the QuickFX grid's scrollbar position, so cell 1
means "the leftmost visible cell" not "the first effect in the
table." Use `FXCellClick` semantics to predict which absolute effect
is targeted.

Parameters:
- layer (integer, 1..8): FX layer index.
- cellIndex (integer, optional): scrollbar-relative cell index. Omit
 to stop the layer.

Example:

    StopFxCell 1, 1 // stop layer 1's leftmost visible cell

Safety: T2 - visible effect change.

Related: `StopFX`, `FXCellClick`.

## Layer action (morph)

"Action" is the morph factor between the unaffected frame and the
post-effect frame, expressed as 0..100 percent. **0 is not the same
as stopping the effect** - the effect still runs, it just doesn't
visibly modify the frame. "Action parameter
is not same as 'stop' effect. It relatively slow operation because
of calculation of morph, extra buffers, and relating calculations."

### ToggleFX

Signature: `ToggleFX [<layer>]`

Toggle FX playback. Per Pangolin Wiki (entry 0097): "If layer not
specified than toggle all 8 layers." Also documented in the local
documentation as "Toggle between internal LC register and current state."

Parameters:
- layer (integer, 1..8, optional): FX layer index. Omit to toggle
 all 8 layers.

Example:

    ToggleFX 1 // toggle layer 1
    ToggleFX // toggle all layers

Safety: T2 - visible effect change.

Runtime probe `ToggleFX 1` left `Master.FX1Mute` unchanged, so
PangoLint classifies this as a runtime toggle action rather than a
direct write to the exposed mute properties. Use `SetFXMute` when a
script needs an explicit `Master.FX<n>Mute` setter.

Related: `FX`, `SetFXMute`.

### ShiftFX

Signature: `ShiftFX <layer>, <delta>`

Relative version of `SetFX` - shift the current effect index for a
layer by `delta`. Negative shifts move backward.

Parameters:
- layer (integer, 1..8): FX layer index.
- delta (integer): how to shift the current effect index. Negative
 for backward.

Example:

    ShiftFX 1, 1 // layer 1: next effect
    ShiftFX 1, -1 // layer 1: previous effect

Safety: T2 - visible effect change.

Related: `SetFX`, `FX`.

### SetFXAction

Signature: `SetFXAction <layer>, <action>`

Set the action value for one layer. **Layer range 1..8 verified at
runtime** in BEYOND 2030 - refutes the BEYOND export comment's
1..4 claim. Probe: `SetFXAction 4, 0.30 / 5, 0.50 / 8, 0.80` all
landed on the corresponding `Master.FX<n>Action` property;
`SetFXAction 9, 0.99` was silently dropped.

Parameters:
- layer (integer, 1..8): FX layer index. Out-of-range values are
 silently no-op'd by BEYOND.
- action (integer, 0..100): morph percent.

Example:

    SetFXAction 1, 100 // layer 1 to full effect
    SetFXAction 8, 50 // layer 8 (top of range) to half

Safety: T2 - visible blend change.

Related: `FXAction`, `SetFXAction1`–`SetFXAction8`.

### FXAction

Signature: `FXAction <action1>[, <action2>,...]`

Set the action (morph) value for each FX layer in one call, left to
right. Same variadic semantics as `FX` - fewer arguments means only
the named layers are updated.

Parameters:
- action1..N (integer, 0..100): per-layer action percent. 0 = effect
 computed but not blended; 100 = full effect output.

Example:

    FXAction 0, 0, 0, 0 // disable morph for first four layers
    FXAction 100, 50 // layer 1 full, layer 2 half

Safety: T2 - visible blend change.

Runtime readback confirms the variadic form writes the action
properties left to right: `FXAction 12, 34` produced
`Master.FX1Action = 12` and `Master.FX2Action = 34`.

Related: `SetFXAction`, `SetFXAction1`–`SetFXAction8`.

### ZoneFXTimeScale

Signature: `ZoneFXTimeScale <layer>, <clockMul>, <metroMul>`

**Deprecated** per Pangolin Wiki - use `FXTimeScaleAx` after routing
to the zone with `ControlZone`.

Parameters:
- layer (integer): FX layer index, observed range `1..8`.
 Layers `0` and `9` no-op against the checked FX1/FX8 endpoints.
- clockMul, metroMul (integer): historical clock and metronome
 multipliers. `0`, `2`, and `4` read back as written; upper bound
 was not identified.

Example:

    ZoneFXTimeScale 1, 2, 1 // deprecated; use FXTimeScaleAx

Safety: T2 - visible speed change.

Runtime readback in BEYOND 2030 showed this legacy command writes
the same master Live Control timing properties as the newer
`FXTimeScaleAx` family: `ZoneFXTimeScale 1, 6, 7` produced
`Master.FX1TimeScaleClock = 6` and
`Master.FX1TimeScaleMetro = 7`, while `Zone.0.FX1TimeScale*`
remained unchanged.

Runtime range probe on 2026-05-11 confirmed layer `1` writes
`Master.FX1TimeScale*`, layer `8` writes `Master.FX8TimeScale*`,
and layers `0` and `9` leave the checked endpoints unchanged.

Related: `FXTimeScaleAx`.

### FXTimeScaleAx

Signature: `FXTimeScaleAx <layer>, <mask>, <multiplier>`

Set the time scale (multiplier) for an FX layer's clock and/or
metronome. Per Pangolin Wiki (entry 0119): "Defines the scale
(multiplier) for incoming time."

Parameters:
- layer (integer, 1..8): FX layer index.
- mask (integer, 1..3): 1 = clock, 2 = beat, 3 = both.
- multiplier (integer): scale multiplier (e.g. `2` doubles the
 speed, `1` is unchanged). Pangolin's example shows integer 0..100
 but the type is best treated as numeric without a strict range.

Example:

    FXTimeScaleAx 1, 3, 2 // layer 1, both clock and beat at 2x

Safety: T2 - visible speed change.

Runtime readback confirms mask 1 writes `Master.FX<n>TimeScaleClock`
and mask 2 writes `Master.FX<n>TimeScaleMetro`. For example,
`FXTimeScaleAx 1, 1, 6` produced `Master.FX1TimeScaleClock = 6`,
and `FXTimeScaleAx 1, 2, 7` produced
`Master.FX1TimeScaleMetro = 7`.

Related: `FXTimeScaleDeltaAx`, `FXTimeScaleAxReset`, `FXTimeSync`.

### FXTimeScaleAxReset

Signature: `FXTimeScaleAxReset <layer>, <mask>`

Reset the time scale for one layer's named mask back to default
(1.0×). Per Pangolin Wiki (entry 0118).

Parameters:
- layer (integer, 1..8): FX layer index.
- mask (integer, 1..3): 1 = clock, 2 = beat, 3 = both.

Example:

    FXTimeScaleAxReset 1, 3 // layer 1 reset both

Safety: T2 - visible speed change.

Runtime readback confirms this resets the selected time-scale axes
to `1`: after setting layer 1 clock/beat scales to non-defaults,
`FXTimeScaleAxReset 1, 3` restored
`Master.FX1TimeScaleClock = 1` and
`Master.FX1TimeScaleMetro = 1`.

Related: `FXTimeScaleAx`, `ResetFxTiming`.

### FXTimeSync

Signature: `FXTimeSync <layer>, <source>`

Set the time source for an FX layer. Per Pangolin Wiki (entry 0196):
"resets the time calculation for an FX layer to default state."
Determines whether the layer follows master time or its own
independent time.

Parameters:
- layer (integer, 1..8): FX layer index.
- source (integer, 1..2): 1 = Master, 2 = Own time.

Example:

    FXTimeSync 1, 1 // layer 1 follows master

Safety: T2 - affects timing behavior.

Runtime readback showed `FXTimeSync 1, 1` reset
`Master.FX1TimeMulClock`, `Master.FX1TimeMulMetro`,
`Master.FX1TimeScaleClock`, and `Master.FX1TimeScaleMetro` to `1`
after they had been set to non-default values. The actual
master/own-time source state is not exposed in the current Object
Tree index, so PangoLint keeps this command deferred instead of
publishing a partial `setsProperty` list.

Related: `FXTimeScaleAx`, `ResetFxTiming`.

### ZoneFXTimeScaleDelta

Signature: `ZoneFXTimeScaleDelta <layer>, <clockDelta>, <metroDelta>`

**Deprecated** per Pangolin Wiki - use `FXTimeScaleDeltaAx`.

Parameters:
- layer (integer): FX layer index.
- clockDelta, metroDelta (integer): historical relative deltas.

Example:

    ZoneFXTimeScaleDelta 0, 0, 0, 0 // deprecated

Safety: T2 - visible speed change.

Runtime probe `ZoneFXTimeScaleDelta 1, 2, 3` left
`Master.FX1TimeScaleClock/Metro` unchanged after
`ZoneFXTimeScale` had set them to `6/7`. PangoLint therefore
classifies this deprecated delta command as no-direct-property until
a different current-build write target is observed.

Runtime range probe on 2026-05-11 repeated the delta command at
layers `0`, `1`, `8`, and `9`. The checked `Master.FX1TimeScale*`
and `Master.FX8TimeScale*` endpoints remained unchanged.

Related: `FXTimeScaleDeltaAx`.

### ZoneFXTimeShift

Signature: `ZoneFXTimeShift <layer>, <clockMul>, <metroMul>`

**Deprecated** per Pangolin Wiki - use `FXTimeScaleAx`. The
underlying `FXTimeShift` family is no longer listed with the current
general command set; only the zone-scoped historical entries remain.

Parameters:
- layer (integer): FX layer index, observed range `1..8`.
 Layers `0` and `9` no-op against the checked FX1/FX8 endpoints.
- clockMul, metroMul (integer): historical shift values. `0`, `2`,
 and `4` read back as written; negative and upper bounds were not
 identified.

Example:

    ZoneFXTimeShift 1, 2, 1 // deprecated

Safety: T2 - visible timing change.

Runtime readback in BEYOND 2030 showed this legacy command writes
the master time-shift properties: `ZoneFXTimeShift 1, 2, 3`
produced `Master.FX1TimeShiftClock = 2` and
`Master.FX1TimeShiftMetro = 3`. The probe was restored with
`ZoneFXTimeShift 1, 0, 0`.

Runtime range probe on 2026-05-11 confirmed layer `1` writes
`Master.FX1TimeShift*`, layer `8` writes `Master.FX8TimeShift*`,
and layers `0` and `9` leave the checked endpoints unchanged.

Related: `FXTimeScaleAx`.

### ZoneFXTimeShiftDelta

Signature: `ZoneFXTimeShiftDelta <layer>, <clockDelta>, <metroDelta>`

**Deprecated** per Pangolin Wiki - use `FXTimeScaleDeltaAx`.

Parameters:
- layer (integer): FX layer index.
- clockDelta, metroDelta (integer): historical relative deltas.

Example:

    ZoneFXTimeShiftDelta 0, 0, 0, 0 // deprecated

Safety: T2 - visible timing change.

Runtime probe `ZoneFXTimeShiftDelta 1, 4, 5` left
`Master.FX1TimeShiftClock/Metro` unchanged after
`ZoneFXTimeShift` had set them to `2/3`. PangoLint therefore
classifies this deprecated delta command as no-direct-property until
a different current-build write target is observed.

Runtime range probe on 2026-05-11 repeated the delta command at
layers `0`, `1`, `8`, and `9`. The checked `Master.FX1TimeShift*`
and `Master.FX8TimeShift*` endpoints remained unchanged.

Related: `FXTimeScaleDeltaAx`.

### FXClick

Signature: `FXClick <layer>, <effectIndex>`

Click the effect cell at the given layer and **absolute** effect
index (1..N), regardless of QuickFX grid scroll position.

Parameters:
- layer (integer, 1..8): FX layer index.
- effectIndex (integer, 1..N): absolute effect index in the QuickFX
 table.

Example:

    FXClick 1, 5 // click layer 1, effect 5 (absolute)

Safety: T2 - UI-mediated effect change.

Runtime probes of `FXClick 1, 3`, `FXCellClick 1, 1`, and
`FXCellDown 1, 1` left `Master.FX1` unchanged. These commands are
classified as UI grid click actions, not stable object-property
setters. Use `FX` or `SetFX` for a persistent assignment.

Related: `FXCellClick`, `FXCellDown`, `SetFX`.

### FXCellClick

Signature: `FXCellClick <layer>, <cellIndex>`

Click the cell at the given layer and **relative** cell index - the
cell index is computed from the QuickFX grid's left visible edge,
respecting the current scroll position. Use `FXClick` for absolute
addressing.

Parameters:
- layer (integer, 1..8): FX layer index.
- cellIndex (integer): visible-grid cell index (1 = leftmost
 visible cell).

Example:

    FXCellClick 1, 1 // click leftmost visible cell on layer 1

Safety: T2 - UI-mediated effect change.

Related: `FXClick`, `FXCellDown`, `FXScroll`.

### FXScroll

Signature: `FXScroll <baseIndex>`

Set the QuickFX grid scrollbar's left-edge position. `0` is the
default state (effect 1 at the left).

Parameters:
- baseIndex (integer): left-edge effect index. `0` = leftmost.
 Range evidence is unverified because no direct readback path
 exposes the scroll position. Representative writes for `0`, `4`,
 and `999` transmitted without PangoLint errors.

Example:

    FXScroll 0 // reset to default scroll position
    FXScroll 8 // shift right so effect 9 is leftmost

Safety: T2 - UI scroll only; affects which cells `FXCellClick`
targets.

No QuickFX scroll/base-index property is exposed in the current
Object Tree index. PangoLint therefore classifies `FXScroll` and
`FXScrollDelta` as UI scroll state, not direct property setters.

Related: `FXScrollDelta`, `FXCellClick`.

### FXScrollDelta

Signature: `FXScrollDelta <delta>`

Relative version of `FXScroll`. Shift the scrollbar by `delta`.

Parameters:
- delta (integer): shift amount (positive = right, negative = left).
 Range evidence is unverified because no direct readback path
 exposes the scroll position. Representative writes for `-999`,
 `-1`, `1`, and `999` transmitted without PangoLint errors.

Example:

    FXScrollDelta 8 // shift right by 8 cells

Safety: T2 - UI scroll only.

Related: `FXScroll`.

## Global FX speed

These commands set show-wide FX speed multipliers - they do not
depend on Live Control routing and apply across every cue/zone/master.
The Pangolin Wiki classifies them as **cgMain** (legacy
zone-specific implementations).

### ClickFXStopAll

Signature: `ClickFXStopAll`

Mirror of the **Stop All** button on the QuickFX tab. Per Pangolin
Wiki (entry 0134): combines `StopFX` and FX-VLJ actions in one
toolbar press.

Example:

    ClickFXStopAll

Safety: T2 - stops all FX layers across the routed destination.

Runtime readback confirms `ClickFXStopAll` clears the exposed
persistent assignment fields: after `FX` populated `Master.FX1` and
`Master.FX6`, `ClickFXStopAll` reset them to `-1`. It may also
perform additional runtime/UI stop actions, but the durable property
surface PangoLint maps is `Master.FX1..FX6`.

Related: `StopFX` (see [fx.md](./fx.md#stopfx)),
`VLJFX`.

### ClickFxVlj

Signature: `ClickFxVlj <line>[, <state>]`

Mirror of the FX-VLJ buttons in the QuickFX tab. Per Pangolin Wiki
(entry 0135).

Parameters:
- line (integer): FX-VLJ button index.
- state (integer | constant, 0..2, optional): 0 = disable,
 1 = enable, 2 = toggle. Omit for default toggle behavior.

Example:

    ClickFxVlj 1
    ClickFxVlj 1, Toggle

Safety: T2 - affects FX-VLJ state.

Related: `VLJFX`, `VirtualLJ`.

### DropFX

Signature: `DropFX <layer>, <effectIndex>, <durationMs>`

Run an effect on a layer as a temporary "drop" for `durationMs`,
then return the layer to its previous state. Pangolin Wiki (entry
0084): "Runs an effect from the FX table as a 'drop effect' for
specified duration."

Parameters:
- layer (integer, 1..8): FX layer index.
- effectIndex (integer, 1..100): effect index to drop.
- durationMs (integer): drop duration in milliseconds.

Example:

    DropFX 1, 5, 1000 // run effect 5 on layer 1 for 1 second

Safety: T2 - visible effect change for the duration.

Related: `FX`, `SetFX`.

### FXCellDown

Signature: `FXCellDown <layer>, <cellIndex>`

Equivalent to `FXCellClick` per Pangolin Wiki (entry 0139), using
**absolute** non-scrolled cell indexing - the wiki notes this command
predates the scrollable QuickFX grid. Prefer `FXCellClick` (relative)
or `FXClick` (absolute) for new scripts.

Parameters:
- layer (integer, 1..8): FX layer index.
- cellIndex (integer): absolute (non-scrolled) cell index.

Example:

    FXCellDown 1, 1 // click cell 1 on layer 1 (absolute)

Safety: T2 - UI-mediated effect change.

Runtime probe left `Master.FX1` unchanged, so PangoLint classifies
this as a UI-mediated click action rather than a direct property
setter. Prefer `FX` or `SetFX` when the script needs an exposed
assignment write.

Related: `FXCellClick`, `FXClick`.

### FXTimeScaleDeltaAx

Signature: `FXTimeScaleDeltaAx <layer>, <mask>, <delta>`

Relative version of `FXTimeScaleAx` - increment the layer's time
scale by `delta` for the named mask. Useful for MIDI-encoder-style
incremental control.

Parameters:
- layer (integer, 1..8): FX layer index.
- mask (integer, 1..3): 1 = clock, 2 = beat, 3 = both.
- delta (integer): increment to apply.

Example:

    FXTimeScaleDeltaAx 1, 1, 1 // layer 1 clock +1

Safety: T2 - visible speed change.

Related: `FXTimeScaleAx`.

### MulFXMulAx

Signature: `MulFXMulAx <layer>, <mask>, <multiplier>`

Multiply the existing multiplier (compound, not assign). Per
Pangolin Wiki (entry 0390): "Command controls the speed/multiplier
for FX playback" - compounding lets a MIDI button "double-and-double"
without re-reading the current value.

**Layer range 1..8 verified at runtime** in BEYOND 2030 - refutes
the BEYOND export comment's 1..4 claim. Probe: assigned each
layer's clock multiplier to 1 via `SetFXMulAx <n>, 1, 1`, then
`MulFXMulAx <n>, 1, 2` doubled it to 2 on layers 4, 5, and 8.
Layer 9 was silently dropped (Master.FX9TimeMulClock stayed at 0
throughout, confirming no FX9 layer exists).

Parameters:
- layer (integer, 1..8): FX layer index. Out-of-range silently
 no-op'd.
- mask (integer, 1..3): 1 = clock, 2 = beat, 3 = both.
- multiplier (integer, 0..8): factor to compound the existing
 multiplier by.

Example:

    MulFXMulAx 1, 3, 2 // layer 1: double both clock and beat multipliers
    MulFXMulAx 8, 1, 2 // layer 8 clock-only doubled (verified)

Safety: T2 - visible speed change.

Related: `SetFXMulAx`, `SetFXMul`.

### ResetCuesFX

Signature: `ResetCuesFX`

Reset all FX on all cues to default. Per BEYOND export: zero
arguments, no comment. The exact "default" state - whether FX are
fully cleared, returned to authored values, or set to neutral
multipliers - is unverified.

Example:

    ResetCuesFX // clear FX on every cue

Safety: T2 - clears FX state across all cues; visible output
change for any cue with active FX.

Related: `ResetMasterFX`, `ResetFxTiming` (in
[fx.md](./fx.md)).

### ResetFxTiming

Signature: `ResetFxTiming`

Reset all time-related effects across every FX layer on the
currently routed Live Control. Per Pangolin Wiki (entry 0158):
"resets all time-related effects...including DJ disk, time scale,
multiplier."

Example:

    ResetFxTiming

Safety: T2 - global timing reset on the routed destination.

Related: `FXTimeScaleAxReset`, `FXTimeSync`.

## Grid UI clicks

These commands fire UI events on the QuickFX grid as if the operator
had clicked. Pangolin Wiki classifies them as **cgMain** (global UI
context) - they do not depend on Live Control routing. Useful for
MIDI surfaces that mirror the grid one-to-one.

### ResetMasterFX

Signature: `ResetMasterFX`

Reset the master FX **preset assignments** (`Master.FX1..FX6`) back
to `-1` (the "no preset assigned" default). **Verified 2026-05-06**:
this is a *selective* clear, NOT a full FX-state reset. Auxiliary
FX parameters per layer - `Master.FX<N>Action`, `Master.FX<N>Mute`,
`Master.FX<N>TimeMulClock`, `Master.FX<N>TimeMulMetro`,
`Master.FX<N>TimeScaleClock`, `Master.FX<N>TimeScaleMetro`,
`Master.FX<N>TimeShift*` - are NOT touched. They retain whatever
value they were carrying before the reset.

Verified at runtime via Talk UDP write + OSC readback against
`Master.FX1..FX6` and their auxiliary properties:

1. **Defaults observed in a clean state**: `Master.FX<N> = -1`
 (assignment), `FX<N>Action = 100` (sentinel default), `FX<N>Mute
 = 0`, `FX<N>TimeMul* = 1`, `FX<N>TimeScale* = 1`.
2. **After `SetProp` mutations** to FX1 (assignment=5, action=3,
 mute=1, timeMulClock=2.5), FX2 (7/4/0/0.5), FX3 (2/1):
 readback confirmed all writes took.
3. **After `ResetMasterFX`**: only the assignment field
 (`Master.FX1..FX6`) cleared to `-1`. Action, Mute, TimeMul*,
 TimeScale* on FX1..FX3 stayed at the mutated values. Layers
 FX4..FX6 (untouched throughout) stayed at defaults.

If you need a fuller reset (clear timing multipliers, action
enums, etc.), there is no single PangoScript command for it - 
either reload the workspace, restart BEYOND, or write each
auxiliary property explicitly via `SetProp`.

Example:

    ResetMasterFX // clear FX preset assignments only
    SetProp "Master.FX1Action", 100 // also reset Action if needed
    SetProp "Master.FX1Mute", 0 // also reset Mute if needed

Safety: T2 - clears FX preset assignments across all 6 master FX
layers; visible output change for any cue affected by master FX
presets. Auxiliary FX state persists.

Related: `ResetCuesFX`, `MasterFXSpeed` (in
[fx.md](./fx.md)).

### ResetProTrackFX

Signature: `ResetProTrackFX`

Reset FX state on every ProTrack - all layers, all timing, all
action values, back to default. Wider blast radius than
`StopProTrackFX` (which only stops; doesn't reset other FX
parameters).

Example:

    ResetProTrackFX

Safety: T3 - visible FX-output change across every track.

Related: `StopProTrackFX`, `ResetZonesFX` (see
[fx.md](./fx.md#resetzonesfx)).

## Time control

These commands manipulate ProTrack playback position and looping - 
the timeline-mode equivalent of cue cell control.

### ResetZonesFX

Signature: `ResetZonesFX`

Reset FX state on every zone - all layers, all timing, all action
values, back to default. Wider blast radius than `ResetFxTiming`,
which only resets timing on the currently routed destination.

Example:

    ResetZonesFX

Safety: T2 - visible reset across every zone's FX state.

Related: `ResetFxTiming`, `MasterZoneFxSpeed`.

## Deprecated

These four are still in the available command metadata but the
Pangolin Wiki marks them deprecated in favor of the `FXTimeScaleAx`
family. New scripts should use the `Ax`-suffixed forms with explicit
mask selection.

### Set1FxPerLine

Signature: `Set1FxPerLine`

Switch the FX grid layout to a 1-effect-per-row presentation
(densest text labels, fewest effects visible at once). Per BEYOND
export: zero arguments.

Example:

    Set1FxPerLine // single-column FX layout

Safety: T1 - UI layout only.

Runtime probes of `Set1FxPerLine`, `Set4FxPerLine`, and
`SetDropFxMode` left candidate `Config.FxRowCount` unchanged, so the
three QuickFX layout/mode commands are classified as UI state rather
than direct object-property setters.

Related: `Set4FxPerLine`.

### Set4FxPerLine

Signature: `Set4FxPerLine`

Switch the FX grid layout to a 4-effects-per-row presentation
(more compact, more effects visible at once). Per BEYOND export:
zero arguments.

Example:

    Set4FxPerLine // four-column FX layout

Safety: T1 - UI layout only.

Related: `Set1FxPerLine`.

### SetDropFxMode

Signature: `SetDropFxMode`

Toggle / switch the DropFX behavior mode. Per BEYOND export: zero
arguments and no comment on what the modes are. The DropFX command
itself (`DropFX Layer, Effect, DurationMS` in the documentation, see
[fx.md](./fx.md)) fires a quick-effect with a
specified duration; the mode switched here likely affects whether
DropFX behaves momentarily, latching, or with some other timing
variant.

Exact mode set is unverified.

Example:

    SetDropFxMode // switch DropFX behavior mode

Safety: T2 - changes how subsequent DropFX calls behave. No direct
output effect, but the next DropFX call will fire differently.

Related: `DropFX` (in [fx.md](./fx.md)).

### SetFXAction1 / SetFXAction2 / SetFXAction3 / SetFXAction4 / SetFXAction5 / SetFXAction6 / SetFXAction7 / SetFXAction8

Signature: `SetFXAction<N> <action>`

Per-layer action setter - `SetFXAction1` through `SetFXAction8`,
each affecting its named layer. Per Pangolin Wiki (entries 0172–0353):
"act same as clicking on QuickFX grid." Convenient for one-shot
MIDI bindings where the layer is known statically.

Parameters:
- action (integer, 0..100): morph percent for the named layer.

Example:

    SetFXAction1 100 // layer 1 full
    SetFXAction5 50 // layer 5 half

Safety: T2 - visible blend change.

Related: `SetFXAction`, `FXAction`.

## Layer mute

### SetFXMul

Signature: `SetFXMul <layer>, <clockMul>, <metroMul>`

Set per-layer speed multipliers separately for clock and metronome.
Equivalent to `FXTimeScaleAx` with both mask values set independently
in one call. Per Pangolin Wiki (entry 0129): "Controls speed of each
FX line for clock/metronome components."

Parameters:
- layer (integer, 1..8): FX layer index.
- clockMul (integer): clock multiplier; `1` = default.
- metroMul (integer): metronome multiplier; `1` = default.

Example:

    SetFXMul 1, 1, 1 // layer 1 default
    SetFXMul 1, 2, 1 // layer 1 double clock, normal beat

Safety: T2 - visible speed change.

Runtime readback confirms `SetFXMul 1, 2, 3` writes
`Master.FX1TimeMulClock = 2` and
`Master.FX1TimeMulMetro = 3`.

Related: `SetFXMulAx`, `FXTimeScaleAx`.

### SetFXMulAx

Signature: `SetFXMulAx <layer>, <mask>, <multiplier>`

Mask-form of `SetFXMul` - set the multiplier for a single time
component (clock or beat) without affecting the other. **Layer
range 1..8 verified at runtime** in BEYOND 2030 (incidentally,
during the `MulFXMulAx` probe). Layer 9 silently dropped.

Parameters:
- layer (integer, 1..8): FX layer index. Out-of-range silently
 no-op'd.
- mask (integer, 1..3): 1 = clock, 2 = beat, 3 = both.
- multiplier (integer): rate multiplier.

Example:

    SetFXMulAx 1, 1, 2 // layer 1 clock to 2x, leave beat

Safety: T2 - visible speed change.

Runtime readback confirms mask 1 writes
`Master.FX<n>TimeMulClock` without changing the beat multiplier, and
mask 2 writes `Master.FX<n>TimeMulMetro` without changing the clock
multiplier.

Related: `SetFXMul`, `MulFXMulAx`.

### SetFXMute

Signature: `SetFXMute <layer>, <state>`

Mute or unmute a single FX layer. Per Pangolin Wiki (entry 0128):
"Command open ability to mute (disable) FX layers."

Parameters:
- layer (integer, 1..8): FX layer index.
- state (integer, 0..2): 0 = Off (unmute), 1 = On (mute), 2 = Toggle.

Example:

    SetFXMute 1, 1 // mute layer 1
    SetFXMute 1, 0 // unmute layer 1
    SetFXMute 1, 2 // toggle layer 1

Safety: T2 - visible effect change.

Related: `ToggleFX`, `StopFX`.

## Time scaling and multiplier

These commands control how fast each FX layer evolves relative to
BEYOND's clock and metronome (beat). The **mask** parameter that
recurs across these commands selects which time source is affected:
1 = clock, 2 = beat (metronome), 3 = both. The Pangolin Wiki notes
the older `FXTimeScale` / `FXTimeScaleDelta` / `FXTimeShift` family
has been folded into the `Ax` (axis-mask) variants.
