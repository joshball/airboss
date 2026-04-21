<script lang="ts">
import { CONFIDENCE_LEVEL_VALUES, DOMAIN_LABELS, REVIEW_RATINGS, ROUTES } from '@ab/constants';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

type Phase = 'front' | 'confidence' | 'answer' | 'submitting' | 'complete';

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
let phase = $state<Phase>(batch.length === 0 ? 'complete' : 'front');
let revealedAt = $state<number | null>(null);
let confidence = $state<number | null>(null);
let tally = $state<RatingTally>({ again: 0, hard: 0, good: 0, easy: 0 });
let submitError = $state<string | null>(null);

const current = $derived(batch[index]);
const total = $derived(batch.length);
const needsConfidence = $derived(Boolean(current?.promptConfidence));
const showConfidencePrompt = $derived(phase === 'confidence' && needsConfidence);

const ratingLabels = {
	[REVIEW_RATINGS.AGAIN]: { label: 'Again', hint: '< 1m', key: '1' },
	[REVIEW_RATINGS.HARD]: { label: 'Hard', hint: '< 10m', key: '2' },
	[REVIEW_RATINGS.GOOD]: { label: 'Good', hint: '~ days', key: '3' },
	[REVIEW_RATINGS.EASY]: { label: 'Easy', hint: '~ week+', key: '4' },
} as const;

const confidenceLabels = ['Wild guess', 'Uncertain', 'Maybe', 'Probably', 'Certain'];

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
		phase = 'confidence';
		return;
	}
	reveal();
}

function reveal() {
	revealedAt = Date.now();
	phase = 'answer';
}

function pickConfidence(value: number) {
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
		phase = 'complete';
		index = next;
	} else {
		index = next;
		phase = 'front';
	}
}

async function startNewSession() {
	await invalidateAll();
	batch = data.batch;
	index = 0;
	confidence = null;
	revealedAt = null;
	tally = { again: 0, hard: 0, good: 0, easy: 0 };
	phase = batch.length === 0 ? 'complete' : 'front';
}

function onKeydown(e: KeyboardEvent) {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (phase === 'front') {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			goToConfidenceOrReveal();
		}
	} else if (phase === 'confidence') {
		const n = Number(e.key);
		if (Number.isInteger(n) && n >= 1 && n <= 5) {
			e.preventDefault();
			pickConfidence(n);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			skipConfidence();
		}
	} else if (phase === 'answer') {
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
	{#if phase === 'complete'}
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

			{#if phase === 'answer'}
				<hr />
				<div class="section">
					<div class="section-label">Back</div>
					<div class="section-text">{current.back}</div>
				</div>
			{/if}
		</article>

		{#if showConfidencePrompt}
			<article class="prompt">
				<p class="prompt-q">Before revealing -- how confident are you?</p>
				<div class="confidence-row">
					{#each CONFIDENCE_LEVEL_VALUES as level, i (level)}
						<button type="button" class="conf" onclick={() => pickConfidence(level)}>
							<span class="conf-num">{level}</span>
							<span class="conf-label">{confidenceLabels[i]}</span>
						</button>
					{/each}
				</div>
				<button type="button" class="btn ghost skip" onclick={skipConfidence}>Skip confidence</button>
			</article>
		{:else if phase === 'front'}
			<button type="button" class="btn primary wide" onclick={goToConfidenceOrReveal}>
				Show answer
				<span class="kbd">Space</span>
			</button>
		{:else if phase === 'answer'}
			<p class="rate-q">How well did you remember?</p>
			<form
				method="POST"
				action="?/submit"
				use:enhance={({ formData }) => {
					// Snapshot the submitted card + rating BEFORE phase flips so a
					// late result still knows what was intended.
					const submittedCardId = current.id;
					const rating = Number(formData.get('rating') ?? 0);
					phase = 'submitting';
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
							phase = 'answer';
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
							disabled={phase !== 'answer'}
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
		{:else if phase === 'submitting'}
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
		font-size: 0.8125rem;
		color: #64748b;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		padding: 0.125rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		color: #1d4ed8;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 2rem;
		min-height: 14rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		font-size: 1.0625rem;
		line-height: 1.55;
		color: #0f172a;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 0.5rem;
	}

	.section-text {
		white-space: pre-wrap;
	}

	hr {
		border: none;
		border-top: 1px dashed #e2e8f0;
		margin: 0;
	}

	.prompt {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.prompt-q {
		margin: 0;
		color: #334155;
		font-size: 0.9375rem;
	}

	.confidence-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.conf {
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 0.75rem 0.75rem;
		min-width: 5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: center;
		cursor: pointer;
		transition: background 120ms, border-color 120ms;
	}

	.conf:hover {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.conf-num {
		font-weight: 700;
		font-size: 1.125rem;
		color: #1d4ed8;
	}

	.conf-label {
		font-size: 0.75rem;
		color: #64748b;
	}

	.skip {
		align-self: center;
	}

	.rate-q {
		margin: 0.5rem 0 0;
		text-align: center;
		color: #475569;
		font-size: 0.9375rem;
	}

	.rate-q.subdued {
		color: #94a3b8;
	}

	.ratings {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.rating {
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 0.875rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		align-items: center;
		cursor: pointer;
		transition: background 120ms, border-color 120ms, transform 80ms;
	}

	.rating:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.rating:active:not(:disabled) {
		transform: scale(0.98);
	}

	.rating-label {
		font-weight: 600;
		font-size: 0.9375rem;
		color: #0f172a;
	}

	.rating-hint {
		font-size: 0.75rem;
		color: #64748b;
	}

	.rating-1 .rating-label {
		color: #b91c1c;
	}

	.rating-2 .rating-label {
		color: #c2410c;
	}

	.rating-3 .rating-label {
		color: #15803d;
	}

	.rating-4 .rating-label {
		color: #1d4ed8;
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

	.caught-up {
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

	.caught-up h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.summary {
		color: #475569;
		font-size: 1rem;
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
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.5rem;
	}

	.tally dt {
		font-size: 0.6875rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tally dd {
		margin: 0.125rem 0 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #0f172a;
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
