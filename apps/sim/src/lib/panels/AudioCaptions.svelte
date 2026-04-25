<script lang="ts">
/**
 * Visible audio captions for every cockpit sound cue (WCAG 1.2.1). Subscribes
 * to the shared `captionStore` and renders an `aria-live="polite"` region so
 * screen readers announce each new caption. Each caption is retained for
 * `SIM_CAPTION.LINGER_MS` after its cue deactivates so intermittent cues
 * (stall blinks, marker dots) do not flicker.
 *
 * Placed near the top of the cockpit in the scenario page -- the panel is
 * decorative when no cues are active and collapses to zero height.
 */

import { captionStore } from '$lib/warning-cues/audio-captions.svelte';

const captions = $derived(captionStore.captions);
</script>

<section
	class="captions"
	aria-label="Audio cue captions"
	aria-live="polite"
	aria-atomic="false"
	class:hidden={captions.length === 0}
>
	{#each captions as caption (caption.cue)}
		<span class="caption" class:fading={caption.expiresAt !== null}>{caption.label}</span>
	{/each}
</section>

<style>
	.captions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		margin-bottom: var(--space-sm);
		min-height: 1.75rem;
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-xs);
		background: var(--surface-panel);
		font-size: var(--font-size-xs);
		color: var(--ink-body);
		transition: opacity var(--motion-fast);
	}

	.captions.hidden {
		opacity: 0.5;
	}

	.caption {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--sim-banner-info-bg);
		color: var(--sim-banner-info-fg);
		border: 1px solid var(--sim-banner-info-border);
		font-family: var(--font-family-mono);
		transition: opacity var(--motion-fast);
	}

	.caption.fading {
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.captions,
		.caption {
			transition: none;
		}
	}
</style>
