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
		<p class="subtitle">Phase 0 prototype -- hand-rolled C172 FDM, three instruments, one scenario.</p>
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
							<strong>{scenario.title}</strong>
							<span class="objective">{scenario.objective}</span>
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
		max-width: 640px;
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
		gap: 0.5rem;
	}

	.scenarios li a {
		display: block;
		padding: 0.75rem 1rem;
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

	.scenarios li a strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.scenarios li a .objective {
		color: var(--ab-color-fg-muted, #666);
		font-size: 0.9rem;
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
