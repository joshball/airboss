<script lang="ts">
import type { Candidate } from '@ab/bc-ingest-review';

interface Props {
	candidates: readonly Candidate[];
	selectedId: string | null;
	onSelect: (candidate: Candidate) => void;
}

const { candidates, selectedId, onSelect }: Props = $props();
</script>

{#if candidates.length === 0}
	<p class="empty">No candidates inside the page-window radius. Use <em>Mark no figure</em> or
	<em>Mark false caption</em> instead.</p>
{:else}
	<div class="strip" role="radiogroup" aria-label="Candidate figures">
		{#each candidates as candidate (candidate.id)}
			{@const selected = candidate.id === selectedId}
			<button
				type="button"
				class="thumb"
				class:selected
				role="radio"
				aria-checked={selected}
				onclick={() => onSelect(candidate)}
			>
				{#if candidate.thumbnailUrl}
					<img src={candidate.thumbnailUrl} alt={candidate.label} loading="lazy" />
				{:else}
					<span class="placeholder" aria-hidden="true">{candidate.label.slice(0, 60)}</span>
				{/if}
				<span class="meta">
					<span class="page">p. {candidate.pageNum}</span>
					{#if candidate.width > 0 && candidate.height > 0}
						<span class="dims">{candidate.width}x{candidate.height}</span>
					{/if}
				</span>
				<span class="label" title={candidate.label}>{candidate.label}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.empty {
		padding: var(--space-md);
		background: var(--surface-elevated);
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
	}

	.strip {
		display: flex;
		gap: var(--space-sm);
		overflow-x: auto;
		padding-bottom: var(--space-2xs);
	}

	.thumb {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-2xs);
		background: var(--surface-base);
		border: 2px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		min-width: 12rem;
		max-width: 16rem;
		text-align: left;
	}

	.thumb:hover {
		border-color: var(--action-default);
	}

	.thumb.selected {
		border-color: var(--action-default);
		background: var(--action-default-wash);
	}

	.thumb img {
		max-width: 100%;
		max-height: 12rem;
		object-fit: contain;
		background: var(--surface-sunken);
	}

	.placeholder {
		display: block;
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.meta {
		display: flex;
		gap: var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}

	.label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-body);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
