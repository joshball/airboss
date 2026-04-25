<script lang="ts">
import { formatNextInterval, formatNextIntervalAbsolute } from '@ab/bc-study';
import {
	CARD_FEEDBACK_SIGNAL_LABELS,
	CARD_FEEDBACK_SIGNAL_VALUES,
	CARD_FEEDBACK_SIGNALS,
	CARD_FEEDBACK_SIGNALS_REQUIRING_COMMENT,
	type CardFeedbackSignal,
	CONFIDENCE_LEVEL_LABELS,
	CONFIDENCE_LEVEL_VALUES,
	type ConfidenceLevel,
	domainLabel,
	REVIEW_PHASES,
	REVIEW_RATING_LABELS,
	REVIEW_RATINGS,
	REVIEW_UNDO_WINDOW_MS,
	type ReviewPhase,
	type ReviewRating,
	ROUTES,
	SNOOZE_REASONS,
	type SnoozeDurationLevel,
	type SnoozeReason,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import JumpToCardPopover, { type JumpCardStatus } from '@ab/ui/components/JumpToCardPopover.svelte';
import KbdHint from '@ab/ui/components/KbdHint.svelte';
import SharePopover from '@ab/ui/components/SharePopover.svelte';
import SnoozeReasonPopover from '@ab/ui/components/SnoozeReasonPopover.svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

interface RatingTally {
	again: number;
	hard: number;
	good: number;
	easy: number;
}

type CurrentCard = NonNullable<PageData['currentCard']>;

interface PendingUndo {
	cardId: string;
	ratingLabel: string;
	card: CurrentCard;
	confidence: number | null;
	/** epoch ms when the toast expires. */
	expiresAt: number;
}

const current = $derived(data.currentCard);
const totalCards = $derived(data.totalCards);
const position = $derived(data.position);
const isComplete = $derived(data.isComplete);
const reEntryBanner = $derived(data.reEntryBanner);
const previewDueAtMs = $derived(data.previewDueAtMs);
const nowMs = $derived(data.nowMs);
const cardStatuses = $derived<readonly JumpCardStatus[]>(data.cardStatuses as readonly JumpCardStatus[]);
const currentIndex = $derived(data.currentIndex);

// svelte-ignore state_referenced_locally
let phase = $state<ReviewPhase>(isComplete || !current ? REVIEW_PHASES.COMPLETE : REVIEW_PHASES.FRONT);
let revealedAt = $state<number | null>(null);
let confidence = $state<number | null>(null);
let adjustingConfidence = $state(false);
let tally = $state<RatingTally>({ again: 0, hard: 0, good: 0, easy: 0 });
let submitError = $state<string | null>(null);
let pendingUndo = $state<PendingUndo | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let undoing = $state(false);

let jumpOpen = $state(false);
let snoozeOpen = $state(false);
let snoozeInitialReason = $state<SnoozeReason | undefined>(undefined);
let snoozeFocusComment = $state(false);
let shareOpen = $state(false);
let shareToast = $state<string | null>(null);
let shareToastTimer: ReturnType<typeof setTimeout> | null = null;
const SHARE_TOAST_MS = 2000;
let feedbackSignal = $state<CardFeedbackSignal | null>(null);
let feedbackComment = $state('');
let feedbackError = $state<string | null>(null);
let feedbackSubmitting = $state(false);

// Re-seed the local phase whenever the server sends a new card / completion.
// `$effect.pre` runs before the component body re-renders so the buttons
// don't flash "Show answer" for the previous card.
$effect.pre(() => {
	if (!current || isComplete) {
		phase = REVIEW_PHASES.COMPLETE;
	} else if (phase !== REVIEW_PHASES.SUBMITTING) {
		phase = REVIEW_PHASES.FRONT;
	}
	confidence = null;
	adjustingConfidence = false;
	revealedAt = null;
	submitError = null;
	feedbackSignal = null;
	feedbackComment = '';
	feedbackError = null;
});

const needsConfidence = $derived(Boolean(current?.promptConfidence));

function previewLabel(rating: ReviewRating): string {
	if (!previewDueAtMs) return '';
	const due = previewDueAtMs[rating];
	if (typeof due !== 'number') return '';
	return formatNextInterval(due - nowMs);
}

function previewTitle(rating: ReviewRating): string {
	if (!previewDueAtMs) return '';
	const due = previewDueAtMs[rating];
	if (typeof due !== 'number') return '';
	return formatNextIntervalAbsolute(new Date(due));
}

function reveal() {
	revealedAt = Date.now();
	phase = REVIEW_PHASES.ANSWER;
	adjustingConfidence = false;
}

function pickConfidence(value: ConfidenceLevel) {
	confidence = value;
	if (phase === REVIEW_PHASES.FRONT) {
		reveal();
	} else {
		adjustingConfidence = false;
	}
}

function skipConfidence() {
	confidence = null;
	if (phase === REVIEW_PHASES.FRONT) {
		reveal();
	} else {
		adjustingConfidence = false;
	}
}

function startAdjustConfidence() {
	adjustingConfidence = true;
}

function recordTally(rating: number) {
	if (rating === REVIEW_RATINGS.AGAIN) tally.again++;
	else if (rating === REVIEW_RATINGS.HARD) tally.hard++;
	else if (rating === REVIEW_RATINGS.GOOD) tally.good++;
	else if (rating === REVIEW_RATINGS.EASY) tally.easy++;
}

function startUndoWindow(rating: number, submittedCard: CurrentCard, submittedConfidence: number | null) {
	if (undoTimer !== null) {
		clearTimeout(undoTimer);
		undoTimer = null;
	}
	pendingUndo = {
		cardId: submittedCard.id,
		ratingLabel: REVIEW_RATING_LABELS[rating as ReviewRating] ?? '',
		card: submittedCard,
		confidence: submittedConfidence,
		expiresAt: Date.now() + REVIEW_UNDO_WINDOW_MS,
	};
	undoTimer = setTimeout(() => {
		pendingUndo = null;
		undoTimer = null;
	}, REVIEW_UNDO_WINDOW_MS);
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
		const label = snap.ratingLabel.toLowerCase();
		// Rating labels are `Wrong / Hard / Right / Easy`. Map back to tally keys.
		if (label === REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN].toLowerCase() && tally.again > 0) tally.again--;
		else if (label === REVIEW_RATING_LABELS[REVIEW_RATINGS.HARD].toLowerCase() && tally.hard > 0) tally.hard--;
		else if (label === REVIEW_RATING_LABELS[REVIEW_RATINGS.GOOD].toLowerCase() && tally.good > 0) tally.good--;
		else if (label === REVIEW_RATING_LABELS[REVIEW_RATINGS.EASY].toLowerCase() && tally.easy > 0) tally.easy--;
		pendingUndo = null;
		await invalidateAll();
	} catch {
		submitError = 'Network error on undo. The card stays scheduled as rated.';
		pendingUndo = null;
	} finally {
		undoing = false;
	}
}

function ratingShortcut(value: number) {
	const btn = document.querySelector<HTMLButtonElement>(`button[data-rating="${value}"]`);
	btn?.click();
}

function onKeydown(e: KeyboardEvent) {
	const target = e.target as HTMLElement | null;
	if (target?.isContentEditable) return;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
	if (snoozeOpen || shareOpen || jumpOpen) return;

	if (pendingUndo && !undoing) {
		const isUndoChord = (e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey);
		if (e.key === 'u' || e.key === 'U' || isUndoChord) {
			e.preventDefault();
			void triggerUndo();
			return;
		}
	}

	if (phase === REVIEW_PHASES.FRONT) {
		const n = Number(e.key);
		if (Number.isInteger(n) && n >= 1 && n <= 5) {
			e.preventDefault();
			pickConfidence(n as ConfidenceLevel);
			return;
		}
		if (e.key === ' ') {
			e.preventDefault();
			skipConfidence();
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			if (needsConfidence && confidence === null) {
				skipConfidence();
			} else {
				reveal();
			}
		}
	} else if (phase === REVIEW_PHASES.ANSWER) {
		if (adjustingConfidence) {
			const n = Number(e.key);
			if (Number.isInteger(n) && n >= 1 && n <= 5) {
				e.preventDefault();
				pickConfidence(n as ConfidenceLevel);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				adjustingConfidence = false;
				return;
			}
		}
		if (e.key === '1' || e.key === 'a') ratingShortcut(REVIEW_RATINGS.AGAIN);
		else if (e.key === '2' || e.key === 'h') ratingShortcut(REVIEW_RATINGS.HARD);
		else if (e.key === '3' || e.key === 'g') ratingShortcut(REVIEW_RATINGS.GOOD);
		else if (e.key === '4' || e.key === 'e') ratingShortcut(REVIEW_RATINGS.EASY);
	}
}

function formatStartedAt(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function openSnooze() {
	snoozeInitialReason = undefined;
	snoozeFocusComment = false;
	snoozeOpen = true;
}

function closeSnooze() {
	snoozeOpen = false;
	snoozeInitialReason = undefined;
	snoozeFocusComment = false;
}

function openShare() {
	shareOpen = true;
}

function closeShare() {
	shareOpen = false;
}

function openJump() {
	jumpOpen = true;
}

function closeJump() {
	jumpOpen = false;
}

async function handleJumpPick(index: number) {
	if (index === currentIndex) return;
	const formData = new FormData();
	formData.set('index', String(index));
	try {
		const res = await fetch('?/jumpTo', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: formData,
		});
		if (!res.ok) {
			submitError = 'Could not jump to that card. Try again.';
			return;
		}
		await invalidateAll();
	} catch {
		submitError = 'Network error jumping. Try again.';
	}
}

function handleShareCopy(_url: string) {
	if (shareToastTimer !== null) clearTimeout(shareToastTimer);
	shareToast = 'Link copied';
	shareToastTimer = setTimeout(() => {
		shareToast = null;
		shareToastTimer = null;
	}, SHARE_TOAST_MS);
}

function handleShareReport(_cardId: string) {
	// Hand off to the snooze flow with `bad-question` pre-selected and the
	// comment field focused, so the existing snooze-and-flag pipeline (which
	// requires a comment for `bad-question`) handles the rest.
	snoozeInitialReason = SNOOZE_REASONS.BAD_QUESTION;
	snoozeFocusComment = true;
	snoozeOpen = true;
}

async function handleSnoozeSubmit(payload: {
	reason: SnoozeReason;
	comment: string;
	durationLevel: SnoozeDurationLevel | null;
	waitForEdit: boolean;
}) {
	if (!current) return;
	const formData = new FormData();
	formData.set('cardId', current.id);
	formData.set('reason', payload.reason);
	formData.set('comment', payload.comment);
	if (payload.durationLevel) formData.set('durationLevel', payload.durationLevel);
	formData.set('waitForEdit', payload.waitForEdit ? 'true' : 'false');
	formData.set('domain', current.domain);
	try {
		const res = await fetch('?/snooze', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: formData,
		});
		if (!res.ok) {
			submitError = 'Could not snooze that card. Try again.';
			return;
		}
		await invalidateAll();
	} catch {
		submitError = 'Network error snoozing. Try again.';
	}
}

function pickFeedback(signal: CardFeedbackSignal) {
	if (feedbackSignal === signal) {
		feedbackSignal = null;
		feedbackComment = '';
		feedbackError = null;
		return;
	}
	feedbackSignal = signal;
	feedbackError = null;
}

const feedbackRequiresComment = $derived(
	feedbackSignal !== null &&
		(CARD_FEEDBACK_SIGNALS_REQUIRING_COMMENT as readonly CardFeedbackSignal[]).includes(feedbackSignal),
);

async function submitFeedbackForm(event: SubmitEvent) {
	event.preventDefault();
	if (!current || !feedbackSignal || feedbackSubmitting) return;
	const trimmed = feedbackComment.trim();
	if (feedbackRequiresComment && !trimmed) {
		feedbackError = 'A comment is required for this feedback.';
		return;
	}
	feedbackSubmitting = true;
	feedbackError = null;
	try {
		const formData = new FormData();
		formData.set('cardId', current.id);
		formData.set('signal', feedbackSignal);
		formData.set('comment', trimmed);
		const res = await fetch('?/feedback', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: formData,
		});
		if (!res.ok) {
			feedbackError = 'Could not save feedback. Try again.';
			return;
		}
		feedbackSignal = null;
		feedbackComment = '';
	} catch {
		feedbackError = 'Network error saving feedback. Try again.';
	} finally {
		feedbackSubmitting = false;
	}
}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Review -- airboss</title>
</svelte:head>

<section class="page">
	{#if phase === REVIEW_PHASES.COMPLETE || !current}
		<article class="caught-up">
			<div class="title-row">
				<h1>{totalCards > 0 ? 'Session complete.' : "You're caught up."}</h1>
				<PageHelp pageId="memory-review" />
			</div>
			{#if totalCards > 0}
				<p class="summary">
					You reviewed <strong>{totalCards}</strong> {totalCards === 1 ? 'card' : 'cards'} in this session.
				</p>
				<dl class="tally">
					<div><dt>{REVIEW_RATING_LABELS[REVIEW_RATINGS.AGAIN]}</dt><dd>{tally.again}</dd></div>
					<div><dt>{REVIEW_RATING_LABELS[REVIEW_RATINGS.HARD]}</dt><dd>{tally.hard}</dd></div>
					<div><dt>{REVIEW_RATING_LABELS[REVIEW_RATINGS.GOOD]}</dt><dd>{tally.good}</dd></div>
					<div><dt>{REVIEW_RATING_LABELS[REVIEW_RATINGS.EASY]}</dt><dd>{tally.easy}</dd></div>
				</dl>
			{:else}
				<p class="summary">No cards due right now. Come back later or write more cards.</p>
			{/if}
			<div class="actions">
				<a class="btn ghost" href={ROUTES.DASHBOARD}>Back to dashboard</a>
				<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
				<a class="btn primary" href={ROUTES.MEMORY_REVIEW}>Start a fresh run</a>
			</div>
		</article>
	{:else}
		<header class="hd">
			<div class="counter-row">
				<button
					type="button"
					class="counter counter-trigger"
					onclick={openJump}
					aria-haspopup="dialog"
					aria-expanded={jumpOpen}
					aria-label={`Card ${position} of ${totalCards}. Open jump menu.`}
				>
					<span class="counter-line">
						Card {position} of {totalCards}
						<span class="counter-caret" aria-hidden="true">&#9662;</span>
					</span>
					<span class="counter-sub">started {formatStartedAt(data.startedAt)}</span>
				</button>
				<PageHelp pageId="memory-review" />
			</div>
			<div class="hd-right">
				<span class="domain-wrap">
					<span class="badge domain">{domainLabel(current.domain)}</span>
					<InfoTip
						term={domainLabel(current.domain)}
						definition="The topic bucket this card belongs to. Drives browse filters and session mix."
						helpId="memory-card"
						helpSection="domain"
					/>
				</span>
				<button type="button" class="header-btn" onclick={openShare} aria-haspopup="dialog">
					Share
				</button>
				<button type="button" class="header-btn" onclick={openSnooze} aria-haspopup="dialog">
					Snooze
				</button>
			</div>
		</header>

		{#if shareToast}
			<div class="share-toast" role="status" aria-live="polite">{shareToast}</div>
		{/if}

		{#if reEntryBanner}
			<div class="re-entry-banner" role="status">
				This card was updated. Does it look better now?
			</div>
		{/if}

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

		{#if phase === REVIEW_PHASES.FRONT}
			{#if needsConfidence}
				<div class="confidence-strip" role="radiogroup" aria-label="Confidence">
					<span class="strip-label">Confidence</span>
					{#each CONFIDENCE_LEVEL_VALUES as level (level)}
						<button
							type="button"
							role="radio"
							aria-checked={confidence === level}
							aria-label={`${level} -- ${CONFIDENCE_LEVEL_LABELS[level]}`}
							class="chicklet"
							class:is-selected={confidence === level}
							onclick={() => pickConfidence(level)}
							title={CONFIDENCE_LEVEL_LABELS[level]}
						>
							{level}
						</button>
					{/each}
					<span class="strip-skip">
						Space to skip <KbdHint>Space</KbdHint>
					</span>
				</div>
			{/if}
			<div class="reveal-row">
				<button
					type="button"
					class="btn primary wide"
					onclick={() => {
						if (needsConfidence && confidence === null) skipConfidence();
						else reveal();
					}}
				>
					Show answer
					<span class="kbd">Enter</span>
				</button>
				<InfoTip
					term="Show answer"
					definition="Recall first, then check. Active recall builds retention; rereading the back first does not."
					helpId="concept-active-recall"
				/>
			</div>
		{:else if phase === REVIEW_PHASES.ANSWER}
			<div class="confidence-recall">
				{#if adjustingConfidence}
					<div class="confidence-strip" role="radiogroup" aria-label="Adjust confidence">
						<span class="strip-label">Confidence</span>
						{#each CONFIDENCE_LEVEL_VALUES as level (level)}
							<button
								type="button"
								role="radio"
								aria-checked={confidence === level}
								aria-label={`${level} -- ${CONFIDENCE_LEVEL_LABELS[level]}`}
								class="chicklet"
								class:is-selected={confidence === level}
								onclick={() => pickConfidence(level)}
							>
								{level}
							</button>
						{/each}
						<button type="button" class="strip-link" onclick={skipConfidence}>Clear</button>
					</div>
				{:else}
					<button type="button" class="confidence-recall-btn" onclick={startAdjustConfidence}>
						{#if confidence !== null}
							Confidence: <strong>{confidence}</strong>
							<span class="confidence-recall-hint">(click to adjust)</span>
						{:else}
							No confidence recorded
							<span class="confidence-recall-hint">(click to set)</span>
						{/if}
					</button>
				{/if}
			</div>

			<form class="feedback-form" onsubmit={submitFeedbackForm}>
				<div class="feedback-row" role="radiogroup" aria-label="Card feedback">
					{#each CARD_FEEDBACK_SIGNAL_VALUES as signal (signal)}
						<button
							type="button"
							role="radio"
							aria-checked={feedbackSignal === signal}
							class="feedback-pill feedback-{signal}"
							class:is-selected={feedbackSignal === signal}
							onclick={() => pickFeedback(signal)}
						>
							{CARD_FEEDBACK_SIGNAL_LABELS[signal]}
						</button>
					{/each}
				</div>
				{#if feedbackSignal}
					<label class="feedback-comment">
						<span class="feedback-comment-label">
							Comment{feedbackRequiresComment ? ' (required)' : ' (optional)'}
						</span>
						<textarea
							bind:value={feedbackComment}
							rows="2"
							placeholder={feedbackRequiresComment ? 'Tell us what is wrong with this card.' : 'Optional note'}
						></textarea>
						{#if feedbackError}
							<span class="feedback-error" role="alert">{feedbackError}</span>
						{/if}
						<div class="feedback-actions">
							<button
								type="button"
								class="btn ghost btn-small"
								onclick={() => {
									feedbackSignal = null;
									feedbackComment = '';
									feedbackError = null;
								}}
							>
								Cancel
							</button>
							<button type="submit" class="btn primary btn-small" disabled={feedbackSubmitting}>
								{feedbackSubmitting ? 'Saving...' : 'Save feedback'}
							</button>
						</div>
					</label>
				{:else if feedbackSignal === CARD_FEEDBACK_SIGNALS.LIKE}
					<!-- placeholder: Like is committed via the click above; keep node so layout doesn't jump -->
				{/if}
			</form>

			<p class="rate-q">How well did you remember?</p>
			<form
				method="POST"
				action="?/submit"
				use:enhance={({ formData }) => {
					const submittedCard = current;
					const submittedConfidence = confidence;
					const rating = Number(formData.get('rating') ?? 0);
					phase = REVIEW_PHASES.SUBMITTING;
					if (!submittedCard) return;
					formData.set('cardId', submittedCard.id);
					const answerMs = revealedAt !== null ? Date.now() - revealedAt : '';
					formData.set('answerMs', String(answerMs));
					if (submittedConfidence !== null) formData.set('confidence', String(submittedConfidence));
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							recordTally(rating);
							startUndoWindow(rating, submittedCard, submittedConfidence);
						} else {
							phase = REVIEW_PHASES.ANSWER;
							submitError =
								result.type === 'failure' ? 'Could not save that review. Try again.' : 'Network error. Try again.';
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
							title={previewTitle(r)}
						>
							<span class="rating-label">{REVIEW_RATING_LABELS[r]}</span>
							<span class="rating-interval">{previewLabel(r)}</span>
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

		{#if pendingUndo}
			<div class="undo-toast" role="status" aria-live="polite">
				<span class="undo-msg">
					Rated <strong>{pendingUndo.ratingLabel}</strong>.
					<span class="undo-domain">{domainLabel(pendingUndo.card.domain)}</span>
				</span>
				<a class="undo-link" href={ROUTES.MEMORY_CARD(pendingUndo.cardId)}>View card</a>
				<button type="button" class="undo-btn" onclick={triggerUndo} disabled={undoing}>
					{undoing ? 'Undoing...' : 'Undo'}
					<KbdHint>U</KbdHint>
				</button>
				<button type="button" class="undo-dismiss" onclick={cancelUndo} aria-label="Dismiss undo">&times;</button>
			</div>
		{/if}
	{/if}

	<JumpToCardPopover
		bind:open={jumpOpen}
		totalCards={totalCards}
		currentIndex={currentIndex}
		statuses={cardStatuses}
		onPick={handleJumpPick}
		onClose={closeJump}
	/>

	<SnoozeReasonPopover
		bind:open={snoozeOpen}
		initialReason={snoozeInitialReason}
		focusComment={snoozeFocusComment}
		onSubmit={handleSnoozeSubmit}
		onClose={closeSnooze}
	/>

	{#if current}
		<SharePopover
			bind:open={shareOpen}
			cardId={current.id}
			cardPublicUrl={`${page.url.origin}${ROUTES.CARD_PUBLIC(current.id)}`}
			onCopy={handleShareCopy}
			onReport={handleShareReport}
			onClose={closeShare}
		/>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		max-width: 42rem;
		margin: 0 auto;
		position: relative;
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
		animation: undo-fade-in var(--motion-normal) ease-out;
		margin-top: var(--space-md);
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

	.undo-link {
		color: var(--action-default-hover);
		font-size: var(--font-size-sm);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.undo-link:hover,
	.undo-link:focus-visible {
		color: var(--action-default);
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

	@keyframes undo-fade-in {
		from { opacity: 0; transform: translateY(4px); }
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

	.hd-right {
		display: inline-flex;
		align-items: center;
		gap: var(--space-md);
	}

	.header-btn {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-strong);
		color: var(--ink-body);
		font-size: var(--font-size-sm);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		cursor: pointer;
	}

	.header-btn:hover {
		background: var(--edge-default);
	}

	.header-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.share-toast {
		align-self: flex-end;
		padding: var(--space-2xs) var(--space-md);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		color: var(--action-default-hover);
		font-size: var(--font-size-sm);
		font-weight: 600;
		border-radius: var(--radius-pill);
		animation: undo-fade-in var(--motion-normal) ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.share-toast { animation: none; }
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
		display: inline-flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.counter-trigger {
		background: transparent;
		border: 1px solid transparent;
		color: var(--ink-subtle);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: 600;
		letter-spacing: var(--letter-spacing-wide);
		text-transform: uppercase;
	}

	.counter-trigger:hover {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}

	.counter-trigger:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
		border-color: var(--action-default-edge);
	}

	.counter-line {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.counter-caret {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.counter-sub {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
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

	.re-entry-banner {
		background: var(--signal-info-wash, var(--action-default-wash));
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		color: var(--action-default-hover);
		font-size: var(--font-size-sm);
		font-weight: 500;
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

	.confidence-strip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel, var(--ink-inverse));
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		flex-wrap: wrap;
	}

	.strip-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-right: var(--space-xs);
	}

	.strip-skip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
		margin-left: auto;
	}

	.strip-link {
		background: transparent;
		border: none;
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		cursor: pointer;
		padding: 0;
		margin-left: auto;
		text-decoration: underline;
	}

	.chicklet {
		min-width: 2.5rem;
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: var(--font-size-body);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-strong);
		color: var(--ink-body);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast),
			transform var(--motion-fast);
	}

	.chicklet:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.chicklet:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.chicklet.is-selected {
		background: var(--action-default-wash);
		border-color: var(--action-default);
		color: var(--action-default-hover);
	}

	.confidence-recall {
		display: flex;
		justify-content: center;
	}

	.confidence-recall-btn {
		background: transparent;
		border: 1px dashed var(--edge-strong);
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		padding: var(--space-2xs) var(--space-md);
		border-radius: var(--radius-pill);
		cursor: pointer;
	}

	.confidence-recall-btn:hover,
	.confidence-recall-btn:focus-visible {
		background: var(--surface-sunken);
		color: var(--ink-body);
		outline: none;
	}

	.confidence-recall-hint {
		color: var(--ink-faint);
		margin-left: var(--space-2xs);
	}

	.feedback-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.feedback-row {
		display: inline-flex;
		gap: var(--space-xs);
		align-self: flex-start;
	}

	.feedback-pill {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		cursor: pointer;
	}

	.feedback-pill:hover {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}

	.feedback-pill:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.feedback-pill.is-selected {
		background: var(--action-default-wash);
		border-color: var(--action-default);
		color: var(--action-default-hover);
	}

	.feedback-comment {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.feedback-comment-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.feedback-comment textarea {
		font: inherit;
		resize: vertical;
		padding: var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.feedback-error {
		color: var(--action-hazard-hover);
		font-size: var(--font-size-xs);
	}

	.feedback-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-xs);
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

	.rating-interval {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
		font-variant-numeric: tabular-nums;
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

	.btn-small {
		padding: var(--space-2xs) var(--space-md);
		font-size: var(--font-size-sm);
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

	.submit-error {
		margin: var(--space-sm) 0 0;
		color: var(--action-hazard-hover);
		font-size: var(--font-size-sm);
		text-align: center;
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
