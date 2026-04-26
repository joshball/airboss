<script lang="ts">
/**
 * Cockpit page. Full six-pack + tach, control input panel, V-speeds, WX,
 * stall horn, scenario banner, keybindings help, reset-confirm overlay.
 *
 * Control input is delegated to `ControlInput.svelte` -- a pure-prop host
 * that owns keyboard listeners + the spring/ramp loop and emits patches
 * via callbacks. The page wires those callbacks to worker postMessage
 * (and to the system-action handlers for pause / reset / help / mute /
 * brake / auto-coordinate).
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
import { postAttempt } from '$lib/attempt-client';
import CockpitPanel from '$lib/cockpit/CockpitPanel.svelte';
import ControlInput from '$lib/cockpit/ControlInput.svelte';
import type { SpecialAction } from '$lib/control-handler';
import { EngineSound } from '$lib/engine-sound.svelte';
import FdmWorker from '$lib/fdm-worker.ts?worker';
import ScenarioSurfaceNav from '$lib/horizon/ScenarioSurfaceNav.svelte';
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
import { saveGrade, saveTape } from '$lib/tape-store.svelte';
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
/**
 * Number of fault activations the cockpit has seen so far. Activations
 * are sticky in the runner -- once a fault fires it stays in the list
 * for the rest of the run -- so a strict length-grew test cleanly
 * identifies a fresh activation edge without needing identity diffs.
 * Reset on RESET so a re-fly of the same scenario re-arms the trigger.
 */
let lastActivationCount = 0;

function post(msg: MainToWorker): void {
	worker?.postMessage(msg);
}

function postInputPatch(patch: Partial<FdmInputs>): void {
	inputs = { ...inputs, ...patch };
	post({ type: SIM_WORKER_MESSAGES.INPUT, inputs: patch });
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
				C172_CONFIG.maxRpm,
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
			// Marker-beacon trigger -- the worker resolves the active kind
			// against the scenario's authored zones (`def.markerBeacons`)
			// each snapshot. Scenarios with no zones (or aircraft outside
			// every zone) post `null`, which silences the cue.
			markerBeacon.setKind(msg.markerBeaconKind ?? null);
			altitudeAlert.observeAltitude(msg.truth.altitude * SIM_FEET_PER_METER);
			// AP-disconnect cue fires on the edge of any new fault
			// activation. Real airplane semantics: a servo failure or
			// sensor loss kicks the AP off the moment it happens, so
			// the pilot has to take over. The cue itself is one-shot
			// + pulse-timed, so multiple back-to-back activations only
			// produce overlapping pulses, not a continuous tone.
			if (msg.activations.length > lastActivationCount) {
				apDisconnect.firePilotDisconnect();
			}
			lastActivationCount = msg.activations.length;
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
		case SIM_WORKER_MESSAGES.TAPE: {
			// Persist the tape and (when present) the grade report for the
			// debrief route to read. Worker emits TAPE once per run (post-
			// OUTCOME or post-RESET-mid-run); the store overwrites any
			// previous tape/grade for this scenario. Passing
			// `msg.grade === undefined` clears any prior grade so a re-run
			// of an ungraded scenario does not leave a stale grade behind.
			saveTape(msg.tape);
			saveGrade(msg.tape.scenarioId, msg.grade);
			// Server-side persistence (best-effort). Anonymous calls return
			// 401 and stay in sessionStorage; an authenticated user gets a
			// row in `sim.attempt`. Failure here is silent end-to-end --
			// the debrief view still loads from sessionStorage.
			if (outcome) {
				void postAttempt({
					scenarioId: msg.tape.scenarioId,
					result: outcome,
					tape: msg.tape,
					grade: msg.grade ?? null,
				});
			}
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
	lastActivationCount = 0;
	post({ type: SIM_WORKER_MESSAGES.RESET });
	post({ type: SIM_WORKER_MESSAGES.START });
}

function toggleAutoCoordinate(): void {
	post({ type: SIM_WORKER_MESSAGES.TOGGLE_AUTO_COORDINATE });
}

/**
 * Modal-overlay key intercepts. Reset-confirm and help overlays both
 * grab Escape (and Y for reset confirm) before the input host gets a
 * chance to resolve the key. ControlInput calls this for every keydown
 * and skips its own handling when we return true.
 */
function interceptKey(event: KeyboardEvent): boolean {
	if (resetConfirmOpen) {
		if (event.key === 'y' || event.key === 'Y') {
			event.preventDefault();
			performReset();
			return true;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			resetConfirmOpen = false;
			return true;
		}
		// Swallow every other key while the confirm modal is open so
		// flight controls don't fire underneath the dialog.
		return true;
	}
	if (helpOpen && event.key === 'Escape') {
		event.preventDefault();
		helpOpen = false;
		if (browser) localStorage.setItem(SIM_STORAGE_KEYS.HELP_DISMISSED, 'true');
		return true;
	}
	return false;
}

function onControlInput(patch: Partial<FdmInputs>): void {
	postInputPatch(patch);
}

function onControlSpecial(action: SpecialAction): void {
	handleSpecial(action);
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

	// Pointerdown unlocks WebAudio sources for clicks outside the
	// keyboard control path (e.g. the play/pause button). Keyboard-
	// driven first gesture is signalled by ControlInput via
	// `onfirstgesture`.
	window.addEventListener('pointerdown', firstGesture);

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
	window.removeEventListener('pointerdown', firstGesture);
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

// CockpitPanel owns its gauge derivations. The cockpit page only keeps
// the values the side panels (WxPanel, ControlInputs) need, plus the
// outcome banner state.
const headingDeg = $derived(display ? (display.headingIndicated * 180) / Math.PI : 0);
const stallWarning = $derived(display?.stallWarning ?? false);
const stalled = $derived(display?.stalled ?? false);
const outcomeIsSuccess = $derived(outcome?.outcome === SIM_SCENARIO_OUTCOMES.SUCCESS);

// Trim bias rendered on the control panel.
const trimBias = $derived(inputs.trim);
</script>

<svelte:head>
	<title>{data.scenario.title} -- airboss sim</title>
</svelte:head>

<ControlInput
	{inputs}
	enabled={keyboardControlEnabled}
	oninput={onControlInput}
	onspecial={onControlSpecial}
	ontoggleAutoCoordinate={toggleAutoCoordinate}
	onfirstgesture={firstGesture}
	intercept={interceptKey}
/>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<div>
			<h1>{data.scenario.title}</h1>
			<ScenarioSurfaceNav scenarioId={data.scenario.id} current="cockpit" />
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
		<CockpitPanel {truth} {display} />

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
			<div class="outcome-actions">
				<a class="debrief-link" href={ROUTES.SIM_SCENARIO_DEBRIEF(data.scenario.id)}>View debrief</a>
				<button type="button" class="reset-button" onclick={performReset}>Reset (Shift+R)</button>
			</div>
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

	.outcome-actions {
		display: inline-flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.debrief-link {
		color: var(--ink-body);
		text-decoration: none;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-xs);
		font-size: var(--font-size-sm);
	}

	.debrief-link:hover {
		background: var(--edge-default);
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
