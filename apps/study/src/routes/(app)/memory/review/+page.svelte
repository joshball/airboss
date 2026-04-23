<script lang="ts">
import {
	type ConfidenceLevel,
	DOMAIN_LABELS,
	type Domain,
	REVIEW_PHASES,
	REVIEW_RATINGS,
	type ReviewPhase,
	ROUTES,
} from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import KbdHint from '@ab/ui/components/KbdHint.svelte';
import { humanize } from '@ab/utils';
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

type UndoCard = PageData['batch'][number];

interface PendingUndo {
	cardId: string;
	ratingLabel: string;
	card: UndoCard;
	confidence: number | null;
	/** epoch ms when the toast expires. */
	expiresAt: number;
}

/** Visible undo window in ms. Shorter than a half-beat breath, long enough to notice a fat-finger. */
const UNDO_WINDOW_MS = 2500;

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
let pendingUndo = $state<PendingUndo | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let undoing = $state(false);

const current = $derived(batch[index]);
const total = $derived(batch.length);
const needsConfidence = $derived(Boolean(current?.promptConfidence));
const showConfidencePrompt = $derived(phase === REVIEW_PHASES.CONFIDENCE && needsConfidence);

const ratingLabels: Record<number, { label: string; hint: string; key: string }> = {
	[REVIEW_RATINGS.AGAIN]: { label: 'Again', hint: '< 1m', key: '1' },
	[REVIEW_RATINGS.HARD]: { label: 'Hard', hint: '< 10m', key: '2' },
	[REVIEW_RATINGS.GOOD]: { label: 'Good', hint: '~ days', key: '3' },
	[REVIEW_RATINGS.EASY]: { label: 'Easy', hint: '~ week+', key: '4' },
};

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
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

function onRatingResult(rating: number, submittedCard: UndoCard, submittedConfidence: number | null) {
	if (rating === REVIEW_RATINGS.AGAIN) tally.again++;
	else if (rating === REVIEW_RATINGS.HARD) tally.hard++;
	else if (rating === REVIEW_RATINGS.GOOD) tally.good++;
	else if (rating === REVIEW_RATINGS.EASY) tally.easy++;

	// Start the undo window. Any in-flight undo from a prior card is dropped
	// immediately (one card = one undo opportunity).
	if (undoTimer !== null) {
		clearTimeout(undoTimer);
		undoTimer = null;
	}
	pendingUndo = {
		cardId: submittedCard.id,
		ratingLabel: ratingLabels[rating].label,
		card: submittedCard,
		confidence: submittedConfidence,
		expiresAt: Date.now() + UNDO_WINDOW_MS,
	};
	undoTimer = setTimeout(() => {
		pendingUndo = null;
		undoTimer = null;
	}, UNDO_WINDOW_MS);

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

function cancelUndo() {
	if (undoTimer !== null) {
		clearTimeout(undoTimer);
		undoTimer = null;
	}
	pendingUndo = null;
}

async function triggerUndo() {
	const snap = pendingUndo;
	if (!snap || undoing) return;
	undoing = true;
	if (undoTimer !== null) {
		clearTimeout(undoTimer);
		undoTimer = null;
	}
	try {
		const formData = new FormData();
		formData.set('cardId', snap.cardId);
		const res = await fetch('?/undoReview', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: formData,
		});
		if (!res.ok) {
			submitError = 'Could not undo that rating. The card stays scheduled as rated.';
			pendingUndo = null;
			return;
		}
		// Restore the rating tally.
		// We derive the rating from the label to stay resilient across REVIEW_RATINGS.
		const label = snap.ratingLabel.toLowerCase();
		if (label === 'again' && tally.again > 0) tally.again--;
		else if (label === 'hard' && tally.hard > 0) tally.hard--;
		else if (label === 'good' && tally.good > 0) tally.good--;
		else if (label === 'easy' && tally.easy > 0) tally.easy--;

		// Put the card back at the top of the queue. When `complete`, reopen the session.
		const restored: UndoCard = snap.card;
		const remaining = batch.slice(index);
		batch = [restored, ...remaining];
		index = 0;
		phase = REVIEW_PHASES.FRONT;
		confidence = null;
		revealedAt = null;
		submitError = null;
		pendingUndo = null;
	} catch {
		submitError = 'Network error on undo. The card stays scheduled as rated.';
		pendingUndo = null;
	} finally {
		undoing = false;
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
	const target = e.target as HTMLElement | null;
	if (target?.isContentEditable) return;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

	// Undo shortcut (u / Cmd+Z / Ctrl+Z) while the undo window is open.
	if (pendingUndo && !undoing) {
		const isUndoChord = (e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey);
		if (e.key === 'u' || e.key === 'U' || isUndoChord) {
			e.preventDefault();
			void triggerUndo();
			return;
		}
	}

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
	{#if pendingUndo}
		<div class="undo-toast" role="status" aria-live="polite">
			<span class="undo-msg">
				Rated <strong>{pendingUndo.ratingLabel}</strong>.
				<span class="undo-domain">{domainLabel(pendingUndo.card.domain)}</span>
			</span>
			<button type="button" class="undo-btn" onclick={triggerUndo} disabled={undoing}>
				{undoing ? 'Undoing...' : 'Undo'}
				<KbdHint>U</KbdHint>
			</button>
			<button type="button" class="undo-dismiss" onclick={cancelUndo} aria-label="Dismiss undo">&times;</button>
		</div>
	{/if}

	{#if phase === REVIEW_PHASES.COMPLETE}
		<article class="caught-up">
			<h1>{total > 0 ? 'Session complete.' : "You're caught up."}</h1>
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
					const submittedCard = current;
					const submittedConfidence = confidence;
					const rating = Number(formData.get('rating') ?? 0);
					phase = REVIEW_PHASES.SUBMITTING;
					formData.set('cardId', submittedCard.id);
					const answerMs = revealedAt !== null ? Date.now() - revealedAt : '';
					formData.set('answerMs', String(answerMs));
					if (submittedConfidence !== null) formData.set('confidence', String(submittedConfidence));
					return async ({ result, update }) => {
						await update({ reset: false });
						// Only advance on a successful review. On failure/redirect/error the
						// server rejected the write -- leave the learner on the same card
						// with the error surfaced rather than silently dropping the rating.
						if (result.type === 'success') {
							onRatingResult(rating, submittedCard, submittedConfidence);
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
		gap: var(--ab-space-xl-alt);
		max-width: 42rem;
		margin: 0 auto;
	}

	.undo-toast {
		display: flex;
		align-items: center;
		gap: var(--ab-space-md);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		border-radius: var(--ab-radius-lg);
		font-size: 0.875rem;
		color: var(--ab-color-primary-active);
		animation: undo-fade var(--ab-transition-normal) ease-out;
	}

	.undo-msg {
		flex: 1;
	}

	.undo-domain {
		color: var(--ab-color-fg-muted);
		font-size: 0.75rem;
		margin-left: var(--ab-space-2xs);
	}

	.undo-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--ab-space-xs);
		background: white;
		border: 1px solid var(--ab-color-primary-subtle-border);
		color: var(--ab-color-primary-hover);
		font-weight: 600;
		border-radius: var(--ab-radius-sm);
		padding: var(--ab-space-xs-alt) var(--ab-space-sm-alt);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.undo-btn:hover:not(:disabled) {
		background: var(--ab-color-primary-subtle);
	}

	.undo-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.undo-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.undo-dismiss {
		background: transparent;
		border: none;
		color: var(--ab-color-fg-muted);
		cursor: pointer;
		font-size: 1.125rem;
		line-height: 1;
		padding: var(--ab-space-2xs) var(--ab-space-sm);
	}

	.undo-dismiss:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
		border-radius: var(--ab-radius-tight);
	}

	@keyframes undo-fade {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.undo-toast { animation: none; }
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--ab-space-lg);
	}

	.counter {
		font-size: 0.8125rem;
		color: var(--ab-color-fg-subtle);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		padding: var(--ab-space-3xs) var(--ab-space-sm-alt);
		font-size: 0.6875rem;
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
		border-radius: var(--ab-radius-2xl);
		padding: var(--ab-space-2xl);
		min-height: 14rem;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xl-alt);
		font-size: 1.0625rem;
		line-height: 1.55;
		color: var(--ab-color-fg);
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ab-color-fg-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: var(--ab-space-sm);
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
		margin: var(--ab-space-sm) 0 0;
		text-align: center;
		color: var(--ab-color-fg-muted);
		font-size: 0.9375rem;
	}

	.rate-q.subdued {
		color: var(--ab-color-fg-faint);
	}

	.ratings {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--ab-space-sm);
	}

	.rating {
		background: white;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-md-alt) var(--ab-space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-3xs);
		align-items: center;
		cursor: pointer;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			transform var(--ab-transition-fast);
	}

	.rating:hover:not(:disabled) {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.rating:active:not(:disabled) {
		transform: scale(0.98);
	}

	.rating:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.rating-label {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--ab-color-fg);
	}

	.rating-hint {
		font-size: 0.75rem;
		color: var(--ab-color-fg-subtle);
	}

	.rating-1 .rating-label {
		color: var(--ab-color-danger-hover);
	}

	.rating-2 .rating-label {
		color: var(--ab-color-warning-hover);
	}

	.rating-3 .rating-label {
		color: var(--ab-color-success-hover);
	}

	.rating-4 .rating-label {
		color: var(--ab-color-primary-hover);
	}

	.btn {
		padding: var(--ab-space-sm-alt) var(--ab-space-xl-alt);
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: var(--ab-radius-lg);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--ab-space-sm);
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
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
		padding: var(--ab-space-md) var(--ab-space-2xl);
		font-size: 1rem;
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		padding: var(--ab-space-hair) var(--ab-space-xs);
		font-size: 0.6875rem;
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg-subtle);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-tight);
		font-family: ui-monospace, monospace;
	}

	.caught-up {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-2xl);
		padding: var(--ab-space-2xl-alt) var(--ab-space-2xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
		align-items: center;
	}

	.caught-up h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.summary {
		color: var(--ab-color-fg-muted);
		font-size: 1rem;
		margin: 0;
	}

	.tally {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--ab-space-md);
		margin: var(--ab-space-sm) 0;
		width: 100%;
		max-width: 24rem;
	}

	.tally > div {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-sm);
	}

	.tally dt {
		font-size: 0.6875rem;
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tally dd {
		margin: var(--ab-space-3xs) 0 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--ab-color-fg);
	}

	.actions {
		display: flex;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 480px) { /* --ab-breakpoint-sm */
		.ratings {
			grid-template-columns: repeat(2, 1fr);
		}

		.tally {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
