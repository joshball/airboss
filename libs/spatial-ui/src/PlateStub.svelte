<script lang="ts">
/**
 * PlateStub -- the airport-detail panel content.
 *
 * Shows the airport metadata the layer-1 geography carries: elevation,
 * runways, frequencies, FBOs. NOT a full instrument-plate viewer -- that
 * is a follow-on WP (`xc-viewer-plates`). Rendered inside the waypoint
 * detail drawer.
 *
 * See `docs/work-packages/xc-viewer-v1/design.md` "What the production lib
 * does NOT do".
 */

import type { AirportRecord } from '@ab/spatial-engine';

interface Props {
	/** The airport to summarize. */
	airport: AirportRecord;
}

let { airport }: Props = $props();
</script>

<section class="plate-stub" data-testid="plate-stub">
	<h3>{airport.icao} -- {airport.name}</h3>
	<dl class="plate-facts">
		<div>
			<dt>Elevation</dt>
			<dd>{airport.elevationFtMsl} ft MSL</dd>
		</div>
		<div>
			<dt>Airspace</dt>
			<dd>Class {airport.airspaceClass}</dd>
		</div>
		<div>
			<dt>Attended</dt>
			<dd>{airport.attended ? 'Towered' : 'Non-towered'}</dd>
		</div>
	</dl>

	<h4>Runways</h4>
	<ul class="plate-list">
		{#each airport.runways as rwy (rwy.designator)}
			<li>
				<strong>{rwy.designator}</strong> -- {rwy.lengthFt} x {rwy.widthFt} ft, {rwy.surface}{#if rwy.hasPrecisionApproach},
					precision approach{/if}
			</li>
		{/each}
	</ul>

	<h4>Frequencies</h4>
	<ul class="plate-list">
		{#each airport.frequencies as freq (freq.label)}
			<li><strong>{freq.label}</strong> {freq.mhz.toFixed(3)}</li>
		{/each}
	</ul>

	{#if airport.fbos.length > 0}
		<h4>FBOs</h4>
		<ul class="plate-list">
			{#each airport.fbos as fbo (fbo.name)}
				<li>{fbo.name} ({fbo.fuel.join(', ')})</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.plate-stub {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	h4 {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.plate-facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2xs);
		margin: 0;
	}

	.plate-facts dt {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}

	.plate-facts dd {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.plate-list {
		margin: 0;
		padding-left: var(--space-md);
		font-size: var(--font-size-sm);
	}

	.plate-list li {
		margin: var(--space-4xs) 0;
	}
</style>
