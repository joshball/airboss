<script lang="ts">
import { ROUTES, SOURCE_KINDS } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import SourcePreviewTile from '$lib/components/SourcePreviewTile.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || bytes <= 0) return '--';
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string | null): string {
	if (!iso) return '--';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

const checksumMatchesOnDisk = $derived(
	data.onDisk !== null && !data.source.isPendingChecksum && data.onDisk.sizeBytes === data.source.sizeBytes,
);
</script>

<svelte:head>
	<title>{data.source.id} -- hangar</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.HANGAR_SOURCES}>Sources</a>
		<span aria-hidden="true">/</span>
		<span class="current">{data.source.id}</span>
	</nav>

	<header class="hd">
		<div>
			<h1 class="mono">{data.source.id}</h1>
			<p class="title">{data.source.title}</p>
		</div>
		<div class="action-row">
			<form method="POST" action={ROUTES.HANGAR_SOURCE_FETCH_ACTION}>
				<Button type="submit" variant="primary" size="sm">Fetch</Button>
			</form>
			<a class="btn-like" href={ROUTES.HANGAR_SOURCE_UPLOAD(data.source.id)}>Upload</a>
			<form method="POST" action={ROUTES.HANGAR_SOURCE_EXTRACT_ACTION}>
				<Button type="submit" variant="secondary" size="sm" disabled={data.source.isPendingChecksum}>
					Extract
				</Button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_SOURCE_DIFF_ACTION}>
				<Button type="submit" variant="secondary" size="sm" disabled={data.source.isPendingChecksum}>
					Diff
				</Button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_SOURCE_VALIDATE_ACTION}>
				<Button type="submit" variant="secondary" size="sm">Validate this source</Button>
			</form>
		</div>
	</header>

	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	{#if data.source.sourceKind === SOURCE_KINDS.BINARY_VISUAL && data.source.media}
		<SourcePreviewTile
			sourceId={data.source.id}
			title={data.source.title}
			thumbnailUrl={ROUTES.HANGAR_SOURCE_THUMBNAIL(data.source.id)}
			thumbnailAvailable={data.source.media.thumbnailSizeBytes > 0 &&
				data.source.media.generator !== 'unavailable'}
			edition={data.source.edition}
			archiveSizeBytes={data.source.sizeBytes}
			archiveSha={data.source.checksum}
			downloadedAt={data.source.downloadedAt}
			generator={data.source.media.generator}
		/>
	{/if}

	<section class="cards" aria-label="State">
		<div class="card">
			<div class="card-label">Binary</div>
			<div class="card-value">
				{#if data.onDisk}
					<span class="state state-ok">on disk</span>
					<span class="card-detail mono">{formatBytes(data.onDisk.sizeBytes)}</span>
				{:else}
					<span class="state state-missing">missing</span>
				{/if}
			</div>
			<div class="card-ts">{data.onDisk ? formatDate(data.onDisk.mtime) : '--'}</div>
		</div>
		<div class="card">
			<div class="card-label">Checksum match</div>
			<div class="card-value">
				{#if data.source.isPendingChecksum}
					<span class="state state-warn">pending</span>
				{:else if checksumMatchesOnDisk}
					<span class="state state-ok">match</span>
				{:else if data.onDisk === null}
					<span class="state state-missing">no binary</span>
				{:else}
					<span class="state state-warn">size differs</span>
				{/if}
			</div>
			<div class="card-detail mono">{data.source.checksum.slice(0, 12) || '--'}</div>
		</div>
		<div class="card">
			<div class="card-label">Registry rev</div>
			<div class="card-value"><span class="mono">r{data.source.rev}</span></div>
			<div class="card-ts">dirty: {data.source.dirty ? 'yes' : 'no'}</div>
		</div>
		<div class="card">
			<div class="card-label">Last downloaded</div>
			<div class="card-value">
				{#if data.source.isPendingChecksum}
					<span class="state state-warn">pending</span>
				{:else}
					{formatDate(data.source.downloadedAt)}
				{/if}
			</div>
		</div>
	</section>

	<section class="two-col">
		<section aria-labelledby="meta-h">
			<h2 id="meta-h">Metadata</h2>
			<dl class="meta">
				<div><dt>Type</dt><dd class="mono">{data.source.type}</dd></div>
				<div><dt>Version</dt><dd class="mono">{data.source.version}</dd></div>
				<div><dt>Format</dt><dd class="mono">{data.source.format}</dd></div>
				<div>
					<dt>URL</dt>
					<dd class="wrap"><a href={data.source.url} target="_blank" rel="noreferrer">{data.source.url}</a></dd>
				</div>
				<div><dt>Path</dt><dd class="mono wrap">{data.source.path}</dd></div>
				{#if data.source.locatorShape}
					<div>
						<dt>Locator shape</dt>
						<dd class="mono wrap">{JSON.stringify(data.source.locatorShape)}</dd>
					</div>
				{/if}
			</dl>
			<p class="edit-hint">
				Edit registry fields in
				<a href={ROUTES.HANGAR_GLOSSARY_SOURCES_DETAIL(data.source.id)}>the registry detail page</a>.
			</p>
		</section>

		<section aria-labelledby="files-h">
			<h2 id="files-h">Files</h2>
			<p class="muted">
				Browse every binary + archived version under <code>data/sources/{data.source.type}/</code>.
			</p>
			<a class="btn-like" href={ROUTES.HANGAR_SOURCE_FILES(data.source.id)}>Open files</a>
		</section>
	</section>

	<section aria-labelledby="history-h">
		<h2 id="history-h">Recent jobs</h2>
		{#if data.recentJobs.length === 0}
			<p class="empty">No jobs have run against this source yet.</p>
		{:else}
			<ul class="job-list">
				{#each data.recentJobs as job (job.id)}
					<li>
						<a class="mono" href={ROUTES.HANGAR_JOB_DETAIL(job.id)}>{job.kind}</a>
						<span class="status s-{job.status}">{job.status}</span>
						<span class="ts">{formatDate(job.finishedAt ?? job.createdAt)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
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

	.crumbs a {
		color: var(--link-default);
		text-decoration: none;
	}

	.crumbs a:hover { text-decoration: underline; }

	.crumbs .current {
		color: var(--ink-body);
		font-family: var(--font-family-mono);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.title {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-control-size);
	}

	.action-row {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		align-items: center;
	}

	.btn-like {
		display: inline-flex;
		align-items: center;
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-sunken);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.btn-like:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-md);
	}

	.card {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.card-label {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.card-value {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		color: var(--ink-body);
		font-size: var(--type-ui-control-size);
	}

	.card-detail {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.card-ts {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.state {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-weight: var(--font-weight-semibold);
	}

	.state-ok { background: var(--signal-success-wash); color: var(--signal-success); }
	.state-warn { background: var(--signal-warning-wash); color: var(--signal-warning); }
	.state-missing { background: var(--signal-danger-wash); color: var(--signal-danger); }

	.two-col {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-xl);
	}

	@media (max-width: 700px) {
		.two-col { grid-template-columns: 1fr; }
	}

	h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.meta {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.meta > div {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: var(--space-md);
		padding: var(--space-xs) 0;
		border-bottom: 1px solid var(--edge-subtle);
	}

	.meta dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meta dd {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		word-break: break-word;
	}

	.meta dd a { color: var(--link-default); }

	.wrap { overflow-wrap: anywhere; }

	.mono { font-family: var(--font-family-mono); }

	.edit-hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		margin-top: var(--space-sm);
	}

	.edit-hint a { color: var(--link-default); }

	.muted { color: var(--ink-muted); font-size: var(--type-ui-label-size); }

	.empty {
		color: var(--ink-muted);
		padding: var(--space-lg);
		text-align: center;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.job-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.job-list li {
		display: grid;
		grid-template-columns: 2fr 1fr 1.5fr;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		align-items: center;
	}

	.job-list a { color: var(--link-default); text-decoration: none; }
	.job-list a:hover { text-decoration: underline; }

	.status {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		text-align: center;
		width: fit-content;
	}

	.status.s-queued { background: var(--surface-sunken); color: var(--ink-muted); }
	.status.s-running { background: var(--signal-info-wash); color: var(--signal-info); }
	.status.s-complete { background: var(--signal-success-wash); color: var(--signal-success); }
	.status.s-failed { background: var(--signal-danger-wash); color: var(--signal-danger); }
	.status.s-cancelled { background: var(--signal-warning-wash); color: var(--signal-warning); }

	.ts { color: var(--ink-muted); font-size: var(--type-ui-caption-size); }
</style>
