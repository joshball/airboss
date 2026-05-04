<script lang="ts" module>
/**
 * `<TOCDrawer>` -- the persistent left-rail table of contents that turns the
 * flightbag from a reference reader into a book.
 *
 * Renders the entire reading order for the current document (chapters, every
 * section, every paragraph -- whatever the corpus declares as its reading
 * order). The user can jump anywhere from anywhere without losing their
 * place. Without this, traversing a long handbook means clicking back-back-
 * back-back to chapter list, picking a chapter, picking a section.
 *
 * Visual design:
 * - 280px wide on desktop (≥60rem), sticky at the top of the viewport so it
 *   scrolls independently of the body.
 * - On mobile/tablet (<60rem), the drawer collapses to a top-of-page disclosure
 *   that toggles the full list inline. Defaults to closed on small viewports
 *   (the body content takes precedence) and open on desktop.
 * - Each entry is indented to match its `depth`. Chapters render as their own
 *   section title; sections sit under their chapter; paragraphs nest a level
 *   deeper.
 * - The currently-active section is highlighted (background + bold).
 * - Sections with `readSet.has(sectionId)` render with a check glyph; the
 *   check is hidden from screen-readers (the `aria-label` carries the
 *   "(read)" suffix instead).
 *
 * The drawer is a `<nav>` with `aria-label="Table of contents"` so a screen-
 * reader user can skip to it via document landmarks.
 *
 * Reading-time minutes per entry are rendered when `entry.minutesToRead > 0`
 * -- defaults to 0 so callers that haven't computed estimates yet don't show
 * a meaningless "0 min".
 */

export interface TOCDrawerEntry {
	readonly sectionId: string;
	readonly code: string;
	readonly title: string;
	readonly depth: number;
	readonly href: string | null;
	readonly minutesToRead: number;
	/** True when this entry IS the current page; rendered highlighted. */
	readonly isActive: boolean;
}

export interface TOCDrawerProps {
	readonly entries: ReadonlyArray<TOCDrawerEntry>;
	/** Section ids the current user has read. Empty Set when anonymous. */
	readonly readSet?: ReadonlySet<string>;
	/** Heading rendered above the list -- typically the document title. */
	readonly heading: string;
	/** Optional summary line (e.g. "Read 3 of 11 chapters"). */
	readonly summary?: string;
	/** Optional href so the heading itself is clickable -- jumps to the doc landing page. */
	readonly headingHref?: string;
	/**
	 * Initial open state on small viewports. Desktop ignores this (always open).
	 * Default `false` -- the body takes precedence on mobile.
	 */
	readonly initiallyOpenOnMobile?: boolean;
}
</script>

<script lang="ts">
let { entries, readSet, heading, summary, headingHref, initiallyOpenOnMobile = false }: TOCDrawerProps = $props();

// Capture only the initial value -- the user's toggle takes over from there.
// Reading the prop in $state's initializer is the documented way to seed
// component-internal state from a prop in Svelte 5; the lint warning is a
// false positive for this usage.
// svelte-ignore state_referenced_locally
let mobileOpen = $state(initiallyOpenOnMobile);

const reads = $derived(readSet ?? new Set<string>());
const totalMinutes = $derived(entries.reduce((acc, e) => acc + e.minutesToRead, 0));

function entryAriaLabel(e: TOCDrawerEntry, isRead: boolean): string {
	const parts = [e.code, e.title];
	if (isRead) parts.push('(read)');
	if (e.minutesToRead > 0) parts.push(`${e.minutesToRead} min`);
	return parts.join(' ');
}
</script>

<nav class="toc-drawer" class:mobile-open={mobileOpen} aria-label="Table of contents">
	<button
		type="button"
		class="mobile-toggle"
		aria-expanded={mobileOpen}
		aria-controls="toc-drawer-list"
		onclick={() => {
			mobileOpen = !mobileOpen;
		}}
	>
		<span class="toggle-icon" aria-hidden="true">{mobileOpen ? '▾' : '▸'}</span>
		<span class="toggle-label">Contents</span>
		{#if totalMinutes > 0}
			<span class="toggle-meta">≈ {totalMinutes} min</span>
		{/if}
	</button>

	<div class="toc-body" id="toc-drawer-list">
		<header class="toc-header">
			{#if headingHref}
				<a href={headingHref} class="heading-link">{heading}</a>
			{:else}
				<h2>{heading}</h2>
			{/if}
			{#if summary}
				<p class="summary">{summary}</p>
			{/if}
		</header>

		<ol class="entries">
			{#each entries as entry (entry.sectionId)}
				{@const isRead = reads.has(entry.sectionId)}
				<li
					class="entry depth-{Math.min(entry.depth, 4)}"
					class:active={entry.isActive}
					class:read={isRead}
				>
					{#if entry.href}
						<a
							href={entry.href}
							aria-current={entry.isActive ? 'page' : undefined}
							aria-label={entryAriaLabel(entry, isRead)}
						>
							<span class="entry-line">
								{#if isRead}
									<span class="check" aria-hidden="true">✓</span>
								{:else}
									<span class="check-spacer" aria-hidden="true"></span>
								{/if}
								<span class="code">{entry.code}</span>
								<span class="title">{entry.title}</span>
							</span>
							{#if entry.minutesToRead > 0}
								<span class="minutes" aria-hidden="true">{entry.minutesToRead} min</span>
							{/if}
						</a>
					{:else}
						<span class="entry-line non-link">
							<span class="check-spacer" aria-hidden="true"></span>
							<span class="code">{entry.code}</span>
							<span class="title">{entry.title}</span>
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
</nav>

<style>
	.toc-drawer {
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.mobile-toggle {
		display: none;
		width: 100%;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-sm);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}

	.mobile-toggle:hover,
	.mobile-toggle:focus-visible {
		border-color: var(--action-default-edge);
	}

	.toggle-icon {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}

	.toggle-label {
		font-weight: var(--font-weight-medium);
		flex: 1;
	}

	.toggle-meta {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	.toc-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
	}

	.toc-header h2,
	.heading-link {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-strong);
	}

	.heading-link {
		display: block;
		text-decoration: none;
	}

	.heading-link:hover,
	.heading-link:focus-visible {
		text-decoration: underline;
	}

	.summary {
		margin: var(--space-3xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		max-height: calc(100vh - 8rem);
		overflow-y: auto;
		/* Hint to scroll-anchoring so the active entry stays in view across
		 * route transitions. */
		scroll-padding: var(--space-md);
	}

	.entry > a,
	.entry > .entry-line.non-link {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}

	.entry > a:hover,
	.entry > a:focus-visible {
		background: var(--surface-raised);
		color: var(--ink-strong);
	}

	.entry-line {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2xs);
		min-width: 0;
		flex: 1;
	}

	.entry.active > a {
		background: var(--surface-raised);
		color: var(--ink-strong);
		font-weight: var(--font-weight-medium);
	}

	/* Active marker -- a strong accent border on the leading edge so the
	 * current section reads at a glance even before color-distinguishing the
	 * background. */
	.entry.active > a {
		box-shadow: inset 2px 0 0 var(--action-default);
	}

	.check {
		color: var(--ok-strong, var(--action-default));
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		min-width: 1ch;
	}

	.check-spacer {
		display: inline-block;
		min-width: 1ch;
	}

	.code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		flex-shrink: 0;
	}

	.entry.active .code,
	.entry.active .title {
		color: var(--ink-strong);
	}

	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.minutes {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	/* Indentation per depth -- chapters at 0, sections at 1, paragraphs at 2,
	 * deeper hierarchies clamp at 4. */
	.entry.depth-0 {
		font-weight: var(--font-weight-medium);
	}
	.entry.depth-1 .entry-line {
		padding-inline-start: var(--space-md);
	}
	.entry.depth-2 .entry-line {
		padding-inline-start: calc(var(--space-md) * 2);
	}
	.entry.depth-3 .entry-line {
		padding-inline-start: calc(var(--space-md) * 3);
	}
	.entry.depth-4 .entry-line {
		padding-inline-start: calc(var(--space-md) * 4);
	}

	/* Mobile/tablet: collapse to the disclosure button; expand on toggle. */
	@media (max-width: 60rem) {
		.mobile-toggle {
			display: flex;
		}
		.toc-body {
			display: none;
		}
		.toc-drawer.mobile-open .toc-body {
			display: flex;
			margin-top: var(--space-xs);
		}
		.entries {
			/* No sticky max-height on mobile; let the page scroll the list. */
			max-height: none;
		}
	}
</style>
