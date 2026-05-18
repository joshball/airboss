<script lang="ts">
/**
 * WaypointDetailDrawer -- the waypoint side panel.
 *
 * Slides in from the right on a waypoint or wx-chip click. Shows the
 * airport detail (via PlateStub), the latest METAR text + parsed flight
 * category, the TAF (when the waypoint is a TAF station), and the AIRMETs
 * the waypoint sits inside. Closes on backdrop click or Esc.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` D.5.
 */

import type { AirmetView, AirportRecord, Waypoint, WaypointWxView } from '@ab/spatial-engine';
import PlateStub from './PlateStub.svelte';

interface Props {
	/** Whether the drawer is open. */
	open: boolean;
	/** The waypoint being detailed (null when closed). */
	waypoint: Waypoint | null;
	/** The projected weather view for the waypoint. */
	wxView: WaypointWxView | null;
	/** The airport record, when the waypoint sits on an airport. */
	airport: AirportRecord | null;
	/** Every AIRMET in the bundle (filtered to membership inside). */
	airmets: AirmetView[];
	/** Called when the drawer should close. */
	onclose: () => void;
}

let { open, waypoint, wxView, airport, airmets, onclose }: Props = $props();

// The AIRMETs whose polygon contains this waypoint.
const memberAirmets = $derived(wxView ? airmets.filter((a) => wxView.airmetIds.includes(a.id)) : []);

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') onclose();
}
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

{#if open && waypoint}
	<!-- The backdrop is a presentational click-to-close affordance; the
	     drawer's own Close button + Esc are the accessible paths. -->
	<div
		class="drawer-backdrop"
		data-testid="waypoint-drawer-backdrop"
		role="presentation"
		onclick={onclose}
	></div>
	<aside class="waypoint-drawer" data-testid="waypoint-drawer" aria-label="Waypoint detail">
		<header class="drawer-header">
			<h2>{waypoint.label}</h2>
			<button type="button" class="drawer-close" onclick={onclose} aria-label="Close">&times;</button>
		</header>

		<div class="drawer-body">
			{#if airport}
				<PlateStub {airport} />
			{:else}
				<p class="drawer-note">En-route fix -- {waypoint.lat.toFixed(3)}, {waypoint.lon.toFixed(3)}</p>
			{/if}

			{#if wxView?.metar}
				<section class="wx-section">
					<h3>METAR <span class="cat cat-{wxView.metar.flightCategory.toLowerCase()}">{wxView.metar.flightCategory}</span></h3>
					<p class="raw-text">{wxView.metar.raw}</p>
					<p class="drawer-note">
						Nearest reporting station: {wxView.metar.station}
						({wxView.metar.stationDistanceNm.toFixed(0)} nm away)
					</p>
				</section>
			{/if}

			{#if wxView?.taf}
				<section class="wx-section">
					<h3>
						TAF
						<span class="cat cat-{wxView.taf.arrivalFlightCategory.toLowerCase()}">
							{wxView.taf.arrivalFlightCategory}
						</span>
					</h3>
					<p class="raw-text">{wxView.taf.raw}</p>
					<p class="drawer-note">
						Forecast station: {wxView.taf.station} ({wxView.taf.stationDistanceNm.toFixed(0)} nm away)
					</p>
				</section>
			{/if}

			{#if memberAirmets.length > 0}
				<section class="wx-section">
					<h3>AIRMETs in effect here</h3>
					<ul class="airmet-list">
						{#each memberAirmets as a (a.id)}
							<li>{a.label}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<p class="drawer-stub">View in flightbag (deep link -- coming soon)</p>
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

	.waypoint-drawer {
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

	.wx-section h3 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-sm);
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.cat {
		font-size: var(--font-size-xs);
		font-weight: 700;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		color: var(--color-spatial-canvas-bg);
	}

	.cat-vfr {
		background: var(--color-spatial-cat-vfr);
	}

	.cat-mvfr {
		background: var(--color-spatial-cat-mvfr);
	}

	.cat-ifr {
		background: var(--color-spatial-cat-ifr);
	}

	.cat-lifr {
		background: var(--color-spatial-cat-lifr);
	}

	.raw-text {
		margin: 0;
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		background: var(--color-spatial-canvas-bg);
		padding: var(--space-2xs);
		border-radius: var(--radius-sm);
	}

	.drawer-note {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}

	.airmet-list {
		margin: 0;
		padding-left: var(--space-md);
		font-size: var(--font-size-sm);
	}

	.drawer-stub {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-style: italic;
	}
</style>
