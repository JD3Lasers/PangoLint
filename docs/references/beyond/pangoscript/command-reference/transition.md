---
category: Transition
order: 5
---
# Transition

Master transition controls. BEYOND blends between two cues using the configured transition curve and timing; these commands toggle transition mode, set the curve preset, and set the transition time. Transition is a master-level effect visible on all projectors unless overridden per zone.

## Commands

### Transition

Signature: `Transition <state>`

Toggle cue-transition behavior on the main toolbar. When ON, BEYOND
fades between cues on cue change instead of cutting.

**Verified alias of `MasterTransition`** (see
[general.md](./general.md#mastertransition)); both
commands write the same `Master.TransitionState` flag. Prefer
`MasterTransition` in new scripts for the more explicit naming.
PangoLint may surface a hint suggesting the rename.

Command coverage maps this toolbar command to
`Master.TransitionState`.

Per Pangolin Wiki (entry 0060): "Enable, disable, or toggle
transition effects between cues." Accepts `ON` / `OFF` / `TOGGLE`
constants or numeric `0` / `1` / `2`.

Parameters:
- state (integer | constant, 0..2): 0 = OFF, 1 = ON, 2 = TOGGLE.

Example:

    Transition On
    Transition Toggle

Safety: T1: UI mode change; visible on next cue change.

Related: `MasterTransition` (alias), `MasterTransitionTime`,
`MasterTransitionIndex`.

## Virtual LJ

### SetTransitionIndex

Signature: `SetTransitionIndex <value>`

Select the transition preset by index. **Verified alias of
`MasterTransitionIndex`** at runtime in BEYOND 2030: both
commands write the same `Master.TransitionIndex` property. The
runtime range probe on 2026-05-11 confirmed a `0..24` clamp.

Parameters:
- value (integer): transition preset index, range `0..24`.
 Inputs below 0 clamp to 0; inputs above 24 clamp to 24.

Example:

    SetTransitionIndex 2 // select preset 2
    SetTransitionIndex 5 // select preset 5

Safety: T2: affects next transition.

Related: `MasterTransitionIndex` (alias, see
[general.md](./general.md#mastertransitionindex)),
`SetTransitionTime`, `MasterTransition`.

### SetTransitionTime

Signature: `SetTransitionTime <seconds>`

Set the transition duration in seconds. **Inferred alias of
`MasterTransitionTime`**, but the alias relationship and clamp
behavior cannot be directly verified at runtime: BEYOND's Object
Tree exposes no readable transition-duration property, so writes
via either command have no observable readback path. The parameter
is fractional seconds (e.g. `0.5` = 500ms).

Because no transition-time readback path is exposed, PangoLint
classifies `SetTransitionTime` as no-direct-property rather than
mapping it to the verified transition state/index properties.
Representative writes for `-1`, `0`, `0.5`, `2`, and `10000`
were transmitted without PangoLint errors, then reset to `0.1`.

Parameters:
- seconds (number): transition duration in seconds. Range evidence
 is unverified because no direct readback path exposes the stored
 duration.

Example:

    SetTransitionTime 0.1 // 100ms transition (export example)
    SetTransitionTime 0.5 // 500ms transition
    SetTransitionTime 2 // 2-second transition

Safety: T2: affects next transition.

Related: `MasterTransitionTime` (inferred alias, see
[general.md](./general.md#mastertransitiontime)),
`SetTransitionIndex`, `MasterTransition`.
