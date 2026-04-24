<script lang="ts">
import {
	type ConfidenceLevel,
	domainLabel,
	REVIEW_PHASES,
	REVIEW_RATINGS,
	type ReviewPhase,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import KbdHint from '@ab/ui/components/KbdHint.svelte';
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

const ratingLabels: Record<number, { label: string; hint: string; key: string; definition: string }> = {
	[REVIEW_RATINGS.AGAIN]: {
		label: 'Again',
		hint: '< 1m',
		key: '1',
		definition: 'You blanked or got it wrong. Card resets toward short intervals so you can rebuild the memory.',
	},
	[REVIEW_RATINGS.HARD]: {
		label: 'Hard',
		hint: '< 10m',
		key: '2',
		definition: 'You recalled it but it took effort. Next interval grows only a little.',
	},
	[REVIEW_RATINGS.GOOD]: {
		label: 'Good',
		hint: '~ days',
		key: '3',
		definition: 'You recalled it without a struggle. This is the default steady-state rating.',
	},
	[REVIEW_RATINGS.EASY]: {
		label: 'Easy',
		hint: '~ week+',
		key: '4',
		definition: 'You knew it instantly. Next interval jumps forward further than Good.',
	},
};

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
			<div class="title-row">
				<h1>{total > 0 ? 'Session complete.' : "You're caught up."}</h1>
				<PageHelp pageId="memory-review" />
			</div>
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
			<div class="counter-row">
				<span class="counter">Card {index + 1} of {total}</span>
				<PageHelp pageId="memory-review" />
			</div>
			<span class="domain-wrap">
				<span class="badge domain">{domainLabel(current.domain)}</span>
				<InfoTip
					term={domainLabel(current.domain)}
					definition="The topic bucket this card belongs to. Drives browse filters and session mix."
					helpId="memory-card"
					helpSection="domain"
				/>
			</span>
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
			<div class="reveal-row">
				<button type="button" class="btn primary wide" onclick={goToConfidenceOrReveal}>
					Show answer
					<span class="kbd">Space</span>
				</button>
				<InfoTip
					term="Show answer"
					definition="Recall first, then check. Active recall builds retention; rereading the back first does not."
					helpId="concept-active-recall"
				/>
			</div>
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
						<div class="rating-cell">
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
							<span class="rating-tip">
								<InfoTip
									term={ratingLabels[r].label}
									definition={ratingLabels[r].definition}
									helpId="memory-review"
									helpSection="the-four-ratings"
								/>
							</span>
						</div>
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
		gap: var(--space-xl);
		max-width: 42rem;
		margin: 0 auto;
	}

	.undo-toast {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-lg);
		font-size: var(--font-size-sm);
		color: var(--action-default-active);
		animation: undo-fade var(--motion-normal) ease-out;
	}

	.undo-msg {
		flex: 1;
	}

	.undo-domain {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		margin-left: var(--space-2xs);
	}

	.undo-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		background: var(--ink-inverse);
		border: 1px solid var(--action-default-edge);
		color: var(--action-default-hover);
		font-weight: 600;
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.undo-btn:hover:not(:disabled) {
		background: var(--action-default-wash);
	}

	.undo-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.undo-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.undo-dismiss {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		cursor: pointer;
		font-size: var(--font-size-lg);
		line-height: 1;
		padding: var(--space-2xs) var(--space-sm);
	}

	.undo-dismiss:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
		border-radius: var(--radius-sm);
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
		gap: var(--space-lg);
	}

	.title-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		justify-content: center;
	}

	.counter-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.counter {
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		font-weight: 600;
		letter-spacing: var(--letter-spacing-wide);
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--radius-pill);
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		min-height: 14rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		font-size: var(--type-heading-3-size);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.section-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-bottom: var(--space-sm);
	}

	.section-text {
		white-space: pre-wrap;
	}

	hr {
		border: none;
		border-top: 1px dashed var(--edge-default);
		margin: 0;
	}

	.rate-q {
		margin: var(--space-sm) 0 0;
		text-align: center;
		color: var(--ink-muted);
		font-size: var(--font-size-body);
	}

	.rate-q.subdued {
		color: var(--ink-faint);
	}

	.ratings {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-sm);
	}

	.rating-cell {
		position: relative;
		display: flex;
	}

	.rating-cell > .rating {
		flex: 1;
	}

	.rating-tip {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
	}

	.domain-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.reveal-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.rating {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-md) var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		align-items: center;
		cursor: pointer;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast),
			transform var(--motion-fast);
	}

	.rating:hover:not(:disabled) {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.rating:active:not(:disabled) {
		transform: scale(0.98);
	}

	.rating:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.rating-label {
		font-weight: 600;
		font-size: var(--font-size-body);
		color: var(--ink-body);
	}

	.rating-hint {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	.rating-1 .rating-label {
		color: var(--action-hazard-hover);
	}

	.rating-2 .rating-label {
		color: var(--signal-warning);
	}

	.rating-3 .rating-label {
		color: var(--signal-success);
	}

	.rating-4 .rating-label {
		color: var(--action-default-hover);
	}

	.btn {
		padding: var(--space-sm) var(--space-xl);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-lg);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}

	.btn.wide {
		align-self: center;
		padding: var(--space-md) var(--space-2xl);
		font-size: var(--font-size-base);
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		padding: 1px var(--space-xs);
		font-size: var(--font-size-xs);
		background: var(--surface-sunken);
		color: var(--ink-subtle);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
	}

	.caught-up {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl) var(--space-2xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		align-items: center;
	}

	.caught-up h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.summary {
		color: var(--ink-muted);
		font-size: var(--font-size-base);
		margin: 0;
	}

	.tally {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-md);
		margin: var(--space-sm) 0;
		width: 100%;
		max-width: 24rem;
	}

	.tally > div {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-sm);
	}

	.tally dt {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.tally dd {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-xl);
		font-weight: 700;
		color: var(--ink-body);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
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
