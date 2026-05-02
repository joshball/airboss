<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import FormStack from '@ab/ui/components/FormStack.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

const maxMiB = $derived(Math.round(data.limits.maxUploadBytes / (1024 * 1024)));
const isBusy = $derived(data.activeJob !== null);
</script>

<svelte:head>
	<title>Upload {data.source.id} -- hangar</title>
</svelte:head>

<section class="page">
	<Breadcrumbs
		items={[
			{ label: 'Sources', href: ROUTES.HANGAR_SOURCES },
			{ label: data.source.id, href: ROUTES.HANGAR_SOURCE_DETAIL(data.source.id), mono: true },
			{ label: 'Upload' },
		]}
	/>

	<PageHeader title="Upload new version">
		{#snippet subtitleSnippet()}
			<p>
				Replacing the binary for <span class="mono">{data.source.id}</span>
				-- current version: <span class="mono">{data.source.version}</span>.
				Size limit {maxMiB} MiB.
			</p>
		{/snippet}
	</PageHeader>

	{#if data.activeJob}
		<Banner tone="warning" title="This source has a running operation">
			A <code class="mono">{data.activeJob.kind}</code> job
			(<a class="mono" href={ROUTES.HANGAR_JOB_DETAIL(data.activeJob.id)}>{data.activeJob.id}</a>)
			is {data.activeJob.status}. Wait for it to finish (or cancel it) before uploading.
		</Banner>
	{/if}

	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	<FormStack as="form" method="POST" enctype="multipart/form-data">
		<div class="field">
			<label for="file">File</label>
			<input id="file" type="file" name="file" required disabled={isBusy} />
		</div>
		<div class="field">
			<label for="version">Version tag</label>
			<input
				id="version"
				type="text"
				name="version"
				placeholder={data.source.version}
				autocomplete="off"
				disabled={isBusy}
			/>
			<p class="hint">
				Set a new version string (e.g. a new year) to archive the current file under
				<code>{data.source.id}@{data.source.version}.&lt;ext&gt;</code>. Leave blank to keep the same
				version.
			</p>
		</div>
		<div class="actions">
			<Button variant="secondary" size="md" href={ROUTES.HANGAR_SOURCE_DETAIL(data.source.id)}>Cancel</Button>
			<Button type="submit" variant="primary" size="md" disabled={isBusy}>Upload</Button>
		</div>
	</FormStack>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
		max-width: 40rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field input[type='text'] {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field input[type='file'] {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		font: inherit;
	}

	.field input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.mono { font-family: var(--font-family-mono); }
</style>
