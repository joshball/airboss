<script lang="ts" module>
/**
 * `<Breadcrumbs>` -- shared trail-of-segments header for FAA-reference reader
 * pages.
 *
 * Renders a `<nav aria-label="Breadcrumb">` with each upstream segment as a
 * link and the final segment as plain text. Same shape across every doc-type
 * the flightbag surfaces (handbook, AIM, CFR, AC, ACS, etc.) -- only the
 * segments differ.
 *
 * Each segment passes a label and an optional href: when `href` is null the
 * segment renders as plain text (used for the final, current segment). When
 * `href` is supplied, the segment renders as an `<a>`. The component never
 * inflects "is this current?" itself -- the caller decides which segment is
 * active by passing the matching segment without an `href`.
 *
 * The `»` separator between segments is `aria-hidden`; a screen-reader walks
 * the ordered list of segments without hearing the punctuation.
 */

export interface BreadcrumbSegment {
	readonly label: string;
	readonly href: string | null;
}

export interface BreadcrumbsProps {
	readonly segments: ReadonlyArray<BreadcrumbSegment>;
}
</script>

<script lang="ts">
let { segments }: BreadcrumbsProps = $props();
</script>

<nav aria-label="Breadcrumb" class="breadcrumbs">
	<ol>
		{#each segments as segment, idx (idx)}
			<li>
				{#if segment.href}
					<a href={segment.href}>{segment.label}</a>
				{:else}
					<span aria-current="page">{segment.label}</span>
				{/if}
				{#if idx < segments.length - 1}
					<span class="sep" aria-hidden="true">»</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumbs {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-sm);
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs) var(--space-xs);
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs) var(--space-xs);
	}

	.sep {
		color: var(--ink-muted);
		opacity: 0.6;
	}

	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-underline-offset: 2px;
		transition: text-decoration-color var(--motion-fast);
		border-radius: var(--radius-sm);
	}

	a:hover,
	a:focus-visible {
		color: var(--ink-strong);
		text-decoration-color: currentColor;
	}

	span[aria-current='page'] {
		color: var(--ink-body);
		font-weight: var(--font-weight-medium);
	}
</style>
