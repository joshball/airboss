<script lang="ts">
import { type ConfidenceLevel, DIFFICULTY_LABELS, DOMAIN_LABELS, PHASE_OF_FLIGHT_LABELS, ROUTES } from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import { humanize } from '@ab/utils';
import { enhance } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

type Phase = 'read' | 'confidence' | 'choose' | 'submitting' | 'reveal';

interface DomainTally {
	domain: string;
	attempted: number;
	correct: number;
}

// All authoritative batch state lives on `data` (server-derived). Client
// state is only the transient per-slot UI phase: is the user currently
// reading, picking confidence, choosing an option, or looking at the reveal?
//
// A mid-session hard refresh reruns the server load, which re-derives
// currentIndex from rep_attempt rows and hands the user back at the first
// unanswered scenario with the previous attempts already counted.
let phase = $state<Phase>('read');
let revealedAt = $state<number | null>(null);
let confidence = $state<ConfidenceLevel | null>(null);
let selectedOption = $state<string | null>(null);
let lastResultCorrect = $state<boolean | null>(null);
let lastSkippedSubmit = $state(false);
let submitError = $state<string | null>(null);
// `loading` guards the form from double-submit. Set synchronously in the
// enhance callback before the fetch, cleared in the result handler. See:
// `phase` transitions run after the browser already dispatched the click,
// so a `phase`-only guard races the second click.
let loading = $state(false);
// Tracks which slot the transient UI state (phase, confidence, etc.)
// belongs to. When the server advances `currentIndex` after a successful
// submit, this key differs from the current slot's key and the effect
// below wipes the transient state so the next scenario renders fresh.
let lastSlotKey = $state<string | null>(null);

// Read-through tallies derived from the server-authoritative slots array.
// Every slot with an attempt contributes one to `attemptedTotal` (unless
// it's a "skipped" slot, which contributes to `skippedTotal` instead).
const total = $derived(data.total);
const slots = $derived(data.slots);
const currentIndex = $derived(data.currentIndex);
const currentSlot = $derived(currentIndex < slots.length ? slots[currentIndex] : null);
const current = $derived(currentSlot?.kind === 'resolvable' ? currentSlot.scenario : null);
const isComplete = $derived(currentIndex >= slots.length);

const attemptedTotal = $derived(slots.filter((s) => s.kind === 'resolvable' && s.attempt !== null).length);
const correctTotal = $derived(slots.filter((s) => s.kind === 'resolvable' && s.attempt?.isCorrect === true).length);
const skippedTotal = $derived(slots.filter((s) => s.kind === 'skipped').length);
const accuracy = $derived(attemptedTotal === 0 ? 0 : Math.round((correctTotal / attemptedTotal) * 100));

// Domain tallies aggregated from resolved attempts. Rebuilds whenever
// `slots` changes -- cheap for REP_BATCH_SIZE (10).
const domainTallies = $derived.by<Record<string, DomainTally>>(() => {
	const out: Record<string, DomainTally> = {};
	for (const slot of slots) {
		if (slot.kind !== 'resolvable' || !slot.attempt) continue;
		const entry = out[slot.scenario.domain] ?? { domain: slot.scenario.domain, attempted: 0, correct: 0 };
		entry.attempted += 1;
		if (slot.attempt.isCorrect) entry.correct += 1;
		out[slot.scenario.domain] = entry;
	}
	return out;
});

const needsConfidence = $derived(Boolean(current?.promptConfidence));
const chosenOpt = $derived(current?.options.find((o) => o.id === selectedOption));

// When the server advances to a new slot (after a submit reloads data via
// invalidateAll), wipe the transient UI state so the next scenario starts
// in the `read` phase with no carryover confidence / selection / reveal.
$effect(() => {
	const key = isComplete ? '__complete__' : (current?.id ?? `skip:${currentIndex}`);
	if (key !== lastSlotKey) {
		lastSlotKey = key;
		phase = currentSlot?.kind === 'skipped' ? 'reveal' : 'read';
		revealedAt = null;
		confidence = null;
		selectedOption = null;
		lastResultCorrect = null;
		lastSkippedSubmit = currentSlot?.kind === 'skipped';
		submitError = null;
		loading = false;
	}
});

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function difficultyLabel(slug: string): string {
	return (DIFFICULTY_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function phaseLabel(slug: string | null | undefined): string | null {
	if (!slug) return null;
	return (PHASE_OF_FLIGHT_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function proceedToChoose() {
	if (needsConfidence && confidence === null) {
		phase = 'confidence';
		return;
	}
	phase = 'choose';
	revealedAt = Date.now();
}

function pickConfidence(value: ConfidenceLevel) {
	confidence = value;
	phase = 'choose';
	revealedAt = Date.now();
}

function skipConfidence() {
	confidence = null;
	phase = 'choose';
	revealedAt = Date.now();
}

async function advance() {
	// Server holds the queue. We've already recorded the attempt (or the
	// slot is flagged skipped on the server); `invalidateAll` reruns the
	// load fn, which bumps currentIndex to the next unanswered slot. The
	// $effect above wipes the transient UI state once the slot key flips.
	await invalidateAll();
}

async function startNewSession() {
	// A bare REPS_SESSION URL bounces through the first-load redirect,
	// which pulls a fresh batch from getNextScenarios and repins the URL.
	await goto(ROUTES.REPS_SESSION, { invalidateAll: true });
}

function onKeydown(e: KeyboardEvent) {
	// Drop composition events so a live IME (e.g. CJK input) typing a number
	// during confidence capture doesn't accidentally pick a level.
	if (e.isComposing) return;
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (phase === 'read') {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			proceedToChoose();
		}
	} else if (phase === 'confidence') {
		const n = Number(e.key);
		if (Number.isInteger(n) && n >= 1 && n <= 5) {
			e.preventDefault();
			pickConfidence(n as ConfidenceLevel);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			skipConfidence();
		}
	} else if (phase === 'reveal' && (e.key === ' ' || e.key === 'Enter')) {
		e.preventDefault();
		void advance();
	}
}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Rep session -- airboss</title>
</svelte:head>

<section class="page">
	{#if isComplete}
		<article class="summary" role="status">
			<h1>Session complete</h1>
			{#if attemptedTotal > 0}
				<p class="headline">
					<strong>{correctTotal}</strong> / <strong>{attemptedTotal}</strong> correct
					<span class="acc">({accuracy}% accuracy)</span>
				</p>
				{#if skippedTotal > 0}
					<p class="skipped-note">
						{skippedTotal}
						{skippedTotal === 1 ? 'scenario was' : 'scenarios were'} skipped because it was archived mid-session.
					</p>
				{/if}
				<dl class="by-domain">
					{#each Object.values(domainTallies) as t (t.domain)}
						<div>
							<dt>{domainLabel(t.domain)}</dt>
							<dd>{t.correct} / {t.attempted}</dd>
						</div>
					{/each}
				</dl>
			{:else if skippedTotal > 0}
				<p class="headline">
					Every scenario in this batch was archived before it could be attempted.
				</p>
			{:else}
				<p class="headline">
					No scenarios available. Create one to get going, or check back after archiving fewer of them.
				</p>
			{/if}
			<div class="actions">
				<a class="btn ghost" href={ROUTES.REPS}>Back to dashboard</a>
				<a class="btn secondary" href={ROUTES.REPS_NEW}>New scenario</a>
				<button type="button" class="btn primary" onclick={startNewSession}>Another session</button>
			</div>
		</article>
	{:else if currentSlot?.kind === 'skipped'}
		<header class="hd">
			<span class="counter">Rep {currentIndex + 1} of {total}</span>
		</header>
		<article class="card">
			<h2 class="title">Scenario unavailable</h2>
			<p class="situation">
				This scenario was archived before you reached it. Skipping to the next one.
			</p>
		</article>
		<button type="button" class="btn primary wide" onclick={advance}>
			Continue
			<span class="kbd">Space</span>
		</button>
		<div class="progress" aria-hidden="true">
			<div class="progress-fill" style="width: {total === 0 ? 0 : ((currentIndex + 1) / total) * 100}%"></div>
		</div>
	{:else if current}
		<header class="hd">
			<span class="counter">Rep {currentIndex + 1} of {total}</span>
			<div class="tags">
				<span class="badge domain">{domainLabel(current.domain)}</span>
				<span class="badge difficulty difficulty-{current.difficulty}">{difficultyLabel(current.difficulty)}</span>
				{#if phaseLabel(current.phaseOfFlight)}
					<span class="badge phase">{phaseLabel(current.phaseOfFlight)}</span>
				{/if}
			</div>
		</header>

		<article class="card">
			<h2 class="title">{current.title}</h2>
			<div class="section-label">Situation</div>
			<p class="situation">{current.situation}</p>

			{#if phase === 'reveal'}
				<div class="reveal" aria-live="polite">
					<div role="separator" class="sep"></div>
					{#if lastSkippedSubmit}
						<div class="section-label">Skipped</div>
						<p class="chosen">
							This scenario was archived before your attempt could be saved.
							<span class="indicator skipped">Skipped</span>
						</p>
					{:else}
						<div class="section-label">Your choice</div>
						<p class="chosen">
							{#if chosenOpt}
								{chosenOpt.text}
							{/if}
							<span
								class="indicator"
								class:correct={lastResultCorrect === true}
								class:incorrect={lastResultCorrect === false}
							>
								{lastResultCorrect === true ? 'Correct' : 'Incorrect'}
							</span>
						</p>

						<div class="section-label">Outcomes</div>
						<ol class="outcomes">
							{#each current.options as opt (opt.id)}
								<li class:correct={opt.isCorrect} class:chosen={opt.id === selectedOption}>
									<div class="outcome-head">
										<span class="outcome-text">{opt.text}</span>
										<span class="outcome-tag">
											{#if opt.isCorrect}Correct{:else if opt.id === selectedOption}Your choice{/if}
										</span>
									</div>
									<p class="outcome-body">{opt.outcome}</p>
									{#if !opt.isCorrect && opt.whyNot}
										<p class="outcome-whynot"><strong>Why not:</strong> {opt.whyNot}</p>
									{/if}
								</li>
							{/each}
						</ol>

						<div class="section-label">Teaching point</div>
						<p class="teaching">{current.teachingPoint}</p>

						{#if current.regReferences.length > 0}
							<div class="section-label">References</div>
							<ul class="refs">
								{#each current.regReferences as ref (ref)}
									<li>{ref}</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/if}
		</article>

		{#if phase === 'read'}
			<button type="button" class="btn primary wide" onclick={proceedToChoose}>
				Continue
				<span class="kbd">Space</span>
			</button>
		{:else if phase === 'confidence'}
			<ConfidenceSlider
				onSelect={pickConfidence}
				onSkip={skipConfidence}
				prompt="Before you pick -- how confident are you?"
				selected={confidence as ConfidenceLevel | null}
			/>
		{:else if phase === 'choose' || phase === 'submitting'}
			<form
				method="POST"
				action="?/submit"
				use:enhance={({ formData }) => {
					// `loading` is set synchronously inside this callback, before the
					// browser dispatches the next click event. The option buttons
					// below switch to `disabled={loading}` so a rapid second click
					// on a different option cannot fire a second submit before the
					// first one lands.
					if (loading) return () => Promise.resolve();
					loading = true;
					const clickedOption = String(formData.get('chosenOption') ?? '');
					selectedOption = clickedOption;
					phase = 'submitting';
					const answerMs = revealedAt !== null ? Date.now() - revealedAt : '';
					formData.set('answerMs', String(answerMs));
					if (confidence !== null) formData.set('confidence', String(confidence));
					return async ({ result, update }) => {
						// Don't let SvelteKit rerun load on this branch -- we handle
						// the result manually. Previously this page relied on client
						// state carrying across, which is the exact bug being fixed.
						await update({ reset: false });
						if (result.type === 'success') {
							const data = result.data as
								| { success: true; skipped: boolean; isCorrect?: boolean }
								| undefined;
							if (data?.skipped) {
								// Server signalled the scenario went away mid-session.
								// Surface the skip in the reveal phase so the user knows
								// the attempt wasn't silently dropped, then re-derive.
								lastSkippedSubmit = true;
								lastResultCorrect = null;
								phase = 'reveal';
							} else {
								lastSkippedSubmit = false;
								lastResultCorrect = data?.isCorrect === true;
								phase = 'reveal';
							}
						} else {
							phase = 'choose';
							submitError =
								result.type === 'failure' ? 'Could not save that attempt. Try again.' : 'Network error. Try again.';
						}
						loading = false;
					};
				}}
			>
				<input type="hidden" name="scenarioId" value={current.id} />
				<fieldset class="options-fs" disabled={loading}>
					<legend class="rate-q">What do you do?</legend>
					<div class="options">
						{#each current.options as opt, i (opt.id)}
							<button
								type="submit"
								name="chosenOption"
								value={opt.id}
								class="option-btn"
								disabled={loading}
							>
								<span class="option-index">{i + 1}</span>
								<span class="option-text">{opt.text}</span>
							</button>
						{/each}
					</div>
				</fieldset>
				{#if submitError}
					<p class="submit-error" role="alert">{submitError}</p>
				{/if}
			</form>
		{:else if phase === 'reveal'}
			<button type="button" class="btn primary wide" onclick={advance}>
				{currentIndex + 1 === total ? 'Finish session' : 'Next rep'}
				<span class="kbd">Space</span>
			</button>
		{/if}

		<div class="progress" aria-hidden="true">
			<div class="progress-fill" style="width: {total === 0 ? 0 : ((currentIndex + (phase === 'reveal' ? 1 : 0)) / total) * 100}%"></div>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 44rem;
		margin: 0 auto;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.counter {
		font-size: 0.8125rem;
		color: #64748b;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.badge {
		display: inline-flex;
		padding: 0.125rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		color: #475569;
		background: #f8fafc;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.phase {
		color: #7c3aed;
		background: #f5f3ff;
		border-color: #ddd6fe;
	}

	.badge.difficulty-beginner {
		color: #15803d;
		background: #f0fdf4;
		border-color: #86efac;
	}

	.badge.difficulty-intermediate {
		color: #a16207;
		background: #fefce8;
		border-color: #fde047;
	}

	.badge.difficulty-advanced {
		color: #b91c1c;
		background: #fef2f2;
		border-color: #fecaca;
	}

	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.75rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		font-size: 1.0625rem;
		line-height: 1.55;
		color: #0f172a;
	}

	.title {
		margin: 0;
		font-size: 1.125rem;
		color: #0f172a;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.situation {
		margin: 0;
		white-space: pre-wrap;
	}

	.reveal {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.sep {
		border-top: 1px dashed #e2e8f0;
		margin: 0.25rem 0;
	}

	.chosen {
		margin: 0;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.indicator {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.indicator.correct {
		color: #15803d;
		background: #dcfce7;
		border: 1px solid #86efac;
	}

	.indicator.incorrect {
		color: #b91c1c;
		background: #fee2e2;
		border: 1px solid #fecaca;
	}

	.indicator.skipped {
		color: #92400e;
		background: #fffbeb;
		border: 1px solid #fde68a;
	}

	.skipped-note {
		margin: 0;
		color: #92400e;
		font-size: 0.875rem;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
	}

	.outcomes {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		counter-reset: opt;
	}

	.outcomes li {
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		border-radius: 10px;
		padding: 0.875rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.outcomes li.correct {
		border-color: #86efac;
		background: #f0fdf4;
	}

	.outcomes li.chosen:not(.correct) {
		border-color: #fecaca;
		background: #fef2f2;
	}

	.outcome-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.75rem;
		font-weight: 500;
	}

	.outcome-tag {
		font-size: 0.6875rem;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.outcomes li.correct .outcome-tag {
		color: #15803d;
	}

	.outcome-body,
	.outcome-whynot {
		margin: 0;
		font-size: 0.9375rem;
		color: #475569;
		line-height: 1.5;
	}

	.outcome-whynot {
		color: #334155;
	}

	.teaching {
		margin: 0;
		padding: 0.875rem 1rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 10px;
		color: #0f172a;
	}

	.refs {
		margin: 0;
		padding: 0 0 0 1.125rem;
		color: #475569;
		font-size: 0.9375rem;
	}

	.options-fs {
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.options-fs:disabled {
		opacity: 0.9;
	}


	.rate-q {
		margin: 0.5rem 0 0;
		text-align: center;
		color: #475569;
		font-size: 0.9375rem;
		font-weight: 500;
		width: 100%;
		padding: 0;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.option-btn {
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 0.875rem 1rem;
		font: inherit;
		color: inherit;
		text-align: left;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		transition: background 120ms, border-color 120ms, transform 80ms;
	}

	.option-btn:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.option-btn:active:not(:disabled) {
		transform: scale(0.99);
	}

	.option-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.option-index {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: #f1f5f9;
		color: #475569;
		font-size: 0.8125rem;
		font-weight: 700;
		border-radius: 999px;
	}

	.option-text {
		flex: 1 1 auto;
		line-height: 1.4;
	}

	.submit-error {
		margin: 0.75rem 0 0;
		color: #b91c1c;
		font-size: 0.875rem;
	}

	.btn {
		padding: 0.625rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 10px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}

	.btn.wide {
		align-self: center;
		padding: 0.75rem 2rem;
		font-size: 1rem;
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.375rem;
		font-size: 0.6875rem;
		background: #f1f5f9;
		color: #64748b;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
		font-family: ui-monospace, monospace;
	}

	.progress {
		background: #e2e8f0;
		height: 0.25rem;
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: #2563eb;
		transition: width 250ms;
	}

	.summary {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 2.5rem 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
	}

	.summary h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.headline {
		font-size: 1.125rem;
		color: #0f172a;
		margin: 0;
	}

	.headline .acc {
		color: #1d4ed8;
		font-weight: 600;
	}

	.by-domain {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.5rem;
		margin: 0.5rem 0;
		width: 100%;
	}

	.by-domain > div {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.75rem 0.875rem;
		text-align: left;
	}

	.by-domain dt {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.by-domain dd {
		margin: 0.125rem 0 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #0f172a;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 520px) {
		.options {
			gap: 0.375rem;
		}
	}
</style>
