<script lang="ts">
/**
 * Dual surface: horizon view + the cockpit instrument panel composed
 * side-by-side from independently-authored components. Demonstrates
 * the loose-coupling architecture from ADR 015 -- the same Horizon3D,
 * CockpitPanel, and ControlInput components drop in next to each other
 * with no cross-imports between them.
 *
 * This page hosts the FDM worker; the 3D view, the gauges, and the
 * input host all read / write through the same worker instance.
 *
 * Audio cue dispatch (stall horn, gear, AP disconnect, captions) and
 * the scenario outcome / debrief flow stay on the cockpit page; the
 * dual surface focuses on the visual + input loop.
 */

import type { DisplayState, FdmInputs, FdmTruthState } from '@ab/bc-sim';
import { ROUTES, SIM_KEYBINDING_ACTIONS, SIM_WORKER_MESSAGES } from '@ab/constants';
import { onDestroy, onMount, untrack } from 'svelte';
import { browser } from '$app/environment';
import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte';
import ControlInput from '$lib/cockpit/ControlInput.svelte';
import type { SpecialAction } from '$lib/control-handler';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Horizon3D from '$lib/horizon/Horizon3D.svelte';
import ScenarioSurfaceNav from '$lib/horizon/ScenarioSurfaceNav.svelte';
import type { MainToWorker, WorkerToMain } from '$lib/worker-protocol';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

function initialInputsFrom(init: PageData['scenario']['initial']): FdmInputs {
	return {
		throttle: init.throttle,
		elevator: init.elevator,
		trim: init.trim,
		aileron: init.aileron,
		rudder: init.rudder,
		brake: init.brake,
		autoCoordinate: init.autoCoordinate,
		flaps: init.flaps,
	};
}

let worker = $state<Worker | null>(null);
let truth = $state<FdmTruthState | null>(null);
let display = $state<DisplayState | null>(null);
let inputs = $state<FdmInputs>(untrack(() => initialInputsFrom(data.scenario.initial)));
let running = $state(false);
let ready = $state(false);
let bootError = $state<string | null>(null);

function post(msg: MainToWorker): void {
	worker?.postMessage(msg);
}

function postInputPatch(patch: Partial<FdmInputs>): void {
	inputs = { ...inputs, ...patch };
	post({ type: SIM_WORKER_MESSAGES.INPUT, inputs: patch });
}

function onControlInput(patch: Partial<FdmInputs>): void {
	postInputPatch(patch);
}

function onControlSpecial(action: SpecialAction): void {
	switch (action) {
		case SIM_KEYBINDING_ACTIONS.PAUSE: {
			if (!ready) return;
			if (running) post({ type: SIM_WORKER_MESSAGES.PAUSE });
			else post({ type: SIM_WORKER_MESSAGES.RESUME });
			break;
		}
		case SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE: {
			post({ type: SIM_WORKER_MESSAGES.TOGGLE_BRAKE });
			break;
		}
	}
}

function toggleAutoCoordinate(): void {
	post({ type: SIM_WORKER_MESSAGES.TOGGLE_AUTO_COORDINATE });
}

function handleWorkerMessage(event: MessageEvent<WorkerToMain>): void {
	const msg = event.data;
	switch (msg.type) {
		case SIM_WORKER_MESSAGES.READY: {
			ready = true;
			break;
		}
		case SIM_WORKER_MESSAGES.SNAPSHOT: {
			truth = msg.truth;
			display = msg.display;
			inputs = msg.inputs;
			running = msg.running;
			break;
		}
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
	<title>{data.scenario.title} -- Dual</title>
</svelte:head>

<ControlInput
	{inputs}
	oninput={onControlInput}
	onspecial={onControlSpecial}
	ontoggleAutoCoordinate={toggleAutoCoordinate}
/>

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
			<section class="instrument-pane" aria-label="Cockpit instrument panel">
				<CockpitPanel {truth} {display} />
				<p class="help">
					Full cockpit panel rendered alongside the 3D horizon. All three components (Horizon3D, CockpitPanel, ControlInput) are pure-prop and unaware of each other; this page hosts the FDM worker and feeds them the same SNAPSHOT stream.
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
