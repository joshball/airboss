<script lang="ts">
/**
 * Dual surface: horizon view + a minimal instrument strip composed
 * side-by-side from independently-authored components. Demonstrates
 * the loose-coupling architecture for Phase 7 -- the same components
 * (Horizon3D, the atomic instrument widgets) drop in next to each
 * other with no cross-imports between them.
 *
 * This page hosts the FDM worker; both the 3D view and the gauges
 * read the SNAPSHOT stream off the same worker instance.
 *
 * Future: a follow-up extracts a `CockpitPanel.svelte` from the cockpit
 * route's gauge stack so the dual page can render the full six-pack
 * + cluster, not just the three primary gauges. Out of scope for the
 * initial Phase 7 PR; the architecture stays the same either way.
 */

import type { DisplayState, FdmTruthState } from '@ab/bc-sim';
import { ROUTES, SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND, SIM_WORKER_MESSAGES } from '@ab/constants';
import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Horizon3D from '$lib/horizon/Horizon3D.svelte';
import ScenarioSurfaceNav from '$lib/horizon/ScenarioSurfaceNav.svelte';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import type { MainToWorker, WorkerToMain } from '$lib/worker-protocol';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

let worker = $state<Worker | null>(null);
let truth = $state<FdmTruthState | null>(null);
let display = $state<DisplayState | null>(null);
let bootError = $state<string | null>(null);

function post(msg: MainToWorker): void {
	worker?.postMessage(msg);
}

function handleWorkerMessage(event: MessageEvent<WorkerToMain>): void {
	const msg = event.data;
	if (msg.type === SIM_WORKER_MESSAGES.SNAPSHOT) {
		truth = msg.truth;
		display = msg.display;
	}
}

function startWorker(): void {
	if (!browser) return;
	worker?.terminate();
	bootError = null;
	const w = new FdmWorker();
	worker = w;
	w.addEventListener('message', handleWorkerMessage);
	w.addEventListener('error', (e) => {
		bootError = e.message || 'Failed to start the flight dynamics worker.';
	});
	post({ type: SIM_WORKER_MESSAGES.INIT, scenarioId: data.scenario.id });
	post({ type: SIM_WORKER_MESSAGES.START });
}

onMount(() => {
	startWorker();
});

onDestroy(() => {
	worker?.terminate();
	worker = null;
});

const pitchRadians = $derived(truth?.pitch ?? 0);
const rollRadians = $derived(truth?.roll ?? 0);
const headingRadians = $derived(truth?.heading ?? 0);
const altitudeMeters = $derived(truth?.altitude ?? 0);
const groundElevationMeters = $derived(truth?.groundElevation ?? 0);

const displayKias = $derived(display ? display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const displayAltFt = $derived(display ? display.altitudeMsl * SIM_FEET_PER_METER : 0);
const displayHeadingDeg = $derived(display ? (display.headingIndicated * 180) / Math.PI : 0);
</script>

<svelte:head>
	<title>{data.scenario.title} -- Dual</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<div class="title-block">
			<h1>{data.scenario.title}</h1>
			<ScenarioSurfaceNav scenarioId={data.scenario.id} current="dual" />
		</div>
	</header>

	{#if bootError}
		<section class="error" role="alert">
			<h2>Sim could not start.</h2>
			<p>{bootError}</p>
		</section>
	{:else}
		<div class="layout">
			<section class="horizon-pane" aria-label="3D horizon">
				<Horizon3D {pitchRadians} {rollRadians} {headingRadians} {altitudeMeters} {groundElevationMeters} />
			</section>
			<section class="instrument-pane" aria-label="Primary instruments">
				<div class="row">
					<Asi kias={displayKias} />
					<AttitudeIndicator
						pitchRadians={display?.pitchIndicated ?? 0}
						rollRadians={display?.rollIndicated ?? 0}
					/>
					<Altimeter altitudeFeet={displayAltFt} />
				</div>
				<div class="row">
					<HeadingIndicator headingDeg={displayHeadingDeg} />
				</div>
				<p class="help">
					Primary instruments only. The full panel composes on the cockpit page; this surface demonstrates that the 3D view and the instrument widgets render side-by-side without any cross-component imports.
				</p>
			</section>
		</div>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		height: 100vh;
		max-height: 100vh;
		color: var(--ink-body);
	}
	header {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		padding: var(--space-md) var(--space-xl);
	}
	.back {
		color: var(--ink-muted);
		text-decoration: none;
	}
	.back:hover {
		color: var(--ink-body);
	}
	.title-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	h1 {
		margin: 0;
		font-size: var(--font-size-lg);
	}
	.layout {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-md);
		margin: 0 var(--space-xl) var(--space-md);
	}
	.horizon-pane,
	.instrument-pane {
		min-height: 0;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		overflow: hidden;
	}
	.instrument-pane {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md);
		overflow: auto;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		justify-content: center;
	}
	.help {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		margin-top: auto;
	}
	.error {
		margin: var(--space-md) var(--space-xl);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--sim-arc-yellow);
		border-radius: var(--radius-sm);
	}
</style>
