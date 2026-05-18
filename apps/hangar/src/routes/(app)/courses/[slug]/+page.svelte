<script lang="ts">
import {
	COURSE_STATUS_LABELS,
	COURSE_STATUSES,
	COURSE_TITLE_MAX_LENGTH,
	type CourseStatus,
	ROUTES,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const course = $derived(data.course);
const sections = $derived(data.sections);
const orphans = $derived(data.orphans);

let showAddSection = $state(false);
let addSectionCodeInput = $state<HTMLInputElement | null>(null);

// Move focus into the add-section form when it is revealed.
$effect(() => {
	if (showAddSection) addSectionCodeInput?.focus();
});

function statusLabel(status: string): string {
	return COURSE_STATUS_LABELS[status as CourseStatus] ?? status;
}

// Per-action success message -- the action returns a discriminating
// `intent`, so the banner names what happened rather than a generic "Saved."
const SUCCESS_MESSAGES: Record<string, string> = {
	updateManifest: 'Manifest updated.',
	addSection: 'Section added.',
	deleteSection: 'Section deleted.',
};
const successMessage = $derived.by(() => {
	if (form?.success !== true) return null;
	if (form.intent === 'cleanupOrphans') {
		const removed = typeof form.removed === 'number' ? form.removed : 0;
		return removed === 0 ? 'No orphan rows to remove.' : `Removed ${removed} orphan row${removed === 1 ? '' : 's'}.`;
	}
	return SUCCESS_MESSAGES[form.intent ?? ''] ?? 'Saved.';
});

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: COURSE_STATUSES.DRAFT, label: 'Draft' },
	{ value: COURSE_STATUSES.ACTIVE, label: 'Active' },
	{ value: COURSE_STATUSES.ARCHIVED, label: 'Archived' },
];
</script>

<svelte:head>
	<title>{course.title} -- Courses -- Hangar -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.HANGAR_COURSES}>Courses</a></li>
			<li aria-current="page">{course.title}</li>
		</ol>
	</nav>

	<PageHeader title={course.title} subtitle={`Slug: ${course.slug}`} />

	<div class="banner-live" aria-live="assertive">
		{#if form?.error}
			<p class="banner banner-error" role="alert">{form.error}</p>
		{/if}
	</div>
	<div class="banner-live" aria-live="polite">
		{#if successMessage !== null}
			<p class="banner banner-ok" role="status">{successMessage}</p>
		{/if}
	</div>

	<section class="block" aria-labelledby="manifest-h">
		<h2 id="manifest-h">Manifest</h2>
		<form method="POST" action={ROUTES.HANGAR_COURSE_UPDATE_MANIFEST_ACTION} class="form">
			<label class="field">
				<span class="label">Title <span class="req">required</span></span>
				<input type="text" name="title" required aria-required="true" maxlength={COURSE_TITLE_MAX_LENGTH} value={course.title} />
			</label>
			<label class="field">
				<span class="label">Description (markdown)</span>
				<textarea name="description" rows="6">{course.description}</textarea>
			</label>
			<label class="field">
				<span class="label">Status</span>
				<select name="status">
					{#each STATUS_OPTIONS as opt (opt.value)}
						<option value={opt.value} selected={course.status === opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Save manifest</Button>
				<span class="status-line">Current status: {statusLabel(course.status)}</span>
			</div>
		</form>
	</section>

	<section class="block" aria-labelledby="sections-h">
		<header class="block-head">
			<h2 id="sections-h">Sections ({sections.length})</h2>
			<Button onclick={() => (showAddSection = !showAddSection)} variant="secondary">
				{showAddSection ? 'Cancel' : 'Add section'}
			</Button>
		</header>

		{#if showAddSection}
			<form method="POST" action={ROUTES.HANGAR_COURSE_ADD_SECTION_ACTION} class="form add-section-form">
				<div class="row-fields">
					<label class="field">
						<span class="label">Code <span class="req">required</span></span>
						<input type="text" name="code" required aria-required="true" placeholder="s1" bind:this={addSectionCodeInput} />
					</label>
					<label class="field">
						<span class="label">Ordinal <span class="req">required</span></span>
						<input type="number" name="ordinal" required aria-required="true" min="0" value={sections.length + 1} />
					</label>
					<label class="field grow">
						<span class="label">Title <span class="req">required</span></span>
						<input type="text" name="title" required aria-required="true" maxlength={COURSE_TITLE_MAX_LENGTH} placeholder="Section title" />
					</label>
				</div>
				<label class="field">
					<span class="label">Body (markdown, optional)</span>
					<textarea name="body_md" rows="3"></textarea>
				</label>
				<div class="form-actions">
					<Button type="submit" variant="primary">Add section</Button>
				</div>
			</form>
		{/if}

		{#if sections.length === 0}
			<EmptyState
				title="No sections yet"
				body="Add a section to start authoring. Sections hold steps; steps link knowledge nodes."
			/>
		{:else}
			<table class="rows">
				<thead>
					<tr>
						<th scope="col" class="num">Ordinal</th>
						<th scope="col">Code</th>
						<th scope="col">Title</th>
						<th scope="col" class="num">Steps</th>
						<th scope="col" class="actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each sections as section (section.code)}
						<tr>
							<td class="num">{section.ordinal}</td>
							<td><code class="code">{section.code}</code></td>
							<td>
								<a href={ROUTES.HANGAR_COURSE_SECTION(course.slug, section.code)} class="section-link">
									{section.title}
								</a>
							</td>
							<td class="num">{section.stepCount}</td>
							<td class="actions">
								<ConfirmAction
									label="Delete"
									confirmLabel="Delete section"
									formAction={ROUTES.HANGAR_COURSE_DELETE_SECTION_ACTION}
									hiddenFields={{ filename: section.filename }}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	{#if orphans.length > 0}
		<section class="block orphan-block" aria-labelledby="orphans-h">
			<header class="block-head">
				<h2 id="orphans-h">Orphan rows ({orphans.length})</h2>
			</header>
			<p class="orphan-note">
				These section / step rows live in the DB but have no matching YAML file on disk. The seed pipeline
				will not auto-delete them. Cleanup is explicit.
			</p>
			<ul class="orphans">
				{#each orphans as orphan (orphan.id)}
					<li><code>{orphan.code}</code> -- {orphan.title}</li>
				{/each}
			</ul>
			<form method="POST" action={ROUTES.HANGAR_COURSE_CLEANUP_ORPHANS_ACTION}>
				<Button type="submit" variant="danger">Remove orphans</Button>
			</form>
		</section>
	{/if}

	<section class="block danger-zone" aria-labelledby="danger-h">
		<h2 id="danger-h">Danger zone</h2>
		<p class="danger-text">
			Deleting removes the course directory and the course row. Steps cascade. A course referenced by any
			goal blocks the delete -- remove it from those goals first.
		</p>
		<ConfirmAction
			label="Delete course"
			confirmLabel="Delete permanently"
			formAction={ROUTES.HANGAR_COURSE_DELETE_ACTION}
		/>
	</section>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 70rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.crumb li + li::before {
		content: '/';
		margin-right: var(--space-sm);
		color: var(--ink-faint);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
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
		color: var(--signal-danger-deep-ink);
		border-color: var(--signal-danger-edge);
	}

	.banner-ok {
		background: var(--signal-success-wash);
		color: var(--ink-body);
		border-color: var(--signal-success-edge);
	}

	.req {
		font-size: var(--type-ui-caption-size);
		font-weight: 400;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
	}

	.block-head h2 {
		margin: 0;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.field.grow {
		flex: 1;
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-muted);
	}

	.row-fields {
		display: flex;
		gap: var(--space-md);
	}

	.form-actions {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.status-line {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.add-section-form {
		background: var(--surface-muted);
		padding: var(--space-md);
		border-radius: var(--radius-md);
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
		width: 5rem;
	}

	.rows .actions {
		text-align: right;
		width: 8rem;
	}

	.code {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.section-link {
		color: var(--action-default-hover);
		font-weight: 500;
		text-decoration: none;
	}

	.section-link:hover {
		text-decoration: underline;
	}

	.orphan-block {
		border-color: var(--signal-warning-edge);
		background: var(--signal-warning-wash);
	}

	.orphan-note {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.orphans {
		list-style: none;
		padding: 0;
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
	}

	.danger-zone {
		border-color: var(--signal-danger-edge);
	}

	.danger-text {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
	}
</style>
