<script lang="ts">
import {
	COURSE_KIND_LABELS,
	COURSE_STATUS_LABELS,
	COURSE_STATUS_VALUES,
	type CourseStatus,
	ROUTES,
} from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const slug = $derived(data.slug);
const manifest = $derived(data.manifest);
const sections = $derived(data.sections);
const orphans = $derived(data.orphans);

// Manifest form fields seed from server-rendered values once; the user
// types to change them. `state_referenced_locally` on the initial seed
// is intentional (matches the glossary editor pattern).
// svelte-ignore state_referenced_locally
let manifestTitle = $state(data.manifest.title);
// svelte-ignore state_referenced_locally
let manifestDescription = $state(data.manifest.description);
// svelte-ignore state_referenced_locally
let manifestStatus = $state<CourseStatus>(data.manifest.status);

let newSectionCode = $state('');
let newSectionTitle = $state('');
// svelte-ignore state_referenced_locally
let newSectionOrdinal = $state(data.sections.length === 0 ? 1 : Math.max(...data.sections.map((s) => s.ordinal)) + 1);
let newSectionBody = $state('');

// Re-keyed map of `filename -> ordinal` -- bound to the inputs in the
// reorder column. Submission serialises to JSON and posts to the
// reorderSections action.
// svelte-ignore state_referenced_locally
let reorderMap = $state<Record<string, number>>(
	data.sections.reduce<Record<string, number>>((acc, s) => {
		acc[s.filename] = s.ordinal;
		return acc;
	}, {}),
);

function reorderPayload(): string {
	return JSON.stringify(reorderMap);
}
</script>

<svelte:head>
	<title>{manifest.title} -- hangar courses</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.HANGAR_COURSES}>Courses</a>
		<span aria-hidden="true">/</span>
		<span>{manifest.title}</span>
	</nav>

	<PageHeader
		eyebrow={`${COURSE_KIND_LABELS[manifest.kind]} -- ${COURSE_STATUS_LABELS[manifest.status]}`}
		title={manifest.title}
		subtitle={`Slug: ${slug}`}
	/>

	{#if form?.error}
		<Banner tone="danger">{form.error}</Banner>
	{:else if form?.success && form.intent === 'updateManifest'}
		<Banner tone="success">Manifest saved.</Banner>
	{:else if form?.success && form.intent === 'addSection'}
		<Banner tone="success">Section added.</Banner>
	{:else if form?.success && form.intent === 'deleteSection'}
		<Banner tone="success">Section deleted.</Banner>
	{:else if form?.success && form.intent === 'reorderSections'}
		<Banner tone="success">Sections reordered.</Banner>
	{:else if form?.success && form.intent === 'cleanupOrphans'}
		<Banner tone="success">{form.removed} orphan row(s) removed.</Banner>
	{/if}

	<section class="block" aria-labelledby="manifest-h">
		<h2 id="manifest-h">Manifest</h2>
		<form method="POST" action="?/updateManifest" class="form">
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required maxlength="200" bind:value={manifestTitle} />
			</label>
			<label class="field">
				<span class="label">Description</span>
				<textarea name="description" rows="5" bind:value={manifestDescription}></textarea>
			</label>
			<label class="field">
				<span class="label">Status</span>
				<select name="status" bind:value={manifestStatus}>
					{#each COURSE_STATUS_VALUES as status (status)}
						<option value={status}>{COURSE_STATUS_LABELS[status]}</option>
					{/each}
				</select>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Save manifest</Button>
			</div>
		</form>
	</section>

	<section class="block" aria-labelledby="sections-h">
		<h2 id="sections-h">Sections ({sections.length})</h2>
		{#if sections.length === 0}
			<EmptyState title="No sections" body="Add the first section to start authoring this course." />
		{:else}
			<table class="section-table">
				<thead>
					<tr>
						<th scope="col" class="num">Ordinal</th>
						<th scope="col">Code</th>
						<th scope="col">Title</th>
						<th scope="col" class="num">Steps</th>
						<th scope="col">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each sections as section (section.filename)}
						<tr>
							<td class="num">
								<input
									type="number"
									min="0"
									step="1"
									value={reorderMap[section.filename]}
									oninput={(e) => {
										const next = Number.parseInt((e.target as HTMLInputElement).value, 10);
										if (Number.isInteger(next) && next >= 0) {
											reorderMap = { ...reorderMap, [section.filename]: next };
										}
									}}
									class="ordinal-input"
									aria-label={`Ordinal for ${section.code}`}
								/>
							</td>
							<td><code>{section.code}</code></td>
							<td><a href={ROUTES.HANGAR_COURSE_SECTION(slug, section.code)}>{section.title}</a></td>
							<td class="num">{section.stepCount}</td>
							<td>
								<form method="POST" action="?/deleteSection" onsubmit={(e) => {
									if (!confirm(`Delete section '${section.code}'?`)) e.preventDefault();
								}}>
									<input type="hidden" name="filename" value={section.filename} />
									<Button type="submit" variant="danger" size="sm">Delete</Button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<form method="POST" action="?/reorderSections" class="reorder-save-form">
				<input type="hidden" name="ordinals" value={reorderPayload()} />
				<Button type="submit" variant="secondary">Save reorder</Button>
			</form>
		{/if}

		<form method="POST" action="?/addSection" class="add-section-form">
			<h3 class="add-h">Add section</h3>
			<label class="field">
				<span class="label">Code</span>
				<input type="text" name="code" required bind:value={newSectionCode} placeholder="s1" />
			</label>
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required bind:value={newSectionTitle} />
			</label>
			<label class="field">
				<span class="label">Ordinal</span>
				<input type="number" name="ordinal" min="0" step="1" required bind:value={newSectionOrdinal} />
			</label>
			<label class="field">
				<span class="label">Body (optional)</span>
				<textarea name="body_md" rows="3" bind:value={newSectionBody}></textarea>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Add section</Button>
			</div>
		</form>
	</section>

	{#if orphans.length > 0}
		<section class="block" aria-labelledby="orphans-h">
			<h2 id="orphans-h">Orphan rows ({orphans.length})</h2>
			<p class="orphans-blurb">
				These rows exist in the database but no longer in the YAML files (a section or step you deleted, or a code you renamed).
				Run cleanup to delete them. Course-level deletes go through the Delete action on the course list.
			</p>
			<ul class="orphan-list">
				{#each orphans as o (o.id)}
					<li><code>{o.code}</code> -- {o.level} -- {o.title}</li>
				{/each}
			</ul>
			<form method="POST" action="?/cleanupOrphans">
				<Button type="submit" variant="danger">Remove orphans</Button>
			</form>
		</section>
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

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.block h2 {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.form,
	.add-section-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.reorder-save-form {
		display: flex;
		justify-content: flex-end;
	}

	.add-h {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-faint);
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
	input[type='number'],
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

	.section-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.section-table th,
	.section-table td {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.section-table th.num,
	.section-table td.num {
		text-align: right;
	}

	.section-table code {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.ordinal-input {
		width: 5rem;
		text-align: right;
	}

	.orphans-blurb {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.orphan-list {
		list-style: disc;
		padding-left: var(--space-lg);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.orphan-list code {
		font-family: var(--font-family-mono, monospace);
	}
</style>
