<script lang="ts" module>
/**
 * `<ReferenceCard>` -- the catalog card for a single FAA reference. Used by
 * the flightbag landing and (in future surfaces) per-doc tile grids.
 *
 * Renders one of three shapes based on which links are available:
 *
 *   - `readerUrl`     -> in-app reader card (anchor tag, internal nav)
 *   - `externalUrl`   -> external card (anchor tag with `target=_blank`)
 *   - neither         -> disabled placeholder (no anchor, muted)
 *
 * Visual contract is owned by the component so callers don't drift.
 *
 * Subject chips render via `<SubjectChip>` for a single source of truth on
 * the chip shape.
 */

import { REFERENCE_KIND_LABELS, type ReferenceKind } from '@ab/constants';
import SubjectChip from './SubjectChip.svelte';

export interface ReferenceCardProps {
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly title: string;
	readonly edition: string;
	readonly subjects: readonly string[];
	/** In-app reader URL when the corpus has body content. */
	readonly readerUrl?: string | null;
	/** External authoritative URL (eCFR Part, FAA AC index, etc.). */
	readonly externalUrl?: string | null;
	/** True when at least one section row carries body content -- drives the "Read in-app" badge. */
	readonly hasInlineBody?: boolean;
}
</script>

<script lang="ts">
let {
	kind,
	documentSlug,
	title,
	edition,
	subjects,
	readerUrl = null,
	externalUrl = null,
	hasInlineBody = false,
}: ReferenceCardProps = $props();

const kindLabel = $derived(REFERENCE_KIND_LABELS[kind]);
</script>

{#if readerUrl}
	<a class="card" href={readerUrl} data-kind={kind} data-slug={documentSlug}>
		<span class="card-title">{title}</span>
		<span class="card-edition">{edition}</span>
		<span class="card-meta">
			<span class="badge">{kindLabel}</span>
			{#if hasInlineBody}
				<span class="badge badge-inline">Read in-app</span>
			{:else if externalUrl}
				<span class="badge badge-external">External</span>
			{/if}
		</span>
		{#if subjects.length > 0}
			<span class="card-subjects">
				{#each subjects as subject (subject)}
					<SubjectChip {subject} />
				{/each}
			</span>
		{/if}
	</a>
{:else if externalUrl}
	<a
		class="card card-external"
		href={externalUrl}
		rel="noopener noreferrer"
		target="_blank"
		data-kind={kind}
		data-slug={documentSlug}
	>
		<span class="card-title">{title}</span>
		<span class="card-edition">{edition}</span>
		<span class="card-meta">
			<span class="badge">{kindLabel}</span>
			<span class="badge badge-external">External</span>
		</span>
		{#if subjects.length > 0}
			<span class="card-subjects">
				{#each subjects as subject (subject)}
					<SubjectChip {subject} />
				{/each}
			</span>
		{/if}
	</a>
{:else}
	<div class="card card-disabled" data-kind={kind} data-slug={documentSlug}>
		<span class="card-title">{title}</span>
		<span class="card-edition">{edition}</span>
		<span class="card-meta">
			<span class="badge">{kindLabel}</span>
		</span>
	</div>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.card:hover,
	.card:focus-visible {
		border-color: var(--action-default-edge);
	}
	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.card-disabled {
		opacity: 0.7;
	}
	.card-title {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.card-edition {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}
	.card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.badge {
		display: inline-block;
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		letter-spacing: var(--letter-spacing-wide);
		text-transform: uppercase;
	}
	.badge-inline {
		background: var(--action-default-edge);
		color: var(--action-default-ink, var(--ink-strong));
	}
	.badge-external {
		background: var(--surface-panel);
		color: var(--ink-muted);
	}
	.card-subjects {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		margin-top: var(--space-2xs);
	}
</style>
