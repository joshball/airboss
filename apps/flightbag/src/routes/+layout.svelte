<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES } from '@ab/constants';
import AppHeader from '@ab/ui/components/AppHeader.svelte';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<!--
	Skip-to-content stays at the layout root (not in AppHeader) so it
	is the first focusable element on the page -- a keyboard user
	reaches it on the very first Tab press, before the brand link.
-->
<a class="skip" href="#main">Skip to main content</a>

<AppHeader app="flightbag" brandHref={ROUTES.FLIGHTBAG_HOME} />

<main id="main" tabindex="-1" class="page">
	{@render children()}
</main>

<style>
	.skip {
		position: absolute;
		top: calc(var(--space-2xl) * -1);
		left: var(--space-sm);
		background: var(--ink-body);
		color: var(--ink-inverse);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		z-index: var(--z-modal);
	}

	.skip:focus {
		top: var(--space-sm);
	}

	.page {
		padding: var(--space-xl);
	}

	main:focus {
		outline: none;
	}
</style>
