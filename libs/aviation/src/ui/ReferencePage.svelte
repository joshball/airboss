<script lang="ts">
import type { Reference } from '../schema/reference';
import ReferenceCard from './ReferenceCard.svelte';
import ReferenceFilter from './ReferenceFilter.svelte';
import ReferenceSidebar from './ReferenceSidebar.svelte';

/**
 * /glossary index page layout. Composes ReferenceFilter + ReferenceSidebar
 * + a card grid of references.
 *
 * Phase 1 ships no references, so this renders an empty state by default.
 * When Phase 2 populates `@ab/aviation/src/references/aviation.ts`, this
 * component continues to work without changes.
 */

let {
	references,
	counts,
	initialSearch = '',
}: {
	references: readonly Reference[];
	counts: {
		sourceType: Readonly<Record<string, number>>;
		aviationTopic: Readonly<Record<string, number>>;
		flightRules: Readonly<Record<string, number>>;
		knowledgeKind: Readonly<Record<string, number>>;
		phaseOfFlight: Readonly<Record<string, number>>;
		certApplicability: Readonly<Record<string, number>>;
	};
	initialSearch?: string;
} = $props();

const total = $derived(references.length);
</script>

<section class="page">
	<header class="hd">
		<div>
			<h1>Glossary</h1>
			<p class="sub">
				Aviation references: CFRs, AIM entries, POH excerpts, and hand-authored explainers. {total} entr{total === 1 ? 'y' : 'ies'}.
			</p>
		</div>
		<ReferenceFilter initial={initialSearch} />
	</header>

	<div class="layout">
		<ReferenceSidebar {counts} />

		<div class="grid">
			{#if total === 0}
				<div class="empty">
					<h2>No references yet</h2>
					<p>
						This is Phase 1 of the reference system. Schema, wiki-link parser, and UI primitives are live; content
						lands in Phase 2 (the 175-entry port from airboss-firc).
					</p>
					<p class="hint">
						In the meantime, authors can use <code>[[display::id]]</code> wiki-links in knowledge content -- the build
						gate warns on TBD-id links and fails on broken ones.
					</p>
				</div>
			{:else}
				<ul class="cards">
					{#each references as reference (reference.id)}
						<li>
							<ReferenceCard {reference} />
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.hd h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-muted);
		font-size: 0.9375rem;
	}

	.layout {
		display: grid;
		grid-template-columns: 14rem 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	.grid {
		min-width: 0;
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.75rem;
	}

	.empty {
		background: var(--ab-color-surface, white);
		border: 1px dashed var(--ab-color-border-strong);
		border-radius: var(--ab-radius-xl);
		padding: 2.5rem 1.5rem;
		text-align: center;
		color: var(--ab-color-fg-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.empty h2 {
		margin: 0;
		font-size: 1.125rem;
		color: var(--ab-color-fg);
	}

	.empty p {
		margin: 0;
		max-width: 38rem;
		line-height: 1.5;
	}

	.empty .hint {
		font-size: 0.875rem;
		color: var(--ab-color-fg-subtle);
	}

	code {
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		font-size: 0.8125rem;
		background: var(--ab-color-surface-sunken);
		padding: 0.0625rem 0.375rem;
		border-radius: var(--ab-radius-tight);
	}

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
