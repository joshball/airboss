<script lang="ts">
import {
	JOB_DETAIL_POLL_INTERVAL_MS,
	JOB_LOG_CLIENT_BUFFER_MAX,
	JOB_LOG_STREAMS,
	JOB_STATUSES,
	JOB_TERMINAL_STATUSES,
	type JobLogStream,
	type JobStatus,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import type { BadgeTone } from '@ab/ui';
import Badge from '@ab/ui/components/Badge.svelte';
import Breadcrumbs from '@ab/ui/components/Breadcrumbs.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

interface LogLine {
	seq: number;
	stream: string;
	line: string;
	at: string;
}

// svelte-ignore state_referenced_locally
let logs = $state<LogLine[]>(data.logs.map((l) => ({ seq: l.seq, stream: l.stream, line: l.line, at: l.at })));
// svelte-ignore state_referenced_locally
let latestSeq = $state(data.latestSeq);
// Number of log lines dropped from the head of the buffer due to the
// `JOB_LOG_CLIENT_BUFFER_MAX` cap. Surfaced in the log header so operators
// know what they're looking at; the full history is still queryable via the
// log endpoint with a `sinceSeq` cursor.
let droppedLineCount = $state(0);
// svelte-ignore state_referenced_locally
// Server values are constrained to JobStatus by the audit-checked DB enum;
// TS sees `string` because the JSON serialisation widens it on the wire.
let currentStatus = $state<JobStatus>(data.job.status as JobStatus);
// svelte-ignore state_referenced_locally
let currentError = $state<string | null>(data.job.error);
// svelte-ignore state_referenced_locally
let currentFinishedAt = $state<string | null>(data.job.finishedAt);
// svelte-ignore state_referenced_locally
let currentProgress = $state<{ step?: number; total?: number; message?: string }>(data.job.progress);
let activeStream = $state<'all' | JobLogStream>('all');
let cancelDialogOpen = $state(false);

const isTerminal = $derived((JOB_TERMINAL_STATUSES as readonly string[]).includes(currentStatus));

const cancelTargetLabel = $derived(`${data.job.targetType ?? '-'}${data.job.targetId ? `:${data.job.targetId}` : ''}`);

const elapsedSinceStart = $derived.by(() => {
	if (!data.job.startedAt) return null;
	const startedMs = new Date(data.job.startedAt).getTime();
	if (Number.isNaN(startedMs)) return null;
	const finishedMs = currentFinishedAt ? new Date(currentFinishedAt).getTime() : Date.now();
	const elapsedSeconds = Math.max(0, Math.round((finishedMs - startedMs) / 1000));
	if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
	const minutes = Math.floor(elapsedSeconds / 60);
	const seconds = elapsedSeconds % 60;
	return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
});

const filteredLogs = $derived(activeStream === 'all' ? logs : logs.filter((l) => l.stream === activeStream));

async function pollLog(): Promise<void> {
	const res = await fetch(`${ROUTES.HANGAR_JOB_LOG(data.job.id)}?${QUERY_PARAMS.SINCE_SEQ}=${latestSeq}`);
	if (!res.ok) return;
	const body = (await res.json()) as {
		status: string;
		progress: { step?: number; total?: number; message?: string };
		error: string | null;
		finishedAt: string | null;
		lines: LogLine[];
		latestSeq: number;
	};
	currentStatus = body.status as JobStatus;
	currentProgress = body.progress;
	currentError = body.error;
	currentFinishedAt = body.finishedAt;
	if (body.lines.length > 0) {
		const merged = [...logs, ...body.lines];
		// Cap the buffer at JOB_LOG_CLIENT_BUFFER_MAX. Drop oldest lines
		// (FIFO) when the cap is exceeded; the count is surfaced in the
		// log header so operators know lines have been trimmed.
		if (merged.length > JOB_LOG_CLIENT_BUFFER_MAX) {
			const overflow = merged.length - JOB_LOG_CLIENT_BUFFER_MAX;
			droppedLineCount += overflow;
			logs = merged.slice(overflow);
		} else {
			logs = merged;
		}
		latestSeq = body.latestSeq;
	}
}

$effect(() => {
	if (isTerminal) return;
	if (typeof window === 'undefined') return;
	const timer = setInterval(() => {
		void pollLog();
	}, JOB_DETAIL_POLL_INTERVAL_MS);
	return () => clearInterval(timer);
});

function statusTone(status: string): BadgeTone {
	switch (status) {
		case JOB_STATUSES.COMPLETE:
			return 'success';
		case JOB_STATUSES.RUNNING:
			return 'info';
		case JOB_STATUSES.QUEUED:
			return 'default';
		case JOB_STATUSES.FAILED:
			return 'danger';
		case JOB_STATUSES.CANCELLED:
			return 'warning';
		default:
			return 'default';
	}
}

function formatTime(iso: string | null): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>

<svelte:head>
	<title>{data.job.kind} -- job {data.job.id}</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<Breadcrumbs
			items={[
				{ label: 'Jobs', href: ROUTES.HANGAR_JOBS },
				{ label: data.job.id, mono: true },
			]}
		/>
		<h1 class="mono">{data.job.kind}</h1>
		<div class="meta">
			<Badge tone={statusTone(currentStatus)} size="sm">{currentStatus}</Badge>
			<span class="muted">Target <span class="mono">{data.job.targetType ?? '-'}{data.job.targetId ? `:${data.job.targetId}` : ''}</span></span>
			{#if data.job.actorId}
				<span class="muted">Actor <span class="mono">{data.job.actorId}</span></span>
			{/if}
			<span class="muted">Created {formatTime(data.job.createdAt)}</span>
			{#if data.job.startedAt}
				<span class="muted">Started {formatTime(data.job.startedAt)}</span>
			{/if}
			{#if currentFinishedAt}
				<span class="muted">Finished {formatTime(currentFinishedAt)}</span>
			{/if}
		</div>
	</header>

	{#if currentStatus === JOB_STATUSES.RUNNING && currentProgress.message}
		<p class="progress">
			<strong>{currentProgress.step ?? 0}{#if currentProgress.total} / {currentProgress.total}{/if}</strong>
			&middot; {currentProgress.message}
		</p>
	{/if}

	{#if currentError}
		<section class="error-panel" aria-label="Error output">
			<h2>Error</h2>
			<pre>{currentError}</pre>
		</section>
	{/if}

	{#if data.job.result}
		<section class="result-panel" aria-label="Result">
			<h2>Result</h2>
			<pre>{JSON.stringify(data.job.result, null, 2)}</pre>
		</section>
	{/if}

	<section class="logs" aria-label="Job log">
		<!--
			Toggle group, not a tablist. We don't ship the full ARIA tabs
			contract (roving tabindex + arrow keys + tabpanel association),
			so `role="group"` + `aria-pressed` is the correct shape per
			WAI-ARIA APG and matches the audit page's chip-group pattern.
		-->
		<div class="log-tabs" role="group" aria-label="Filter log stream">
			<button
				type="button"
				aria-pressed={activeStream === 'all'}
				class:selected={activeStream === 'all'}
				onclick={() => (activeStream = 'all')}
			>All</button>
			<button
				type="button"
				aria-pressed={activeStream === JOB_LOG_STREAMS.STDOUT}
				class:selected={activeStream === JOB_LOG_STREAMS.STDOUT}
				onclick={() => (activeStream = JOB_LOG_STREAMS.STDOUT)}
			>stdout</button>
			<button
				type="button"
				aria-pressed={activeStream === JOB_LOG_STREAMS.STDERR}
				class:selected={activeStream === JOB_LOG_STREAMS.STDERR}
				onclick={() => (activeStream = JOB_LOG_STREAMS.STDERR)}
			>stderr</button>
			<button
				type="button"
				aria-pressed={activeStream === JOB_LOG_STREAMS.EVENT}
				class:selected={activeStream === JOB_LOG_STREAMS.EVENT}
				onclick={() => (activeStream = JOB_LOG_STREAMS.EVENT)}
			>event</button>
			<span class="spacer"></span>
			{#if !isTerminal}
				<span class="live-indicator" aria-live="polite">polling 1 Hz</span>
			{/if}
		</div>
		<div class="log-body">
			{#if droppedLineCount > 0}
				<p class="trim-notice" role="status">
					Showing the last {logs.length.toLocaleString()} of {(logs.length + droppedLineCount).toLocaleString()} lines.
					Older lines were dropped to keep the page responsive; the full log is available via the
					<a href="{ROUTES.HANGAR_JOB_LOG(data.job.id)}?sinceSeq=-1">log endpoint</a>.
				</p>
			{/if}
			{#if filteredLogs.length === 0}
				<p class="empty">No log lines yet.</p>
			{:else}
				{#each filteredLogs as line (line.seq)}
					<div class="log-line log-{line.stream}">
						<span class="log-seq">{line.seq}</span>
						<span class="log-time">{formatTime(line.at)}</span>
						<span class="log-stream">{line.stream}</span>
						<span class="log-text">{line.line}</span>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	{#if currentStatus === JOB_STATUSES.RUNNING || currentStatus === JOB_STATUSES.QUEUED}
		<div class="cancel-row">
			<button type="button" class="cancel-btn" onclick={() => (cancelDialogOpen = true)}>
				Cancel job
			</button>
			{#if form?.error}
				<p class="err">{form.error}</p>
			{/if}
		</div>
	{/if}
</section>

<ConfirmDialog
	open={cancelDialogOpen}
	oncancel={() => (cancelDialogOpen = false)}
	title="Cancel job?"
	confirmLabel="Cancel job"
	cancelLabel="Keep running"
	dangerLevel="caution"
	formAction={ROUTES.HANGAR_JOB_CANCEL_ACTION}
>
	<p>
		Cancel <code class="mono">{data.job.kind}</code> on <code class="mono">{cancelTargetLabel}</code>?
	</p>
	<p>
		Any partial work will be discarded. Side-effects already written to disk or database will not be rolled back;
		the job simply stops on its next cancel-poll tick.
		{#if elapsedSinceStart}
			This job has been running for <strong>{elapsedSinceStart}</strong>.
		{/if}
	</p>
</ConfirmDialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	h1 {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-heading-1-size);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-muted);
	}

	.progress {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-info-wash);
		color: var(--signal-info);
		border-left: 3px solid var(--signal-info);
		border-radius: var(--radius-sm);
	}

	.error-panel,
	.result-panel {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
	}

	.error-panel {
		border-color: var(--signal-danger-edge);
		background: var(--signal-danger-wash);
	}

	.error-panel h2,
	.result-panel h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-weight: var(--font-weight-semibold);
	}

	.error-panel h2 {
		color: var(--signal-danger);
	}

	.result-panel h2 {
		color: var(--ink-muted);
	}

	pre {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		white-space: pre-wrap;
		color: var(--ink-body);
		overflow-x: auto;
	}

	.logs {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		overflow: hidden;
	}

	.log-tabs {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		border-bottom: 1px solid var(--edge-subtle);
		background: var(--surface-panel);
	}

	.log-tabs button {
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		font: inherit;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.log-tabs button:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.log-tabs button.selected,
	.log-tabs button[aria-pressed='true'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.log-tabs button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.spacer {
		flex: 1;
	}

	.live-indicator {
		font-size: var(--type-ui-caption-size);
		color: var(--signal-info);
		font-family: var(--font-family-mono);
	}

	.log-body {
		max-height: 30rem;
		overflow-y: auto;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-sunken);
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.log-line {
		display: grid;
		grid-template-columns: 3rem 7rem 5rem 1fr;
		gap: var(--space-sm);
		padding: var(--space-2xs) 0;
		color: var(--ink-body);
		align-items: baseline;
	}

	.log-seq {
		color: var(--ink-faint);
		text-align: right;
	}

	.log-time {
		color: var(--ink-muted);
	}

	.log-stream {
		text-transform: uppercase;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		letter-spacing: var(--letter-spacing-wide);
	}

	.log-text {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.log-stderr .log-stream,
	.log-stderr .log-text {
		color: var(--signal-danger);
	}

	.log-event .log-stream,
	.log-event .log-text {
		color: var(--signal-info);
	}

	.empty {
		margin: 0;
		color: var(--ink-muted);
		font-style: italic;
	}

	.trim-notice {
		margin: 0 0 var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--signal-info-wash);
		color: var(--signal-info);
		font-family: var(--font-family-base);
		font-size: var(--type-ui-caption-size);
	}

	.trim-notice a {
		color: inherit;
		text-decoration: underline;
	}

	.cancel-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-xs);
	}

	.cancel-btn {
		background: var(--action-hazard-wash);
		color: var(--action-hazard);
		border: 1px solid var(--action-hazard-edge);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-md);
		cursor: pointer;
		font: inherit;
		font-weight: var(--font-weight-semibold);
	}

	.cancel-btn:hover:not([disabled]) {
		background: var(--action-hazard);
		color: var(--action-hazard-ink);
	}

	.cancel-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.err {
		margin: var(--space-xs) 0 0;
		color: var(--signal-danger);
		font-size: var(--type-ui-caption-size);
	}
</style>
