<script lang="ts">
/**
 * Single shared card for the library / regulations surfaces. One layout shape
 * across every level (landing buckets, kind groups, umbrella references,
 * individual documents) so the visual hierarchy stays consistent.
 *
 * Layout slots (top to bottom):
 *
 *   - Top row:    [kind chip ........... identifier]
 *   - Title:      Full primary heading -- the readable name. No splitting.
 *   - Description (optional)
 *   - Topic chips (optional)
 *   - Why-pilots-care (collapsed, click expander to open)
 *   - Footer:     [Open in airboss ->        |   View on eCFR ↗]
 *
 * The card body is a non-clickable `<div>` so text is selectable and the user
 * can copy section codes / titles. Navigation happens through the two
 * explicit footer links: `local` (internal href) and `external` (publisher).
 *
 * Inputs:
 *   - title:         primary heading -- the full readable name. Required.
 *                    Example: "Title 14 CFR -- Aeronautics and Space".
 *   - kindBadge:     small uppercase corpus marker ("CFR", "AIM", "AC", ...).
 *   - identifier:    stable citation handle ("Title 14 · 2026", "Part 91",
 *                    "FAA-H-8083-25C"). Top-right.
 *   - description:   1-2 sentence neutral summary.
 *   - whyItMatters:  pilot-relevance framing. Rendered behind an expander
 *                    button so the card stays compact by default.
 *   - topics:        AVIATION_TOPIC chips ("weather", "navigation"). Rendered
 *                    as small pills below the description.
 *   - local:         internal `{ url, label }` -- "Open in airboss".
 *   - external:      external `{ url, label }` -- "View on eCFR / FAA / NTSB".
 *
 * The whole card is a `<div>`. Both footer links stop event propagation so
 * clicks on links navigate without bubbling, and a click on the body itself
 * is a no-op (text-selection / copy is the intended behaviour).
 */

interface CardLink {
	readonly url: string;
	readonly label: string;
}

let {
	title,
	kindBadge = null,
	identifier = null,
	description = null,
	whyItMatters = null,
	topics = [],
	local = null,
	external = null,
}: {
	title: string;
	kindBadge?: string | null;
	identifier?: string | null;
	description?: string | null;
	whyItMatters?: string | null;
	topics?: readonly { readonly value: string; readonly label: string }[];
	local?: CardLink | null;
	external?: CardLink | null;
} = $props();

let whyOpen = $state(false);

function toggleWhy(event: Event): void {
	event.preventDefault();
	whyOpen = !whyOpen;
}

const whyId = $derived(`why-${title.replace(/\s+/g, '-').toLowerCase()}`);
</script>

<div class="card" data-testid="library-reference-card">
	{#if kindBadge || identifier}
		<div class="badges">
			{#if kindBadge}
				<span class="kind-chip">{kindBadge}</span>
			{:else}
				<span></span>
			{/if}
			{#if identifier}
				<span class="identifier">{identifier}</span>
			{/if}
		</div>
	{/if}

	<h3 class="title">{title}</h3>

	{#if description}
		<p class="description">{description}</p>
	{/if}

	{#if topics.length > 0}
		<ul class="topics" aria-label="Topics">
			{#each topics as topic (topic.value)}
				<li>{topic.label}</li>
			{/each}
		</ul>
	{/if}

	{#if whyItMatters && whyOpen}
		<aside class="why" id={whyId}>
			<span class="why-label">Why pilots care</span>
			<span>{whyItMatters}</span>
		</aside>
	{/if}

	{#if whyItMatters || local || external}
		<div class="footer">
			{#if whyItMatters}
				<button
					type="button"
					class="why-toggle"
					aria-expanded={whyOpen}
					aria-controls={whyId}
					onclick={toggleWhy}
				>
					{whyOpen ? '× Hide' : '? Why pilots care'}
				</button>
			{/if}
			<span class="footer-spacer"></span>
			{#if local}
				<a class="link link-local" href={local.url} onclick={(e) => e.stopPropagation()}>
					{local.label}
					<span aria-hidden="true">→</span>
				</a>
			{/if}
			{#if external}
				<a
					class="link link-external"
					href={external.url}
					target="_blank"
					rel="noopener noreferrer"
					onclick={(e) => e.stopPropagation()}
				>
					<span aria-hidden="true">↗</span>
					{external.label}
				</a>
			{/if}
		</div>
	{/if}
</div>

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
		transition: border-color var(--motion-fast) ease;
	}
	.card:hover {
		border-color: var(--edge-strong, var(--action-default-edge));
	}
	.badges {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-2xs);
	}
	.kind-chip {
		display: inline-block;
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
	.identifier {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		line-height: var(--line-height-tight, 1.25);
	}
	.description {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.topics {
		list-style: none;
		padding: 0;
		margin: var(--space-xs) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.topics li {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
	}
	.why {
		margin: var(--space-xs) 0 0;
		padding: var(--space-sm) var(--space-md);
		border-left: 2px solid var(--action-default-edge);
		background: var(--surface-sunken);
		font-size: var(--font-size-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.footer {
		margin-top: var(--space-md);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-subtle);
		display: flex;
		align-items: center;
		gap: var(--space-md);
		font-size: var(--font-size-sm);
	}
	.footer-spacer {
		flex: 1;
	}
	.link {
		text-decoration: none;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		transition: background var(--motion-fast) ease;
	}
	.link-local {
		color: var(--action-default);
		font-weight: var(--font-weight-semibold);
	}
	.link-local:hover,
	.link-local:focus-visible {
		background: var(--surface-sunken);
	}
	.link-external {
		color: var(--ink-muted);
	}
	.link-external:hover,
	.link-external:focus-visible {
		color: var(--action-default);
		background: var(--surface-sunken);
	}
	.why-toggle {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		padding: var(--space-3xs) var(--space-xs);
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
