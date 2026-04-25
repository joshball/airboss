<script lang="ts">
/**
 * Scenario detail -- `/reps/<id>`. Surfaced from the `/session/start`
 * preview so every rep row's ID chip navigates to a real page. Shows the
 * scenario prompt, domain, last-5 attempts, and the canonical entry
 * points for starting a new attempt (always through a session per ADR 012)
 * or browsing all reps.
 *
 * Citations: a "Citations" panel mounts the shared `CitationPicker`
 * (Bundle C) so authors can attach regulations, AC paragraphs, knowledge
 * nodes, or external references. Mirrors the card-editor wiring at
 * `/memory/<id>`. Add/remove submit via SvelteKit form actions and trigger
 * `invalidateAll()` to refresh the chips list without a navigation.
 */

import {
	CITATION_TARGET_LABELS,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	DIFFICULTY_LABELS,
	type Difficulty,
	domainLabel as formatDomain,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Button from '@ab/ui/components/Button.svelte';
import CitationChips, { type CitationChipItem } from '@ab/ui/components/CitationChips.svelte';
import CitationPicker, { type CitationPickerSelection } from '@ab/ui/components/CitationPicker.svelte';
import { humanize } from '@ab/utils';
import { invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const scenario = $derived(data.scenario);
const attempts = $derived(data.recentAttempts);
const citations = $derived(data.citations);

const domainLabel = $derived(formatDomain(scenario.domain));
const difficultyLabel = $derived(
	(DIFFICULTY_LABELS as Record<Difficulty, string>)[scenario.difficulty as Difficulty] ?? humanize(scenario.difficulty),
);

const attemptedCount = $derived(attempts.length);
const correctCount = $derived(attempts.filter((a) => a.isCorrect === true).length);
const accuracyPct = $derived(attemptedCount === 0 ? null : Math.round((correctCount / attemptedCount) * 100));

// Citation state mirrors the card-editor flow at /memory/<id>. The picker
// is controlled via `bind:open`; `onSelect` posts to `?/addCitation` and we
// invalidateAll on success so the server load refreshes the chips list.
let citationPickerOpen = $state(false);
let citationError = $state<string | null>(null);

const citationItems = $derived<CitationChipItem[]>(
	citations.map((c) => ({
		id: c.citation.id,
		typeLabel: targetTypeLabel(c.target.type),
		label: c.target.label,
		href: c.target.href ?? null,
		context: c.citation.citationContext,
	})),
);
const citationRemoveAction = $derived(`${ROUTES.REP_DETAIL(scenario.id)}?/removeCitation`);
const citationTargets = [
	CITATION_TARGET_TYPES.REGULATION_NODE,
	CITATION_TARGET_TYPES.AC_REFERENCE,
	CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
	CITATION_TARGET_TYPES.EXTERNAL_REF,
];

function targetTypeLabel(t: CitationTargetType): string {
	return CITATION_TARGET_LABELS[t];
}

async function handleCitationSelect(selection: CitationPickerSelection): Promise<void> {
	citationError = null;
	const body = new FormData();
	body.set('targetType', selection.targetType);
	body.set('targetId', selection.targetId);
	body.set('note', selection.note);
	const res = await fetch(`${ROUTES.REP_DETAIL(scenario.id)}?/addCitation`, {
		method: 'POST',
		body,
		headers: { accept: 'application/json' },
	});
	if (!res.ok) {
		try {
			const payload = await res.json();
			const message = payload?.data?.fieldErrors?._ ?? 'Could not add citation.';
			throw new Error(message);
		} catch (err) {
			throw err instanceof Error ? err : new Error('Could not add citation.');
		}
	}
	citationPickerOpen = false;
	await invalidateAll();
}

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

	<article class="citations">
		<div class="citations-header">
			<h2>Citations</h2>
			<button type="button" class="btn-add" onclick={() => (citationPickerOpen = true)}>+ Cite a reference</button>
		</div>
		{#if citationError}
			<div class="error" role="alert">{citationError}</div>
		{/if}
		{#if citations.length === 0}
			<p class="muted">No citations yet. Link a regulation, AC, knowledge node, or external reference.</p>
		{:else}
			<CitationChips items={citationItems} editable removeAction={citationRemoveAction} />
		{/if}
	</article>

	<CitationPicker
		bind:open={citationPickerOpen}
		targetTypes={citationTargets}
		onSelect={async (selection) => {
			try {
				await handleCitationSelect(selection);
			} catch (err) {
				citationError = err instanceof Error ? err.message : 'Could not add citation.';
				throw err;
			}
		}}
		onCancel={() => (citationPickerOpen = false)}
	/>

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
	.stats,
	.citations {
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

	.citations-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.btn-add {
		flex: 0 0 auto;
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-strong);
		background: var(--surface-sunken);
		color: var(--ink-body);
		cursor: pointer;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn-add:hover {
		background: var(--edge-default);
	}

	.btn-add:focus-visible {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	.error {
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
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
