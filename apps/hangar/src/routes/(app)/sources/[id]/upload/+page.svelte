<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import FormStack from '@ab/ui/components/FormStack.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

const maxMiB = $derived(Math.round(data.limits.maxUploadBytes / (1024 * 1024)));
</script>

<svelte:head>
	<title>Upload {data.source.id} -- hangar</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.HANGAR_SOURCES}>Sources</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.HANGAR_SOURCE_DETAIL(data.source.id)}>{data.source.id}</a>
		<span aria-hidden="true">/</span>
		<span class="current">Upload</span>
	</nav>

	<header class="hd">
		<h1>Upload new version</h1>
		<p class="sub">
			Replacing the binary for <span class="mono">{data.source.id}</span>
			-- current version: <span class="mono">{data.source.version}</span>.
			Size limit {maxMiB} MiB.
		</p>
	</header>

	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	<FormStack as="form" method="POST" enctype="multipart/form-data">
		<div class="field">
			<label for="file">File</label>
			<input id="file" type="file" name="file" required />
		</div>
		<div class="field">
			<label for="version">Version tag</label>
			<input
				id="version"
				type="text"
				name="version"
				placeholder={data.source.version}
				autocomplete="off"
			/>
			<p class="hint">
				Set a new version string (e.g. a new year) to archive the current file under
				<code>{data.source.id}@{data.source.version}.&lt;ext&gt;</code>. Leave blank to keep the same
				version.
			</p>
		</div>
		<div class="actions">
			<a class="btn-like" href={ROUTES.HANGAR_SOURCE_DETAIL(data.source.id)}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Upload</Button>
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

	.crumbs {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		align-items: center;
	}

	.crumbs a { color: var(--link-default); text-decoration: none; }
	.crumbs a:hover { text-decoration: underline; }
	.crumbs .current { color: var(--ink-body); }

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
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

	.btn-like {
		display: inline-flex;
		align-items: center;
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-sunken);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
		font-size: var(--type-ui-label-size);
	}

	.btn-like:hover {
		background: var(--action-default-wash);
	}

	.mono { font-family: var(--font-family-mono); }
</style>
