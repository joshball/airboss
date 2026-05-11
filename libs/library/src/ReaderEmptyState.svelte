<script lang="ts" module>
/**
 * `<ReaderEmptyState>` -- a single "this reader page has nothing to render
 * inline" affordance, used across every doc-type in the flightbag.
 *
 * Replaces four hand-rolled empty states that had drifted apart:
 *
 *   - AIM chapter / section: bare `<p class="empty">`
 *   - CFR Part / section: callout block with eCFR link
 *   - ACS publication: "Sourced only" badge with PDF + portal links
 *   - Handbook landing: bare `<p class="empty">`
 *
 * All four reduce to the same shape: a small badge label, a short heading,
 * an explanation, and 0..2 outbound links (a local-cache PDF and an
 * external authoritative URL).
 *
 * Three `kind`s carry the semantic distinction between them; the visual
 * shape is shared.
 *
 *   - `sourced-only` -- the catalog row exists but no body has been
 *     ingested yet. Default badge: "Sourced only". Used by ACS / AC.
 *
 *   - `not-yet-ingested` -- the structural row (Part / Chapter / Section)
 *     exists but its child sections aren't in the airboss corpus yet.
 *     Default badge: "Not yet ingested". Used by CFR Parts and CFR sections.
 *
 *   - `no-children` -- the structural row exists and has no nested children
 *     by design (e.g. a leaf-only section, or an AIM chapter that the seed
 *     produced no paragraphs for yet). Default badge: "Empty". Used by
 *     handbook landing + AIM landing / chapter / section.
 */

import type { Snippet } from 'svelte';

export type ReaderEmptyStateKind = 'sourced-only' | 'not-yet-ingested' | 'no-children';

export interface ReaderEmptyStateProps {
	readonly kind: ReaderEmptyStateKind;
	/**
	 * Optional path to the developer-local cached PDF. When present, renders a
	 * "Local PDF" link.
	 */
	readonly localPdfHref?: string | null;
	/**
	 * Optional canonical FAA / eCFR URL. When present, renders an "Online" link
	 * that opens in a new tab.
	 */
	readonly externalUrl?: string | null;
	/**
	 * Optional explanation paragraph. Defaults to a sensible per-kind message
	 * when omitted; the override lets the caller customise (e.g. "This Part
	 * has been catalogued in airboss but its individual sections aren't
	 * ingested into the flightbag reader yet.").
	 */
	readonly note?: string;
	/**
	 * Optional override of the heading. Defaults to a per-kind label.
	 */
	readonly heading?: string;
	/**
	 * Optional override of the badge text. Defaults to a per-kind label.
	 */
	readonly badge?: string;
	/**
	 * Optional caller-supplied label for the external link. Defaults to "Online".
	 */
	readonly externalLabel?: string;
	/**
	 * Optional extra slot rendered inside the callout, after the actions row.
	 * Used for kind-specific affordances (e.g. a custom helper).
	 */
	readonly extra?: Snippet;
}

const DEFAULT_BADGES: Record<ReaderEmptyStateKind, string> = {
	'sourced-only': 'Sourced only',
	'not-yet-ingested': 'Not yet ingested',
	'no-children': 'Empty',
};

const DEFAULT_HEADINGS: Record<ReaderEmptyStateKind, string> = {
	'sourced-only': "This document hasn't been ingested yet.",
	'not-yet-ingested': "This section hasn't been ingested into the reader yet.",
	'no-children': 'No entries to show yet.',
};

const DEFAULT_NOTES: Record<ReaderEmptyStateKind, string> = {
	'sourced-only':
		'Read the official FAA PDF below. The full reader will activate once the document is added to the corpus.',
	'not-yet-ingested':
		'The authoritative source is the federal site -- it stays current with amendments and supports per-section deep links.',
	'no-children': 'This page is catalogued but has no nested entries available right now.',
};
</script>

<script lang="ts">
let {
	kind,
	localPdfHref = null,
	externalUrl = null,
	note,
	heading,
	badge,
	externalLabel = 'Online',
	extra,
}: ReaderEmptyStateProps = $props();

const resolvedBadge = $derived(badge ?? DEFAULT_BADGES[kind]);
const resolvedHeading = $derived(heading ?? DEFAULT_HEADINGS[kind]);
const resolvedNote = $derived(note ?? DEFAULT_NOTES[kind]);
const hasActions = $derived(Boolean(localPdfHref) || Boolean(externalUrl));
</script>

<section class="reader-empty" data-testid="reader-empty-state" data-kind={kind}>
	<p class="badge">{resolvedBadge}</p>
	<h2>{resolvedHeading}</h2>
	<p class="note">{resolvedNote}</p>
	{#if hasActions}
		<div class="actions">
			{#if localPdfHref}
				<a class="local-link" href={localPdfHref}>Local PDF</a>
			{/if}
			{#if externalUrl}
				<a class="external-link" href={externalUrl} target="_blank" rel="noopener noreferrer">
					{externalLabel} &rarr;
				</a>
			{/if}
		</div>
	{/if}
	{#if extra}
		<div class="extra">{@render extra()}</div>
	{/if}
</section>

<style>
	.reader-empty {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		max-width: 72ch;
	}
	.reader-empty h2 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-lg);
	}
	.reader-empty .note {
		margin: 0 0 var(--space-sm);
	}
	.reader-empty .note:last-child {
		margin-bottom: 0;
	}
	.badge {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		background: var(--surface-raised);
		color: var(--ink-muted);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin: 0 0 var(--space-xs);
	}
	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		margin-top: var(--space-sm);
	}
	.external-link,
	.local-link {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-strong));
		text-decoration: none;
		font-weight: var(--font-weight-medium);
	}
	.local-link {
		background: var(--surface-raised);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
	}
	.extra {
		margin-top: var(--space-sm);
	}
</style>
