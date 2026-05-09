<script lang="ts">
import { KNOWLEDGE_PHASE_LABELS, type KnowledgePhase } from '@ab/constants';
import { humanize, renderMarkdown } from '@ab/utils';

/**
 * Phase entries are rendered in the order supplied (the loader already
 * orders them via `KNOWLEDGE_PHASE_ORDER`). A phase with `body === null`
 * renders the "not yet authored" placeholder; a phase with an empty
 * string renders the placeholder too (the loader normalises both shapes
 * to `null` already, but this component is defensive about either).
 */
export interface PhaseEntry {
	phase: KnowledgePhase;
	body: string | null;
}

interface Props {
	/** Ordered list of content phases (Context / Problem / Discover / ... / Verify). */
	phases: readonly PhaseEntry[];
	/** Optional mastery-criteria markdown rendered below the phases. */
	masteryCriteria?: string | null;
	/** Aria label override -- defaults to "Content phases". */
	ariaLabel?: string;
}

let { phases, masteryCriteria = null, ariaLabel = 'Content phases' }: Props = $props();

function phaseLabel(phase: KnowledgePhase): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase] ?? humanize(phase);
}

function renderPhase(body: string | null): string {
	if (!body) return '';
	return renderMarkdown(body);
}
</script>

<section class="phases" aria-label={ariaLabel}>
	{#each phases as p (p.phase)}
		<article class="phase" aria-labelledby="phase-{p.phase}">
			<h3 id="phase-{p.phase}" class="phase-title">{phaseLabel(p.phase)}</h3>
			{#if p.body}
				<div class="prose">{@html renderPhase(p.body)}</div>
			{:else}
				<p class="gap-body">Not yet authored.</p>
			{/if}
		</article>
	{/each}
</section>

{#if masteryCriteria}
	<section class="section" aria-label="Mastery criteria">
		<h2 class="criteria-title">Mastery criteria</h2>
		<div class="prose">{@html renderMarkdown(masteryCriteria)}</div>
	</section>
{/if}

<style>
	.phases {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.phase {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-lg);
	}

	.phase-title {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-reading-body-size);
		color: var(--ink-body);
	}

	.criteria-title {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-heading-2-size);
		color: var(--ink-body);
	}

	.section {
		margin-top: var(--space-xl);
	}

	.gap-body {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: var(--space-lg) 0 var(--space-sm);
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-md) var(--space-xl);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(li) {
		margin-bottom: var(--space-2xs);
	}

	.prose :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
	}

	.prose :global(pre) {
		background: var(--ink-body);
		color: var(--edge-default);
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		overflow-x: auto;
		font-size: var(--type-ui-label-size);
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: var(--action-default-hover);
	}
</style>
