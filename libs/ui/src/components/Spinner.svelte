<script lang="ts" module>
export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerTone = 'default' | 'inverse';
</script>

<script lang="ts">
/**
 * Indeterminate spinner. Size + tone variants. Respects
 * `prefers-reduced-motion` by suspending the rotation.
 */

let {
	size = 'md',
	tone = 'default',
	ariaLabel = 'Loading',
}: {
	size?: SpinnerSize;
	tone?: SpinnerTone;
	ariaLabel?: string;
} = $props();
</script>

<span class="sp s-{size} t-{tone}" role="status" aria-label={ariaLabel}>
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<circle class="track" cx="12" cy="12" r="10" fill="none" stroke-width="3" />
		<circle class="arc" cx="12" cy="12" r="10" fill="none" stroke-width="3" stroke-linecap="round" />
	</svg>
</span>

<style>
	.sp {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	svg {
		animation: spin var(--motion-slow) linear infinite;
	}

	.s-sm svg { width: 1rem; height: 1rem; }
	.s-md svg { width: 1.5rem; height: 1.5rem; }
	.s-lg svg { width: 2rem; height: 2rem; }

	.t-default .track { stroke: var(--edge-subtle); }
	.t-default .arc { stroke: var(--action-default); stroke-dasharray: 40 62.8; }

	.t-inverse .track { stroke: var(--ink-inverse-subtle); }
	.t-inverse .arc { stroke: var(--ink-inverse); stroke-dasharray: 40 62.8; }

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (prefers-reduced-motion: reduce) {
		svg { animation: none; }
	}
</style>
