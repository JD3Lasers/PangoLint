---
category: Beat timer - tap and re-sync
order: 7
---
# Beat timer - tap and re-sync

Beat timer commands control BEYOND's internal beat clock: tap tempo, re-sync the beat phase, set BPM directly or fractionally, and read the current BPM back. These commands interact with the Beat Timer panel in the BEYOND main toolbar area.

## Commands

### SetBpm

Signature: `SetBpm <bpm>`

Set the master BPM timer to a specific tempo. Aliases: `SetBPM` (the
Pangolin Wiki spells the command this way; PangoScript is
case-insensitive so both forms parse).

**Verified range 1..600 with hard clamping** at runtime in BEYOND
2030. Inputs ≤ 0 (and 0.1) clamp to 1; inputs > 600 clamp to 600.
The Pangolin Wiki's documented range of `0.1..600` had the upper
bound right but the lower bound is off - the floor is 1, not 0.1.

Parameters:
- bpm (number, 1..600): beats per minute. Hard-clamped to bounds
 (out-of-range values silently clamp rather than error).

Example:

    SetBpm 120
    SetBpm 174.5
    SetBpm 600 // top of range
    SetBpm 1000 // hard-clamps to 600

Safety: T2 - affects every beat-synced cue, effect, and script
listening to the Timer beat source.

Related: `SetBpmDelta`, `TimerBeat`, `WaitForTimerBeat`.

### SetBpmDelta

Signature: `SetBpmDelta <delta>`

Increment or decrement the current master BPM by a relative value.
Designed for MIDI encoders / sliders that emit deltas rather than
absolute values.

Parameters:
- delta (float): amount to add to the current BPM. Negative decrements.

Example:

    SetBpmDelta 1 // +1 BPM (e.g. nudge faster)
    SetBpmDelta -0.5 // -0.5 BPM (fine adjustment)

Safety: T2 - same effect as SetBpm; affects all beat-synced state.

Related: `SetBpm`.

## Tap tempo

### BeatTap

Signature: `BeatTap`

Feed a single tap into BEYOND's tap-tempo averager. BEYOND derives the
master BPM from the last 4 taps, so calling `BeatTap` four times at a
steady interval sets the BPM to that interval. Functionally equivalent
to clicking the BPM panel on the main toolbar (or pressing Space while
focused on it). Maximum representable BPM is 600 per Pangolin Wiki.

Useful for binding a MIDI button to a tap-tempo input - the script
calls `BeatTap` whenever the button fires, and BEYOND handles the
averaging.

Example:

    label:
    WaitForMidi 0x90, 0x40, -1 // any NoteOn for note 0x40
    BeatTap
    Restart

Safety: T0 - feeds a single tap into the averager; doesn't directly
mutate BPM (effect appears only after enough taps accumulate).

Related: `SetBpm`, `BeatResync`.

## Sync phase

### BeatResync

Signature: `BeatResync`

Reset the master beat timer's phase to zero - the next beat is *now*.
The configured BPM is unchanged; only the phase moves. Functionally
equivalent to pressing Backspace with the BPM panel focused.

Use after the operator (or another input) marks a downbeat so that
beat-synced effects line up with the live music rather than drifting
on whatever phase the timer happened to start in.

Example:

    label:
    WaitForMidi 0x90, 0x42, -1 // downbeat-marker MIDI button
    BeatResync
    Restart

Safety: T0 - phase reset, no laser output. Downstream beat-synced
effects realign on the next beat.

Related: `BeatTap`, `SetBpm`.

## Event injection

These three commands fire a single event on the corresponding beat
source as if the source had naturally produced it. Any cue, effect, or
script subscribed to that source reacts. Useful for:

- Unit-testing reactive scripts (fire `AudioBeat` from a test script
 and watch downstream effects respond).
- Bridging sources (e.g. fire `ManualBeat` when a particular MIDI hit
 arrives, so scripts subscribed to `WaitForManualBeat` react).

These commands do **not** advance BPM tempo or phase - they only fire
the discrete event. Use `SetBpm` / `BeatTap` / `BeatResync` when you
need to influence the timer state itself.

### ResyncByCueClick

Signature: `ResyncByCueClick <state>`

Enable, disable, or toggle resync-on-cue-click behavior. When on,
clicking a cue causes BEYOND to resync the cue's playback time to
the operator's click moment (typically aligning beat-synced cues to
the click). When off, cue clicks start cues without time
alignment.

Per BEYOND export comment: `ResyncByCueClick On | options: On,
Off, Toggle`. Accepts both symbolic tokens (`On` / `Off` /
`Toggle`) and the equivalent integers (`1` / `0` / `2`) per
BEYOND's standard checkbox convention.

Parameters:
- state (integer, 0..2): `0` = OFF, `1` = ON, `2` = TOGGLE.
 Symbolic tokens `On` / `Off` / `Toggle` also accepted (parsing
 is case-insensitive).

Example:

    ResyncByCueClick On // enable (export example)
    ResyncByCueClick Off // disable
    ResyncByCueClick Toggle // flip current state
    ResyncByCueClick 1 // numeric equivalent of On

Safety: T2 - changes how subsequent operator cue-click events
behave. No direct output, but next cue click will fire differently.

Related: `BeatResync` (in [beat-timer.md](./beat-timer.md)) for an
explicit one-shot resync without changing the click-time policy.

### TapByCueClick

Signature: `TapByCueClick <state>`

Enable, disable, or toggle the "cue click also fires a beat tap"
behavior. When enabled, every cue click in the BEYOND grid acts as
a `BeatTap` event in addition to triggering the cue - letting the
operator establish tempo by clicking cues in time with the music.

Per BEYOND export comment: `TapByCueClick On | options: On, Off,
Toggle`. Whether tap events are accumulated for tempo averaging
(matching `BeatTap`'s typical behavior) or used differently is
unverified.

Parameters:
- state (integer, 0..2): `0` = OFF, `1` = ON, `2` = TOGGLE.
 Symbolic tokens `On` / `Off` / `Toggle` also accepted
 (case-insensitive).

Example:

    TapByCueClick On // enable (export example)
    TapByCueClick Off // disable
    TapByCueClick Toggle // flip
    TapByCueClick 1 // numeric equivalent of On

Safety: T2 - changes how cue clicks interact with the beat clock.

Related: `BeatTap` (the beat-tap event the cue click fires when
this is enabled - in [beat-timer.md](./beat-timer.md)),
`ResyncByCueClick` (in [live-control.md](./live-control.md)).
