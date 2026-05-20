# BEYOND `Master` Object Tree Reference (2026-05-04)

Copied from BEYOND's in-app **Object Tree** under the `Master` node.
Identifiers and OSC addresses were copied from the Object Tree.

The processed canonical schemas live in
[`data/pangoscript/object-tree/runtime-indexes/known-properties.json`](../../../../data/pangoscript/object-tree/runtime-indexes/known-properties.json),
which is the machine-readable source consumed by the linter.

The OSC address pattern at the bottom of the BEYOND tree window shows
`Master.Zoom` ↔ `/b/Master/Zoom`, so the convention is `/b/Master/<Name>`.

These are the property names available for `RegisterOscFeedback "<addr>",
"master.<name>"` registration and for direct assignment via
`Master.<Name> = <value>`. **Note**: this is NOT the same surface as
the BEYOND command export - many commands (`AngleX`, `Size`, `MasterSpeed`)
have names that DO NOT appear in this property tree but still write
SOMEWHERE. See the runtime-observation notes for verified
command-to-property mappings.

Property type icons in the BEYOND UI: `N` = numeric, `B` = boolean.

## Master.* property names (alphabetical, as listed in the Object Tree)

```
AllowTimelineAnimator       N
AllowTimelineBeam           N
AllowTimelineDmx            N
AllowTimelineScript         N
Alpha                       N
AnimationSpeed              N
AudioInGain                 N
AudioInRelease              N
AudioVolume                 N
AudioVolumeMute             N
BPM                         N
BeamBrush                   N
BlockEnableLaser            B
Blue                        N
Brightness                  N
ChannelToChannelRatio       N
ColorSlider                 N
CueBeatShift                N
CueClockShift               N
CueFinishTime               N
CueLcSpeed                  N
CuePauseTime                N
CueRule                     N
CueSpeed                    N
CueStartTime                N
CueUnPauseTime              N
DisplayPopupTimeout         N
DmxInEnabled                B
DmxMaster                   N
DmxToChannelRatio           N
DropDuration                N
EffectChannelAction1..8     N (8 entries)
EnableDynamics              B
EnableFinishForFlash        B
EnableFinishForFlashSolo    B
EnableMidiClockForBpmControl B
EnableStartForFlash         B
EnableStartForFlashSolo     B
EnableVdjClockForBpmControl B
FFTToChannelRatio           N
FX1..FX8                    N (8 entries)
FXnAction                   N (per FX 1..8)
FXnMute                     N (per FX 1..8)
FXnTimeMulClock             N (per FX 1..8)
FXnTimeMulMetro             N (per FX 1..8)
FXnTimeScaleClock           N (per FX 1..8)
FXnTimeScaleMetro           N (per FX 1..8)
FXnTimeShiftClock           N (per FX 1..8)
FXnTimeShiftMetro           N (per FX 1..8)
FXSpeed                     N
Green                       N
HardBeatSync                B
Hue                         N
HueShift                    N
LCScrollSpeed               N
LCSpeed                     N
MasterBrightness            N
MasterEffectClockShift      N
MasterEffectMetroShift      N
Muted                       N
Pan                         N
Pause                       N
PauseTime                   B
PhActive                    N
PhAttraction                N
PhFriction                  N
PhMass                      N
PosX, PosY, PosZ            N
PositionX, PositionY, PositionZ  N
RGBColor                    N
Red                         N
RotoAccX, RotoAccY, RotoAccZ     N
RotoAngleX, RotoAngleY, RotoAngleZ  N
RotoSpeedX, RotoSpeedY, RotoSpeedZ  N
SatShift                    N
Saturation                  N
ScanRate                    N
ShowBrightness              N
ShowSpeed                   N
SizeX, SizeY, SizeZ         N
StrobeAcc                   N
StrobeSpeed                 N
TcInEnabled                 B
Tilt                        N
TimecodeShift               N
TransitionIndex             N
TransitionState             B
VdjToChannelRatio           N
VisiblePointStart           N
VisiblePoints               N
VisiblePointsEnd            N
VisiblePointsStart          N
ZoneFxSpeed                 N
Zoom                        N
```

## Notes

- **No `AngleX/Y/Z`** - but `RotoAngleX/Y/Z` and `RotoAccX/Y/Z` exist.
  The `AngleX 30` command writes to `Master.RotoAngleX` (verified via
  feedback check).
- **No bare `Speed`** - instead: `CueSpeed`, `LCSpeed`, `FXSpeed`,
  `ShowSpeed`, `ZoneFxSpeed`, `LCScrollSpeed`, `AnimationSpeed`. The
  `MasterSpeed <v>` command's actual write target is still unknown
  (none of CueSpeed/FXSpeed/ShowSpeed received a callback).
- **No `Size` aggregate** - only `SizeX/Y/Z` and `Zoom`. The `Size <v>`
  command's write target is unknown.
- **`PosX/Y/Z` and `PositionX/Y/Z`** are both present - likely two
  different concepts (perhaps current position vs offset). Untested.
- **`MasterBrightness`** is a separate property from `Brightness`. The
  `Brightness` command writes to `Master.Brightness` (verified Tier 1).
  Direct assignment to `Master.MasterBrightness = 73` did NOT trigger
  feedback - possibly read-only or under different scope.
- **Many `Cue*` properties** - `CueBeatShift`, `CueClockShift`,
  `CueFinishTime`, `CueLcSpeed`, `CuePauseTime`, `CueRule`, `CueSpeed`,
  `CueStartTime`, `CueUnPauseTime`. These reflect the currently active
  cue and may be cue-tab-scoped.
- **OSC address convention**: `/b/Master/<PropertyName>` (case may
  matter - UI shows `Master.Zoom` ↔ `/b/Master/Zoom` with matching case).

## What this list does NOT include

- User-defined universes (SHOWKONTROL/COLORPICKER, etc.) created by
  workspace contents.
- Dynamic per-cue/per-page property surfaces created at runtime.

## Other root-level objects visible in the BEYOND Object Tree

Copied 2026-05-04 from BEYOND's Object Tree.
Each is its own root. For ARRAY-typed objects, indexed entries follow
the OSC convention `/b/<Object>/<index>/<property>` (e.g.
`ColorChannel.0.Color` ↔ `/b/ColorChannel/0/Color`).

### `Status` (read-only system info)

```
CpuUseLong          string
CpuUseShort         string
LaserEnabled        boolean
Locked              boolean
MemAvailExtendedVirtual  number
MemAvailPageFile    number
MemAvailPhys        number
MemAvailVirtual     number
MemTotalPageFile    number
MemTotalPhys        number
MemTotalVirtual     number
MemVirtualUsed      number
MemoryInfo          string
MemoryLoad          number
```

`Status.Projector.Count` (number) and `Status.Projector.ARRAY[N].{Connected (B), FPS, Model (string), Points, Serial}`.

### `VideoOutput1`

```
Height, Left, Top, Width   number
Visible                    boolean
```

### `Beam.ARRAY[N]`

```
Active           boolean
AllowRecolor     boolean
BlankEnd         number
BlankStart       number
Color            number
ColorPalette     number
IsGroup          boolean
LockPos          boolean
Mute             boolean
Name             string
PosX, PosY       number
Power            number
RotoZ            number
SizeX, SizeY     number
```

### `Channels.ARRAY[N]`

```
Attraction       number
Color            number
Friction         number
Mass             number
Name             string
PhActive         boolean
Reflection       number
Value            number
```

### `ColorChannel.ARRAY[N]`

```
B, G, R          number   (per-component, 0..255)
Color            number   (BGR-packed aggregate; see object-model.md)
Mode             number
Name             string
VideoX, VideoY   number
```

`ColorChannel.Count` (number) at the parent level.

### `Config`

```
AnimationSliderMax, AnimationSliderMin    number
CaptureAsLocal                            boolean
FocusMidiClicks                           number
FxRowCount                                number
HideOutputPreviewInMutedProjectionZones   boolean
ScanRateSliderMax                         number   (corrected runtime spelling)
ShowAudioTab                              boolean
SizeSliderMax                             number
```

### `CoreManager`

```
OnlineMode       boolean
```

### `DmxMasters.ARRAY[N]`

```
Value            number
```

### `DmxIO` (has a method!)

```
DoBeep           method
MuteInput        number
MuteOutput       number
```

`DmxIO.DoBeep` is the first method-typed entry seen - confirms BEYOND's
object model exposes callable methods, not just properties. Methods
likely call as `DmxIO.DoBeep` (no args) but invocation syntax is
unverified.

### Other root-level objects (names only - substructure not listed here)

```
DmxOutput
OneCue
MultiCue
Fixture
ActGridFocusedCue, Grid1FocusedCue, Grid2FocusedCue   (boolean indicators)
Gamepad
Grid, Grid2
Skeleton1, Skeleton2
MasterLC
Location
MIDI1, MIDI2, MIDI3, MIDI4
MobSensor
Master      (full subtree listed above)
FX
PlayListState, PlayListState2
ProTrack1
ProTrack2..ProTrack8     (8 numbered ProTrack objects)
ProTrack                 (master)
---DUMMYZONE---          (separator label)
#1..#18                  (workspace zone-alias names - operator-assigned)
---PAIRS---              (separator)
P1..P9                   (workspace zone-alias names - pair labels)
---GROUPS---             (separator)
ALL, SL, SR, ODD, EVEN, G1, G2   (workspace zone-alias names - group labels)
---PIXELMAPS---          (separator)
Map1, Map2, Map3         (workspace zone-alias names - pixelmap labels)
FB3_XXXXX                (hardware identifier - FB3 controller serial)
FB4_XXXXX                (hardware identifier - FB4 controller serial)
Untitled, Selected, QShift, TouchPoints
Universe, DefaultLayout  (DefaultLayout = workspace-named Universe page layout)
UCenter, UTool, URight, UPreview, UMax    (UI panel objects)
UserInterface, WS, Zone
```

### Workspace zone-alias placeholders

The roots listed under DUMMYZONE / PAIRS / GROUPS / PIXELMAPS above
(`#1..#18`, `P1..P9`, `ALL`, `SL`, `SR`, `ODD`, `EVEN`, `G1`, `G2`,
`Map1..Map3`, plus any `ZoneAlias` entry) are **workspace-specific
custom names**, not separate BEYOND-defined namespaces. Each one
points at a zone (or a group/pair/pixelmap of zones), and exposes
**the same property surface as `Zone`** (Active, Alpha, AnimationSpeed,
BeamBrush, Brightness, ColorR, ..., FX1..FX8.*, Effect.*, etc.,
about 187 properties). The set of names you see depends entirely
on what the workspace creator labelled their zones; a fresh
workspace might surface `MyLeftStage`, `Audience`, `CrowdScan`
instead.

The generated Object Tree index uses `ZoneAlias` as a stable placeholder for
this user-configured name class. It is not expected to exist as a literal root
in every show.

Implication for scripting:
- `<alias>.<Zone-property>` works just like `Zone.<index>.<property>`.
  E.g. `P3.Brightness` and `ALL.Brightness` are valid reads/writes
  if the workspace defines those aliases.
- PangoLint's diagnostics shouldn't flag unknown alias names as
  errors. They are user-defined and only validatable against the
  current workspace, not the static catalog. Treat them as
  Zone-property-surface roots and validate properties against the
  Zone schema.
- The `DefaultLayout` root in the same Object Tree source data is a workspace-named
  Universe page layout (UI surface: Caption / CenterX /
  ColorActive / etc.), not a separate BEYOND namespace.
- The generated Object Tree index uses `UniversePanelAlias` for
  user-configured Universe panel names. In generated paths such as
  `UniversePanelAlias.Control.Caption`, replace `UniversePanelAlias`
  with the panel name from the loaded show and `Control` with the
  component name under that panel.

The remaining `FB3_<serial>` / `FB4_<serial>` roots
ARE BEYOND-controlled (the suffix is the hardware serial), and the
workspace-instance source data includes the connected controllers. They DO
differ across labs but the namespace is BEYOND-defined, not
workspace-defined. The generated Object Tree index collapses concrete
serials to `FB3_XXXXX` / `FB4_XXXXX` so agents can recognize the
controller property surface without learning a lab-specific serial.

### `Projector.ARRAY[N]`

Per-projector configuration. `Projector` is itself a root object with
sub-children `ARRAY` and (presumably) `Count`. Verified properties on
`Projector.0`:

```
ColorShift              number
Connected               boolean
DefaultSampleRate       number
Description             struct/string  (icon yellow - possibly nested object)
IdleCenterOffsetX       number
IdleCenterOffsetY       number
InvertX                 boolean
InvertY                 boolean
MaxBlue, MaxGreen, MaxRed       number
MaxSampleRate           number
MinBlue, MinGreen, MinRed       number
MinimumPoints           number
Name                    string
PositionX, PositionY    number
PostRotation            number
PreRotation             number
Serial                  number
SizeX, SizeY            number
SwapXY                  boolean
```

Plus `Projector.0.Optimisation` (yellow icon - nested object):

```
AngleRepeats            number
AngleTable              number
BlankDensity            number
BlankEnd, BlankStart    number
BlankOverlap            number
CornerRepeats           number
DisableCornerFlag       boolean
Enable3dDensity         boolean
EnableAngleTable        boolean
EnableBlankDensity      boolean
EnableSinBlank          boolean
EnableSinVisible        boolean
EnableVisibleDensity    boolean
ForceVectorMode         boolean
IgnoreOriginal          boolean
MinimumPoints           number
NoDot                   boolean
VisibleDensity          number
VisibleEnd, VisibleStart, VisibleOverlap    number
```

**Note**: the attributed example corpus references
`Projector.N.PPSHighLimit`, but it was not present in the Object Tree
data copied for this reference. It may be hidden, deprecated, or
visible only when a different projector context is active.

### `Zone.ARRAY[N]`

Per-projection-zone properties. `Zone` is itself a root object with
`Count` (number) and `ARRAY` children. The OSC address pattern is
`/b/Zone/<index>/<property>` (verified from the BEYOND tree window:
`Zone.0.Zoom` ↔ `/b/Zone/0/Zoom`).

Copied 2026-05-04 from BEYOND Object Tree entries
showing `Zone.0` fully expanded.

**Top-level properties on `Zone.0`**:

```
Active                  boolean
Alpha                   number
AnimationSpeed          number
BeamBrush               number
BlockZone               boolean
Blue                    number
Brightness              number
ColorSlider             number
Count                   number
FX1..FX8                number  (8 entries - see FX-pattern subtree below)
Green                   number
Hue                     number
HueShift                number
Mute                    boolean
Muted                   boolean
Name                    string
OutputPointCount        number
Pan                     number
PosX, PosY, PosZ        number
PositionX, PositionY, PositionZ  number
PreviewAsBeams          boolean
ProjectorConnected      boolean
ProjectorExists         boolean
ProjectorIndex          number
RGBColor                number   (BGR-packed aggregate; see object-model.md)
RatioX, RatioY          number
Red                     number
RotoAccX/Y/Z            number
RotoAngleX/Y/Z          number   (per-zone destination targets for AngleX/Y/Z command)
RotoSpeedX/Y/Z          number
SatShift                number
Saturation              number
ScanRate                number
Selected                boolean
SizeX, SizeY, SizeZ     number
StrobeAcc               number
StrobeSpeed             number
TestFrame               number
Tilt                    number
Visible                 boolean
VisiblePointStart       number
VisiblePoints           number
VisiblePointsEnd        number
VisiblePointsStart      number
VisualizationId         number
Zoom                    number
```

**Per-FX subtree** (`Zone.0.FX{1..8}*` - pattern repeats for FX1 through FX8):

```
FX{N}                   number
FX{N}Action             number
FX{N}Mute               number
FX{N}TimeMulClock       number
FX{N}TimeMulMetro       number
FX{N}TimeScaleClock     number
FX{N}TimeScaleMetro     number
FX{N}TimeShiftClock     number
FX{N}TimeShiftMetro     number
```

(72 properties total across FX1..FX8.)

**`Zone.0.BAM`** (yellow icon - nested object, substructure not listed
here).

**`Zone.0.Effect`** (yellow icon - nested aggregator):

```
ChasePeriod             number
ChaseTimeMode           number
ClockLimit              number
ClockShift              number
EnableClockLimit        number
EnableMetroLimit        number
MetroLimit              number
MetroShift              number
Name                    string
Zone                    string
ZoneMode                number
```

**`Zone.0.Mesh`** (yellow icon - nested object):

```
IndexX, IndexY          number
NodeX, NodeY            number
```

**`Zone.0.Preview`** (yellow icon - visualization config):

```
AsBeams                 number
BeamDiameter            number
ColorOverride           number
FogFrontBrightness      number
FogRearBrightness       number
GauzeSizeX              number
MirrorOutput            number
MirrorXProjector        number
PositionX, PositionY    number
ProjPositionX, ProjPositionY    number
SizeX, SizeY            number
TextureIntencity        number  (sic - BEYOND ships this typo)
TextureScrollSpeed      number
WindowRotation          number
```

**`Zone.0.UGC`** (yellow icon - geometry correction; "User Generated
Content"?):

```
BowOffsetX, BowOffsetY  number
BowX, BowY              number
IndexX, IndexY          number
KeystoneX, KeystoneY    number
LinearityX, LinearityY  number
PincussionOffsetX, PincussionOffsetY    number
PincussionX, PincussionY                number
PositionX, PositionY    number
RotationZ               number
ShearX, ShearY          number
SizeX, SizeY            number
SymmetryOffsetX, SymmetryOffsetY        number
SymmetryX, SymmetryY    number
```

**Cross-references confirmed by this subtree**:

- `Zone.N.RotoAngleX/Y/Z` exists - confirms our prior readback finding
  that `SelectZone N + ControlZone N + AngleX 30` writes to
  `Zone.<N-1>.RotoAngleX` (with the 1-vs-0 indexing offset).
- `Zone.N.RGBColor` is the per-zone color aggregate (analogous to
  `Master.RGBColor`).
- The repeated `FX{N}*` pattern across 8 FX slots matches the
  `Master.FX{N}*` pattern - same FX channel structure at zone scope
  too.
