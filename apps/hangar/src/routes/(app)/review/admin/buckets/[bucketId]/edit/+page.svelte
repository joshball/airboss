<script lang="ts">
import { REVIEW_WP_SPEC_TOAST_DISMISS_MS, ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Card from '@ab/ui/components/Card.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
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
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');

// Breadcrumbs intentionally skip an `Admin` crumb -- the admin sub-nav
// (Buckets / Loader) is the IA for this surface.
const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
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

// Update success redirects to the buckets list so the only `form` we ever
// see on this page is a failure shape (validation error or 5xx). Two
// distinct effects keep the update + delete branches independent.
$effect(() => {
	if (!form) return;
	if (!('update' in form)) return;
	const value = form.update;
	if (value === 'invalid' || value === 'error') {
		const msg = 'errors' in form && form.errors?._form ? form.errors._form : 'Update failed.';
		showToast('danger', msg, true);
		liveAnnounce = `Update failed: ${msg}`;
	}
});

$effect(() => {
	if (!form) return;
	if (!('delete' in form)) return;
	const value = form.delete;
	if (typeof value === 'string') {
		showToast('danger', value, true);
		liveAnnounce = `Delete failed: ${value}`;
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
		<BucketForm initial={initial} errors={fieldErrors} submitLabel="Save" saving={savingUpdate} />
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
	<Banner tone="warning">
		This bucket currently surfaces <strong>{data.impact.itemCount}</strong>
		{data.impact.itemCount === 1 ? 'item' : 'items'}.
		{#if data.impact.itemsWithoutOtherBucket > 0}
			After deletion, <strong>{data.impact.itemsWithoutOtherBucket}</strong>
			{data.impact.itemsWithoutOtherBucket === 1 ? 'item' : 'items'} will not match any remaining bucket and
			will disappear from the board until a new bucket catches them.
		{:else}
			Every item this bucket matches is also matched by at least one other bucket, so nothing will disappear from
			the board.
		{/if}
	</Banner>
	<div class="confirm-row">
		<ConfirmAction
			label="Delete bucket"
			confirmLabel="Confirm delete"
			cancelLabel="Cancel"
			triggerVariant="secondary"
			confirmVariant="danger"
			formAction="?/delete"
		/>
	</div>
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

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
		align-items: center;
		margin-top: var(--space-md);
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
