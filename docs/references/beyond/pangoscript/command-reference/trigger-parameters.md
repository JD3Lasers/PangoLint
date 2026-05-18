---
category: Trigger Parameters  (test mode)
order: 33
---
# Trigger Parameters  (test mode)

Trigger parameter commands read and write the parameters associated with a registered trigger, allowing a script to inspect or modify trigger conditions at runtime. These are companion commands to the Trigger Definition set.

Threshold and range values are compared against the source selected by
the preceding trigger definition command. `DefineDmxTrigger` examples
use DMX byte values, commonly 0..255. `DefineMidiTrigger` examples use
MIDI data bytes, commonly 0..127. `DefineTrigger` can evaluate an
arbitrary numeric expression, so these commands do not have a single
intrinsic numeric range. Current metadata leaves threshold bounds
source-dependent unless a trigger-source probe has proven them.

## Commands

### InRangeTrigger

Signature: `InRangeTrigger <minValue>, <maxValue>, "<labelName>"`

Fire when the watched value enters the closed range `[min, max]`,
goto the named label. Refires only after the value leaves the range
and re-enters.

Parameters:
- minValue (number): lower bound of the source-dependent activation range.
- maxValue (number): upper bound of the source-dependent activation range.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    InRangeTrigger 0, 63, "Low"
    InRangeTrigger 64, 127, "High"
    exit

    Low:
    DisableLaserOutput
    exit

    High:
    EnableLaserOutput
    exit

Safety: T2 - registers a range condition; the goto'd label is
arbitrary PangoScript whose tier depends on what it does.

Related: `InRangeTriggerCmd`, `OutOfRangeTrigger`.

### InRangeTriggerCmd

Signature: `InRangeTriggerCmd <minValue>, <maxValue>, "<command>"`

Same activation condition as `InRangeTrigger`, but executes an inline
PangoScript command string instead of jumping to a label. Convenient
for one-line handlers where a labelled section would be overkill.

Parameters:
- minValue (number): lower bound of the source-dependent activation range.
- maxValue (number): upper bound of the source-dependent activation range.
- command (string): a PangoScript command string to execute when the
  trigger fires.

Example:

    DefineMidiTrigger 0xB0, 0x00, "Brightness slider"
    InRangeTriggerCmd 0, 63, "DisableLaserOutput"
    InRangeTriggerCmd 64, 127, "EnableLaserOutput"
    exit

Safety: T2 - registers the trigger; the executed command's tier is
whatever the command does. `BlackOut` / `EnableLaserOutput` etc. push
this effectively to T3.

Related: `InRangeTrigger`, `OutOfRangeTriggerCmd`.

### OutOfRangeTrigger

Signature: `OutOfRangeTrigger <minValue>, <maxValue>, "<labelName>"`

Fire when the watched value transitions **out** of the range
`[min, max]`. Refires only after the value re-enters the range and
leaves again.

Parameters:
- minValue (number): lower bound of the source-dependent inactive range.
- maxValue (number): upper bound of the source-dependent inactive range.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    OutOfRangeTrigger 100, 200, "OutOfRange"
    exit

    OutOfRange:
    DisplayPopup "DMX value left the safe band"
    exit

Safety: T2 - registers a range-exit condition; downstream label
behavior is arbitrary.

Related: `OutOfRangeTriggerCmd`, `InRangeTrigger`.

### OutOfRangeTriggerCmd

Signature: `OutOfRangeTriggerCmd <minValue>, <maxValue>, "<command>"`

Same condition as `OutOfRangeTrigger`, but executes an inline
PangoScript command string instead of jumping to a label.

Parameters:
- minValue (number): lower bound of the source-dependent inactive range.
- maxValue (number): upper bound of the source-dependent inactive range.
- command (string): a PangoScript command to execute when the trigger
  fires.

Example:

    DefineDmxTrigger 5
    OutOfRangeTriggerCmd 100, 200, "BlackOut"
    exit

Safety: T2 - registers the trigger; the executed command may be T3+.

Related: `OutOfRangeTrigger`, `InRangeTriggerCmd`.

## Direction-based actions

### IncreaseTrigger

Signature: `IncreaseTrigger <minValue>, <maxValue>, "<labelName>"`

Fire when the watched value **both** (a) increases (the new value is
greater than the previous one) and (b) lands inside the range
`[min, max]`. The scripter remembers the previous value so subsequent
increases inside the same band keep firing.

Per the documentation: "scripter memorize current value, and if the new
value is bigger... than current state then it active the trigger."

Parameters:
- minValue (number): lower bound of the source-dependent activation range.
- maxValue (number): upper bound of the source-dependent activation range.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    IncreaseTrigger 0, 255, "DmxRising"
    exit

    DmxRising:
    DisplayPopup "DMX channel 5 increased"
    exit

Safety: T2 - registers the trigger; downstream label behavior is
arbitrary.

Related: `DecreaseTrigger`, `InRangeTrigger`.

### DecreaseTrigger

Signature: `DecreaseTrigger <minValue>, <maxValue>, "<labelName>"`

Mirror of `IncreaseTrigger` for the falling direction - fire when the
watched value **both** (a) decreases and (b) lands inside
`[min, max]`.

Parameters:
- minValue (number): lower bound of the source-dependent activation range.
- maxValue (number): upper bound of the source-dependent activation range.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    DecreaseTrigger 0, 255, "DmxFalling"
    exit

    DmxFalling:
    DisplayPopup "DMX channel 5 decreased"
    exit

Safety: T2 - registers the trigger; downstream label behavior is
arbitrary.

Related: `IncreaseTrigger`, `InRangeTrigger`.

## Threshold-based actions

These two have a different parameter shape - only a single threshold
value plus a label, no min/max range.

### MoreThanTrigger

Signature: `MoreThanTrigger <threshold>, "<labelName>"`

Fire when the watched value crosses above the supplied threshold.

Parameters:
- threshold (number): source-dependent value to compare against.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    MoreThanTrigger 200, "WentHigh"
    exit

    WentHigh:
    EnableLaserOutput
    exit

Safety: T2 - registers the trigger; downstream label behavior is
arbitrary.

Related: `LessThanTrigger`, `IncreaseTrigger`.

### LessThanTrigger

Signature: `LessThanTrigger <threshold>, "<labelName>"`

Fire when the watched value crosses below the supplied threshold.

Parameters:
- threshold (number): source-dependent value to compare against.
- labelName (string): name of a labelled section in the same script.

Example:

    DefineDmxTrigger 5
    LessThanTrigger 50, "WentLow"
    exit

    WentLow:
    DisableLaserOutput
    exit

Safety: T2 - registers the trigger; downstream label behavior is
arbitrary.

Related: `MoreThanTrigger`, `DecreaseTrigger`.
