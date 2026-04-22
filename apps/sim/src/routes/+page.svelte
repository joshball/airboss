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
		padding: 2rem 1.5rem;
	}

	header {
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.75rem;
	}

	.subtitle {
		margin: 0;
		color: var(--ab-color-fg-muted, #666);
	}

	.scenarios h2 {
		margin-bottom: 0.75rem;
		font-size: 1.125rem;
	}

	.scenarios ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	.scenarios li a {
		display: block;
		padding: 1rem 1.25rem;
		border: 1px solid var(--ab-color-border, #ccc);
		border-radius: 6px;
		text-decoration: none;
		color: inherit;
		background: var(--ab-color-surface, #fff);
	}

	.scenarios li a:hover,
	.scenarios li a:focus-visible {
		border-color: var(--ab-color-primary, #2563eb);
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	.scenarios li a strong {
		font-size: 1.05rem;
	}

	.scenarios li a .label {
		font-size: 0.75rem;
		color: var(--ab-color-primary, #2563eb);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.scenarios li a .tagline {
		margin: 0;
		color: var(--ab-color-fg, #111);
		font-size: 0.95rem;
	}

	.scenarios li a .objective {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-muted, #666);
		font-size: 0.85rem;
	}

	.empty {
		color: var(--ab-color-fg-muted, #666);
		font-size: 0.9375rem;
		margin: 0;
	}

	footer {
		margin-top: 3rem;
	}

	.disclaimer {
		font-size: 0.85rem;
		color: var(--ab-color-fg-muted, #666);
	}
</style>
