<script lang="ts">
/**
 * Windowed cockpit surface: 3D horizon full-bleed with the cockpit
 * instrument panel overlaid as a translucent HUD panel docked at the
 * bottom. Demonstrates the loose-coupling architecture from ADR 015 --
 * the same `Horizon3D` and `CockpitPanel` components that power the
 * horizon-only and dual pages compose here without either component
 * knowing about the other.
 *
 * View-only in this initial landing (no control input handler / audio
 * dispatch -- those live on the cockpit page). Future iteration can
 * extract a `ControlInput.svelte` host the same way `CockpitPanel` was
 * extracted, and the windowed page composes all three.
 */

import type { DisplayState, FdmTruthState } from '@ab/bc-sim';
import { ROUTES, SIM_WORKER_MESSAGES } from '@ab/constants';
import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Horizon3D from '$lib/horizon/Horizon3D.svelte';
import ScenarioSurfaceNav from '$lib/horizon/ScenarioSurfaceNav.svelte';
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
</script>

<svelte:head>
	<title>{data.scenario.title} -- Window</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<div class="title-block">
			<h1>{data.scenario.title}</h1>
			<ScenarioSurfaceNav scenarioId={data.scenario.id} current="window" />
		</div>
	</header>

	{#if bootError}
		<section class="error" role="alert">
			<h2>Sim could not start.</h2>
			<p>{bootError}</p>
		</section>
	{:else}
		<div class="stage">
			<div class="horizon-bg">
				<Horizon3D {pitchRadians} {rollRadians} {headingRadians} {altitudeMeters} {groundElevationMeters} />
			</div>
			<div class="hud-panel" aria-label="Cockpit instrument panel">
				<CockpitPanel {truth} {display} />
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
	/* Stage is the full-bleed horizon viewport with the panel overlaid.
	   `position: relative` anchors the absolute-positioned HUD at the
	   bottom; the horizon background fills the entire stage. */
	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		margin: 0 var(--space-xl) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.horizon-bg {
		position: absolute;
		inset: 0;
	}
	/* Translucent HUD panel docked at the bottom-center. Background
	   alpha keeps the horizon readable behind the gauges; the panel
	   itself stays fully readable because the gauge components paint
	   their own opaque faces. */
	.hud-panel {
		position: absolute;
		left: 50%;
		bottom: var(--space-md);
		transform: translateX(-50%);
		padding: var(--space-md);
		background: color-mix(in srgb, var(--surface-panel) 85%, transparent);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		max-width: calc(100% - var(--space-xl) * 2);
		max-height: calc(100% - var(--space-xl) * 2);
		overflow: auto;
	}
	.error {
		margin: var(--space-md) var(--space-xl);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--sim-arc-yellow);
		border-radius: var(--radius-sm);
	}
</style>
