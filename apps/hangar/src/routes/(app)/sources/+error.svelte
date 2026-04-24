<script lang="ts">
import { ROUTES } from '@ab/constants';
import { page } from '$app/state';
</script>

<section class="page">
	<h1>Sources unavailable</h1>
	<p class="sub">Something went wrong loading the sources surface.</p>
	<pre class="err">{page.status} -- {page.error?.message ?? 'unknown error'}</pre>
	<p>
		<a href={ROUTES.HANGAR_SOURCES}>Try again</a>
		or <a href={ROUTES.HANGAR_GLOSSARY}>go to glossary</a>.
	</p>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding-top: var(--space-xl);
		padding-bottom: var(--space-2xl);
		max-width: 36rem;
	}

	h1 {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-heading-1-size);
	}

	.sub {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.err {
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		overflow-x: auto;
		margin: 0;
	}

	p a {
		color: var(--link-default);
	}
</style>
