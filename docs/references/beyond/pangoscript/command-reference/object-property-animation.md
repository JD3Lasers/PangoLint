---
category: Object Property Animation
order: 34
---
# Object Property Animation

Object Property Animation commands drive BEYOND's property animation engine, which interpolates named object properties over time. Commands cover starting, stopping, and configuring animation curves on any addressable BEYOND property path.

Evidence note: range claims in this page come from local BEYOND help text or BEYOND readback probes. PangoLint lint acceptance is not runtime evidence.

## Commands

### AnimateProp

Signature: `AnimateProp "<propertyName>", <startValue>, <finishValue>, <durationMS>[, "<finishEvent>"]`

Schedule a linear animation of a numeric property from `startValue`
to `finishValue` over `durationMS` milliseconds. Per documentation
(line 1403).

Note: the documentation examples spell the command "AnimapeProp"
(typo), but the BEYOND export uses `AnimateProp`.

Parameters:
- propertyName (string): full dotted property path (e.g.
 `"Master.Brightness"`). Must be numeric.
- startValue (number): starting value at t=0. The accepted range is
 determined by the target property.
- finishValue (number): final value at t=durationMS. The accepted
 range is determined by the target property.
- durationMS (integer): animation duration in milliseconds. BEYOND
 readback probes confirmed 0 completes immediately, 250 completes
 a short animation, and 60000 starts a long animation that can be
 cancelled with `DeletePropAni`.
- finishEvent (string, optional): event name to fire when the
 animation completes. Equivalent to calling
 `PulseEvent("<finishEvent>")` at end-of-animation. A named event
 string and an empty string both allowed the animation to complete;
 event delivery was not directly observed.

Observed 2026-05-11 with BEYOND readback:
- `AnimateProp "Master.Brightness", 100, 90, 250` reached
 `Master.Brightness = 90`.
- `AnimateProp "Master.Brightness", 100, 95, 0` completed
 immediately at `Master.Brightness = 95`.
- `AnimateProp "Master.Brightness", 100, 99, 60000` started a long
 interpolation and was cancelled with `DeletePropAni`.
- Restore required `ControlMaster` followed by `Brightness 100`; the
 final readback returned `Master.Brightness = 100`.

Example:

    // fade master brightness from 100 to 0 over 1 second
    AnimateProp "Master.Brightness", 100, 0, 1000

    // fade from current value to 0 over 0.5 sec
    AnimateProp "Master.Brightness", Master.Brightness, 0, 500

    // ramp + fire event when done
    AnimateProp "Master.Brightness", 100, 0, 1000, "FadeDone"

Safety: T2: visible property change over time. Restore-the-original
cleanup applies if you want to revert (or call `DeletePropAni
"Master.Brightness"` to cancel mid-animation).

Property mapping: this is a dynamic property-path command. It writes
the property named by the first string argument, so PangoLint does
not publish a fixed `setsProperty` target for the command itself.

Related: `AnimatePropDelta`, `DeletePropAni`, `PulseEvent`.

### AnimatePropDelta

Signature: `AnimatePropDelta "<propertyName>", <totalDelta>, <durationMS>[, "<finishEvent>"]`

Schedule a linear animation that **shifts** a numeric property by
`totalDelta` over `durationMS` milliseconds. The starting value is
the property's current value at task-creation time.

Parameters:
- propertyName (string): full dotted property path. Must be numeric.
- totalDelta (number): how much the property should change from
 its current value over the animation. Negative deltas decrement,
 and the resulting value range is determined by the target property.
- durationMS (integer): animation duration in milliseconds. BEYOND
 readback probes confirmed 0 completes immediately and 250 completes
 a short animation.
- finishEvent (string, optional): event name to fire when the
 animation completes. The event name shape matches `AnimateProp`;
 empty-string behavior is inferred from the `AnimateProp` readback
 probe.

Observed 2026-05-11 with BEYOND readback:
- `AnimatePropDelta "Master.Brightness", -5, 250` shifted
 `Master.Brightness` from 100 to approximately 95, confirming
 negative deltas are valid and the argument is total delta over the
 animation rather than a per-step value.
- `AnimatePropDelta "Master.Brightness", -1, 0` shifted
 `Master.Brightness` from 100 to 99 immediately.
- Restore required `ControlMaster` followed by `Brightness 100`; the
 final readback returned `Master.Brightness = 100`.

Example:

    // decrease master brightness by 25% over 0.3 sec
    AnimatePropDelta "Master.Brightness", -25, 300

    // shift master color by -32 over 1 beat using b2ms conversion
    AnimatePropDelta "Master.Color", -32, b2ms(1)

Safety: T2: visible property change over time.

Property mapping: this is a dynamic property-path command. It shifts
the property named by the first string argument, so PangoLint does
not publish a fixed `setsProperty` target for the command itself.

Related: `AnimateProp`, `DeletePropAni`, `PulseEvent`.

### DeletePropAni

Signature: `DeletePropAni`
Signature: `DeletePropAni "<propertyName>"[, "<propertyName>",...]`

Delete one, several, or all running property animations. Per local
documentation (line 1431):

- **No args**: delete every running animation task.
- **One or more property name strings**: delete the named
 animation(s) only.

Useful for canceling fades that are no longer needed, or as a hard
reset before kicking off a fresh animation set.

Parameters:
- propertyName1..N (string, optional, repeatable): full dotted
 property path of an animation to cancel. Omit all args to clear
 every running animation.

Example:

    DeletePropAni // delete all
    DeletePropAni "Master.Brightness" // just one
    DeletePropAni "Master.Brightness", "Master.Color" // multiple

Safety: T2: cancels running animations; the affected properties
freeze at whatever their current interpolated value is at the
moment of cancellation. May leave a property mid-fade.

Property mapping: this command names animation tasks by property
path, or clears all property animations when called without
arguments. It does not write a fixed Object Tree property.

Related: `AnimateProp`, `AnimatePropDelta`.
