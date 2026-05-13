<script lang="ts">
import { REVIEW_WP_SPEC_TOAST_DISMISS_MS, ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import { onDestroy } from 'svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionData, PageData } from './$types';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

interface FormValues {
	readonly title: string;
	readonly description: string;
	readonly type: string;
	readonly productArea: string;
	readonly columnId: string;
	readonly assigneeId: string;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let savingUpdate = $state(false);
let savingDelete = $state(false);
let confirmDelete = $state(false);
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');
// Dirty-flag state: switches on the first input event so the leave-page
// confirm panel knows to fire. Reset after a successful save.
let dirty = $state(false);
let confirmDiscard = $state(false);

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: data.task.title },
]);

const fieldErrors = $derived<Record<string, string>>(
	form && 'errors' in form && typeof form.errors === 'object' && form.errors !== null
		? (form.errors as Record<string, string>)
		: {},
);

// Echo-back: prefer the values the user just submitted (so a validation
// failure doesn't blow away their description); fall back to the saved
// row when no form is present (initial load) or after a successful update.
const formValues = $derived<FormValues | null>(
	form && 'values' in form && typeof form.values === 'object' && form.values !== null
		? (form.values as FormValues)
		: null,
);

function readField(field: keyof FormValues, fallback: string): string {
	return formValues ? formValues[field] : fallback;
}

function showToast(tone: ToastTone, message: string, sticky = false): void {
	toast = { tone, message, sticky };
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
	if (!sticky) {
		toastDismissTimer = setTimeout(() => {
			toast = null;
			toastDismissTimer = null;
		}, REVIEW_WP_SPEC_TOAST_DISMISS_MS);
	}
}

function dismissToast(): void {
	toast = null;
	if (toastDismissTimer !== null) {
		clearTimeout(toastDismissTimer);
		toastDismissTimer = null;
	}
}

onDestroy(() => {
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
});

$effect(() => {
	if (!form) return;
	const updateValue = 'update' in form ? form.update : undefined;
	if (updateValue === 'ok') {
		showToast('success', 'Task updated.');
		liveAnnounce = 'Task updated.';
		dirty = false;
	} else if (typeof updateValue === 'string' && updateValue !== 'invalid') {
		showToast('danger', updateValue, true);
		liveAnnounce = `Update failed: ${updateValue}`;
	}
	const deleteValue = 'delete' in form ? form.delete : undefined;
	if (typeof deleteValue === 'string') {
		showToast('danger', deleteValue, true);
		liveAnnounce = `Delete failed: ${deleteValue}`;
	}
});

function markDirty(): void {
	dirty = true;
}

function attemptBack(event: MouseEvent): void {
	if (!dirty) return;
	event.preventDefault();
	confirmDiscard = true;
}
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>Edit task</h1>
	<p class="meta">Ad-hoc task on the review board.</p>
</header>

<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>

{#if toast}
	<div class="toast-wrap">
		<Toast tone={toast.tone} shape="card">
			{toast.message}
			{#snippet actions()}
				<button type="button" class="dismiss" aria-label="Dismiss notification" onclick={dismissToast}>
					Dismiss
				</button>
			{/snippet}
		</Toast>
	</div>
{/if}

{#if confirmDiscard}
	<div class="discard-banner">
		<Banner tone="warning">
			You have unsaved changes. Discard and return to the board?
		</Banner>
		<div class="confirm-row">
			<a class="discard-link" href={ROUTES.HANGAR_REVIEW}>Discard and return</a>
			<button type="button" class="action-button" onclick={() => (confirmDiscard = false)}>Stay on form</button>
		</div>
	</div>
{/if}

<Card>
	{#snippet header()}<h2>Details</h2>{/snippet}
	<form
		method="POST"
		action="?/update"
		class="form"
		oninput={markDirty}
		onchange={markDirty}
		use:enhance={() => {
			savingUpdate = true;
			return async ({ update }) => {
				try {
					await update();
					await invalidateAll();
				} finally {
					savingUpdate = false;
				}
			};
		}}
	>
		<label class="field">
			<span class="label">Title</span>
			<input
				name="title"
				type="text"
				required
				maxlength="200"
				value={readField('title', data.task.title)}
				aria-invalid={fieldErrors.title ? 'true' : undefined}
				aria-describedby={fieldErrors.title ? 'err-title' : undefined}
			/>
			{#if fieldErrors.title}<small id="err-title" class="err">{fieldErrors.title}</small>{/if}
		</label>

		<label class="field">
			<span class="label">Description</span>
			<textarea name="description" rows="4">{readField('description', data.task.description ?? '')}</textarea>
		</label>

		<div class="row">
			<label class="field">
				<span class="label">Type</span>
				<select name="type" required>
					{#each data.taskTypes as t (t.id)}
						<option value={t.id} selected={readField('type', data.task.type) === t.id}>{t.label}</option>
					{/each}
				</select>
				{#if fieldErrors.type}<small class="err">{fieldErrors.type}</small>{/if}
			</label>

			<label class="field">
				<span class="label">Product area</span>
				<select name="productArea" required>
					{#each data.productAreas as a (a.id)}
						<option value={a.id} selected={readField('productArea', data.task.productArea) === a.id}>{a.label}</option>
					{/each}
				</select>
				{#if fieldErrors.productArea}<small class="err">{fieldErrors.productArea}</small>{/if}
			</label>
		</div>

		<label class="field">
			<span class="label">Column</span>
			<select name="columnId">
				<option value="" selected={readField('columnId', data.task.columnId ?? '') === ''}>(no column)</option>
				{#each data.columns as c (c.id)}
					<option value={c.id} selected={readField('columnId', data.task.columnId ?? '') === c.id}>{c.name}</option>
				{/each}
			</select>
		</label>

		<details class="advanced">
			<summary>Advanced fields</summary>
			<label class="field">
				<span class="label">Assignee user id</span>
				<input
					name="assigneeId"
					type="text"
					value={readField('assigneeId', data.task.assigneeId ?? '')}
					placeholder="Leave blank -- single-user app today"
				/>
				<small class="hint">Future multi-user feature; today this is best left blank.</small>
			</label>
		</details>

		<div class="actions">
			<Button type="submit" variant="primary" loading={savingUpdate} loadingLabel="Saving...">Save</Button>
			<a class="cancel" href={ROUTES.HANGAR_REVIEW} onclick={attemptBack}>Back to board</a>
		</div>
	</form>
</Card>

<Card variant="muted">
	{#snippet header()}<h2>Delete</h2>{/snippet}
	<p class="hint">Hard-deletes the task from the board. There is no undo.</p>
	{#if !confirmDelete}
		<button type="button" class="action-button danger" onclick={() => (confirmDelete = true)}>Delete task</button>
	{:else}
		<form
			method="POST"
			action="?/delete"
			class="action-form"
			use:enhance={() => {
				savingDelete = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						savingDelete = false;
					}
				};
			}}
		>
			<Banner tone="danger">This will permanently delete the task. Confirm?</Banner>
			<div class="confirm-row">
				<Button type="submit" variant="danger" loading={savingDelete} loadingLabel="Deleting...">
					Confirm delete
				</Button>
				<button type="button" class="action-button" onclick={() => (confirmDelete = false)}>Cancel</button>
			</div>
		</form>
	{/if}
</Card>

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.meta {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	@media (max-width: 600px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	input,
	textarea,
	select {
		font: inherit;
		font-size: var(--type-ui-control-size);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.err {
		color: var(--signal-danger-deep-ink);
		font-size: var(--type-ui-caption-size);
	}

	.actions {
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}

	.cancel {
		color: var(--link-default);
	}

	.advanced {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
	}

	.advanced summary {
		cursor: pointer;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.hint {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.action-button {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		font: inherit;
		cursor: pointer;
		color: var(--ink-body);
	}

	.action-button.danger {
		color: var(--signal-danger-deep-ink);
		border-color: var(--signal-danger-deep-ink);
	}

	.action-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.action-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
		align-items: center;
	}

	.discard-banner {
		margin: var(--space-md) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.discard-link {
		color: var(--signal-danger-deep-ink);
		text-decoration: underline;
		font-size: var(--type-ui-label-size);
	}

	.toast-wrap {
		margin: var(--space-md) 0;
	}

	.dismiss {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
