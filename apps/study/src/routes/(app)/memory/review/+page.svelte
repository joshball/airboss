<script lang="ts">
import { ROUTES } from '@ab/constants';
</script>

<svelte:head>
	<title>Review -- airboss</title>
</svelte:head>

<!--
	The server `load` creates a memory_review_session row and redirects to
	`/memory/review/<sessionId>` (review-sessions-url layer a). This markup
	is only reached if the redirect did not fire (e.g. an auth bounce flipped
	to a login redirect first), so it's a plain fallback.
-->
<section class="page">
	<p>Preparing your review...</p>
	<p><a href={ROUTES.MEMORY}>Back to memory</a></p>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-2xl);
		color: var(--ink-muted);
	}
</style>
