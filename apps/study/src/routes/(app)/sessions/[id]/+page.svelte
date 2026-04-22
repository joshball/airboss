<script lang="ts">
import {
	type ConfidenceLevel,
	DOMAIN_LABELS,
	QUERY_PARAMS,
	REVIEW_RATINGS,
	ROUTES,
	SESSION_ITEM_KINDS,
	SESSION_REASON_CODE_LABELS,
	SESSION_SKIP_KINDS,
	SESSION_SLICE_LABELS,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import ConfidenceSlider from '@ab/ui/components/ConfidenceSlider.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
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
type Phase = 'read' | 'confidence' | 'answer';

// svelte-ignore state_referenced_locally -- seed from server-narrowed deep link; URL syncs thereafter
let phase = $state<Phase>(data.initialStep);
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
		phase = 'read';
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

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}

function sliceLabel(slice: SessionSlice): string {
	return SESSION_SLICE_LABELS[slice];
}
</script>

<svelte:head>
	<title>Session — airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Session in progress</h1>
			<p class="sub">Item {currentNum} of {total} · {completedCount} done</p>
		</div>
		<nav class="quick">
			<form method="post" action="?/finish" use:enhance>
				<button type="submit" class="btn ghost">Finish early</button>
			</form>
		</nav>
	</header>

	<div class="progress" aria-label="Session progress" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={completedCount}>
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
				{#if current.reasonDetail}<span class="reason-detail">— {current.reasonDetail}</span>{/if}
			</div>

			{#if hydrated.kind === SESSION_ITEM_KINDS.CARD}
				{@const cardView = hydrated}
				<div class="card-body">
					<div class="domain">{domainLabel(cardView.domain)}</div>
					<div class="card-front">{cardView.front}</div>

					{#if phase === 'read'}
						{#if current.itemKind === SESSION_ITEM_KINDS.CARD}
							<div class="actions">
								<button type="button" class="btn primary" onclick={() => (phase = 'confidence')}>Reveal</button>
							</div>
						{/if}
					{:else if phase === 'confidence'}
						<ConfidenceSlider
							onSelect={(v) => {
								confidence = v;
								phase = 'answer';
							}}
							onSkip={() => {
								confidence = null;
								skippedConfidence = true;
								phase = 'answer';
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

					{#if phase === 'read'}
						<div class="actions">
							<button type="button" class="btn primary" onclick={() => (phase = 'confidence')}>Pick an option</button>
						</div>
					{:else if phase === 'confidence'}
						<ConfidenceSlider
							onSelect={(v) => {
								confidence = v;
								phase = 'answer';
							}}
							onSkip={() => {
								confidence = null;
								skippedConfidence = true;
								phase = 'answer';
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
									name="chosenOption"
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
		gap: 1rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: 0.875rem;
	}

	.progress {
		background: var(--ab-color-border);
		height: 0.375rem;
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: var(--ab-color-primary);
		transition: width var(--ab-transition-normal);
	}

	.error {
		background: var(--ab-color-danger-subtle);
		color: var(--ab-color-danger-hover);
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		border: 1px solid var(--ab-color-danger-subtle-border);
		font-size: 0.875rem;
	}

	.item-card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.item-head {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		flex-wrap: wrap;
		font-size: 0.8125rem;
	}

	.slice-badge {
		display: inline-block;
		font-weight: 700;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: var(--ab-color-primary-subtle);
		color: var(--ab-color-primary-hover);
	}

	.reason {
		color: var(--ab-color-fg);
		font-weight: 500;
	}

	.reason-detail {
		color: var(--ab-color-fg-subtle);
	}

	.domain {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-subtle);
	}

	.card-body,
	.rep-body,
	.node-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card-front {
		font-size: 1.25rem;
		color: var(--ab-color-fg);
		line-height: 1.4;
	}

	.card-back {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: 10px;
		padding: 1rem;
		color: var(--ab-color-fg);
	}

	.rep-title,
	.node-title {
		margin: 0;
		font-size: 1.125rem;
	}

	.situation {
		color: var(--ab-color-fg);
		line-height: 1.5;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.rating-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.rating-fieldset {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
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
		gap: 0.5rem;
	}

	.option {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border-strong);
		color: var(--ab-color-fg);
		justify-content: flex-start;
		text-align: left;
		padding: 0.75rem 1rem;
	}

	.option:hover:not(:disabled) {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.rating.again {
		background: var(--ab-color-danger-subtle);
		color: var(--ab-color-danger-active);
	}

	.rating.hard {
		background: var(--ab-color-warning-subtle);
		color: var(--ab-color-warning-active);
	}

	.rating.good {
		background: var(--ab-color-success-subtle);
		color: var(--ab-color-success-active);
	}

	.rating.easy {
		background: var(--ab-color-primary-subtle);
		color: var(--ab-color-primary-active);
	}

	.skip-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--ab-color-surface-sunken);
	}

	.link-btn {
		background: transparent;
		border: none;
		color: var(--ab-color-fg-subtle);
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.link-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
		border-radius: 4px;
	}

	.skip-hint {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		color: var(--ab-color-fg-subtle);
		text-align: right;
	}

	.empty {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.muted {
		color: var(--ab-color-fg-faint);
		margin: 0;
		font-size: 0.875rem;
	}

	.small {
		font-size: 0.75rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.btn:focus-visible,
	.option:focus-visible,
	.rating:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}
</style>
