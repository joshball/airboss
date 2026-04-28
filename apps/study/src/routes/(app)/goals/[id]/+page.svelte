<script lang="ts">
import {
	domainLabel,
	GOAL_STATUS_LABELS,
	GOAL_STATUSES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	type GoalStatus,
	NAV_LABELS,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const goal = $derived(data.goal);
const syllabi = $derived(data.syllabi);
const nodes = $derived(data.nodes);
const availableSyllabi = $derived(data.availableSyllabi);
const availableNodes = $derived(data.availableNodes);
const syllabusTitleById = $derived(data.syllabusTitleById);
const editing = $derived(page.url.searchParams.get(QUERY_PARAMS.EDIT) === '1');
const detailHref = $derived(ROUTES.GOAL(goal.id));
const editHref = $derived(ROUTES.GOAL_EDIT(goal.id));
</script>

<svelte:head>
	<title>{goal.title} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.GOALS}>{NAV_LABELS.GOALS}</a>
		<span aria-hidden="true">/</span>
		<span>{goal.title}</span>
	</nav>

	<PageHeader
		eyebrow={GOAL_STATUS_LABELS[goal.status as GoalStatus]}
		title={goal.isPrimary ? `★ ${goal.title}` : goal.title}
		subtitle={goal.targetDate ? `Target: ${goal.targetDate}` : undefined}
	>
		{#snippet actions()}
			{#if editing}
				<Button href={detailHref} variant="ghost">Cancel</Button>
			{:else}
				<Button href={editHref} variant="secondary">Edit</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form?.error}
		<p class="banner-error" role="alert">{form.error}</p>
	{/if}

	{#if editing}
		<form method="POST" action="?/update" class="form">
			<label class="field">
				<span class="label">Title</span>
				<input type="text" name="title" required maxlength="200" value={goal.title} />
			</label>
			<label class="field">
				<span class="label">Notes</span>
				<textarea name="notesMd" rows="6">{goal.notesMd}</textarea>
			</label>
			<label class="field">
				<span class="label">Target date (optional)</span>
				<input type="date" name="targetDate" value={goal.targetDate ?? ''} />
			</label>
			<div class="form-actions">
				<Button href={detailHref} variant="ghost">Cancel</Button>
				<Button type="submit" variant="primary">Save</Button>
			</div>
		</form>
	{:else}
		{#if goal.notesMd !== ''}
			<article class="notes" aria-label="Goal notes">
				<pre>{goal.notesMd}</pre>
			</article>
		{/if}

		<aside class="status-bar" aria-label="Goal lifecycle">
			{#if !goal.isPrimary && goal.status === GOAL_STATUSES.ACTIVE}
				<form method="POST" action="?/makePrimary">
					<Button type="submit" variant="secondary">Make primary</Button>
				</form>
			{/if}
			{#if goal.status === GOAL_STATUSES.ACTIVE}
				<form method="POST" action="?/setStatus">
					<input type="hidden" name="status" value={GOAL_STATUSES.PAUSED} />
					<Button type="submit" variant="ghost">Pause</Button>
				</form>
				<form method="POST" action="?/setStatus">
					<input type="hidden" name="status" value={GOAL_STATUSES.COMPLETED} />
					<Button type="submit" variant="ghost">Mark complete</Button>
				</form>
			{:else if goal.status === GOAL_STATUSES.PAUSED}
				<form method="POST" action="?/setStatus">
					<input type="hidden" name="status" value={GOAL_STATUSES.ACTIVE} />
					<Button type="submit" variant="secondary">Resume</Button>
				</form>
			{/if}
			<form method="POST" action="?/archive">
				<Button type="submit" variant="danger">Archive</Button>
			</form>
		</aside>
	{/if}

	<section class="block" aria-labelledby="syllabi-h">
		<header class="block-head">
			<h2 id="syllabi-h">Syllabi ({syllabi.length})</h2>
		</header>
		{#if syllabi.length === 0}
			<EmptyState
				title="No syllabi"
				body="Add an ACS or PTS syllabus from a credential to bring its leaves into this goal."
			/>
		{:else}
			<ul class="row-list">
				{#each syllabi as gs (gs.syllabusId)}
					<li class="row">
						<span class="row-title">{syllabusTitleById[gs.syllabusId] ?? gs.syllabusId}</span>
						<form method="POST" action="?/setSyllabusWeight" class="weight-form">
							<input type="hidden" name="syllabusId" value={gs.syllabusId} />
							<label class="weight-label">
								Weight
								<input
									type="number"
									name="weight"
									min={GOAL_SYLLABUS_WEIGHT_MIN}
									max={GOAL_SYLLABUS_WEIGHT_MAX}
									step="0.1"
									value={gs.weight}
								/>
							</label>
							<Button type="submit" variant="ghost">Save</Button>
						</form>
						<form method="POST" action="?/removeSyllabus">
							<input type="hidden" name="syllabusId" value={gs.syllabusId} />
							<Button type="submit" variant="ghost">Remove</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		{#if availableSyllabi.length > 0}
			<form method="POST" action="?/addSyllabus" class="add-form">
				<label class="field-inline">
					<span class="label">Add syllabus</span>
					<select name="syllabusId">
						{#each availableSyllabi as opt (opt.id)}
							<option value={opt.id}>{opt.credentialTitle} -- {opt.syllabusTitle}</option>
						{/each}
					</select>
				</label>
				<Button type="submit" variant="primary">Add</Button>
			</form>
		{/if}
	</section>

	<section class="block" aria-labelledby="nodes-h">
		<header class="block-head">
			<h2 id="nodes-h">Knowledge nodes ({nodes.length})</h2>
		</header>
		{#if nodes.length === 0}
			<EmptyState
				title="No ad-hoc nodes"
				body="Add specific knowledge nodes that don't come in via a syllabus -- weak areas, personal interest, exam prep gaps."
			/>
		{:else}
			<ul class="row-list">
				{#each nodes as gn (gn.knowledgeNodeId)}
					<li class="row">
						<a class="row-title" href={ROUTES.KNOWLEDGE_SLUG(gn.knowledgeNodeId)}>{gn.knowledgeNodeId}</a>
						<form method="POST" action="?/setNodeWeight" class="weight-form">
							<input type="hidden" name="knowledgeNodeId" value={gn.knowledgeNodeId} />
							<label class="weight-label">
								Weight
								<input
									type="number"
									name="weight"
									min={GOAL_SYLLABUS_WEIGHT_MIN}
									max={GOAL_SYLLABUS_WEIGHT_MAX}
									step="0.1"
									value={gn.weight}
								/>
							</label>
							<Button type="submit" variant="ghost">Save</Button>
						</form>
						<form method="POST" action="?/removeNode">
							<input type="hidden" name="knowledgeNodeId" value={gn.knowledgeNodeId} />
							<Button type="submit" variant="ghost">Remove</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		{#if availableNodes.length > 0}
			<form method="POST" action="?/addNode" class="add-form">
				<label class="field-inline">
					<span class="label">Add node</span>
					<select name="knowledgeNodeId">
						{#each availableNodes as opt (opt.id)}
							<option value={opt.id}>{opt.title} ({domainLabel(opt.domain)})</option>
						{/each}
					</select>
				</label>
				<Button type="submit" variant="primary">Add</Button>
			</form>
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

	.notes {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.notes pre {
		margin: 0;
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.status-bar {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
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

	.field-inline {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		flex: 1 1 18rem;
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	input[type='text'],
	input[type='date'],
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
		min-height: 6rem;
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
	}

	.form-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.block-head h2 {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.row-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
	}

	.row-title {
		color: var(--action-link);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
	}

	.weight-form {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.weight-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.weight-label input {
		width: 5rem;
	}

	.add-form {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-end;
		padding: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		flex-wrap: wrap;
	}
</style>
