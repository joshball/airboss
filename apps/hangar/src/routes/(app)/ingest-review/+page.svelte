<script lang="ts">
import {
	CORPUS_LABELS,
	CORPUS_VALUES,
	type Corpus,
	INGEST_ISSUE_KIND_LABELS,
	INGEST_ISSUE_KIND_VALUES,
	INGEST_STATUS_LABELS,
	INGEST_STATUS_VALUES,
	type IngestIssueKind,
	type IngestStatus,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import { enhance } from '$app/forms';
import StatusBadge from '$lib/ingest-review/StatusBadge.svelte';
import type { PageProps } from './$types';

const { data, form }: PageProps = $props();

type IssueRow = (typeof data.issues)[number];
const issuesByGroup = $derived.by(() => {
	const map = new Map<string, { corpus: Corpus; sourceId: string; issues: IssueRow[] }>();
	for (const issue of data.issues) {
		const key = `${issue.corpus}::${issue.sourceId}`;
		const existing = map.get(key);
		if (existing) {
			existing.issues.push(issue);
		} else {
			map.set(key, { corpus: issue.corpus, sourceId: issue.sourceId, issues: [issue] });
		}
	}
	return [...map.values()].sort((a, b) =>
		a.corpus !== b.corpus ? a.corpus.localeCompare(b.corpus) : a.sourceId.localeCompare(b.sourceId),
	);
});

function buildFilterUrl(
	overrides: Partial<{
		corpus: Corpus | null;
		status: IngestStatus | null;
		kind: IngestIssueKind | null;
		sourceId: string | null;
	}>,
): string {
	const params = new URLSearchParams();
	const next = {
		corpus: overrides.corpus !== undefined ? overrides.corpus : data.filters.corpus,
		sourceId: overrides.sourceId !== undefined ? overrides.sourceId : data.filters.sourceId,
		kind: overrides.kind !== undefined ? overrides.kind : data.filters.kind,
		status: overrides.status !== undefined ? overrides.status : data.filters.status,
	};
	if (next.corpus !== null) params.set(QUERY_PARAMS.CORPUS, next.corpus);
	if (next.sourceId !== null) params.set(QUERY_PARAMS.SOURCE, next.sourceId);
	if (next.kind !== null) params.set(QUERY_PARAMS.KIND, next.kind);
	if (next.status !== null) params.set(QUERY_PARAMS.STATUS, next.status);
	const qs = params.toString();
	return qs.length > 0 ? `${ROUTES.HANGAR_INGEST_REVIEW}?${qs}` : ROUTES.HANGAR_INGEST_REVIEW;
}
</script>

<section class="filters" aria-label="Filters">
	<div class="filter-group" role="group" aria-label="Status">
		<span class="filter-label">Status</span>
		{#each INGEST_STATUS_VALUES as status (status)}
			<a
				class="chip"
				href={buildFilterUrl({ status })}
				aria-current={data.filters.status === status ? 'page' : undefined}
			>
				{INGEST_STATUS_LABELS[status]}
				<span class="count">{data.statusCounts[status]}</span>
			</a>
		{/each}
	</div>

	<div class="filter-group" role="group" aria-label="Corpus">
		<span class="filter-label">Corpus</span>
		<a
			class="chip"
			href={buildFilterUrl({ corpus: null, sourceId: null })}
			aria-current={data.filters.corpus === null ? 'page' : undefined}
		>All</a>
		{#each CORPUS_VALUES as corpus (corpus)}
			<a
				class="chip"
				href={buildFilterUrl({ corpus, sourceId: null })}
				aria-current={data.filters.corpus === corpus ? 'page' : undefined}
			>{CORPUS_LABELS[corpus]}</a>
		{/each}
	</div>

	<div class="filter-group" role="group" aria-label="Kind">
		<span class="filter-label">Kind</span>
		<a
			class="chip"
			href={buildFilterUrl({ kind: null })}
			aria-current={data.filters.kind === null ? 'page' : undefined}
		>All</a>
		{#each INGEST_ISSUE_KIND_VALUES as kind (kind)}
			<a
				class="chip"
				href={buildFilterUrl({ kind })}
				aria-current={data.filters.kind === kind ? 'page' : undefined}
			>{INGEST_ISSUE_KIND_LABELS[kind]}</a>
		{/each}
	</div>

	{#if data.sources.length > 0}
		<div class="filter-group" role="group" aria-label="Source">
			<span class="filter-label">Source</span>
			<a
				class="chip"
				href={buildFilterUrl({ sourceId: null })}
				aria-current={data.filters.sourceId === null ? 'page' : undefined}
			>All</a>
			{#each data.sources as source (source.corpus + '::' + source.sourceId)}
				<a
					class="chip"
					href={buildFilterUrl({ sourceId: source.sourceId })}
					aria-current={data.filters.sourceId === source.sourceId ? 'page' : undefined}
				>{source.sourceId} <span class="count">{source.total}</span></a>
			{/each}
		</div>
	{/if}
</section>

<form method="POST" action={ROUTES.HANGAR_INGEST_REVIEW_RUN_PRODUCERS_ACTION} use:enhance class="run-producers">
	<input type="hidden" name="corpus" value={data.filters.corpus ?? 'handbook'} />
	{#if data.filters.sourceId}
		<input type="hidden" name="source" value={data.filters.sourceId} />
	{/if}
	<button type="submit" class="primary">Run producers</button>
	<span class="hint">Re-scan handbook warnings.json files and refresh the queue.</span>
</form>

{#if form?.ok && form.summary}
	<p class="run-summary">
		Producers ran: upserted {form.summary.totalUpserted}, staled {form.summary.totalStaled}, errors {form.summary.totalErrors}.
	</p>
{:else if form && !form.ok && form.error}
	<p class="run-error">Producer run failed: {form.error}</p>
{/if}

{#if data.issues.length === 0}
	<p class="empty-state">
		No issues match the current filters. Try a different status, or click <em>Run producers</em>
		to scan the handbook ingest output for new orphans.
	</p>
{:else}
	{#each issuesByGroup as group (group.corpus + '::' + group.sourceId)}
		<section class="group">
			<h2>{CORPUS_LABELS[group.corpus]} - {group.sourceId}</h2>
			<ul class="issue-list">
				{#each group.issues as issue (issue.id)}
					<li class="issue-row">
						<a class="issue-link" href={ROUTES.HANGAR_INGEST_REVIEW_ISSUE(issue.id)}>
							<span class="issue-kind">{INGEST_ISSUE_KIND_LABELS[issue.kind]}</span>
							<span class="issue-page">{issue.pageNum !== null ? `p. ${issue.pageNum}` : 'no page'}</span>
							<span class="issue-summary">{issue.externalId}</span>
							<StatusBadge status={issue.status} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.filter-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.filter-label {
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
		min-width: 4rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-pill, 999px);
		background: var(--surface-page);
		color: var(--ink-body);
		text-decoration: none;
		border: 1px solid var(--edge-subtle);
		font-size: var(--type-ui-caption-size);
	}

	.chip:hover {
		background: var(--surface-sunken);
	}

	.chip[aria-current='page'] {
		background: var(--action-default-wash);
		color: var(--action-default-ink);
		border-color: var(--action-default);
	}

	.count {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
	}

	.run-producers {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.run-producers .hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.run-summary {
		color: var(--signal-success-ink, var(--ink-body));
		background: var(--signal-success-wash, var(--surface-raised));
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.run-error {
		color: var(--signal-danger-ink, var(--ink-body));
		background: var(--signal-danger-wash, var(--surface-raised));
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.empty-state {
		padding: var(--space-lg);
		background: var(--surface-raised);
		border: 1px dashed var(--edge-subtle);
		border-radius: var(--radius-md);
		color: var(--ink-muted);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.group h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
	}

	.issue-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.issue-row {
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-page);
	}

	.issue-link {
		display: grid;
		grid-template-columns: minmax(10ch, max-content) minmax(6ch, max-content) 1fr max-content;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		text-decoration: none;
		color: var(--ink-body);
	}

	.issue-link:hover {
		background: var(--surface-sunken);
	}

	.issue-kind {
		font-weight: var(--font-weight-medium);
	}

	.issue-page,
	.issue-summary {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}
</style>
