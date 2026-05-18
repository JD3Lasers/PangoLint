---
category: Dynamics - Limiters
order: 28
---
# Dynamics - Limiters

Limiter commands configure BEYOND's dynamics limiters, which cap laser output parameters (size, brightness, scan rate) to protect equipment or comply with venue constraints. Commands cover setting limiter values by slider index or DMX value, and querying the current limiter state.

## Commands

### SetLimiterProfile

Signature: `SetLimiterProfile <index>`

Select the active limiter profile. There are two profiles - 
1 = "One Cue" mode, 2 = "Multi Cue" mode - and each holds its own
`SetLimiter*` values. Setting the profile activates it and selects
which profile subsequent `SetLimiter*` writes target.

Parameters:
- index (integer, 1..2): profile index. 1 = One Cue, 2 = Multi Cue.

Example:

    SetLimiterProfile 1
    SetLimiterPerZone 5 // writes to profile 1
    OneCue // re-assert One Cue mode

Safety: T2 - changes active limiter profile and downstream concurrent-cue behavior.

Related: `OneCue`, `OnePer`, `MultiCue` (see
[cue-clicking.md](./cue-clicking.md#cue-playback-mode)).

## Cue-count caps

Each of the seven `SetLimiter*` commands below caps the number of
concurrent cues in a specific scope. Range is **1..30** for all of
them per the documentation.

Property mapping: BEYOND does not expose the active limiter
profile/cue-count settings through a shipped Object Tree path in the
current PangoLint index. These commands are therefore classified as
no-direct-property until a durable readback surface is observed.

### SetLimiterPerZone

Signature: `SetLimiterPerZone <count>`

Maximum number of cues per projection zone in the active profile.
"The range is big, and we recommend to keep
the values in reasonable limits."

Parameters:
- count (integer, 1..30): max concurrent cues per zone.

Example:

    SetLimiterPerZone 3 // up to 3 cues per zone

Safety: T2 - changes per-zone concurrent-cue cap.

No `Limiter` or `LimiterPerZone` property is exposed in the bundled
Object Tree index. PangoLint classifies this as no-direct-property
until a durable target path is observed.

Related: `SetLimiterPerGrid`, zone commands (see
[projection-zone.md](./projection-zone.md)).

### SetLimiterPerGrid

Signature: `SetLimiterPerGrid <count>`

Maximum number of cues per grid in the active profile.

Parameters:
- count (integer, 1..30): max concurrent cues per grid.

Example:

    SetLimiterPerGrid 10

Safety: T2 - changes per-grid concurrent-cue cap.

Related: `SetLimiterPerZone`.

### SetLimiterFlash

Signature: `SetLimiterFlash <count>`

Maximum number of cues that can be in **Flash mode** simultaneously.

Parameters:
- count (integer, 1..30): max concurrent flash-mode cues.

Example:

    SetLimiterFlash 4

Safety: T2 - caps concurrent flash-mode cues.

Related: `ClickFlash` (see
[main-toolbar.md](./main-toolbar.md#clickflash)),
`SetLimiterHold`.

### SetLimiterHold

Signature: `SetLimiterHold <count>`

Maximum number of cues that can be in **Hold mode** simultaneously.

Parameters:
- count (integer, 1..30): max concurrent hold-mode cues.

Example:

    SetLimiterHold 3

Safety: T2 - caps concurrent hold-mode cues.

Related: `HoldClick`, `SetLimiterFlash`.

### SetLimiterBeam

Signature: `SetLimiterBeam <count>`

Maximum number of playing **Beam cues** simultaneously.

Parameters:
- count (integer, 1..30): max concurrent beam-type cues.

Example:

    SetLimiterBeam 5

Safety: T2 - caps concurrent beam-type cues.

Related: `SetLimiterShow`, `SetLimiterDMX`.

### SetLimiterDMX

Signature: `SetLimiterDMX <count>`

Maximum number of playing **DMX cues** simultaneously. Note: the
documentation prose for this command says "max number of playing
Beam cues" - almost certainly a copy-paste typo from `SetLimiterBeam`
just above. The command name itself disambiguates.

Parameters:
- count (integer, 1..30): max concurrent DMX-type cues.

Example:

    SetLimiterDMX 5

Safety: T2 - caps concurrent DMX-type cues.

Related: `SetLimiterBeam`, `SetLimiterShow`, DMX commands (see
[midi-dmx-channel-osc-output.md](./midi-dmx-channel-osc-output.md)).

### SetLimiterShow

Signature: `SetLimiterShow <count>`

Maximum number of playing **Show cues** simultaneously.

Parameters:
- count (integer, 1..30): max concurrent show-type cues.

Example:

    SetLimiterShow 2

Safety: T2 - caps concurrent show-type cues.

Related: `SetLimiterBeam`, `SetLimiterDMX`.
