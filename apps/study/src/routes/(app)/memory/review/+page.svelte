<script lang="ts">
import { summarizeDeckSpec } from '@ab/bc-study';
import { QUERY_PARAMS, REVIEW_SESSION_STATUSES, ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// `data.prompt` is set when the resolver found an in-progress run for the
// `?deck=<...>` request and wants the user to choose Resume vs Start fresh
// (review-sessions-url Layer (b) Redo, decision 4). When it's null the
// `load` function already redirected, so this template is only reached if
// SvelteKit kept us on the route (the auth-bounce fallback below).
const prompt = $derived(data.prompt);

function fmtTimestamp(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function formatProgress(currentIndex: number, totalCards: number, status: string): string {
	if (totalCards === 0) return 'Empty deck';
	const label = status === REVIEW_SESSION_STATUSES.ABANDONED ? 'Last touched' : 'In progress';
	return `${label} -- ${currentIndex} of ${totalCards} reviewed`;
}
</script>

<svelte:head>
	<title>Review -- airboss</title>
</svelte:head>

{#if prompt}
	<section class="page">
		<PageHeader title="Resume your run?" subtitle={summarizeDeckSpec(prompt.deckSpec)} />

		<article class="card">
			<div class="card-row">
				<span class="card-label">Progress</span>
				<span class="card-value">
					{formatProgress(prompt.session.currentIndex, prompt.session.totalCards, prompt.session.status)}
				</span>
			</div>
			<div class="card-row">
				<span class="card-label">Started</span>
				<span class="card-value">{fmtTimestamp(prompt.session.startedAt)}</span>
			</div>
			<div class="card-row">
				<span class="card-label">Last activity</span>
				<span class="card-value">{fmtTimestamp(prompt.session.lastActivityAt)}</span>
			</div>

			<div class="actions">
				<form method="POST" action="?/resume">
					<input type="hidden" name={QUERY_PARAMS.DECK} value={prompt.deckParam} />
					<button class="btn primary" type="submit">Resume run</button>
				</form>
				<form method="POST" action="?/fresh">
					<input type="hidden" name={QUERY_PARAMS.DECK} value={prompt.deckParam} />
					<button class="btn secondary" type="submit">Start fresh</button>
				</form>
			</div>

			<p class="note">Starting fresh leaves your in-progress run untouched; you can come back to it from the
				memory dashboard.</p>
		</article>

		<p class="back"><a href={ROUTES.MEMORY}>Back to memory</a></p>
	</section>
{:else}
	<!--
		The server `load` redirected to `/memory/review/<sessionId>` for both
		the no-`?deck` path and the "no resumable run" branch. This fallback
		only fires when an auth bounce flipped the redirect to /login first.
	-->
	<section class="page">
		<p class="loading">Preparing your review...</p>
		<p class="back"><a href={ROUTES.MEMORY}>Back to memory</a></p>
	</section>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		max-width: 32rem;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-lg);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-xl);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}

	.card-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
	}

	.card-label {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.card-value {
		color: var(--ink-body);
		font-weight: 500;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		margin-top: var(--space-sm);
	}

	.actions form {
		display: contents;
	}

	.note {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--font-size-sm);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.loading {
		color: var(--ink-muted);
	}

	.back {
		margin: 0;
	}

	.back a {
		color: var(--action-default-hover);
	}
</style>
