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
				onclick={() => onSelect(level)}
			>
				<span class="conf-num">{level}</span>
				<span class="conf-label">{CONFIDENCE_LEVEL_LABELS[level]}</span>
			</button>
		{/each}
	</div>
	<button type="button" class="btn ghost skip" onclick={onSkip}>{skipLabel}</button>
</article>

<style>
	.prompt {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.prompt-q {
		margin: 0;
		color: #334155;
		font-size: 0.9375rem;
	}

	.confidence-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.conf {
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 0.75rem 0.75rem;
		min-width: 5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: center;
		cursor: pointer;
		transition:
			background 120ms,
			border-color 120ms;
	}

	.conf:hover {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.conf-num {
		font-weight: 700;
		font-size: 1.125rem;
		color: #1d4ed8;
	}

	.conf-label {
		font-size: 0.75rem;
		color: #64748b;
	}

	.skip {
		align-self: center;
	}

	.btn {
		padding: 0.625rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 10px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition:
			background 120ms,
			border-color 120ms;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
