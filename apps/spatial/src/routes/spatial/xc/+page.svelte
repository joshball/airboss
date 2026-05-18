<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>XC Viewer -- airboss spatial</title>
</svelte:head>

<main class="xc-index">
	<header>
		<p class="eyebrow">airboss / spatial</p>
		<h1>XC Viewer</h1>
		<p class="lede">
			Pick a cross-country scenario. Each one walks a route on a sectional --
			airspace, waypoints, weather, and per-leg performance.
		</p>
	</header>

	<ul class="scenario-list">
		{#each data.scenarios as scenario (scenario.slug)}
			<li>
				<a class="scenario-card" href={ROUTES.SPATIAL_XC_SCENARIO(scenario.slug)}>
					<span class="scenario-label">{scenario.label}</span>
					<span class="scenario-slug">{scenario.slug}</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.xc-index {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-md);
	}

	.eyebrow {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	h1 {
		margin: var(--space-2xs) 0 var(--space-sm);
		font-size: var(--font-size-2xl);
	}

	.lede {
		margin: 0 0 var(--space-xl);
		max-width: 42rem;
		color: var(--ink-body);
	}

	.scenario-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-sm);
	}

	.scenario-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}

	.scenario-card:hover {
		border-color: var(--action-default);
	}

	.scenario-label {
		font-size: var(--font-size-lg);
		font-weight: 600;
	}

	.scenario-slug {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-family: var(--font-family-mono, monospace);
	}
</style>
