<script lang="ts">
/**
 * LegDetailDrawer -- the leg side panel.
 *
 * Slides in from the right on a leg click. Shows the full leg payload:
 * distance, true course, magnetic heading, cruise altitude, wind, TAS-
 * derived ground speed, ETE, fuel, plus the cumulative fuel burned up to
 * and including this leg. Closes on the close button, the backdrop, or
 * Esc.
 *
 * Accepts only a full `LegPerformance` -- a placeholder leg has no
 * detail worth a drawer, so the parent guards before opening.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` E.5.
 */

import type { LegPerformance, PerformanceTable } from '@ab/spatial-engine';

interface Props {
	/** Whether the drawer is open. */
	open: boolean;
	/** The leg being detailed (null when closed). */
	leg: LegPerformance | null;
	/** The full performance table -- for the cumulative-fuel computation. */
	performance: PerformanceTable;
	/** Called when the drawer should close. */
	onclose: () => void;
}

let { open, leg, performance, onclose }: Props = $props();

// Cumulative fuel burned up to + including this leg.
const cumulativeFuelGal = $derived.by<number>(() => {
	if (!leg) return 0;
	let sum = 0;
	for (const l of performance.legs) {
		sum += l.fuelGal;
		if (l.from === leg.from && l.to === leg.to) break;
	}
	return sum;
});

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') onclose();
}
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

{#if open && leg}
	<div class="drawer-backdrop" data-testid="leg-drawer-backdrop" role="presentation" onclick={onclose}></div>
	<aside class="leg-drawer" data-testid="leg-drawer" aria-label="Leg detail">
		<header class="drawer-header">
			<h2>Leg {leg.from} -&gt; {leg.to}</h2>
			<button type="button" class="drawer-close" onclick={onclose} aria-label="Close">&times;</button>
		</header>

		<div class="drawer-body">
			<dl class="leg-facts">
				<div><dt>Distance</dt><dd>{leg.distanceNm.toFixed(1)} nm</dd></div>
				<div><dt>True course</dt><dd>{leg.trueCourse.toFixed(0)}°</dd></div>
				<div><dt>Magnetic heading</dt><dd>{leg.magneticHeading.toFixed(0)}°</dd></div>
				<div><dt>Cruise altitude</dt><dd>{leg.altitudeFtMsl.toLocaleString()} ft MSL</dd></div>
				<div><dt>Wind</dt><dd>{leg.windFromDeg.toFixed(0)}° / {leg.windKt.toFixed(0)} kt</dd></div>
				<div><dt>Ground speed</dt><dd>{leg.groundSpeedKt.toFixed(0)} kt</dd></div>
				<div><dt>Time en route</dt><dd>{leg.eteMin.toFixed(0)} min</dd></div>
				<div><dt>Leg fuel</dt><dd>{leg.fuelGal.toFixed(1)} gal</dd></div>
				<div>
					<dt>Cumulative fuel</dt>
					<dd data-testid="leg-cumulative-fuel">{cumulativeFuelGal.toFixed(1)} gal</dd>
				</div>
			</dl>

			<section class="wind-triangle">
				<h3>Wind triangle</h3>
				<p class="triangle-note">
					True course {leg.trueCourse.toFixed(0)}° corrected for {leg.windFromDeg.toFixed(0)}°/{leg.windKt.toFixed(
						0,
					)} kt wind gives a magnetic heading of {leg.magneticHeading.toFixed(0)}° and a
					{leg.groundSpeedKt.toFixed(0)} kt ground speed.
				</p>
			</section>
		</div>
	</aside>
{/if}

<style>
	.drawer-backdrop {
		position: absolute;
		inset: 0;
		background: var(--color-spatial-panel-ink);
		opacity: 0.25;
		z-index: 9;
	}

	.leg-drawer {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(22rem, 90%);
		z-index: 10;
		display: flex;
		flex-direction: column;
		background: var(--color-spatial-panel-bg);
		color: var(--color-spatial-panel-ink);
		border-left: 1px solid var(--color-spatial-panel-border);
		box-shadow: var(--shadow-lg);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-spatial-panel-border);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.drawer-close {
		border: none;
		background: none;
		font-size: var(--font-size-xl);
		line-height: 1;
		cursor: pointer;
		color: inherit;
	}

	.drawer-body {
		overflow-y: auto;
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.leg-facts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2xs) var(--space-sm);
		margin: 0;
	}

	.leg-facts dt {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}

	.leg-facts dd {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.wind-triangle h3 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-sm);
	}

	.triangle-note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}
</style>
