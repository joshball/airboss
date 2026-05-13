<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import NoteDetail from '@ab/ui/components/notes/NoteDetail.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const note = $derived(data.note);
const editing = $derived(data.editing);
const intentError = $derived(form && 'error' in form ? (form.error as string | undefined) : undefined);

const fieldErrors = $derived<Record<string, string>>(
	form && 'fieldErrors' in form && form.fieldErrors !== undefined ? (form.fieldErrors as Record<string, string>) : {},
);
</script>

<svelte:head>
	<title>{note.title.length > 0 ? note.title : 'Note'} -- {NAV_LABELS.NOTES} -- airboss</title>
</svelte:head>

<section class="page">
	<h1 class="visually-hidden" data-testid="page-anchor">{note.title.length > 0 ? note.title : 'Note'}</h1>
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.NOTES}>{NAV_LABELS.NOTES}</a>
		<span aria-hidden="true">/</span>
		<span>{note.title.length > 0 ? note.title : 'Note'}</span>
	</nav>

	{#if intentError}
		<p class="banner-error" role="alert">{intentError}</p>
	{/if}

	<NoteDetail
		{note}
		context={data.context}
		contextOptions={data.contextOptions}
		contextChips={data.contextChips}
		{editing}
		tagSuggestionsEndpoint="/notes/tags"
		bodyError={fieldErrors.bodyMd ?? null}
		titleError={fieldErrors.title ?? null}
		followUpError={fieldErrors.followUpMd ?? null}
	/>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 60rem;
		margin: 0 auto;
		width: 100%;
	}
	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}
	.crumb a {
		color: var(--ink-subtle);
	}
	.banner-error {
		margin: 0;
		padding: var(--space-md);
		background: var(--signal-danger-wash);
		color: var(--signal-danger-deep-ink);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
	}
</style>
