<script lang="ts">
import { REVIEW_KINDS, ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review', href: ROUTES.HANGAR_REVIEW },
	{ label: data.kindLabel },
	{ label: data.item.title },
]);

const isWpSpec = $derived(data.kind === REVIEW_KINDS.WP_SPEC);
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>{data.item.title}</h1>
	<p class="meta">
		<span class="kind">{data.kindLabel}</span>
		<span class="ref"><code>{data.item.ref}</code></span>
	</p>
</header>

{#if isWpSpec}
	<!--
		Phase 5 lands the WP-spec view + test-plan walker here. Until that
		commit, the placeholder body keeps clicks from 404-ing while the
		dispatcher route from Phase 4 remains live.
	-->
	<section class="placeholder" aria-labelledby="placeholder-heading">
		<h2 id="placeholder-heading">Spec view -- coming in Phase 5</h2>
		<p>The work-package spec / test-plan walker for this kind ships in Phase 5 of the Hangar Review Queue work package.</p>
		<p>
			In the meantime you can read the source markdown directly:
			<a href={ROUTES.HANGAR_DOCS_PATH(data.item.ref)}>{data.item.ref}</a>.
		</p>
		<p><a href={ROUTES.HANGAR_REVIEW}>Back to the review board</a></p>
	</section>
{:else}
	<section class="placeholder" aria-labelledby="placeholder-heading">
		<h2 id="placeholder-heading">{data.kindLabel} review -- coming in Phase 6</h2>
		<p>
			Per-kind review for <code>{data.kind}</code> items lands in a later phase. The dispatcher route is wired today
			so links from the board don't 404.
		</p>
		<p>
			Source reference: <code>{data.item.ref}</code>
			{#if data.item.ref.endsWith('.md')}
				-- <a href={ROUTES.HANGAR_DOCS_PATH(data.item.ref)}>open in /docs</a>.
			{/if}
		</p>
		<p><a href={ROUTES.HANGAR_REVIEW}>Back to the review board</a></p>
	</section>
{/if}

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.meta {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		margin: 0;
	}

	.kind {
		font-family: var(--font-family-mono);
	}

	.placeholder {
		margin-top: var(--space-lg);
		padding: var(--space-lg);
		background: var(--surface-panel);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.placeholder h2 {
		margin: 0 0 var(--space-sm);
	}

	.placeholder p {
		color: var(--ink-body);
		margin: 0 0 var(--space-sm);
	}

	.placeholder p:last-child {
		margin-bottom: 0;
	}

	.placeholder code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.placeholder a {
		color: var(--link-default);
	}

	.placeholder a:hover {
		color: var(--link-hover);
	}
</style>
