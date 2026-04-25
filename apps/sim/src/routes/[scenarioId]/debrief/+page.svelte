<script lang="ts">
/**
 * Scenario debrief route. Reads the latest replay tape recorded by
 * the FDM worker via the client-side tape store, validates the
 * scenario hash, and renders a recap.
 *
 * Phase 4 D1.a (this PR) ships the route shell + tape loading +
 * outcome summary. Subsequent D1 PRs add:
 *   - timeline scrubber (D1.b)
 *   - truth-vs-display dual panels (D1.c)
 *   - input tape (D1.d)
 *   - ideal-path overlay (D1.e)
 */

import { type ReplayTape, type TapeHashValidation, validateTapeHash } from '@ab/bc-sim';
import { ROUTES, SIM_FEET_PER_METER, SIM_KNOTS_PER_METER_PER_SECOND, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { onMount } from 'svelte';
import { loadTape } from '$lib/tape-store.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

let tape = $state<ReplayTape | null>(null);
let validation = $state<TapeHashValidation | null>(null);
let mounted = $state(false);

onMount(() => {
	tape = loadTape(data.scenario.id);
	if (tape !== null) validation = validateTapeHash(tape, data.scenario);
	mounted = true;
});

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

function backToCockpit(): void {
	if (typeof window === 'undefined') return;
	window.location.href = ROUTES.SIM_SCENARIO(data.scenario.id);
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
				<dt>Faults activated</dt>
				<dd>
					{#if tape.frames.length === 0}
						0
					{:else}
						{tape.frames[tape.frames.length - 1].activations.length}
					{/if}
				</dd>
			</dl>
		</section>

		<section class="placeholder" aria-label="Replay timeline placeholder">
			<h3>Timeline scrubber lands in D1.b</h3>
			<p>
				The replay tape carries {tape.frames.length} frames covering
				{tape.frames.length > 0 ? (tape.frames[tape.frames.length - 1].t - tape.frames[0].t).toFixed(1) : '0.0'} seconds.
				The next debrief PR adds a scrubber to step through truth + display state at any moment in the run.
			</p>
		</section>

		<button type="button" class="run-again" onclick={backToCockpit}>Run again</button>
	{/if}
</main>

<style>
	main {
		max-width: 880px;
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
	.placeholder {
		margin-bottom: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
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
</style>
