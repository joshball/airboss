<script lang="ts">
interface Props {
	/** Runway heading in magnetic degrees (0-359). Default 010. */
	runwayHeading?: number;
	/** Initial wind direction in magnetic degrees (0-359). Default 030. */
	initialWindDirection?: number;
	/** Initial wind speed in knots. Default 15. */
	initialWindSpeed?: number;
	/** Optional max demonstrated crosswind threshold in knots. */
	maxDemoCrosswind?: number;
}

const { runwayHeading = 10, initialWindDirection = 30, initialWindSpeed = 15, maxDemoCrosswind }: Props = $props();

// === Local state ===
// svelte-ignore state_referenced_locally -- initial-value only; parent cannot re-seed
let windDirection: number = $state(initialWindDirection);
// svelte-ignore state_referenced_locally -- initial-value only; parent cannot re-seed
let windSpeed: number = $state(initialWindSpeed);
// svelte-ignore state_referenced_locally -- initial-value only; parent cannot re-seed
let showMaxDemoThreshold: boolean = $state(maxDemoCrosswind !== undefined);
let isDraggingWind: boolean = $state(false);

// === Geometry ===
// Canvas is 400x400 with origin at center. Compass 0 (North) is up, angles increase clockwise.
const SIZE = 400;
const CENTER = SIZE / 2;
const COMPASS_RADIUS = 160;
const RUNWAY_LENGTH = 220;
const RUNWAY_WIDTH = 32;
const WIND_ARROW_LENGTH = 130;

// Convert compass heading (0 = North, clockwise) to SVG radians (0 = East, counter-clockwise).
// Compass N (0 deg) should point up, which in SVG is -y. SVG 0 rad is +x (East).
// So compass angle a -> SVG angle = -90 + a (in degrees), converted to radians.
function compassToRadians(compassDeg: number): number {
	return ((compassDeg - 90) * Math.PI) / 180;
}

function degToRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

// === Derived values ===

/** Signed angle from runway heading to wind direction, normalized to (-180, 180]. */
const signedAngle: number = $derived(normalizeSigned(windDirection - runwayHeading));

/** Absolute angle between wind and runway, 0 to 180. */
const absAngle: number = $derived(Math.abs(signedAngle));

/** Crosswind component (always positive, kt). */
const crosswindComponent: number = $derived(Math.abs(windSpeed * Math.sin(degToRad(signedAngle))));

/** Headwind component. Positive = headwind, negative = tailwind (kt). */
const headwindComponent: number = $derived(windSpeed * Math.cos(degToRad(signedAngle)));

/** True if crosswind exceeds the (active) max demo threshold. */
const overThreshold: boolean = $derived(
	showMaxDemoThreshold && maxDemoCrosswind !== undefined && crosswindComponent > maxDemoCrosswind,
);

/** Is the wind blowing toward the back (tailwind)? */
const isTailwind: boolean = $derived(headwindComponent < 0);

function normalizeSigned(deg: number): number {
	let d = (((deg % 360) + 540) % 360) - 180;
	// Edge: -180 -> 180 for stability on the display.
	if (d === -180) d = 180;
	return d;
}

// === Wind vector (tail of arrow sits outside circle, tip points toward center) ===
// "Wind FROM 030" means wind is coming from 030, blowing toward 210. Arrow points in the
// direction of travel (210 side).
const windTail: { x: number; y: number } = $derived.by(() => {
	const r = compassToRadians(windDirection);
	return {
		x: CENTER + Math.cos(r) * WIND_ARROW_LENGTH,
		y: CENTER + Math.sin(r) * WIND_ARROW_LENGTH,
	};
});

const windTip: { x: number; y: number } = $derived.by(() => {
	const r = compassToRadians(windDirection + 180);
	return {
		x: CENTER + Math.cos(r) * 30,
		y: CENTER + Math.sin(r) * 30,
	};
});

// === Decomposition vectors (drawn from center) ===
// Headwind/tailwind along runway, crosswind perpendicular to runway.
// Scale the kt values to pixel lengths for visualization.
const DECOMP_SCALE = 4; // pixels per knot
const MAX_DECOMP_PX = 130;

function clampDecomp(kt: number): number {
	return Math.max(-MAX_DECOMP_PX, Math.min(MAX_DECOMP_PX, kt * DECOMP_SCALE));
}

/** Crosswind vector from center, perpendicular to runway, pointing in the direction the wind pushes the airplane. */
const crosswindVectorEnd: { x: number; y: number } = $derived.by(() => {
	// Wind FROM positive-signed angle (wind to the RIGHT of runway heading, e.g., runway 010, wind 030)
	// pushes the airplane to the LEFT of the pilot. So the crosswind-push vector points runway-heading - 90.
	// If signedAngle is negative (wind from left), push is to the right: runway-heading + 90.
	const side = signedAngle >= 0 ? -1 : 1;
	const dir = runwayHeading + 90 * side;
	const r = compassToRadians(dir);
	const len = clampDecomp(crosswindComponent);
	return {
		x: CENTER + Math.cos(r) * len,
		y: CENTER + Math.sin(r) * len,
	};
});

/** Headwind vector from center, along runway axis. Positive -> along runway heading (toward approach direction). */
const headwindVectorEnd: { x: number; y: number } = $derived.by(() => {
	// The airplane flies into the wind -- headwind vector points opposite the wind direction, i.e., along runwayHeading when there's a headwind.
	// Visually we show "component of wind along the runway": if headwindComponent >= 0 it points from center toward runwayStart (down-runway), which is where the wind is going.
	const along = headwindComponent;
	const dir = along >= 0 ? runwayHeading + 180 : runwayHeading;
	const r = compassToRadians(dir);
	const len = clampDecomp(Math.abs(along));
	return {
		x: CENTER + Math.cos(r) * len,
		y: CENTER + Math.sin(r) * len,
	};
});

// === Interaction: drag wind arrow around the compass ===

function getSvgPoint(evt: PointerEvent, svg: SVGSVGElement): { x: number; y: number } {
	const rect = svg.getBoundingClientRect();
	const scaleX = SIZE / rect.width;
	const scaleY = SIZE / rect.height;
	return {
		x: (evt.clientX - rect.left) * scaleX,
		y: (evt.clientY - rect.top) * scaleY,
	};
}

function pointToCompass(p: { x: number; y: number }): number {
	const dx = p.x - CENTER;
	const dy = p.y - CENTER;
	// SVG 0 rad is +x (East). Compass 0 is North (up, -y). Compass = atan2(y, x) in SVG, +90.
	const rad = Math.atan2(dy, dx);
	let deg = (rad * 180) / Math.PI + 90;
	deg = ((deg % 360) + 360) % 360;
	return Math.round(deg);
}

function onPointerDown(evt: PointerEvent): void {
	const svg = evt.currentTarget as SVGSVGElement;
	svg.setPointerCapture(evt.pointerId);
	isDraggingWind = true;
	windDirection = pointToCompass(getSvgPoint(evt, svg));
}

function onPointerMove(evt: PointerEvent): void {
	if (!isDraggingWind) return;
	const svg = evt.currentTarget as SVGSVGElement;
	windDirection = pointToCompass(getSvgPoint(evt, svg));
}

function onPointerUp(evt: PointerEvent): void {
	const svg = evt.currentTarget as SVGSVGElement;
	if (svg.hasPointerCapture(evt.pointerId)) {
		svg.releasePointerCapture(evt.pointerId);
	}
	isDraggingWind = false;
}

function onKeyDown(evt: KeyboardEvent): void {
	// Keyboard control: arrow keys rotate wind by 5 degrees, shift for 1 degree.
	const step = evt.shiftKey ? 1 : 5;
	if (evt.key === 'ArrowLeft' || evt.key === 'ArrowDown') {
		evt.preventDefault();
		windDirection = (((windDirection - step) % 360) + 360) % 360;
	} else if (evt.key === 'ArrowRight' || evt.key === 'ArrowUp') {
		evt.preventDefault();
		windDirection = (windDirection + step) % 360;
	}
}

function formatHeading(deg: number): string {
	const normalized = ((Math.round(deg) % 360) + 360) % 360;
	return normalized.toString().padStart(3, '0');
}

function formatSigned(val: number, digits = 0): string {
	const rounded = Number(val.toFixed(digits));
	const sign = rounded > 0 ? '+' : rounded < 0 ? '' : ' ';
	return `${sign}${rounded.toFixed(digits)}`;
}

// Compass cardinal tick labels
const cardinalLabels: { label: string; angle: number }[] = [
	{ label: 'N', angle: 0 },
	{ label: 'E', angle: 90 },
	{ label: 'S', angle: 180 },
	{ label: 'W', angle: 270 },
];

function cardinalPos(angleDeg: number): { x: number; y: number } {
	const r = compassToRadians(angleDeg);
	return {
		x: CENTER + Math.cos(r) * (COMPASS_RADIUS + 18),
		y: CENTER + Math.sin(r) * (COMPASS_RADIUS + 18),
	};
}

// Minor tick marks every 30 degrees on the compass
const compassTicks: number[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function tickStart(angleDeg: number): { x: number; y: number } {
	const r = compassToRadians(angleDeg);
	return {
		x: CENTER + Math.cos(r) * (COMPASS_RADIUS - 8),
		y: CENTER + Math.sin(r) * (COMPASS_RADIUS - 8),
	};
}

function tickEnd(angleDeg: number): { x: number; y: number } {
	const r = compassToRadians(angleDeg);
	return {
		x: CENTER + Math.cos(r) * COMPASS_RADIUS,
		y: CENTER + Math.sin(r) * COMPASS_RADIUS,
	};
}
</script>

<div class="activity">
	<div class="stage">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- compass is an interactive widget via role="application" -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- same: role=application makes pointer/key handlers valid -->
		<svg
			viewBox="0 0 {SIZE} {SIZE}"
			class="compass"
			role="application"
			aria-label="Interactive crosswind component diagram. Drag to change wind direction. Use arrow keys to fine-tune."
			tabindex="0"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onkeydown={onKeyDown}
		>
			<!-- Compass background -->
			<circle cx={CENTER} cy={CENTER} r={COMPASS_RADIUS} class="compass-ring" />

			<!-- Compass ticks -->
			{#each compassTicks as t (t)}
				{@const a = tickStart(t)}
				{@const b = tickEnd(t)}
				<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="compass-tick" />
			{/each}

			<!-- Cardinal labels -->
			{#each cardinalLabels as c (c.label)}
				{@const p = cardinalPos(c.angle)}
				<text x={p.x} y={p.y} class="cardinal" text-anchor="middle" dominant-baseline="middle">
					{c.label}
				</text>
			{/each}

			<!-- Runway (as a rotated rectangle) -->
			<g transform="rotate({runwayHeading - 90} {CENTER} {CENTER})">
				<rect
					x={CENTER - RUNWAY_LENGTH / 2}
					y={CENTER - RUNWAY_WIDTH / 2}
					width={RUNWAY_LENGTH}
					height={RUNWAY_WIDTH}
					class="runway"
					rx="2"
				/>
				<!-- Centerline dashes -->
				<line
					x1={CENTER - RUNWAY_LENGTH / 2 + 10}
					y1={CENTER}
					x2={CENTER + RUNWAY_LENGTH / 2 - 10}
					y2={CENTER}
					class="runway-centerline"
				/>
				<!-- Touchdown end label (where the runway heading points TO) -->
				<text
					x={CENTER + RUNWAY_LENGTH / 2 - 18}
					y={CENTER}
					class="runway-label"
					text-anchor="middle"
					dominant-baseline="middle"
				>
					{formatHeading(runwayHeading).slice(0, 2)}
				</text>
				<text
					x={CENTER - RUNWAY_LENGTH / 2 + 18}
					y={CENTER}
					class="runway-label"
					text-anchor="middle"
					dominant-baseline="middle"
				>
					{formatHeading(runwayHeading + 180).slice(0, 2)}
				</text>
			</g>

			<!-- Headwind decomposition vector (runway axis) -->
			<line
				x1={CENTER}
				y1={CENTER}
				x2={headwindVectorEnd.x}
				y2={headwindVectorEnd.y}
				class="decomp headwind-line"
				class:tailwind={isTailwind}
				marker-end="url(#arrow-headwind)"
			/>

			<!-- Crosswind decomposition vector (perpendicular to runway) -->
			<line
				x1={CENTER}
				y1={CENTER}
				x2={crosswindVectorEnd.x}
				y2={crosswindVectorEnd.y}
				class="decomp crosswind-line"
				class:over={overThreshold}
				marker-end="url(#arrow-crosswind)"
			/>

			<!-- Wind vector arrow (from compass edge toward center) -->
			<line
				x1={windTail.x}
				y1={windTail.y}
				x2={windTip.x}
				y2={windTip.y}
				class="wind-arrow"
				marker-end="url(#arrow-wind)"
			/>
			<!-- Drag handle -->
			<circle
				cx={windTail.x}
				cy={windTail.y}
				r={12}
				class="wind-handle"
				class:dragging={isDraggingWind}
			/>

			<!-- Arrowhead markers -->
			<defs>
				<marker id="arrow-wind" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" class="wind-arrowhead" />
				</marker>
				<marker id="arrow-headwind" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" class="headwind-arrowhead" />
				</marker>
				<marker id="arrow-crosswind" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" class="crosswind-arrowhead" />
				</marker>
			</defs>
		</svg>
	</div>

	<div class="panel">
		<section class="readout" aria-live="polite">
			<div class="readout-row">
				<span class="label">Runway</span>
				<span class="value">{formatHeading(runwayHeading)}</span>
			</div>
			<div class="readout-row">
				<span class="label">Wind</span>
				<span class="value">{formatHeading(windDirection)} at {Math.round(windSpeed)} kt</span>
			</div>
			<div class="readout-row">
				<span class="label">Angle (wind - runway)</span>
				<span class="value">{formatSigned(signedAngle)}&deg; ({Math.round(absAngle)}&deg; off)</span>
			</div>
			<hr />
			<div class="readout-row big">
				<span class="label">Crosswind</span>
				<span class="value" class:warn={overThreshold}>
					{crosswindComponent.toFixed(1)} kt
					{#if overThreshold}
						<span class="warn-badge">OVER DEMO</span>
					{/if}
				</span>
			</div>
			<div class="readout-row big">
				<span class="label">{isTailwind ? 'Tailwind' : 'Headwind'}</span>
				<span class="value" class:warn={isTailwind}>
					{Math.abs(headwindComponent).toFixed(1)} kt
					{#if isTailwind}
						<span class="warn-badge">TAILWIND</span>
					{/if}
				</span>
			</div>
			<hr />
			<div class="formula">
				<div>crosswind = wind &times; sin(angle)</div>
				<div>
					= {Math.round(windSpeed)} &times; sin({Math.round(absAngle)}&deg;)
					= {Math.round(windSpeed)} &times; {Math.sin(degToRad(absAngle)).toFixed(2)}
					= {crosswindComponent.toFixed(1)} kt
				</div>
			</div>
		</section>

		<section class="controls">
			<label class="control">
				<span class="control-label">Wind speed: {Math.round(windSpeed)} kt</span>
				<input
					type="range"
					min="0"
					max="50"
					step="1"
					bind:value={windSpeed}
					aria-label="Wind speed in knots"
				/>
			</label>

			<label class="control">
				<span class="control-label">Wind direction: {formatHeading(windDirection)}</span>
				<input
					type="range"
					min="0"
					max="359"
					step="1"
					bind:value={windDirection}
					aria-label="Wind direction in degrees magnetic"
				/>
			</label>

			{#if maxDemoCrosswind !== undefined}
				<label class="control toggle">
					<input type="checkbox" bind:checked={showMaxDemoThreshold} />
					<span>Show max demonstrated crosswind ({maxDemoCrosswind} kt)</span>
				</label>
			{/if}
		</section>
	</div>
</div>

<style>
	.activity {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(280px, 380px);
		gap: var(--space-xl);
		align-items: start;
		font-family: var(--font-family-sans);
		color: var(--ink-body);
	}

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.activity {
			grid-template-columns: 1fr;
		}
	}

	.stage {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.compass {
		width: 100%;
		max-width: 480px;
		aspect-ratio: 1 / 1;
		touch-action: none;
		user-select: none;
		cursor: grab;
		outline: none;
	}

	.compass:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 4px;
		border-radius: var(--radius-md);
	}

	.compass:active {
		cursor: grabbing;
	}

	.compass-ring {
		fill: var(--surface-muted);
		stroke: var(--edge-strong);
		stroke-width: 2;
	}

	.compass-tick {
		stroke: var(--ink-faint);
		stroke-width: 1.5;
	}

	.cardinal {
		font-size: 14px;
		font-weight: 600;
		fill: var(--ink-muted);
	}

	.runway {
		fill: var(--ink-strong);
		stroke: var(--ink-body);
		stroke-width: 1;
	}

	.runway-centerline {
		stroke: var(--surface-sunken);
		stroke-width: 2;
		stroke-dasharray: 6 6;
	}

	.runway-label {
		font-size: 11px;
		font-weight: 700;
		fill: var(--surface-sunken);
	}

	.wind-arrow {
		stroke: var(--signal-info);
		stroke-width: 4;
		stroke-linecap: round;
	}

	.wind-arrowhead {
		fill: var(--signal-info);
	}

	.wind-handle {
		fill: var(--signal-info);
		stroke: var(--surface-panel);
		stroke-width: 3;
		cursor: grab;
		transition: r 0.15s ease;
	}

	.wind-handle.dragging {
		fill: var(--signal-info);
		cursor: grabbing;
	}

	.decomp {
		stroke-width: 3;
		stroke-linecap: round;
	}

	.headwind-line {
		stroke: var(--signal-success);
	}

	.headwind-line.tailwind {
		stroke: var(--action-caution);
	}

	.headwind-arrowhead {
		fill: var(--signal-success);
	}

	.crosswind-line {
		stroke: var(--accent-reference);
	}

	.crosswind-line.over {
		stroke: var(--action-hazard);
	}

	.crosswind-arrowhead {
		fill: var(--accent-reference);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.readout {
		background: var(--surface-page);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-xl);
		font-size: 0.9rem;
	}

	.readout hr {
		border: none;
		border-top: 1px solid var(--edge-default);
		margin: var(--space-md) 0;
	}

	.readout-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-lg);
		padding: 0.15rem 0;
	}

	.readout-row.big {
		font-size: 1rem;
	}

	.readout-row.big .value {
		font-weight: 700;
		font-size: 1.15rem;
	}

	.label {
		color: var(--ink-muted);
	}

	.value {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.value.warn {
		color: var(--action-hazard);
	}

	.warn-badge {
		display: inline-block;
		margin-left: var(--space-sm);
		padding: 0.1rem 0.45rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--action-hazard);
		background: var(--action-hazard);
		border-radius: var(--radius-xs);
		vertical-align: middle;
	}

	.formula {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--ink-strong);
		line-height: 1.55;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.control.toggle {
		flex-direction: row;
		align-items: center;
		gap: var(--space-sm);
	}

	.control-label {
		font-size: 0.85rem;
		color: var(--ink-strong);
		font-weight: 500;
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--signal-info);
	}

	input[type='checkbox'] {
		accent-color: var(--signal-info);
	}
</style>
