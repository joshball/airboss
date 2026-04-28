<script lang="ts">
import {
	type ConfidenceLevel,
	domainLabel,
	QUERY_PARAMS,
	REVIEW_RATINGS,
	ROUTES,
	SESSION_ITEM_KINDS,
	SESSION_ITEM_PHASES,
	SESSION_REASON_CODE_LABELS,
	SESSION_SKIP_KINDS,
	SESSION_SLICE_LABELS,
	type SessionItemPhase,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import { humanize } from '@ab/utils';
import { enhance } from '$app/forms';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const current = $derived(data.current);
const hydrated = $derived(data.hydrated);
const total = $derived(data.results.length);
const completedCount = $derived(data.results.filter((r) => r.completedAt !== null).length);
const currentNum = $derived(current ? current.slotIndex + 1 : total);

// URL-persisted phases are the 3 meaningful states; `submitting` is a
// transient in-flight flag tracked by `loading` instead.

// svelte-ignore state_referenced_locally -- seed from server-narrowed deep link; URL syncs thereafter
let phase = $state<SessionItemPhase>(data.initialStep as SessionItemPhase);
let confidence = $state<ConfidenceLevel | null>(null);
let skippedConfidence = $state(false);
let selectedOption = $state<string | null>(null);
let loading = $state(false);

// Reset flow whenever the current slot changes (server load advances).
let lastSlotKey = $state<string | null>(null);
$effect(() => {
	const key = current ? `${data.session.id}:${current.slotIndex}` : null;
	if (key !== lastSlotKey) {
		lastSlotKey = key;
		phase = SESSION_ITEM_PHASES.READ;
		confidence = null;
		skippedConfidence = false;
		selectedOption = null;
		loading = false;
	}
});

// Mirror phase + item index to the URL so a refresh mid-flow lands back in
// the same place (e.g. reopened the tab at the confidence slider, not all
// the way back to read). Uses replaceState to avoid polluting history.
$effect(() => {
	const step = phase;
	const item = current?.slotIndex ?? data.initialItem;
	const url = new URL(page.url);
	const needsUpdate =
		url.searchParams.get(QUERY_PARAMS.STEP) !== step || url.searchParams.get(QUERY_PARAMS.ITEM) !== String(item);
	if (!needsUpdate) return;
	url.searchParams.set(QUERY_PARAMS.STEP, step);
	url.searchParams.set(QUERY_PARAMS.ITEM, String(item));
	replaceState(url, page.state);
});

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}

function sliceLabel(slice: SessionSlice): string {
	return SESSION_SLICE_LABELS[slice];
}
</script>

<svelte:head>
	<title>Session -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Session in progress</h1>
			<p class="sub">Item {currentNum} of {total} -- {completedCount} done</p>
		</div>
		<nav class="quick">
			<ConfirmAction
				formAction="?/finish"
				triggerVariant="ghost"
				confirmVariant="danger"
				size="md"
				label="Finish early"
				confirmLabel="End session now"
			/>
		</nav>
	</header>

	<div class="progress" aria-label="Session progress" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={completedCount} aria-valuetext="{completedCount} of {total} done">
		<span class="progress-fill" style="width: {total === 0 ? 0 : Math.round((completedCount / total) * 100)}%"></span>
	</div>

	<div class="visually-hidden" aria-live="polite" aria-atomic="true">
		{#if current}
			Item {currentNum} of {total}. Phase {phase}.
		{:else}
			All items resolved.
		{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div class="error" role="alert">{form.error}</div>
	{/if}

	{#if !current}
		<article class="empty">
			<h2>All items resolved</h2>
			<p class="muted">Finish to see your summary.</p>
			<form method="post" action="?/finish" use:enhance>
				<button type="submit" class="btn primary">Show summary</button>
			</form>
		</article>
	{:else if current && hydrated}
		<article class="item-card">
			<div class="item-head">
				<span class="slice-badge">{sliceLabel(current.slice as SessionSlice)}</span>
				<span class="reason">{reasonLabel(current.reasonCode as SessionReasonCode)}</span>
				{#if current.reasonDetail}<span class="reason-detail">-- {current.reasonDetail}</span>{/if}
			</div>

			{#if hydrated.kind === SESSION_ITEM_KINDS.CARD}
				{@const cardView = hydrated}
				<div class="card-body">
					<div class="domain">{domainLabel(cardView.domain)}</div>
					<div class="card-front">{cardView.front}</div>

					{#if phase === SESSION_ITEM_PHASES.READ}
						{#if current.itemKind === SESSION_ITEM_KINDS.CARD}
							<div class="actions">
								<button type="button" class="btn primary" onclick={() => (phase = SESSION_ITEM_PHASES.CONFIDENCE)}>Reveal</button>
							</div>
						{/if}
					{:else if phase === SESSION_ITEM_PHASES.CONFIDENCE}
						<ConfidenceSlider
							onSelect={(v) => {
								confidence = v;
								phase = SESSION_ITEM_PHASES.ANSWER;
							}}
							onSkip={() => {
								confidence = null;
								skippedConfidence = true;
								phase = SESSION_ITEM_PHASES.ANSWER;
							}}
						/>
					{:else}
						<div class="card-back">{cardView.back}</div>

						<form
							method="post"
							action="?/submitReview"
							class="rating-row"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update();
									loading = false;
								};
							}}
						>
							<fieldset class="rating-fieldset">
								<legend class="visually-hidden">Rate this card</legend>
								<input type="hidden" name="slotIndex" value={current.slotIndex} />
								{#if confidence !== null}<input type="hidden" name="confidence" value={confidence} />{/if}
								<button type="submit" name="rating" value={REVIEW_RATINGS.AGAIN} class="btn rating again" disabled={loading}>Again</button>
								<button type="submit" name="rating" value={REVIEW_RATINGS.HARD} class="btn rating hard" disabled={loading}>Hard</button>
								<button type="submit" name="rating" value={REVIEW_RATINGS.GOOD} class="btn rating good" disabled={loading}>Good</button>
								<button type="submit" name="rating" value={REVIEW_RATINGS.EASY} class="btn rating easy" disabled={loading}>Easy</button>
							</fieldset>
						</form>
					{/if}
				</div>
			{:else if hydrated.kind === SESSION_ITEM_KINDS.REP}
				{@const repView = hydrated}
				<div class="rep-body">
					<h3 class="rep-title">{repView.title}</h3>
					<div class="domain">{domainLabel(repView.domain)}</div>
					<p class="situation">{repView.situation}</p>

					{#if phase === SESSION_ITEM_PHASES.READ}
						<div class="actions">
							<button type="button" class="btn primary" onclick={() => (phase = SESSION_ITEM_PHASES.CONFIDENCE)}>Pick an option</button>
						</div>
					{:else if phase === SESSION_ITEM_PHASES.CONFIDENCE}
						<ConfidenceSlider
							onSelect={(v) => {
								confidence = v;
								phase = SESSION_ITEM_PHASES.ANSWER;
							}}
							onSkip={() => {
								confidence = null;
								skippedConfidence = true;
								phase = SESSION_ITEM_PHASES.ANSWER;
							}}
						/>
					{:else}
						<form
							method="post"
							action="?/submitRep"
							class="options"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update();
									loading = false;
								};
							}}
						>
							<input type="hidden" name="slotIndex" value={current.slotIndex} />
							{#if confidence !== null}<input type="hidden" name="confidence" value={confidence} />{/if}
							{#each repView.options as opt (opt.id)}
								<button
									type="submit"
									name="chosenOptionId"
									value={opt.id}
									class="btn option"
									disabled={loading}
									aria-pressed={selectedOption === opt.id}
									onclick={() => {
										selectedOption = opt.id;
									}}
								>
									{opt.text}
								</button>
							{/each}
						</form>
					{/if}
				</div>
			{:else if hydrated.kind === SESSION_ITEM_KINDS.NODE_START}
				{@const nodeView = hydrated}
				<div class="node-body">
					<h3 class="node-title">Start node: {nodeView.title}</h3>
					<p class="muted">Open the knowledge page, then mark as started to move on.</p>
					<div class="actions">
						<a class="btn secondary" href={ROUTES.KNOWLEDGE_LEARN(nodeView.slug)} target="_blank" rel="noopener">
							Open node
						</a>
						<form
							method="post"
							action="?/completeNode"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update();
									loading = false;
								};
							}}
						>
							<input type="hidden" name="slotIndex" value={current.slotIndex} />
							<button type="submit" class="btn primary" disabled={loading}>Mark started</button>
						</form>
					</div>
				</div>
			{/if}

			<footer class="skip-row">
				<form method="post" action="?/skip" use:enhance>
					<input type="hidden" name="slotIndex" value={current.slotIndex} />
					<input type="hidden" name="skipKind" value={SESSION_SKIP_KINDS.TODAY} />
					<button type="submit" class="link-btn">Skip today</button>
				</form>
				<ConfirmAction
					formAction="?/skip"
					confirmVariant="secondary"
					triggerVariant="ghost"
					size="sm"
					label="Skip topic"
					confirmLabel="Skip this topic (adds to plan)"
					hiddenFields={{
						slotIndex: String(current.slotIndex),
						skipKind: SESSION_SKIP_KINDS.TOPIC,
					}}
				/>
				<ConfirmAction
					formAction="?/skip"
					confirmVariant="danger"
					triggerVariant="ghost"
					size="sm"
					label="Skip permanently"
					confirmLabel="Skip permanently (undo from plan)"
					hiddenFields={{
						slotIndex: String(current.slotIndex),
						skipKind: SESSION_SKIP_KINDS.PERMANENT,
					}}
				/>
			</footer>
			<p class="skip-hint">Topic + permanent skips can be reactivated from the plan detail page.</p>
		</article>
	{:else if current}
		<article class="empty">
			<h2>This item is unavailable</h2>
			<p class="muted">The underlying {current.itemKind} may have been deleted. Skip to move on.</p>
			<form method="post" action="?/skip" use:enhance>
				<input type="hidden" name="slotIndex" value={current.slotIndex} />
				<input type="hidden" name="skipKind" value={SESSION_SKIP_KINDS.TODAY} />
				<button type="submit" class="btn secondary">Skip</button>
			</form>
		</article>
	{/if}

	{#if skippedConfidence}
		<p class="muted small">Confidence skipped for this item.</p>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-xl);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
	}

	.progress {
		background: var(--edge-default);
		height: 0.375rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-normal);
	}

	.error {
		background: var(--action-hazard-wash);
		color: var(--action-hazard-hover);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--action-hazard-edge);
		font-size: var(--font-size-sm);
	}

	.item-card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.item-head {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		flex-wrap: wrap;
		font-size: var(--font-size-sm);
	}

	.slice-badge {
		display: inline-block;
		font-weight: 700;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
	}

	.reason {
		color: var(--ink-body);
		font-weight: 500;
	}

	.reason-detail {
		color: var(--ink-subtle);
	}

	.domain {
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
	}

	.card-body,
	.rep-body,
	.node-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.card-front {
		font-size: var(--font-size-xl);
		color: var(--ink-body);
		line-height: 1.4;
	}

	.card-back {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		color: var(--ink-body);
	}

	.rep-title,
	.node-title {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.situation {
		color: var(--ink-body);
		line-height: 1.5;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
	}

	.rating-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-sm);
	}

	.rating-fieldset {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-sm);
		border: 0;
		margin: 0;
		padding: 0;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.option {
		background: var(--surface-muted);
		border: 1px solid var(--edge-strong);
		color: var(--ink-body);
		justify-content: flex-start;
		text-align: left;
		padding: var(--space-md) var(--space-lg);
	}

	.option:hover:not(:disabled) {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.rating.again {
		background: var(--action-hazard-wash);
		color: var(--action-hazard-active);
	}

	.rating.hard {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.rating.good {
		background: var(--signal-success-wash);
		color: var(--signal-success);
	}

	.rating.easy {
		background: var(--action-default-wash);
		color: var(--action-default-active);
	}

	.skip-row {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-md);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--surface-sunken);
	}

	.link-btn {
		background: transparent;
		border: none;
		color: var(--ink-subtle);
		cursor: pointer;
		font-size: var(--font-size-sm);
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.link-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

	.skip-hint {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
		text-align: right;
	}

	.empty {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.muted {
		color: var(--ink-faint);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.small {
		font-size: var(--font-size-xs);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.btn:focus-visible,
	.option:focus-visible,
	.rating:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

</style>
