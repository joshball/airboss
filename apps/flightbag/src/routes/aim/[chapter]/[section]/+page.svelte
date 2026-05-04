<script lang="ts">
import { ROUTES } from '@ab/constants';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>AIM §{data.section.code} -- {data.section.title}</title>
</svelte:head>

<Breadcrumbs
	segments={[
		{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
		{ label: data.reference.title, href: data.links.aimHref },
		{ label: `Chapter ${data.section.code.split('-')[0]}`, href: data.links.chapterHref },
		{ label: `§${data.section.code}`, href: null },
	]}
/>

<SourceLinks
	localPdfHref={data.sourceLinks.localPdfHref}
	onlineUrl={data.sourceLinks.onlineUrl}
	localPdfMissing={data.sourceLinks.localPdfMissing}
/>

<header class="page-header">
	<h1>§{data.section.code} -- {data.section.title}</h1>
</header>

{#if data.paragraphs.length === 0}
	<p class="empty">No paragraphs seeded under this section.</p>
{:else}
	<section aria-label="Paragraphs">
		<h2>Paragraphs</h2>
		<ol class="paragraphs">
			{#each data.paragraphs as paragraph (paragraph.id)}
				<li>
					<a href={paragraph.href}>
						<span class="para-code">¶{paragraph.code}</span>
						<span class="para-title">{paragraph.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.page-header h1 {
		margin: 0 0 var(--space-xs);
	}
	.paragraphs {
		list-style: none;
		padding: 0;
		margin: var(--space-sm) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.paragraphs a {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
	}
	.paragraphs a:hover,
	.paragraphs a:focus-visible {
		border-color: var(--action-default-edge);
	}
	.para-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 5rem;
	}
	.empty {
		color: var(--ink-muted);
		font-style: italic;
	}
</style>
