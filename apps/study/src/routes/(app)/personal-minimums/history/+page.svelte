<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { formatFieldValue, PERSONAL_MINIMUMS_FIELDS } from '../_lib/fields';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const rows = $derived(data.rows);

function fmtDate(value: Date | string): string {
	return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>{NAV_LABELS.PERSONAL_MINIMUMS_HISTORY} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.STUDY_PERSONAL_MINIMUMS}>{NAV_LABELS.PERSONAL_MINIMUMS}</a>
		<span aria-hidden="true">/</span>
		<span>{NAV_LABELS.PERSONAL_MINIMUMS_HISTORY}</span>
	</nav>

	<PageHeader
		title={NAV_LABELS.PERSONAL_MINIMUMS_HISTORY}
		subtitle="Every revision of your stated floors, newest first."
	/>

	{#if rows.length === 0}
		<EmptyState
			title="No revisions yet"
			body="Once you record your personal minimums, every change shows up here as a dated revision."
		/>
	{:else}
		<ol class="revisions" data-testid="pmin-history-list">
			{#each rows as { record, notesHtml } (record.id)}
				<li class="revision" class:active={record.isActive} data-testid="pmin-history-row">
					<header class="rev-header">
						{#if record.isActive}
							<span class="badge">Active</span>
							<span class="window">since {fmtDate(record.effectiveFrom)}</span>
						{:else}
							<span class="window">
								{fmtDate(record.effectiveFrom)} -> {record.effectiveUntil
									? fmtDate(record.effectiveUntil)
									: '--'}
							</span>
						{/if}
					</header>
					<dl class="rev-fields">
						{#each PERSONAL_MINIMUMS_FIELDS as field (field.key)}
							<div>
								<dt>{field.label}</dt>
								<dd>{formatFieldValue(field, record[field.key])}</dd>
							</div>
						{/each}
					</dl>
					{#if notesHtml}
						<section class="rev-notes" aria-label="Revision notes">
							<!-- Server-rendered + sanitized via the shared markdown pipeline. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<div>{@html notesHtml}</div>
						</section>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
.page {
	max-width: 56rem;
	margin: 0 auto;
	padding: var(--space-xl) var(--space-lg);
	display: flex;
	flex-direction: column;
	gap: var(--space-lg);
}

.crumb {
	display: flex;
	gap: var(--space-xs);
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}

.crumb a {
	color: var(--action-link);
}

.revisions {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
}

.revision {
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	padding: var(--space-md);
	background: var(--surface-raised);
}

.revision.active {
	border-color: var(--action-link);
}

.rev-header {
	display: flex;
	align-items: center;
	gap: var(--space-xs);
	margin-bottom: var(--space-sm);
}

.badge {
	background: var(--action-link);
	color: var(--ink-inverse);
	border-radius: var(--radius-sm);
	padding: var(--space-4xs) var(--space-xs);
	font-size: var(--font-size-xs);
	font-weight: var(--font-weight-semibold);
}

.window {
	color: var(--ink-muted);
	font-variant-numeric: tabular-nums;
}

.rev-fields {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
	gap: var(--space-xs);
	margin: 0;
}

.rev-fields dt {
	color: var(--ink-muted);
	font-size: var(--font-size-xs);
}

.rev-fields dd {
	margin: 0;
	font-weight: var(--font-weight-semibold);
	font-variant-numeric: tabular-nums;
}

.rev-notes {
	margin-top: var(--space-sm);
	padding-top: var(--space-sm);
	border-top: 1px solid var(--edge-subtle);
}
</style>
