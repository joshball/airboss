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
		gap: var(--ab-space-md);
		padding: var(--ab-space-md) var(--ab-space-lg);
		background: var(--ab-sim-banner-info-bg);
		border: 1px solid var(--ab-sim-banner-info-border);
		border-radius: var(--ab-radius-sm);
		color: var(--ab-sim-banner-info-fg);
	}

	.banner.done {
		background: var(--ab-sim-banner-success-bg);
		border-color: var(--ab-sim-banner-success-border);
	}

	.step-count {
		font-family: var(--ab-font-mono);
		font-size: 0.8rem;
		color: var(--ab-sim-status-primary-fg);
		align-self: start;
		white-space: nowrap;
	}

	.banner.done .step-count {
		color: var(--ab-sim-status-success-fg);
	}

	.step-body h3 {
		margin: 0;
		font-size: 1rem;
	}

	.step-body p {
		margin: var(--ab-space-2xs) 0 0;
		font-size: 0.9rem;
	}

	.hold-bar {
		margin-top: 0.4rem;
		height: 4px;
		background: var(--ab-on-dark-track);
		border-radius: var(--ab-radius-xs);
		overflow: hidden;
	}

	.hold-fill {
		height: 100%;
		background: var(--ab-sim-instrument-pointer);
		transition: width var(--ab-transition-fast);
	}

	.hold-note {
		margin-top: 0.2rem;
		font-size: 0.75rem;
		color: var(--ab-sim-status-primary-fg);
	}

	.done-note {
		margin-top: 0.35rem;
		font-size: 0.85rem;
		color: var(--ab-sim-status-success-fg);
		font-weight: bold;
	}
</style>
