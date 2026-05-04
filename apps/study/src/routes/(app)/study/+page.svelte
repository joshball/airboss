<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Study -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Study" subtitle="Where you are. What's next. How you'd like to study it." />

	{#if data.kind === 'no-goal'}
		<article class="banner" aria-labelledby="study-no-goal-h">
			<h2 id="study-no-goal-h">Set a primary goal to personalize your study home</h2>
			<p>
				The study home rolls up progress against the certification you're targeting (Private Pilot,
				Instrument, etc.). Pick a primary goal and the page will show your understood / memorized /
				practiced numbers, today's focus, and a hierarchical map of the cert.
			</p>
			<div class="actions">
				<Button href={ROUTES.GOALS_NEW} variant="primary">Set a primary goal</Button>
			</div>
		</article>
	{:else}
		<article class="banner" aria-labelledby="study-home-h">
			<h2 id="study-home-h">Study home -- coming online</h2>
			<p>
				The study-home work package ships its progress strip, today briefing, tile row, and map of
				the cert across tasks 5-12 of <code>docs/work-packages/study-home/tasks.md</code>. The route
				constants, user-pref store, and Today prose helper landed first; the data composition lands
				next.
			</p>
			<p>Until then, jump into one of the existing surfaces:</p>
			<div class="tiles">
				<a class="tile" href={ROUTES.LIBRARY}>Read</a>
				<a class="tile" href={ROUTES.MEMORY_REVIEW}>Cards</a>
				<a class="tile" href={ROUTES.REPS}>Scenarios</a>
				<a class="tile" href={ROUTES.FLIGHT}>Flight</a>
			</div>
		</article>
	{/if}
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

.tiles {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
	gap: var(--space-md);
}

.tile {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 4rem;
	padding: var(--space-md);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	background: var(--surface-panel);
	color: var(--ink-body);
	text-decoration: none;
	font-weight: var(--font-weight-medium);
}

.tile:hover {
	background: var(--surface-sunken);
	border-color: var(--edge-strong);
}

.tile:focus-visible {
	outline: 2px solid var(--edge-focus);
	outline-offset: 2px;
}

.actions {
	margin-top: var(--space-sm);
}
</style>
