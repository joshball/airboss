<script lang="ts">
/**
 * Tutorial step banner for First Flight. Shows current step text, hold
 * progress (if required), and checkmarks off completed steps.
 */

import type { ScenarioStepState } from '@ab/bc-sim';

let {
	stepState,
}: {
	stepState: ScenarioStepState | null | undefined;
} = $props();

const holdFrac = $derived.by(() => {
	if (!stepState) return 0;
	if (stepState.holdRequiredSeconds <= 0) return 0;
	return Math.min(1, stepState.holdAccumulatorSeconds / stepState.holdRequiredSeconds);
});
</script>

{#if stepState}
	<section class="banner" class:done={stepState.completed} aria-label="Scenario step guidance">
		<div class="step-count">
			Step {stepState.currentStepIndex + 1}/{stepState.totalSteps}
		</div>
		<div class="step-body">
			<h3>{stepState.currentStepTitle}</h3>
			<p>{stepState.currentStepInstruction}</p>
			{#if stepState.holdRequiredSeconds > 0 && !stepState.completed}
				<div class="hold-bar" aria-label={`Hold progress ${Math.round(holdFrac * 100)} percent`}>
					<div class="hold-fill" style:width={`${holdFrac * 100}%`}></div>
				</div>
				<div class="hold-note">Hold condition for {stepState.holdRequiredSeconds.toFixed(1)}s</div>
			{/if}
			{#if stepState.completed}
				<div class="done-note">All steps complete. Well flown.</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.banner {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		background: var(--sim-banner-info-bg);
		border: 1px solid var(--sim-banner-info-border);
		border-radius: var(--radius-sm);
		color: var(--sim-banner-info-fg);
	}

	.banner.done {
		background: var(--sim-banner-success-bg);
		border-color: var(--sim-banner-success-border);
	}

	.step-count {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--sim-status-primary-fg);
		align-self: start;
		white-space: nowrap;
	}

	.banner.done .step-count {
		color: var(--sim-status-success-fg);
	}

	.step-body h3 {
		margin: 0;
		font-size: var(--font-size-base);
	}

	.step-body p {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-body);
	}

	.hold-bar {
		margin-top: var(--space-sm);
		height: 4px;
		background: var(--sim-panel-bg-darker);
		border-radius: var(--radius-xs);
		overflow: hidden;
	}

	.hold-fill {
		height: 100%;
		background: var(--sim-instrument-pointer);
		transition: width var(--motion-fast);
	}

	.hold-note {
		margin-top: var(--space-2xs);
		font-size: var(--font-size-xs);
		color: var(--sim-status-primary-fg);
	}

	.done-note {
		margin-top: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--sim-status-success-fg);
		font-weight: bold;
	}
</style>
