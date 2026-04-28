<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData } from './$types';

let { form }: { form: ActionData } = $props();
const seed = $derived(form?.values);
</script>

<svelte:head>
	<title>New goal -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.GOALS}>{NAV_LABELS.GOALS}</a>
		<span aria-hidden="true">/</span>
		<span>New</span>
	</nav>

	<PageHeader title="New goal" subtitle="Compose what you're pursuing. Add syllabi and nodes after creating." />

	{#if form?.error}
		<p class="banner-error" role="alert">{form.error}</p>
	{/if}

	<form method="POST" class="form">
		<label class="field">
			<span class="label">Title</span>
			<input type="text" name="title" maxlength="200" required value={seed?.title ?? ''} autocomplete="off" />
		</label>

		<label class="field">
			<span class="label">Notes (markdown)</span>
			<textarea name="notesMd" rows="5">{seed?.notesMd ?? ''}</textarea>
		</label>

		<label class="field">
			<span class="label">Target date (optional, YYYY-MM-DD)</span>
			<input type="date" name="targetDate" value={seed?.targetDateRaw ?? ''} />
		</label>

		<label class="checkbox">
			<input type="checkbox" name="isPrimary" checked={seed?.isPrimary ?? false} />
			<span>Set as primary goal (only one allowed; replaces any existing)</span>
		</label>

		<div class="actions">
			<Button href={ROUTES.GOALS} variant="ghost">Cancel</Button>
			<Button type="submit" variant="primary">Create goal</Button>
		</div>
	</form>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 50rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.banner-error {
		margin: 0;
		padding: var(--space-md);
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
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
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	input[type='text'],
	input[type='date'],
	textarea {
		font: inherit;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--ink-body);
	}

	textarea {
		resize: vertical;
		min-height: 6rem;
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
	}

	.checkbox {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
		margin-top: var(--space-md);
	}
</style>
