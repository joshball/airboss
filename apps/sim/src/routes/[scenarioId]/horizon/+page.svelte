<script lang="ts">
/**
 * Outside-the-cockpit horizon view. View-only surface in this initial
 * landing -- spawns the FDM worker for the scenario, watches the
 * snapshot stream, and renders the dumb-prop Horizon3D component.
 *
 * Architectural intent (per Track 4 brief): the cockpit page and the
 * horizon page are siblings, not parent/child. Each spawns its own
 * FDM worker, each is independently complete. This page does not
 * import anything cockpit-internal; the cockpit page does not import
 * Horizon3D. That keeps the two surfaces independently testable and
 * lets future surfaces (avionics, instructor station, replay-only
 * theater) plug in without touching either.
 *
 * Scenarios that explicitly want an outside view link here from
 * their own UI; scenarios that do not stay on the cockpit page only.
 */

import type { FdmTruthState } from '@ab/bc-sim';
import { ROUTES, SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND, SIM_WORKER_MESSAGES } from '@ab/constants';
import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Horizon3D from '$lib/horizon/Horizon3D.svelte';
import ScenarioSurfaceNav from '$lib/horizon/ScenarioSurfaceNav.svelte';
import type { MainToWorker, WorkerToMain } from '$lib/worker-protocol';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

let worker = $state<Worker | null>(null);
let truth = $state<FdmTruthState | null>(null);
let bootError = $state<string | null>(null);

function post(msg: MainToWorker): void {
	worker?.postMessage(msg);
}

function handleWorkerMessage(event: MessageEvent<WorkerToMain>): void {
	const msg = event.data;
	if (msg.type === SIM_WORKER_MESSAGES.SNAPSHOT) {
		truth = msg.truth;
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

// Derived prop streams -- truth is in SI/radians already, the component
// is also SI/radians, so no conversion needed. Defaults keep the camera
// at level / north / sea level until the first snapshot arrives.
const pitchRadians = $derived(truth?.pitch ?? 0);
const rollRadians = $derived(truth?.roll ?? 0);
const headingRadians = $derived(truth?.heading ?? 0);
const altitudeMeters = $derived(truth?.altitude ?? 0);
const groundElevationMeters = $derived(truth?.groundElevation ?? 0);

// Small data overlay -- altitude / heading / KIAS in human units.
const altitudeFt = $derived(altitudeMeters * SIM_FEET_PER_METER);
const headingDeg = $derived(((headingRadians * 180) / Math.PI + 360) % 360);
const kias = $derived((truth?.indicatedAirspeed ?? 0) * SIM_KNOTS_PER_METER_PER_SECOND);
</script>

<svelte:head>
	<title>{data.scenario.title} -- Horizon</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<div class="title-block">
			<h1>{data.scenario.title}</h1>
			<ScenarioSurfaceNav scenarioId={data.scenario.id} current="horizon" />
		</div>
	</header>

	{#if bootError}
		<section class="error" role="alert">
			<h2>Sim could not start.</h2>
			<p>{bootError}</p>
		</section>
	{:else}
		<div class="viewport">
			<Horizon3D {pitchRadians} {rollRadians} {headingRadians} {altitudeMeters} {groundElevationMeters} />
			<div class="readouts" aria-label="Pose readouts">
				<dl>
					<dt>ALT</dt>
					<dd>{altitudeFt.toFixed(0)} ft</dd>
					<dt>HDG</dt>
					<dd>{headingDeg.toFixed(0)}°</dd>
					<dt>KIAS</dt>
					<dd>{kias.toFixed(0)}</dd>
				</dl>
			</div>
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
	.viewport {
		position: relative;
		flex: 1;
		min-height: 0;
		margin: 0 var(--space-xl) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.readouts {
		position: absolute;
		top: var(--space-md);
		right: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}
	.readouts dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2xs) var(--space-md);
		margin: 0;
	}
	.readouts dt {
		color: var(--ink-muted);
	}
	.readouts dd {
		margin: 0;
		text-align: right;
	}
	.error {
		margin: var(--space-md) var(--space-xl);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--sim-arc-yellow);
		border-radius: var(--radius-sm);
	}
</style>
