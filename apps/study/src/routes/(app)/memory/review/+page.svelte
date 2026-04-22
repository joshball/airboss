<script lang="ts">
import { type ConfidenceLevel, DOMAIN_LABELS, REVIEW_RATINGS, ROUTES } from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import KbdHint from '@ab/ui/components/KbdHint.svelte';
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
let phase = $state<Phase>(batch.length === 0 ? 'complete' : 'front');
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
const showConfidencePrompt = $derived(phase === 'confidence' && needsConfidence);

const ratingLabels: Record<number, { label: string; hint: string; key: string }> = {
	[REVIEW_RATINGS.AGAIN]: { label: 'Again', hint: '< 1m', key: '1' },
	[REVIEW_RATINGS.HARD]: { label: 'Hard', hint: '< 10m', key: '2' },
	[REVIEW_RATINGS.GOOD]: { label: 'Good', hint: '~ days', key: '3' },
	[REVIEW_RATINGS.EASY]: { label: 'Easy', hint: '~ week+', key: '4' },
};

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
		phase = 'complete';
		index = next;
	} else {
		index = next;
		phase = 'front';
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
		phase = 'front';
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
	phase = batch.length === 0 ? 'complete' : 'front';
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

	if (phase === 'front') {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			goToConfidenceOrReveal();
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

	{#if phase === 'complete'}
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

			{#if phase === 'answer'}
				<hr />
				<div class="section">
					<div class="section-label">Back</div>
					<div class="section-text">{current.back}</div>
				</div>
			{/if}
		</article>

		{#if showConfidencePrompt}
			<ConfidenceSlider onSelect={pickConfidence} onSkip={skipConfidence} />
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
					const submittedCard = current;
					const submittedConfidence = confidence;
					const rating = Number(formData.get('rating') ?? 0);
					phase = 'submitting';
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

	.undo-toast {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.875rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 10px;
		font-size: 0.875rem;
		color: #1e40af;
		animation: undo-fade var(--ab-transition-normal) ease-out;
	}

	.undo-msg {
		flex: 1;
	}

	.undo-domain {
		color: #475569;
		font-size: 0.75rem;
		margin-left: 0.25rem;
	}

	.undo-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: white;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
		font-weight: 600;
		border-radius: 6px;
		padding: 0.3125rem 0.625rem;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.undo-btn:hover:not(:disabled) {
		background: #dbeafe;
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
		color: #475569;
		cursor: pointer;
		font-size: 1.125rem;
		line-height: 1;
		padding: 0.25rem 0.5rem;
	}

	.undo-dismiss:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
		border-radius: 4px;
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
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			transform var(--ab-transition-fast);
	}

	.rating:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #bfdbfe;
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
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
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
