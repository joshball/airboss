<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { Snippet } from 'svelte';
import { page } from '$app/state';

let { children }: { children: Snippet } = $props();

const loaderActive = $derived(page.url.pathname.startsWith(ROUTES.HANGAR_REVIEW_ADMIN_LOADER));
const bucketsActive = $derived(page.url.pathname.startsWith(ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS));
</script>

<nav class="admin-nav" aria-label="Review admin">
	<a href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS} aria-current={bucketsActive ? 'page' : undefined}>Buckets</a>
	<a href={ROUTES.HANGAR_REVIEW_ADMIN_LOADER} aria-current={loaderActive ? 'page' : undefined}>Loader</a>
</nav>

{@render children()}

<style>
	.admin-nav {
		display: flex;
		gap: var(--space-md);
		padding: var(--space-2xs) 0 var(--space-md);
		border-bottom: 1px solid var(--edge-default);
		margin-bottom: var(--space-md);
	}

	.admin-nav a {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.admin-nav a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.admin-nav a[aria-current='page'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.admin-nav a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
