<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import { enhance } from '$app/forms';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

let saving = $state(false);

const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'New task' },
];

const fieldErrors = $derived<Record<string, string>>(
	form && 'errors' in form && typeof form.errors === 'object' && form.errors !== null
		? (form.errors as Record<string, string>)
		: {},
);
interface InitialValues {
	readonly title: string;
	readonly description: string;
	readonly type: string;
	readonly productArea: string;
	readonly columnId: string;
	readonly assigneeId: string;
}
const initialValues = $derived<InitialValues | null>(
	form && 'values' in form && typeof form.values === 'object' && form.values !== null
		? (form.values as InitialValues)
		: null,
);
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>New ad-hoc task</h1>
	<p class="meta">A task lives on the review board alongside spec / TOC / knowledge-node items.</p>
</header>

{#if fieldErrors._form}
	<Banner tone="danger">{fieldErrors._form}</Banner>
{/if}

<Card>
	<form
		method="POST"
		class="form"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					saving = false;
				}
			};
		}}
	>
		<label class="field">
			<span class="label">Title</span>
			<input
				name="title"
				type="text"
				required
				maxlength="200"
				value={initialValues?.title ?? ''}
				aria-invalid={fieldErrors.title ? 'true' : undefined}
				aria-describedby={fieldErrors.title ? 'err-title' : undefined}
			/>
			{#if fieldErrors.title}
				<small id="err-title" class="err">{fieldErrors.title}</small>
			{/if}
		</label>

		<label class="field">
			<span class="label">Description</span>
			<textarea name="description" rows="4" placeholder="Optional context.">{initialValues?.description ?? ''}</textarea>
		</label>

		<div class="row">
			<label class="field">
				<span class="label">Type</span>
				<select
					name="type"
					required
					aria-invalid={fieldErrors.type ? 'true' : undefined}
					aria-describedby={fieldErrors.type ? 'err-type' : undefined}
				>
					<option value="">-- select --</option>
					{#each data.taskTypes as t (t.id)}
						<option value={t.id} selected={initialValues?.type === t.id}>{t.label}</option>
					{/each}
				</select>
				{#if fieldErrors.type}
					<small id="err-type" class="err">{fieldErrors.type}</small>
				{/if}
			</label>

			<label class="field">
				<span class="label">Product area</span>
				<select
					name="productArea"
					required
					aria-invalid={fieldErrors.productArea ? 'true' : undefined}
					aria-describedby={fieldErrors.productArea ? 'err-area' : undefined}
				>
					<option value="">-- select --</option>
					{#each data.productAreas as a (a.id)}
						<option value={a.id} selected={initialValues?.productArea === a.id}>{a.label}</option>
					{/each}
				</select>
				{#if fieldErrors.productArea}
					<small id="err-area" class="err">{fieldErrors.productArea}</small>
				{/if}
			</label>
		</div>

		<label class="field">
			<span class="label">Column</span>
			<select name="columnId">
				<option value="">{data.defaultColumnName} (default)</option>
				{#each data.columns as c (c.id)}
					<option value={c.id} selected={initialValues?.columnId === c.id}>{c.name}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Assignee user id (optional)</span>
			<input name="assigneeId" type="text" value={initialValues?.assigneeId ?? ''} />
			<small class="hint">User id (e.g. <code>auth_xxxx</code>). Leave blank to assign later.</small>
		</label>

		<div class="actions">
			<Button type="submit" variant="primary" loading={saving} loadingLabel="Saving...">Create task</Button>
			<a class="cancel" href={ROUTES.HANGAR_REVIEW}>Cancel</a>
		</div>
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

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	@media (max-width: 600px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	input,
	textarea,
	select {
		font: inherit;
		font-size: var(--type-ui-control-size);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.err {
		color: var(--signal-danger-ink);
		font-size: var(--type-ui-caption-size);
	}

	.actions {
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}

	.cancel {
		color: var(--link-default);
	}
</style>
