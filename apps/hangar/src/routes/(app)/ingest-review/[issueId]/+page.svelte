<script lang="ts">
import type { Candidate, HandbookCaptionOrphanPayload, HandbookImageOrphanPayload } from '@ab/bc-ingest-review';
import {
	INGEST_ACTIONS_BY_KIND,
	INGEST_ISSUE_KIND_LABELS,
	INGEST_OVERRIDE_ACTION_LABELS,
	INGEST_REVIEW,
	type IngestOverrideAction,
	ROUTES,
} from '@ab/constants';
import { enhance } from '$app/forms';
import CandidateStrip from '$lib/ingest-review/CandidateStrip.svelte';
import { pdfLinkFor } from '$lib/ingest-review/pdf-link';
import StatusBadge from '$lib/ingest-review/StatusBadge.svelte';
import type { PageProps } from './$types';

const { data, form }: PageProps = $props();

let selected = $state<Candidate | null>(null);

const captionPayload = $derived.by(() => {
	if (data.issue.kind !== INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN) return null;
	return data.issue.payload as HandbookCaptionOrphanPayload;
});

const imagePayload = $derived.by(() => {
	if (data.issue.kind !== INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN) return null;
	return data.issue.payload as HandbookImageOrphanPayload;
});

const allowedActions = $derived(INGEST_ACTIONS_BY_KIND[data.issue.kind]);

const pdfHref = $derived(
	pdfLinkFor(data.cacheRoot, {
		corpus: data.issue.corpus,
		sourceId: data.issue.sourceId,
		edition: data.issue.edition,
		pageNum: data.issue.pageNum,
	}),
);

function pairFormAction(): string {
	return ROUTES.HANGAR_INGEST_REVIEW_PAIR_ACTION;
}

function actionEndpoint(action: IngestOverrideAction): string {
	switch (action) {
		case INGEST_REVIEW.ACTIONS.PAIR:
			return ROUTES.HANGAR_INGEST_REVIEW_PAIR_ACTION;
		case INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE:
			return ROUTES.HANGAR_INGEST_REVIEW_MARK_NO_FIGURE_ACTION;
		case INGEST_REVIEW.ACTIONS.MARK_FALSE_CAPTION:
			return ROUTES.HANGAR_INGEST_REVIEW_MARK_FALSE_CAPTION_ACTION;
		case INGEST_REVIEW.ACTIONS.MARK_EXTRANEOUS:
			return ROUTES.HANGAR_INGEST_REVIEW_MARK_EXTRANEOUS_ACTION;
		case INGEST_REVIEW.ACTIONS.MARK_DECORATIVE:
			return ROUTES.HANGAR_INGEST_REVIEW_MARK_DECORATIVE_ACTION;
		default: {
			const exhaustive: never = action;
			return exhaustive as string;
		}
	}
}

function pairPayloadJson(): string {
	if (!selected) return '{}';
	if (data.issue.kind === INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN) {
		const p = selected.payload as { figureId?: unknown; imagePage?: unknown; imageXref?: unknown };
		return JSON.stringify({
			figureId: typeof p.figureId === 'string' ? p.figureId : selected.id,
			imagePage: typeof p.imagePage === 'number' ? p.imagePage : selected.pageNum,
			imageXref: typeof p.imageXref === 'number' ? p.imageXref : 0,
		});
	}
	if (data.issue.kind === INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN) {
		const p = selected.payload as { captionExternalId?: unknown; captionPage?: unknown };
		return JSON.stringify({
			captionExternalId: typeof p.captionExternalId === 'string' ? p.captionExternalId : selected.id,
			captionPage: typeof p.captionPage === 'number' ? p.captionPage : selected.pageNum,
		});
	}
	return '{}';
}
</script>

<a class="back" href={ROUTES.HANGAR_INGEST_REVIEW}>&larr; Back to queue</a>

<article class="orphan-card">
	<header>
		<h2>{INGEST_ISSUE_KIND_LABELS[data.issue.kind]}</h2>
		<dl class="meta">
			<div><dt>Source</dt><dd>{data.issue.sourceId}{#if data.issue.edition} ({data.issue.edition}){/if}</dd></div>
			<div><dt>Page</dt><dd>{data.issue.pageNum ?? '-'}</dd></div>
			<div><dt>Status</dt><dd><StatusBadge status={data.issue.status} /></dd></div>
			<div><dt>External id</dt><dd><code>{data.issue.externalId}</code></dd></div>
		</dl>
	</header>

	{#if captionPayload}
		<section class="caption">
			<h3>Caption</h3>
			<blockquote>{captionPayload.captionText}</blockquote>
			<p class="mode">Detected mode: <code>{captionPayload.mode}</code> &middot; section <code>{captionPayload.sectionCode}</code></p>
		</section>
	{/if}

	{#if imagePayload}
		<section class="image-info">
			<h3>Image</h3>
			<p>Image index <code>{imagePayload.imageIndex}</code> on section <code>{imagePayload.sectionCode}</code> ({imagePayload.width}x{imagePayload.height} px).</p>
		</section>
	{/if}

	<section class="candidates">
		<h3>Candidates</h3>
		<CandidateStrip
			candidates={data.candidates}
			selectedId={selected?.id ?? null}
			onSelect={(c) => (selected = c)}
		/>
	</section>

	{#if data.currentOverride}
		<section class="current-override">
			<h3>Current override</h3>
			<p><code>{data.currentOverride.action}</code> -- {JSON.stringify(data.currentOverride.payload)}</p>
		</section>
	{/if}

	{#if form?.error}
		<p class="error">{form.error}</p>
	{:else if form?.ok}
		<p class="success">Override saved.</p>
	{/if}

	<section class="actions">
		<h3>Actions</h3>
		<div class="action-row">
			{#each allowedActions as action (action)}
				{@const isPair = action === INGEST_REVIEW.ACTIONS.PAIR}
				<form
					method="POST"
					action={actionEndpoint(action)}
					use:enhance
				>
					<input type="hidden" name="payload" value={isPair ? pairPayloadJson() : '{}'} />
					<button
						type="submit"
						class:primary={isPair}
						disabled={isPair && !selected}
						title={isPair && !selected ? 'Select a candidate to enable Pair' : ''}
					>
						{INGEST_OVERRIDE_ACTION_LABELS[action]}
					</button>
				</form>
			{/each}

			{#if pdfHref}
				<a class="external" href={pdfHref}>View page {data.issue.pageNum} in PDF &rarr;</a>
			{/if}
		</div>

		<div class="action-row secondary">
			<form method="POST" action={ROUTES.HANGAR_INGEST_REVIEW_DISMISS_ACTION} use:enhance>
				<button type="submit">Dismiss</button>
			</form>
			<form method="POST" action={ROUTES.HANGAR_INGEST_REVIEW_REOPEN_ACTION} use:enhance>
				<button type="submit">Reopen</button>
			</form>
		</div>
	</section>
</article>

<style>
	.back {
		display: inline-block;
		margin-bottom: var(--space-sm);
		color: var(--action-default);
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
	}

	.orphan-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		background: var(--surface-elevated);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-sm);
		margin: 0;
	}

	.meta div {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.meta dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.meta dd {
		margin: 0;
		font-weight: var(--font-weight-medium);
	}

	.caption blockquote {
		margin: 0;
		padding: var(--space-md);
		background: var(--surface-base);
		border-left: 3px solid var(--action-default);
		border-radius: var(--radius-sm);
		font-style: italic;
	}

	.mode {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.actions h3 {
		margin: 0 0 var(--space-2xs) 0;
	}

	.action-row {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		align-items: center;
	}

	.action-row.secondary {
		margin-top: var(--space-sm);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--border-subtle);
	}

	.external {
		color: var(--action-default);
		text-decoration: none;
	}

	.external:hover {
		text-decoration: underline;
	}

	.error {
		color: var(--state-error-ink, var(--ink-body));
		background: var(--state-error-wash, var(--surface-elevated));
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.success {
		color: var(--state-success-ink, var(--ink-body));
		background: var(--state-success-wash, var(--surface-elevated));
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.current-override code {
		background: var(--surface-base);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-xs);
	}
</style>
