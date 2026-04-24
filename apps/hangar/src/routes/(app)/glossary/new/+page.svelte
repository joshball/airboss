<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ReferenceForm from '$lib/components/ReferenceForm.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initial = $derived(form?.initial ?? data.initial);
const fieldErrors = $derived(form?.fieldErrors ?? {});
const formError = $derived(form?.formError ?? null);
</script>

<svelte:head>
	<title>New reference -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>New reference</h1>
		<p class="sub">
			<a href={ROUTES.HANGAR_GLOSSARY}>&larr; Back to glossary</a>
		</p>
	</header>

	<form method="POST" class="form">
		<ReferenceForm {initial} {fieldErrors} {formError} mode="create" />
		<div class="footer">
			<a class="cancel" href={ROUTES.HANGAR_GLOSSARY}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Create reference</Button>
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

	h1 {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-heading-1-size);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		font-size: var(--type-ui-label-size);
	}

	.sub a {
		color: var(--link-default);
		text-decoration: none;
	}

	.sub a:hover {
		color: var(--link-hover);
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
