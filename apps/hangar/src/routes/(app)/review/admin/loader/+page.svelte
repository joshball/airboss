<script lang="ts" module>
// Pure utility helpers -- module-scope so they're parsed once, not per
// component instance. Locale-resolved at module evaluation; subsequent
// component mounts reuse the cached `Intl.DateTimeFormat`.
const tsFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatTs(iso: string): string {
	try {
		return tsFmt.format(new Date(iso));
	} catch {
		return iso;
	}
}

export function formatDurationMs(ms: number): string {
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}
</script>

<script lang="ts">
import { REVIEW_WP_SPEC_TOAST_DISMISS_MS, ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import { onDestroy } from 'svelte';
import { enhance } from '$app/forms';
import type { ActionData, PageData } from './$types';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let running = $state(false);
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');

// Breadcrumbs intentionally skip an `Admin` crumb -- the admin sub-nav
// (Buckets / Loader) is the IA for this surface.
const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Loader' },
];

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
	if (!form) return;
	const value = 'ranLoader' in form ? form.ranLoader : undefined;
	if (value === 'ok' && 'durationMs' in form && typeof form.durationMs === 'number') {
		const summary = `Loader: ${form.added} added, ${form.updated} updated, ${form.removed} removed in ${formatDurationMs(form.durationMs)}.`;
		showToast('success', summary);
		liveAnnounce = summary;
	} else if (value === 'error' && 'error' in form) {
		const message = `Loader failed: ${form.error}`;
		showToast('danger', message, true);
		liveAnnounce = message;
	}
});
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>Loader</h1>
	<p class="meta">Admin status for the discovery + FTS loader. Singleton process-local job today.</p>
</header>

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

<Card>
	{#snippet header()}<h2>Last run</h2>{/snippet}
	{#if data.lastRun === null}
		<p class="muted">No loader run since the hangar process started. Press <em>Refresh</em> below to scan now.</p>
	{:else}
		<dl class="status">
			<div><dt>Ran at</dt><dd>{formatTs(data.lastRun.ranAt)}</dd></div>
			<div><dt>Duration</dt><dd>{formatDurationMs(data.lastRun.result.durationMs)}</dd></div>
			<div><dt>Items added</dt><dd>{data.lastRun.result.added}</dd></div>
			<div><dt>Items updated</dt><dd>{data.lastRun.result.updated}</dd></div>
			<div><dt>Items removed</dt><dd>{data.lastRun.result.removed}</dd></div>
			<div><dt>FTS added</dt><dd>{data.lastRun.result.fts.added}</dd></div>
			<div><dt>FTS updated</dt><dd>{data.lastRun.result.fts.updated}</dd></div>
			<div><dt>FTS removed</dt><dd>{data.lastRun.result.fts.removed}</dd></div>
			<div><dt>Errors</dt><dd class:err={data.lastRun.result.errors.length > 0}>{data.lastRun.result.errors.length}</dd></div>
		</dl>
		{#if data.lastRun.result.errors.length > 0}
			<Banner tone="warning">Discovery surfaced {data.lastRun.result.errors.length} error(s).</Banner>
			<details class="errors">
				<summary>Show errors</summary>
				<ul>
					{#each data.lastRun.result.errors as err (`${err.kindId}:${err.ref}:${err.message}`)}
						<li><code>{err.kindId}/{err.ref}</code> -- {err.message}{err.code ? ` (${err.code})` : ''}</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</Card>

<Card>
	{#snippet header()}<h2>Index state</h2>{/snippet}
	<dl class="status">
		<div><dt>FTS rows indexed</dt><dd>{data.ftsRowCount.toLocaleString()}</dd></div>
	</dl>
	<p class="muted">FTS index is rebuilt incrementally on every loader run. The board's docs search reads this index.</p>
</Card>

<Card>
	{#snippet header()}<h2>Refresh</h2>{/snippet}
	<form
		method="POST"
		action="?/runLoader"
		use:enhance={() => {
			running = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					running = false;
				}
			};
		}}
	>
		<Button type="submit" variant="primary" loading={running} loadingLabel="Scanning...">
			Run loader now
		</Button>
		<p class="muted hint">
			Scans the configured roots, upserts review items, soft-prunes missing artifacts, and re-indexes docs FTS. Idempotent.
		</p>
	</form>
</Card>

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.meta {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.status {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-md);
	}

	.status div {
		display: flex;
		flex-direction: column;
	}

	.status dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.status dd {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-control-size);
	}

	.status dd.err {
		color: var(--signal-warning-ink);
	}

	.errors {
		margin-top: var(--space-sm);
	}

	.errors summary {
		cursor: pointer;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.errors ul {
		margin: var(--space-2xs) 0 0;
		padding-left: var(--space-md);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.hint {
		margin: var(--space-2xs) 0 0;
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
