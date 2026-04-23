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
		gap: var(--ab-space-xl);
	}

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.meta {
		margin: 0;
		display: flex;
		gap: var(--ab-space-lg);
		flex-wrap: wrap;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-sm);
	}

	.meta > div {
		display: flex;
		gap: var(--ab-space-2xs);
		align-items: baseline;
	}

	.meta dt {
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--ab-font-size-xs);
	}

	.meta dd {
		margin: 0;
		color: var(--ab-color-fg);
	}

	.prompt,
	.stats {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-lg) var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	h2 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: var(--ab-font-weight-semibold);
	}

	.situation {
		margin: 0;
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-body);
		line-height: var(--ab-line-height-normal);
		white-space: pre-wrap;
	}

	.accuracy {
		margin: 0;
		font-size: var(--ab-font-size-body);
		color: var(--ab-color-fg);
	}

	.attempts {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
	}

	.attempt {
		display: flex;
		gap: var(--ab-space-md);
		align-items: baseline;
		padding: var(--ab-space-xs) var(--ab-space-sm);
		border-left: 3px solid var(--ab-color-border);
		font-size: var(--ab-font-size-sm);
	}

	.attempt.is-correct {
		border-left-color: var(--ab-color-success);
	}

	.attempt.is-incorrect {
		border-left-color: var(--ab-color-danger);
	}

	.result {
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg);
	}

	.when,
	.confidence,
	.answer-ms {
		color: var(--ab-color-fg-subtle);
	}

	.actions {
		display: flex;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	.muted {
		color: var(--ab-color-fg-faint);
		margin: 0;
		font-size: var(--ab-font-size-sm);
	}
</style>
