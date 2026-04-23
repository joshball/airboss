<script lang="ts">
import { APP_SURFACE_LABELS, APP_SURFACE_VALUES, type AppSurface, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const grouped = $derived(groupBySurface(data.pages));

function groupBySurface(
	pages: readonly HelpPage[],
): ReadonlyArray<{ surface: AppSurface; pages: readonly HelpPage[] }> {
	const buckets = new Map<AppSurface, HelpPage[]>();
	for (const page of pages) {
		const primary = page.tags.appSurface[0];
		if (!primary) continue;
		const bucket = buckets.get(primary);
		if (bucket) bucket.push(page);
		else buckets.set(primary, [page]);
	}
	// Preserve the declared surface order from constants.
	return APP_SURFACE_VALUES.filter((s) => buckets.has(s)).map((surface) => ({
		surface,
		pages: buckets.get(surface) ?? [],
	}));
}
</script>

<svelte:head>
	<title>Help -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>Help</h1>
		<p class="sub">
			How airboss works, and how to get the most out of it. {data.pages.length}
			page{data.pages.length === 1 ? '' : 's'}.
		</p>
	</header>

	{#if data.pages.length === 0}
		<div class="empty">
			<h2>No help pages yet</h2>
			<p>
				The help library is live but no authored content has been registered. Phase 2 of the help-library work
				package (wp-help-library-content) ships the seven first-pass pages.
			</p>
			<p class="hint">
				Search still works for the aviation reference library -- press <kbd>/</kbd> or <kbd>Cmd+K</kbd>.
			</p>
		</div>
	{:else}
		{#each grouped as group (group.surface)}
			<section class="group" aria-labelledby={`group-${group.surface}`}>
				<h2 id={`group-${group.surface}`}>{APP_SURFACE_LABELS[group.surface]}</h2>
				<ul class="cards">
					{#each group.pages as page (page.id)}
						<li>
							<a href={ROUTES.HELP_ID(page.id)} class="card">
								<span class="title">{page.title}</span>
								<span class="summary">{page.summary}</span>
								{#if page.documents}
									<span class="documents">Opens at <code>{page.documents}</code></span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
	}

	.empty {
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl) var(--space-xl);
		text-align: center;
		color: var(--ink-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.empty h2 {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
	}

	.empty p {
		margin: 0;
		max-width: 38rem;
		line-height: 1.55;
	}

	.empty .hint {
		font-size: var(--type-ui-label-size);
	}

	.group h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-reading-body-size);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-md);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md, 6px);
		background: var(--surface-panel);
		text-decoration: none;
		color: inherit;
	}

	.card:hover {
		border-color: var(--action-default);
	}

	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.title {
		font-weight: var(--type-heading-3-weight, 600);
		font-size: var(--type-reading-body-size);
	}

	.summary {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		line-height: 1.45;
	}

	.documents {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
	}

	.documents code {
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono, ui-monospace, monospace);
	}

	kbd {
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono, ui-monospace, monospace);
		background: var(--surface-sunken);
	}
</style>
