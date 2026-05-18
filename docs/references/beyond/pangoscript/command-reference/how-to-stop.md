---
category: How to stop?
order: 3
---
# How to stop?

These commands provide every variant of stopping laser playback: stop-all (sync, async, or immediate), stop a specific cue by cell address or type, and stop a named projector. T3-tier: stopping output may or may not cut the laser beam depending on the BEYOND safety-output configuration. Use StopAllNow for an immediate hard stop in safety-critical contexts.

Property mapping: these are cue-output actions, not direct Object Tree
setters. Current bundled Object Tree data does not expose a stable
running-cue or stopped-cue state property for the stop action itself.

Evidence note: range claims in this page come from BEYOND export text
and local docs unless a readback probe is named. Runtime transmission
without readback is not treated as accepted-range proof.

## Commands

### StopAllNow

Signature: `StopAllNow`

Stop every running cue immediately, with no soft-stop. Equivalent to the
"Stop All Cues" entry on BEYOND's Run menu in immediate mode.

Example:

    StopAllNow

Safety: T3: affects live laser output (all cues).

Related: `StopAllSync`, `StopCueType`, `StopCueNow`.

### StopAllSync

Signature: `StopAllSync <fadeSeconds>`

Stop every running cue with the supplied soft-stop fade and **block** the
script until all fades complete.

Parameters:
- fadeSeconds (number): soft-stop duration in seconds. Accepted
 bounds are not readback-confirmed.

Probe note 2026-05-11:
- Representative values `0`, `1.0`, and `60` were transmitted against
 inactive content.
- No stable running-cue or stopped-cue readback property was found, so
 accepted bounds and clamp behavior remain unverified.

Example:

    StopAllSync 0.2

Safety: T3: affects live laser output (all cues).

Related: `StopAllNow`, `StopCueSync`.

### StopAllAsync

Signature: `StopAllAsync <fadeSeconds>`

Stop every running cue with the supplied soft-stop fade and return
immediately without blocking the script. Use this when the script should
continue scheduling follow-up work while BEYOND fades out Grid, ProTrack,
and effect/group-pool playback in the background.

Parameters:
- fadeSeconds (number): soft-stop duration in seconds. Accepted
 bounds are not readback-confirmed.

Probe note 2026-05-11:
- Representative values `0`, `1.0`, and `60` were transmitted against
 inactive content.
- No stable running-cue or stopped-cue readback property was found, so
 accepted bounds and clamp behavior remain unverified.

Example:

    StopAllAsync 0.5
    WriteLn "Fade-out requested; continuing script"

Safety: T3: affects live laser output (all cues).

Related: `StopAllSync`, `StopAllNow`, `StopCueType`, `BlackOut`.

### StopCueNow

Signature: `StopCueNow <page>, <cell>`

Stop a cue immediately, bypassing BEYOND's default soft-stop. Use when
you need an instant cut rather than the configured fade-out.

Parameters:
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.

Example:

    StopCueNow 1, 1

Safety: T3: affects live laser output.

Related: `StopCue`, `StopCueSync`, `StopAllNow`.

### StopCueSync

Signature: `StopCueSync <page>, <cell>, <fadeSeconds>`

**Deprecated by Pangolin.** The Pangolin Wiki marks this command as
"legacy command. Do not use." in the current PangoScript reference.
The historical behavior was to stop a cue with a soft-stop fade and
block the script until the fade completed.

Use `StopCue` (default soft-stop, non-blocking), `StopCueNow`
(immediate), or `StopAllSync` (all cues, blocking) instead, depending
on which combination of fade and blocking you need.

Parameters (historical):
- page (integer, 1..100): grid page index.
- cell (integer, 1..100): cell index inside the page.
- fadeSeconds (number): soft-stop duration in seconds.

Example:

    StopCueSync 1, 1, 0.5 // legacy - prefer StopCue or StopAllSync

Safety: T3: affects live laser output.

Related: `StopCue`, `StopCueNow`, `StopAllSync`.

### StopCueType

Signature: `StopCueType <mask>`
Signature: `StopCueType <mask>, <fadeSeconds>`

Stop all running cues whose content matches the supplied bit mask. The
optional fade-seconds argument applies a soft-stop of that duration; zero
or omitted means stop immediately.

Mask bits:
- 1: Image
- 2: Timeline
- 4: DMX
- 8: Fixture Sequence
- 16: Beams
- 32: Capture

Combine bits with `|` (e.g. `1|16` to stop Image and Beams). `255` stops
every type.

Parameters:
- mask (integer): bit mask of cue content types to stop. Behavior for
 zero, negative values, and bits outside the documented set is
 unverified.
- fadeSeconds (number, optional): soft-stop duration in seconds. Zero
 means immediate; other accepted bounds are not readback-confirmed.

Probe note 2026-05-11:
- Representative forms `StopCueType 255`, `StopCueType 255, 0`,
 `StopCueType 255, 0.5`, `StopCueType 255, 2.0`, and
 `StopCueType 255, -1` were transmitted against inactive content.
- No stable running-cue or stopped-cue readback property was found, so
 fade duration bounds and clamp behavior remain unverified.

Example:

    StopCueType 255 // stop everything immediately
    StopCueType 1|16, 0.25 // stop Image + Beams cues with a 0.25s fade

Safety: T3: affects live laser output.

Related: `StopAllNow`, `StopAllSync`, `StopCue`.
