<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
const scenarios = $derived(data.scenarios);
</script>

<svelte:head>
	<title>airboss sim -- scenarios</title>
</svelte:head>

<main>
	<header>
		<h1>Flight Dynamics Sim</h1>
		<p class="subtitle">
			Hand-rolled C172 FDM. Feel the controls, practice the stall recovery, learn by flying.
		</p>
	</header>

	<section class="scenarios">
		<h2>Scenarios</h2>
		{#if scenarios.length === 0}
			<p class="empty">No scenarios available yet.</p>
		{:else}
			<ul>
				{#each scenarios as scenario (scenario.id)}
					<li>
						<a href={ROUTES.SIM_SCENARIO(scenario.id)}>
							<div class="card-head">
								<strong>{scenario.title}</strong>
								<span class="label">{scenario.recommendationLabel}</span>
							</div>
							<p class="tagline">{scenario.tagline}</p>
							<p class="objective">{scenario.objective}</p>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<footer>
		<p class="disclaimer">
			Throwaway prototype. Not an FAA-approved ATD. For UX validation only.
		</p>
	</footer>
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
	}

	header {
		margin-bottom: var(--space-2xl);
	}

	h1 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-2xl);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}

	.scenarios h2 {
		margin-bottom: var(--space-md);
		font-size: var(--font-size-lg);
	}

	.scenarios ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
	}

	.scenarios li a {
		display: block;
		padding: var(--space-lg) var(--space-xl);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: inherit;
		background: var(--surface-panel);
	}

	.scenarios li a:hover,
	.scenarios li a:focus-visible {
		border-color: var(--action-default);
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-lg);
		margin-bottom: var(--space-2xs);
	}

	.scenarios li a strong {
		font-size: var(--font-size-lg);
	}

	.scenarios li a .label {
		font-size: var(--font-size-xs);
		color: var(--action-default);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.scenarios li a .tagline {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--font-size-body);
	}

	.scenarios li a .objective {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.empty {
		color: var(--ink-muted);
		font-size: var(--font-size-body);
		margin: 0;
	}

	footer {
		margin-top: calc(var(--space-2xl) * 2);
	}

	.disclaimer {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
</style>
