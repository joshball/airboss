<script lang="ts">
import { ROUTES } from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import SourceForm from '$lib/components/SourceForm.svelte';
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
	<title>{data.source.title} -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<Breadcrumbs
				items={[
					{ label: 'Sources', href: ROUTES.HANGAR_GLOSSARY_SOURCES },
					{ label: data.source.id, mono: true },
				]}
			/>
			<h1>{data.source.title}</h1>
			<div class="meta">
				<Badge tone={data.source.dirty ? 'warning' : 'success'} size="sm">
					{data.source.dirty ? 'Dirty' : 'Clean'}
				</Badge>
				<span class="mono">rev {data.source.rev}</span>
				<span class="muted">Updated {formatTime(data.source.updatedAt)}</span>
				{#if data.source.updatedBy}
					<span class="muted">by <span class="mono">{data.source.updatedBy}</span></span>
				{/if}
				{#if data.source.deletedAt}
					<Badge tone="danger" size="sm">Deleted {formatTime(data.source.deletedAt)}</Badge>
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

	<form method="POST" action={ROUTES.HANGAR_GLOSSARY_SAVE_ACTION} class="form">
		<SourceForm {initial} {fieldErrors} {formError} mode="edit" rev={data.source.rev} />
		<div class="footer">
			<a class="cancel" href={ROUTES.HANGAR_GLOSSARY_SOURCES}>Cancel</a>
			<Button type="submit" variant="primary" size="md">Save changes</Button>
		</div>
	</form>

	{#if !data.source.deletedAt}
		<div class="delete-form">
			<Button variant="danger" size="md" onclick={() => (deleteDialogOpen = true)}>
				Soft-delete this source
			</Button>
			<p class="hint">Soft-delete retains the row for citation integrity; hard delete is admin-only.</p>
		</div>
	{/if}
</section>

<ConfirmDialog
	open={deleteDialogOpen}
	oncancel={() => (deleteDialogOpen = false)}
	title="Soft-delete {data.source.title}?"
	confirmLabel="Soft-delete"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_GLOSSARY_DELETE_ACTION}
	hiddenFields={{ rev: String(data.source.rev) }}
	typedConfirmation={{ label: `Type the source id to confirm: ${data.source.id}`, expected: data.source.id }}
>
	<p>
		The source <code class="mono">{data.source.id}</code> will be marked hidden and disappear from the glossary.
		Sources fan out to many references, so every reference that cites this source will surface a hidden parent.
	</p>
	<p>The row is retained for citation integrity. Recovery requires clearing <code class="mono">deletedAt</code>
		directly in the database; there is no in-app un-delete control yet.</p>
</ConfirmDialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
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
