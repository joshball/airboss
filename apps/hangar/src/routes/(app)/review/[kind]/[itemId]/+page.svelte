<script lang="ts">
import { REVIEW_KINDS, REVIEW_WP_SPEC_TAB_PARAM, ROUTES, type WpSpecTabId } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import Tabs from '@ab/ui/components/Tabs.svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: data.kindLabel },
	{ label: data.item.title },
]);

// Tab state: hydrate from the URL once on mount; subsequent changes are
// driven by the user clicking tabs (which we then push back into the URL via
// the $effect below). The page is read-once during load so the URL param
// only matters at first paint.
let activeTab = $state<WpSpecTabId>(parseInitialTab(page.url.searchParams.get(REVIEW_WP_SPEC_TAB_PARAM)));
let savingMarkRead = $state(false);
let savingFlip = $state(false);
let confirmFlip = $state(false);
let toast = $state<{ kind: 'success' | 'error'; message: string } | null>(null);
let liveAnnounce = $state('');

function parseInitialTab(value: string | null): WpSpecTabId {
	const ids: ReadonlyArray<WpSpecTabId> = ['spec', 'tasks', 'test-plan', 'design', 'user-stories', 'review'];
	if (value !== null && (ids as readonly string[]).includes(value)) return value as WpSpecTabId;
	return 'spec';
}

const tabItems = $derived(
	data.view === 'wp_spec' ? data.tabs.map((t) => ({ id: t.id, label: t.present ? t.label : `${t.label} (none)` })) : [],
);

const tabsById = $derived(data.view === 'wp_spec' ? new Map(data.tabs.map((t) => [t.id, t] as const)) : new Map());

function dismissToast() {
	toast = null;
}

// URL persistence: keep the active tab in `?tab=...` so reload + share-link
// land back on the same content.
$effect(() => {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	if (activeTab === 'spec') url.searchParams.delete(REVIEW_WP_SPEC_TAB_PARAM);
	else url.searchParams.set(REVIEW_WP_SPEC_TAB_PARAM, activeTab);
	const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ''}`;
	if (next !== window.location.pathname + window.location.search) {
		window.history.replaceState(window.history.state, '', next);
	}
});

// Surface action results into the dismissable toast surface + live region.
$effect(() => {
	if (!form) return;
	const markValue = 'markSpecRead' in form ? form.markSpecRead : undefined;
	if (markValue === 'ok') {
		toast = { kind: 'success', message: 'Spec marked as read.' };
		liveAnnounce = 'Spec marked as read.';
	} else if (typeof markValue === 'string') {
		toast = { kind: 'error', message: markValue };
		liveAnnounce = `Mark as read failed: ${markValue}`;
	}
	const flipValue = 'flipReviewStatus' in form ? form.flipReviewStatus : undefined;
	if (flipValue === 'ok') {
		toast = { kind: 'success', message: 'review_status flipped to done.' };
		liveAnnounce = 'Review status flipped to done.';
	} else if (typeof flipValue === 'string') {
		toast = { kind: 'error', message: flipValue };
		liveAnnounce = `Flip failed: ${flipValue}`;
	}
});

const walkerHref = $derived(data.view === 'wp_spec' ? ROUTES.HANGAR_REVIEW_WALKER(data.kind, data.item.id) : '');
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>{data.item.title}</h1>
	<p class="meta">
		<span class="kind">{data.kindLabel}</span>
		<span class="ref"><code>{data.item.ref}</code></span>
	</p>
</header>

<!-- Polite live region: action result announcements for AT users. -->
<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>

{#if toast}
	<div class="toast" class:toast-error={toast.kind === 'error'} role="status">
		<span>{toast.message}</span>
		<button type="button" class="dismiss" aria-label="Dismiss" onclick={dismissToast}>×</button>
	</div>
{/if}

{#if data.view === 'wp_spec'}
	<div class="layout">
		<section class="content" aria-label="Work-package documents">
			<Tabs tabs={tabItems} bind:active={activeTab} ariaLabel="Work-package tabs">
				{#snippet panel(tabId)}
					{@const tab = tabsById.get(tabId)}
					{#if tab && tab.present && tab.bodyHtml !== null}
						{#if tab.frontmatter.length > 0}
							<aside class="frontmatter" aria-label="Frontmatter">
								<h2 class="visually-hidden">Frontmatter</h2>
								<dl>
									{#each tab.frontmatter as entry (entry.key)}
										<div class="fm-row">
											<dt>{entry.key}</dt>
											<dd>{entry.value}</dd>
										</div>
									{/each}
								</dl>
							</aside>
						{/if}
						<MarkdownArticle bodyHtml={tab.bodyHtml} ariaLabel={tab.label} />
					{:else if tab}
						<p class="missing">
							<code>{tab.file}</code> is not present for this work package.
						</p>
					{/if}
				{/snippet}
			</Tabs>
		</section>

		<aside class="sidebar" aria-label="Review status">
			<section class="card">
				<h2>Walker</h2>
				{#if data.walker.hasPlan}
					<p class="walker-progress">
						<strong>{data.walker.recordedSteps}</strong> of {data.walker.stepCount} steps recorded
						{#if data.walker.recordedSteps > 0}
							<span class="walker-detail">
								({data.walker.passCount} pass / {data.walker.failCount} fail / {data.walker.blockedCount} blocked)
							</span>
						{/if}
					</p>
					<a class="walker-link" href={walkerHref}>
						{data.walker.openSessionId !== null ? 'Resume walker' : 'Open test-plan walker'}
					</a>
				{:else}
					<p class="muted">No <code>test-plan.md</code> for this work package.</p>
				{/if}
			</section>

			<section class="card">
				<h2>Sessions</h2>
				{#if data.sessions.length === 0}
					<p class="muted">No sessions yet.</p>
				{:else}
					<ul class="session-list">
						{#each data.sessions as session (session.id)}
							<li class="session">
								<span class="session-when">{new Date(session.startedAt).toLocaleString()}</span>
								<span class="session-state">
									{#if session.finishedAt === null}
										<span class="badge badge-open">Open</span>
									{:else if session.outcome === 'pass'}
										<span class="badge badge-pass">Pass</span>
									{:else if session.outcome === 'fail'}
										<span class="badge badge-fail">Fail</span>
									{:else}
										<span class="badge">{session.outcome ?? 'Closed'}</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="card actions">
				<h2>Actions</h2>
				<form
					method="POST"
					action="?/markSpecRead"
					class="action-form"
					use:enhance={() => {
						savingMarkRead = true;
						return async ({ update }) => {
							try {
								await update();
								await invalidateAll();
							} finally {
								savingMarkRead = false;
							}
						};
					}}
				>
					<Button type="submit" variant="secondary" loading={savingMarkRead} loadingLabel="Saving...">
						Mark spec read
					</Button>
				</form>
				<a class="action-link" href={walkerHref}>Open test-plan walker</a>
				{#if !confirmFlip}
					<button type="button" class="action-button" onclick={() => (confirmFlip = true)}>
						Flip review_status to done
					</button>
				{:else}
					<form
						method="POST"
						action="?/flipReviewStatus"
						class="action-form"
						use:enhance={() => {
							savingFlip = true;
							return async ({ update }) => {
								try {
									await update();
									await invalidateAll();
								} finally {
									savingFlip = false;
									confirmFlip = false;
								}
							};
						}}
					>
						<p class="confirm-text">
							This writes <code>review_status: done</code> to the spec frontmatter.
						</p>
						<div class="confirm-row">
							<Button type="submit" variant="primary" loading={savingFlip} loadingLabel="Saving...">
								Confirm flip
							</Button>
							<button type="button" class="action-button" onclick={() => (confirmFlip = false)}>Cancel</button>
						</div>
					</form>
				{/if}
			</section>
		</aside>
	</div>
{:else}
	<section class="placeholder" aria-labelledby="placeholder-heading">
		<h2 id="placeholder-heading">{data.kindLabel} review -- coming in Phase 6</h2>
		<p>
			Per-kind review for <code>{data.kind}</code> items lands in a later phase. The dispatcher route is wired today
			so links from the board don't 404.
		</p>
		<p>
			Source reference: <code>{data.item.ref}</code>
			{#if data.item.ref.endsWith('.md')}
				-- <a href={ROUTES.HANGAR_DOCS_PATH(data.item.ref)}>open in /docs</a>.
			{/if}
		</p>
		<p><a href={ROUTES.HANGAR_REVIEW}>Back to the review board</a></p>
	</section>
{/if}

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.meta {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		margin: 0;
	}

	.kind {
		font-family: var(--font-family-mono);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--space-lg);
		margin-top: var(--space-md);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.content {
		min-width: 0;
	}

	.frontmatter {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm) var(--space-md);
		margin-bottom: var(--space-md);
		font-size: var(--type-ui-caption-size);
	}

	.frontmatter dl {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-3xs);
		column-gap: var(--space-md);
	}

	.fm-row {
		display: contents;
	}

	.frontmatter dt {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}

	.frontmatter dd {
		margin: 0;
		font-family: var(--font-family-mono);
	}

	.missing {
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		font-style: italic;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.card h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.walker-progress {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
	}

	.walker-detail {
		display: block;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.walker-link {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--link-default);
		text-decoration: none;
		font: inherit;
	}

	.walker-link:hover {
		background: var(--surface-sunken);
	}

	.walker-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.muted {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-style: italic;
		margin: 0;
	}

	.session-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.session {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		font-size: var(--type-ui-caption-size);
	}

	.session-when {
		color: var(--ink-body);
	}

	.badge {
		font-family: var(--font-family-mono);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.badge-open {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.badge-pass {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.badge-fail {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.action-form {
		margin: 0;
	}

	.action-link,
	.action-button {
		display: block;
		text-align: left;
		width: 100%;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--ink-body);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.action-link:hover,
	.action-button:hover {
		background: var(--surface-sunken);
	}

	.action-link:focus-visible,
	.action-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.confirm-text {
		margin: 0 0 var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
	}

	.toast {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border: 1px solid var(--signal-success-ink);
		border-radius: var(--radius-sm);
		margin: var(--space-md) 0;
		font-size: var(--type-ui-label-size);
	}

	.toast.toast-error {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.toast .dismiss {
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font-size: var(--type-ui-control-size);
	}

	.toast .dismiss:hover {
		opacity: 0.75;
	}

	.toast .dismiss:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.placeholder {
		margin-top: var(--space-lg);
		padding: var(--space-lg);
		background: var(--surface-panel);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.placeholder h2 {
		margin: 0 0 var(--space-sm);
	}

	.placeholder p {
		color: var(--ink-body);
		margin: 0 0 var(--space-sm);
	}

	.placeholder p:last-child {
		margin-bottom: 0;
	}

	.placeholder code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.placeholder a {
		color: var(--link-default);
	}

	.placeholder a:hover {
		color: var(--link-hover);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
