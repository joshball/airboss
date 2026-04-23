<script lang="ts">
import {
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPES,
	type CardType,
	CONTENT_SOURCES,
	DOMAIN_LABELS,
	DOMAINS,
	type Domain,
	QUERY_PARAMS,
	REVIEW_RATINGS,
	ROUTES,
} from '@ab/constants';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import { humanize } from '@ab/utils';
import { tick } from 'svelte';
import { enhance } from '$app/forms';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

interface FieldValues {
	front?: string;
	back?: string;
	domain?: string;
	cardType?: string;
	tags?: string[];
}

// svelte-ignore state_referenced_locally -- seed once from URL; $effect keeps URL + state in sync
let editing = $state(page.url.searchParams.get(QUERY_PARAMS.EDIT) === '1');
let saving = $state(false);
let statusUpdating = $state(false);
let editFrontInput = $state<HTMLTextAreaElement | null>(null);

// Mirror the edit-mode flag to the URL so ?edit=1 is shareable and a
// refresh keeps the user in edit mode. When editing is false we drop the
// flag entirely instead of writing ?edit=0, keeping URLs clean.
$effect(() => {
	const on = editing;
	const url = new URL(page.url);
	const already = url.searchParams.get(QUERY_PARAMS.EDIT) === '1';
	if (on && !already) {
		url.searchParams.set(QUERY_PARAMS.EDIT, '1');
		replaceState(url, page.state);
	} else if (!on && url.searchParams.has(QUERY_PARAMS.EDIT)) {
		url.searchParams.delete(QUERY_PARAMS.EDIT);
		replaceState(url, page.state);
	}
});

const card = $derived(data.card);
const schedule = $derived(data.state);
const recentReviews = $derived(data.recentReviews);

const fieldErrors = $derived<Record<string, string>>(form?.fieldErrors ?? {});
const editValues = $derived<FieldValues>((form?.intent === 'update' ? form.values : undefined) ?? {});

// Edit-then-stay toast: after a successful update the server returns
// `{ success: true, intent: 'update', message }` and we surface a short-lived
// status message. Auto-dismiss after ~3 seconds so it never lingers into the
// next interaction. See DESIGN_PRINCIPLES.md #7.
let editToastVisible = $state(false);
let editToastMessage = $state('');

$effect(() => {
	const isEditSuccess = Boolean(
		form && 'success' in form && form.success && 'intent' in form && form.intent === 'update',
	);
	if (!isEditSuccess) return;
	editToastMessage = (form && 'message' in form && typeof form.message === 'string' && form.message) || 'Card saved.';
	editToastVisible = true;
	// A successful save also exits edit mode so the updated values display.
	editing = false;
	const timer = setTimeout(() => {
		editToastVisible = false;
	}, 3000);
	return () => clearTimeout(timer);
});

const domainOptions = Object.values(DOMAINS);
const cardTypeOptions = Object.values(CARD_TYPES);

const ratingLabels: Record<number, string> = {
	[REVIEW_RATINGS.AGAIN]: 'Again',
	[REVIEW_RATINGS.HARD]: 'Hard',
	[REVIEW_RATINGS.GOOD]: 'Good',
	[REVIEW_RATINGS.EASY]: 'Easy',
};

async function startEdit() {
	editing = true;
	await tick();
	editFrontInput?.focus();
}

function confirmDiscardEdit() {
	editing = false;
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function formatInterval(ms: number): string {
	const abs = Math.abs(ms);
	const minutes = abs / 60_000;
	const hours = minutes / 60;
	const days = hours / 24;
	const future = ms >= 0;
	let value: string;
	if (abs < 60_000) value = `${Math.round(abs / 1000)}s`;
	else if (minutes < 60) value = `${Math.round(minutes)}m`;
	else if (hours < 48) value = `${Math.round(hours)}h`;
	else if (days < 60) value = `${Math.round(days)}d`;
	else value = `${Math.round(days / 30)}mo`;
	return future ? `in ${value}` : `${value} ago`;
}

function formatDate(d: Date | string): string {
	const date = typeof d === 'string' ? new Date(d) : d;
	return date.toLocaleString();
}

const dueLabel = $derived(formatInterval(new Date(schedule.dueAt).getTime() - Date.now()));
const tagsString = $derived((card.tags ?? []).join(', '));
</script>

<svelte:head>
	<title>{card.front.slice(0, 60)} -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<a class="back" href={ROUTES.MEMORY_BROWSE}>← Browse</a>
			<h1>Card detail</h1>
		</div>
		<div class="badges">
			<span class="badge domain">{domainLabel(card.domain)}</span>
			<span class="badge type">{cardTypeLabel(card.cardType)}</span>
			{#if card.status !== CARD_STATUSES.ACTIVE}
				<span class="badge status-{card.status}">{humanize(card.status)}</span>
			{/if}
			{#if card.sourceType !== CONTENT_SOURCES.PERSONAL}
				<span class="badge source" title={card.sourceRef ?? ''}>{humanize(card.sourceType)}</span>
			{/if}
		</div>
	</header>

	{#if editToastVisible}
		<div class="toast" role="status">{editToastMessage}</div>
	{/if}

	{#if fieldErrors._}
		<div class="error" role="alert">{fieldErrors._}</div>
	{/if}

	{#if editing && card.isEditable}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					saving = false;
					await update();
				};
			}}
		>
			<label class="field">
				<span class="label">Front</span>
				<textarea
					name="front"
					rows="3"
					required
					maxlength="10000"
					disabled={saving}
					value={editValues.front ?? card.front}
					bind:this={editFrontInput}
					aria-invalid={fieldErrors.front ? 'true' : undefined}
					aria-describedby={fieldErrors.front ? 'edit-front-err' : undefined}
				></textarea>
				{#if fieldErrors.front}<span id="edit-front-err" class="err">{fieldErrors.front}</span>{/if}
			</label>
			<label class="field">
				<span class="label">Back</span>
				<textarea
					name="back"
					rows="4"
					required
					maxlength="10000"
					disabled={saving}
					value={editValues.back ?? card.back}
					aria-invalid={fieldErrors.back ? 'true' : undefined}
					aria-describedby={fieldErrors.back ? 'edit-back-err' : undefined}
				></textarea>
				{#if fieldErrors.back}<span id="edit-back-err" class="err">{fieldErrors.back}</span>{/if}
			</label>
			<div class="row">
				<label class="field">
					<span class="label">Domain</span>
					<select name="domain" required disabled={saving} value={editValues.domain ?? card.domain}>
						{#each domainOptions as d (d)}
							<option value={d}>{domainLabel(d)}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="label">Type</span>
					<select name="cardType" required disabled={saving} value={editValues.cardType ?? card.cardType}>
						{#each cardTypeOptions as t (t)}
							<option value={t}>{cardTypeLabel(t)}</option>
						{/each}
					</select>
				</label>
			</div>
			<label class="field">
				<span class="label">Tags <span class="hint">(comma-separated)</span></span>
				<input type="text" name="tags" disabled={saving} value={editValues.tags?.join?.(', ') ?? tagsString} />
			</label>
			<div class="actions">
				<button type="button" class="btn ghost" onclick={confirmDiscardEdit} disabled={saving}>Cancel</button>
				<button type="submit" class="btn primary" disabled={saving}>
					{saving ? 'Saving...' : 'Save changes'}
				</button>
			</div>
		</form>
	{:else}
		<article class="content">
			<div class="cell">
				<div class="cell-label">Front</div>
				<div class="cell-text">{card.front}</div>
			</div>
			<div class="cell">
				<div class="cell-label">Back</div>
				<div class="cell-text">{card.back}</div>
			</div>
			{#if (card.tags ?? []).length > 0}
				<div class="cell">
					<div class="cell-label">Tags</div>
					<div class="tags">
						{#each card.tags ?? [] as tag (tag)}
							<span class="tag">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="row action-row">
				{#if card.isEditable}
					<button type="button" class="btn secondary" onclick={startEdit}>Edit</button>
				{:else}
					<span class="note">This card is read-only (source: {humanize(card.sourceType)}).</span>
				{/if}
				<div class="inline-form">
					{#if card.status === CARD_STATUSES.ACTIVE}
						<ConfirmAction
							formAction="?/setStatus"
							confirmVariant="secondary"
							triggerVariant="secondary"
							size="md"
							label="Suspend"
							confirmLabel="Suspend this card"
							hiddenFields={{ status: CARD_STATUSES.SUSPENDED }}
							disabled={statusUpdating}
						/>
						<ConfirmAction
							formAction="?/setStatus"
							confirmVariant="danger"
							triggerVariant="ghost"
							size="md"
							label="Archive"
							confirmLabel="Archive this card"
							hiddenFields={{ status: CARD_STATUSES.ARCHIVED }}
						/>
					{:else}
						<form
							method="POST"
							action="?/setStatus"
							class="status-form"
							use:enhance={() => {
								statusUpdating = true;
								return async ({ update }) => {
									statusUpdating = false;
									await update();
								};
							}}
						>
							<button
								type="submit"
								class="btn secondary"
								name="status"
								value={CARD_STATUSES.ACTIVE}
								disabled={statusUpdating}
							>
								{statusUpdating ? '...' : 'Reactivate'}
							</button>
						</form>
						{#if card.status === CARD_STATUSES.SUSPENDED}
							<ConfirmAction
								formAction="?/setStatus"
								confirmVariant="danger"
								triggerVariant="ghost"
								size="md"
								label="Archive"
								confirmLabel="Archive this card"
								hiddenFields={{ status: CARD_STATUSES.ARCHIVED }}
							/>
						{/if}
					{/if}
				</div>
			</div>
		</article>
	{/if}

	<article class="content schedule">
		<h2>Schedule</h2>
		<dl class="stats">
			<div><dt>State</dt><dd>{humanize(schedule.state)}</dd></div>
			<div><dt>Due</dt><dd>{dueLabel}</dd></div>
			<div><dt>Stability</dt><dd>{schedule.stability.toFixed(2)} d</dd></div>
			<div><dt>Difficulty</dt><dd>{schedule.difficulty.toFixed(2)}</dd></div>
			<div><dt>Reviews</dt><dd>{schedule.reviewCount}</dd></div>
			<div><dt>Lapses</dt><dd>{schedule.lapseCount}</dd></div>
		</dl>
	</article>

	<article class="content">
		<h2>Recent reviews</h2>
		{#if recentReviews.length === 0}
			<p class="empty-note">No reviews yet.</p>
		{:else}
			<table class="reviews">
				<thead>
					<tr>
						<th scope="col">When</th>
						<th scope="col">Rating</th>
						<th scope="col">Confidence</th>
						<th scope="col">Stability</th>
						<th scope="col">State</th>
						<th scope="col">Next due</th>
					</tr>
				</thead>
				<tbody>
					{#each recentReviews as r (r.id)}
						<tr>
							<td>{formatDate(r.reviewedAt)}</td>
							<td>{ratingLabels[r.rating] ?? r.rating}</td>
							<td>{r.confidence ?? '-'}</td>
							<td>{r.stability.toFixed(2)} d</td>
							<td>{humanize(r.state)}</td>
							<td>{formatDate(r.dueAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</article>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xl-alt);
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--ab-space-lg);
		flex-wrap: wrap;
	}

	.back {
		color: var(--ab-color-fg-muted);
		text-decoration: none;
		font-size: var(--ab-font-size-sm);
	}

	.back:hover {
		color: var(--ab-color-fg);
	}

	h1 {
		margin: var(--ab-space-2xs) 0 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.badges {
		display: flex;
		gap: var(--ab-space-xs);
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--ab-space-3xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		border-radius: var(--ab-radius-pill);
		border: 1px solid var(--ab-color-border);
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: var(--ab-color-primary-hover);
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.badge.status-suspended {
		color: var(--ab-color-warning-active);
		background: var(--ab-color-warning-subtle);
		border-color: var(--ab-color-warning-subtle-border);
	}

	.badge.status-archived {
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-sunken);
		border-color: var(--ab-color-border);
	}

	.badge.source {
		color: var(--ab-color-accent-fg);
		background: var(--ab-color-accent-subtle);
		border-color: var(--ab-color-accent-subtle-border);
	}

	.error {
		background: var(--ab-color-danger-subtle);
		border: 1px solid var(--ab-color-danger-subtle-border);
		color: var(--ab-color-danger-active);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.toast {
		background: var(--ab-color-success-subtle);
		border: 1px solid var(--ab-color-success-subtle-border);
		color: var(--ab-color-success-active);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.content {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-xl-alt) var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
	}

	.content h2 {
		margin: 0;
		font-size: var(--ab-font-size-base);
		color: var(--ab-color-fg-strong);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.cell-label {
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--ab-space-2xs);
	}

	.cell-text {
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-base);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--ab-space-xs);
	}

	.tag {
		padding: var(--ab-space-3xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		background: var(--ab-color-surface-sunken);
		border-radius: var(--ab-radius-pill);
		color: var(--ab-color-fg-muted);
	}

	.row {
		display: flex;
		gap: var(--ab-space-lg);
	}

	.action-row {
		justify-content: space-between;
		flex-wrap: wrap;
		align-items: center;
	}

	.inline-form {
		display: flex;
		gap: var(--ab-space-xs);
		align-items: center;
	}

	.status-form {
		display: inline-flex;
	}

	.note {
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	form:not(.inline-form):not(.status-form) {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
	}

	.label {
		font-size: var(--ab-font-size-sm);
		font-weight: 500;
		color: var(--ab-color-fg-strong);
	}

	.hint {
		font-weight: 400;
		color: var(--ab-color-fg-faint);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: var(--ab-space-sm-alt) var(--ab-space-md);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		background: white;
		color: var(--ab-color-fg);
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--ab-color-primary);
		box-shadow: var(--ab-shadow-focus-ring);
	}

	:disabled {
		background: var(--ab-color-surface-sunken);
		cursor: not-allowed;
	}

	.row.action-row {
		justify-content: space-between;
	}

	.actions {
		display: flex;
		gap: var(--ab-space-sm);
		justify-content: flex-end;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--ab-space-md);
	}

	.stats > div {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-sm-alt) var(--ab-space-md);
	}

	.stats dt {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
	}

	.stats dd {
		margin: var(--ab-space-3xs) 0 0;
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-body);
		font-weight: 500;
	}

	.err {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-danger-hover);
	}

	.empty-note {
		margin: 0;
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-sm);
	}

	.reviews {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--ab-font-size-sm);
	}

	.reviews th,
	.reviews td {
		padding: var(--ab-space-sm) var(--ab-space-md);
		text-align: left;
		border-bottom: 1px solid var(--ab-color-border);
	}

	.reviews th {
		color: var(--ab-color-fg-subtle);
		font-weight: 600;
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.reviews tr:last-child td {
		border-bottom: none;
	}

	.btn {
		padding: var(--ab-space-sm) var(--ab-space-lg);
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--ab-color-border);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}

	.btn.danger {
		background: white;
		color: var(--ab-color-danger-hover);
		border-color: var(--ab-color-danger-subtle-border);
	}

	.btn.danger:hover:not(:disabled) {
		background: var(--ab-color-danger-subtle);
		border-color: var(--ab-color-danger-subtle-border);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) { /* --ab-breakpoint-sm */
		.stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
