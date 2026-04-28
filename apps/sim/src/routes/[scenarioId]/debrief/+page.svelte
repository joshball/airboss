<script lang="ts">
/**
 * Scenario debrief route. Reads the latest replay tape recorded by
 * the FDM worker via the client-side tape store, validates the
 * scenario hash, and renders a recap.
 *
 * Phase 4 D1.b (this PR) extends the route shell from D1.a with:
 *   - a timeline scrubber over recorded frames
 *   - truth + display dual instrument panels at the scrubbed t
 *   - "fault fired here" tick markers on the slider
 *   - keyboard nav (arrows / home / end)
 *
 * D1.d will add the input tape; D1.e will overlay an ideal path when
 * the scenario authors one.
 */

import {
	type GradeReport,
	type ReplayFrame,
	type ReplayTape,
	type TapeHashValidation,
	validateTapeHash,
} from '@ab/bc-sim';
import { ROUTES, SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { onMount } from 'svelte';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import EngineCluster from '$lib/instruments/cluster/EngineCluster.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import Tachometer from '$lib/instruments/Tachometer.svelte';
import TurnCoordinator from '$lib/instruments/TurnCoordinator.svelte';
import Vsi from '$lib/instruments/Vsi.svelte';
import { loadGrade, loadTape } from '$lib/tape-store';
import type { PageData } from './$types';
import IdealPathOverlay from './IdealPathOverlay.svelte';
import InputTrace from './InputTrace.svelte';

let { data }: { data: PageData } = $props();

let tape = $state<ReplayTape | null>(null);
let grade = $state<GradeReport | null>(null);
let validation = $state<TapeHashValidation | null>(null);
let mounted = $state(false);
let frameIndex = $state(0);

onMount(() => {
	tape = loadTape(data.scenario.id);
	if (tape !== null) {
		validation = validateTapeHash(tape, data.scenario);
		// Land the scrubber on the final frame -- that's the moment of
		// outcome, the most useful starting view for any debrief.
		frameIndex = Math.max(0, tape.frames.length - 1);
		grade = loadGrade(data.scenario.id);
	}
	mounted = true;
});

const gradeTotalPct = $derived(grade ? Math.round(grade.total * 100) : 0);

function componentLabel(kind: GradeReport['components'][number]['kind']): string {
	switch (kind) {
		case 'altitude_hold':
			return 'Altitude hold';
		case 'heading_hold':
			return 'Heading hold';
		case 'airspeed_hold':
			return 'Airspeed hold';
		case 'stall_margin':
			return 'Stall margin';
		case 'reaction_time':
			return 'Reaction time';
		case 'ideal_path_match':
			return 'Ideal path match';
		default: {
			const _never: never = kind;
			return _never;
		}
	}
}

const outcomeLabel = $derived.by(() => {
	if (tape === null) return null;
	switch (tape.result.outcome) {
		case SIM_SCENARIO_OUTCOMES.SUCCESS:
			return 'Success';
		case SIM_SCENARIO_OUTCOMES.FAILURE:
			return 'Failure';
		case SIM_SCENARIO_OUTCOMES.ABORTED:
			return 'Aborted';
		default:
			return null;
	}
});

const peakAltFt = $derived(tape ? tape.result.peakAltitudeAgl * SIM_FEET_PER_METER : 0);
const maxAlphaDeg = $derived(tape ? (tape.result.maxAlpha * 180) / Math.PI : 0);

const currentFrame = $derived<ReplayFrame | null>(tape?.frames[frameIndex] ?? null);
const startT = $derived(tape && tape.frames.length > 0 ? tape.frames[0].t : 0);
const endT = $derived(tape && tape.frames.length > 0 ? tape.frames[tape.frames.length - 1].t : 0);
const currentT = $derived(currentFrame ? currentFrame.t - startT : 0);

const truth = $derived(currentFrame?.truth ?? null);
const display = $derived(currentFrame?.display ?? null);

const truthKias = $derived(truth ? truth.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const truthAltFt = $derived(truth ? truth.altitude * SIM_FEET_PER_METER : 0);
const truthVsiFpm = $derived(truth ? truth.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const truthHeadingDeg = $derived(truth ? (truth.heading * 180) / Math.PI : 0);
const truthYawDegSec = $derived(truth ? (truth.yawRate * 180) / Math.PI : 0);

const displayKias = $derived(display ? display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND : 0);
const displayAltFt = $derived(display ? display.altitudeMsl * SIM_FEET_PER_METER : 0);
const displayVsiFpm = $derived(display ? display.verticalSpeed * SIM_FEET_PER_METER * 60 : 0);
const displayHeadingDeg = $derived(display ? (display.headingIndicated * 180) / Math.PI : 0);
const displayYawDegSec = $derived(display ? (display.yawRateIndicated * 180) / Math.PI : 0);

/** Frame indices where any fault fired -- rendered as ticks under the slider. */
const faultEdges = $derived<readonly number[]>(
	tape === null ? [] : tape.frames.map((f, i) => (f.firedThisTick.length > 0 ? i : -1)).filter((i) => i >= 0),
);

function backToCockpit(): void {
	if (typeof window === 'undefined') return;
	window.location.href = ROUTES.SIM_SCENARIO(data.scenario.id);
}

function onScrubKey(event: KeyboardEvent): void {
	if (tape === null) return;
	const last = tape.frames.length - 1;
	switch (event.key) {
		case 'ArrowRight':
		case 'l':
			event.preventDefault();
			frameIndex = Math.min(last, frameIndex + 1);
			break;
		case 'ArrowLeft':
		case 'h':
			event.preventDefault();
			frameIndex = Math.max(0, frameIndex - 1);
			break;
		case 'Home':
		case '0':
			event.preventDefault();
			frameIndex = 0;
			break;
		case 'End':
		case '$':
			event.preventDefault();
			frameIndex = last;
			break;
	}
}
</script>

<svelte:head>
	<title>{data.scenario.title} -- Debrief</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<h1>{data.scenario.title} -- Debrief</h1>
	</header>

	{#if !mounted}
		<p class="status">Loading tape...</p>
	{:else if tape === null}
		<section class="empty" role="status">
			<h2>No flight on record.</h2>
			<p>Fly the scenario in the cockpit first; the debrief is built from the replay tape.</p>
			<button type="button" onclick={backToCockpit}>Open cockpit</button>
		</section>
	{:else if validation && !validation.matches}
		<section class="stale" role="alert">
			<h2>Scenario has changed since you flew it.</h2>
			<p>
				The recorded tape was made against a different definition (hash
				<code>{validation.tapeHash}</code>; current
				<code>{validation.currentHash}</code>). Re-fly the scenario to refresh the debrief.
			</p>
			<button type="button" onclick={backToCockpit}>Open cockpit</button>
		</section>
	{:else}
		<section class="summary" aria-label="Outcome summary">
			<h2>{outcomeLabel}</h2>
			<p class="reason">{tape.result.reason}</p>
			<dl>
				<dt>Elapsed time</dt>
				<dd>{tape.result.elapsedSeconds.toFixed(1)} s</dd>
				<dt>Peak altitude AGL</dt>
				<dd>{peakAltFt.toFixed(0)} ft</dd>
				<dt>Max alpha</dt>
				<dd>{maxAlphaDeg.toFixed(1)} deg</dd>
				<dt>Frames recorded</dt>
				<dd>{tape.frames.length}</dd>
			</dl>
		</section>

		{#if tape.frames.length > 0}
			<section class="scrubber" aria-label="Replay timeline">
				<div class="scrub-meta">
					<span class="t">t = {currentT.toFixed(1)} s</span>
					<span class="frame-count">frame {frameIndex + 1} / {tape.frames.length}</span>
				</div>
				<div class="scrub-track" role="presentation">
					<input
						type="range"
						min="0"
						max={tape.frames.length - 1}
						bind:value={frameIndex}
						onkeydown={onScrubKey}
						aria-label="Scrub replay timeline; arrow keys to step, home / end to jump"
					/>
					{#if faultEdges.length > 0}
						<ul class="fault-ticks" aria-label="Faults fired">
							{#each faultEdges as idx (idx)}
								<li
									class="fault-tick"
									style:left={`${(idx / Math.max(1, tape.frames.length - 1)) * 100}%`}
									title={`Fault fired at t=${(tape.frames[idx].t - startT).toFixed(1)}s`}
								></li>
							{/each}
						</ul>
					{/if}
				</div>
				<div class="scrub-help">
					Arrow keys / h / l to step; Home or 0 to start; End or $ to outcome. Run is {(endT - startT).toFixed(1)} seconds long.
				</div>
				{#if currentFrame && currentFrame.activations.length > 0}
					<p class="active-faults">
						Active faults at this frame: {currentFrame.activations.map((a) => a.kind).join(', ')}.
					</p>
				{/if}
			</section>

			{#if grade}
				<section class="grade" aria-label="Scenario grade">
					<header class="grade-head">
						<h3>Grade</h3>
						<span class="grade-total" aria-label={`Weighted total ${gradeTotalPct} percent`}>
							{gradeTotalPct}%
						</span>
					</header>
					<p class="panel-help">
						Per-component quality signals beyond pass/fail. Each component scores 0..1 inside its tolerance band and decays linearly to 0 at the hard-fail boundary.
					</p>
					<ol class="grade-components">
						{#each grade.components as component (component.kind)}
							{@const pct = Math.round(component.score * 100)}
							{@const weightPct = Math.round(component.weight * 100)}
							<li class="grade-component">
								<div class="grade-row">
									<span class="grade-label">{componentLabel(component.kind)}</span>
									<span class="grade-weight">w {weightPct}%</span>
									<span class="grade-score">{pct}%</span>
								</div>
								<div
									class="grade-bar"
									role="meter"
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={pct}
									aria-label={`${componentLabel(component.kind)} score`}
								>
									<div class="grade-fill" style:width={`${pct}%`}></div>
								</div>
								{#if component.summary}
									<p class="grade-summary">{component.summary}</p>
								{/if}
							</li>
						{/each}
					</ol>
				</section>
			{/if}

			<section class="input-tape" aria-label="Pilot input traces">
				<h3>Inputs</h3>
				<p class="panel-help">Throttle, elevator, aileron, and rudder commands across the run. Playhead tracks the scrubber.</p>
				<InputTrace frames={tape.frames} {currentT} />
			</section>

			{#if data.scenario.idealPath}
				<section class="ideal-path" aria-label="Actual versus ideal trajectory">
					<h3>Actual vs Ideal</h3>
					<p class="panel-help">
						Altitude across the run plotted against the scenario's authored target path. The ideal-path is the "good" run authors expected; the gap is what to study in the debrief.
					</p>
					<IdealPathOverlay frames={tape.frames} idealPath={data.scenario.idealPath} {currentT} />
				</section>
			{/if}

			<section class="dual" aria-label="Truth versus display panels">
				<article class="panel">
					<h3>Truth</h3>
					<p class="panel-help">What the airplane was actually doing.</p>
					<div class="row">
						<Asi kias={truthKias} />
						<AttitudeIndicator pitchRadians={truth?.pitch ?? 0} rollRadians={truth?.roll ?? 0} />
						<Altimeter altitudeFeet={truthAltFt} />
					</div>
					<div class="row">
						<TurnCoordinator yawRateDegPerSec={truthYawDegSec} slipBall={truth?.slipBall ?? 0} />
						<HeadingIndicator headingDeg={truthHeadingDeg} />
						<Vsi fpm={truthVsiFpm} />
					</div>
					<div class="row tach-row">
						<Tachometer rpm={truth?.engineRpm ?? 0} />
					</div>
				</article>

				<article class="panel">
					<h3>Display</h3>
					<p class="panel-help">What the cockpit gauges showed (post-fault transform).</p>
					<div class="row">
						<Asi kias={displayKias} />
						<AttitudeIndicator
							pitchRadians={display?.pitchIndicated ?? 0}
							rollRadians={display?.rollIndicated ?? 0}
						/>
						<Altimeter altitudeFeet={displayAltFt} />
					</div>
					<div class="row">
						<TurnCoordinator yawRateDegPerSec={displayYawDegSec} slipBall={display?.slipBall ?? 0} />
						<HeadingIndicator headingDeg={displayHeadingDeg} />
						<Vsi fpm={displayVsiFpm} />
					</div>
					<div class="row tach-row">
						<Tachometer rpm={display?.engineRpm ?? 0} />
						<EngineCluster {display} />
					</div>
				</article>
			</section>
		{:else}
			<section class="empty" role="status">
				<p>No frames were recorded -- the run aborted before the first snapshot fired.</p>
			</section>
		{/if}

		<button type="button" class="run-again" onclick={backToCockpit}>Run again</button>
	{/if}
</main>

<style>
	main {
		max-width: 1280px;
		margin: 0 auto;
		padding: var(--space-md) var(--space-xl);
		color: var(--ink-body);
	}
	header {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		margin-bottom: var(--space-md);
	}
	.back {
		color: var(--ink-muted);
		text-decoration: none;
	}
	.back:hover {
		color: var(--ink-body);
	}
	h1 {
		margin: 0;
		font-size: var(--font-size-lg);
	}
	.status,
	.empty,
	.stale,
	.summary,
	.scrubber,
	.grade,
	.input-tape,
	.ideal-path,
	.dual {
		margin-bottom: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
	}
	.grade-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
	}
	.grade-head h3 {
		margin: 0;
	}
	.grade-total {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xl);
		color: var(--ink-body);
	}
	.grade-components {
		list-style: none;
		margin: var(--space-md) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.grade-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--space-md);
		align-items: baseline;
	}
	.grade-label {
		color: var(--ink-body);
	}
	.grade-weight {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.grade-score {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}
	.grade-bar {
		margin-top: var(--space-2xs);
		height: var(--space-xs);
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}
	.grade-fill {
		height: 100%;
		background: var(--sim-arc-green);
	}
	.grade-summary {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.stale {
		border-color: var(--sim-arc-yellow);
	}
	.summary h2 {
		margin: 0 0 var(--space-xs);
	}
	.reason {
		color: var(--ink-muted);
		margin: 0 0 var(--space-md);
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2xs) var(--space-md);
		margin: 0;
	}
	dt {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	dd {
		margin: 0;
		font-family: var(--font-family-mono);
	}
	.scrubber .scrub-meta {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		margin-bottom: var(--space-2xs);
	}
	.scrubber .scrub-track {
		position: relative;
		padding-bottom: var(--space-md);
	}
	.scrubber input[type='range'] {
		width: 100%;
	}
	.fault-ticks {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 8px;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.fault-tick {
		position: absolute;
		top: 0;
		width: 2px;
		height: 8px;
		transform: translateX(-1px);
		background: var(--sim-arc-red);
	}
	.scrub-help {
		margin-top: var(--space-2xs);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}
	.active-faults {
		margin: var(--space-xs) 0 0;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--sim-arc-yellow);
	}
	.dual {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
	}
	.panel h3 {
		margin: 0 0 var(--space-2xs);
	}
	.panel-help {
		margin: 0 0 var(--space-md);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.row {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
	}
	.tach-row {
		align-items: flex-start;
	}
	button {
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-xs);
		cursor: pointer;
	}
	button:hover {
		background: var(--edge-default);
	}
	.run-again {
		font-weight: 600;
	}
	@media (max-width: 1100px) {
		.dual {
			grid-template-columns: 1fr;
		}
	}
</style>
