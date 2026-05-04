<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Card from '@ab/ui/components/Card.svelte';
import { enhance } from '$app/forms';
import BucketForm, { type BucketFormInitial } from '../_lib/BucketForm.svelte';
import type { ActionData } from './$types';

let { form }: { form: ActionData } = $props();

let saving = $state(false);

// Breadcrumbs intentionally skip an `Admin` crumb -- the admin sub-nav
// (Buckets / Loader) is the IA for this surface, so duplicating it as a
// breadcrumb is noise.
const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Buckets', href: ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS },
	{ label: 'New' },
];

const fieldErrors = $derived<Record<string, string>>(
	form && 'errors' in form && typeof form.errors === 'object' && form.errors !== null
		? (form.errors as Record<string, string>)
		: {},
);

const initial = $derived<BucketFormInitial>({
	name: form && 'values' in form && form.values ? form.values.name : '',
	kindId: form && 'values' in form && form.values ? form.values.kindId : '',
	sortOrder: form && 'values' in form && form.values ? form.values.sortOrderRaw : '0',
	filterKind: form && 'values' in form && form.values ? form.values.filterKind : '',
	filterFmStatuses: form && 'values' in form && form.values ? form.values.filterFmStatuses : [],
	filterReviewStatuses: form && 'values' in form && form.values ? form.values.filterReviewStatuses : [],
	filterNoPassing: form && 'values' in form && form.values ? form.values.filterNoPassing : false,
	advancedJson: form && 'values' in form && form.values ? form.values.advancedJson : '',
});
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>New bucket</h1>
	<p class="meta">Buckets aggregate review items into one card on the board with a count badge.</p>
</header>

{#if fieldErrors._form}
	<Banner tone="danger">{fieldErrors._form}</Banner>
{/if}

<Card>
	<form
		method="POST"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					saving = false;
				}
			};
		}}
	>
		<BucketForm initial={initial} errors={fieldErrors} submitLabel="Create bucket" saving={saving} autofocus />
		<p class="cancel-row">
			<a class="cancel" href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS}>Cancel</a>
		</p>
	</form>
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
</style>
