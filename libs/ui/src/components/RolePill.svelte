<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Compact uppercase role/category pill.
 *
 * Used for short, persistent meta labels like roles ("ADMIN", "AUTHOR")
 * inside table rows / nav headers / detail pages. Visually similar to a
 * Badge but with a pill radius, uppercase letter spacing, and no leading
 * glyph -- the label is short enough that the visual treatment alone
 * carries the meaning, and a glyph would clutter the inline flow.
 *
 * Reads color from action-default tokens so it tracks the host theme.
 */

let {
	children,
	ariaLabel,
	ariaHidden = false,
}: {
	children: Snippet;
	ariaLabel?: string;
	/**
	 * Hide the pill from assistive tech. Useful when the role label is
	 * already announced by an adjacent element (e.g. account-menu where
	 * the user's name carries the meaning and the pill is decoration).
	 */
	ariaHidden?: boolean;
} = $props();
</script>

<span
	class="role-pill"
	data-testid="role-pill-root"
	aria-label={ariaLabel}
	aria-hidden={ariaHidden ? 'true' : undefined}
>
	{@render children()}
</span>

<style>
	.role-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}
</style>
