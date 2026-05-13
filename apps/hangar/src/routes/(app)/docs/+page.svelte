<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

let running = $state(false);

const isEmpty = $derived(data.indexCount === 0 && form?.ranLoader !== true);

const showRunNudge = $derived(data.indexCount === 0);

/**
 * Curated list of jump-off links rendered when NOW.md is missing. Each
 * route goes through `ROUTES.HANGAR_DOCS_PATH` so an in-tree clone tells
 * the same browser surface to render the file.
 */
const FALLBACK_LINKS: ReadonlyArray<{ label: string; path: string; note: string }> = [
	{
		label: 'Multi-product architecture',
		path: 'docs/platform/MULTI_PRODUCT_ARCHITECTURE.md',
		note: 'How the surface-typed monorepo is organised.',
	},
	{
		label: 'Design principles',
		path: 'docs/platform/DESIGN_PRINCIPLES.md',
		note: 'Core beliefs that govern product shape.',
	},
	{
		label: 'Vocabulary',
		path: 'docs/platform/VOCABULARY.md',
		note: 'Naming standards across surfaces.',
	},
	{
		label: 'Idea funnel',
		path: 'docs/platform/IDEAS.md',
		note: 'The intake list reviewed every two weeks.',
	},
];
</script>

<section class="docs-index">
	<header class="hd">
		<h1>Docs</h1>
		<p class="muted">
			{data.indexCount.toLocaleString()} files indexed.
			{#if isEmpty}
				<strong>Index is empty.</strong> Click below to populate the FTS index from
				<code>docs/</code>, <code>course/</code>, <code>handbooks/</code>, and <code>regulations/</code>.
			{/if}
		</p>
	</header>

	{#if showRunNudge}
		<form
			method="POST"
			action="?/runLoader"
			class="loader-prompt"
			use:enhance={() => {
				running = true;
				return async ({ update }) => {
					try {
						// Default `update` reloads the load function so `indexCount`
						// reflects the new state without a hard refresh.
						await update();
						await invalidateAll();
					} finally {
						running = false;
					}
				};
			}}
		>
			<Button type="submit" loading={running} loadingLabel="Indexing...">Run loader</Button>
			{#if running}
				<span class="hint" role="status">Walking docs/, course/, handbooks/, regulations/...</span>
			{/if}
		</form>
	{/if}

	{#if form?.ranLoader}
		{#if form.ok}
			<p class="status-line" role="status">
				Indexed
				<strong>{form.fts.added.toLocaleString()}</strong> files
				({form.fts.updated.toLocaleString()} updated, {form.fts.removed.toLocaleString()} removed) in
				{(form.durationMs / 1000).toFixed(1)} s.
			</p>
		{:else}
			<p class="status-line error" role="alert">
				Loader failed: {form.error}
			</p>
		{/if}
	{/if}

	{#if data.nowHtml}
		<MarkdownArticle bodyHtml={data.nowHtml} ariaLabel="NOW.md" />
	{:else}
		<section class="missing-now">
			<p class="muted">
				<code>{data.nowPath}</code> not found. Pick a file from the tree on the left, or jump to one of these:
			</p>
			<ul class="fallback-links">
				{#each FALLBACK_LINKS as link (link.path)}
					<li>
						<a href={ROUTES.HANGAR_DOCS_PATH(link.path)}>{link.label}</a>
						<span class="muted">— {link.note}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<style>
	.docs-index {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.hd h1 {
		margin: 0;
	}

	.muted {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.loader-prompt {
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}

	.hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.status-line {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.status-line.error {
		color: var(--signal-danger-deep-ink);
	}

	.fallback-links {
		list-style: disc inside;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
</style>
