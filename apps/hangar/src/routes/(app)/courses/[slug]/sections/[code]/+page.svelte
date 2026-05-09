<script lang="ts">
import { ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import KnowledgeNodePicker from '$lib/components/KnowledgeNodePicker.svelte';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const slug = $derived(data.slug);
const section = $derived(data.section);
const knowledgeNodes = $derived(data.knowledgeNodes);

// Section form fields seed from server-rendered values once.
// svelte-ignore state_referenced_locally
let sectionTitle = $state(data.section.title);
// svelte-ignore state_referenced_locally
let sectionBody = $state(data.section.body_md);
// svelte-ignore state_referenced_locally
let sectionOrdinal = $state(data.section.ordinal);

// Add-step form state.
let newStepCode = $state('');
let newStepTitle = $state('');
// svelte-ignore state_referenced_locally
let newStepOrdinal = $state(
	data.section.steps.length === 0 ? 1 : Math.max(...data.section.steps.map((s) => s.ordinal)) + 1,
);
let newStepBody = $state('');
let newStepNodeId = $state('');

// Per-row edit state. `editingStepCode === null` means no row is in
// edit mode; otherwise the corresponding step's form is shown inline.
let editingStepCode = $state<string | null>(null);
let editStepTitle = $state('');
let editStepOrdinal = $state(0);
let editStepBody = $state('');
let editStepNodeId = $state('');

function startEdit(step: { code: string; title: string; ordinal: number; body_md: string; knowledge_node_id: string }) {
	editingStepCode = step.code;
	editStepTitle = step.title;
	editStepOrdinal = step.ordinal;
	editStepBody = step.body_md;
	editStepNodeId = step.knowledge_node_id;
}

function cancelEdit() {
	editingStepCode = null;
}

// Re-keyed map for step reorder.
// svelte-ignore state_referenced_locally
let reorderMap = $state<Record<string, number>>(
	data.section.steps.reduce<Record<string, number>>((acc, s) => {
		acc[s.code] = s.ordinal;
		return acc;
	}, {}),
);

function reorderPayload(): string {
	return JSON.stringify(reorderMap);
}
</script>

<svelte:head>
	<title>{section.title} -- {slug} -- hangar</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.HANGAR_COURSES}>Courses</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.HANGAR_COURSE(slug)}>{slug}</a>
		<span aria-hidden="true">/</span>
		<span>{section.code}</span>
	</nav>

	<PageHeader title={section.title} subtitle={`Section ${section.code} (ordinal ${section.ordinal})`} />

	{#if form?.error}
		<Banner tone="danger">{form.error}</Banner>
	{:else if form?.success && form.intent === 'updateSection'}
		<Banner tone="success">Section saved.</Banner>
	{:else if form?.success && form.intent === 'addStep'}
		<Banner tone="success">Step added.</Banner>
	{:else if form?.success && form.intent === 'updateStep'}
		<Banner tone="success">Step saved.</Banner>
	{:else if form?.success && form.intent === 'deleteStep'}
		<Banner tone="success">Step deleted.</Banner>
	{:else if form?.success && form.intent === 'reorderSteps'}
		<Banner tone="success">Steps reordered.</Banner>
	{/if}

	<section class="block" aria-labelledby="section-h">
		<h2 id="section-h">Section</h2>
		<form method="POST" action="?/updateSection" class="form">
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required maxlength="200" bind:value={sectionTitle} />
			</label>
			<label class="field">
				<span class="label">Ordinal</span>
				<input type="number" name="ordinal" min="0" step="1" required bind:value={sectionOrdinal} />
			</label>
			<label class="field">
				<span class="label">Body (markdown, optional)</span>
				<textarea name="body_md" rows="6" bind:value={sectionBody}></textarea>
			</label>
			<div class="form-actions">
				<Button type="submit" variant="primary">Save section</Button>
			</div>
		</form>
	</section>

	<section class="block" aria-labelledby="steps-h">
		<h2 id="steps-h">Steps ({section.steps.length})</h2>
		{#if section.steps.length === 0}
			<EmptyState title="No steps" body="Add the first step to start authoring this section." />
		{:else}
			<table class="step-table">
				<thead>
					<tr>
						<th scope="col" class="num">Ordinal</th>
						<th scope="col">Code</th>
						<th scope="col">Title</th>
						<th scope="col">Knowledge node</th>
						<th scope="col">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each section.steps as step (step.code)}
						<tr>
							<td class="num">
								<input
									type="number"
									min="0"
									step="1"
									value={reorderMap[step.code]}
									oninput={(e) => {
										const next = Number.parseInt((e.target as HTMLInputElement).value, 10);
										if (Number.isInteger(next) && next >= 0) {
											reorderMap = { ...reorderMap, [step.code]: next };
										}
									}}
									class="ordinal-input"
									aria-label={`Ordinal for ${step.code}`}
								/>
							</td>
							<td><code>{step.code}</code></td>
							<td>{step.title}</td>
							<td><code>{step.knowledge_node_id}</code></td>
							<td>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => (editingStepCode === step.code ? cancelEdit() : startEdit(step))}
								>
									{editingStepCode === step.code ? 'Cancel' : 'Edit'}
								</Button>
								<form
									method="POST"
									action="?/deleteStep"
									onsubmit={(e) => {
										if (!confirm(`Delete step '${step.code}'?`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="code" value={step.code} />
									<Button type="submit" variant="danger" size="sm">Delete</Button>
								</form>
							</td>
						</tr>
						{#if editingStepCode === step.code}
							<tr>
								<td colspan="5" class="edit-cell">
									<form method="POST" action="?/updateStep" class="form">
										<input type="hidden" name="code" value={step.code} />
										<label class="field">
											<span class="label">Title</span>
											<input type="text" name="title" required bind:value={editStepTitle} />
										</label>
										<label class="field">
											<span class="label">Ordinal</span>
											<input
												type="number"
												name="ordinal"
												min="0"
												step="1"
												required
												bind:value={editStepOrdinal}
											/>
										</label>
										<label class="field">
											<span class="label">Body (markdown)</span>
											<textarea name="body_md" rows="4" bind:value={editStepBody}></textarea>
										</label>
										<fieldset class="field">
											<legend class="label">Knowledge node</legend>
											<KnowledgeNodePicker
												nodes={knowledgeNodes}
												bind:value={editStepNodeId}
												name="knowledge_node_id"
												required
											/>
										</fieldset>
										<div class="form-actions">
											<Button type="submit" variant="primary">Save step</Button>
											<Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
										</div>
									</form>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
			<form method="POST" action="?/reorderSteps" class="reorder-save-form">
				<input type="hidden" name="ordinals" value={reorderPayload()} />
				<Button type="submit" variant="secondary">Save reorder</Button>
			</form>
		{/if}

		<form method="POST" action="?/addStep" class="add-step-form">
			<h3 class="add-h">Add step</h3>
			<label class="field">
				<span class="label">Code</span>
				<input type="text" name="code" required bind:value={newStepCode} placeholder="s1.1" />
			</label>
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required bind:value={newStepTitle} />
			</label>
			<label class="field">
				<span class="label">Ordinal</span>
				<input type="number" name="ordinal" min="0" step="1" required bind:value={newStepOrdinal} />
			</label>
			<label class="field">
				<span class="label">Body (markdown, optional)</span>
				<textarea name="body_md" rows="3" bind:value={newStepBody}></textarea>
			</label>
			<fieldset class="field">
				<legend class="label">Knowledge node</legend>
				<KnowledgeNodePicker
					nodes={knowledgeNodes}
					bind:value={newStepNodeId}
					name="knowledge_node_id"
					required
				/>
			</fieldset>
			<div class="form-actions">
				<Button type="submit" variant="primary">Add step</Button>
			</div>
		</form>
	</section>
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
	.add-step-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
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
		border: none;
		padding: 0;
	}

	fieldset.field {
		margin: 0;
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	input[type='text'],
	input[type='number'],
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
		min-height: 4rem;
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.step-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.step-table th,
	.step-table td {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.step-table th.num,
	.step-table td.num {
		text-align: right;
	}

	.step-table code {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.ordinal-input {
		width: 5rem;
		text-align: right;
	}

	.edit-cell {
		background: var(--surface-sunken);
	}

	.reorder-save-form {
		display: flex;
		justify-content: flex-end;
	}
</style>
