<script lang="ts">
import type { FdmInputs, FdmTruthState, ScenarioRunResult } from '@ab/bc-sim';
import {
	ROUTES,
	SIM_FEET_PER_METER,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_SCENARIO_OUTCOMES,
	SIM_WORKER_MESSAGES,
} from '@ab/constants';
import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import type { MainToWorker, WorkerToMain } from '$lib/worker-protocol';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

let worker = $state<Worker | null>(null);
let truth = $state<FdmTruthState | null>(null);
let inputs = $state<FdmInputs>({ throttle: 0, elevator: 0 });
let running = $state(false);
let ready = $state(false);
let outcome = $state<ScenarioRunResult | null>(null);

// Keyboard-latched command state. We translate these into `inputs` and push
// to the worker at ~30 Hz, so holding a key ramps the input smoothly.
let keyState = $state({
	throttleUp: false,
	throttleDown: false,
	pitchUp: false,
	pitchDown: false,
});

const THROTTLE_RATE_PER_SECOND = 0.6;
const ELEVATOR_RATE_PER_SECOND = 2.0;
const ELEVATOR_CENTER_RATE = 1.5;

let inputTimer: ReturnType<typeof setInterval> | null = null;
let lastInputTick = 0;

function post(msg: MainToWorker): void {
	worker?.postMessage(msg);
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
			inputs = msg.inputs;
			running = msg.running;
			break;
		}
		case SIM_WORKER_MESSAGES.OUTCOME: {
			outcome = msg.result;
			running = false;
			break;
		}
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function tickInputs(): void {
	const now = performance.now();
	const dt = lastInputTick === 0 ? 0 : (now - lastInputTick) / 1000;
	lastInputTick = now;
	if (dt <= 0) return;

	let throttle = inputs.throttle;
	let elevator = inputs.elevator;
	let changed = false;

	if (keyState.throttleUp) {
		throttle = clamp(throttle + THROTTLE_RATE_PER_SECOND * dt, 0, 1);
		changed = true;
	}
	if (keyState.throttleDown) {
		throttle = clamp(throttle - THROTTLE_RATE_PER_SECOND * dt, 0, 1);
		changed = true;
	}
	if (keyState.pitchUp) {
		elevator = clamp(elevator + ELEVATOR_RATE_PER_SECOND * dt, -1, 1);
		changed = true;
	}
	if (keyState.pitchDown) {
		elevator = clamp(elevator - ELEVATOR_RATE_PER_SECOND * dt, -1, 1);
		changed = true;
	} else if (!keyState.pitchUp) {
		// Spring-back toward neutral when no pitch key is held.
		if (elevator > 0) {
			elevator = Math.max(0, elevator - ELEVATOR_CENTER_RATE * dt);
			changed = true;
		} else if (elevator < 0) {
			elevator = Math.min(0, elevator + ELEVATOR_CENTER_RATE * dt);
			changed = true;
		}
	}

	if (changed) {
		inputs = { throttle, elevator };
		post({ type: SIM_WORKER_MESSAGES.INPUT, inputs });
	}
}

function onKeyDown(event: KeyboardEvent): void {
	if (event.repeat) return;
	const key = event.key;
	if (key === 'w' || key === 'W' || key === 'ArrowUp') {
		keyState.pitchUp = true;
		event.preventDefault();
	} else if (key === 's' || key === 'S' || key === 'ArrowDown') {
		keyState.pitchDown = true;
		event.preventDefault();
	} else if (key === 'Shift') {
		keyState.throttleUp = true;
		event.preventDefault();
	} else if (key === 'Control') {
		keyState.throttleDown = true;
		event.preventDefault();
	} else if (key === ' ') {
		event.preventDefault();
		if (!ready || outcome) return;
		if (running) post({ type: SIM_WORKER_MESSAGES.PAUSE });
		else post({ type: SIM_WORKER_MESSAGES.RESUME });
	} else if (key === 'r' || key === 'R') {
		event.preventDefault();
		outcome = null;
		post({ type: SIM_WORKER_MESSAGES.RESET });
		post({ type: SIM_WORKER_MESSAGES.START });
	}
}

function onKeyUp(event: KeyboardEvent): void {
	const key = event.key;
	if (key === 'w' || key === 'W' || key === 'ArrowUp') keyState.pitchUp = false;
	else if (key === 's' || key === 'S' || key === 'ArrowDown') keyState.pitchDown = false;
	else if (key === 'Shift') keyState.throttleUp = false;
	else if (key === 'Control') keyState.throttleDown = false;
}

onMount(() => {
	if (!browser) return;
	const w = new FdmWorker();
	worker = w;
	w.addEventListener('message', handleWorkerMessage);
	post({ type: SIM_WORKER_MESSAGES.INIT, scenarioId: data.scenario.id });
	post({ type: SIM_WORKER_MESSAGES.START });

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);

	inputTimer = setInterval(tickInputs, 33);
});

onDestroy(() => {
	if (!browser) return;
	window.removeEventListener('keydown', onKeyDown);
	window.removeEventListener('keyup', onKeyUp);
	if (inputTimer) clearInterval(inputTimer);
	worker?.terminate();
	worker = null;
});

const kias = $derived(truth ? truth.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const altitudeFeet = $derived(truth ? truth.altitude * SIM_FEET_PER_METER : 0);
const altitudeAglFeet = $derived(truth ? (truth.altitude - truth.groundElevation) * SIM_FEET_PER_METER : 0);
const vsiFpm = $derived(truth ? truth.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const aoaDeg = $derived(truth ? (truth.alpha * 180) / Math.PI : 0);
const pitchRad = $derived(truth ? truth.pitch : 0);
const stalled = $derived(truth ? truth.stalled : false);
const outcomeIsSuccess = $derived(outcome?.outcome === SIM_SCENARIO_OUTCOMES.SUCCESS);
</script>

<svelte:head>
	<title>{data.scenario.title} -- airboss sim</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<h1>{data.scenario.title}</h1>
		<p class="objective">{data.scenario.objective}</p>
	</header>

	<section class="briefing">
		<h2>Briefing</h2>
		<p>{data.scenario.briefing}</p>
	</section>

	<section class="panel">
		<Asi {kias} />
		<AttitudeIndicator pitchRadians={pitchRad} />
		<Altimeter {altitudeFeet} />
	</section>

	<section class="readouts">
		<div class="readout">
			<span class="label">AGL</span>
			<span class="value">{altitudeAglFeet.toFixed(0)} ft</span>
		</div>
		<div class="readout">
			<span class="label">VSI</span>
			<span class="value">{vsiFpm.toFixed(0)} fpm</span>
		</div>
		<div class="readout" class:warning={aoaDeg > 14}>
			<span class="label">AoA</span>
			<span class="value">{aoaDeg.toFixed(1)}°</span>
		</div>
		<div class="readout" class:warning={stalled}>
			<span class="label">Stall</span>
			<span class="value">{stalled ? 'STALL' : 'ok'}</span>
		</div>
	</section>

	<section class="controls">
		<div class="control">
			<span class="label">Throttle</span>
			<div class="bar"><div class="fill" style:width={`${(inputs.throttle * 100).toFixed(0)}%`}></div></div>
			<span class="value">{(inputs.throttle * 100).toFixed(0)}%</span>
		</div>
		<div class="control">
			<span class="label">Elevator</span>
			<div class="bar elevator">
				<div
					class="fill elevator"
					style:width={`${(Math.abs(inputs.elevator) * 50).toFixed(0)}%`}
					style:left={inputs.elevator < 0 ? `${50 - Math.abs(inputs.elevator) * 50}%` : '50%'}
				></div>
				<div class="center-line"></div>
			</div>
			<span class="value">{(inputs.elevator * 100).toFixed(0)}%</span>
		</div>
	</section>

	<section class="status">
		<div>
			<strong>Status:</strong>
			{#if outcome}
				<span class={outcomeIsSuccess ? 'ok' : 'fail'}>
					{outcomeIsSuccess ? 'SUCCESS' : 'FAILURE'} -- {outcome.reason}
				</span>
			{:else if !ready}
				Connecting to FDM...
			{:else if running}
				Flying
			{:else}
				Paused -- press Space to fly
			{/if}
		</div>
		{#if truth}
			<div class="clock">t = {truth.t.toFixed(1)} s</div>
		{/if}
	</section>

	<section class="help">
		<h3>Controls</h3>
		<dl>
			<dt>W / &uarr;</dt>
			<dd>Pitch up (elevator back)</dd>
			<dt>S / &darr;</dt>
			<dd>Pitch down (elevator forward)</dd>
			<dt>Shift</dt>
			<dd>Throttle up</dd>
			<dt>Ctrl</dt>
			<dd>Throttle down</dd>
			<dt>Space</dt>
			<dd>Pause / resume</dd>
			<dt>R</dt>
			<dd>Reset scenario</dd>
		</dl>
	</section>
</main>

<style>
	main {
		max-width: 880px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	header {
		margin-bottom: 1rem;
	}

	.back {
		color: var(--ab-color-fg-muted, #666);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back:hover {
		color: var(--ab-color-fg, #111);
	}

	h1 {
		margin: 0.25rem 0;
		font-size: 1.5rem;
	}

	.objective {
		margin: 0;
		color: var(--ab-color-fg-muted, #666);
	}

	.briefing {
		margin: 1rem 0 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--ab-color-surface, #f6f6f6);
		border-radius: 6px;
	}

	.briefing h2 {
		margin: 0 0 0.25rem 0;
		font-size: 0.95rem;
	}

	.briefing p {
		margin: 0;
		font-size: 0.9rem;
	}

	.panel {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.readouts {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.readout {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: var(--ab-color-surface, #f6f6f6);
		border-radius: 6px;
		border: 1px solid var(--ab-color-border, #ddd);
	}

	.readout.warning {
		border-color: #e0443e;
		background: rgba(224, 68, 62, 0.12);
	}

	.readout .label {
		font-size: 0.75rem;
		color: var(--ab-color-fg-muted, #666);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.readout .value {
		font-family: ui-monospace, monospace;
		font-size: 1.1rem;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.control {
		display: grid;
		grid-template-columns: 80px 1fr 60px;
		gap: 0.5rem;
		align-items: center;
	}

	.control .label {
		font-size: 0.85rem;
		color: var(--ab-color-fg-muted, #666);
	}

	.control .value {
		font-family: ui-monospace, monospace;
		text-align: right;
		font-size: 0.9rem;
	}

	.bar {
		position: relative;
		height: 10px;
		background: var(--ab-color-surface, #eee);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar .fill {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		background: var(--ab-color-primary, #2563eb);
	}

	.bar.elevator .fill.elevator {
		background: #ffa62b;
	}

	.bar.elevator .center-line {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		background: rgba(0, 0, 0, 0.3);
	}

	.status {
		display: flex;
		justify-content: space-between;
		padding: 0.6rem 0.8rem;
		background: var(--ab-color-surface, #f6f6f6);
		border-radius: 6px;
		border: 1px solid var(--ab-color-border, #ddd);
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.status .ok {
		color: #2fb856;
		font-weight: bold;
	}

	.status .fail {
		color: #e0443e;
		font-weight: bold;
	}

	.status .clock {
		font-family: ui-monospace, monospace;
		color: var(--ab-color-fg-muted, #666);
	}

	.help {
		margin-top: 1.5rem;
		font-size: 0.85rem;
		color: var(--ab-color-fg-muted, #666);
	}

	.help h3 {
		margin: 0 0 0.4rem 0;
		font-size: 0.9rem;
	}

	.help dl {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 0.2rem 0.8rem;
		margin: 0;
	}

	.help dt {
		font-family: ui-monospace, monospace;
	}

	.help dd {
		margin: 0;
	}
</style>
