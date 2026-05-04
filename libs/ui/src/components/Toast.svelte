<script lang="ts" module>
import type { Tone } from '@ab/themes';
export type ToastTone = Tone;
export type ToastShape = 'pill' | 'card';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Transient status notification. Companion to `Banner`:
 *
 *  - `Banner`  - persistent inline message (form errors, page banners)
 *  - `Toast`   - short-lived feedback (saved!, copied!, undo)
 *
 * The component is a pure visual primitive; lifecycle (timer, visibility
 * gate, cleanup) stays with the host page so it can coordinate with
 * `$effect` cleanup, `enhance` callbacks, etc. Render the toast inside
 * the host's `{#if visible}` block; the toast handles `role="status"` +
 * `aria-live` + the fade-in animation, but does NOT mount a timer.
 *
 * Two shapes:
 *  - `pill` (default) - small rounded chip used for "Copied!" / "Saved!"
 *    feedback near the action that triggered it.
 *  - `card` - wider rounded box used for inline undo bars where the
 *    message carries an action (`actions` snippet).
 *
 * Replaces three convergent inline patterns flagged in the chunk-1 svelte
 * review: `.share-toast`, `.undo-toast` (memory/review/[sessionId]) and
 * `.toast` (memory/[id]/_panels/CardDetailPanel).
 */

let {
	tone = 'success',
	shape = 'pill',
	live = 'polite',
	ariaLabel,
	children,
	actions,
}: {
	tone?: Tone;
	shape?: ToastShape;
	/**
	 * Live-region politeness. `polite` is the default for non-blocking
	 * status updates; `assertive` for time-critical feedback (rarely
	 * needed in this app -- prefer Banner with a danger tone for that).
	 */
	live?: 'polite' | 'assertive';
	/**
	 * Optional accessible name for the toast region itself (in addition
	 * to its body content). Used when the visible body is icon-only or
	 * abbreviation-heavy.
	 */
	ariaLabel?: string;
	children: Snippet;
	/**
	 * Trailing action slot for `shape='card'` toasts (e.g. an Undo
	 * button + Dismiss in `memory/review`). Suppressed on pill shape.
	 */
	actions?: Snippet;
} = $props();
</script>

<div
	class="toast s-{shape} t-{tone}"
	role="status"
	aria-live={live}
	aria-label={ariaLabel}
	data-testid="toast-root"
	data-tone={tone}
	data-shape={shape}
>
	<span class="body" data-testid="toast-body">{@render children()}</span>
	{#if shape === 'card' && actions}
		<span class="actions" data-testid="toast-actions">{@render actions()}</span>
	{/if}
</div>

<style>
	.toast {
		display: inline-flex;
		align-items: center;
		gap: var(--space-md);
		font-family: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		line-height: var(--line-height-normal);
		border: 1px solid transparent;
		animation: toast-fade-in var(--motion-normal) ease-out;
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.actions {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	.s-pill {
		padding: var(--space-2xs) var(--space-md);
		border-radius: var(--radius-pill);
	}

	.s-card {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-lg);
	}

	.t-default {
		background: var(--action-neutral-wash);
		border-color: var(--action-neutral-edge);
		color: var(--ink-body);
	}

	.t-featured {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default);
	}

	.t-info {
		background: var(--signal-info-wash);
		border-color: var(--signal-info-edge);
		color: var(--signal-info);
	}

	.t-success {
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
		color: var(--signal-success);
	}

	.t-warning {
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
		color: var(--signal-warning);
	}

	.t-danger {
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
		color: var(--action-hazard-active);
	}

	.t-muted {
		background: var(--action-neutral-wash);
		border-color: var(--action-neutral-edge);
		color: var(--ink-subtle);
	}

	.t-accent {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--accent-code);
	}

	@keyframes toast-fade-in {
		from { opacity: 0; transform: translateY(4px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.toast { animation: none; }
	}
</style>
