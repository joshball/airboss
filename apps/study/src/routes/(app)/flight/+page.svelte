<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>Flight -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Flight" subtitle="Logging flights -- coming in WP 2." />

	<article class="banner" aria-labelledby="flight-placeholder-h">
		<h2 id="flight-placeholder-h">Flight evidence lands in WP 2</h2>
		<p>
			This surface is reserved for the upcoming
			<code>flight-evidence-and-cfi-feedback</code>
			work package. It will ingest flight logs, surface CFI feedback, and roll up Practiced-pill
			evidence on the study-home map.
		</p>
		<p>
			For now, head back to the study home and use one of the other study modes (read, cards,
			scenarios, sim).
		</p>
		<div class="actions">
			<Button href={ROUTES.STUDY} variant="primary">Back to study</Button>
		</div>
	</article>
</section>

<style>
.page {
	display: flex;
	flex-direction: column;
	gap: var(--space-lg);
}

.banner {
	border: 1px solid var(--edge-strong);
	border-radius: var(--radius-md);
	padding: var(--space-xl);
	background: var(--surface-raised);
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
	max-width: 60ch;
}

.banner h2 {
	margin: 0;
	font-size: var(--font-size-lg);
}

.banner p {
	margin: 0;
	color: var(--ink-muted);
}

.banner code {
	font-family: var(--font-family-mono);
	background: var(--surface-sunken);
	padding: 0 var(--space-2xs);
	border-radius: var(--radius-sm);
	color: var(--ink-body);
}

.actions {
	margin-top: var(--space-sm);
}
</style>
