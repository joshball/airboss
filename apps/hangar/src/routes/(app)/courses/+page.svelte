<script lang="ts">
import {
	COURSE_KIND_LABELS,
	COURSE_KIND_VALUES,
	COURSE_KINDS,
	COURSE_SLUG_REGEX,
	COURSE_STATUS_LABELS,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	type CourseKind,
	type CourseStatus,
	ROUTES,
} from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const courses = $derived(data.courses);
const statusFilter = $derived(data.statusFilter);

let creating = $state(false);
let newSlug = $state('');
let newTitle = $state('');
let newDescription = $state('');
let newKind = $state<CourseKind>(COURSE_KINDS.INSTRUCTOR);
let newStatus = $state<CourseStatus>(COURSE_STATUSES.DRAFT);
const slugIsValid = $derived(newSlug === '' || COURSE_SLUG_REGEX.test(newSlug));

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>Courses -- hangar</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Courses"
		subtitle={`${courses.length} course${courses.length === 1 ? '' : 's'} in the corpus.`}
	>
		{#snippet actions()}
			<Button variant="primary" onclick={() => (creating = !creating)}>
				{creating ? 'Cancel' : 'New course'}
			</Button>
		{/snippet}
	</PageHeader>

	{#if form && form.intent === 'createCourse' && form.error}
		<Banner tone="danger">{form.error}</Banner>
	{/if}
	{#if form && form.intent === 'deleteCourse' && form.error}
		<Banner tone="danger">{form.error}</Banner>
	{/if}
	{#if form && form.intent === 'deleteCourse' && form.success}
		<Banner tone="success">Course deleted.</Banner>
	{/if}

	{#if creating}
		<form method="POST" action="?/createCourse" class="create-form">
			<h2 class="create-h">Create course</h2>
			<label class="field">
				<span class="label">Slug</span>
				<input
					type="text"
					name="slug"
					required
					bind:value={newSlug}
					placeholder="weather-comprehensive"
					aria-invalid={!slugIsValid}
				/>
				{#if !slugIsValid}
					<span class="hint hint-error">Slug must match the lowercase-hyphen pattern.</span>
				{:else}
					<span class="hint">Lowercase letters, digits, hyphens (no leading/trailing hyphen).</span>
				{/if}
			</label>
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required maxlength="200" bind:value={newTitle} />
			</label>
			<label class="field">
				<span class="label">Description (optional)</span>
				<textarea name="description" rows="4" bind:value={newDescription}></textarea>
			</label>
			<label class="field">
				<span class="label">Kind</span>
				<select name="kind" bind:value={newKind}>
					{#each COURSE_KIND_VALUES as kind (kind)}
						<option value={kind} disabled={kind === COURSE_KINDS.PERSONAL}>
							{COURSE_KIND_LABELS[kind]}
						</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="label">Status</span>
				<select name="status" bind:value={newStatus}>
					{#each COURSE_STATUS_VALUES as status (status)}
						<option value={status}>{COURSE_STATUS_LABELS[status]}</option>
					{/each}
				</select>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary" disabled={!slugIsValid || newTitle === ''}>Create</Button>
				<Button variant="ghost" onclick={() => (creating = false)}>Cancel</Button>
			</div>
		</form>
	{/if}

	<nav class="status-tabs" aria-label="Status filter">
		{#each ['all', ...COURSE_STATUS_VALUES] as filter (filter)}
			{@const isActive = statusFilter === filter}
			<a
				class="status-tab"
				class:active={isActive}
				href={filter === 'all' ? ROUTES.HANGAR_COURSES : `${ROUTES.HANGAR_COURSES}?status=${filter}`}
				aria-current={isActive ? 'page' : undefined}
			>
				{filter === 'all' ? 'All' : COURSE_STATUS_LABELS[filter as CourseStatus]}
			</a>
		{/each}
	</nav>

	{#if courses.length === 0}
		<EmptyState
			title="No courses"
			body={statusFilter === 'all'
				? 'Use New course to author the first instructor course.'
				: `No courses with status ${statusFilter}. Try the All tab.`}
		/>
	{:else}
		<table class="course-table">
			<thead>
				<tr>
					<th scope="col">Slug</th>
					<th scope="col">Title</th>
					<th scope="col">Kind</th>
					<th scope="col">Status</th>
					<th scope="col" class="num">Sections</th>
					<th scope="col">Updated</th>
					<th scope="col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each courses as course (course.id)}
					<tr>
						<td><code>{course.slug}</code></td>
						<td>
							<a href={ROUTES.HANGAR_COURSE(course.slug)}>{course.title}</a>
						</td>
						<td>{COURSE_KIND_LABELS[course.kind]}</td>
						<td>{COURSE_STATUS_LABELS[course.status]}</td>
						<td class="num">{course.sectionCount}</td>
						<td>{formatDate(course.updatedAt)}</td>
						<td>
							<form method="POST" action="?/deleteCourse" onsubmit={(e) => {
								if (!confirm(`Delete course '${course.slug}'? This removes the YAML directory and the DB row.`)) {
									e.preventDefault();
								}
							}}>
								<input type="hidden" name="slug" value={course.slug} />
								<Button type="submit" variant="danger" size="sm">Delete</Button>
							</form>
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

	.create-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.create-h {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
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

	.hint {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.hint-error {
		color: var(--signal-danger-ink);
	}

	input[type='text'],
	textarea,
	select {
		font: inherit;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--ink-body);
	}

	textarea {
		resize: vertical;
		min-height: 4rem;
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.status-tabs {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.status-tab {
		padding: var(--space-2xs) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
		background: var(--surface-raised);
	}

	.status-tab.active {
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
		color: var(--ink-strong);
	}

	.course-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.course-table th,
	.course-table td {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.course-table th.num,
	.course-table td.num {
		text-align: right;
	}

	.course-table code {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}
</style>
