<script lang="ts" module>
import {
	HANDBOOK_ERRATA_PATCH_KIND_LABELS,
	HANDBOOK_ERRATA_PATCH_KINDS,
	type HandbookErrataPatchKind,
} from '@ab/constants';

/**
 * Structural mirror of `ErrataDisplay` from `@ab/bc-study`. Lives here
 * so the UI lib stays free of a cross-cutting BC dependency. The reader
 * page imports the BC type and SvelteKit's `data` prop carries the
 * shape into the component, where this declaration narrows it again.
 * Keep the two in sync; the BC's `formatErrataForDisplay` is the source
 * of truth for the field set.
 */
export type ErrataEntryDisplay = {
	id: string;
	errataId: string;
	publishedAt: string;
	appliedAt: string;
	sourceUrl: string;
	patchKind: HandbookErrataPatchKind;
	targetAnchor: string | null;
	targetPage: string;
	originalText: string | null;
	replacementText: string;
};
</script>

<script lang="ts">
import { wordDiff } from '@ab/utils';

/**
 * Renders one applied erratum row. Header carries the citation
 * metadata (errata id, published date, FAA source link); the body
 * varies by patch kind:
 *
 * - `add_subsection`: shows the new subsection text, framed as added.
 * - `append_paragraph`: shows the appended paragraph, framed as appended.
 * - `replace_paragraph`: inline word-diff of original vs replacement.
 *
 * The component is presentation-only. It does not mutate state and it
 * receives a fully formatted display row from the BC.
 */

let { entry }: { entry: ErrataEntryDisplay } = $props();

const patchKindLabel = $derived(HANDBOOK_ERRATA_PATCH_KIND_LABELS[entry.patchKind]);

// Pre-compute the diff for replace_paragraph so the template stays lean.
// `originalText` is guaranteed non-null for this kind by the validator,
// but TypeScript can't narrow that across a union, so guard explicitly.
const diffOps = $derived(
	entry.patchKind === HANDBOOK_ERRATA_PATCH_KINDS.REPLACE_PARAGRAPH && entry.originalText !== null
		? wordDiff(entry.originalText, entry.replacementText)
		: [],
);

function formatPublishedDate(iso: string): string {
	// `YYYY-MM-DD` -> a stable, locale-neutral display. Avoid Intl
	// because handbook data is FAA-published in en-US and the
	// renderer must match across timezones.
	const [year, month, day] = iso.split('-');
	if (!year || !month || !day) return iso;
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const monthName = months[Number(month) - 1] ?? month;
	return `${monthName} ${Number(day)}, ${year}`;
}
</script>

<article class="errata-entry" data-patch-kind={entry.patchKind}>
	<header class="entry-header">
		<span class="errata-id">{entry.errataId}</span>
		<span class="separator" aria-hidden="true">·</span>
		<span class="published">{formatPublishedDate(entry.publishedAt)}</span>
		<span class="separator" aria-hidden="true">·</span>
		<a class="source-link" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
			FAA source
		</a>
		<span class="patch-kind" aria-label="Patch kind">{patchKindLabel}</span>
	</header>

	{#if entry.targetAnchor}
		<p class="anchor">In: <em>{entry.targetAnchor}</em> (page {entry.targetPage})</p>
	{:else}
		<p class="anchor">Page {entry.targetPage}</p>
	{/if}

	{#if entry.patchKind === HANDBOOK_ERRATA_PATCH_KINDS.ADD_SUBSECTION}
		<div class="body added" aria-label="Subsection added by this erratum">
			<p class="frame-label">Added</p>
			<pre class="text">{entry.replacementText}</pre>
		</div>
	{:else if entry.patchKind === HANDBOOK_ERRATA_PATCH_KINDS.APPEND_PARAGRAPH}
		<div class="body appended" aria-label="Paragraph appended by this erratum">
			<p class="frame-label">Appended</p>
			<pre class="text">{entry.replacementText}</pre>
		</div>
	{:else if entry.patchKind === HANDBOOK_ERRATA_PATCH_KINDS.REPLACE_PARAGRAPH}
		<div class="body replaced" aria-label="Paragraph revised by this erratum">
			<p class="frame-label">Revised</p>
			<pre class="text diff">{#each diffOps as op, i (i)}{#if op.kind === 'equal'}<span
							class="eq">{op.text}</span
						>{:else if op.kind === 'remove'}<del>{op.text}</del>{:else}<ins>{op.text}</ins>{/if}{/each}</pre>
		</div>
	{/if}
</article>

<style>
	.errata-entry {
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.entry-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2xs) var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}

	.errata-id {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-subtle);
	}

	.separator {
		color: var(--ink-subtle);
	}

	.published {
		color: var(--ink-muted);
	}

	.source-link {
		color: var(--action-default);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.source-link:hover,
	.source-link:focus-visible {
		color: var(--action-default-hover, var(--action-default));
	}

	.patch-kind {
		margin-left: auto;
		padding: 0 var(--space-xs);
		background: var(--action-neutral-wash);
		border: 1px solid var(--action-neutral-edge);
		border-radius: var(--radius-sm);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
	}

	.anchor {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.body {
		margin-top: var(--space-2xs);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-subtle);
	}

	.body.added,
	.body.appended {
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.body.replaced {
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.frame-label {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-subtle);
	}

	.text {
		margin: 0;
		font-family: inherit;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed);
		white-space: pre-wrap;
		word-wrap: break-word;
		color: var(--ink-body);
	}

	.text.diff :global(.eq) {
		color: var(--ink-body);
	}

	.text.diff :global(del) {
		background: var(--signal-danger-wash, var(--action-hazard-wash));
		color: var(--signal-danger, var(--action-hazard));
		text-decoration: line-through;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-xs, var(--radius-sm));
	}

	.text.diff :global(ins) {
		background: var(--signal-success-wash);
		color: var(--signal-success);
		text-decoration: none;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-xs, var(--radius-sm));
	}
</style>
