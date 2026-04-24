<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { SearchHit } from '../registry';
import type { Reference } from '../schema/reference';

const MAX_PREVIEW = 200;

let {
	reference,
	hit = null,
}: {
	reference: Reference;
	hit?: SearchHit | null;
} = $props();

function truncate(text: string, max: number): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) return collapsed;
	return `${collapsed.slice(0, max).trimEnd()}...`;
}

const preview = $derived(truncate(reference.paraphrase, MAX_PREVIEW));

interface HighlightParts {
	before: string;
	match: string;
	after: string;
}

function splitHighlight(text: string, range: readonly [number, number]): HighlightParts | null {
	const [start, end] = range;
	if (start < 0 || end <= start || end > text.length) return null;
	return {
		before: text.slice(0, start),
		match: text.slice(start, end),
		after: text.slice(end),
	};
}

const titleParts = $derived.by<HighlightParts | null>(() => {
	if (!hit || hit.matchedField !== 'displayName') return null;
	return splitHighlight(reference.displayName, hit.matchRange);
});

const matchedParts = $derived.by<HighlightParts | null>(() => {
	if (!hit || hit.matchedField === 'displayName') return null;
	return splitHighlight(hit.matchedText, hit.matchRange);
});
</script>

<a class="card" href={ROUTES.GLOSSARY_ID(reference.id)}>
	<header class="hd">
		<h3>
			{#if titleParts}{titleParts.before}<mark>{titleParts.match}</mark>{titleParts.after}{:else}{reference.displayName}{/if}
		</h3>
		<span class="id">{reference.id}</span>
	</header>
	{#if matchedParts && hit}
		<p class="matched">
			matched: <em>{matchedParts.before}<mark>{matchedParts.match}</mark>{matchedParts.after}</em> ({hit.matchedField})
		</p>
	{/if}
	<p class="para">{preview}</p>
	<div class="tags">
		<span class="chip source">{reference.tags.sourceType}</span>
		<span class="chip rules">{reference.tags.flightRules}</span>
		<span class="chip kind">{reference.tags.knowledgeKind}</span>
		{#each reference.tags.aviationTopic as topic (topic)}
			<span class="chip topic">{topic}</span>
		{/each}
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: 0.875rem var(--space-lg);
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--motion-fast),
			box-shadow var(--motion-fast);
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--action-default-hover);
		box-shadow: var(--shadow-sm);
		outline: none;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.hd h3 {
		margin: 0;
		font-size: var(--font-size-base);
		color: var(--ink-body);
	}

	.id {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	.para {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		line-height: var(--line-height-normal);
	}

	.matched {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	.matched em {
		font-style: normal;
		color: var(--ink-muted);
	}

	mark {
		background: var(--action-caution-wash);
		color: var(--ink-body);
		padding: 0 0.0625rem;
		border-radius: var(--radius-xs);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem var(--space-sm);
		font-size: var(--font-size-xs);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		border: 1px solid var(--edge-default);
	}

	.chip.source {
		background: var(--action-default-wash);
		color: var(--action-default);
		border-color: var(--action-default-edge);
	}

	.chip.kind {
		background: var(--action-caution-wash);
		color: var(--action-caution);
		border-color: var(--action-caution-edge);
	}
</style>
