<script lang="ts">
import {
	DOMAIN_LABELS,
	type Domain,
	KNOWLEDGE_PHASE_LABELS,
	type KnowledgePhase,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
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
let completeError = $state<string | null>(null);

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
	completeError = null;
	// Optimistic: update the local set so the UI reflects the click
	// immediately. On failure, roll back and surface a recoverable banner.
	const previousCompleted = completedPhases;
	completedPhases = new Set([...completedPhases, phase]);
	try {
		const formData = new FormData();
		formData.set('phase', phase);
		const response = await fetch('?/completePhase', { method: 'POST', body: formData });
		if (!response.ok) {
			completedPhases = previousCompleted;
			completeError = 'Could not save your progress. Try again.';
		}
	} catch {
		completedPhases = previousCompleted;
		completeError = 'Could not reach the server. Your progress was not saved.';
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
	return (KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase as KnowledgePhase] ?? humanize(phase);
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
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
		<div class="title-row">
			<h1>{node.title}</h1>
			<PageHelp pageId="knowledge-graph" />
		</div>
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

		{#if completeError}
			<Banner tone="danger" dismissible onDismiss={() => (completeError = null)}>{completeError}</Banner>
		{/if}

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
		gap: var(--space-xl);
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--font-size-xl);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-body);
	}

	.progress {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.progress-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.progress-step {
		font-size: var(--font-size-body);
		font-weight: 600;
		color: var(--ink-body);
	}

	.progress-pct {
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--space-2xs);
	}

	.step {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-xs) var(--space-2xs);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		font: inherit;
		color: var(--ink-faint);
		transition:
			background var(--motion-fast),
			color var(--motion-fast),
			border-color var(--motion-fast);
	}

	.step:hover {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.step:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.step.authored {
		color: var(--ink-muted);
	}

	.step.visited:not(.active) {
		background: var(--surface-muted);
		color: var(--ink-strong);
	}

	.step.completed:not(.active) {
		background: var(--signal-success-wash);
		color: var(--signal-success);
		border-color: var(--signal-success-edge);
	}

	.step.active {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border-color: var(--action-default-edge);
	}

	.got-it-row {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-lg);
		padding-top: var(--space-lg);
		border-top: 1px dashed var(--edge-default);
	}

	.got-it-done {
		color: var(--signal-success);
		font-size: var(--font-size-sm);
		font-weight: 500;
	}

	.step-num {
		font-size: var(--font-size-xs);
		font-weight: 700;
		color: inherit;
	}

	.step-name {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.phase {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
	}

	.phase h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-xl);
		color: var(--ink-body);
	}

	.gap-body {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: var(--space-lg) 0 var(--space-sm);
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.6;
		color: var(--ink-body);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-md) var(--space-xl);
		line-height: 1.6;
		color: var(--ink-body);
	}

	.prose :global(li) {
		margin-bottom: var(--space-2xs);
	}

	.prose :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
	}

	.prose :global(pre) {
		background: var(--ink-body);
		color: var(--edge-default);
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		overflow-x: auto;
		font-size: var(--font-size-sm);
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: var(--action-default-hover);
	}

	.prose :global(strong) {
		color: var(--ink-body);
	}

	.controls {
		display: flex;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		text-decoration: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--edge-default);
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
