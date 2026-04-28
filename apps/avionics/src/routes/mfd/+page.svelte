<script lang="ts">
import { ROUTES } from '@ab/constants';
</script>

<svelte:head>
	<title>airboss avionics -- MFD</title>
</svelte:head>

<main>
	<header>
		<h1>Multi-Function Display</h1>
		<p class="subtitle">
			The right side of the glass panel. Coming soon.
		</p>
	</header>

	<section>
		<p>
			On a typical glass cockpit the Primary Flight Display owns the centre of
			the pilot's scan -- attitude, airspeed, altitude, heading, vertical
			speed. The Multi-Function Display sits next to it and carries every
			other piece of context the pilot needs in flight: a moving map of where
			the aircraft is, who else is in the airspace, what the weather is doing
			along the route, and the health of the engine and electrical system.
		</p>
		<p>
			The MFD complements the PFD by widening the situational picture without
			cluttering the primary scan. Anything that does not belong on a
			six-instrument cross-check belongs on the MFD.
		</p>
	</section>

	<section class="coming-soon">
		<h2>Coming soon</h2>
		<ul>
			<li>
				<strong>Map page.</strong> A moving map driven by the same flight
				dynamics model that powers the PFD: route, waypoints, range rings.
			</li>
			<li>
				<strong>Traffic.</strong> ADS-B-style returns layered on the map so the
				learner practises naming and reacting to nearby aircraft.
			</li>
			<li>
				<strong>Weather.</strong> METAR/TAF callouts, NEXRAD overlay, and
				learner drills on the difference between current and forecast
				conditions.
			</li>
			<li>
				<strong>System pages.</strong> Engine cluster, fuel, electrical -- the
				readouts that move from round dials to soft pages on a glass surface.
			</li>
		</ul>
	</section>

	<footer>
		<a href={ROUTES.AVIONICS_HOME}>Back to avionics</a>
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

	section {
		margin-bottom: var(--space-2xl);
	}

	section p {
		margin: 0 0 var(--space-md) 0;
		color: var(--ink-body);
		font-size: var(--font-size-body);
		line-height: var(--line-height-normal);
	}

	.coming-soon h2 {
		margin: 0 0 var(--space-md) 0;
		font-size: var(--font-size-lg);
	}

	.coming-soon ul {
		margin: 0;
		padding-left: var(--space-lg);
		display: grid;
		gap: var(--space-sm);
	}

	.coming-soon li {
		color: var(--ink-body);
		font-size: var(--font-size-body);
		line-height: var(--line-height-normal);
	}

	footer {
		margin-top: var(--space-2xl);
	}

	footer a {
		color: var(--action-default);
		text-decoration: none;
	}

	footer a:hover,
	footer a:focus-visible {
		text-decoration: underline;
	}
</style>
