<script lang="ts">
/**
 * Cockpit page. Full six-pack + tach, control input panel, V-speeds, WX,
 * stall horn, scenario banner, keybindings help, reset-confirm overlay.
 *
 * Control model: tap-based. Each keypress adjusts a surface by a fixed
 * increment (5% for primary surfaces, 1% for trim). OS key autorepeat
 * drives continued nudges; the `event.repeat` flag is still honored so
 * that the first press registers deterministically.
 */

import type { FdmInputs, FdmTruthState, ScenarioRunResult, ScenarioStepState } from '@ab/bc-sim';
import {
	ROUTES,
	SIM_FEET_PER_METER,
	SIM_KEYBINDING_ACTIONS,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_SCENARIO_OUTCOMES,
	SIM_STORAGE_KEYS,
	SIM_WORKER_MESSAGES,
} from '@ab/constants';
import { onDestroy, onMount, untrack } from 'svelte';
import { browser } from '$app/environment';
import { resolveKey } from '$lib/control-handler';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import Tachometer from '$lib/instruments/Tachometer.svelte';
import TurnCoordinator from '$lib/instruments/TurnCoordinator.svelte';
import Vsi from '$lib/instruments/Vsi.svelte';
import ControlInputs from '$lib/panels/ControlInputs.svelte';
import KeybindingsHelp from '$lib/panels/KeybindingsHelp.svelte';
import ResetConfirm from '$lib/panels/ResetConfirm.svelte';
import ScenarioStepBanner from '$lib/panels/ScenarioStepBanner.svelte';
import VSpeeds from '$lib/panels/VSpeeds.svelte';
import WxPanel from '$lib/panels/WxPanel.svelte';
import { StallHorn } from '$lib/stall-horn.svelte';
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
let inputs = $state<FdmInputs>(untrack(() => initialInputsFrom(data.scenario.initial)));
let running = $state(false);
let ready = $state(false);
let outcome = $state<ScenarioRunResult | null>(null);
let stepState = $state<ScenarioStepState | null>(null);
let helpOpen = $state(false);
let resetConfirmOpen = $state(false);
let muted = $state(false);
let bootError = $state<string | null>(null);
let readyTimer: ReturnType<typeof setTimeout> | null = null;
const WORKER_READY_TIMEOUT_MS = 5_000;

// WCAG 2.1.4: users on screen readers need to disable character-key
// shortcuts so Shift/Ctrl (throttle) do not collide with AT modifier chords.
let keyboardControlEnabled = $state(true);

const horn = new StallHorn();

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
			stepState = msg.stepState ?? null;
			// Drive the stall horn off truth AoA, not airspeed.
			horn.setActive(msg.truth.stallWarning || msg.truth.stalled);
			break;
		}
		case SIM_WORKER_MESSAGES.OUTCOME: {
			outcome = msg.result;
			running = false;
			horn.setActive(false);
			break;
		}
	}
}

function firstGesture(): void {
	horn.ensureStarted();
}

function handleSpecial(special: string): void {
	horn.ensureStarted();
	switch (special) {
		case SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE: {
			post({ type: SIM_WORKER_MESSAGES.TOGGLE_BRAKE });
			break;
		}
		case SIM_KEYBINDING_ACTIONS.PAUSE: {
			if (!ready || outcome) return;
			if (running) post({ type: SIM_WORKER_MESSAGES.PAUSE });
			else post({ type: SIM_WORKER_MESSAGES.RESUME });
			break;
		}
		case SIM_KEYBINDING_ACTIONS.RESET: {
			resetConfirmOpen = true;
			break;
		}
		case SIM_KEYBINDING_ACTIONS.RESET_IMMEDIATE: {
			performReset();
			break;
		}
		case SIM_KEYBINDING_ACTIONS.HELP_TOGGLE: {
			helpOpen = !helpOpen;
			if (!helpOpen && browser) {
				localStorage.setItem(SIM_STORAGE_KEYS.HELP_DISMISSED, 'true');
			}
			break;
		}
		case SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE: {
			muted = !muted;
			horn.setMuted(muted);
			if (browser) localStorage.setItem(SIM_STORAGE_KEYS.MUTE, muted ? 'true' : 'false');
			break;
		}
	}
}

function performReset(): void {
	resetConfirmOpen = false;
	outcome = null;
	horn.setActive(false);
	post({ type: SIM_WORKER_MESSAGES.RESET });
	post({ type: SIM_WORKER_MESSAGES.START });
}

function toggleAutoCoordinate(): void {
	post({ type: SIM_WORKER_MESSAGES.TOGGLE_AUTO_COORDINATE });
}

function onKeyDown(event: KeyboardEvent): void {
	if (!keyboardControlEnabled) return;
	if (resetConfirmOpen) {
		if (event.key === 'y' || event.key === 'Y') {
			event.preventDefault();
			performReset();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			resetConfirmOpen = false;
		}
		return;
	}
	if (helpOpen && event.key === 'Escape') {
		event.preventDefault();
		helpOpen = false;
		if (browser) localStorage.setItem(SIM_STORAGE_KEYS.HELP_DISMISSED, 'true');
		return;
	}

	const resolution = resolveKey(event, inputs);
	if (!resolution) return;
	event.preventDefault();
	firstGesture();

	if (resolution.patch) {
		const next = { ...inputs, ...resolution.patch };
		inputs = next;
		post({ type: SIM_WORKER_MESSAGES.INPUT, inputs: resolution.patch });
	}
	if (resolution.toggleAutoCoordinate) {
		toggleAutoCoordinate();
	}
	if (resolution.special) {
		handleSpecial(resolution.special);
	}
}

function onAutoCoordClick(): void {
	firstGesture();
	toggleAutoCoordinate();
}

function startWorker(): void {
	if (!browser) return;
	worker?.terminate();
	ready = false;
	bootError = null;
	const w = new FdmWorker();
	worker = w;
	w.addEventListener('message', handleWorkerMessage);
	w.addEventListener('error', (e) => {
		bootError = e.message || 'Failed to start the flight dynamics worker.';
	});
	post({ type: SIM_WORKER_MESSAGES.INIT, scenarioId: data.scenario.id });
	post({ type: SIM_WORKER_MESSAGES.START });
	if (readyTimer !== null) clearTimeout(readyTimer);
	readyTimer = setTimeout(() => {
		if (!ready) {
			bootError = 'Sim failed to start within 5 seconds. Check the console and try again.';
		}
	}, WORKER_READY_TIMEOUT_MS);
}

function retryWorker(): void {
	startWorker();
}

onMount(() => {
	if (!browser) return;
	startWorker();

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('pointerdown', firstGesture);

	// Mute state
	muted = localStorage.getItem(SIM_STORAGE_KEYS.MUTE) === 'true';
	horn.setMuted(muted);

	// First-visit help overlay
	const dismissed = localStorage.getItem(SIM_STORAGE_KEYS.HELP_DISMISSED) === 'true';
	if (!dismissed) {
		helpOpen = true;
	}
});

onDestroy(() => {
	if (!browser) return;
	window.removeEventListener('keydown', onKeyDown);
	window.removeEventListener('pointerdown', firstGesture);
	if (readyTimer !== null) clearTimeout(readyTimer);
	horn.destroy();
	worker?.terminate();
	worker = null;
});

const kias = $derived(truth ? truth.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const altitudeFeet = $derived(truth ? truth.altitude * SIM_FEET_PER_METER : 0);
const altitudeAglFeet = $derived(truth ? (truth.altitude - truth.groundElevation) * SIM_FEET_PER_METER : 0);
const vsiFpm = $derived(truth ? truth.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const pitchRad = $derived(truth ? truth.pitch : 0);
const rollRad = $derived(truth ? truth.roll : 0);
const headingDeg = $derived(truth ? (truth.heading * 180) / Math.PI : 0);
const yawRateDegPerSec = $derived(truth ? (truth.yawRate * 180) / Math.PI : 0);
const slipBallValue = $derived(truth?.slipBall ?? 0);
const rpm = $derived(truth?.engineRpm ?? 0);
const stallWarning = $derived(truth?.stallWarning ?? false);
const stalled = $derived(truth?.stalled ?? false);
const outcomeIsSuccess = $derived(outcome?.outcome === SIM_SCENARIO_OUTCOMES.SUCCESS);

// Trim bias rendered on the control panel.
const trimBias = $derived(inputs.trim);
</script>

<svelte:head>
	<title>{data.scenario.title} -- airboss sim</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<div>
			<h1>{data.scenario.title}</h1>
			<p class="objective">{data.scenario.objective}</p>
		</div>
		<div class="header-actions">
			<label class="auto-coord-toggle">
				<input type="checkbox" checked={inputs.autoCoordinate} onchange={onAutoCoordClick} />
				Auto-coordinate
			</label>
			<button type="button" class="mute-button" onclick={() => handleSpecial(SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE)}>
				{muted ? 'Muted' : 'Sound on'}
			</button>
			<button type="button" class="help-button" onclick={() => { helpOpen = true; }}>? Help</button>
		</div>
	</header>

	{#if stepState}
		<ScenarioStepBanner {stepState} />
	{:else}
		<section class="objective-banner">
			<strong>Objective:</strong>
			{data.scenario.objective}
		</section>
	{/if}

	{#if bootError}
		<section class="boot-error" role="alert" aria-live="assertive">
			<h2>Sim failed to start</h2>
			<p>{bootError}</p>
			<button type="button" class="retry" onclick={retryWorker}>Retry</button>
		</section>
	{/if}

	<div class="layout">
		<section class="six-pack">
			<div class="row">
				<Asi {kias} />
				<AttitudeIndicator pitchRadians={pitchRad} rollRadians={rollRad} />
				<Altimeter {altitudeFeet} />
			</div>
			<div class="row">
				<TurnCoordinator {yawRateDegPerSec} slipBall={slipBallValue} />
				<HeadingIndicator {headingDeg} />
				<Vsi fpm={vsiFpm} />
			</div>
			<div class="engine-row">
				<Tachometer {rpm} />
				<div class="readouts">
					<div class="readout">
						<span class="label">AGL</span>
						<span class="value">{altitudeAglFeet.toFixed(0)} ft</span>
					</div>
					<div class="readout" class:warning={stalled}>
						<span class="label">Alpha</span>
						<span class="value">{truth ? ((truth.alpha * 180) / Math.PI).toFixed(1) : '0.0'}°</span>
					</div>
					<div class="readout">
						<span class="label">Time</span>
						<span class="value">{truth ? truth.t.toFixed(1) : '0.0'}s</span>
					</div>
				</div>
			</div>
		</section>

		<aside class="sidebar">
			<ControlInputs {inputs} {trimBias} brakeOn={truth?.brakeOn ?? false} {stallWarning} {stalled} />
			<VSpeeds />
			<WxPanel wind={data.scenario.wind} aircraftHeadingDeg={headingDeg} />
			<label class="kb-toggle">
				<input type="checkbox" bind:checked={keyboardControlEnabled} />
				<span>Keyboard controls active</span>
				<small>Uncheck if using a screen reader; Shift/Ctrl collide with AT modifier chords.</small>
			</label>
		</aside>
	</div>

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
		{#if outcome}
			<button type="button" class="reset-button" onclick={performReset}>Reset (Shift+R)</button>
		{/if}
	</section>
</main>

<KeybindingsHelp
	open={helpOpen}
	onClose={() => {
		helpOpen = false;
		if (browser) localStorage.setItem(SIM_STORAGE_KEYS.HELP_DISMISSED, 'true');
	}}
/>

<ResetConfirm open={resetConfirmOpen} onConfirm={performReset} onCancel={() => { resetConfirmOpen = false; }} />

<style>
	main {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1rem 1.5rem 2rem;
	}

	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 1rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.back {
		color: var(--ab-color-fg-muted, #666);
		text-decoration: none;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.back:hover {
		color: var(--ab-color-fg, #111);
	}

	h1 {
		margin: 0 0 0.1rem;
		font-size: 1.35rem;
	}

	.objective {
		margin: 0;
		color: var(--ab-color-fg-muted, #666);
		font-size: 0.9rem;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.auto-coord-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--ab-color-fg, #111);
		cursor: pointer;
	}

	.mute-button,
	.help-button {
		background: var(--ab-color-surface, #f6f6f6);
		border: 1px solid var(--ab-color-border, #ccc);
		border-radius: 4px;
		padding: 0.3rem 0.65rem;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.mute-button:hover,
	.help-button:hover {
		background: var(--ab-color-border, #eee);
	}

	.objective-banner {
		padding: 0.6rem 0.9rem;
		background: var(--ab-color-surface, #f6f6f6);
		border: 1px solid var(--ab-color-border, #ddd);
		border-radius: 6px;
		font-size: 0.9rem;
		margin-bottom: 0.75rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(640px, 1fr) 280px;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.six-pack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(3, 200px);
		gap: 0.5rem;
		justify-content: center;
	}

	.engine-row {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 0.5rem;
		align-items: start;
	}

	.readouts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
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
		font-size: 0.72rem;
		color: var(--ab-color-fg-muted, #666);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.readout .value {
		font-family: ui-monospace, monospace;
		font-size: 1rem;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.8rem;
		background: var(--ab-color-surface, #f6f6f6);
		border-radius: 6px;
		border: 1px solid var(--ab-color-border, #ddd);
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

	.reset-button {
		background: #e0443e;
		color: #fff;
		border: none;
		padding: 0.35rem 0.8rem;
		border-radius: 4px;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.reset-button:hover {
		background: #c23530;
	}

	@media (max-width: 960px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.boot-error {
		background: var(--ab-color-danger-surface, #fee);
		border: 1px solid var(--ab-color-danger, #c00);
		color: var(--ab-color-danger-strong, #900);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		margin-bottom: 0.75rem;
	}
	.boot-error h2 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
	}
	.boot-error p {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
	}
	.boot-error .retry {
		background: var(--ab-color-danger, #c00);
		color: white;
		border: none;
		border-radius: 0.25rem;
		padding: 0.25rem 0.75rem;
		cursor: pointer;
	}
	.kb-toggle {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		border: 1px solid var(--ab-color-border, #ccc);
		border-radius: 0.375rem;
		background: var(--ab-color-surface, #fff);
	}
	.kb-toggle small {
		grid-column: 1 / -1;
		color: var(--ab-color-fg-muted, #666);
		font-size: 0.75rem;
	}
</style>
