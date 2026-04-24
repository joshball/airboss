<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import SourceForm from '$lib/components/SourceForm.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initial = $derived(form?.initial ?? data.initial);
const fieldErrors = $derived(form?.fieldErrors ?? {});
const formError = $derived(form?.formError ?? null);
const conflict = $derived(form?.conflict ?? null);

function formatTime(iso: string): string {
	return new Date(iso).toLocaleString();
}
</script>

<svelte:head>
	<title>{data.source.title} -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<p class="crumbs">
				<a href={ROUTES.HANGAR_GLOSSARY_SOURCES}>Sources</a>
				<span aria-hidden="true">/</span>
				<span class="mono">{data.source.id}</span>
			</p>
			<h1>{data.source.title}</h1>
			<div class="meta">
				<span class="badge" class:dirty={data.source.dirty} class:clean={!data.source.dirty}>
					{data.source.dirty ? 'Dirty' : 'Clean'}
				</span>
				<span class="mono">rev {data.source.rev}</span>
				<span class="muted">Updated {formatTime(data.source.updatedAt)}</span>
				{#if data.source.updatedBy}
					<span class="muted">by <span class="mono">{data.source.updatedBy}</span></span>
				{/if}
				{#if data.source.deletedAt}
					<span class="badge deleted">Deleted {formatTime(data.source.deletedAt)}</span>
				{/if}
			</div>
		</div>
	</header>

	{#if conflict}
		<Banner tone="warning" title="Save conflict">
			Someone saved this source after you opened it. Reload to see their changes.
			<a class="reload" href={ROUTES.HANGAR_GLOSSARY_SOURCES_DETAIL(data.source.id)}>Reload</a>
		</Banner>
	{/if}

	<form method="POST" action="?/save" class="form">
		<SourceForm {initial} {fieldErrors} {formError} mode="edit" rev={data.source.rev} />
		<div class="footer">
			<a class="cancel" href={ROUTES.HANGAR_GLOSSARY_SOURCES}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Save changes</Button>
		</div>
	</form>

	{#if !data.source.deletedAt}
		<form method="POST" action="?/delete" class="delete-form">
			<input type="hidden" name="rev" value={data.source.rev} />
			<button type="submit" class="delete-btn">Soft-delete this source</button>
			<p class="hint">Soft-delete retains the row for citation integrity; hard delete is admin-only.</p>
		</form>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.crumbs {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.crumbs a {
		color: var(--link-default);
		text-decoration: none;
	}

	.crumbs a:hover {
		color: var(--link-hover);
	}

	h1 {
		margin: 0 0 var(--space-2xs);
		color: var(--ink-body);
		font-size: var(--type-heading-1-size);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.badge.dirty {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.badge.clean {
		background: var(--signal-success-wash);
		color: var(--signal-success);
	}

	.badge.deleted {
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-muted);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-subtle);
	}

	.cancel {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.cancel:hover {
		color: var(--ink-body);
	}

	.reload {
		color: var(--link-default);
		margin-left: var(--space-sm);
	}

	.delete-form {
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.delete-btn {
		align-self: flex-start;
		background: var(--action-hazard-wash);
		color: var(--action-hazard);
		border: 1px solid var(--action-hazard-edge);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-md);
		cursor: pointer;
		font: inherit;
		font-weight: var(--font-weight-semibold);
	}

	.delete-btn:hover {
		background: var(--action-hazard);
		color: var(--action-hazard-ink);
	}

	.delete-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}
</style>
