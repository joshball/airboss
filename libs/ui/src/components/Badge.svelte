<script lang="ts" module>
import type { Tone } from '@ab/themes';
export type BadgeTone = Tone;
export type BadgeSize = 'sm' | 'md' | 'lg';

/**
 * Tone -> glyph mapping. Each tone carries a leading shape so the badge
 * communicates state by shape + color + text, not by color + text
 * alone. Required for WCAG 1.4.1 (Use of Color) on monochrome / color-
 * blind viewports where the wash/edge tokens collapse.
 *
 * The glyph is decorative (`aria-hidden`); the text label remains the
 * accessible name. Unicode is used in preference to inline SVG so the
 * primitive has no asset / icon-system dependency.
 *
 *   success  check mark   positive / clean / extracted
 *   warning  warning sign caution / dirty / pending attention
 *   danger   ban circle   error / banned / failed
 *   info     info source  neutral informational
 *   featured star         focal indicator on a surface
 *   accent   diamond      decorative emphasis
 *   muted    en dash      de-emphasized FYI
 *   default  bullet       ordinary, no special intent
 */
export const BADGE_TONE_GLYPHS: Record<Tone, string> = {
	success: '✓',
	warning: '⚠',
	danger: '⦸',
	info: 'ℹ',
	featured: '★',
	accent: '◆',
	muted: '–',
	default: '•',
};
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Small inline status marker. Theme-aware -- reads wash/edge tokens for
 * each semantic tone so colors stay consistent with the host theme.
 *
 * Renders a leading tone-driven glyph by default (decorative,
 * `aria-hidden`) so meaning carries on monochrome / color-blind
 * displays. Pass `glyph={false}` to suppress when children already
 * provide their own leading icon.
 */

let {
	tone = 'default',
	size = 'md',
	glyph = true,
	ariaLabel,
	children,
}: {
	tone?: Tone;
	size?: BadgeSize;
	glyph?: boolean;
	ariaLabel?: string;
	children: Snippet;
} = $props();
</script>

<span
	class="badge v-{tone} s-{size}"
	aria-label={ariaLabel}
	data-testid="badge-root"
	data-tone={tone}
	data-size={size}
>
	{#if glyph}
		<span class="glyph" aria-hidden="true" data-testid="badge-glyph">{BADGE_TONE_GLYPHS[tone]}</span>
	{/if}
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-weight: var(--font-weight-medium);
		letter-spacing: var(--letter-spacing-normal);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-semibold);
		line-height: 1;
		/* Glyph carries non-color meaning; keep weight tied to color so it
		 * doesn't compete with the text label visually but stays present
		 * in monochrome rendering. */
	}

	.s-sm {
		padding: 0 var(--space-2xs);
		font-size: var(--font-size-xs);
		min-height: var(--badge-height-sm);
	}

	.s-md {
		padding: var(--space-2xs) var(--space-xs);
		font-size: var(--font-size-sm);
		min-height: var(--badge-height-md);
	}

	.s-lg {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-base);
		min-height: var(--badge-height-lg);
	}

	.v-default {
		background: var(--action-neutral-wash);
		color: var(--ink-subtle);
		border-color: var(--action-neutral-edge);
	}

	.v-featured {
		background: var(--action-default-wash);
		color: var(--action-default);
		border-color: var(--action-default-edge);
	}

	.v-info {
		background: var(--signal-info-wash);
		color: var(--signal-info);
		border-color: var(--signal-info-edge);
	}

	.v-success {
		background: var(--signal-success-wash);
		color: var(--signal-success);
		border-color: var(--signal-success-edge);
	}

	.v-warning {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
		border-color: var(--signal-warning-edge);
	}

	.v-danger {
		background: var(--action-hazard-wash);
		color: var(--action-hazard);
		border-color: var(--action-hazard-edge);
	}

	.v-muted {
		background: var(--action-neutral-wash);
		color: var(--ink-subtle);
		border-color: var(--action-neutral-edge);
	}

	.v-accent {
		background: var(--action-default-wash);
		color: var(--accent-code);
		border-color: var(--action-default-edge);
	}
</style>
