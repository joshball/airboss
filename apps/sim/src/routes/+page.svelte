<script lang="ts">
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
const scenarios = $derived(data.scenarios);
</script>

<svelte:head>
	<title>airboss sim -- scenarios</title>
</svelte:head>

<main>
	<PageHeader
		title="Flight Dynamics Sim"
		subtitle="Hand-rolled C172 FDM. Feel the controls, practice the stall recovery, learn by flying."
	/>

	<section class="demos">
		<h2>Demos</h2>
		<ul>
			<li>
				<a href={ROUTES.SIM_GLASS_PFD}>
					<div class="card-head">
						<strong>Glass PFD demo</strong>
						<span class="label">Instruments</span>
					</div>
					<p class="tagline">
						Tape-style primary flight display, sliders + keyboard. Same component avionics ships.
					</p>
				</a>
			</li>
		</ul>
	</section>

	<section class="scenarios">
		<h2>Scenarios</h2>
		{#if scenarios.length === 0}
			<EmptyState title="No scenarios available yet" />
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

	.scenarios h2,
	.demos h2 {
		margin-bottom: var(--space-md);
		font-size: var(--font-size-lg);
	}

	.scenarios ul,
	.demos ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
	}

	.demos {
		margin-bottom: var(--space-xl);
	}

	.scenarios li a,
	.demos li a {
		display: block;
		padding: var(--space-lg) var(--space-xl);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: inherit;
		background: var(--surface-panel);
	}

	.scenarios li a:hover,
	.scenarios li a:focus-visible,
	.demos li a:hover,
	.demos li a:focus-visible {
		border-color: var(--action-default);
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-lg);
		margin-bottom: var(--space-2xs);
	}

	.scenarios li a strong,
	.demos li a strong {
		font-size: var(--font-size-lg);
	}

	.scenarios li a .label,
	.demos li a .label {
		font-size: var(--font-size-xs);
		color: var(--action-default);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.scenarios li a .tagline,
	.demos li a .tagline {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--font-size-body);
	}

	.scenarios li a .objective {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	footer {
		margin-top: calc(var(--space-2xl) * 2);
	}

	.disclaimer {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
</style>
