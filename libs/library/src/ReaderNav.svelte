<script lang="ts" module>
/**
 * `<ReaderNav>` -- prev / up / next navigation strip for FAA reference
 * reader pages.
 *
 * Renders three slots:
 * - `prev`: the previous section in reading order (or null at start of doc)
 * - `up`: the parent / chapter / book home page
 * - `next`: the next section in reading order (or null at end of doc)
 *
 * Three visual variants:
 * - `footer` (default): a thin underlined strip at the bottom of every page
 *   so readers can flip pages like a book.
 * - `empty`: a centered block used inside an empty-body section's
 *   `emptyFallback` snippet -- larger touch targets, clearer "this section
 *   has no content but here's where to go next" affordance.
 * - `end-of-doc`: rendered when `nav.next === null` -- shows the prev/up
 *   navigation alongside an end-of-document affordance (progress summary,
 *   "Mark this chapter as read" button, "Next handbook in syllabus"
 *   placeholder). The button + summary come from optional props the
 *   caller supplies; without them the variant degrades to a footer-style
 *   strip with a small "End of document" caption.
 */

export interface ReaderNavLink {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly href: string;
}

export interface ReaderNavData {
	readonly prev: ReaderNavLink | null;
	readonly next: ReaderNavLink | null;
	readonly up: ReaderNavLink | null;
}

export interface ReaderNavProps {
	readonly nav: ReaderNavData;
	readonly variant?: 'footer' | 'empty' | 'end-of-doc';
	/**
	 * End-of-doc summary line ("You've read 47 of 47 sections in PHAK").
	 * Only consulted when `variant === 'end-of-doc'`.
	 */
	readonly endOfDocSummary?: string;
	/**
	 * Optional href for the "Next handbook in syllabus" line. When unset,
	 * the placeholder is omitted (rather than rendering a dead link).
	 */
	readonly nextHandbookHref?: string;
	/** Display label for the next-handbook link. */
	readonly nextHandbookLabel?: string;
	/**
	 * Called when the user clicks "Mark chapter as read". When unset,
	 * the button is omitted.
	 */
	readonly onMarkChapterRead?: () => void;
	readonly markChapterReadLabel?: string;
}
</script>

<script lang="ts">
let {
	nav,
	variant = 'footer',
	endOfDocSummary,
	nextHandbookHref,
	nextHandbookLabel,
	onMarkChapterRead,
	markChapterReadLabel = 'Mark chapter as read',
}: ReaderNavProps = $props();

const hasAny = $derived(nav.prev !== null || nav.next !== null || nav.up !== null);
const isEndOfDoc = $derived(variant === 'end-of-doc');
</script>

{#if isEndOfDoc}
	<section class="end-of-doc" aria-label="End of document">
		{#if endOfDocSummary}
			<p class="end-summary">{endOfDocSummary}</p>
		{:else}
			<p class="end-summary muted">End of document.</p>
		{/if}
		<div class="end-actions">
			{#if onMarkChapterRead}
				<button type="button" class="mark-read" onclick={onMarkChapterRead}>{markChapterReadLabel}</button>
			{/if}
			{#if nextHandbookHref && nextHandbookLabel}
				<a class="next-handbook" href={nextHandbookHref}>Next: {nextHandbookLabel} →</a>
			{/if}
		</div>
		{#if hasAny}
			<nav class="reader-nav variant-end" aria-label="Reader navigation">
				<div class="slot slot-prev">
					{#if nav.prev}
						<a href={nav.prev.href} rel="prev" data-testid="reader-nav-prev">
							<span class="hint">&larr; Previous</span>
							<span class="link-code">{nav.prev.code}</span>
							<span class="link-title">{nav.prev.title}</span>
						</a>
					{/if}
				</div>
				<div class="slot slot-up">
					{#if nav.up}
						<a href={nav.up.href} rel="up" data-testid="reader-nav-up">
							<span class="hint">Up to</span>
							<span class="link-title">{nav.up.title}</span>
						</a>
					{/if}
				</div>
				<div class="slot slot-next" aria-hidden="true"></div>
			</nav>
		{/if}
	</section>
{:else if hasAny}
	<nav class="reader-nav" class:variant-empty={variant === 'empty'} aria-label="Reader navigation">
		<div class="slot slot-prev">
			{#if nav.prev}
				<a href={nav.prev.href} rel="prev" data-testid="reader-nav-prev">
					<span class="hint">&larr; Previous</span>
					<span class="link-code">{nav.prev.code}</span>
					<span class="link-title">{nav.prev.title}</span>
				</a>
			{/if}
		</div>
		<div class="slot slot-up">
			{#if nav.up}
				<a href={nav.up.href} rel="up" data-testid="reader-nav-up">
					<span class="hint">Up to</span>
					<span class="link-title">{nav.up.title}</span>
				</a>
			{/if}
		</div>
		<div class="slot slot-next">
			{#if nav.next}
				<a href={nav.next.href} rel="next" data-testid="reader-nav-next">
					<span class="hint">Next &rarr;</span>
					<span class="link-code">{nav.next.code}</span>
					<span class="link-title">{nav.next.title}</span>
				</a>
			{/if}
		</div>
	</nav>
{/if}

<style>
.reader-nav {
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: stretch;
	gap: var(--space-md);
	margin-top: var(--space-lg);
	padding-top: var(--space-md);
	border-top: 1px solid var(--edge-default);
	font-size: var(--font-size-sm);
}

.reader-nav.variant-empty {
	margin-top: var(--space-md);
	padding: var(--space-lg);
	background: var(--surface-sunken);
	border: 1px solid var(--edge-default);
	border-top: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	font-size: var(--font-size-base);
}

.slot {
	display: flex;
	min-width: 0;
}
.slot-prev {
	justify-content: flex-start;
}
.slot-up {
	justify-content: center;
}
.slot-next {
	justify-content: flex-end;
	text-align: right;
}

.reader-nav a {
	display: flex;
	flex-direction: column;
	gap: var(--space-3xs);
	padding: var(--space-xs) var(--space-sm);
	border-radius: var(--radius-sm);
	color: inherit;
	text-decoration: none;
	max-width: 100%;
}

.reader-nav a:hover,
.reader-nav a:focus-visible {
	background: var(--surface-raised);
	color: var(--ink-strong);
}

.slot-next a {
	align-items: flex-end;
}

.hint {
	color: var(--ink-muted);
	font-size: var(--font-size-xs);
	text-transform: uppercase;
	letter-spacing: var(--letter-spacing-caps);
}

.link-code {
	font-family: var(--font-family-mono);
	color: var(--ink-muted);
	font-size: var(--font-size-xs);
}

.link-title {
	color: var(--ink-body);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 24ch;
}

@media (max-width: 40rem) {
	.reader-nav {
		grid-template-columns: 1fr;
	}
	.slot-next,
	.slot-prev,
	.slot-up {
		justify-content: flex-start;
		text-align: left;
	}
	.slot-next a {
		align-items: flex-start;
	}
}

.end-of-doc {
	margin-top: var(--space-xl);
	padding: var(--space-lg);
	border-radius: var(--radius-md);
	background: var(--surface-sunken);
	border: 1px solid var(--edge-default);
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
}

.end-summary {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--ink-strong);
}

.end-summary.muted {
	color: var(--ink-muted);
	font-style: italic;
}

.end-actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-sm);
	align-items: center;
}

.mark-read {
	background: var(--action-default);
	color: var(--action-default-ink, var(--ink-inverse));
	border: 1px solid var(--action-default-edge, var(--action-default));
	padding: var(--space-xs) var(--space-md);
	border-radius: var(--radius-sm);
	cursor: pointer;
	font: inherit;
	font-size: var(--font-size-sm);
	font-weight: var(--font-weight-medium);
}

.mark-read:hover,
.mark-read:focus-visible {
	background: var(--action-default-hover);
}

.next-handbook {
	color: var(--action-default-hover);
	text-decoration: none;
	padding: var(--space-xs) var(--space-md);
	border-radius: var(--radius-sm);
	border: 1px solid var(--edge-default);
	font-size: var(--font-size-sm);
}

.next-handbook:hover,
.next-handbook:focus-visible {
	background: var(--surface-panel);
	color: var(--ink-strong);
}

.reader-nav.variant-end {
	border-top: 1px solid var(--edge-default);
	margin-top: 0;
	padding-top: var(--space-sm);
}
</style>
