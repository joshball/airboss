<script lang="ts">
import { DOMAIN_LABELS, KNOWLEDGE_PHASE_LABELS, type KnowledgePhase, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { humanize, renderMarkdown } from '@ab/utils';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';
import ActivityHost from './ActivityHost.svelte';

let { data }: { data: PageData } = $props();

const node = $derived(data.node);
const phases = $derived(data.phases);
const totalPhases = $derived(phases.length);

// svelte-ignore state_referenced_locally -- seed from server-validated deep link; URL syncs thereafter
let currentPhase = $state<KnowledgePhase>(data.initialPhase);
// svelte-ignore state_referenced_locally -- server-seeded; client optimistic-updates on visit/complete
let visitedPhases = $state<Set<string>>(new Set(data.progress.visitedPhases));
// svelte-ignore state_referenced_locally
let completedPhases = $state<Set<string>>(new Set(data.progress.completedPhases));
let completing = $state(false);

const stepIndex = $derived(
	Math.max(
		0,
		phases.findIndex((p) => p.phase === currentPhase),
	),
);
const currentPhaseNode = $derived(phases[stepIndex]);
const progressPct = $derived(Math.round(((stepIndex + 1) / totalPhases) * 100));
const currentCompleted = $derived(completedPhases.has(currentPhase));

// Keep the URL in sync with the active phase. `replaceState` avoids piling up
// history entries for each click (back button still goes up a level, not
// back through the stepper).
$effect(() => {
	const phase = currentPhase;
	const url = new URL(page.url);
	if (url.searchParams.get(QUERY_PARAMS.STEP) === phase) return;
	url.searchParams.set(QUERY_PARAMS.STEP, phase);
	replaceState(url, page.state);
});

// Persist phase visits. Fires whenever `currentPhase` changes, including the
// initial load. Optimistic client update + server write; failures are quiet
// (progress is a UX signal, not a decision-maker).
$effect(() => {
	const phase = currentPhase;
	if (visitedPhases.has(phase)) return;
	visitedPhases = new Set([...visitedPhases, phase]);
	void recordVisit(phase);
});

async function recordVisit(phase: KnowledgePhase): Promise<void> {
	try {
		const formData = new FormData();
		formData.set('phase', phase);
		await fetch('?/visitPhase', { method: 'POST', body: formData });
	} catch {
		// Silently ignore; local visited-set is already updated.
	}
}

async function markGotIt(): Promise<void> {
	if (completing) return;
	const phase = currentPhase;
	completing = true;
	completedPhases = new Set([...completedPhases, phase]);
	try {
		const formData = new FormData();
		formData.set('phase', phase);
		await fetch('?/completePhase', { method: 'POST', body: formData });
	} catch {
		// Silently ignore; local completed-set is already updated.
	} finally {
		completing = false;
	}
}

function prev(): void {
	if (stepIndex > 0) currentPhase = phases[stepIndex - 1].phase;
}

function next(): void {
	if (stepIndex < totalPhases - 1) currentPhase = phases[stepIndex + 1].phase;
}

function selectPhase(phase: KnowledgePhase): void {
	currentPhase = phase;
}

function phaseLabel(phase: string): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<string, string>)[phase] ?? humanize(phase);
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}
</script>

<svelte:head>
	<title>Learn: {node.title} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.KNOWLEDGE}>Knowledge</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.KNOWLEDGE_SLUG(node.id)}>{node.title}</a>
		<span aria-hidden="true">/</span>
		<span>Learn</span>
	</nav>

	<header class="hd">
		<h1>{node.title}</h1>
		<p class="sub">Guided walkthrough of the seven-phase content model. {domainLabel(node.domain)}.</p>
	</header>

	<section class="progress" aria-label="Progress">
		<div class="progress-head">
			<span class="progress-step">Phase {stepIndex + 1} of {totalPhases}: {phaseLabel(currentPhase)}</span>
			<span class="progress-pct">{progressPct}%</span>
		</div>
		<div
			class="progress-bar"
			role="progressbar"
			aria-valuemin="1"
			aria-valuemax={totalPhases}
			aria-valuenow={stepIndex + 1}
		>
			<span class="progress-fill" style:width="{progressPct}%"></span>
		</div>
		<ol class="steps" aria-label="Phases">
			{#each phases as p, i (p.phase)}
				{@const isVisited = visitedPhases.has(p.phase)}
				{@const isCompleted = completedPhases.has(p.phase)}
				<li>
					<button
						type="button"
						class="step"
						class:active={p.phase === currentPhase}
						class:authored={p.body !== null}
						class:visited={isVisited}
						class:completed={isCompleted}
						aria-current={p.phase === currentPhase ? 'step' : undefined}
						aria-label="Phase {i + 1}: {phaseLabel(p.phase)}{isCompleted
							? ' (completed)'
							: isVisited
								? ' (visited)'
								: ''}"
						onclick={() => selectPhase(p.phase)}
					>
						<span class="step-num" aria-hidden="true">
							{#if isCompleted}
								&#10003;
							{:else}
								{i + 1}
							{/if}
						</span>
						<span class="step-name">{phaseLabel(p.phase)}</span>
					</button>
				</li>
			{/each}
		</ol>
	</section>

	<article class="phase" aria-labelledby="phase-heading">
		<h2 id="phase-heading">{phaseLabel(currentPhase)}</h2>
		{#if currentPhaseNode?.body}
			<div class="prose">{@html renderMarkdown(currentPhaseNode.body)}</div>
		{:else}
			<p class="gap-body">Not yet authored. This phase is part of the skeleton -- feel free to skip ahead.</p>
		{/if}
		{#each currentPhaseNode?.activityIds ?? [] as activityId (activityId)}
			<ActivityHost {activityId} />
		{/each}

		<div class="got-it-row">
			{#if currentCompleted}
				<span class="got-it-done" aria-live="polite">&#10003; Marked as understood</span>
			{:else}
				<button type="button" class="btn secondary" onclick={markGotIt} disabled={completing}>
					{completing ? 'Saving...' : 'Got it'}
				</button>
			{/if}
		</div>
	</article>

	<nav class="controls" aria-label="Phase navigation">
		{#if stepIndex === 0}
			<a class="btn secondary" href={ROUTES.KNOWLEDGE_SLUG(node.id)}>Back to node</a>
		{:else}
			<button type="button" class="btn secondary" onclick={prev}>Previous</button>
		{/if}
		{#if stepIndex === totalPhases - 1}
			<a class="btn primary" href={ROUTES.MEMORY_REVIEW_FOR_NODE(node.id)}>Review cards for this node</a>
		{:else}
			<button type="button" class="btn primary" onclick={next}>Next phase</button>
		{/if}
	</nav>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.crumb {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #64748b;
	}

	.crumb a {
		color: #1d4ed8;
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.progress {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.progress-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.progress-step {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #0f172a;
	}

	.progress-pct {
		font-size: 0.8125rem;
		color: #64748b;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: #2563eb;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.25rem;
	}

	.step {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding: 0.375rem 0.25rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		font: inherit;
		color: #94a3b8;
		transition:
			background var(--ab-transition-fast),
			color var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.step:hover {
		background: #f1f5f9;
		color: #475569;
	}

	.step:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.step.authored {
		color: #475569;
	}

	.step.visited:not(.active) {
		background: #f8fafc;
		color: #334155;
	}

	.step.completed:not(.active) {
		background: #f0fdf4;
		color: #166534;
		border-color: #bbf7d0;
	}

	.step.active {
		background: #eff6ff;
		color: #1d4ed8;
		border-color: #bfdbfe;
	}

	.got-it-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px dashed #e2e8f0;
	}

	.got-it-done {
		color: #166534;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.step-num {
		font-size: 0.75rem;
		font-weight: 700;
		color: inherit;
	}

	.step-name {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.phase {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
	}

	.phase h2 {
		margin: 0 0 0.75rem;
		font-size: 1.25rem;
		color: #0f172a;
	}

	.gap-body {
		margin: 0;
		color: #94a3b8;
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: 1rem 0 0.5rem;
		color: #0f172a;
	}

	.prose :global(p) {
		margin: 0 0 0.75rem;
		line-height: 1.6;
		color: #1e293b;
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 0.75rem 1.25rem;
		line-height: 1.6;
		color: #1e293b;
	}

	.prose :global(li) {
		margin-bottom: 0.25rem;
	}

	.prose :global(code) {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.875em;
		background: #f1f5f9;
		padding: 0.05em 0.35em;
		border-radius: 4px;
	}

	.prose :global(pre) {
		background: #0f172a;
		color: #e2e8f0;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		overflow-x: auto;
		font-size: 0.875rem;
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: #1d4ed8;
	}

	.prose :global(strong) {
		color: #0f172a;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.625rem 1.125rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		text-decoration: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover:not(:disabled) {
		background: #e2e8f0;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.steps {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
