<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

/**
 * Threshold above which a "Commit this diff" action escalates from a caution
 * dialog to a danger dialog with typed confirmation. Mirrors the review
 * recommendation: small commits are routine; large commits are high-blast
 * and need the operator to bind the action to its target.
 */
const LARGE_DIFF_LINE_THRESHOLD = 500;

let { data, form }: { data: PageData; form: ActionData } = $props();

const formError = $derived.by(() => {
	if (!form) return null;
	const err = (form as { error?: unknown }).error;
	return typeof err === 'string' ? err : null;
});

let commitDialogOpen = $state(false);
const diffLines = $derived(data.latestDiff?.lines ?? 0);
const isLargeDiff = $derived(diffLines >= LARGE_DIFF_LINE_THRESHOLD);

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

	<PageHeader title="Diff">
		{#snippet subtitleSnippet()}
			<p>
				Verbatim delta for <span class="mono">{data.source.id}</span> -- run after Fetch or Upload to review what
				changed before committing.
			</p>
		{/snippet}
		{#snippet actions()}
			<form method="POST" action={ROUTES.HANGAR_SOURCE_DIFF_ENQUEUE_ACTION}>
				<Button type="submit" variant="primary" size="sm">Run diff now</Button>
			</form>
			<Button
				variant="secondary"
				size="sm"
				disabled={!data.latestDiff}
				onclick={() => (commitDialogOpen = true)}
			>
				Commit this diff
			</Button>
		{/snippet}
	</PageHeader>

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
		<EmptyState title="No changes" body="The latest diff is empty. Nothing has changed since the last commit." />
	{/if}
</section>

<ConfirmDialog
	open={commitDialogOpen}
	oncancel={() => (commitDialogOpen = false)}
	title="Commit diff for {data.source.id}?"
	confirmLabel="Commit"
	dangerLevel={isLargeDiff ? 'danger' : 'caution'}
	formAction={ROUTES.HANGAR_SOURCE_DIFF_COMMIT_ACTION}
	typedConfirmation={isLargeDiff
		? { label: `Type the source id to confirm: ${data.source.id}`, expected: data.source.id }
		: undefined}
>
	<p>
		Commit promotes <strong>{diffLines} line{diffLines === 1 ? '' : 's'}</strong> of staged changes to the
		canonical source for <code class="mono">{data.source.id}</code>. Once committed, the previous canonical
		content is replaced and downstream consumers will see the new bytes on their next read.
	</p>
	{#if isLargeDiff}
		<p>
			This is a large diff ({diffLines} lines, threshold {LARGE_DIFF_LINE_THRESHOLD}). Confirm by typing the
			source id below to bind the action to its target.
		</p>
	{:else}
		<p>Review the diff above before continuing. Cancel if anything looks unintended.</p>
	{/if}
</ConfirmDialog>

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

	.status {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.status a { color: var(--link-default); text-decoration: none; }
	.status a:hover { text-decoration: underline; }

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
