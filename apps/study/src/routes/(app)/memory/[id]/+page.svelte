<script lang="ts">
import {
	CARD_STATUS_LABELS,
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPE_VALUES,
	type CardStatus,
	type CardType,
	CITATION_TARGET_LABELS,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	CONTENT_SOURCE_LABELS,
	CONTENT_SOURCES,
	type ContentSource,
	DOMAIN_VALUES,
	domainLabel,
	QUERY_PARAMS,
	REVIEW_RATINGS,
	REVIEW_SESSION_STATUSES,
	type ReviewSessionStatus,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Button from '@ab/ui/components/Button.svelte';
import CitationChips, { type CitationChipItem } from '@ab/ui/components/CitationChips.svelte';
import CitationPicker, { type CitationPickerSelection } from '@ab/ui/components/CitationPicker.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';
import { tick } from 'svelte';
import { enhance } from '$app/forms';
import { invalidateAll, replaceState } from '$app/navigation';
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
const crossRefs = $derived(data.crossRefs);

const publicCardPath = $derived(ROUTES.CARD_PUBLIC(card.id));

let shareToastVisible = $state(false);
let shareToastMessage = $state('');
let shareToastTimer: ReturnType<typeof setTimeout> | null = null;

function absolutePublicCardUrl(): string {
	if (typeof window === 'undefined') return publicCardPath;
	return `${window.location.origin}${publicCardPath}`;
}

async function sharePublicLink() {
	const url = absolutePublicCardUrl();
	let copied = false;
	try {
		if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
			await navigator.clipboard.writeText(url);
			copied = true;
		}
	} catch {
		copied = false;
	}

	shareToastMessage = copied ? 'Public card link copied.' : `Copy this link: ${url}`;
	shareToastVisible = true;
	if (shareToastTimer !== null) clearTimeout(shareToastTimer);
	shareToastTimer = setTimeout(() => {
		shareToastVisible = false;
	}, 3000);
}

const reviewSessionStatusLabels: Record<ReviewSessionStatus, string> = {
	[REVIEW_SESSION_STATUSES.ACTIVE]: 'Active',
	[REVIEW_SESSION_STATUSES.COMPLETED]: 'Completed',
	[REVIEW_SESSION_STATUSES.ABANDONED]: 'Abandoned',
};

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

const domainOptions = DOMAIN_VALUES;
const cardTypeOptions = CARD_TYPE_VALUES;

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

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function statusLabel(slug: string): string {
	return (CARD_STATUS_LABELS as Record<CardStatus, string>)[slug as CardStatus] ?? humanize(slug);
}

function sourceLabel(slug: string): string {
	return (CONTENT_SOURCE_LABELS as Record<ContentSource, string>)[slug as ContentSource] ?? humanize(slug);
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

// Citation state. `citationPickerOpen` controls the shared dialog. Target
// types in v1: all four (regulation, AC, external, knowledge). The Picker
// submits via fetch to `?/addCitation`, then we `invalidateAll()` so the
// server load refreshes the citations list.
let citationPickerOpen = $state(false);
let citationError = $state<string | null>(null);

const citations = $derived(data.citations);
const citationItems = $derived<CitationChipItem[]>(
	citations.map((c) => ({
		id: c.citation.id,
		typeLabel: targetTypeLabel(c.target.type),
		label: c.target.label,
		href: c.target.href ?? null,
		context: c.citation.citationContext,
	})),
);
const citationRemoveAction = $derived(`${ROUTES.MEMORY_CARD(card.id)}?/removeCitation`);
const citationTargets = [
	CITATION_TARGET_TYPES.REGULATION_NODE,
	CITATION_TARGET_TYPES.AC_REFERENCE,
	CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
	CITATION_TARGET_TYPES.EXTERNAL_REF,
];

function targetTypeLabel(t: CitationTargetType): string {
	return CITATION_TARGET_LABELS[t];
}

async function handleCitationSelect(selection: CitationPickerSelection): Promise<void> {
	citationError = null;
	const body = new FormData();
	body.set('targetType', selection.targetType);
	body.set('targetId', selection.targetId);
	body.set('note', selection.note);
	const res = await fetch(`${ROUTES.MEMORY_CARD(card.id)}?/addCitation`, {
		method: 'POST',
		body,
		headers: { accept: 'application/json' },
	});
	if (!res.ok) {
		// Surface the actionResult error message when present.
		try {
			const payload = await res.json();
			const message = payload?.data?.fieldErrors?._ ?? 'Could not add citation.';
			throw new Error(message);
		} catch (err) {
			throw err instanceof Error ? err : new Error('Could not add citation.');
		}
	}
	citationPickerOpen = false;
	await invalidateAll();
}
</script>

<svelte:head>
	<title>{card.front.slice(0, 60)} -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<a class="back" href={ROUTES.MEMORY_BROWSE}>← Browse</a>
			<div class="title-row">
				<h1>Card detail</h1>
				<PageHelp pageId="memory-card" />
			</div>
		</div>
		<div class="badges">
			<span class="badge-wrap">
				<span class="badge domain">{domainLabel(card.domain)}</span>
				<InfoTip
					term="Domain"
					definition="The topic bucket this card belongs to. Drives browse filters and session mix."
					helpId="memory-card"
					helpSection="domain"
				/>
			</span>
			<span class="badge-wrap">
				<span class="badge type">{cardTypeLabel(card.cardType)}</span>
				<InfoTip
					term="Type"
					definition="Card format. Basic is a single front/back question-and-answer."
					helpId="memory-card"
					helpSection="type"
				/>
			</span>
			<span class="badge-wrap">
				<span class="badge status-{card.status}">{statusLabel(card.status)}</span>
				<InfoTip
					term={`Status: ${statusLabel(card.status)}`}
					definition="Whether this card is active, suspended, or archived. See the full lifecycle."
					helpId="memory-card"
					helpSection="lifecycle"
				/>
			</span>
			<span class="badge-wrap">
				<span class="badge source" title={card.sourceRef ?? ''}>{sourceLabel(card.sourceType)}</span>
				<InfoTip
					term={`Source: ${sourceLabel(card.sourceType)}`}
					definition="Personal cards you authored are editable. Course cards ported from curriculum material are read-only."
					helpId="memory-card"
					helpSection="source"
				/>
			</span>
		</div>
	</header>

	{#if editToastVisible}
		<div class="toast" role="status">{editToastMessage}</div>
	{/if}

	{#if shareToastVisible}
		<div class="toast" role="status" aria-live="polite">{shareToastMessage}</div>
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
				<Button variant="ghost" onclick={confirmDiscardEdit} disabled={saving}>Cancel</Button>
				<Button type="submit" variant="primary" disabled={saving}>
					{saving ? 'Saving...' : 'Save changes'}
				</Button>
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
				<div class="primary-actions">
					{#if card.isEditable}
						<Button variant="secondary" onclick={startEdit}>Edit</Button>
					{:else}
						<span class="note">This card is read-only (source: {humanize(card.sourceType)}).</span>
					{/if}
					<span class="action-wrap">
						<Button variant="secondary" onclick={sharePublicLink}>Share</Button>
						<InfoTip
							term="Share"
							definition="Copies the public card link ({ROUTES.CARD_PUBLIC(card.id)}). Only the question and answer are visible on the public page; scheduling internals stay private."
							helpId="memory-card"
							helpSection="share"
						/>
					</span>
					<Button variant="ghost" href={publicCardPath} target="_blank">Open public view</Button>
				</div>
				<div class="inline-form">
					{#if card.status === CARD_STATUSES.ACTIVE}
						<span class="action-wrap">
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
							<InfoTip
								term="Suspend"
								definition="Pause scheduling for this card without deleting it. Reactivate later to rejoin the queue."
								helpId="memory-card"
								helpSection="lifecycle"
							/>
						</span>
						<span class="action-wrap">
							<ConfirmAction
								formAction="?/setStatus"
								confirmVariant="danger"
								triggerVariant="ghost"
								size="md"
								label="Archive"
								confirmLabel="Archive this card"
								hiddenFields={{ status: CARD_STATUSES.ARCHIVED }}
							/>
							<InfoTip
								term="Archive"
								definition="Retire this card from the deck. History is preserved but it no longer appears in review or browse by default."
								helpId="memory-card"
								helpSection="lifecycle"
							/>
						</span>
					{:else}
						<span class="action-wrap">
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
								<Button
									type="submit"
									variant="secondary"
									disabled={statusUpdating}
								>
									{statusUpdating ? '...' : 'Reactivate'}
								</Button>
								<input type="hidden" name="status" value={CARD_STATUSES.ACTIVE} />
							</form>
							<InfoTip
								term="Reactivate"
								definition="Put this card back into rotation. Scheduling resumes from where it left off."
								helpId="memory-card"
								helpSection="lifecycle"
							/>
						</span>
						{#if card.status === CARD_STATUSES.SUSPENDED}
							<span class="action-wrap">
								<ConfirmAction
									formAction="?/setStatus"
									confirmVariant="danger"
									triggerVariant="ghost"
									size="md"
									label="Archive"
									confirmLabel="Archive this card"
									hiddenFields={{ status: CARD_STATUSES.ARCHIVED }}
								/>
								<InfoTip
									term="Archive"
									definition="Retire this card from the deck. History is preserved but it no longer appears in review or browse by default."
									helpId="memory-card"
									helpSection="lifecycle"
								/>
							</span>
						{/if}
					{/if}
				</div>
			</div>
		</article>
	{/if}

	<article class="content">
		<div class="citations-header">
			<h2>Citations</h2>
			<span class="citations-add">
				<Button variant="secondary" onclick={() => (citationPickerOpen = true)}>
					+ Cite a reference
				</Button>
			</span>
		</div>
		{#if citationError}
			<div class="error" role="alert">{citationError}</div>
		{/if}
		{#if citations.length === 0}
			<p class="empty-note">No citations yet. Link a regulation, AC, knowledge node, or external reference.</p>
		{:else}
			<CitationChips items={citationItems} editable removeAction={citationRemoveAction} />
		{/if}
	</article>

	<CitationPicker
		bind:open={citationPickerOpen}
		targetTypes={citationTargets}
		onSelect={async (selection) => {
			try {
				await handleCitationSelect(selection);
			} catch (err) {
				citationError = err instanceof Error ? err.message : 'Could not add citation.';
				throw err;
			}
		}}
		onCancel={() => (citationPickerOpen = false)}
	/>

	<article class="content schedule">
		<h2>Schedule</h2>
		<dl class="stats">
			<div>
				<dt>
					State
					<InfoTip
						term="State"
						definition="Where this card sits in the FSRS lifecycle: New, Learning, Review, or Relearning."
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</dt>
				<dd>{humanize(schedule.state)}</dd>
			</div>
			<div>
				<dt>
					Due
					<InfoTip
						term="Due"
						definition="When the scheduler wants to see this card next. Negative means overdue."
						helpId="memory-card"
						helpSection="due"
					/>
				</dt>
				<dd>{dueLabel}</dd>
			</div>
			<div>
				<dt>
					Stability
					<InfoTip
						term="Stability"
						definition="Estimated days of retention. Higher means a longer interval to the next review."
						helpId="concept-fsrs"
						helpSection="stability-vs-difficulty"
					/>
				</dt>
				<dd>{schedule.stability.toFixed(2)} d</dd>
			</div>
			<div>
				<dt>
					Difficulty
					<InfoTip
						term="Difficulty"
						definition="How hard this card is for you, 1 (easy) to 10 (hard). FSRS adjusts it from your ratings."
						helpId="concept-fsrs"
						helpSection="stability-vs-difficulty"
					/>
				</dt>
				<dd>{schedule.difficulty.toFixed(2)}</dd>
			</div>
			<div>
				<dt>
					Reviews
					<InfoTip
						term="Reviews"
						definition="Total times you have rated this card across all sessions."
						helpId="memory-card"
						helpSection="reviews"
					/>
				</dt>
				<dd>{schedule.reviewCount}</dd>
			</div>
			<div>
				<dt>
					Lapses
					<InfoTip
						term="Lapses"
						definition="Times you rated Again after the card left Learning. Each lapse pushes difficulty up."
						helpId="memory-card"
						helpSection="lapses"
					/>
				</dt>
				<dd>{schedule.lapseCount}</dd>
			</div>
		</dl>
	</article>

	<article class="content cross-refs">
		<h2>Cross-references</h2>
		<ul class="xref-list">
			<li class="xref-row">
				<div class="xref-head">
					<span class="xref-label">Sessions</span>
					<InfoTip
						term="Sessions"
						definition="Memory-review sessions (the /memory/review flow) that included this card. Each row is a full run you can reopen."
						helpId="memory-card"
						helpSection="cross-refs"
					/>
					<span class="xref-count">{crossRefs.sessions.length}</span>
				</div>
				{#if crossRefs.sessions.length === 0}
					<p class="xref-empty">No review sessions have included this card yet.</p>
				{:else}
					<ul class="xref-items">
						{#each crossRefs.sessions as s (s.id)}
							<li>
								<a href={ROUTES.MEMORY_REVIEW_SESSION(s.id)}>
									{new Date(s.startedAt).toLocaleString()}
								</a>
								<span class="xref-sub">{reviewSessionStatusLabels[s.status]}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</li>

			<li class="xref-row">
				<div class="xref-head">
					<span class="xref-label">Reps</span>
					<InfoTip
						term="Reps"
						definition="Decision-rep scenarios that cite this card. Enrollment between reps and cards is not tracked yet; this row lights up once it is."
						helpId="memory-card"
						helpSection="cross-refs"
					/>
					{#if crossRefs.reps.comingSoon}
						<span class="xref-pill">Coming soon</span>
					{:else}
						<span class="xref-count">{crossRefs.reps.items.length}</span>
					{/if}
				</div>
				<p class="xref-empty">Reps-to-card enrollment is not tracked yet.</p>
			</li>

			<li class="xref-row">
				<div class="xref-head">
					<span class="xref-label">Plans</span>
					<InfoTip
						term="Plans"
						definition="Study plans that include this card. Plan-to-card enrollment is not yet tracked."
						helpId="memory-card"
						helpSection="cross-refs"
					/>
					{#if crossRefs.plans.comingSoon}
						<span class="xref-pill">Coming soon</span>
					{:else}
						<span class="xref-count">{crossRefs.plans.items.length}</span>
					{/if}
				</div>
				<p class="xref-empty">Plan-to-card enrollment is not yet tracked.</p>
			</li>

			<li class="xref-row">
				<div class="xref-head">
					<span class="xref-label">Scenarios</span>
					<InfoTip
						term="Scenarios"
						definition="Rep scenarios that cite this card as a reference. Waits on the content-citations work package."
						helpId="memory-card"
						helpSection="cross-refs"
					/>
					{#if crossRefs.scenarios.comingSoon}
						<span class="xref-pill">Coming soon</span>
					{:else}
						<span class="xref-count">{crossRefs.scenarios.items.length}</span>
					{/if}
				</div>
				<p class="xref-empty">Cite this card from a scenario to see it here.</p>
			</li>
		</ul>
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
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.back {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.back:hover {
		color: var(--ink-body);
	}

	h1 {
		margin: var(--space-2xs) 0 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.badges {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.badge-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.action-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.domain {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.status-suspended {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.status-archived {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.badge.source {
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.error {
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.toast {
		background: var(--signal-success-wash);
		border: 1px solid var(--signal-success-edge);
		color: var(--signal-success);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.content {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.content h2 {
		margin: 0;
		font-size: var(--type-reading-body-size);
		color: var(--ink-strong);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.cell-label {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-bottom: var(--space-2xs);
	}

	.cell-text {
		color: var(--ink-body);
		font-size: var(--type-reading-body-size);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.tag {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		color: var(--ink-muted);
	}

	.row {
		display: flex;
		gap: var(--space-lg);
	}

	.action-row {
		justify-content: space-between;
		flex-wrap: wrap;
		align-items: center;
	}

	.primary-actions {
		display: inline-flex;
		gap: var(--space-sm);
		align-items: center;
		flex-wrap: wrap;
	}

	.inline-form {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.cross-refs .xref-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.xref-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.xref-head {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.xref-label {
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-body);
	}

	.xref-count {
		margin-left: auto;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
	}

	.xref-pill {
		margin-left: auto;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--radius-pill);
		color: var(--ink-subtle);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.xref-empty {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.xref-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.xref-items li {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		font-size: var(--type-ui-label-size);
	}

	.xref-items a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.xref-items a:hover {
		text-decoration: underline;
	}

	.xref-sub {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.status-form {
		display: inline-flex;
	}

	.note {
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	form:not(.inline-form):not(.status-form) {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		color: var(--ink-strong);
	}

	.hint {
		font-weight: 400;
		color: var(--ink-faint);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	:disabled {
		background: var(--surface-sunken);
		cursor: not-allowed;
	}

	.row.action-row {
		justify-content: space-between;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-md);
	}

	.stats > div {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}

	.stats dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.stats dd {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		font-weight: 500;
	}

	.err {
		font-size: var(--type-ui-label-size);
		color: var(--action-hazard-hover);
	}

	.empty-note {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.reviews {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	.reviews th,
	.reviews td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--edge-default);
	}

	.reviews th {
		color: var(--ink-subtle);
		font-weight: 600;
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.reviews tr:last-child td {
		border-bottom: none;
	}

	.citations-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.citations-add {
		flex: 0 0 auto;
	}

	@media (max-width: 480px) {
		.stats {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
