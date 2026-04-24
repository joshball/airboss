<script lang="ts">
import { navigating } from '$app/state';

/**
 * Top-of-page navigation progress indicator. Renders a thin primary-colored
 * bar while SvelteKit is routing between pages, giving the user passive
 * feedback that a click landed and work is in flight. Reads `$app/state`'s
 * `navigating` signal directly; callers just drop it at the top of the
 * root layout and it handles the rest.
 *
 * Keep the styling minimal -- tokens only, no motion keyframes beyond a
 * simple opacity fade -- so themes can reskin it without a rewrite.
 */
</script>

{#if navigating.to}
	<div class="nav-indicator" role="status" aria-live="polite" aria-label="Loading next page">
		<span class="nav-indicator-bar"></span>
	</div>
{/if}

<style>
	.nav-indicator {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		/*
		 * NAV_PROGRESS tier sits above MODAL (100) but below COMMAND_PALETTE
		 * (200) and TOAST (300). Reason: a Dialog with a form action submits
		 * and triggers a SvelteKit route transition while the modal is still
		 * visible during its close animation; the progress bar has to render
		 * above the scrim so the user sees "something is happening" feedback
		 * during that window. See @ab/constants Z_INDEX.
		 */
		z-index: var(--z-nav-progress);
		pointer-events: none;
		background: transparent;
	}

	.nav-indicator-bar {
		display: block;
		height: 100%;
		width: 40%;
		background: var(--action-default);
		animation: nav-indicator-slide var(--motion-slow) ease-in-out infinite;
	}

	@keyframes nav-indicator-slide {
		0% {
			margin-left: -40%;
			width: 40%;
		}
		50% {
			margin-left: 30%;
			width: 60%;
		}
		100% {
			margin-left: 100%;
			width: 40%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-indicator-bar {
			animation: none;
			width: 100%;
			margin-left: 0;
			opacity: 0.6;
		}
	}
</style>
