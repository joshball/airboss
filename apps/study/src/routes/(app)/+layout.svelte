<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { Snippet } from 'svelte';
import { page } from '$app/state';

let { children }: { children: Snippet } = $props();

const memoryActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY));
const repsActive = $derived(page.url.pathname.startsWith(ROUTES.REPS));
</script>

<a class="skip" href="#main">Skip to main content</a>

<nav aria-label="Primary">
	<a href={ROUTES.MEMORY} aria-current={memoryActive ? 'page' : undefined}>Memory</a>
	<a href={ROUTES.REPS} aria-current={repsActive ? 'page' : undefined}>Reps</a>
	<!-- Calibration lands in a subsequent work package; leaving it out of
	     the nav until that route exists. -->
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
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
	}

	nav a:hover {
		color: #1a1a2e;
		background: #f1f5f9;
	}

	nav a[aria-current='page'] {
		color: #1d4ed8;
		background: #eff6ff;
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
