<script lang="ts">
import { CONFIDENCE_LEVEL_LABELS, CONFIDENCE_LEVEL_VALUES, type ConfidenceLevel } from '@ab/constants';

interface Props {
	onSelect: (value: ConfidenceLevel) => void;
	onSkip: () => void;
	prompt?: string;
	skipLabel?: string;
	selected?: ConfidenceLevel | null;
}

let {
	onSelect,
	onSkip,
	prompt = 'Before revealing -- how confident are you?',
	skipLabel = 'Skip confidence',
	selected = null,
}: Props = $props();
</script>

<article class="prompt">
	<p class="prompt-q">{prompt}</p>
	<div class="confidence-row" role="radiogroup" aria-label={prompt}>
		{#each CONFIDENCE_LEVEL_VALUES as level (level)}
			<button
				type="button"
				role="radio"
				aria-checked={selected === level}
				aria-label={`${level} -- ${CONFIDENCE_LEVEL_LABELS[level]}`}
				class="conf"
				class:is-selected={selected === level}
				onclick={() => onSelect(level)}
			>
				<span class="conf-num">{level}</span>
				<span class="conf-label">{CONFIDENCE_LEVEL_LABELS[level]}</span>
			</button>
		{/each}
	</div>
	<button
		type="button"
		class="skip"
		onclick={onSkip}
		aria-describedby="skip-hint"
	>
		{skipLabel}
	</button>
	<span id="skip-hint" class="skip-hint">Skipping stops calibration tracking for this card.</span>
</article>

<style>
	.prompt {
		background: var(--ab-color-surface);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-layout-panel-padding);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
		align-items: center;
	}

	.prompt-q {
		margin: 0;
		color: var(--ab-color-fg);
		font-size: var(--ab-font-size-sm);
	}

	.confidence-row {
		display: flex;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
		justify-content: center;
	}

	.conf {
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-control-radius);
		padding: var(--ab-control-padding-y-lg) var(--ab-control-padding-x-md);
		min-width: 5rem;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
		align-items: center;
		cursor: pointer;
		font-family: inherit;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.conf:hover {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.conf:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
	}

	.conf.is-selected {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary);
	}

	.conf-num {
		font-weight: var(--ab-font-weight-bold);
		font-size: var(--ab-font-size-lg);
		color: var(--ab-color-primary-hover);
	}

	.conf-label {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
	}

	/*
	 * Skip: text-only escape hatch, deliberately not a peer of the confidence
	 * buttons. Underlined link affordance makes it scannable as "opt out"
	 * rather than another option to pick.
	 */
	.skip {
		align-self: center;
		background: transparent;
		border: none;
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		color: var(--ab-color-fg-subtle);
		font-family: inherit;
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-regular);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
		transition: color var(--ab-transition-fast);
	}

	.skip:hover {
		color: var(--ab-color-fg);
	}

	.skip:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-radius: var(--ab-radius-sm);
	}

	.skip-hint {
		margin-top: calc(-1 * var(--ab-space-sm));
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		text-align: center;
	}
</style>
