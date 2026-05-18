<script lang="ts">
import { ROUTES } from '@ab/constants';
</script>

<main class="spatial-home">
	<header>
		<p class="eyebrow">airboss / spatial</p>
		<h1>Spatial</h1>
		<p class="lede">
			The pre-flight planning surface. Route, airport, and airspace products
			compose here. The first product is the XC viewer -- a cross-country
			rehearsal stage that layers geography, flight, and weather.
		</p>
	</header>

	<nav class="cards">
		<a class="card" href={ROUTES.SPATIAL_XC_INDEX}>
			<h2>XC Viewer</h2>
			<p>
				Pick a cross-country scenario and walk the route on a sectional:
				airspace, waypoints, weather, and per-leg performance.
			</p>
		</a>
	</nav>
</main>

<style>
	.spatial-home {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
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
		margin: 0 0 var(--space-2xl);
		max-width: 42rem;
		color: var(--ink-body);
	}

	.cards {
		display: grid;
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
	}

	.card {
		display: block;
		padding: var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}

	.card:hover {
		border-color: var(--action-default);
	}

	.card h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-lg);
	}

	.card p {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
</style>
