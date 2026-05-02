<script lang="ts">
import { QUERY_PARAMS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Breadcrumbs from '@ab/ui/components/Breadcrumbs.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import RolePill from '@ab/ui/components/RolePill.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const entry = $derived(data.entry);

function formatTimestamp(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short',
	});
}

function prettyJson(value: unknown): string {
	if (value === null || value === undefined) return '';
	return JSON.stringify(value, null, 2);
}

const beforeText = $derived(prettyJson(entry.before));
const afterText = $derived(prettyJson(entry.after));
const metadataText = $derived(prettyJson(entry.metadata));

const beforeEmpty = $derived(entry.before === null || entry.before === undefined);
const afterEmpty = $derived(entry.after === null || entry.after === undefined);
const metadataEmpty = $derived(metadataText === '' || metadataText === '{}');

function emptyPaneCopy(side: 'before' | 'after', op: string): string {
	if (side === 'before') {
		if (op === 'create') return 'No before -- this is a create.';
		if (op === 'action') return 'No before -- this is an action.';
		return 'No before recorded.';
	}
	if (op === 'delete') return 'No after -- this is a delete.';
	if (op === 'action') return 'No after -- this is an action.';
	return 'No after recorded.';
}

function actorAllUrl(actorId: string): string {
	const url = new URL(ROUTES.HANGAR_ADMIN_AUDIT, 'https://placeholder');
	url.searchParams.set(QUERY_PARAMS.AUDIT_ACTOR, actorId);
	url.searchParams.set(QUERY_PARAMS.AUDIT_WINDOW, 'all');
	return `${url.pathname}${url.search}`;
}

function targetAllUrl(targetType: string, targetId: string | null): string {
	const url = new URL(ROUTES.HANGAR_ADMIN_AUDIT, 'https://placeholder');
	url.searchParams.set(QUERY_PARAMS.AUDIT_TARGET_TYPE, targetType);
	if (targetId) url.searchParams.set(QUERY_PARAMS.AUDIT_TARGET_ID, targetId);
	url.searchParams.set(QUERY_PARAMS.AUDIT_WINDOW, 'all');
	return `${url.pathname}${url.search}`;
}

let copyState = $state<Record<string, 'idle' | 'copied' | 'failed'>>({
	before: 'idle',
	after: 'idle',
	metadata: 'idle',
	id: 'idle',
});

async function copyToClipboard(key: 'before' | 'after' | 'metadata' | 'id', text: string): Promise<void> {
	if (!text) return;
	try {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			copyState = { ...copyState, [key]: 'copied' };
		} else {
			copyState = { ...copyState, [key]: 'failed' };
			return;
		}
	} catch {
		copyState = { ...copyState, [key]: 'failed' };
	}
	setTimeout(() => {
		copyState = { ...copyState, [key]: 'idle' };
	}, 1_500);
}
</script>

<svelte:head>
	<title>Audit -- {entry.id}</title>
</svelte:head>

<section class="page">
	<Breadcrumbs
		items={[
			{ label: 'Hangar', href: ROUTES.HANGAR_HOME },
			{ label: 'Audit', href: ROUTES.HANGAR_ADMIN_AUDIT },
			{ label: entry.id, mono: true },
		]}
	/>

	<PageHeader title="Audit event" subtitle={`${entry.op} -- ${entry.targetType}${entry.targetId ? ` -- ${entry.targetId}` : ''}`}>
		{#snippet titleSuffix()}
			<PageHelp pageId="audit" />
		{/snippet}
	</PageHeader>

	<dl class="meta">
		<div class="meta-row">
			<dt>Audit id</dt>
			<dd>
				<span class="mono">{entry.id}</span>
				<button type="button" class="copy" onclick={() => copyToClipboard('id', entry.id)}>
					{copyState.id === 'copied' ? 'Copied' : copyState.id === 'failed' ? 'Failed' : 'Copy'}
				</button>
			</dd>
		</div>
		<div class="meta-row">
			<dt>Timestamp</dt>
			<dd class="mono">{formatTimestamp(entry.timestamp)}</dd>
		</div>
		<div class="meta-row">
			<dt>Op</dt>
			<dd><span class="op-pill op-{entry.op}">{entry.op}</span></dd>
		</div>
		<div class="meta-row">
			<dt>Target type</dt>
			<dd class="mono">{entry.targetType}</dd>
		</div>
		<div class="meta-row">
			<dt>Target id</dt>
			<dd class="mono">{entry.targetId ?? '-'}</dd>
		</div>
	</dl>

	<section class="actor-card" aria-labelledby="actor-h">
		<h2 id="actor-h">Actor</h2>
		{#if entry.actorId === null}
			<p class="actor-system">System write -- no acting user.</p>
		{:else}
			<dl class="actor-meta">
				<div class="actor-row">
					<dt>Name</dt>
					<dd>{entry.actorName?.trim() || '-'}</dd>
				</div>
				<div class="actor-row">
					<dt>Email</dt>
					<dd class="mono">{entry.actorEmail ?? '-'}</dd>
				</div>
				<div class="actor-row">
					<dt>Role</dt>
					<dd>
						{#if entry.actorRole}
							<RolePill>{entry.actorRole}</RolePill>
						{:else}
							<span class="muted">-</span>
						{/if}
					</dd>
				</div>
				<div class="actor-row">
					<dt>Actor id</dt>
					<dd class="mono">{entry.actorId}</dd>
				</div>
			</dl>
			<div class="actor-links">
				<a href={ROUTES.HANGAR_USER_DETAIL(entry.actorId)}>View user</a>
				<a href={actorAllUrl(entry.actorId)}>View all from this actor</a>
			</div>
		{/if}
	</section>

	<div class="payload-grid">
		<section class="pane" aria-labelledby="before-h">
			<header class="pane-head">
				<h2 id="before-h">Before</h2>
				{#if !beforeEmpty}
					<button type="button" class="copy" onclick={() => copyToClipboard('before', beforeText)}>
						{copyState.before === 'copied' ? 'Copied' : copyState.before === 'failed' ? 'Failed' : 'Copy'}
					</button>
				{/if}
			</header>
			{#if beforeEmpty}
				<p class="pane-empty">{emptyPaneCopy('before', entry.op)}</p>
			{:else}
				<pre class="payload">{beforeText}</pre>
			{/if}
		</section>
		<section class="pane" aria-labelledby="after-h">
			<header class="pane-head">
				<h2 id="after-h">After</h2>
				{#if !afterEmpty}
					<button type="button" class="copy" onclick={() => copyToClipboard('after', afterText)}>
						{copyState.after === 'copied' ? 'Copied' : copyState.after === 'failed' ? 'Failed' : 'Copy'}
					</button>
				{/if}
			</header>
			{#if afterEmpty}
				<p class="pane-empty">{emptyPaneCopy('after', entry.op)}</p>
			{:else}
				<pre class="payload">{afterText}</pre>
			{/if}
		</section>
	</div>

	<section class="pane metadata" aria-labelledby="metadata-h">
		<header class="pane-head">
			<h2 id="metadata-h">Metadata</h2>
			{#if !metadataEmpty}
				<button type="button" class="copy" onclick={() => copyToClipboard('metadata', metadataText)}>
					{copyState.metadata === 'copied' ? 'Copied' : copyState.metadata === 'failed' ? 'Failed' : 'Copy'}
				</button>
			{/if}
		</header>
		{#if metadataEmpty}
			<p class="pane-empty">No metadata recorded.</p>
		{:else}
			<pre class="payload">{metadataText}</pre>
		{/if}
	</section>

	<footer class="footer-links">
		<a href={targetAllUrl(entry.targetType, entry.targetId)}>View all on this target</a>
	</footer>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-md);
		margin: 0;
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.meta-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.meta-row dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meta-row dd {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.actor-card {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.actor-card h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.actor-system {
		margin: 0;
		color: var(--ink-muted);
	}

	.actor-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-md);
		margin: 0;
	}

	.actor-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.actor-row dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.actor-row dd {
		margin: 0;
		color: var(--ink-body);
	}

	.actor-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	.actor-links a {
		color: var(--link-default);
		text-decoration: none;
		font-size: var(--type-ui-caption-size);
	}

	.actor-links a:hover {
		text-decoration: underline;
	}

	.payload-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--space-md);
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		min-width: 0;
	}

	.pane-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.pane-head h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.pane-empty {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.payload {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-body);
		background: var(--surface-page);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
		max-height: 32rem;
	}

	.copy {
		background: transparent;
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--type-ui-caption-size);
		cursor: pointer;
	}

	.copy:hover {
		color: var(--ink-body);
		border-color: var(--input-default-hover-border);
	}

	.copy:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.op-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-faint);
	}

	.footer-links {
		display: flex;
		gap: var(--space-md);
	}

	.footer-links a {
		color: var(--link-default);
		text-decoration: none;
	}

	.footer-links a:hover {
		text-decoration: underline;
	}
</style>
