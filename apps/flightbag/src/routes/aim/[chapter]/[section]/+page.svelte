<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>AIM §{data.section.code} -- {data.section.title}</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="crumbs">
	<a href={ROUTES.FLIGHTBAG_HOME}>Flightbag</a> &raquo;
	<a href={data.links.aimHref}>{data.reference.title}</a> &raquo;
	<a href={data.links.chapterHref}>Chapter {data.section.code.split('-')[0]}</a> &raquo;
	<span>§{data.section.code}</span>
</nav>

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
	.crumbs {
		color: var(--ink-muted);
		margin-bottom: var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.crumbs a {
		color: inherit;
	}
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
