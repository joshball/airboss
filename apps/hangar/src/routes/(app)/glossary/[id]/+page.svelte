<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import ReferenceForm from '$lib/components/ReferenceForm.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initial = $derived(form?.initial ?? data.initial);
const fieldErrors = $derived(form?.fieldErrors ?? {});
const formError = $derived(form?.formError ?? null);
const conflict = $derived(form?.conflict ?? null);

let deleteDialogOpen = $state(false);

function formatTime(iso: string): string {
	return new Date(iso).toLocaleString();
}
</script>

<svelte:head>
	<title>{data.reference.displayName} -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<p class="crumbs">
				<a href={ROUTES.HANGAR_GLOSSARY}>Glossary</a>
				<span aria-hidden="true">/</span>
				<span class="mono">{data.reference.id}</span>
			</p>
			<h1>{data.reference.displayName}</h1>
			<div class="meta">
				<span class="badge" class:dirty={data.reference.dirty} class:clean={!data.reference.dirty}>
					{data.reference.dirty ? 'Dirty' : 'Clean'}
				</span>
				<span class="mono">rev {data.reference.rev}</span>
				<span class="muted">Updated {formatTime(data.reference.updatedAt)}</span>
				{#if data.reference.updatedBy}
					<span class="muted">by <span class="mono">{data.reference.updatedBy}</span></span>
				{/if}
				{#if data.reference.deletedAt}
					<span class="badge deleted">Deleted {formatTime(data.reference.deletedAt)}</span>
				{/if}
			</div>
		</div>
	</header>

	{#if conflict}
		<Banner tone="warning" title="Save conflict">
			Someone saved this reference after you opened it. Reload to see their changes.
			<a class="reload" href={ROUTES.HANGAR_GLOSSARY_DETAIL(data.reference.id)}>Reload</a>
		</Banner>
	{/if}

	<form method="POST" action={ROUTES.HANGAR_GLOSSARY_SAVE_ACTION} class="form">
		<ReferenceForm {initial} {fieldErrors} {formError} mode="edit" rev={data.reference.rev} />
		<div class="footer">
			<a class="cancel" href={ROUTES.HANGAR_GLOSSARY}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Save changes</Button>
		</div>
	</form>

	{#if !data.reference.deletedAt}
		<div class="delete-form">
			<Button variant="danger" size="md" onclick={() => (deleteDialogOpen = true)}>
				Soft-delete this reference
			</Button>
			<p class="hint">
				Soft-deleted references are marked hidden but retained for citation integrity. Hard delete lands with
				wp-hangar-sources-v1.
			</p>
		</div>
	{/if}
</section>

<ConfirmDialog
	open={deleteDialogOpen}
	oncancel={() => (deleteDialogOpen = false)}
	title="Soft-delete {data.reference.displayName}?"
	confirmLabel="Soft-delete"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_GLOSSARY_DELETE_ACTION}
	hiddenFields={{ rev: String(data.reference.rev) }}
>
	<p>
		The reference <code class="mono">{data.reference.id}</code> will be marked hidden and disappear from the
		glossary. The row is retained for citation integrity, so any learner-facing citation that pointed at it will
		resolve to a hidden row rather than a missing one.
	</p>
	<p>You can recover from this by clearing <code class="mono">deletedAt</code> in the database, but the surface has
		no in-app un-delete control yet.</p>
</ConfirmDialog>

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
		align-items: flex-start;
		gap: var(--space-xs);
	}

	.hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}
</style>
