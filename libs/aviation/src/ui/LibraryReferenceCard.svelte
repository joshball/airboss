<script lang="ts">
/**
 * Single shared card for the library / regulations surfaces. One shape across
 * every level (landing buckets, kind groups, umbrella references, individual
 * documents) so the visual hierarchy stays consistent.
 *
 * The `whyItMatters` block is collapsed by default behind a small expander
 * so the cards stay visually tight at the grid level. Click the expander
 * (NOT the card body) to reveal -- card click still navigates to `href`.
 *
 * Inputs:
 *   - title:         primary heading (e.g. "14 CFR", "Part 91", "AIM").
 *   - officialTitle: optional italic subtitle (publisher's full name).
 *   - description:   optional 1-2 sentence neutral summary.
 *   - whyItMatters:  optional pilot-relevance framing. Rendered in an
 *                    expandable block; the toggle is a small chip in the
 *                    footer so the card stays compact by default.
 *   - href:          internal navigation target. The whole card is a link
 *                    to this URL. Required when external is null.
 *   - external:      optional `{ url, label }` for a secondary "view at FAA"
 *                    badge. Rendered as a small inline link inside the card
 *                    -- does NOT replace the card's primary `href`. When
 *                    `href` is null and `external` is set, the whole card
 *                    becomes the external link (umbrella cards on a kind
 *                    page that have no local rendering yet).
 *   - kindBadge:     optional small uppercase chip ("CFR", "AIM", ...).
 *   - editionBadge:  optional right-aligned small text ("current", "2026-04").
 *   - countLabel:    optional bottom-row count ("226 references", "286 sections").
 */

interface ExternalLink {
	readonly url: string;
	readonly label: string;
}

let {
	title,
	titleAbbreviation = null,
	officialTitle = null,
	description = null,
	whyItMatters = null,
	href = null,
	external = null,
	kindBadge = null,
	editionBadge = null,
	countLabel = null,
}: {
	title: string;
	titleAbbreviation?: string | null;
	officialTitle?: string | null;
	description?: string | null;
	whyItMatters?: string | null;
	href?: string | null;
	external?: ExternalLink | null;
	kindBadge?: string | null;
	editionBadge?: string | null;
	countLabel?: string | null;
} = $props();

const primaryHref = $derived(href ?? external?.url ?? null);
const opensExternal = $derived(href === null && external !== null);

let whyOpen = $state(false);

function toggleWhy(event: Event): void {
	// Stop the click from bubbling up to the wrapping card link so the
	// expander toggles in place instead of navigating.
	event.preventDefault();
	event.stopPropagation();
	whyOpen = !whyOpen;
}
</script>

{#snippet body()}
	{#if kindBadge || editionBadge}
		<div class="badges">
			{#if kindBadge}
				<span class="kind-chip">{kindBadge}</span>
			{/if}
			{#if editionBadge}
				<span class="edition">{editionBadge}</span>
			{/if}
		</div>
	{/if}
	<h3 class="title">
		{#if titleAbbreviation}
			<abbr title={titleAbbreviation}>{title}</abbr>
		{:else}
			{title}
		{/if}
	</h3>
	{#if officialTitle}
		<p class="official">{officialTitle}</p>
	{/if}
	{#if description}
		<p class="description">{description}</p>
	{/if}
	{#if whyItMatters && whyOpen}
		<aside class="why" id="why-{title}">
			<span class="why-label">Why pilots care</span>
			<span>{whyItMatters}</span>
		</aside>
	{/if}
	<div class="footer">
		{#if countLabel}
			<span class="count">{countLabel}</span>
		{/if}
		{#if whyItMatters}
			<button
				type="button"
				class="why-toggle"
				aria-expanded={whyOpen}
				aria-controls={`why-${title}`}
				onclick={toggleWhy}
			>
				{whyOpen ? '× hide' : '? why pilots care'}
			</button>
		{/if}
		{#if external && href !== null}
			<a
				class="external"
				href={external.url}
				target="_blank"
				rel="noopener noreferrer"
				onclick={(event) => event.stopPropagation()}
			>
				<span aria-hidden="true">↗</span>
				{external.label}
			</a>
		{/if}
	</div>
{/snippet}

{#if primaryHref}
	<a
		class="card"
		class:card-external={opensExternal}
		href={primaryHref}
		target={opensExternal ? '_blank' : undefined}
		rel={opensExternal ? 'noopener noreferrer' : undefined}
	>
		{@render body()}
	</a>
{:else}
	<div class="card card-static" aria-disabled="true">
		{@render body()}
	</div>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-md) var(--space-lg);
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
	.card-static {
		opacity: 0.7;
	}
	.badges {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
	}
	.kind-chip {
		display: inline-block;
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
	.edition {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.official {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-style: italic;
	}
	.description {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.why {
		margin: var(--space-2xs) 0 0;
		padding: var(--space-xs) var(--space-sm);
		border-left: 2px solid var(--action-default-edge);
		background: var(--surface-sunken);
		font-size: var(--font-size-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.footer {
		margin-top: var(--space-xs);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.count {
		flex: 1;
	}
	.external {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--font-size-sm);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.external:hover {
		color: var(--action-default);
		background: var(--surface-sunken);
	}
	.why-toggle {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		padding: var(--space-3xs) var(--space-2xs);
		font: inherit;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		cursor: pointer;
		transition: all var(--motion-fast) ease;
	}
	.why-toggle:hover,
	.why-toggle:focus-visible {
		color: var(--action-default);
		border-color: var(--action-default-edge);
		background: var(--surface-sunken);
	}
	.why-toggle:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
