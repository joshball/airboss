<script lang="ts">
/**
 * AirportLayer -- the layer-1 airport-symbol renderer.
 *
 * Renders one symbol per airport: a filled circle for a hard-surface
 * field, an open circle for a soft-surface field, per FAA convention.
 * Attended fields carry a tick marker.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` B.3.
 */

import type { AirportRecord } from '@ab/spatial-engine';
import type { GeoProjection } from 'd3-geo';

interface Props {
	/** The region airports. */
	airports: AirportRecord[];
	/** The d3-geo projection. */
	projection: GeoProjection;
	/** Optional click handler. */
	onairportclick?: (airport: AirportRecord) => void;
}

let { airports, projection, onairportclick }: Props = $props();

interface PlacedAirport {
	icao: string;
	name: string;
	cx: number;
	cy: number;
	hardSurface: boolean;
	attended: boolean;
	record: AirportRecord;
}

const placed = $derived.by<PlacedAirport[]>(() => {
	const out: PlacedAirport[] = [];
	for (const a of airports) {
		const p = projection([a.lon, a.lat]);
		if (!p) continue;
		const hardSurface = a.runways.some((r) => r.surface === 'asphalt' || r.surface === 'concrete');
		out.push({ icao: a.icao, name: a.name, cx: p[0], cy: p[1], hardSurface, attended: a.attended, record: a });
	}
	return out;
});
</script>

<g class="airports" data-testid="airport-layer">
	{#each placed as airport (airport.icao)}
		<g
			class="airport-symbol"
			class:airport-hard={airport.hardSurface}
			class:airport-soft={!airport.hardSurface}
			class:airport-attended={airport.attended}
			class:airport-clickable={onairportclick != null}
			data-icao={airport.icao}
			role="button"
			aria-label="Airport {airport.icao}"
			tabindex="0"
			onclick={() => onairportclick?.(airport.record)}
			onkeydown={(e) => {
				if (onairportclick && (e.key === 'Enter' || e.key === ' ')) {
					e.preventDefault();
					onairportclick(airport.record);
				}
			}}
		>
			<circle class="airport-dot" cx={airport.cx} cy={airport.cy} r="4.5" />
			{#if airport.attended}
				<circle class="airport-attended-ring" cx={airport.cx} cy={airport.cy} r="7" />
			{/if}
			<text class="airport-label" x={airport.cx + 9} y={airport.cy + 3}>{airport.icao}</text>
			<title>{airport.icao} -- {airport.name}</title>
		</g>
	{/each}
</g>

<style>
	.airport-symbol {
		cursor: default;
	}

	.airport-clickable {
		cursor: pointer;
	}

	.airport-hard .airport-dot {
		fill: var(--color-spatial-airport-hard);
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 1;
	}

	.airport-soft .airport-dot {
		fill: var(--color-spatial-canvas-bg);
		stroke: var(--color-spatial-airport-soft);
		stroke-width: 2;
	}

	.airport-attended-ring {
		fill: none;
		stroke: var(--color-spatial-airport-hard);
		stroke-width: 1;
		stroke-opacity: 0.5;
	}

	.airport-label {
		fill: var(--color-spatial-symbol-label);
		font-size: var(--font-size-xs);
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--color-spatial-canvas-bg);
		stroke-width: 2.5;
	}
</style>
