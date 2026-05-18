<script lang="ts">
/**
 * PerformanceBand -- the sticky performance footer.
 *
 * Renders a footer strip with the per-flight summary: total fuel burn,
 * fuel reserve, total ETE, plus a small CG-envelope graph with the
 * current loaded CG plotted. The reserve color signals safety: green for
 * a comfortable reserve, yellow when thin, red when below the legal
 * minimum.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` E.4.
 */

import type { AircraftSpec, PerformanceTable } from '@ab/spatial-engine';

interface Props {
	/** The derived performance table. */
	performance: PerformanceTable;
	/** The aircraft (for the W&B envelope + capacity). */
	aircraft: AircraftSpec;
}

let { performance, aircraft }: Props = $props();

// VFR day fuel reserve: 30 minutes at cruise burn. 45 min for night.
const cruiseGph = $derived(aircraft.fuelBurnCurve.cruise.defaultGph);
const reserve30MinGal = $derived(cruiseGph * 0.5);
const reserve45MinGal = $derived(cruiseGph * 0.75);

// Reserve state -- drives the footer color.
const reserveState = $derived(
	performance.reserveGal < reserve30MinGal ? 'critical' : performance.reserveGal < reserve45MinGal ? 'low' : 'ok',
);

// Total ETE formatted as "1 h 13 min".
const eteLabel = $derived.by<string>(() => {
	const total = Math.round(performance.totalEteMin);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h} h ${m} min` : `${m} min`;
});

// --- CG envelope mini-graph ---
//
// The envelope is a polygon in (CG inches, weight lb) space. Plot the
// fences as two lines + plot a representative loaded point. v1 uses the
// max-gross weight at the envelope's mid CG as the "current" marker --
// a real W&B form is a follow-on; this shows the envelope is rendered.
const GRAPH_W = 120;
const GRAPH_H = 70;

const cgMin = $derived(Math.min(...aircraft.wbEnvelope.envelope.map((v) => v.fwdCgIn)) - 1);
const cgMax = $derived(Math.max(...aircraft.wbEnvelope.envelope.map((v) => v.aftCgIn)) + 1);
const wMin = $derived(aircraft.wbEnvelope.minWeightLb);
const wMax = $derived(aircraft.wbEnvelope.maxGrossWeightLb);

/** Map a (CG, weight) pair to graph coordinates. */
function plot(cgIn: number, weightLb: number): { x: number; y: number } {
	const x = ((cgIn - cgMin) / (cgMax - cgMin)) * GRAPH_W;
	const y = GRAPH_H - ((weightLb - wMin) / (wMax - wMin)) * GRAPH_H;
	return { x, y };
}

// Envelope polygon: forward fence going up, aft fence coming down.
const envelopePoints = $derived.by<string>(() => {
	const sorted = [...aircraft.wbEnvelope.envelope].sort((a, b) => a.weightLb - b.weightLb);
	const fwd = sorted.map((v) => plot(v.fwdCgIn, v.weightLb));
	const aft = [...sorted].reverse().map((v) => plot(v.aftCgIn, v.weightLb));
	return [...fwd, ...aft].map((p) => `${p.x},${p.y}`).join(' ');
});

// The "loaded" marker -- mid-CG at max gross (a representative point;
// the real W&B form is a follow-on WP).
const loadedCg = $derived((cgMin + cgMax) / 2);
const loadedMarker = $derived(plot(loadedCg, wMax));
</script>

<footer class="performance-band performance-{reserveState}" data-testid="performance-band">
	<div class="perf-stats">
		<div class="perf-stat">
			<span class="perf-label">Total fuel</span>
			<span class="perf-value" data-testid="perf-total-fuel">{performance.totalFuelGal.toFixed(1)} gal</span>
		</div>
		<div class="perf-stat">
			<span class="perf-label">Reserve</span>
			<span class="perf-value perf-reserve" data-testid="perf-reserve">{performance.reserveGal.toFixed(1)} gal</span>
		</div>
		<div class="perf-stat">
			<span class="perf-label">Total time en route</span>
			<span class="perf-value" data-testid="perf-ete">{eteLabel}</span>
		</div>
		<div class="perf-stat">
			<span class="perf-label">Legs</span>
			<span class="perf-value">{performance.legs.length}</span>
		</div>
	</div>

	<div class="perf-wb" aria-label="Weight and balance envelope">
		<span class="perf-label">W&amp;B</span>
		<svg class="wb-graph" viewBox="0 0 {GRAPH_W} {GRAPH_H}" width={GRAPH_W} height={GRAPH_H} role="img" aria-label="CG envelope">
			<polygon class="wb-envelope" points={envelopePoints} />
			<circle class="wb-marker" cx={loadedMarker.x} cy={loadedMarker.y} r="3.5" />
		</svg>
	</div>
</footer>

<style>
	.performance-band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-xs) var(--space-md);
		background: var(--color-spatial-panel-bg);
		color: var(--color-spatial-panel-ink);
		border-top: 1px solid var(--color-spatial-panel-border);
	}

	.perf-stats {
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.perf-stat {
		display: flex;
		flex-direction: column;
	}

	.perf-label {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.perf-value {
		font-size: var(--font-size-lg);
		font-weight: 700;
	}

	.performance-ok .perf-reserve {
		color: var(--color-spatial-reserve-ok);
	}

	.performance-low .perf-reserve {
		color: var(--color-spatial-reserve-low);
	}

	.performance-critical .perf-reserve {
		color: var(--color-spatial-reserve-critical);
	}

	.perf-wb {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3xs);
	}

	.wb-envelope {
		fill: var(--color-spatial-airspace-b);
		fill-opacity: 0.12;
		stroke: var(--color-spatial-airspace-b);
		stroke-width: 1.25;
	}

	.wb-marker {
		fill: var(--color-spatial-reserve-ok);
		stroke: var(--color-spatial-panel-bg);
		stroke-width: 1;
	}
</style>
