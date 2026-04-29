<script lang="ts">
import Pfd from '@ab/activities/pfd/Pfd.svelte';
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>airboss sim -- Glass PFD</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={ROUTES.SIM_HOME}>&larr; Scenarios</a>
		<h1>Glass PFD demo</h1>
		<p class="subtitle">
			Tape-style primary flight display, driven by sliders + keyboard. Same component the avionics surface ships;
			rendered here under sim's locked dark theme to verify portability.
		</p>
	</header>

	<section class="pfd">
		<Pfd selectedAircraftId={data.selectedAircraftId} />
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: calc(100vh - 4rem);
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
		gap: var(--space-xl);
	}

	header h1 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-2xl);
	}

	.back {
		display: inline-block;
		margin-bottom: var(--space-md);
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}

	.back:hover,
	.back:focus-visible {
		color: var(--action-default);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}

	.pfd {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
</style>
