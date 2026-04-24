<script lang="ts">
import { PREVIEW_KINDS, ROUTES } from '@ab/constants';
import GeotiffPreview from '$lib/components/preview/GeotiffPreview.svelte';
import JpegPreview from '$lib/components/preview/JpegPreview.svelte';
import ZipPreview from '$lib/components/preview/ZipPreview.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

let expanded = $state<Record<string, boolean>>({});

function toggle(name: string) {
	expanded = { ...expanded, [name]: !expanded[name] };
}

function formatBytes(bytes: number): string {
	if (bytes <= 0) return '0 B';
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function truncate(text: string | null, max = 20_000): string {
	if (!text) return '';
	return text.length > max ? `${text.slice(0, max)}\n\n[... truncated ...]` : text;
}
</script>

<svelte:head>
	<title>{data.source.id} files -- hangar</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.HANGAR_SOURCES}>Sources</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.HANGAR_SOURCE_DETAIL(data.source.id)}>{data.source.id}</a>
		<span aria-hidden="true">/</span>
		<span class="current">Files</span>
	</nav>

	<header class="hd">
		<div>
			<h1>Files</h1>
			<p class="sub">
				<code class="mono">{data.dir}/</code>
				<span>-- {data.entries.length} file{data.entries.length === 1 ? '' : 's'}</span>
			</p>
		</div>
	</header>

	{#if formError}
		<p class="banner danger">{formError}</p>
	{/if}

	{#if data.entries.length === 0}
		<p class="empty">No files under <code>{data.dir}/</code> for this source yet. Try the <em>Fetch</em> or <em>Upload</em> action.</p>
	{:else}
		<ul class="files" aria-label="Files for {data.source.id}">
			{#each data.entries as file (file.name)}
				{@const isOpen = expanded[file.name]}
				<li class="file" class:archive={file.isArchive}>
					<div class="file-head">
						<button type="button" class="expander" aria-expanded={isOpen} onclick={() => toggle(file.name)}>
							<span class="chevron" aria-hidden="true">{isOpen ? 'v' : '>'}</span>
							<span class="name mono">{file.name}</span>
						</button>
						<span class="meta mono">{formatBytes(file.sizeBytes)}</span>
						<span class="ts">{formatDate(file.mtime)}</span>
						<span class="kind mono">{file.previewKind}</span>
						{#if file.isArchive}
							<span class="tag archive-tag">archive</span>
						{/if}
						{#if data.isAdmin && file.isArchive}
							<form method="POST" action="?/delete" class="inline-delete">
								<input type="hidden" name="name" value={file.name} />
								<button type="submit" class="danger-action">Delete</button>
							</form>
						{/if}
					</div>
					{#if isOpen}
						<div class="preview">
							{#if file.previewKind === PREVIEW_KINDS.GEOTIFF}
								<GeotiffPreview
									sourceId={data.source.id}
									fileName={file.name}
									fileSizeBytes={file.sizeBytes}
									media={data.source.media}
									edition={data.source.edition}
								/>
							{:else if file.previewKind === PREVIEW_KINDS.JPEG}
								<JpegPreview
									sourceId={data.source.id}
									fileName={file.name}
									fileSizeBytes={file.sizeBytes}
									altText={data.source.edition
										? `${data.source.title} - edition ${data.source.edition.effectiveDate}`
										: `${data.source.title} preview`}
								/>
							{:else if file.previewKind === PREVIEW_KINDS.ZIP}
								<ZipPreview
									fileName={file.name}
									fileSizeBytes={file.sizeBytes}
									isArchive={file.isArchive}
									media={data.source.media}
								/>
							{:else if file.previewKind === PREVIEW_KINDS.PDF}
								<p class="muted">PDF preview is available via the detail page (browser-native PDF viewer).</p>
							{:else if file.previewKind === PREVIEW_KINDS.BINARY}
								<p class="muted">No inline preview available for binary content.</p>
							{:else if file.previewText === null}
								<p class="muted">Preview skipped (file above the size threshold). Use a terminal to inspect.</p>
							{:else if file.previewKind === PREVIEW_KINDS.MARKDOWN}
								<pre class="markdown">{truncate(file.previewText)}</pre>
							{:else if file.previewKind === PREVIEW_KINDS.CSV}
								<pre class="csv mono">{truncate(file.previewText, 10_000)}</pre>
							{:else}
								<pre class="mono">{truncate(file.previewText)}</pre>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
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

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.banner.danger {
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		margin: 0;
	}

	.empty {
		color: var(--ink-muted);
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.files {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.file {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.file.archive {
		background: var(--surface-sunken);
	}

	.file-head {
		display: grid;
		grid-template-columns: 1fr auto auto auto auto auto;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		align-items: center;
	}

	.expander {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--ink-body);
		cursor: pointer;
		text-align: left;
	}

	.expander:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.chevron {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		width: 1ch;
		display: inline-block;
	}

	.meta { color: var(--ink-muted); font-size: var(--type-ui-label-size); }
	.ts { color: var(--ink-muted); font-size: var(--type-ui-caption-size); }
	.kind {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.tag {
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.archive-tag { background: var(--signal-info-wash); color: var(--signal-info); }

	.inline-delete { margin: 0; }

	.danger-action {
		background: transparent;
		border: 1px solid var(--signal-danger-edge);
		color: var(--signal-danger);
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.danger-action:hover {
		background: var(--signal-danger-wash);
	}

	.danger-action:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.preview {
		border-top: 1px solid var(--edge-subtle);
		padding: var(--space-md);
		background: var(--surface-page);
	}

	.preview pre {
		margin: 0;
		max-height: 36rem;
		overflow: auto;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-body);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.muted {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.mono { font-family: var(--font-family-mono); }
</style>
