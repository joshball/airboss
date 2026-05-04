<script lang="ts" module>
export interface KnowledgeNodeViewProps {
	readonly itemId: string;
	readonly itemTitle: string;
	readonly itemRef: string;
	readonly bodyHtml: string | null;
	readonly frontmatter: ReadonlyArray<{ key: string; value: string }>;
	readonly missing: boolean;
	readonly sessions: ReadonlyArray<{
		id: string;
		startedAt: string;
		finishedAt: string | null;
		outcome: string | null;
		note: string;
	}>;
	readonly markedDoneFromAction: 'ok' | 'already-done' | string | null;
}
</script>

<script lang="ts">
import { REVIEW_WP_SPEC_TOAST_DISMISS_MS } from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import { enhance } from '$app/forms';
import { onDestroy } from 'svelte';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

let {
	itemId: _itemId,
	itemTitle,
	itemRef,
	bodyHtml,
	frontmatter,
	missing,
	sessions,
	markedDoneFromAction,
}: KnowledgeNodeViewProps = $props();

let savingMark = $state(false);
let confirmMark = $state(false);
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');

// `discovery_review` is the canonical knowledge-node review field per ADR
// 011. We only read this key; legacy `review_status` keys (if any) are a
// migration concern, not a runtime alias.
const reviewStatusEntry = $derived(frontmatter.find((e) => e.key === 'discovery_review'));

function showToast(tone: ToastTone, message: string, sticky = false): void {
	toast = { tone, message, sticky };
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
	if (!sticky) {
		toastDismissTimer = setTimeout(() => {
			toast = null;
			toastDismissTimer = null;
		}, REVIEW_WP_SPEC_TOAST_DISMISS_MS);
	}
}

function dismissToast(): void {
	toast = null;
	if (toastDismissTimer !== null) {
		clearTimeout(toastDismissTimer);
		toastDismissTimer = null;
	}
}

onDestroy(() => {
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
});

$effect(() => {
	if (markedDoneFromAction === null) return;
	if (markedDoneFromAction === 'ok') {
		showToast('success', 'discovery_review flipped to done.');
		liveAnnounce = 'discovery_review flipped to done.';
	} else if (markedDoneFromAction === 'already-done') {
		showToast('info', 'discovery_review is already marked done.');
		liveAnnounce = 'discovery_review is already marked done.';
	} else {
		showToast('danger', markedDoneFromAction, true);
		liveAnnounce = `Mark reviewed failed: ${markedDoneFromAction}`;
	}
});

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
</script>

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

<div class="layout">
	<section class="content" aria-label="Knowledge node">
		{#if missing}
			<p class="missing">
				<code>{itemRef}</code> is not present on disk. The loader will soft-delete this item on its next pass.
			</p>
		{:else if bodyHtml !== null}
			<MarkdownArticle bodyHtml={bodyHtml} ariaLabel={itemTitle} />
		{/if}
	</section>

	<aside class="sidebar" aria-label="Review status">
		{#if frontmatter.length > 0}
			<Card>
				{#snippet header()}<h2>Frontmatter</h2>{/snippet}
				<dl class="fm-list">
					{#each frontmatter as entry (entry.key)}
						<div class="fm-row">
							<dt>{entry.key}</dt>
							<dd>{entry.value}</dd>
						</div>
					{/each}
				</dl>
			</Card>
		{/if}

		<Card>
			{#snippet header()}<h2>Discovery-pedagogy review</h2>{/snippet}
			<p class="hint">
				Confirm the node leads with WHY (per ADR 011) and reveals the regulation as confirmation rather than as an
				arbitrary rule. Mark reviewed once satisfied; the next loader pass moves the node out of the pending bucket.
			</p>
			{#if reviewStatusEntry?.value === 'done'}
				<p class="status-done">
					<Badge tone="success" size="sm">Reviewed</Badge>
					<code>{reviewStatusEntry.key}: done</code>
				</p>
			{:else if !confirmMark}
				<button type="button" class="action-button" onclick={() => (confirmMark = true)}>
					Mark reviewed
				</button>
			{:else}
				<form
					method="POST"
					action="?/markKnowledgeNodeReviewed"
					class="action-form"
					use:enhance={() => {
						savingMark = true;
						return async ({ update, result }) => {
							try {
								// `update()` runs invalidation already; an extra
								// `invalidateAll()` would double-load.
								await update();
							} finally {
								savingMark = false;
							}
							if (result.type === 'success') confirmMark = false;
						};
					}}
				>
					<p class="confirm-text">
						Writes <code>discovery_review: done</code> to the node's frontmatter.
					</p>
					<div class="confirm-row">
						<Button type="submit" variant="primary" loading={savingMark} loadingLabel="Saving...">
							Confirm reviewed
						</Button>
						<button type="button" class="action-button" onclick={() => (confirmMark = false)}>Cancel</button>
					</div>
				</form>
			{/if}
		</Card>

		{#if sessions.length > 0}
			<Card>
				{#snippet header()}<h2>Sessions</h2>{/snippet}
				<ul class="session-list">
					{#each sessions as s (s.id)}
						<li class="session">
							<span class="session-when">{formatStartedAt(s.startedAt)}</span>
							<span class="session-state">
								{#if s.finishedAt === null}
									<Badge tone="info" size="sm">Open</Badge>
								{:else if s.outcome === 'pass'}
									<Badge tone="success" size="sm">Pass</Badge>
								{:else if s.outcome === 'fail'}
									<Badge tone="danger" size="sm">Fail</Badge>
								{:else if s.outcome === 'abandoned'}
									<Badge tone="muted" size="sm">Abandoned</Badge>
								{:else}
									<Badge tone="default" size="sm">{s.outcome ?? 'Closed'}</Badge>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}
	</aside>
</div>

<style>
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

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
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

	.hint {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.status-done {
		display: flex;
		gap: var(--space-2xs);
		align-items: center;
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.action-button {
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-body);
		font: inherit;
		cursor: pointer;
		text-align: left;
	}

	.action-button:hover {
		background: var(--surface-sunken);
	}

	.action-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.action-form {
		margin: 0;
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

	.missing {
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		font-style: italic;
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
