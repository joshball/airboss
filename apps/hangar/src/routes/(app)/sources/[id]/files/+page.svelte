<script lang="ts">
import { PREVIEW_KINDS, ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import CsvPreview from '$lib/components/preview/CsvPreview.svelte';
import GeotiffPreview from '$lib/components/preview/GeotiffPreview.svelte';
import JpegPreview from '$lib/components/preview/JpegPreview.svelte';
import MarkdownFilePreview from '$lib/components/preview/MarkdownFilePreview.svelte';
import PdfPreview from '$lib/components/preview/PdfPreview.svelte';
import ZipPreview from '$lib/components/preview/ZipPreview.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

let expanded = $state<Record<string, boolean>>({});
let pendingDeleteName = $state<string | null>(null);

function toggle(name: string) {
	expanded = { ...expanded, [name]: !expanded[name] };
}

function openDeleteDialog(name: string) {
	pendingDeleteName = name;
}

function closeDeleteDialog() {
	pendingDeleteName = null;
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
	<Breadcrumbs
		items={[
			{ label: 'Sources', href: ROUTES.HANGAR_SOURCES },
			{ label: data.source.id, href: ROUTES.HANGAR_SOURCE_DETAIL(data.source.id), mono: true },
			{ label: 'Files' },
		]}
	/>

	<PageHeader title="Files">
		{#snippet subtitleSnippet()}
			<p>
				<code class="mono">{data.dir}/</code>
				<span>-- {data.entries.length} file{data.entries.length === 1 ? '' : 's'}</span>
			</p>
		{/snippet}
	</PageHeader>

	{#if formError}
		<p class="banner danger">{formError}</p>
	{/if}

	{#if data.entries.length === 0}
		<EmptyState title="No files yet">
			{#snippet bodySnippet()}
				<p>No files under <code>{data.dir}/</code> for this source yet. Try the <em>Fetch</em> or <em>Upload</em> action.</p>
			{/snippet}
		</EmptyState>
	{:else}
		<ul class="files" aria-label="Files for {data.source.id}">
			{#each data.entries as file (file.name)}
				{@const isOpen = expanded[file.name]}
				<li class="file" class:archive={file.isArchive}>
					<div class="file-head">
						<button
							type="button"
							class="expander"
							aria-expanded={isOpen}
							aria-controls="preview-{file.name}"
							onclick={() => toggle(file.name)}
						>
							<span class="chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
							<span class="name mono">{file.name}</span>
						</button>
						<span class="meta mono">{formatBytes(file.sizeBytes)}</span>
						<span class="ts">{formatDate(file.mtime)}</span>
						<span class="kind mono">{file.previewKind}</span>
						{#if file.isArchive}
							<span class="tag archive-tag">archive</span>
						{/if}
						{#if data.isAdmin && file.isArchive}
							<Button
								variant="danger"
								size="sm"
								onclick={() => openDeleteDialog(file.name)}
							>
								Delete
							</Button>
						{/if}
					</div>
					{#if isOpen}
						<div class="preview" id="preview-{file.name}">
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
								<PdfPreview sourceId={data.source.id} fileName={file.name} fileSizeBytes={file.sizeBytes} />
							{:else if file.previewKind === PREVIEW_KINDS.BINARY}
								<p class="muted">No inline preview available for binary content.</p>
							{:else if file.previewText === null}
								<p class="muted">Preview skipped (file above the size threshold). Use a terminal to inspect.</p>
							{:else if file.previewKind === PREVIEW_KINDS.MARKDOWN && file.markdownNodes !== null}
								<MarkdownFilePreview
									fileName={file.name}
									fileSizeBytes={file.sizeBytes}
									nodes={file.markdownNodes}
								/>
							{:else if file.previewKind === PREVIEW_KINDS.MARKDOWN}
								<pre class="markdown">{truncate(file.previewText)}</pre>
							{:else if file.previewKind === PREVIEW_KINDS.CSV}
								<CsvPreview
									fileName={file.name}
									fileSizeBytes={file.sizeBytes}
									previewText={file.previewText}
								/>
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

<ConfirmDialog
	open={pendingDeleteName !== null}
	oncancel={closeDeleteDialog}
	title="Delete archived file?"
	confirmLabel="Delete archive"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_SOURCE_FILE_DELETE_ACTION}
	hiddenFields={{ name: pendingDeleteName ?? '' }}
	typedConfirmation={{
		label: `Type the file name to confirm: ${pendingDeleteName ?? ''}`,
		expected: pendingDeleteName ?? '',
	}}
>
	<p>
		This permanently removes the archived edition <code class="mono">{pendingDeleteName}</code> from disk. The
		operation is irreversible -- the underlying bytes are unlinked from the filesystem and there is no trash bin.
	</p>
	<p>Only proceed if you are certain this archived edition is no longer needed for audit, citation integrity, or
		recovery.</p>
</ConfirmDialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.banner.danger {
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		margin: 0;
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

	/*
	 * Below ~700px the five auto columns of file metadata + the delete form
	 * crowd each other and visually collide with the name column. Stack the
	 * name on its own row and let meta + actions wrap underneath.
	 */
	@media (max-width: 700px) {
		.file-head {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			row-gap: var(--space-2xs);
		}
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
