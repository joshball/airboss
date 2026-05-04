<script lang="ts">
import {
	REVIEW_SESSION_HISTORY_LIMIT,
	REVIEW_WP_SPEC_FINISH_PARAMS,
	REVIEW_WP_SPEC_TAB_PARAM,
	REVIEW_WP_SPEC_TOAST_DISMISS_MS,
	ROUTES,
	WP_SPEC_TABS,
	type WpSpecTabId,
} from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import Tabs, { type TabItem } from '@ab/ui/components/Tabs.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import { onMount } from 'svelte';
import { enhance } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

interface WpTabPayload {
	readonly id: WpSpecTabId;
	readonly label: string;
	readonly file: string;
	readonly present: boolean;
	readonly bodyHtml: string | null;
	readonly frontmatter: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: data.kindLabel },
	{ label: data.item.title },
]);

// Tab state: hydrate from the URL once on mount; subsequent changes are
// driven by the user clicking tabs (which we then push back into the URL
// via SvelteKit's router so its state stays in sync with `page.url`).
let activeTab = $state<WpSpecTabId>(parseInitialTab(page.url.searchParams.get(REVIEW_WP_SPEC_TAB_PARAM)));
let savingMarkRead = $state(false);
let savingFlip = $state(false);
let confirmFlip = $state(false);
let toast = $state<ToastState | null>(null);
let liveAnnounce = $state('');
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;

function parseInitialTab(value: string | null): WpSpecTabId {
	const ids = WP_SPEC_TABS.map((t) => t.id) as readonly string[];
	if (value !== null && ids.includes(value)) return value as WpSpecTabId;
	return WP_SPEC_TABS[0].id;
}

const tabItems = $derived<ReadonlyArray<TabItem>>(
	data.view === 'wp_spec'
		? data.tabs.map((t) => ({
				id: t.id,
				label: t.present ? t.label : `${t.label} (none)`,
				disabled: !t.present,
			}))
		: [],
);

const tabsById = $derived<ReadonlyMap<WpSpecTabId, WpTabPayload>>(
	data.view === 'wp_spec'
		? new Map<WpSpecTabId, WpTabPayload>(data.tabs.map((t) => [t.id, t as WpTabPayload] as const))
		: new Map<WpSpecTabId, WpTabPayload>(),
);

const activeTabPayload = $derived<WpTabPayload | undefined>(tabsById.get(activeTab));

function dismissToast() {
	toast = null;
	if (toastDismissTimer !== null) {
		clearTimeout(toastDismissTimer);
		toastDismissTimer = null;
	}
}

function showToast(tone: ToastTone, message: string, sticky = false) {
	toast = { tone, message, sticky };
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
	if (!sticky) {
		toastDismissTimer = setTimeout(() => {
			toast = null;
			toastDismissTimer = null;
		}, REVIEW_WP_SPEC_TOAST_DISMISS_MS);
	}
}

// On mount, surface any walker-finish toast carried via URL params so the
// reviewer sees the closing handshake on the spec view (the walker page
// unmounted before its inline toast could be read).
onMount(() => {
	const url = new URL(window.location.href);
	const finishedAs = url.searchParams.get(REVIEW_WP_SPEC_FINISH_PARAMS.FINISHED_AS);
	const flipped = url.searchParams.get(REVIEW_WP_SPEC_FINISH_PARAMS.FLIPPED) === '1';
	const fmError = url.searchParams.get(REVIEW_WP_SPEC_FINISH_PARAMS.FM_ERROR);
	if (finishedAs !== null) {
		const flipMessage = flipped
			? ' review_status flipped to done.'
			: fmError !== null
				? ` Frontmatter flip failed: ${fmError}.`
				: '';
		const tone: ToastTone = fmError !== null ? 'warning' : 'success';
		showToast(tone, `Session finished as ${finishedAs}.${flipMessage}`, fmError !== null);
		liveAnnounce = `Session finished as ${finishedAs}.${flipMessage}`;
		// Strip the params so a refresh / share-link doesn't re-show the toast.
		url.searchParams.delete(REVIEW_WP_SPEC_FINISH_PARAMS.FINISHED_AS);
		url.searchParams.delete(REVIEW_WP_SPEC_FINISH_PARAMS.FLIPPED);
		url.searchParams.delete(REVIEW_WP_SPEC_FINISH_PARAMS.FM_ERROR);
		void goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true, keepFocus: true });
	}
});

// URL persistence: keep the active tab in `?tab=...` so reload + share-link
// land back on the same content. Use SvelteKit's router (`goto`) instead of
// raw `history.replaceState` so the router's URL state stays consistent
// with `page.url` after `invalidateAll()`.
$effect(() => {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	const current = url.searchParams.get(REVIEW_WP_SPEC_TAB_PARAM);
	const desired = activeTab === WP_SPEC_TABS[0].id ? null : activeTab;
	if (current === desired) return;
	if (desired === null) url.searchParams.delete(REVIEW_WP_SPEC_TAB_PARAM);
	else url.searchParams.set(REVIEW_WP_SPEC_TAB_PARAM, desired);
	void goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true, keepFocus: true });
});

// Surface action results into the dismissable toast surface + live region.
$effect(() => {
	if (!form) return;
	const markValue = 'markSpecRead' in form ? form.markSpecRead : undefined;
	if (markValue === 'ok') {
		showToast('success', 'Spec marked as read.');
		liveAnnounce = 'Spec marked as read.';
	} else if (markValue === 'already-done') {
		showToast('info', 'Spec is already marked as read.');
		liveAnnounce = 'Spec already marked as read.';
	} else if (typeof markValue === 'string') {
		showToast('danger', markValue, true);
		liveAnnounce = `Mark as read failed: ${markValue}`;
	}
	const flipValue = 'flipReviewStatus' in form ? form.flipReviewStatus : undefined;
	if (flipValue === 'ok') {
		showToast('success', 'review_status flipped to done.');
		liveAnnounce = 'Review status flipped to done.';
	} else if (typeof flipValue === 'string') {
		showToast('danger', flipValue, true);
		liveAnnounce = `Flip failed: ${flipValue}`;
	}
});

const walkerHref = $derived(data.view === 'wp_spec' ? ROUTES.HANGAR_REVIEW_WALKER(data.kind, data.item.id) : '');
const startedAtFmt = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
});
function formatStartedAt(iso: string): string {
	try {
		return startedAtFmt.format(new Date(iso));
	} catch {
		return iso;
	}
}

const sessionTotalNote = $derived<string | null>(
	data.view === 'wp_spec' && data.sessions.length === REVIEW_SESSION_HISTORY_LIMIT
		? `Showing the last ${REVIEW_SESSION_HISTORY_LIMIT} sessions.`
		: null,
);
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
	<div class="toast-wrap">
		<Toast tone={toast.tone} shape="card">
			{toast.message}
			{#snippet actions()}
				<button type="button" class="dismiss" aria-label="Dismiss notification" onclick={dismissToast}>
					Dismiss
				</button>
			{/snippet}
		</Toast>
	</div>
{/if}

{#if data.view === 'wp_spec'}
	<div class="layout">
		<section class="content" aria-label="Work-package documents">
			<Tabs tabs={tabItems} bind:active={activeTab} ariaLabel="Work-package tabs">
				{#snippet panel(tabId)}
					{@const tab = tabsById.get(tabId as WpSpecTabId)}
					{#if tab && tab.present && tab.bodyHtml !== null}
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
			{#if activeTabPayload && activeTabPayload.present && activeTabPayload.frontmatter.length > 0}
				<Card>
					{#snippet header()}<h2>Frontmatter</h2>{/snippet}
					<dl class="fm-list">
						{#each activeTabPayload.frontmatter as entry (entry.key)}
							<div class="fm-row">
								<dt>{entry.key}</dt>
								<dd>{entry.value}</dd>
							</div>
						{/each}
					</dl>
				</Card>
			{/if}

			<Card>
				{#snippet header()}<h2>Walker</h2>{/snippet}
				{#if data.walker.hasPlan}
					<p class="walker-progress">
						<strong>{data.walker.recordedSteps}</strong> of {data.walker.stepCount} steps recorded
						{#if data.walker.recordedSteps > 0}
							<span class="walker-detail">
								({data.walker.passCount} pass / {data.walker.failCount} fail / {data.walker.blockedCount} blocked)
							</span>
						{/if}
					</p>
					{#if data.openSessionStartedAt !== null}
						<p class="walker-detail">
							Open session started {formatStartedAt(data.openSessionStartedAt)}.
						</p>
					{/if}
					<a class="walker-link" href={walkerHref}>
						{data.walker.openSessionId !== null ? 'Resume walker' : 'Open test-plan walker'}
					</a>
				{:else}
					<p class="muted">No <code>test-plan.md</code> for this work package.</p>
				{/if}
			</Card>

			<Card>
				{#snippet header()}<h2>Sessions</h2>{/snippet}
				{#if data.sessions.length === 0}
					<p class="muted">No sessions yet.</p>
				{:else}
					<ul class="session-list">
						{#each data.sessions as session (session.id)}
							<li class="session">
								<span class="session-when">{formatStartedAt(session.startedAt)}</span>
								<span class="session-state">
									{#if session.finishedAt === null}
										<Badge tone="info" size="sm">Open</Badge>
									{:else if session.outcome === 'pass'}
										<Badge tone="success" size="sm">Pass</Badge>
									{:else if session.outcome === 'fail'}
										<Badge tone="danger" size="sm">Fail</Badge>
									{:else if session.outcome === 'abandoned'}
										<Badge tone="muted" size="sm">Abandoned</Badge>
									{:else}
										<Badge tone="default" size="sm">{session.outcome ?? 'Closed'}</Badge>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
					{#if sessionTotalNote !== null}
						<p class="muted session-note">{sessionTotalNote}</p>
					{/if}
				{/if}
			</Card>

			<Card>
				{#snippet header()}<h2>Actions</h2>{/snippet}
				<div class="actions">
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
					{#if data.walker.hasPlan}
						<a class="action-link" href={walkerHref}>
							{data.walker.openSessionId !== null ? 'Resume test-plan walker' : 'Open test-plan walker'}
						</a>
					{/if}
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
								return async ({ update, result }) => {
									try {
										await update();
										await invalidateAll();
									} finally {
										savingFlip = false;
									}
									// Only close the confirm panel on success; failed
									// flips keep the panel open so the user can retry
									// without re-clicking the trigger.
									if (result.type === 'success') confirmFlip = false;
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
				</div>
			</Card>
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
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.kind {
		font-family: var(--font-family-mono);
	}

	.ref code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
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

	.fm-list {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-3xs);
		column-gap: var(--space-md);
		font-size: var(--type-ui-caption-size);
	}

	.fm-row {
		display: contents;
	}

	.fm-list dt {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}

	.fm-list dd {
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

	.walker-progress {
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.walker-detail {
		display: block;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		margin: 0;
	}

	.walker-link {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--link-default);
		text-decoration: none;
		font: inherit;
		margin-top: var(--space-2xs);
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

	.session-note {
		margin-top: var(--space-2xs);
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

	.toast-wrap {
		margin: var(--space-md) 0;
	}

	.dismiss {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
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

	.placeholder a {
		color: var(--link-default);
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
