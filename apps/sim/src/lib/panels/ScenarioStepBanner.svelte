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
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: #0c2a4a;
		border: 1px solid #1f4a7a;
		border-radius: 6px;
		color: #eaf4ff;
	}

	.banner.done {
		background: #0c3a1a;
		border-color: #1f6a3a;
	}

	.step-count {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: #9bbfff;
		align-self: start;
		white-space: nowrap;
	}

	.banner.done .step-count {
		color: #9bffb0;
	}

	.step-body h3 {
		margin: 0;
		font-size: 1rem;
	}

	.step-body p {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
	}

	.hold-bar {
		margin-top: 0.4rem;
		height: 4px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 2px;
		overflow: hidden;
	}

	.hold-fill {
		height: 100%;
		background: #ffe270;
		transition: width 120ms linear;
	}

	.hold-note {
		margin-top: 0.2rem;
		font-size: 0.75rem;
		color: #9bbfff;
	}

	.done-note {
		margin-top: 0.35rem;
		font-size: 0.85rem;
		color: #9bffb0;
		font-weight: bold;
	}
</style>
