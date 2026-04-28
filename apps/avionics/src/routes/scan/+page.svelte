<script lang="ts">
import { ROUTES } from '@ab/constants';
</script>

<svelte:head>
	<title>airboss avionics -- scan</title>
</svelte:head>

<main>
	<header>
		<h1>Instrument Scan</h1>
		<p class="subtitle">
			Drill the cross-check sweep. Coming soon.
		</p>
	</header>

	<section>
		<p>
			Instrument flying lives or dies on the scan. The pilot sweeps the six
			primary instruments in a disciplined pattern, returns to the attitude
			indicator between each one, and catches a divergence before it grows
			into a problem. The pattern is mechanical at first; with practice it
			becomes a trained reflex.
		</p>
		<p>
			A glass cockpit changes the scan. The same six values are still in
			play, but they are arranged into tapes around a single attitude
			indicator instead of six round dials. The eye travels less distance,
			the bracketing logic is the same, and the failure modes look different.
			The scan trainer for the glass surface needs to teach the new pattern,
			not borrow the round-dial one.
		</p>
	</section>

	<section class="coming-soon">
		<h2>Coming soon</h2>
		<ul>
			<li>
				<strong>Target dwell.</strong> Each sweep of the scan is timed; the
				drill flags long fixations on one instrument and rewards quick
				returns to the attitude indicator.
			</li>
			<li>
				<strong>Sequence checks.</strong> The drill enforces a working
				cross-check order so the learner does not skip an instrument and
				lose the bracket.
			</li>
			<li>
				<strong>Calibration to learner pace.</strong> Targets adapt to the
				individual pilot's baseline so the drill stays in the
				challenging-but-achievable band, not punishingly fast on day one or
				too easy after the tenth attempt.
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
