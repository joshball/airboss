<script lang="ts">
import type { CertGap } from '@ab/bc-study';
import { BLOOM_LEVEL_LABELS, type BloomLevel } from '@ab/constants';

interface Props {
	gaps: readonly CertGap[];
	/** Optional heading text -- defaults to "Cert gaps". */
	heading?: string;
}

let { gaps, heading = 'Cert gaps' }: Props = $props();

function bloomLabel(bloom: BloomLevel | null): string {
	if (bloom === null) return '';
	return BLOOM_LEVEL_LABELS[bloom] ?? bloom;
}
</script>

<section class="panel" aria-label={heading}>
	<header class="panel-head">
		<h2 class="panel-title">{heading}</h2>
		<span class="panel-count">{gaps.length} {gaps.length === 1 ? 'leaf' : 'leaves'} uncovered</span>
	</header>
	{#if gaps.length === 0}
		<p class="empty">No gaps. The course covers every cert leaf in this syllabus.</p>
	{:else}
		<ul class="gap-list">
			{#each gaps as gap (gap.syllabusNodeId)}
				<li class="gap-row">
					<span class="gap-code">{gap.code}</span>
					<span class="gap-title">{gap.title}</span>
					{#if gap.requiredBloom}
						<span class="gap-bloom">{bloomLabel(gap.requiredBloom)}</span>
					{/if}
					<span class="gap-link-count" title="Linked knowledge nodes">
						{gap.knowledgeNodeIds.length} node{gap.knowledgeNodeIds.length === 1 ? '' : 's'}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.panel {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.panel-title {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.panel-count {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.empty {
		margin: 0;
		color: var(--signal-success);
		font-size: var(--type-definition-body-size);
	}

	.gap-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.gap-row {
		display: grid;
		grid-template-columns: minmax(8rem, max-content) 1fr auto auto;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-muted);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
		align-items: center;
	}

	.gap-code {
		font-family: var(--font-family-mono);
		color: var(--ink-body);
		font-weight: 600;
	}

	.gap-title {
		color: var(--ink-body);
	}

	.gap-bloom {
		padding: 0 var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.gap-link-count {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
	}
</style>
