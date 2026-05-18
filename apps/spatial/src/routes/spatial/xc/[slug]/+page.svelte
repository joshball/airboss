<script lang="ts">
import { ROUTES } from '@ab/constants';
import { XcViewer } from '@ab/spatial-ui';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.bundle.label} -- airboss spatial</title>
</svelte:head>

<main class="xc-page">
	<header class="xc-page-header">
		<a class="back-link" href={ROUTES.SPATIAL_XC_INDEX}>&larr; All scenarios</a>
		<h1>{data.bundle.label}</h1>
	</header>

	<div class="xc-page-viewer">
		<XcViewer bundle={data.bundle} />
	</div>
</main>

<style>
	.xc-page {
		max-width: 72rem;
		margin: 0 auto;
		padding: var(--space-lg) var(--space-md);
	}

	.xc-page-header {
		margin-bottom: var(--space-md);
	}

	.back-link {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		text-decoration: none;
	}

	.back-link:hover {
		color: var(--action-default);
	}

	h1 {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-2xl);
	}
</style>
