<script lang="ts" module>
/**
 * Lifecycle states a `BadgeStatus` understands. Distinct from the
 * generic `Badge` `tone` axis -- this primitive maps a domain-state
 * value (active / idle / archived / pending) to a paired
 * background+ink treatment, no glyph, pill shape. Used for plan /
 * session / area lifecycle indicators where the *status* (not the
 * tone) is the load-bearing concept.
 */
export type BadgeStatusState = 'active' | 'idle' | 'archived' | 'pending';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Pill-style status indicator. Mirrors the inline `.badge` /
 * `.badge.active` pattern duplicated across `plans/+page.svelte`,
 * `plans/[id]/+page.svelte`, and (in spirit) the area-completion
 * pill on `credentials/[slug]`. The `state` axis is semantic --
 * "active" highlights the currently-running plan / session, "idle"
 * is the neutral resting state, "archived" the de-emphasized
 * past-tense, "pending" for awaiting / queued items.
 *
 * Difference vs `Badge`:
 *  - `Badge` carries a leading glyph and a tone-driven wash for
 *    inline metadata chips (domain / type / source).
 *  - `BadgeStatus` is glyph-free, uses solid-fill on `active` to
 *    pull the eye, and is meant to read as "the current state of
 *    this thing."
 */

let {
	state = 'idle',
	ariaLabel,
	children,
}: {
	state?: BadgeStatusState;
	ariaLabel?: string;
	children: Snippet;
} = $props();
</script>

<span
	class="badge-status s-{state}"
	aria-label={ariaLabel}
	data-testid="badge-status-root"
	data-state={state}
>
	{@render children()}
</span>

<style>
	.badge-status {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		line-height: 1.1;
		letter-spacing: var(--letter-spacing-normal);
		white-space: nowrap;
	}

	.s-idle {
		background: var(--edge-default);
		color: var(--ink-muted);
	}

	.s-active {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.s-archived {
		background: var(--surface-sunken);
		color: var(--ink-faint);
	}

	.s-pending {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}
</style>
