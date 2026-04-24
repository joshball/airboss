<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

function formatDate(iso: string | null): string {
	if (!iso) return 'never';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

/** Tag each line so CSS picks up `+`/`-`/`@` cleanly. */
interface LineClass {
	text: string;
	kind: 'add' | 'remove' | 'hunk' | 'context';
}

function classifyLine(line: string): LineClass {
	if (line.startsWith('+')) return { text: line, kind: 'add' };
	if (line.startsWith('-')) return { text: line, kind: 'remove' };
	if (line.startsWith('@@')) return { text: line, kind: 'hunk' };
	return { text: line, kind: 'context' };
}

const lines = $derived(data.diffText ? data.diffText.split('\n').map(classifyLine) : []);
</script>

<svelte:head>
	<title>{data.source.id} diff -- hangar</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb" class="crumbs">
		<a href={ROUTES.HANGAR_SOURCES}>Sources</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.HANGAR_SOURCE_DETAIL(data.source.id)}>{data.source.id}</a>
		<span aria-hidden="true">/</span>
		<span class="current">Diff</span>
	</nav>

	<header class="hd">
		<div>
			<h1>Diff</h1>
			<p class="sub">
				Verbatim delta for <span class="mono">{data.source.id}</span> -- run after Fetch or Upload to review what
				changed before committing.
			</p>
		</div>
		<div class="hd-actions">
			<form method="POST" action="?/enqueue">
				<Button type="submit" variant="primary" size="sm">Run diff now</Button>
			</form>
			<form method="POST" action="?/commit">
				<Button type="submit" variant="secondary" size="sm" disabled={!data.latestDiff}>
					Commit this diff
				</Button>
			</form>
		</div>
	</header>

	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	{#if data.latestDiff}
		<p class="status">
			Last run {formatDate(data.latestDiff.finishedAt)} --
			<a href={ROUTES.HANGAR_JOB_DETAIL(data.latestDiff.id)}>job {data.latestDiff.id.slice(0, 10)}</a>
			({data.latestDiff.lines} line{data.latestDiff.lines === 1 ? '' : 's'})
		</p>
	{:else}
		<Banner tone="info">
			No diff job has run for this source yet. Click <strong>Run diff now</strong>.
		</Banner>
	{/if}

	{#if data.diffText && lines.length > 0}
		<pre class="diff-body" aria-label="Diff output">{#each lines as line, index (index)}<span class="line k-{line.kind}">{line.text}
</span>{/each}</pre>
	{:else if data.latestDiff}
		<p class="empty">The latest diff is empty. Nothing has changed since the last commit.</p>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.crumbs {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		align-items: center;
	}

	.crumbs a { color: var(--link-default); text-decoration: none; }
	.crumbs a:hover { text-decoration: underline; }
	.crumbs .current { color: var(--ink-body); }

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.hd-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		flex-wrap: wrap;
	}

	.status {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.status a { color: var(--link-default); text-decoration: none; }
	.status a:hover { text-decoration: underline; }

	.empty {
		color: var(--ink-muted);
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.diff-body {
		background: var(--surface-page);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		overflow: auto;
		max-height: 60vh;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		line-height: var(--line-height-normal);
		margin: 0;
	}

	.line {
		display: block;
		white-space: pre;
	}

	.line.k-add { color: var(--signal-success); background: var(--signal-success-wash); }
	.line.k-remove { color: var(--signal-danger); background: var(--signal-danger-wash); }
	.line.k-hunk { color: var(--signal-info); background: var(--signal-info-wash); font-weight: var(--font-weight-semibold); }
	.line.k-context { color: var(--ink-muted); }

	.mono { font-family: var(--font-family-mono); }
</style>
