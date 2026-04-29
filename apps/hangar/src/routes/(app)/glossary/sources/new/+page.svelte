<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import SourceForm from '$lib/components/SourceForm.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initial = $derived(form?.initial ?? data.initial);
const fieldErrors = $derived(form?.fieldErrors ?? {});
const formError = $derived(form?.formError ?? null);
</script>

<svelte:head>
	<title>New source -- hangar</title>
</svelte:head>

<section class="page">
	<PageHeader title="New source">
		{#snippet subtitleSnippet()}
			<p>
				<a href={ROUTES.HANGAR_GLOSSARY_SOURCES}>&larr; Back to sources</a>
			</p>
		{/snippet}
	</PageHeader>

	<form method="POST" class="form">
		<SourceForm {initial} {fieldErrors} {formError} mode="create" />
		<div class="footer">
			<a class="cancel" href={ROUTES.HANGAR_GLOSSARY_SOURCES}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Create source</Button>
		</div>
	</form>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-subtle);
	}

	.cancel {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.cancel:hover {
		color: var(--ink-body);
	}
</style>
