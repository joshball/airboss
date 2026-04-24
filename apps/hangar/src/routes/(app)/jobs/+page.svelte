<script lang="ts">
import { JOB_KIND_VALUES, JOB_STATUS_VALUES, JOB_STATUSES, type JobKind, type JobStatus, ROUTES } from '@ab/constants';
import { invalidateAll, replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// svelte-ignore state_referenced_locally
let kindValue = $state<JobKind | ''>(data.filters.kind ?? '');
// svelte-ignore state_referenced_locally
let statusValue = $state<JobStatus | ''>(data.filters.status ?? '');

$effect(() => {
	const _deps = [kindValue, statusValue];
	void _deps;
	if (typeof window === 'undefined') return;
	const url = new URL(page.url);
	const params = url.searchParams;
	const setOrDelete = (key: string, value: string) => {
		if (value) params.set(key, value);
		else params.delete(key);
	};
	setOrDelete('kind', kindValue);
	setOrDelete('status', statusValue);
	if (url.search === page.url.search) return;
	replaceState(url, page.state);
});

// Poll at 1 Hz while any job is in a non-terminal state.
const hasLiveJobs = $derived(
	data.jobs.some((j) => j.status === JOB_STATUSES.QUEUED || j.status === JOB_STATUSES.RUNNING),
);

$effect(() => {
	if (!hasLiveJobs) return;
	if (typeof window === 'undefined') return;
	const timer = setInterval(() => {
		void invalidateAll();
	}, 1000);
	return () => clearInterval(timer);
});

function statusTone(status: string): string {
	switch (status) {
		case JOB_STATUSES.COMPLETE:
			return 'success';
		case JOB_STATUSES.RUNNING:
			return 'info';
		case JOB_STATUSES.QUEUED:
			return 'neutral';
		case JOB_STATUSES.FAILED:
			return 'danger';
		case JOB_STATUSES.CANCELLED:
			return 'warning';
		default:
			return 'neutral';
	}
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
	if (!startedAt) return '-';
	const start = new Date(startedAt).getTime();
	const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
	const seconds = Math.max(0, Math.round((end - start) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return `${minutes}m ${remainder}s`;
}
</script>

<svelte:head>
	<title>Jobs -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>Jobs</h1>
		<p class="sub">
			Last {data.limit} entries in the hangar job queue. Live jobs refresh every second.
		</p>
	</header>

	<section class="filter-bar" aria-label="Filter jobs">
		<div class="field">
			<label for="job-kind">Kind</label>
			<select id="job-kind" bind:value={kindValue}>
				<option value="">All kinds</option>
				{#each JOB_KIND_VALUES as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="job-status">Status</label>
			<select id="job-status" bind:value={statusValue}>
				<option value="">All statuses</option>
				{#each JOB_STATUS_VALUES as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</div>
	</section>

	{#if data.jobs.length === 0}
		<p class="empty">
			{#if data.filters.kind || data.filters.status}
				No jobs match the current filters.
			{:else}
				No jobs yet. Sync a dirty reference from <a href={ROUTES.HANGAR_GLOSSARY}>Glossary</a> to enqueue one.
			{/if}
		</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Job</th>
						<th scope="col">Kind</th>
						<th scope="col">Target</th>
						<th scope="col">Status</th>
						<th scope="col">Progress</th>
						<th scope="col">Duration</th>
						<th scope="col">Created</th>
					</tr>
				</thead>
				<tbody>
					{#each data.jobs as job (job.id)}
						<tr>
							<td class="mono">
								<a href={ROUTES.HANGAR_JOB_DETAIL(job.id)}>{job.id}</a>
							</td>
							<td class="mono">{job.kind}</td>
							<td class="mono">
								{#if job.targetType}
									{job.targetType}{job.targetId ? `:${job.targetId}` : ''}
								{:else}
									-
								{/if}
							</td>
							<td>
								<span class="status-chip status-{statusTone(job.status)}">{job.status}</span>
							</td>
							<td>
								{#if job.status === JOB_STATUSES.RUNNING}
									{job.progress.step ?? 0}{#if job.progress.total} / {job.progress.total}{/if}
									{#if job.progress.message}
										<span class="muted"> &middot; {job.progress.message}</span>
									{/if}
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
							<td class="mono">{formatDuration(job.startedAt, job.finishedAt)}</td>
							<td class="mono">{formatTime(job.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
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
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.filter-bar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		max-width: 40rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field select {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.empty a {
		color: var(--link-default);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	th,
	td {
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

	tr:hover {
		background: var(--table-row-bg-hover);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.mono a {
		color: var(--link-default);
		text-decoration: none;
	}

	.mono a:hover {
		text-decoration: underline;
	}

	.muted {
		color: var(--ink-muted);
	}

	.status-chip {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.status-success {
		background: var(--signal-success-wash);
		color: var(--signal-success);
	}

	.status-info {
		background: var(--signal-info-wash);
		color: var(--signal-info);
	}

	.status-warning {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.status-danger {
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
	}

	.status-neutral {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
</style>
