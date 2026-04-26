<script lang="ts">
import { getScenario } from '@ab/bc-sim';
import { ROUTES, SIM_SCENARIO_ID_VALUES, type SimScenarioId } from '@ab/constants';
import type { Tone } from '@ab/themes';
import Badge from '@ab/ui/components/Badge.svelte';
import {
	formatAbsoluteDate,
	formatElapsed,
	formatGradePercent,
	formatOutcomeLabel,
	formatRelativeTime,
	outcomeTone,
} from '$lib/history/format';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

interface AttemptRow {
	id: string;
	scenarioId: string;
	scenarioTitle: string;
	scenarioHref: string | null;
	outcome: string;
	outcomeLabel: string;
	tone: Tone;
	gradePct: string;
	elapsed: string;
	endedAtAbsolute: string;
	endedAtRelative: string;
	endedAtIso: string;
	reason: string;
	detailHref: string;
}

function asSimScenarioId(value: string): SimScenarioId | null {
	return (SIM_SCENARIO_ID_VALUES as readonly string[]).includes(value) ? (value as SimScenarioId) : null;
}

function buildRow(attempt: PageData['attempts'][number], now: Date): AttemptRow {
	const endedAt = new Date(attempt.endedAt);
	const knownId = asSimScenarioId(attempt.scenarioId);
	const scenarioTitle = knownId ? getScenario(knownId).title : attempt.scenarioId;
	const scenarioHref = knownId ? ROUTES.SIM_SCENARIO(knownId) : null;
	return {
		id: attempt.id,
		scenarioId: attempt.scenarioId,
		scenarioTitle,
		scenarioHref,
		outcome: attempt.outcome,
		outcomeLabel: formatOutcomeLabel(attempt.outcome),
		tone: outcomeTone(attempt.outcome),
		gradePct: formatGradePercent(attempt.gradeTotal),
		elapsed: formatElapsed(attempt.elapsedSeconds),
		endedAtAbsolute: formatAbsoluteDate(endedAt),
		endedAtRelative: formatRelativeTime(endedAt, now),
		endedAtIso: endedAt.toISOString(),
		reason: attempt.reason,
		detailHref: ROUTES.SIM_HISTORY_DETAIL(attempt.id),
	};
}

const rows = $derived.by<readonly AttemptRow[]>(() => {
	const now = new Date();
	return data.attempts.map((attempt) => buildRow(attempt, now));
});
</script>

<svelte:head>
	<title>airboss sim -- history</title>
</svelte:head>

<main>
	<header>
		<h1>Flight history</h1>
		<p class="subtitle">Your most recent sim attempts, newest first.</p>
	</header>

	{#if rows.length === 0}
		<section class="empty" data-testid="history-empty">
			<p>No flights yet -- fly a scenario to see your history.</p>
			<a class="cta" href={ROUTES.SIM_HOME}>Browse scenarios</a>
		</section>
	{:else}
		<section class="table-wrap" aria-label="Recent sim attempts">
			<table>
				<thead>
					<tr>
						<th scope="col">Scenario</th>
						<th scope="col">Outcome</th>
						<th scope="col" class="num">Grade</th>
						<th scope="col" class="num">Elapsed</th>
						<th scope="col">Ended</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						<tr data-testid="history-row" data-attempt-id={row.id}>
							<td>
								<a class="scenario-link" href={row.detailHref}>{row.scenarioTitle}</a>
								{#if row.reason}
									<span class="reason" title={row.reason}>{row.reason}</span>
								{/if}
							</td>
							<td>
								<Badge tone={row.tone} size="sm">{row.outcomeLabel}</Badge>
							</td>
							<td class="num">{row.gradePct}</td>
							<td class="num">{row.elapsed}</td>
							<td>
								<time datetime={row.endedAtIso} title={row.endedAtAbsolute}>{row.endedAtRelative}</time>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
	}

	header {
		margin-bottom: var(--space-xl);
	}

	h1 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-2xl);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}

	.empty {
		padding: var(--space-2xl);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		text-align: center;
		color: var(--ink-muted);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
	}

	.empty p {
		margin: 0;
	}

	.cta {
		color: var(--action-default);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
	}

	.cta:hover,
	.cta:focus-visible {
		text-decoration: underline;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-body);
		color: var(--ink-body);
	}

	th {
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-default);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--font-size-xs);
	}

	td {
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--edge-default);
		vertical-align: top;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tbody tr:hover {
		background: var(--table-row-bg-hover);
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.scenario-link {
		color: var(--ink-body);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
	}

	.scenario-link:hover,
	.scenario-link:focus-visible {
		color: var(--action-default);
		text-decoration: underline;
	}

	.reason {
		display: block;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		margin-top: var(--space-2xs);
	}

	time {
		color: var(--ink-muted);
	}
</style>
