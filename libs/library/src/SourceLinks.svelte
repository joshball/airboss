<script lang="ts" module>
/**
 * `<SourceLinks>` -- compact "Source" cluster the flightbag reader renders
 * at the top of every reference page (handbook landing / chapter / section,
 * AIM at every depth, CFR Part / section, AC, ACS).
 *
 * Two links:
 *
 *   - **Local PDF**: streams the canonical FAA PDF from the developer-local
 *     cache (per ADR 018) via the `/source-pdf/[...]` route. Hidden when
 *     the cache file isn't present (a fresh dev box that hasn't downloaded
 *     yet, or a corpus with no canonical PDF like AIM and CFR).
 *   - **Online source**: links to the canonical FAA web page or eCFR section.
 *     Hidden only when the kind has no public landing.
 *
 * The component is purely presentational; the page-server load decides which
 * URLs to expose by calling `buildSourceLinks(reference)` from
 * `apps/flightbag/src/lib/source-links.ts`. That helper consults the local
 * cache (server-only) and produces the props this component renders.
 */

export interface SourceLinksProps {
	/** Path to the local-cache PDF (`/source-pdf/...`). `null` to hide. */
	readonly localPdfHref: string | null;
	/** Canonical online URL (FAA / eCFR). `null` to hide. */
	readonly onlineUrl: string | null;
	/**
	 * `true` when the corpus has a canonical PDF that simply isn't cached on
	 * this developer's machine. Surfaces a small "(local PDF not yet downloaded)"
	 * hint so it's clear the link is missing for environment reasons, not
	 * because the corpus has no PDF (AIM / CFR have no canonical PDF and
	 * should set this to `false`).
	 */
	readonly localPdfMissing?: boolean;
	/**
	 * Optional human-readable label used in the section heading. Defaults to
	 * "Source" -- callers don't typically override.
	 */
	readonly label?: string;
}
</script>

<script lang="ts">
let { localPdfHref, onlineUrl, localPdfMissing = false, label = 'Source' }: SourceLinksProps = $props();

const hasAnyLink = $derived(localPdfHref !== null || onlineUrl !== null);
</script>

{#if hasAnyLink || localPdfMissing}
	<aside class="source-links" data-testid="source-links" aria-label={label}>
		<span class="label">{label}:</span>
		{#if localPdfHref !== null}
			<a class="link link-pdf" href={localPdfHref} target="_blank" rel="noopener">
				<span aria-hidden="true">📄</span>
				<span>Local PDF</span>
			</a>
		{:else if localPdfMissing}
			<span class="hint" data-testid="source-links-missing">
				Local PDF not yet downloaded.
			</span>
		{/if}
		{#if onlineUrl !== null}
			<a class="link link-online" href={onlineUrl} target="_blank" rel="noopener noreferrer">
				<span aria-hidden="true">↗</span>
				<span>Online source</span>
			</a>
		{/if}
	</aside>
{/if}

<style>
.source-links {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-sm);
	margin-bottom: var(--space-md);
	padding: var(--space-2xs) var(--space-sm);
	background: var(--surface-sunken);
	border-radius: var(--radius-sm);
	font-size: var(--font-size-sm);
}

.label {
	color: var(--ink-muted);
	font-weight: var(--font-weight-medium);
	text-transform: uppercase;
	letter-spacing: 0.04em;
	font-size: var(--font-size-xs);
}

.link {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2xs);
	padding: var(--space-2xs) var(--space-xs);
	border-radius: var(--radius-sm);
	color: var(--ink-strong);
	text-decoration: none;
	border: 1px solid var(--edge-default);
	background: var(--surface-raised);
}

.link:hover,
.link:focus-visible {
	border-color: var(--action-default-edge);
}

.hint {
	color: var(--ink-muted);
	font-style: italic;
}
</style>
