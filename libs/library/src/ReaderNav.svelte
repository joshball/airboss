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
 * Two visual variants:
 * - `footer` (default): a thin underlined strip at the bottom of every page
 *   so readers can flip pages like a book. All three slots inline; missing
 *   slots leave the column empty so the strip stays balanced.
 * - `empty`: a centered block used inside an empty-body section's
 *   `emptyFallback` snippet -- larger touch targets, clearer "this section
 *   has no content but here's where to go next" affordance.
 *
 * Both variants render the same anchor markup; only spacing/typography
 * differ. When all three nav slots are null (e.g. a one-page reference),
 * the component renders nothing -- the markup costs nothing on a doc the
 * navigator doesn't apply to.
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
	readonly variant?: 'footer' | 'empty';
}
</script>

<script lang="ts">
let { nav, variant = 'footer' }: ReaderNavProps = $props();

const hasAny = $derived(nav.prev !== null || nav.next !== null || nav.up !== null);
</script>

{#if hasAny}
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
</style>
