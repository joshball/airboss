<script lang="ts">
import { type ReferenceSourceType, ROUTES, SOURCE_TYPE_LABELS } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import FlowDiagram from '$lib/components/FlowDiagram.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

function formatBytes(bytes: number | null): string {
	if (bytes === null || bytes <= 0) return '--';
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatState(state: 'pending' | 'downloaded' | 'extracted'): string {
	if (state === 'pending') return 'pending';
	if (state === 'downloaded') return 'downloaded';
	return 'extracted';
}

function formatDate(iso: string | null): string {
	if (!iso) return '--';
	try {
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	} catch {
		return iso;
	}
}
</script>

<svelte:head>
	<title>Sources -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Sources</h1>
			<p class="sub">Reference-system operations. Every affordance below is live.</p>
		</div>
	</header>

	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	<FlowDiagram state={data.flowState}>
		{#snippet actions()}
			<form method="POST" action={ROUTES.HANGAR_SOURCES_RESCAN_ACTION}>
				<Button type="submit" variant="secondary" size="sm">Rescan</Button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_SOURCES_REVALIDATE_ACTION}>
				<Button type="submit" variant="secondary" size="sm">Revalidate</Button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_SOURCES_BUILD_ACTION}>
				<Button type="submit" variant="secondary" size="sm">Build</Button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_SOURCES_SIZE_REPORT_ACTION}>
				<Button type="submit" variant="secondary" size="sm">Size report</Button>
			</form>
		{/snippet}
	</FlowDiagram>

	<section class="status-panel" aria-labelledby="status-h">
		<h2 id="status-h">Status</h2>
		<div class="status-grid">
			<div class="status-tile">
				<div class="tile-value">{data.statusTiles.registeredSources}</div>
				<div class="tile-label">Registered sources</div>
			</div>
			<div class="status-tile">
				<div class="tile-value">{data.statusTiles.downloaded}</div>
				<div class="tile-label">Downloaded</div>
			</div>
			<div class="status-tile">
				<div class="tile-value">{data.statusTiles.verbatimMaterialised}</div>
				<div class="tile-label">Verbatim materialised</div>
			</div>
			<div class="status-tile" class:warn={data.statusTiles.tbdCount > 0}>
				<div class="tile-value">{data.statusTiles.tbdCount}</div>
				<div class="tile-label">TBD wiki-links</div>
			</div>
			<div class="status-tile">
				<div class="tile-value ts">{formatDate(data.statusTiles.oldestDownloadedAt)}</div>
				<div class="tile-label">Oldest source</div>
			</div>
		</div>
	</section>

	<section class="registry" aria-labelledby="registry-h">
		<div class="registry-head">
			<h2 id="registry-h">Source registry</h2>
			<a class="inline-link" href={ROUTES.HANGAR_GLOSSARY_SOURCES_NEW}>New source</a>
		</div>

		{#if data.sources.length === 0}
			<p class="empty">No sources registered yet.</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col" class="col-id">ID</th>
							<th scope="col">Title</th>
							<th scope="col">Type</th>
							<th scope="col">Version</th>
							<th scope="col">State</th>
							<th scope="col">Size</th>
							<th scope="col">Activity</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.sources as src (src.id)}
							<tr class:busy={src.activeJob !== null}>
								<td class="col-id mono">
									<a href={ROUTES.HANGAR_SOURCE_DETAIL(src.id)}>{src.id}</a>
								</td>
								<td>{src.title}</td>
								<td>{SOURCE_TYPE_LABELS[src.type as ReferenceSourceType] ?? src.type}</td>
								<td class="mono">{src.version}</td>
								<td>
									<span class="state state-{src.state}">{formatState(src.state)}</span>
								</td>
								<td class="mono">{formatBytes(src.sizeBytes)}</td>
								<td>
									{#if src.activeJob}
										<a class="active-job" href={ROUTES.HANGAR_JOB_DETAIL(src.activeJob.id)}>
											{src.activeJob.kind}
										</a>
									{:else}
										<span class="muted">--</span>
									{/if}
								</td>
								<td class="actions">
									<a class="chip" href={ROUTES.HANGAR_SOURCE_DETAIL(src.id)}>Open</a>
									<a class="chip" href={ROUTES.HANGAR_SOURCE_FILES(src.id)}>Files</a>
									<a class="chip" href={ROUTES.HANGAR_SOURCE_DIFF(src.id)}>Diff</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
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

	.status-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.status-panel h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--space-md);
	}

	.status-tile {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.status-tile.warn {
		border-color: var(--signal-warning-edge);
		background: var(--signal-warning-wash);
	}

	.tile-value {
		font-family: var(--font-family-mono);
		font-weight: var(--font-weight-bold);
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.tile-value.ts {
		font-size: var(--type-ui-control-size);
	}

	.tile-label {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.registry-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: var(--space-sm);
	}

	.registry-head h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.inline-link {
		color: var(--link-default);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.inline-link:hover { text-decoration: underline; }

	.empty {
		color: var(--ink-muted);
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	th, td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--table-row-edge);
		color: var(--ink-body);
		vertical-align: top;
	}

	th {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
	}

	tr.busy {
		background: var(--signal-info-wash);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.col-id a {
		color: var(--link-default);
		text-decoration: none;
	}

	.col-id a:hover { text-decoration: underline; }

	.state {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.state-pending {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.state-downloaded {
		background: var(--signal-info-wash);
		color: var(--signal-info);
	}

	.state-extracted {
		background: var(--signal-success-wash);
		color: var(--signal-success);
	}

	.muted { color: var(--ink-muted); }

	.active-job {
		color: var(--link-default);
		text-decoration: none;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.active-job:hover { text-decoration: underline; }

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-sunken);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: var(--type-ui-caption-size);
	}

	.chip:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}
</style>
