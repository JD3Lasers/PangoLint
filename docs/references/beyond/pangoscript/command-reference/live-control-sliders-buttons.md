---
category: Live Control sliders buttons
order: 12
---
# Live Control sliders buttons

Continuous-scroll button bindings for each Live Control slider. Each command takes a speed argument (typically -5..−1 or 1..5; zero stops); BEYOND scrolls the corresponding slider while the button is held. These commands replicate the click-and-hold scroll buttons visible next to each LC slider.

## Commands

### ClickScrollSize / ClickScrollZoom / ClickScrollFade / ClickScrollVPoints / ClickScrollScanRate / ClickScrollAniSpeed

Signature: `ClickScroll<Property> <speed>`

Scroll the named slider at the given speed. Stop with `<speed>`
of `0`.

Parameters:
- speed (integer, −5..5): scroll speed. Negative = decrease,
 positive = increase, 0 = stop. Recommended ±1..±5.

Example:

    ClickScrollSize 5 // scroll Size up at speed 5
    ClickScrollSize 0 // stop

Safety: T2 - visible Live Control change while scrolling.

Related: each one's corresponding Live Control property command (in
the upcoming Live Control properties section).

### ClickScrollColor / ClickScrollHue / ClickScrollHueShift / ClickScrollSaturation

Signature: `ClickScroll<ColorProperty> <speed>`

Scroll the master Color slider, the Hue, the HueShift, or the
Saturation slider. `ClickScrollHue`, `ClickScrollHueShift`, and
`ClickScrollSaturation` are not documented in the Pangolin Wiki but
follow the same pattern.

Parameters:
- speed (integer, −5..5): scroll speed. 0 = stop.

Example:

    ClickScrollHue 2

Safety: T2 - visible color change while scrolling.

Related: `ClickScrollR`, `ClickScrollColor`.

### ClickScrollR / ClickScrollG / ClickScrollB / ClickScrollA

Signature: `ClickScroll<Channel> <speed>`

Scroll the Red / Green / Blue / Alpha color channel slider on the
routed Live Control destination.

Parameters:
- speed (integer, −5..5): scroll speed. 0 = stop.

Example:

    ClickScrollR 1 // ramp up Red
    ClickScrollA -3 // ramp down Alpha

Safety: T2 - visible color change while scrolling.

Related: `ClickScrollColor`, `ClickScrollHue`, `ClickScrollSaturation`.

### ClickScrollBeamBrush

Signature: `ClickScrollBeamBrush <speed>`

Scroll the Beam Brush slider. Not documented in the Pangolin Wiki
but follows the same pattern. The Beam Brush parameter is
laser-specific - controls beam thickness/density.

Parameters:
- speed (integer, −5..5): scroll speed. 0 = stop.

Example:

    ClickScrollBeamBrush 1

Safety: T2 - visible beam-shape change while scrolling.
