<script lang="ts">
/**
 * Decode / Understand / Triage skill-ladder tab strip for the encoded-text
 * product family (METAR, TAF, PIREP, AIRMET, SIGMET, ...). Visual hint only
 * in the course-reader-and-editor WP -- clicking does not filter content.
 * Per-tab content is deferred (see WP OUT-OF-SCOPE.md).
 *
 * The tabs surface above a node body whose slug matches
 * `WX_DECODE_PRODUCT_SLUGS`.
 */

const TABS = ['Decode', 'Understand', 'Triage'] as const;
</script>

<aside class="ladder" aria-label="Encoded-text skill ladder">
	<span class="ladder-label">Skill ladder</span>
	<div class="tabs" role="tablist" aria-label="Skill ladder rungs">
		{#each TABS as label, i (label)}
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={i === 0}
				aria-selected={i === 0 ? 'true' : 'false'}
				disabled
				title="Filtering is deferred (see WP OUT-OF-SCOPE.md)"
			>
				{label}
			</button>
		{/each}
	</div>
</aside>

<style>
	.ladder {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		flex-wrap: wrap;
	}

	.ladder-label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.tabs {
		display: flex;
		gap: var(--space-xs);
	}

	.tab {
		padding: var(--space-2xs) var(--space-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: var(--ink-muted);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		cursor: not-allowed;
	}

	.tab.active {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border-color: var(--action-default-edge);
	}
</style>
