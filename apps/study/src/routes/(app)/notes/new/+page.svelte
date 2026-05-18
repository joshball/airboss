<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import NoteComposer from '@ab/ui/components/notes/NoteComposer.svelte';
import { EMPTY_NOTE_CONTEXT, type NoteContext } from '@ab/ui/components/notes/note-context-types';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initialContext = $derived<NoteContext>({
	...EMPTY_NOTE_CONTEXT,
	referenceId: data.seed.referenceId,
	referenceSectionId: data.seed.referenceSectionId,
	knowledgeNodeId: data.seed.knowledgeNodeId,
	courseId: data.seed.courseId,
	goalId: data.seed.goalId,
	syllabusNodeId: data.seed.syllabusNodeId,
});

const fieldErrors = $derived(form?.fieldErrors ?? {});
const initialValues = $derived(form?.values ?? null);

const initial = $derived({
	bodyMd: initialValues?.bodyMd ?? '',
	title: initialValues?.title ?? '',
	quotedExcerpt: initialValues?.quotedExcerpt ?? '',
	tags: Array.isArray(initialValues?.tags) ? initialValues.tags : [],
	followUpMd: initialValues?.followUpMd ?? '',
	context: initialContext,
});
</script>

<svelte:head>
	<title>{NAV_LABELS.NOTES_NEW} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.NOTES}>{NAV_LABELS.NOTES}</a>
		<span aria-hidden="true">/</span>
		<span>{NAV_LABELS.NOTES_NEW}</span>
	</nav>

	<PageHeader title={NAV_LABELS.NOTES_NEW} subtitle="A markdown thought attached to optional context." />

	{#if fieldErrors._}
		<p class="banner-error" role="alert">{fieldErrors._}</p>
	{/if}

	<NoteComposer
		mode="create"
		{initial}
		contextOptions={data.contextOptions}
		formAction=""
		intentName="create"
		submitLabel="Create note"
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
