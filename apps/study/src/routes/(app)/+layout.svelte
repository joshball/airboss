<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<a class="skip" href="#main">Skip to main content</a>

<nav aria-label="Primary">
	<a href={ROUTES.MEMORY}>Memory</a>
	<a href={ROUTES.REPS}>Reps</a>
	<a href={ROUTES.CALIBRATION}>Calibration</a>
</nav>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<style>
	.skip {
		position: absolute;
		top: -3rem;
		left: 0.5rem;
		background: #1a1a2e;
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		z-index: 100;
	}

	.skip:focus {
		top: 0.5rem;
	}

	nav {
		display: flex;
		gap: 1.5rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		background: white;
	}

	nav a {
		color: #475569;
		text-decoration: none;
		font-weight: 500;
	}

	nav a:hover {
		color: #1a1a2e;
	}

	main {
		padding: 1.5rem;
		max-width: 48rem;
		margin: 0 auto;
	}

	main:focus {
		outline: none;
	}
</style>
