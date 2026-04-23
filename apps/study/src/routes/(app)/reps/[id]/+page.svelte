<script lang="ts">
/**
 * Scenario detail -- `/reps/<id>`. Surfaced from the `/session/start`
 * preview so every rep row's ID chip navigates to a real page. Shows the
 * scenario prompt, domain, last-5 attempts, and the canonical entry
 * points for starting a new attempt (always through a session per ADR 012)
 * or browsing all reps.
 */

import { DIFFICULTY_LABELS, type Difficulty, DOMAIN_LABELS, type Domain, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Button from '@ab/ui/components/Button.svelte';
import { humanize } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenario = $derived(data.scenario);
const attempts = $derived(data.recentAttempts);

const domainLabel = $derived(
	(DOMAIN_LABELS as Record<Domain, string>)[scenario.domain as Domain] ?? humanize(scenario.domain),
);
const difficultyLabel = $derived(
	(DIFFICULTY_LABELS as Record<Difficulty, string>)[scenario.difficulty as Difficulty] ?? humanize(scenario.difficulty),
);

const attemptedCount = $derived(attempts.length);
const correctCount = $derived(attempts.filter((a) => a.isCorrect === true).length);
const accuracyPct = $derived(attemptedCount === 0 ? null : Math.round((correctCount / attemptedCount) * 100));

function formatDate(d: Date | null): string {
	if (!d) return '';
	return d.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatMs(ms: number | null): string {
	if (ms === null) return '';
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(1)} s`;
}
</script>

<svelte:head>
	<title>{scenario.title} -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div class="title-row">
			<h1>{scenario.title}</h1>
			<PageHelp pageId="reps-session" />
		</div>
		<dl class="meta">
			<div>
				<dt>Domain</dt>
				<dd>{domainLabel}</dd>
			</div>
			<div>
				<dt>Difficulty</dt>
				<dd>{difficultyLabel}</dd>
			</div>
			{#if scenario.phaseOfFlight}
				<div>
					<dt>Phase of flight</dt>
					<dd>{humanize(scenario.phaseOfFlight)}</dd>
				</div>
			{/if}
		</dl>
	</header>

	<article class="prompt">
		<h2>Situation</h2>
		<p class="situation">{scenario.situation}</p>
	</article>

	<article class="stats">
		<h2>Last 5 attempts</h2>
		{#if attemptedCount === 0}
			<p class="muted">No attempts yet. Start a session to queue this scenario.</p>
		{:else}
			<p class="accuracy">
				<strong>{correctCount}/{attemptedCount}</strong> correct ({accuracyPct}%)
			</p>
			<ol class="attempts">
				{#each attempts as attempt (attempt.id)}
					<li class="attempt" class:is-correct={attempt.isCorrect === true} class:is-incorrect={attempt.isCorrect === false}>
						<span class="result">{attempt.isCorrect ? 'Correct' : 'Incorrect'}</span>
						<span class="when">{formatDate(attempt.completedAt)}</span>
						{#if attempt.confidence !== null}
							<span class="confidence">Confidence {attempt.confidence}/5</span>
						{/if}
						{#if attempt.answerMs !== null}
							<span class="answer-ms">{formatMs(attempt.answerMs)}</span>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</article>

	<footer class="actions">
		<Button variant="primary" href={ROUTES.SESSION_START}>Start a session</Button>
		<Button variant="secondary" href={ROUTES.REPS_BROWSE}>Browse all reps</Button>
	</footer>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.meta {
		margin: 0;
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.meta > div {
		display: flex;
		gap: var(--space-2xs);
		align-items: baseline;
	}

	.meta dt {
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
	}

	.meta dd {
		margin: 0;
		color: var(--ink-body);
	}

	.prompt,
	.stats {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: var(--type-heading-3-weight);
	}

	.situation {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: var(--type-ui-label-line-height);
		white-space: pre-wrap;
	}

	.accuracy {
		margin: 0;
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
	}

	.attempts {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.attempt {
		display: flex;
		gap: var(--space-md);
		align-items: baseline;
		padding: var(--space-xs) var(--space-sm);
		border-left: 3px solid var(--edge-default);
		font-size: var(--type-ui-label-size);
	}

	.attempt.is-correct {
		border-left-color: var(--signal-success);
	}

	.attempt.is-incorrect {
		border-left-color: var(--action-hazard);
	}

	.result {
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-body);
	}

	.when,
	.confidence,
	.answer-ms {
		color: var(--ink-subtle);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.muted {
		color: var(--ink-faint);
		margin: 0;
		font-size: var(--type-ui-label-size);
	}
</style>
