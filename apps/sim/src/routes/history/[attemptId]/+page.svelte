<script lang="ts">
import { getScenario } from '@ab/bc-sim';
import { ROUTES, SIM_SCENARIO_ID_VALUES, type SimScenarioId } from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import {
	formatAbsoluteDate,
	formatElapsed,
	formatGradePercent,
	formatGradingKind,
	formatOutcomeLabel,
	formatRelativeTime,
	outcomeTone,
} from '$lib/history/format';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

function asSimScenarioId(value: string): SimScenarioId | null {
	return (SIM_SCENARIO_ID_VALUES as readonly string[]).includes(value) ? (value as SimScenarioId) : null;
}

const attempt = $derived(data.attempt);
const knownScenarioId = $derived(asSimScenarioId(attempt.scenarioId));
const scenarioTitle = $derived(knownScenarioId ? getScenario(knownScenarioId).title : attempt.scenarioId);
const scenarioHref = $derived(knownScenarioId ? ROUTES.SIM_SCENARIO(knownScenarioId) : null);
const endedAt = $derived(new Date(attempt.endedAt));
const components = $derived(attempt.grade?.components ?? []);
const tone = $derived(outcomeTone(attempt.outcome));
</script>

<svelte:head>
	<title>airboss sim -- attempt {attempt.id}</title>
</svelte:head>

<main>
	<nav class="back" aria-label="Breadcrumb">
		<a href={ROUTES.SIM_HISTORY}>&larr; Back to history</a>
	</nav>

	<header>
		<h1>{scenarioTitle}</h1>
		<p class="meta">
			<Badge {tone} size="sm">{formatOutcomeLabel(attempt.outcome)}</Badge>
			<span class="reason">{attempt.reason}</span>
		</p>
	</header>

	<section class="summary" aria-label="Attempt summary">
		<dl>
			<div>
				<dt>Grade</dt>
				<dd>{formatGradePercent(attempt.gradeTotal)}</dd>
			</div>
			<div>
				<dt>Elapsed</dt>
				<dd>{formatElapsed(attempt.elapsedSeconds)}</dd>
			</div>
			<div>
				<dt>Ended</dt>
				<dd>
					<time datetime={endedAt.toISOString()} title={formatAbsoluteDate(endedAt)}>
						{formatRelativeTime(endedAt)}
					</time>
				</dd>
			</div>
			{#if scenarioHref}
				<div>
					<dt>Scenario</dt>
					<dd><a href={scenarioHref}>Fly again</a></dd>
				</div>
			{/if}
		</dl>
	</section>

	<section class="components" aria-label="Grade breakdown">
		<h2>Grade breakdown</h2>
		{#if components.length === 0}
			<p class="empty">This scenario has no grading components, or grading was unavailable for this run.</p>
		{:else}
			<ul>
				{#each components as component, idx (`${component.kind}-${idx}`)}
					<li>
						<div class="row">
							<span class="kind">{formatGradingKind(component.kind)}</span>
							<span class="weight">weight {Math.round(component.weight * 100)}%</span>
							<span class="score">{formatGradePercent(component.score)}</span>
						</div>
						<div class="bar" aria-hidden="true">
							<span class="fill" style="width: {Math.max(0, Math.min(1, component.score)) * 100}%"></span>
						</div>
						{#if component.summary}
							<p class="summary-text">{component.summary}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
	}

	.back {
		margin-bottom: var(--space-md);
	}

	.back a {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--font-size-sm);
	}

	.back a:hover,
	.back a:focus-visible {
		color: var(--action-default);
		text-decoration: underline;
	}

	header {
		margin-bottom: var(--space-xl);
	}

	h1 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-2xl);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin: 0;
		flex-wrap: wrap;
	}

	.meta .reason {
		color: var(--ink-muted);
	}

	.summary {
		margin-bottom: var(--space-2xl);
	}

	.summary dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-md);
		margin: 0;
		padding: var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}

	.summary dl > div {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.summary dt {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.summary dd {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
	}

	.summary dd a {
		color: var(--action-default);
		text-decoration: none;
		font-size: var(--font-size-body);
	}

	.summary dd a:hover,
	.summary dd a:focus-visible {
		text-decoration: underline;
	}

	.components h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-lg);
	}

	.components ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
	}

	.components li {
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
		margin-bottom: var(--space-xs);
	}

	.kind {
		font-weight: var(--font-weight-semibold);
	}

	.weight {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		flex: 1;
		text-align: right;
	}

	.score {
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-semibold);
	}

	.bar {
		height: 6px;
		background: var(--surface-muted);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		background: var(--action-default);
		border-radius: inherit;
	}

	.summary-text {
		margin: var(--space-xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.empty {
		color: var(--ink-muted);
		margin: 0;
	}
</style>
