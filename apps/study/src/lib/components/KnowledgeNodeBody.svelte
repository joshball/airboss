<!--
KnowledgeNodeBody -- the 7-phase knowledge-node renderer extracted from the
`/reference/knowledge/[slug]` detail page. Used by both the knowledge detail
page and the course step reader (`/courses/[slug]/[stepCode]`).

Per ADR 011 (knowledge-graph learning system) the body is split into seven
authored phases (`context`, `problem`, `discover`, `reveal`, `practice`,
`connect`, `verify`). Each phase renders as its own card; absent phases get
a "Not yet authored." placeholder so the scaffolding stays visible during
content authoring.

The phase bodies are produced upstream by `splitContentPhases()` in
`@ab/bc-study/server` -- the loader passes the resulting array as the
`phases` prop. This component does not know about the underlying node row;
it only renders the phases the loader hands it.

Per the course-reader-and-editor WP design.md "extract the node-body
renderer to a shared component" decision: copy-paste invites drift; the
extraction lands here so the step reader and the knowledge detail page
stay in lock-step.
-->
<script lang="ts">
import { KNOWLEDGE_PHASE_LABELS, type KnowledgePhase } from '@ab/constants';
import { humanize, renderMarkdown } from '@ab/utils';

export interface NodeBodyPhase {
	/** One of the seven KNOWLEDGE_PHASE values. */
	phase: KnowledgePhase;
	/** Authored markdown for this phase, or null when the phase is empty. */
	body: string | null;
}

interface Props {
	phases: NodeBodyPhase[];
	/** Optional aria-label override; defaults to "Content phases". */
	ariaLabel?: string;
}

let { phases, ariaLabel = 'Content phases' }: Props = $props();

function phaseLabel(phase: string): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase as KnowledgePhase] ?? humanize(phase);
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
