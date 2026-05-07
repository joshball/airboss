<script lang="ts">
/**
 * `/roadmap/[wp_id]` -- WP detail page. Renders header metadata + a tabbed
 * sub-doc view + a dependency / PR / mutation-hint sidebar.
 *
 * The active tab is reflected in the URL (`?tab=spec`) so a deep link from
 * a review summary or chat message lands on the right pane. Tab change
 * emits a SvelteKit shallow navigation so back / forward step through tabs.
 */

import { ROADMAP_QUERY_PARAMS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import Tabs, { type TabItem } from '@ab/ui/components/Tabs.svelte';
import { goto } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// `activeTabId` widens the discriminated `WpSubDocKey` to `string` because
// `<Tabs bind:active>` accepts any string id. The server load already
// validated `data.activeTab` against the panel keys, so casting here is
// safe; runtime guards would be redundant. Init runs through a function
// so Svelte's "state_referenced_locally" check accepts the one-shot read.
let activeTabId = $state<string>(initialTab());
function initialTab(): string {
	return data.activeTab;
}

const tabs = $derived<readonly TabItem[]>(data.panels.map((p) => ({ id: p.key, label: p.label })));
const activePanel = $derived(data.panels.find((p) => p.key === activeTabId));

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Roadmap', href: ROUTES.HANGAR_ROADMAP },
	{ label: data.frontmatter?.title ?? data.id },
]);

function statusPillState(status: string | null): string {
	if (status === null) return 'unknown';
	return status;
}

// Keep the URL `?tab=` in sync with the bound tab id. `replaceState` so
// flipping tabs doesn't pollute the browser back-stack with one entry per
// tab. Skipped when the URL already matches (e.g. on initial mount, where
// `data.activeTab` came FROM `?tab=`).
$effect(() => {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	if (url.searchParams.get(ROADMAP_QUERY_PARAMS.TAB) === activeTabId) return;
	url.searchParams.set(ROADMAP_QUERY_PARAMS.TAB, activeTabId);
	void goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
});
</script>

<svelte:head>
	<title>{data.frontmatter?.title ?? data.id} - Roadmap</title>
</svelte:head>

<div class="detail">
	<Breadcrumbs items={crumbs} />

	<header class="hero">
		<div class="hero-title">
			<h1>{data.frontmatter?.title ?? data.id}</h1>
			<PageHelp pageId="roadmap" />
		</div>
		<code class="hero-id">{data.id}</code>
		<dl class="badges">
			{#if data.frontmatter}
				<div>
					<dt>Status</dt>
					<dd><span class="pill" data-state={statusPillState(data.frontmatter.status)}>{data.frontmatter.status}</span></dd>
				</div>
				<div>
					<dt>Product</dt>
					<dd>{data.frontmatter.product}</dd>
				</div>
				<div>
					<dt>Category</dt>
					<dd>{data.frontmatter.category}</dd>
				</div>
				<div>
					<dt>Agent review</dt>
					<dd><span class="pill" data-state={data.frontmatter.agent_review_status}>{data.frontmatter.agent_review_status}</span></dd>
				</div>
				<div>
					<dt>Human review</dt>
					<dd><span class="pill" data-state={data.frontmatter.human_review_status}>{data.frontmatter.human_review_status}</span></dd>
				</div>
				<div>
					<dt>Created</dt>
					<dd>{data.frontmatter.created}</dd>
				</div>
				{#if data.frontmatter.shipped_date}
					<div>
						<dt>Shipped</dt>
						<dd>{data.frontmatter.shipped_date}</dd>
					</div>
				{/if}
				{#if data.frontmatter.owner}
					<div>
						<dt>Owner</dt>
						<dd>{data.frontmatter.owner}</dd>
					</div>
				{/if}
			{/if}
		</dl>
	</header>

	{#if data.validationErrors.length > 0}
		<aside class="errors" aria-label="Validation errors">
			<h2>Validation errors</h2>
			<ul>
				{#each data.validationErrors as err (err.field + err.message)}
					<li>
						<code>{err.field}</code>: {err.message}
					</li>
				{/each}
			</ul>
		</aside>
	{/if}

	<div class="layout">
		<section class="panels" aria-label="Sub-doc tabs">
			{#if data.panels.length === 0}
				<p class="empty">No sub-docs (spec.md / tasks.md / test-plan.md / design.md / user-stories.md) on disk.</p>
			{:else}
				<Tabs {tabs} bind:active={activeTabId} ariaLabel="Work-package documents">
					{#snippet panel(_id: string)}
						{#if activePanel}
							<MarkdownArticle bodyHtml={activePanel.bodyHtml} ariaLabel={activePanel.label} />
						{/if}
					{/snippet}
				</Tabs>
			{/if}
		</section>

		<aside class="sidebar" aria-label="Sidebar">
			{#if data.frontmatter?.tags && data.frontmatter.tags.length > 0}
				<section>
					<h3>Tags</h3>
					<ul class="taglist">
						{#each data.frontmatter.tags as tag (tag)}
							<li><span class="pill">{tag}</span></li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.dependsOn.length > 0}
				<section>
					<h3>Depends on</h3>
					<ul class="linklist">
						{#each data.dependsOn as dep (dep.id)}
							<li>
								{#if dep.exists}
									<a href={ROUTES.HANGAR_ROADMAP_DETAIL(dep.id)}>{dep.id}</a>
									{#if dep.status}
										<span class="pill" data-state={statusPillState(dep.status)}>{dep.status}</span>
									{/if}
								{:else}
									<span class="missing">{dep.id}</span>
									<span class="pill" data-state="error">missing</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.unblocks.length > 0}
				<section>
					<h3>Unblocks</h3>
					<ul class="linklist">
						{#each data.unblocks as dep (dep.id)}
							<li>
								{#if dep.exists}
									<a href={ROUTES.HANGAR_ROADMAP_DETAIL(dep.id)}>{dep.id}</a>
									{#if dep.status}
										<span class="pill" data-state={statusPillState(dep.status)}>{dep.status}</span>
									{/if}
								{:else}
									<span class="missing">{dep.id}</span>
									<span class="pill" data-state="error">missing</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.shippedPrs.length > 0}
				<section>
					<h3>Shipped PRs</h3>
					<ul class="linklist">
						{#each data.shippedPrs as pr (pr.number)}
							<li>
								<a href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number}</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="raw-link">
				<h3>Raw</h3>
				<a href={ROUTES.HANGAR_ROADMAP_RAW(data.id)}>JSON dump</a>
			</section>
		</aside>
	</div>

	<footer class="mutate-hint">
		<h3>Mutate</h3>
		<p>
			This view is read-only. Update frontmatter via:
		</p>
		<pre><code>{data.mutateCommand}</code></pre>
		<p>
			Allowed fields: <code>status</code>, <code>agent_review_status</code>, <code>shipped_prs</code>,
			<code>shipped_date</code>, <code>tags</code>. <code>human_review_status</code> is user-only and lint-rejected for
			agents. See
			<a href={ROUTES.HANGAR_DOCS_PATH('docs/decisions/025-wp-frontmatter-contract/decision.md')}>ADR 025</a>.
		</p>
	</footer>
</div>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.hero h1 {
		margin: 0;
	}

	.hero-title {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.hero-id {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		color: var(--ink-muted);
	}

	.badges {
		margin: var(--space-sm) 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-sm);
	}

	.badges div {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.badges dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badges dd {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.errors {
		border: 1px solid var(--signal-warning-edge, var(--edge-default));
		background: var(--signal-warning-wash);
		padding: var(--space-md);
		border-radius: var(--radius-md);
	}

	.errors h2 {
		margin: 0 0 var(--space-xs);
		font-size: var(--type-ui-section-size, 1.125rem);
		color: var(--signal-warning-ink);
	}

	.errors ul {
		margin: 0;
		padding-left: var(--space-md);
	}

	.errors code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
		gap: var(--space-xl);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.panels {
		min-width: 0;
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		border-left: 1px solid var(--edge-default);
		padding-left: var(--space-md);
	}

	.sidebar h3 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.sidebar ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.taglist {
		flex-direction: row;
		flex-wrap: wrap;
	}

	.linklist li {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.linklist a {
		color: var(--link-default);
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		text-decoration: none;
	}

	.linklist a:hover {
		text-decoration: underline;
	}

	.missing {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		color: var(--ink-muted);
		text-decoration: line-through;
	}

	.raw-link a {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		color: var(--link-default);
	}

	.pill {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.pill[data-state='shipped'],
	.pill[data-state='done'],
	.pill[data-state='signed-off'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.pill[data-state='in-flight'],
	.pill[data-state='walked'] {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.pill[data-state='draft'],
	.pill[data-state='pending'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.pill[data-state='abandoned'],
	.pill[data-state='superseded'],
	.pill[data-state='error'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
	}

	.mutate-hint {
		border-top: 1px solid var(--edge-default);
		padding-top: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.mutate-hint h3 {
		margin: 0;
		font-size: var(--type-ui-section-size, 1.125rem);
	}

	.mutate-hint pre {
		margin: 0;
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		overflow-x: auto;
	}

	.mutate-hint code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.mutate-hint p {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}
</style>
