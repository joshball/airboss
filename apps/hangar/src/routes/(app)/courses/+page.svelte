<script lang="ts">
import {
	COURSE_KIND_LABELS,
	COURSE_SLUG_REGEX_SOURCE,
	COURSE_STATUS_LABELS,
	COURSE_STATUSES,
	COURSE_TITLE_MAX_LENGTH,
	type CourseKind,
	type CourseStatus,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const rows = $derived(data.rows);
const statusFilter = $derived(data.statusFilter);
const isEmpty = $derived(rows.length === 0);

function statusLabel(status: string): string {
	return COURSE_STATUS_LABELS[status as CourseStatus] ?? status;
}

function kindLabel(kind: string): string {
	return COURSE_KIND_LABELS[kind as CourseKind] ?? kind;
}

function formatDate(date: Date | string): string {
	const d = date instanceof Date ? date : new Date(date);
	return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: '', label: 'All' },
	{ value: COURSE_STATUSES.DRAFT, label: 'Draft' },
	{ value: COURSE_STATUSES.ACTIVE, label: 'Active' },
	{ value: COURSE_STATUSES.ARCHIVED, label: 'Archived' },
];

let showCreateForm = $state(false);
let slugInput = $state<HTMLInputElement | null>(null);

// Move focus into the create form when it is revealed so a keyboard user
// is not stranded on the toggle button.
$effect(() => {
	if (showCreateForm) slugInput?.focus();
});
</script>

<svelte:head>
	<title>Courses -- Hangar -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Courses" subtitle="Author instructor-led courses. Edits write YAML and re-run the seed pipeline.">
		{#snippet actions()}
			<Button onclick={() => (showCreateForm = !showCreateForm)} variant="primary">
				{showCreateForm ? 'Cancel' : 'New course'}
			</Button>
		{/snippet}
	</PageHeader>

	<div class="banner-live" aria-live="assertive">
		{#if form?.error}
			<p class="banner banner-error" role="alert">{form.error}</p>
		{/if}
	</div>

	{#if showCreateForm}
		<form method="POST" action={ROUTES.HANGAR_COURSE_CREATE_ACTION} class="create-form">
			<label class="field">
				<span class="label">Slug (kebab-case) <span class="req">required</span></span>
				<input
					type="text"
					name="slug"
					required
					aria-required="true"
					pattern={COURSE_SLUG_REGEX_SOURCE}
					placeholder="weather-comprehensive"
					bind:this={slugInput}
				/>
			</label>
			<label class="field">
				<span class="label">Title <span class="req">required</span></span>
				<input type="text" name="title" required aria-required="true" maxlength={COURSE_TITLE_MAX_LENGTH} placeholder="Weather Comprehensive" />
			</label>
			<label class="field">
				<span class="label">Description (optional)</span>
				<textarea name="description" rows="3"></textarea>
			</label>
			<label class="field">
				<span class="label">Initial status</span>
				<select name="status">
					<option value={COURSE_STATUSES.DRAFT}>Draft</option>
					<option value={COURSE_STATUSES.ACTIVE} selected>Active</option>
					<option value={COURSE_STATUSES.ARCHIVED}>Archived</option>
				</select>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Create</Button>
			</div>
		</form>
	{/if}

	<form method="GET" class="filter-bar">
		<label class="field-inline">
			<span class="label">Status</span>
			<select name={QUERY_PARAMS.STATUS}>
				{#each STATUS_OPTIONS as opt (opt.value)}
					<option value={opt.value} selected={statusFilter === opt.value || (statusFilter === null && opt.value === '')}>
						{opt.label}
					</option>
				{/each}
			</select>
		</label>
		<Button type="submit" variant="secondary">Apply</Button>
	</form>

	{#if isEmpty}
		<EmptyState
			title="No courses found"
			body="No courses match the current filter. Author one with the New course button above; the file lands at course/courses/<slug>/manifest.yaml."
		/>
	{:else}
		<table class="rows">
			<thead>
				<tr>
					<th scope="col">Slug</th>
					<th scope="col">Title</th>
					<th scope="col">Status</th>
					<th scope="col">Kind</th>
					<th scope="col" class="num">Sections</th>
					<th scope="col">Updated</th>
					<th scope="col"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.course.id)}
					<tr>
						<td><code class="slug">{row.course.slug}</code></td>
						<td>{row.course.title}</td>
						<td><span class="status-badge status-{row.course.status}">{statusLabel(row.course.status)}</span></td>
						<td>{kindLabel(row.course.kind)}</td>
						<td class="num">{row.sectionCount}</td>
						<td>{formatDate(row.course.updatedAt)}</td>
						<td class="actions">
							<a class="edit-link" href={ROUTES.HANGAR_COURSE(row.course.slug)}>Edit</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.banner-live:empty {
		display: none;
	}

	.banner {
		margin: 0;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid;
	}

	.banner-error {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-edge);
	}

	.req {
		font-size: var(--type-ui-caption-size);
		font-weight: 400;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.field-inline {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-muted);
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.filter-bar {
		display: flex;
		gap: var(--space-md);
	}

	.rows {
		width: 100%;
		border-collapse: collapse;
	}

	.rows th,
	.rows td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-default);
		text-align: left;
		font-size: var(--type-definition-body-size);
	}

	.rows th {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.rows .num {
		text-align: right;
	}

	.rows .actions {
		text-align: right;
	}

	.slug {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.status-draft {
		color: var(--ink-faint);
		background: var(--surface-sunken);
	}

	.status-active {
		color: var(--signal-success);
		background: var(--signal-success-wash);
	}

	.status-archived {
		color: var(--ink-faint);
		background: var(--surface-muted);
	}

	.edit-link {
		color: var(--action-default-hover);
		font-weight: 600;
		text-decoration: none;
	}

	.edit-link:hover {
		text-decoration: underline;
	}
</style>
