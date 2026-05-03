<script lang="ts">
import {
	CARD_KIND_LABELS,
	CARD_KIND_VALUES,
	CARD_STATUSES,
	CARD_TYPE_LABELS,
	CARD_TYPE_VALUES,
	type CardKind,
	type CardType,
	DOMAIN_VALUES,
	domainLabel,
	QUERY_PARAMS,
	ROUTES,
	TOAST_DISMISS_MS,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';
import { tick } from 'svelte';
import { enhance } from '$app/forms';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData } from '../$types';

/**
 * Card body panel: front/back/tags display, the edit form, and the
 * lifecycle action row (Edit, Share, Suspend/Reactivate, Archive). Owns
 * its own edit-mode flag, status-updating flag, share-toast, and
 * edit-success toast. The parent passes the card model and the latest
 * form ActionData so this panel can react to server responses.
 */

interface CardModel {
	id: string;
	front: string;
	back: string;
	domain: string;
	cardType: string;
	kind: string;
	status: string;
	sourceType: string;
	tags: ReadonlyArray<string> | null;
	isEditable: boolean;
}

interface FieldValues {
	front?: string;
	back?: string;
	domain?: string;
	cardType?: string;
	kind?: string;
	tags?: string[];
}

interface Props {
	card: CardModel;
	form: ActionData;
}

let { card, form }: Props = $props();

const publicCardPath = $derived(ROUTES.CARD_PUBLIC(card.id));

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
	}, TOAST_DISMISS_MS);
	return () => clearTimeout(timer);
});

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
	}, TOAST_DISMISS_MS);
}

const domainOptions = DOMAIN_VALUES;
const cardTypeOptions = CARD_TYPE_VALUES;
const cardKindOptions = CARD_KIND_VALUES;

const tagsString = $derived((card.tags ?? []).join(', '));

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function cardKindLabel(slug: string): string {
	return (CARD_KIND_LABELS as Record<CardKind, string>)[slug as CardKind] ?? humanize(slug);
}

async function startEdit() {
	editing = true;
	await tick();
	editFrontInput?.focus();
}

function confirmDiscardEdit() {
	editing = false;
}
</script>

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
			<label class="field">
				<span class="label">
					Kind
					<InfoTip
						term="Kind"
						definition="Knowledge axis the card tests. 'Recall' = facts and definitions. 'Calculation' = numeric or procedural answer that you compute. Drives per-evidence-kind mastery aggregation."
						helpId="memory-card"
						helpSection="kind"
					/>
				</span>
				<select name="kind" required disabled={saving} value={editValues.kind ?? card.kind}>
					{#each cardKindOptions as k (k)}
						<option value={k}>{cardKindLabel(k)}</option>
					{/each}
				</select>
				{#if fieldErrors.kind}<span class="err">{fieldErrors.kind}</span>{/if}
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

<style>
	.content {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
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

	.action-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
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

	.err {
		font-size: var(--type-ui-label-size);
		color: var(--action-hazard-hover);
	}
</style>
