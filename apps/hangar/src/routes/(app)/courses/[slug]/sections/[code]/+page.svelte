<script lang="ts">
import type { CourseStep } from '@ab/bc-study';
import { COURSE_STEP_LEVELS, COURSE_TITLE_MAX_LENGTH, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
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
let addStepCodeInput = $state<HTMLInputElement | null>(null);

// Per-action success message: name what happened rather than a generic
// "Saved." The action returns a discriminating `intent`.
const SUCCESS_MESSAGES: Record<string, string> = {
	updateSection: 'Section updated.',
	addStep: 'Step added.',
	updateStep: 'Step updated.',
	deleteStep: 'Step deleted.',
};
const successMessage = $derived(form?.success === true ? (SUCCESS_MESSAGES[form.intent ?? ''] ?? 'Saved.') : null);

// Move focus into the add-step form when it is revealed.
$effect(() => {
	if (showAddStep) addStepCodeInput?.focus();
});

function startEdit(code: string): void {
	// Editing and adding are mutually exclusive -- close the add-step form
	// so only one KnowledgeNodePicker (one `pickerValue`) is mounted.
	showAddStep = false;
	editingStepCode = code;
	const step = leafSteps.find((s) => s.code === code);
	pickerValue = step?.knowledge_node_id ?? '';
}

function cancelEdit(): void {
	editingStepCode = null;
	pickerValue = '';
}

function toggleAddStep(): void {
	// Closing any in-progress row edit keeps a single picker mounted.
	editingStepCode = null;
	showAddStep = !showAddStep;
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

	<section class="block" aria-labelledby="section-h">
		<h2 id="section-h">Section</h2>
		<form method="POST" action={ROUTES.HANGAR_COURSE_UPDATE_SECTION_ACTION} class="form">
			<div class="row-fields">
				<label class="field">
					<span class="label">Code</span>
					<input type="text" disabled value={section.code} aria-describedby="section-code-help" />
					<span id="section-code-help" class="field-help">Code is fixed once a section is created.</span>
				</label>
				<label class="field">
					<span class="label">Ordinal <span class="req">required</span></span>
					<input type="number" name="ordinal" min="0" required aria-required="true" value={section.ordinal} />
				</label>
				<label class="field grow">
					<span class="label">Title <span class="req">required</span></span>
					<input type="text" name="title" maxlength={COURSE_TITLE_MAX_LENGTH} required aria-required="true" value={section.title} />
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
			<Button onclick={toggleAddStep} variant="secondary">
				{showAddStep ? 'Cancel' : 'Add step'}
			</Button>
		</header>

		{#if showAddStep}
			<form method="POST" action={ROUTES.HANGAR_COURSE_ADD_STEP_ACTION} class="form add-step-form">
				<div class="row-fields">
					<label class="field">
						<span class="label">Code <span class="req">required</span></span>
						<input
							type="text"
							name="code"
							required
							aria-required="true"
							placeholder={`${section.code}.${section.steps.length + 1}`}
							bind:this={addStepCodeInput}
						/>
					</label>
					<label class="field">
						<span class="label">Ordinal <span class="req">required</span></span>
						<input type="number" name="ordinal" min="0" required aria-required="true" value={section.steps.length + 1} />
					</label>
					<label class="field grow">
						<span class="label">Title <span class="req">required</span></span>
						<input type="text" name="title" maxlength={COURSE_TITLE_MAX_LENGTH} required aria-required="true" placeholder="Step title" />
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
							<form method="POST" action={ROUTES.HANGAR_COURSE_UPDATE_STEP_ACTION} class="form edit-step-form">
								<input type="hidden" name="originalCode" value={step.code} />
								<div class="row-fields">
									<label class="field">
										<span class="label">Code <span class="req">required</span></span>
										<input type="text" name="code" required aria-required="true" value={step.code} />
									</label>
									<label class="field">
										<span class="label">Ordinal <span class="req">required</span></span>
										<input type="number" name="ordinal" min="0" required aria-required="true" value={step.ordinal} />
									</label>
									<label class="field grow">
										<span class="label">Title <span class="req">required</span></span>
										<input type="text" name="title" maxlength={COURSE_TITLE_MAX_LENGTH} required aria-required="true" value={step.title} />
									</label>
								</div>
								<label class="field">
									<span class="label">Knowledge node</span>
									<!-- Key the picker on the edited code so it remounts with
									     fresh internal filter state when the row switches. -->
									{#key editingStepCode}
										<KnowledgeNodePicker nodes={pickerNodes} bind:value={pickerValue} />
									{/key}
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
										<summary>Body for {step.code} ({step.body_md.length} chars)</summary>
										<pre>{step.body_md}</pre>
									</details>
								{/if}
								<div class="step-actions">
									<Button onclick={() => startEdit(step.code)} variant="ghost">Edit</Button>
									<ConfirmAction
										label="Delete"
										confirmLabel="Delete step"
										formAction={ROUTES.HANGAR_COURSE_DELETE_STEP_ACTION}
										hiddenFields={{ stepCode: step.code }}
									/>
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

	.req {
		font-size: var(--type-ui-caption-size);
		font-weight: 400;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.field-help {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
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
</style>
