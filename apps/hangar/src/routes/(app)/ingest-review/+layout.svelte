<script lang="ts">
import { ROUTES } from '@ab/constants';

interface LayoutProps {
	children: import('svelte').Snippet;
}

const { children }: LayoutProps = $props();
</script>

<div class="ingest-review-layout">
	<header class="page-head">
		<h1>Ingest review</h1>
		<p class="lede">
			Triage the residual issues left by ingest pipelines. Act on a finding to write an
			override; export to YAML so re-extracts honour the decision.
		</p>
		<nav class="crumbs">
			<a href={ROUTES.HANGAR_INGEST_REVIEW}>Queue</a>
		</nav>
	</header>
	{@render children()}
</div>

<style>
	.ingest-review-layout {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-lg);
	}

	.page-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.page-head h1 {
		font-size: var(--type-heading-1-size);
		margin: 0;
	}

	.lede {
		color: var(--ink-muted);
		max-width: 70ch;
		margin: 0;
	}

	.crumbs a {
		color: var(--action-default);
		text-decoration: none;
		font-size: var(--type-ui-caption-size);
	}

	.crumbs a:hover {
		text-decoration: underline;
	}
</style>
