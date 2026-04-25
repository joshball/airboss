<script lang="ts">
/**
 * Cockpit page. Full six-pack + tach, control input panel, V-speeds, WX,
 * stall horn, scenario banner, keybindings help, reset-confirm overlay.
 *
 * Control model: spring-centered ramp for primary surfaces + hold-to-adjust
 * throttle. Elevator/aileron/rudder deflect while a direction key is held
 * and return to neutral on release (yoke spring). Throttle ramps while
 * Shift/Ctrl is held and holds position on release. A requestAnimationFrame
 * loop ticks the ramp; keydown/keyup track which ramp actions are pressed.
 * Trim and flaps stay tap-based through `resolveKey`.
 */

import {
	C172_CONFIG,
	type DisplayState,
	type FdmInputs,
	type FdmTruthState,
	flapsChanged,
	type ScenarioRunResult,
	type ScenarioStepState,
	shouldSoundGearWarning,
} from '@ab/bc-sim';
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
import { type RampAction, resolveKey, resolveRampAction } from '$lib/control-handler';
import { tickRamp } from '$lib/control-ramp';
import { EngineSound } from '$lib/engine-sound.svelte';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import EngineCluster from '$lib/instruments/cluster/EngineCluster.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import Tachometer from '$lib/instruments/Tachometer.svelte';
import TurnCoordinator from '$lib/instruments/TurnCoordinator.svelte';
import Vsi from '$lib/instruments/Vsi.svelte';
import AnnunciatorStrip from '$lib/panels/AnnunciatorStrip.svelte';
import AudioCaptions from '$lib/panels/AudioCaptions.svelte';
import CockpitNarration from '$lib/panels/CockpitNarration.svelte';
import ControlInputs from '$lib/panels/ControlInputs.svelte';
import KeybindingsHelp from '$lib/panels/KeybindingsHelp.svelte';
import KeyboardCheatsheet from '$lib/panels/KeyboardCheatsheet.svelte';
import ResetConfirm from '$lib/panels/ResetConfirm.svelte';
import ScenarioStepBanner from '$lib/panels/ScenarioStepBanner.svelte';
import VSpeeds from '$lib/panels/VSpeeds.svelte';
import WxPanel from '$lib/panels/WxPanel.svelte';
import { StallHorn } from '$lib/stall-horn.svelte';
import { AltitudeAlert, ApDisconnect, captionStore, FlapMotor, GearWarning, MarkerBeacon } from '$lib/warning-cues';
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
let outcome = $state<ScenarioRunResult | null>(null);
let stepState = $state<ScenarioStepState | null>(null);
let helpOpen = $state(false);
let resetConfirmOpen = $state(false);
let muted = $state(false);
let bootError = $state<string | null>(null);
let readyTimer: ReturnType<typeof setTimeout> | null = null;
const WORKER_READY_TIMEOUT_MS = 5_000;

const pressedActions = new Set<RampAction>();
let rampFrame: number | null = null;
let lastRampTs = 0;

// WCAG 2.1.4: users on screen readers need to disable character-key
// shortcuts so Shift/Ctrl (throttle) do not collide with AT modifier chords.
let keyboardControlEnabled = $state(true);

const horn = new StallHorn();
const engineSound = new EngineSound();
const gearWarning = new GearWarning();
const flapMotor = new FlapMotor();
const markerBeacon = new MarkerBeacon();
const altitudeAlert = new AltitudeAlert();
const apDisconnect = new ApDisconnect();
let lastFlaps: number | null = null;

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
			display = msg.display;
			inputs = msg.inputs;
			running = msg.running;
			stepState = msg.stepState ?? null;
			// Drive the stall horn off truth AoA, not airspeed.
			horn.setActive(msg.truth.stallWarning || msg.truth.stalled);
			// Engine sound follows RPM / throttle / AoA / TAS each snapshot.
			engineSound.update(
				{
					throttle: msg.inputs.throttle,
					rpm: msg.truth.engineRpm,
					alphaRad: msg.truth.alpha,
					trueAirspeed: msg.truth.trueAirspeed,
				},
				C172_CONFIG.idleRpm,
			);
			// Warning cue dispatch -- pure functions in @ab/bc-sim decide,
			// the cue classes own the audio + caption side effects.
			// gearDown is hard-wired true for the fixed-gear C172; flip when
			// retractable airframes (PA28-R / C182RG) land in Phase 6.
			gearWarning.setActive(
				shouldSoundGearWarning(msg.inputs.throttle, msg.truth.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND, true),
			);
			if (lastFlaps !== null && flapsChanged(lastFlaps, msg.inputs.flaps)) {
				flapMotor.trigger();
			}
			lastFlaps = msg.inputs.flaps;
			// Marker-beacon trigger source lives in Phase 4 navaid work; pass
			// null today so the cue stays armed but silent.
			markerBeacon.setKind(null);
			altitudeAlert.observeAltitude(msg.truth.altitude * SIM_FEET_PER_METER);
			break;
		}
		case SIM_WORKER_MESSAGES.OUTCOME: {
			outcome = msg.result;
			running = false;
			horn.setActive(false);
			// Quiet the engine for the debrief.
			engineSound.stop();
			gearWarning.stop();
			flapMotor.stop();
			markerBeacon.stop();
			altitudeAlert.stop();
			apDisconnect.stop();
			break;
		}
	}
}

function firstGesture(): void {
	horn.ensureStarted();
	engineSound.ensureStarted();
	gearWarning.ensureStarted();
	flapMotor.ensureStarted();
	markerBeacon.ensureStarted();
	altitudeAlert.ensureStarted();
	apDisconnect.ensureStarted();
}

function handleSpecial(special: string): void {
	horn.ensureStarted();
	engineSound.ensureStarted();
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
			engineSound.setMuted(muted);
			gearWarning.setMuted(muted);
			flapMotor.setMuted(muted);
			markerBeacon.setMuted(muted);
			altitudeAlert.setMuted(muted);
			apDisconnect.setMuted(muted);
			if (browser) localStorage.setItem(SIM_STORAGE_KEYS.MUTE, muted ? 'true' : 'false');
			break;
		}
	}
}

function performReset(): void {
	resetConfirmOpen = false;
	outcome = null;
	horn.setActive(false);
	engineSound.resume();
	gearWarning.setActive(false);
	altitudeAlert.resume();
	apDisconnect.resume();
	captionStore.reset();
	lastFlaps = null;
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

	const rampAction = resolveRampAction(event);
	if (rampAction !== null) {
		event.preventDefault();
		firstGesture();
		pressedActions.add(rampAction);
		return;
	}

	// Block OS-level autorepeat from spamming tap-based actions (trim, flaps).
	if (event.repeat) return;

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

function onKeyUp(event: KeyboardEvent): void {
	const rampAction = resolveRampAction(event);
	if (rampAction === null) return;
	pressedActions.delete(rampAction);
	event.preventDefault();
}

function releaseAllRampKeys(): void {
	pressedActions.clear();
}

function tickInputs(ts: number): void {
	if (lastRampTs === 0) lastRampTs = ts;
	const dt = Math.min(0.1, (ts - lastRampTs) / 1000);
	lastRampTs = ts;

	const next = tickRamp(
		{
			elevator: inputs.elevator,
			aileron: inputs.aileron,
			rudder: inputs.rudder,
			throttle: inputs.throttle,
		},
		pressedActions,
		dt,
	);

	const patch: Partial<FdmInputs> = {};
	let changed = false;
	if (next.elevator !== inputs.elevator) {
		patch.elevator = next.elevator;
		changed = true;
	}
	if (next.aileron !== inputs.aileron) {
		patch.aileron = next.aileron;
		changed = true;
	}
	if (next.rudder !== inputs.rudder) {
		patch.rudder = next.rudder;
		changed = true;
	}
	if (next.throttle !== inputs.throttle) {
		patch.throttle = next.throttle;
		changed = true;
	}

	if (changed) {
		inputs = { ...inputs, ...patch };
		post({ type: SIM_WORKER_MESSAGES.INPUT, inputs: patch });
	}

	rampFrame = requestAnimationFrame(tickInputs);
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
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', releaseAllRampKeys);
	window.addEventListener('pointerdown', firstGesture);

	lastRampTs = 0;
	rampFrame = requestAnimationFrame(tickInputs);

	// Mute state -- shared across every cockpit audio source.
	muted = localStorage.getItem(SIM_STORAGE_KEYS.MUTE) === 'true';
	horn.setMuted(muted);
	engineSound.setMuted(muted);
	gearWarning.setMuted(muted);
	flapMotor.setMuted(muted);
	markerBeacon.setMuted(muted);
	altitudeAlert.setMuted(muted);
	apDisconnect.setMuted(muted);

	// First-visit help overlay
	const dismissed = localStorage.getItem(SIM_STORAGE_KEYS.HELP_DISMISSED) === 'true';
	if (!dismissed) {
		helpOpen = true;
	}
});

onDestroy(() => {
	if (!browser) return;
	window.removeEventListener('keydown', onKeyDown);
	window.removeEventListener('keyup', onKeyUp);
	window.removeEventListener('blur', releaseAllRampKeys);
	window.removeEventListener('pointerdown', firstGesture);
	if (rampFrame !== null) cancelAnimationFrame(rampFrame);
	rampFrame = null;
	if (readyTimer !== null) clearTimeout(readyTimer);
	horn.destroy();
	engineSound.destroy();
	gearWarning.destroy();
	flapMotor.destroy();
	markerBeacon.destroy();
	altitudeAlert.destroy();
	apDisconnect.destroy();
	captionStore.reset();
	worker?.terminate();
	worker = null;
});

// Instruments read from `display` -- the fault-aware view. When no
// faults are active display equals truth field-for-field. AGL is an
// out-of-truth-only quantity (no fault lies about ground elevation
// today) so we still derive it from `truth`.
const kias = $derived(display ? display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const altitudeFeet = $derived(display ? display.altitudeMsl * SIM_FEET_PER_METER : 0);
const altitudeAglFeet = $derived(truth ? (truth.altitude - truth.groundElevation) * SIM_FEET_PER_METER : 0);
const vsiFpm = $derived(display ? display.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const pitchRad = $derived(display ? display.pitchIndicated : 0);
const rollRad = $derived(display ? display.rollIndicated : 0);
const headingDeg = $derived(display ? (display.headingIndicated * 180) / Math.PI : 0);
const yawRateDegPerSec = $derived(display ? (display.yawRateIndicated * 180) / Math.PI : 0);
const slipBallValue = $derived(display?.slipBall ?? 0);
const rpm = $derived(display?.engineRpm ?? 0);
const stallWarning = $derived(display?.stallWarning ?? false);
const stalled = $derived(display?.stalled ?? false);
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
		</div>
		<div class="header-actions">
			<label class="auto-coord-toggle">
				<input type="checkbox" checked={inputs.autoCoordinate} onchange={onAutoCoordClick} />
				Auto-coordinate rudder
			</label>
			<button
				type="button"
				class="icon-button"
				onclick={() => handleSpecial(SIM_KEYBINDING_ACTIONS.PAUSE)}
				aria-label={running ? 'Playing. Click to pause.' : 'Paused. Click to resume.'}
				title={running ? 'Playing -- click to pause' : 'Paused -- click to resume'}
				disabled={!ready || outcome !== null}
			>
				{#if running}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
						<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
						<rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
						<path d="M7 5 L19 12 L7 19 Z" fill="currentColor" />
					</svg>
				{/if}
			</button>
			<button
				type="button"
				class="icon-button"
				class:muted-state={muted}
				onclick={() => handleSpecial(SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE)}
				aria-label={muted ? 'Sound is muted. Click to unmute.' : 'Sound is on. Click to mute.'}
				title={muted ? 'Sound is muted -- click to unmute' : 'Sound is on -- click to mute'}
				aria-pressed={muted}
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
					<!-- Speaker body (always shown). -->
					<path d="M3 9 L3 15 L7 15 L12 19 L12 5 L7 9 Z" fill="currentColor" />
					{#if muted}
						<!-- Diagonal slash for the muted state. -->
						<line x1="15" y1="6" x2="22" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					{:else}
						<!-- Three sound waves for the sound-on state. -->
						<path
							d="M15 10 Q17 12 15 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
						<path
							d="M17 8 Q20 12 17 16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					{/if}
				</svg>
			</button>
			<button
				type="button"
				class="icon-button help-button"
				onclick={() => { helpOpen = true; }}
				aria-label="Open keyboard help overlay"
				title="Keyboard help (?)"
			>
				<span aria-hidden="true">?</span>
			</button>
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
			<!-- Readout bar sits above the six-pack: Time over ASI, Alpha / AOA
				 over the attitude indicator, AGL over the altimeter. -->
			<div class="readouts">
				<div class="readout">
					<span class="label">Time</span>
					<span class="value">{truth ? truth.t.toFixed(1) : '0.0'}s</span>
				</div>
				<div class="readout" class:warning={stalled}>
					<span class="label">Alpha / AOA</span>
					<span class="value">{truth ? ((truth.alpha * 180) / Math.PI).toFixed(1) : '0.0'}°</span>
				</div>
				<div class="readout">
					<span class="label">AGL</span>
					<span class="value">{altitudeAglFeet.toFixed(0)} ft</span>
				</div>
			</div>
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
				<EngineCluster {display} />
			</div>
			<AnnunciatorStrip {display} />
		</section>

		<CockpitNarration {display} />

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

	<section
		class="status status-{outcome ? (outcomeIsSuccess ? 'success' : 'failure') : !ready ? 'connecting' : running ? 'flying' : 'paused'}"
		role="status"
		aria-live="polite"
	>
		<div class="status-body">
			<span class="status-badge" aria-hidden="true">
				{#if outcome}
					{outcomeIsSuccess ? '✓' : '✗'}
				{:else if !ready}
					…
				{:else if running}
					▶
				{:else}
					⏸
				{/if}
			</span>
			<span class="status-label">
				{#if outcome}
					{outcomeIsSuccess ? 'SUCCESS' : 'FAILURE'} -- {outcome.reason}
				{:else if !ready}
					Connecting to FDM...
				{:else if running}
					Flying
				{:else}
					Paused -- press Space to fly
				{/if}
			</span>
		</div>
		{#if outcome}
			<button type="button" class="reset-button" onclick={performReset}>Reset (Shift+R)</button>
		{/if}
	</section>

	<KeyboardCheatsheet />
	<AudioCaptions />
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
		/* Tight vertical rhythm -- the cockpit needs to fit 1280x800 without
		   a scrollbar. Padding top/bottom kept minimal; horizontal gives the
		   panels breathing room. */
		padding: var(--space-sm) var(--space-xl) var(--space-md);
	}

	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-md);
		align-items: center;
		margin-bottom: var(--space-sm);
	}

	.back {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--font-size-body);
		white-space: nowrap;
	}

	.back:hover {
		color: var(--ink-body);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-lg);
		line-height: 1.2;
	}

	.header-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.auto-coord-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
		cursor: pointer;
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-xs);
		padding: 0;
		cursor: pointer;
		color: var(--ink-body);
		transition: background-color var(--motion-fast), color var(--motion-fast);
	}

	.icon-button:hover {
		background: var(--edge-default);
	}

	.icon-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon-button.muted-state {
		color: var(--sim-status-danger-strong);
		border-color: var(--sim-status-danger-strong);
		background: var(--sim-muted-state-bg);
	}

	.icon-button.help-button {
		font-family: var(--font-family-mono);
		font-weight: 700;
		font-size: var(--font-size-base);
	}

	.objective-banner {
		padding: var(--space-sm) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-sm);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(620px, 1fr) 260px;
		gap: var(--space-md);
		margin-bottom: var(--space-sm);
	}

	.six-pack {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.row {
		display: grid;
		grid-template-columns: repeat(3, 200px);
		gap: var(--space-sm);
		justify-content: center;
	}

	.engine-row {
		display: flex;
		justify-content: center;
		gap: var(--space-sm);
	}

	/* Readout bar sits above the six-pack. Width matches the three top-row
	   instruments (3 * 200px + 2 gaps) so Time / Alpha+AOA / AGL line up
	   directly above the ASI / AI / Altimeter column. */
	.readouts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
		width: calc(200px * 3 + var(--space-sm) * 2);
		margin: 0 auto;
	}

	.readout {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-sm) var(--space-sm);
		background: var(--surface-panel);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
	}

	.readout.warning {
		border-color: var(--sim-arc-red);
		background: var(--sim-readout-warning-bg);
	}

	.readout .label {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.readout .value {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-base);
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.status {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-lg);
		background: var(--surface-panel);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
		border-left-width: 4px;
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-sm);
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.status-body {
		display: inline-flex;
		align-items: center;
		gap: var(--space-md);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-body);
		font-weight: bold;
		background: var(--surface-panel);
		border: 1px solid currentColor;
	}

	.status-label {
		font-weight: 600;
	}

	/*
	 * Visual lanes -- each lifecycle state gets a distinct border-left color,
	 * background tint, and badge glyph so Connecting / Flying / Paused /
	 * SUCCESS / FAILURE read as separate states without relying on color alone.
	 * Colors read from the sim role tokens (`--sim-status-*` / `--sim-panel-*`)
	 * so the palette is centralized per theme.
	 */
	.status-connecting {
		border-left-color: var(--sim-panel-border);
		background: var(--sim-panel-bg-elevated);
		color: var(--sim-panel-fg-muted);
	}

	.status-flying {
		border-left-color: var(--sim-status-primary);
		background: var(--sim-banner-info-bg);
		color: var(--sim-status-primary-fg);
	}

	.status-paused {
		border-left-color: var(--sim-status-warning);
		background: var(--sim-status-warning-bg);
		color: var(--sim-status-warning);
	}

	.status-success {
		border-left-color: var(--sim-status-success);
		background: var(--sim-status-success-bg);
		color: var(--sim-status-success-fg);
	}

	.status-failure {
		border-left-color: var(--sim-status-danger);
		background: var(--sim-status-danger-bg);
		color: var(--sim-status-danger-fg);
	}

	@media (prefers-reduced-motion: reduce) {
		.status {
			transition: none;
		}
	}

	.reset-button {
		background: var(--sim-status-danger);
		color: var(--action-default-ink);
		border: none;
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-xs);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.reset-button:hover {
		background: var(--sim-status-danger-strong);
	}

	@media (max-width: 960px) { /* breakpoint-lg */
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.boot-error {
		background: var(--sim-status-danger-bg);
		border: 1px solid var(--action-hazard);
		color: var(--sim-status-danger-fg);
		border-radius: var(--radius-sm);
		padding: var(--space-md) var(--space-lg);
		margin-bottom: var(--space-md);
	}
	.boot-error h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-base);
	}
	.boot-error p {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.boot-error .retry {
		background: var(--action-hazard);
		color: var(--action-default-ink);
		border: none;
		border-radius: var(--radius-xs);
		padding: var(--space-2xs) var(--space-md);
		cursor: pointer;
	}
	.kb-toggle {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2xs) var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-xs);
		background: var(--surface-panel);
	}
	.kb-toggle small {
		grid-column: 1 / -1;
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}
</style>
