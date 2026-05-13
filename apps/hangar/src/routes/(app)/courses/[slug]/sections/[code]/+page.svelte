<script lang="ts">
import type { CourseStep } from '@ab/bc-study';
import { COURSE_STEP_LEVELS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import KnowledgeNodePicker from '$lib/components/KnowledgeNodePicker.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const course = $derived(data.course);
const section = $derived(data.section);
const pickerNodes = $derived(data.pickerNodes);

// Hangar's editor today authors at the leaf-step level only. The
// course-tree-arbitrary-depth WP's recursive YAML schema accepts any
// depth (sections / lessons / steps); a nested-tree editor UI is
// captured in OUT-OF-SCOPE.md "Hangar editor UI" and lands in a
// follow-up. Until then the UI lists only direct leaf steps for
// editing; sections that already contain lesson interiors on disk
// surface a read-only banner so the author knows lesson content
// exists but must be edited via the YAML file. Save actions
// (addStep / updateStep / deleteStep) operate only on leaf steps;
// surrounding lesson rows round-trip unchanged through the emitter.
const leafSteps = $derived(section.steps.filter((node) => node.level !== COURSE_STEP_LEVELS.LESSON) as CourseStep[]);
const hasLessons = $derived(section.steps.length !== leafSteps.length);

let editingStepCode = $state<string | null>(null);
let showAddStep = $state(false);
let pickerValue = $state('');

function startEdit(code: string): void {
	editingStepCode = code;
	const step = leafSteps.find((s) => s.code === code);
	pickerValue = step?.knowledge_node_id ?? '';
}

function cancelEdit(): void {
	editingStepCode = null;
	pickerValue = '';
}
</script>

<svelte:head>
	<title>Section {section.code} -- {course.title} -- Hangar -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.HANGAR_COURSES}>Courses</a></li>
			<li><a href={ROUTES.HANGAR_COURSE(course.slug)}>{course.title}</a></li>
			<li aria-current="page">Section {section.code}</li>
		</ol>
	</nav>

	<PageHeader title={section.title} subtitle={`Section ${section.code} (ordinal ${section.ordinal})`} />

	{#if form?.error}
		<p class="banner banner-error" role="alert">{form.error}</p>
	{:else if form?.success === true}
		<p class="banner banner-ok" role="status">Saved.</p>
	{/if}

	<section class="block" aria-labelledby="section-h">
		<h2 id="section-h">Section</h2>
		<form method="POST" action="?/updateSection" class="form">
			<div class="row-fields">
				<label class="field">
					<span class="label">Code</span>
					<input type="text" disabled value={section.code} />
				</label>
				<label class="field">
					<span class="label">Ordinal</span>
					<input type="number" name="ordinal" min="0" required value={section.ordinal} />
				</label>
				<label class="field grow">
					<span class="label">Title</span>
					<input type="text" name="title" maxlength="200" required value={section.title} />
				</label>
			</div>
			<label class="field">
				<span class="label">Body (markdown)</span>
				<textarea name="body_md" rows="6">{section.body_md}</textarea>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Save section</Button>
			</div>
		</form>
	</section>

	<section class="block" aria-labelledby="steps-h">
		<header class="block-head">
			<h2 id="steps-h">Steps ({section.steps.length})</h2>
			<Button
				onclick={() => {
					showAddStep = !showAddStep;
					pickerValue = '';
				}}
				variant="secondary"
			>
				{showAddStep ? 'Cancel' : 'Add step'}
			</Button>
		</header>

		{#if showAddStep}
			<form method="POST" action="?/addStep" class="form add-step-form">
				<div class="row-fields">
					<label class="field">
						<span class="label">Code</span>
						<input type="text" name="code" required placeholder={`${section.code}.${section.steps.length + 1}`} />
					</label>
					<label class="field">
						<span class="label">Ordinal</span>
						<input type="number" name="ordinal" min="0" required value={section.steps.length + 1} />
					</label>
					<label class="field grow">
						<span class="label">Title</span>
						<input type="text" name="title" maxlength="200" required placeholder="Step title" />
					</label>
				</div>
				<label class="field">
					<span class="label">Knowledge node</span>
					<KnowledgeNodePicker nodes={pickerNodes} bind:value={pickerValue} />
				</label>
				<label class="field">
					<span class="label">Body (markdown)</span>
					<textarea name="body_md" rows="4"></textarea>
				</label>
				<div class="form-actions">
					<Button type="submit" variant="primary">Add step</Button>
				</div>
			</form>
		{/if}

		{#if hasLessons}
			<p class="banner banner-warn" role="status">
				This section contains lesson interiors authored on disk. The editor shows only the leaf
				steps below; lesson rows round-trip unchanged on save. Nested-lesson editing in the UI
				lands in a follow-up (see the work package's OUT-OF-SCOPE notes). Edit the YAML file
				directly to change lesson rows for now.
			</p>
		{/if}
		{#if leafSteps.length === 0}
			<EmptyState title="No steps yet" body="Add a step to link a knowledge node into this section." />
		{:else}
			<ol class="step-list">
				{#each leafSteps as step (step.code)}
					<li class="step-row">
						{#if editingStepCode === step.code}
							<form method="POST" action="?/updateStep" class="form edit-step-form">
								<input type="hidden" name="originalCode" value={step.code} />
								<div class="row-fields">
									<label class="field">
										<span class="label">Code</span>
										<input type="text" name="code" required value={step.code} />
									</label>
									<label class="field">
										<span class="label">Ordinal</span>
										<input type="number" name="ordinal" min="0" required value={step.ordinal} />
									</label>
									<label class="field grow">
										<span class="label">Title</span>
										<input type="text" name="title" maxlength="200" required value={step.title} />
									</label>
								</div>
								<label class="field">
									<span class="label">Knowledge node</span>
									<KnowledgeNodePicker nodes={pickerNodes} bind:value={pickerValue} />
								</label>
								<label class="field">
									<span class="label">Body (markdown)</span>
									<textarea name="body_md" rows="4">{step.body_md}</textarea>
								</label>
								<div class="form-actions">
									<Button type="button" onclick={cancelEdit} variant="ghost">Cancel</Button>
									<Button type="submit" variant="primary">Save step</Button>
								</div>
							</form>
						{:else}
							<div class="step-display">
								<div class="step-meta">
									<span class="step-ordinal">{step.ordinal}</span>
									<code class="step-code">{step.code}</code>
									<span class="step-title">{step.title}</span>
								</div>
								<div class="step-node">
									Linked node:
									<code>{step.knowledge_node_id ?? '(missing)'}</code>
								</div>
								{#if step.body_md !== undefined && step.body_md !== ''}
									<details class="step-body">
										<summary>Body ({step.body_md.length} chars)</summary>
										<pre>{step.body_md}</pre>
									</details>
								{/if}
								<div class="step-actions">
									<Button onclick={() => startEdit(step.code)} variant="ghost">Edit</Button>
									<form method="POST" action="?/deleteStep" class="inline">
										<input type="hidden" name="stepCode" value={step.code} />
										<Button
											type="submit"
											variant="ghost"
											onclick={(e) => {
												if (!confirm(`Delete step "${step.title}"?`)) e.preventDefault();
											}}
										>
											Delete
										</Button>
									</form>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
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

	.banner-ok {
		background: var(--signal-success-wash);
		color: var(--ink-body);
		border-color: var(--signal-success-edge);
	}

	.banner-warn {
		background: var(--signal-warning-wash);
		color: var(--ink-body);
		border-color: var(--signal-warning-edge);
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
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.add-step-form,
	.edit-step-form {
		background: var(--surface-muted);
		padding: var(--space-md);
		border-radius: var(--radius-md);
	}

	.step-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.step-row {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.step-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.step-meta {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.step-ordinal {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		min-width: 1.5em;
		text-align: center;
	}

	.step-code {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.step-title {
		font-weight: 500;
		color: var(--ink-body);
	}

	.step-node {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.step-node code {
		font-family: var(--font-family-mono);
		color: var(--action-default-hover);
	}

	.step-body summary {
		cursor: pointer;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.step-body pre {
		margin: var(--space-xs) 0 0;
		padding: var(--space-sm);
		background: var(--surface-muted);
		border-radius: var(--radius-md);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		white-space: pre-wrap;
	}

	.step-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.inline {
		display: inline-block;
	}
</style>
