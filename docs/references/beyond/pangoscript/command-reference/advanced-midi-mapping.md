---
category: Advanced MIDI mapping
order: 35
---
# Advanced MIDI mapping

Advanced MIDI mapping commands configure BEYOND's MIDI Surface Layer (MSL) system, which maps physical MIDI controllers to grid buttons, sliders, and FX slots. Commands assign MIDI Surface Layer indices to specific surface elements such as grid pages, FX banks, zone mutes, and zone selects.

## Commands

### MSL layer input and stored value

The 2026-05-12 runtime probe used Talk UDP writes and OSC property
readback for all twelve MSL setters. Each command followed the same
mapping:

| Script input | Stored `MIDI1.*MSL` value |
| ------------ | ------------------------- |
| -2 | -1 |
| -1 | 0 |
| 0 | 1 |
| 1 | 2 |
| 6 | 7 |
| 11 | 12 |
| 12 | 13 |
| 13 | 14 |
| 100 | 101 |

All 108 readbacks matched `stored = input + 1`. The nominal script
input range remains `0..11` because it maps to stored layer values
`1..12`. Inputs outside `0..11` were accepted by the stored property
path and were not clamped through input `100`. Input `-1` is not
documented here as a disabled sentinel: it stored `0`, while input
`-2` stored `-1`. The probe did not recheck visible BEYOND UI labels,
so UI display text is not used as evidence for these range bounds.

### SetGrid1MSL / SetGrid2MSL

Signature: `SetGrid<N>MSL <layer>`

Set the active MSL layer for the **main grid** (Grid1) or
**secondary grid** (Grid2). Per Pangolin Wiki (entries 1210, 1211).
Each writes to `MIDI1.Grid<N>MSL`. **Verified 0-based input** (see
the input and stored value section above).

Parameters:
- layer (integer, 0..11): **0-based input.** Stored = input + 1.

Example:

    SetGrid1MSL 0 // stores 1
    SetGrid2MSL 1 // stores 2

Safety: T1, MIDI mapping layer state only.

Related: `SetButtonMSL`, `ClickFXTabMode` (see
[fx.md](./fx.md#clickfxtabmode)).

### SetSliderMSL

Signature: `SetSliderMSL <layer>`

Set the active MSL layer for **surface sliders**. Per Pangolin Wiki
(entry 1212). Writes to `MIDI1.SliderMSL`. **Verified 0-based
input** (see the input and stored value section above).

Parameters:
- layer (integer, 0..11): **0-based input.** Stored = input + 1.

Example:

    SetSliderMSL 4 // stores 5

Safety: T1, MIDI mapping layer state only.

Related: `SetButtonMSL`.

### SetButtonMSL

Signature: `SetButtonMSL <layer>`

Set the active MSL layer for **surface buttons**. Per Pangolin Wiki
(entry 1213). Writes to `MIDI1.ButtonMSL`. **Verified 0-based
input** (see the input and stored value section above).

Parameters:
- layer (integer, 0..11): **0-based input.** Stored value =
 input + 1.

Example:

    SetButtonMSL 0 // stores 1
    SetButtonMSL 11 // stores 12

Safety: T1, MIDI mapping layer state only.

Related: `SetSliderMSL`, `SetFX1MSL`, `SetGrid1MSL`.

### SetZoneSelMSL

Signature: `SetZoneSelMSL <layer>`

Set the active MSL layer for **zone selection** controls. Per
Pangolin Wiki (entry 1214). Writes to `MIDI1.ZoneSelMSL`.
**Verified 0-based input** (see the input and stored value section
above).

Parameters:
- layer (integer, 0..11): **0-based input.** Stored = input + 1.

Example:

    SetZoneSelMSL 0 // stores 1

Safety: T1, MIDI mapping layer state only.

Runtime readback confirmed the mapping directly: `SetZoneSelMSL 5`
stored `MIDI1.ZoneSelMSL = 6`. The probe was restored with
`SetZoneSelMSL 0`.

Related: `SetZoneMuteMSL`, zone selection (see
[selecting-live-control.md](./selecting-live-control.md#selection-driven-routing)).

### SetZoneMuteMSL

Signature: `SetZoneMuteMSL <layer>`

Set the active MSL layer for **zone mute** controls. Per Pangolin
Wiki (entry 1215). Writes to `MIDI1.ZoneMuteMSL`. **Verified
0-based input** (see the input and stored value section above).

Parameters:
- layer (integer, 0..11): **0-based input.** Stored = input + 1.

Example:

    SetZoneMuteMSL 0 // stores 1

Safety: T1, MIDI mapping layer state only.

Runtime readback confirmed the mapping directly: `SetZoneMuteMSL 3`
stored `MIDI1.ZoneMuteMSL = 4`. The probe was restored with
`SetZoneMuteMSL 0`.

Related: `SetZoneSelMSL`, zone commands (see
[projection-zone.md](./projection-zone.md)).

### SetFX1MSL / SetFX2MSL / SetFX3MSL / SetFX4MSL / SetFX5MSL / SetFX6MSL

Signature: `SetFX<N>MSL <layer>`

Set the active MSL layer for FX section N (1..6). Each FX section
has its own layer state, so different FX surfaces can be on
different MSL layers simultaneously. Per Pangolin Wiki (entries
1216 to 1221). Each command writes to `MIDI1.FX<N>MSL`.

**Verified independent from QuickFX layer count.** The MSL FX
sections (six: FX1..FX6) are a separate concept from the QuickFX
8-layer system in [fx.md](./fx.md). Don't expect
"MSL FX section N" to map to "QuickFX layer N"; they are
orthogonal: MSL controls MIDI surface mappings, QuickFX controls
effect playback layers.

**Verified at runtime: input is 0-based; stored value = input + 1.**
The same 2026-05-12 matrix above covered `SetFX1MSL` through
`SetFX6MSL`.

No clamping was observed from input `-2` through input `100`.
Runtime MSL family readbacks also confirmed the same direct property
shape for `SetButtonMSL`, `SetSliderMSL`, `SetGrid1MSL`,
`SetGrid2MSL`, `SetZoneMuteMSL`, `SetZoneSelMSL`, and `SetFX2MSL`
through `SetFX6MSL`.

Parameters:
- layer (integer, 0..11): **0-based input.** Stored value is
 input + 1.

Example:

    SetFX1MSL 0 // stores 1
    SetFX6MSL 11 // stores 12

Safety: T1, MIDI mapping layer state only.

Related: `SetButtonMSL`, FX commands (see
[fx.md](./fx.md)).

### SetMidiLayer

Signature: `SetMidiLayer <layerIndex>`

Set the MIDI layer index for the script's currently-selected MIDI
device. Default layer is 1. Like `SelectMidi`, this is per-scripter
state.

Parameters:
- layerIndex (integer, 1..8): MIDI layer to use.

Example:

    SelectMidi 1
    SetMidiLayer 2
    MidiOut 0x90, 0x40, 0x7F // sent on device 1, layer 2

Safety: T1 - script-local configuration; no immediate MIDI output.

Readback: with the default selected MIDI context, `SetMidiLayer 2`
writes `MIDI1.Layer = 2`.

Related: `SelectMidi`, `MidiOut`.
