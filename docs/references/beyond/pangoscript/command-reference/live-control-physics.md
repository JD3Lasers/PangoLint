---
category: Live Control Physics
order: 13
---
# Live Control Physics

Live Control Physics commands enable and configure physics-based motion on Live Control parameters. Physics mode applies spring, damping, and bounce dynamics so that parameter changes decelerate gradually rather than snapping to their target value. These commands interact with the Physics section of the BEYOND Live Control panel.

## Commands

### SetMassSlider

Signature: `SetMassSlider <value>`

Set the global physics mass slider: controls per-channel inertia,
where higher mass means slower response to attraction. **Verified
2026-05-06; refreshed 2026-05-12**: writes `Master.PhMass`. Range
`[1, 30]`; values <= 1 clamp to 1; values > 30 clamp to 30.
Fractional in-range values pass through.

Runtime note (2026-05-12): in the current workspace, baseline
`Master.PhMass` was 4. `SetMassSlider 30` read back 30 and
`SetMassSlider 31` also read back 30. Restoring with
`SetMassSlider 4` returned to baseline. No workspace or physics
preset switch was performed, so this does not prove the max is
content-independent outside the current workspace. PangoLint lint
acceptance was not used as proof because this command data is still
being filled in.

Parameters:
- value (number, 1..30): mass value. Fractional values inside the
 range are accepted. Out-of-range values silently clamp.

Example:

    SetMassSlider 4 // export example (low)
    SetMassSlider 1 // light (most responsive)
    SetMassSlider 30 // maximum (most sluggish)
    SetMassSlider 100 // clamps to 30

Safety: T2: affects channel inertia when physics is active.

Related: `SetAttractionSlider`, `SetFrictionSlider`,
`SetPhysicsCheckbox`.

### SetAttractionSlider

Signature: `SetAttractionSlider <value>`

Set the global physics attraction slider: controls how strongly
each channel pulls toward its target value. **Verified 2026-05-06**:
writes `Master.PhAttraction`. **Refreshed 2026-05-12**. Range
`[1, 50]`; values <= 1 clamp to 1; values > 50 clamp to 50.
Fractional in-range values pass through.

Runtime note (2026-05-12): in the current workspace, baseline
`Master.PhAttraction` was 10.15999984741211. `SetAttractionSlider
50` read back 50 and `SetAttractionSlider 51` also read back 50.
Restoring with `SetAttractionSlider 10.15999984741211` returned to
baseline. No workspace or physics preset switch was performed, so
this does not prove the max is content-independent outside the
current workspace. PangoLint lint acceptance was not used as proof
because this command data is still being filled in.

Parameters:
- value (number, 1..50): attraction value. Fractional values inside
 the range are accepted. Out-of-range values silently clamp.

Example:

    SetAttractionSlider 10 // export example (mid-low)
    SetAttractionSlider 50 // maximum
    SetAttractionSlider 100 // clamps to 50
    SetAttractionSlider 0 // clamps to 1

Safety: T2: affects channel motion when physics is active.

Related: `SetFrictionSlider`, `SetMassSlider`, `SetPhysicsCheckbox`.

### SetFrictionSlider

Signature: `SetFrictionSlider <value>`

Set the global physics friction slider: controls damping, or how
quickly motion decays). **Verified 2026-05-06**: writes
`Master.PhFriction`. **Refreshed 2026-05-12**. Range `[1, 30]`;
values <= 1 clamp to 1; values > 30 clamp to 30. Fractional in-range
values pass through.

Runtime note (2026-05-12): in the current workspace, baseline
`Master.PhFriction` was 1. `SetFrictionSlider 30` read back 30 and
`SetFrictionSlider 31` also read back 30. Restoring with
`SetFrictionSlider 1` returned to baseline. No workspace or physics
preset switch was performed, so this does not prove the max is
content-independent outside the current workspace. PangoLint lint
acceptance was not used as proof because this command data is still
being filled in.

Parameters:
- value (number, 1..30): friction value. Fractional values inside
 the range are accepted. Out-of-range values silently clamp.

Example:

    SetFrictionSlider 10 // export example (mid)
    SetFrictionSlider 30 // maximum (most damping)
    SetFrictionSlider 100 // clamps to 30
    SetFrictionSlider 0 // clamps to 1

Safety: T2: affects channel motion damping when physics is active.

Related: `SetAttractionSlider`, `SetMassSlider`, `SetPhysicsCheckbox`.

### SetPhysicsCheckbox

Signature: `SetPhysicsCheckbox <state>`

Enable, disable, or toggle the global physics simulation. Writes
`Master.PhActive`. When off, the three slider values still update
but have no effect on output.

Parameters:
- state (integer, 0..2): `0` = OFF, `1` = ON, `2` = TOGGLE. BEYOND
 also accepts the symbolic tokens `ON` / `OFF` / `TOGGLE` per the
 export example.

Example:

    SetPhysicsCheckbox ON // enable physics (export example)
    SetPhysicsCheckbox OFF // disable
    SetPhysicsCheckbox TOGGLE // flip current state
    SetPhysicsCheckbox 1 // numeric equivalent of ON

Safety: T2 - toggling physics changes whether the slider settings
affect motion; visible motion change depends on the slider values
already in place.

Related: `SetAttractionSlider`, `SetFrictionSlider`, `SetMassSlider`.
