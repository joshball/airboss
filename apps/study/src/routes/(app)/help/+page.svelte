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
		gap: 1.75rem;
	}

	.hd h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-muted, #64748b);
	}

	.empty {
		border: 1px dashed var(--ab-color-border-strong, #cbd5e1);
		border-radius: 12px;
		padding: 2rem 1.5rem;
		text-align: center;
		color: var(--ab-color-fg-muted, #64748b);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.empty h2 {
		margin: 0;
		font-size: 1.125rem;
		color: var(--ab-color-fg, #0f172a);
	}

	.empty p {
		margin: 0;
		max-width: 38rem;
		line-height: 1.55;
	}

	.empty .hint {
		font-size: 0.875rem;
	}

	.group h2 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ab-color-fg-muted, #64748b);
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.75rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-radius: var(--ab-radius-md, 6px);
		background: var(--ab-color-surface, #ffffff);
		text-decoration: none;
		color: inherit;
	}

	.card:hover {
		border-color: var(--ab-color-primary, #3b82f6);
	}

	.card:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring, #60a5fa);
		outline-offset: 2px;
	}

	.title {
		font-weight: var(--ab-font-weight-semibold, 600);
		font-size: 1rem;
	}

	.summary {
		font-size: 0.875rem;
		color: var(--ab-color-fg-muted, #64748b);
		line-height: 1.45;
	}

	.documents {
		font-size: 0.75rem;
		color: var(--ab-color-fg-subtle, #94a3b8);
	}

	.documents code {
		background: var(--ab-color-surface-sunken, #f1f5f9);
		padding: 0 0.3125rem;
		border-radius: 3px;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
	}

	kbd {
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-bottom-width: 2px;
		border-radius: 3px;
		padding: 0 0.25rem;
		font-size: 0.75rem;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		background: var(--ab-color-surface-sunken, #f1f5f9);
	}
</style>
