<script lang="ts">
import {
	DOMAIN_LABELS,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	SESSION_REASON_CODE_LABELS,
	SESSION_SLICE_LABELS,
	SESSION_SLICES,
	type SessionMode,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

let shuffling = $state(false);
let starting = $state(false);

const preview = $derived(data.needsPlan ? null : data.preview);

type PreviewItem = NonNullable<typeof preview>['items'][number];

// Group items by slice for preview rendering.
const bySlice = $derived.by<Record<SessionSlice, PreviewItem[]>>(() => {
	const out: Record<SessionSlice, PreviewItem[]> = {
		[SESSION_SLICES.CONTINUE]: [],
		[SESSION_SLICES.STRENGTHEN]: [],
		[SESSION_SLICES.EXPAND]: [],
		[SESSION_SLICES.DIVERSIFY]: [],
	};
	if (!preview) return out;
	for (const item of preview.items) out[item.slice].push(item);
	return out;
});

async function shuffle() {
	shuffling = true;
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_SEED, Math.random().toString(36).slice(2));
	await goto(next, { replaceState: true, invalidateAll: true });
	shuffling = false;
}

function changeMode(nextMode: SessionMode) {
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_MODE, nextMode);
	next.searchParams.delete(QUERY_PARAMS.SESSION_SEED);
	void goto(next, { replaceState: true, invalidateAll: true });
}

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}
</script>

<svelte:head>
	<title>Start session -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Start a session</h1>
			{#if preview}
				<p class="sub">{preview.items.length} items queued. Review the plan, then start.</p>
			{/if}
		</div>
		<nav class="quick">
			<a class="btn ghost" href={ROUTES.DASHBOARD}>Cancel</a>
		</nav>
	</header>

	{#if data.needsPlan}
		<article class="empty">
			<h2>No active study plan yet</h2>
			<p class="muted">Create one first -- that's how the engine knows what to pick.</p>
			<a class="btn primary" href={ROUTES.PLANS_NEW}>Create plan</a>
		</article>
	{:else if preview}
		<article class="controls">
			<div class="mode-row">
				<label for="mode">Mode</label>
				<select
					id="mode"
					value={preview.mode}
					onchange={(e) => changeMode((e.target as HTMLSelectElement).value as SessionMode)}
				>
					{#each SESSION_MODE_VALUES as m (m)}
						<option value={m}>{SESSION_MODE_LABELS[m as SessionMode]}</option>
					{/each}
				</select>
			</div>

			<div class="meta">
				<span>Length: {preview.sessionLength}</span>
				<span>Plan: <a class="link" href={ROUTES.PLAN(preview.plan.id)}>{preview.plan.title}</a></span>
				{#if preview.focus}<span>Focus: {domainLabel(preview.focus)}</span>{/if}
				{#if preview.cert}<span>Cert: {preview.cert}</span>{/if}
			</div>

			{#if preview.short}
				<p class="note">Not enough candidates to fill {preview.sessionLength} slots. You'll get {preview.items.length}.</p>
			{/if}
		</article>

		{#if preview.items.length === 0}
			<article class="empty">
				<h2>Nothing to study yet</h2>
				<p class="muted">Add cards or scenarios first, or wait for the knowledge graph to populate.</p>
				<div class="row">
					<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
					<a class="btn secondary" href={ROUTES.REPS_NEW}>New scenario</a>
				</div>
			</article>
		{:else}
			<article class="preview">
				<h2>Preview</h2>
				{#each Object.values(SESSION_SLICES) as slice (slice)}
					{@const items = bySlice[slice]}
					{#if items && items.length > 0}
						<section class="slice">
							<header class="slice-hd">
								<h3>{SESSION_SLICE_LABELS[slice]}</h3>
								<span class="count">{items.length}</span>
							</header>
							<ol class="items">
								{#each items as item, idx (idx)}
									<li class="item">
										<span class="kind" data-kind={item.kind}>
											{item.kind === 'card' ? 'Card' : item.kind === 'rep' ? 'Rep' : 'Node'}
										</span>
										<span class="reason">{reasonLabel(item.reasonCode)}</span>
										{#if item.reasonDetail}
											<span class="detail">— {item.reasonDetail}</span>
										{/if}
										{#if item.kind === 'node_start'}
											<span class="id">{item.nodeId}</span>
										{:else if item.kind === 'card'}
											<span class="id">{item.cardId}</span>
										{:else}
											<span class="id">{item.scenarioId}</span>
										{/if}
									</li>
								{/each}
							</ol>
						</section>
					{/if}
				{/each}
			</article>

			<form
				method="post"
				action="?/start"
				class="start-row"
				use:enhance={() => {
					starting = true;
					return async ({ update }) => {
						await update();
						starting = false;
					};
				}}
			>
				<input type="hidden" name="mode" value={preview.mode} />
				{#if preview.focus}<input type="hidden" name="focus" value={preview.focus} />{/if}
				{#if preview.cert}<input type="hidden" name="cert" value={preview.cert} />{/if}
				<input type="hidden" name="seed" value={preview.seed} />
				<button type="button" class="btn secondary" onclick={shuffle} disabled={shuffling}>
					{shuffling ? 'Shuffling…' : 'Shuffle'}
				</button>
				<button type="submit" class="btn primary" disabled={starting}>
					{starting ? 'Starting…' : 'Start session'}
				</button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.empty {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.controls {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mode-row label {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.mode-row select {
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: 0.375rem 0.5rem;
		font-size: 0.875rem;
	}

	.meta {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		color: #475569;
		font-size: 0.8125rem;
	}

	.link {
		color: #1d4ed8;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.note {
		margin: 0;
		color: #92400e;
		background: #fef3c7;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.8125rem;
	}

	.preview {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.preview > h2 {
		margin: 0;
		font-size: 0.8125rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.slice {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.slice-hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.slice-hd h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #0f172a;
	}

	.count {
		color: #64748b;
		font-size: 0.75rem;
	}

	.items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.375rem 0.625rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		font-size: 0.8125rem;
	}

	.kind {
		display: inline-block;
		font-weight: 700;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		background: #e2e8f0;
		color: #475569;
	}

	.kind[data-kind='node_start'] {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.kind[data-kind='rep'] {
		background: #fef3c7;
		color: #92400e;
	}

	.reason {
		color: #0f172a;
		font-weight: 500;
	}

	.detail {
		color: #64748b;
	}

	.id {
		margin-left: auto;
		color: #94a3b8;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}

	.start-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.muted {
		color: #94a3b8;
		margin: 0;
		font-size: 0.875rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
