<script lang="ts">
import {
	type ConfidenceLevel,
	DOMAIN_LABELS,
	REVIEW_PHASES,
	REVIEW_RATINGS,
	type ReviewPhase,
	ROUTES,
} from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

interface RatingTally {
	again: number;
	hard: number;
	good: number;
	easy: number;
}

// The review session owns a local copy of the batch so the UI stays on a
// stable queue even if `data` mutates between rating submits. `data` is
// reread explicitly via startNewSession() -> invalidateAll().
// svelte-ignore state_referenced_locally
let batch = $state(data.batch);
let index = $state(0);
// svelte-ignore state_referenced_locally
let phase = $state<ReviewPhase>(batch.length === 0 ? REVIEW_PHASES.COMPLETE : REVIEW_PHASES.FRONT);
let revealedAt = $state<number | null>(null);
let confidence = $state<number | null>(null);
let tally = $state<RatingTally>({ again: 0, hard: 0, good: 0, easy: 0 });
let submitError = $state<string | null>(null);

const current = $derived(batch[index]);
const total = $derived(batch.length);
const needsConfidence = $derived(Boolean(current?.promptConfidence));
const showConfidencePrompt = $derived(phase === REVIEW_PHASES.CONFIDENCE && needsConfidence);

const ratingLabels = {
	[REVIEW_RATINGS.AGAIN]: { label: 'Again', hint: '< 1m', key: '1' },
	[REVIEW_RATINGS.HARD]: { label: 'Hard', hint: '< 10m', key: '2' },
	[REVIEW_RATINGS.GOOD]: { label: 'Good', hint: '~ days', key: '3' },
	[REVIEW_RATINGS.EASY]: { label: 'Easy', hint: '~ week+', key: '4' },
} as const;

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function goToConfidenceOrReveal() {
	if (needsConfidence && confidence === null) {
		phase = REVIEW_PHASES.CONFIDENCE;
		return;
	}
	reveal();
}

function reveal() {
	revealedAt = Date.now();
	phase = REVIEW_PHASES.ANSWER;
}

function pickConfidence(value: ConfidenceLevel) {
	confidence = value;
	reveal();
}

function skipConfidence() {
	confidence = null;
	reveal();
}

function onRatingResult(rating: number) {
	if (rating === REVIEW_RATINGS.AGAIN) tally.again++;
	else if (rating === REVIEW_RATINGS.HARD) tally.hard++;
	else if (rating === REVIEW_RATINGS.GOOD) tally.good++;
	else if (rating === REVIEW_RATINGS.EASY) tally.easy++;
	advance();
}

function advance() {
	const next = index + 1;
	confidence = null;
	revealedAt = null;
	submitError = null;
	if (next >= batch.length) {
		phase = REVIEW_PHASES.COMPLETE;
		index = next;
	} else {
		index = next;
		phase = REVIEW_PHASES.FRONT;
	}
}

async function startNewSession() {
	await invalidateAll();
	batch = data.batch;
	index = 0;
	confidence = null;
	revealedAt = null;
	tally = { again: 0, hard: 0, good: 0, easy: 0 };
	phase = batch.length === 0 ? REVIEW_PHASES.COMPLETE : REVIEW_PHASES.FRONT;
}

function onKeydown(e: KeyboardEvent) {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (phase === REVIEW_PHASES.FRONT) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			goToConfidenceOrReveal();
		}
	} else if (phase === REVIEW_PHASES.CONFIDENCE) {
		const n = Number(e.key);
		if (Number.isInteger(n) && n >= 1 && n <= 5) {
			e.preventDefault();
			pickConfidence(n as ConfidenceLevel);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			skipConfidence();
		}
	} else if (phase === REVIEW_PHASES.ANSWER) {
		if (e.key === '1' || e.key === 'a') clickRating(REVIEW_RATINGS.AGAIN);
		else if (e.key === '2' || e.key === 'h') clickRating(REVIEW_RATINGS.HARD);
		else if (e.key === '3' || e.key === 'g') clickRating(REVIEW_RATINGS.GOOD);
		else if (e.key === '4' || e.key === 'e') clickRating(REVIEW_RATINGS.EASY);
	}
}

function clickRating(value: number) {
	const btn = document.querySelector<HTMLButtonElement>(`button[data-rating="${value}"]`);
	btn?.click();
}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Review -- airboss</title>
</svelte:head>

<section class="page">
	{#if phase === REVIEW_PHASES.COMPLETE}
		<article class="caught-up">
			<h1>All caught up.</h1>
			{#if total > 0}
				<p class="summary">You reviewed <strong>{total}</strong> {total === 1 ? 'card' : 'cards'} in this session.</p>
				<dl class="tally">
					<div><dt>Again</dt><dd>{tally.again}</dd></div>
					<div><dt>Hard</dt><dd>{tally.hard}</dd></div>
					<div><dt>Good</dt><dd>{tally.good}</dd></div>
					<div><dt>Easy</dt><dd>{tally.easy}</dd></div>
				</dl>
			{:else}
				<p class="summary">No cards due right now. Come back later or write more cards.</p>
			{/if}
			<div class="actions">
				<a class="btn ghost" href={ROUTES.DASHBOARD}>Back to dashboard</a>
				<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
				<button type="button" class="btn primary" onclick={startNewSession}>Reload queue</button>
			</div>
		</article>
	{:else if current}
		<header class="hd">
			<span class="counter">Card {index + 1} of {total}</span>
			<span class="badge domain">{domainLabel(current.domain)}</span>
		</header>

		<article class="card">
			<div class="section">
				<div class="section-label">Front</div>
				<div class="section-text">{current.front}</div>
			</div>

			{#if phase === REVIEW_PHASES.ANSWER}
				<hr />
				<div class="section">
					<div class="section-label">Back</div>
					<div class="section-text">{current.back}</div>
				</div>
			{/if}
		</article>

		{#if showConfidencePrompt}
			<ConfidenceSlider onSelect={pickConfidence} onSkip={skipConfidence} />
		{:else if phase === REVIEW_PHASES.FRONT}
			<button type="button" class="btn primary wide" onclick={goToConfidenceOrReveal}>
				Show answer
				<span class="kbd">Space</span>
			</button>
		{:else if phase === REVIEW_PHASES.ANSWER}
			<p class="rate-q">How well did you remember?</p>
			<form
				method="POST"
				action="?/submit"
				use:enhance={({ formData }) => {
					// Snapshot the submitted card + rating BEFORE phase flips so a
					// late result still knows what was intended.
					const submittedCardId = current.id;
					const rating = Number(formData.get('rating') ?? 0);
					phase = REVIEW_PHASES.SUBMITTING;
					formData.set('cardId', submittedCardId);
					const answerMs = revealedAt !== null ? Date.now() - revealedAt : '';
					formData.set('answerMs', String(answerMs));
					if (confidence !== null) formData.set('confidence', String(confidence));
					return async ({ result, update }) => {
						await update({ reset: false });
						// Only advance on a successful review. On failure/redirect/error the
						// server rejected the write -- leave the learner on the same card
						// with the error surfaced rather than silently dropping the rating.
						if (result.type === 'success') {
							onRatingResult(rating);
						} else {
							phase = REVIEW_PHASES.ANSWER;
							submitError = result.type === 'failure' ? 'Could not save that review. Try again.' : 'Network error. Try again.';
						}
					};
				}}
			>
				<div class="ratings">
					{#each [REVIEW_RATINGS.AGAIN, REVIEW_RATINGS.HARD, REVIEW_RATINGS.GOOD, REVIEW_RATINGS.EASY] as r (r)}
						<button
							type="submit"
							name="rating"
							value={r}
							data-rating={r}
							class="rating rating-{r}"
							disabled={phase !== REVIEW_PHASES.ANSWER}
						>
							<span class="rating-label">{ratingLabels[r].label}</span>
							<span class="rating-hint">{ratingLabels[r].hint}</span>
							<span class="kbd">{ratingLabels[r].key}</span>
						</button>
					{/each}
				</div>
				{#if submitError}
					<p class="submit-error" role="alert">{submitError}</p>
				{/if}
			</form>
		{:else if phase === REVIEW_PHASES.SUBMITTING}
			<p class="rate-q subdued">Saving...</p>
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 42rem;
		margin: 0 auto;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.counter {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		padding: 0.125rem 0.625rem;
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		border-radius: var(--ab-radius-pill);
		color: var(--ab-color-primary-hover);
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 2rem;
		min-height: 14rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		font-size: var(--ab-font-size-lg);
		line-height: 1.55;
		color: var(--ab-color-fg);
	}

	.section-label {
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		color: var(--ab-color-fg-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 0.5rem;
	}

	.section-text {
		white-space: pre-wrap;
	}

	hr {
		border: none;
		border-top: 1px dashed var(--ab-color-border);
		margin: 0;
	}

	.rate-q {
		margin: 0.5rem 0 0;
		text-align: center;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-body);
	}

	.rate-q.subdued {
		color: var(--ab-color-fg-faint);
	}

	.ratings {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.rating {
		background: white;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		padding: 0.875rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		align-items: center;
		cursor: pointer;
		transition: background 120ms, border-color 120ms, transform 80ms;
	}

	.rating:hover:not(:disabled) {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.rating:active:not(:disabled) {
		transform: scale(0.98);
	}

	.rating-label {
		font-weight: 600;
		font-size: var(--ab-font-size-body);
		color: var(--ab-color-fg);
	}

	.rating-hint {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
	}

	.rating-1 .rating-label {
		color: var(--ab-color-danger-hover);
	}

	.rating-2 .rating-label {
		color: var(--ab-color-warning-active);
	}

	.rating-3 .rating-label {
		color: var(--ab-color-success-hover);
	}

	.rating-4 .rating-label {
		color: var(--ab-color-primary-hover);
	}

	.btn {
		padding: 0.625rem 1.25rem;
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
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
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover {
		background: var(--ab-color-border);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}

	.btn.wide {
		align-self: center;
		padding: 0.75rem 2rem;
		font-size: var(--ab-font-size-base);
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.375rem;
		font-size: var(--ab-font-size-xs);
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg-subtle);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-xs);
		font-family: ui-monospace, monospace;
	}

	.caught-up {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 2.5rem 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
	}

	.caught-up h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.summary {
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-base);
		margin: 0;
	}

	.tally {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin: 0.5rem 0;
		width: 100%;
		max-width: 24rem;
	}

	.tally > div {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: 0.5rem;
	}

	.tally dt {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tally dd {
		margin: 0.125rem 0 0;
		font-size: var(--ab-font-size-2xl);
		font-weight: 700;
		color: var(--ab-color-fg);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 480px) {
		.ratings {
			grid-template-columns: repeat(2, 1fr);
		}

		.tally {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
