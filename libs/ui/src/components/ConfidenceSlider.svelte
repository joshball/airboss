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

// Per-instance id so two ConfidenceSliders on the same page don't collide on
// `aria-describedby="skip-hint"`. Mirrors the pattern in ThemePicker.svelte.
const instanceId = $props.id();
const skipHintId = `${instanceId}-skip-hint`;

// WAI-ARIA radiogroup requires arrow-key roving among the radios. The selected
// (or first) radio takes tabindex=0; the rest take tabindex=-1.
const focusIndex = $derived(selected === null ? 0 : Math.max(0, CONFIDENCE_LEVEL_VALUES.indexOf(selected)));

function handleRadioKeyDown(event: KeyboardEvent, idx: number): void {
	const last = CONFIDENCE_LEVEL_VALUES.length - 1;
	let nextIdx: number | null = null;
	switch (event.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			nextIdx = idx === last ? 0 : idx + 1;
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			nextIdx = idx === 0 ? last : idx - 1;
			break;
		case 'Home':
			nextIdx = 0;
			break;
		case 'End':
			nextIdx = last;
			break;
	}
	if (nextIdx === null) return;
	event.preventDefault();
	const next = CONFIDENCE_LEVEL_VALUES[nextIdx];
	onSelect(next);
	requestAnimationFrame(() => {
		document.getElementById(`${instanceId}-radio-${next}`)?.focus();
	});
}
</script>

<article class="prompt">
	<p class="prompt-q">{prompt}</p>
	<div class="confidence-row" role="radiogroup" aria-label={prompt}>
		{#each CONFIDENCE_LEVEL_VALUES as level, i (level)}
			<button
				type="button"
				id={`${instanceId}-radio-${level}`}
				role="radio"
				aria-checked={selected === level}
				aria-label={`${level} -- ${CONFIDENCE_LEVEL_LABELS[level]}`}
				class="conf"
				class:is-selected={selected === level}
				tabindex={i === focusIndex ? 0 : -1}
				onclick={() => onSelect(level)}
				onkeydown={(e) => handleRadioKeyDown(e, i)}
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
		aria-describedby={skipHintId}
	>
		{skipLabel}
	</button>
	<span id={skipHintId} class="skip-hint">Skipping stops calibration tracking for this card.</span>
</article>

<style>
	.prompt {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--layout-panel-padding);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
	}

	.prompt-q {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--font-size-sm);
	}

	.confidence-row {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		justify-content: center;
	}

	.conf {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-strong);
		border-radius: var(--control-radius);
		padding: var(--control-padding-y-lg) var(--control-padding-x-md);
		min-width: var(--space-2xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		align-items: center;
		cursor: pointer;
		font-family: inherit;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.conf:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.conf:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.conf.is-selected {
		background: var(--action-default-wash);
		border-color: var(--action-default);
	}

	.conf-num {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		color: var(--action-default-hover);
	}

	.conf-label {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
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
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-subtle);
		font-family: inherit;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-regular);
		text-decoration: underline;
		text-underline-offset: var(--underline-offset-2xs);
		cursor: pointer;
		transition: color var(--motion-fast);
	}

	.skip:hover {
		color: var(--ink-body);
	}

	.skip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.skip-hint {
		margin-top: calc(-1 * var(--space-sm));
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		text-align: center;
	}
</style>
