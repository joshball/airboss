<script lang="ts">
import { ROUTES } from '@ab/constants';

interface AvionicsCard {
	href: string;
	heading: string;
	description: string;
}

// Card order is deliberate: PFD is the headline demo, MFD/Scan are the
// next products in the surface family, Aircraft is the small piece of
// learner-state the surface holds. Copy is final-draft per spec.md.
const cards: readonly AvionicsCard[] = [
	{
		href: ROUTES.AVIONICS_PFD,
		heading: 'Primary Flight Display',
		description: 'Glass PFD demo: attitude, airspeed tape, altitude tape, heading, VSI. Drive by slider.',
	},
	{
		href: ROUTES.AVIONICS_MFD,
		heading: 'Multi-Function Display',
		description: 'Coming soon. Map page, traffic, weather, system pages -- the right side of the panel.',
	},
	{
		href: ROUTES.AVIONICS_SCAN,
		heading: 'Instrument Scan',
		description: 'Coming soon. Drill the cross-check sweep across the six instruments.',
	},
	{
		href: ROUTES.AVIONICS_AIRCRAFT,
		heading: 'Aircraft',
		description: 'Pick the aircraft the avionics surface is configured for. Currently: C172.',
	},
];
</script>

<svelte:head>
	<title>airboss avionics</title>
</svelte:head>

<main>
	<header>
		<h1>Avionics</h1>
		<p class="subtitle">
			Glass-cockpit trainer. Learn the panel before you fly the panel.
		</p>
	</header>

	<section class="surface" aria-label="Avionics demos">
		<ul class="grid">
			{#each cards as card (card.href)}
				<li>
					<a href={card.href}>
						<strong>{card.heading}</strong>
						<p class="description">{card.description}</p>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</main>

<style>
	main {
		max-width: 960px;
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

	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-md);
	}

	.grid li a {
		display: block;
		padding: var(--space-lg) var(--space-xl);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: inherit;
		background: var(--surface-panel);
		height: 100%;
	}

	.grid li a:hover,
	.grid li a:focus-visible {
		border-color: var(--action-default);
	}

	.grid li a strong {
		display: block;
		font-size: var(--font-size-lg);
		margin-bottom: var(--space-2xs);
	}

	.description {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-body);
	}
</style>
