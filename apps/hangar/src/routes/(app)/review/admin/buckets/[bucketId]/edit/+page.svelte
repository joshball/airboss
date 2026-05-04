<script lang="ts">
import { REVIEW_WP_SPEC_TOAST_DISMISS_MS, ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import { onDestroy } from 'svelte';
import { enhance } from '$app/forms';
import BucketForm, { type BucketFormInitial } from '../../_lib/BucketForm.svelte';
import type { ActionData, PageData } from './$types';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let savingUpdate = $state(false);
let savingDelete = $state(false);
let confirmDelete = $state(false);
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');

const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Admin', href: ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS },
	{ label: 'Buckets', href: ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS },
	{ label: data.bucket.name },
];

const fieldErrors = $derived<Record<string, string>>(
	form && 'errors' in form && typeof form.errors === 'object' && form.errors !== null
		? (form.errors as Record<string, string>)
		: {},
);

// Initial values: prefer the just-submitted form values (echo on
// validation failure), fall back to the saved row.
const initial = $derived<BucketFormInitial>(
	form && 'values' in form && form.values
		? {
				name: form.values.name,
				kindId: form.values.kindId,
				sortOrder: form.values.sortOrderRaw,
				filterKind: form.values.filterKind,
				filterFmStatuses: form.values.filterFmStatuses,
				filterReviewStatuses: form.values.filterReviewStatuses,
				filterNoPassing: form.values.filterNoPassing,
				advancedJson: form.values.advancedJson,
			}
		: {
				name: data.bucket.name,
				kindId: data.bucket.kindId,
				sortOrder: String(data.bucket.sortOrder),
				filterKind: data.bucket.filterKind,
				filterFmStatuses: data.bucket.filterFmStatuses,
				filterReviewStatuses: data.bucket.filterReviewStatuses,
				filterNoPassing: data.bucket.filterNoPassing,
				advancedJson: '',
			},
);

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
		showToast('success', 'Bucket updated.');
		liveAnnounce = 'Bucket updated.';
	} else if (updateValue === 'error') {
		const msg = 'errors' in form && form.errors?._form ? form.errors._form : 'Update failed.';
		showToast('danger', msg, true);
		liveAnnounce = `Update failed: ${msg}`;
	}
	const deleteValue = 'delete' in form ? form.delete : undefined;
	if (typeof deleteValue === 'string') {
		showToast('danger', deleteValue, true);
		liveAnnounce = `Delete failed: ${deleteValue}`;
	}
});
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>Edit bucket</h1>
	<p class="meta">Updates the predicate for this bucket card on the review board.</p>
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

{#if fieldErrors._form}
	<Banner tone="danger">{fieldErrors._form}</Banner>
{/if}

<Card>
	{#snippet header()}<h2>Details</h2>{/snippet}
	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			savingUpdate = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					savingUpdate = false;
				}
			};
		}}
	>
		<BucketForm initial={initial} errors={fieldErrors} submitLabel="Save" action="?/update" saving={savingUpdate} />
		<p class="cancel-row">
			<a class="cancel" href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS}>Back to buckets</a>
		</p>
	</form>
</Card>

<Card variant="muted">
	{#snippet header()}<h2>Delete</h2>{/snippet}
	<p class="hint">
		Hard-deletes the bucket row. Items are <strong>not</strong> deleted -- they fall through to whatever other bucket's
		predicate matches, or hide until a new bucket catches them. There is no undo.
	</p>
	{#if !confirmDelete}
		<button type="button" class="action-button danger" onclick={() => (confirmDelete = true)}>Delete bucket</button>
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
			<Banner tone="danger">This will permanently delete the bucket. Items remain on the board. Confirm?</Banner>
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

	.cancel-row {
		margin: var(--space-md) 0 0;
	}

	.cancel {
		color: var(--link-default);
	}

	.hint {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
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
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
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
