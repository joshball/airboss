# Crosswind Component (interactive)

An interactive compass-rose activity that lets a learner decompose a wind vector into headwind and crosswind components relative to a fixed runway, in real time.

## What it teaches

Attached to knowledge node [`perf-crosswind-component`](../../../../course/knowledge/performance/crosswind-component/node.md).

Goals:

- Make the geometric decomposition of a wind vector into runway-axis and cross-runway components physically obvious. You drag the wind; you see the two components shrink and grow; you read the numbers.
- Anchor the sine/cosine relationship to something the learner can feel. At 0 degrees: all headwind. At 90: all crosswind. At 30: exactly half crosswind (the 30-60-90 triangle falls out of the picture). At 45: equal components.
- Provide an "over max demonstrated" visual -- red crosswind vector and warning badge -- so the learner can explore which wind directions put them over the limit for a given airplane.
- Support both coarse reasoning (drag the arrow) and precise computation (slider + live formula readout).

## Where it goes in a learning session

This activity is designed to bridge **Discover** and **Reveal** in the seven-phase content model. The learner has just worked through the decomposition reasoning on paper in Discover; the component lets them verify their intuition and build the perceptual link between angle and crosswind fraction before the formula is formally stated in Reveal.

## Parameters (props)

| Prop                   | Type     | Default | Meaning                                                                                                                 |
| ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `runwayHeading`        | `number` | `10`    | Runway heading in magnetic degrees (0-359). Drawn as a dark runway strip across the compass rose.                       |
| `initialWindDirection` | `number` | `30`    | Starting wind direction in magnetic degrees (0-359). The wind is reported FROM this direction.                          |
| `initialWindSpeed`     | `number` | `15`    | Starting wind speed in knots. Slider range 0-50 kt.                                                                      |
| `maxDemoCrosswind`     | `number` | -       | Optional. If supplied, a toggle appears that turns the crosswind vector red and shows "OVER DEMO" when crosswind exceeds this threshold. |

All props are read-only. Internal state (current wind direction, current wind speed, threshold toggle) is component-local and resets on remount.

## Usage

```svelte
<script lang="ts">
	import CrosswindComponent from '@ab/activities/crosswind-component/CrosswindComponent.svelte';
</script>

<CrosswindComponent
	runwayHeading={270}
	initialWindDirection={310}
	initialWindSpeed={22}
	maxDemoCrosswind={15}
/>
```

The component is self-contained. No back-end calls, no context providers required.

## Interactions

- **Drag the blue wind handle** anywhere on the compass to set the wind direction.
- **Click anywhere on the compass** to snap the wind direction to that bearing.
- **Wind speed slider** to change magnitude.
- **Wind direction slider** for fine control or non-pointer input.
- **Arrow keys** (when the compass has focus): +/- 5 degrees, with Shift held for +/- 1 degree.
- **Max demo threshold toggle** (if `maxDemoCrosswind` prop is supplied): turns the crosswind arrow red and shows a warning badge when over.

Accessibility:

- Compass SVG has `role="application"` + `aria-label` + keyboard support.
- All readouts are inside `aria-live="polite"` so screen readers announce updated values.
- Sliders have explicit `aria-label`s.
- Focus ring visible on the compass when tabbed to.

## Facilitation script (suggested)

The component is designed to be driven by a sequence of questions, not just played with. Here is the intended flow:

1. Start. "Move the wind to 090 (straight across the runway, if runway is 010). What's the crosswind? What's the headwind?"
   Expected: crosswind = full wind speed, headwind = 0. Learner sees the headwind vector collapse to nothing.

2. "Now move it to straight down the runway -- 010 for runway 01. What's the crosswind? What's the headwind?"
   Expected: crosswind = 0, headwind = full wind speed. The crosswind vector vanishes.

3. "Move it halfway between those two -- about 050, so 40 degrees off the runway. Look at the two components. Are they equal? Close to equal? Which is bigger?"
   Expected: Slightly more headwind than crosswind at 40 degrees. Prompts the learner to notice that 45 degrees is the exact-equal point.

4. "Find the angle where crosswind equals headwind exactly. What is it?"
   Expected: 45 degrees (actual: ~055 for runway 010). Confirms the 45-45-90 insight from Discover.

5. "Move to 040 -- 30 degrees off. Look at the crosswind component. What fraction of the total wind speed is it?"
   Expected: Exactly half. This is the 30-60-90 triangle result falling out visually.

6. "Set max demonstrated crosswind to 15 kt and wind to 20 kt. Drag the wind around the compass. At what angles are you 'over'?"
   Expected: Learner discovers the arc of wind directions where the airplane's demonstrated crosswind is exceeded. Emphasizes that the decision depends on direction AND speed together.

7. For CFI candidates: "A student says 'the winds are 20 kt, and max demo is 15, so we can't fly today.' Using the activity, demonstrate why that's not always true."
   Expected: Set wind to 20 kt down the runway direction. Crosswind is 0. Learner sees that wind magnitude alone does not determine whether crosswind is within limits.

## Technical notes

- **Svelte 5 runes only.** `$state`, `$derived`, `$derived.by`, `$props`. No `$:`, no legacy stores, no `<slot>`, no `export let`.
- **Pointer events** (not mouse/touch separately) for unified input handling. `setPointerCapture` keeps drag tracking even if the pointer leaves the SVG bounds.
- **Coordinate system.** Compass 0 (North) = up. Angles increase clockwise. Conversion to SVG (where 0 rad is East, clockwise is +y) is in `compassToRadians()`.
- **Angle normalization.** Signed angle between wind and runway is normalized to (-180, 180] so that the crosswind vector can be drawn on the correct side of the runway (left vs right).
- **Decomposition scaling.** Component vectors are drawn at 4 px/kt, clamped to 130 px so very strong winds do not run off-canvas. Clamping is visual only; the numeric readout shows true values.
- **No animation on arrow movement.** Drag feels most responsive with direct, non-interpolated updates. The wind handle gets a subtle color change while dragging.
- **No back-end, no side effects, no external state.** Safe to mount multiple instances on a page.
- **Self-contained styles.** Uses inline CSS custom properties for colors rather than importing design tokens -- activities are meant to be portable across apps and themes. If this gets adopted into a specific app it can be re-themed via a simple CSS pass.

## Preview

No `preview.png` generated yet. The intended preview:

- Square canvas, neutral light background.
- Compass rose with N/E/S/W labels and minor ticks every 30 degrees.
- Dark runway strip oriented on its heading (e.g., 010), with runway number labels "01" and "19" at each end.
- Blue wind arrow originating from the compass edge (e.g., 030) pointing toward the center, with a circular drag handle at the outer end.
- Green headwind vector from center along the runway axis (toward the approach end).
- Indigo crosswind vector from center perpendicular to the runway.
- Right-hand panel showing: runway, wind dir/speed, signed angle, crosswind and headwind readouts, and the expanded formula `20 * sin(20 deg) = 20 * 0.34 = 6.8 kt`.

When captured, save to `preview.png` at 1200x800 or thereabouts.
