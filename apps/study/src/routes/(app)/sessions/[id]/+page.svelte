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
							<input type="hidden" name="slotIndex" value={current.slotIndex} />
							{#if confidence !== null}<input type="hidden" name="confidence" value={confidence} />{/if}
							<button type="submit" name="rating" value={REVIEW_RATINGS.AGAIN} class="btn rating again" disabled={loading}>Again</button>
							<button type="submit" name="rating" value={REVIEW_RATINGS.HARD} class="btn rating hard" disabled={loading}>Hard</button>
							<button type="submit" name="rating" value={REVIEW_RATINGS.GOOD} class="btn rating good" disabled={loading}>Good</button>
							<button type="submit" name="rating" value={REVIEW_RATINGS.EASY} class="btn rating easy" disabled={loading}>Easy</button>
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
				<form method="post" action="?/skip" use:enhance>
					<input type="hidden" name="slotIndex" value={current.slotIndex} />
					<input type="hidden" name="skipKind" value={SESSION_SKIP_KINDS.PERMANENT} />
					<button type="submit" class="link-btn danger">Skip permanently</button>
				</form>
			</footer>
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
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.progress {
		background: #e2e8f0;
		height: 0.375rem;
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: #2563eb;
		transition: width 200ms;
	}

	.error {
		background: #fef2f2;
		color: #b91c1c;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		border: 1px solid #fecaca;
		font-size: 0.875rem;
	}

	.item-card {
		background: white;
		border: 1px solid #e2e8f0;
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
		background: #eff6ff;
		color: #1d4ed8;
	}

	.reason {
		color: #0f172a;
		font-weight: 500;
	}

	.reason-detail {
		color: #64748b;
	}

	.domain {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
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
		color: #0f172a;
		line-height: 1.4;
	}

	.card-back {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 1rem;
		color: #0f172a;
	}

	.rep-title,
	.node-title {
		margin: 0;
		font-size: 1.125rem;
	}

	.situation {
		color: #0f172a;
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

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.option {
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		color: #0f172a;
		justify-content: flex-start;
		text-align: left;
		padding: 0.75rem 1rem;
	}

	.option:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.rating.again {
		background: #fee2e2;
		color: #991b1b;
	}

	.rating.hard {
		background: #fef3c7;
		color: #92400e;
	}

	.rating.good {
		background: #dcfce7;
		color: #166534;
	}

	.rating.easy {
		background: #dbeafe;
		color: #1e40af;
	}

	.skip-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid #f1f5f9;
	}

	.link-btn {
		background: transparent;
		border: none;
		color: #64748b;
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.link-btn.danger {
		color: #b91c1c;
	}

	.empty {
		background: white;
		border: 1px solid #e2e8f0;
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
		color: #94a3b8;
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
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}
</style>
