<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES } from '@ab/constants';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<header class="flightbag-chrome">
	<a class="brand" href={ROUTES.FLIGHTBAG_HOME}>airboss / flightbag</a>
</header>

<main class="page">
	{@render children()}
</main>

<style>
	.flightbag-chrome {
		display: flex;
		align-items: center;
		gap: var(--space-lg);
		padding: var(--space-sm) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.brand {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		letter-spacing: var(--letter-spacing-wide);
		text-decoration: none;
	}

	.page {
		padding: var(--space-xl);
	}
</style>
