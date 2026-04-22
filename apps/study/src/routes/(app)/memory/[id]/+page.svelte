<script lang="ts">
import {
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPES,
	CONTENT_SOURCES,
	DOMAIN_LABELS,
	DOMAINS,
	QUERY_PARAMS,
	REVIEW_RATINGS,
	ROUTES,
} from '@ab/constants';
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

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<string, string>)[slug] ?? humanize(slug);
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
				<form
					method="POST"
					action="?/setStatus"
					class="inline-form"
					use:enhance={({ formData, cancel }) => {
						if (formData.get('status') === CARD_STATUSES.ARCHIVED) {
							// Archive is effectively delete (cards are never hard-removed);
							// require an explicit confirm.
							if (!confirm('Archive this card? It will disappear from your deck. You can reactivate it from Browse later.')) {
								cancel();
								return;
							}
						}
						statusUpdating = true;
						return async ({ update }) => {
							statusUpdating = false;
							await update();
						};
					}}
				>
					{#if card.status === CARD_STATUSES.ACTIVE}
						<button type="submit" class="btn secondary" name="status" value={CARD_STATUSES.SUSPENDED} disabled={statusUpdating}>
							{statusUpdating ? '...' : 'Suspend'}
						</button>
						<button type="submit" class="btn danger" name="status" value={CARD_STATUSES.ARCHIVED} disabled={statusUpdating}>
							{statusUpdating ? '...' : 'Archive'}
						</button>
					{:else}
						<button type="submit" class="btn secondary" name="status" value={CARD_STATUSES.ACTIVE} disabled={statusUpdating}>
							{statusUpdating ? '...' : 'Reactivate'}
						</button>
						{#if card.status === CARD_STATUSES.SUSPENDED}
							<button type="submit" class="btn danger" name="status" value={CARD_STATUSES.ARCHIVED} disabled={statusUpdating}>
								{statusUpdating ? '...' : 'Archive'}
							</button>
						{/if}
					{/if}
				</form>
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
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.back {
		color: #475569;
		text-decoration: none;
		font-size: 0.8125rem;
	}

	.back:hover {
		color: #1a1a2e;
	}

	h1 {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.badges {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		color: #475569;
		background: #f8fafc;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.status-suspended {
		color: #92400e;
		background: #fffbeb;
		border-color: #fde68a;
	}

	.badge.status-archived {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.badge.source {
		color: #6b21a8;
		background: #faf5ff;
		border-color: #e9d5ff;
	}

	.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.toast {
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #065f46;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.content {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.content h2 {
		margin: 0;
		font-size: 1rem;
		color: #334155;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.cell-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.25rem;
	}

	.cell-text {
		color: #0f172a;
		font-size: 1rem;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tag {
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		background: #f1f5f9;
		border-radius: 999px;
		color: #475569;
	}

	.row {
		display: flex;
		gap: 1rem;
	}

	.action-row {
		justify-content: space-between;
		flex-wrap: wrap;
		align-items: center;
	}

	.inline-form {
		display: flex;
		gap: 0.375rem;
	}

	.note {
		color: #64748b;
		font-size: 0.875rem;
	}

	form:not(.inline-form) {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
	}

	.hint {
		font-weight: 400;
		color: #94a3b8;
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: 0.625rem 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: white;
		color: #0f172a;
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	:disabled {
		background: #f1f5f9;
		cursor: not-allowed;
	}

	.row.action-row {
		justify-content: space-between;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
	}

	.stats > div {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.625rem 0.75rem;
	}

	.stats dt {
		font-size: 0.6875rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
	}

	.stats dd {
		margin: 0.125rem 0 0;
		color: #0f172a;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.err {
		font-size: 0.8125rem;
		color: #b91c1c;
	}

	.empty-note {
		margin: 0;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.reviews {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.reviews th,
	.reviews td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
	}

	.reviews th {
		color: #64748b;
		font-weight: 600;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.reviews tr:last-child td {
		border-bottom: none;
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
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover:not(:disabled) {
		background: #e2e8f0;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}

	.btn.danger {
		background: white;
		color: #b91c1c;
		border-color: #fecaca;
	}

	.btn.danger:hover:not(:disabled) {
		background: #fef2f2;
		border-color: #fca5a5;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
