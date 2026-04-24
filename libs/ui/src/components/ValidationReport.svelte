<script lang="ts" module>
/**
 * Render a validation result (pass / warning / fail) with per-check cards.
 *
 * Ported from airboss-firc. Shape is deliberately minimal so any airboss caller
 * can assemble a report from arbitrary validation sources (reference system,
 * sources registry, upload checks). Tokens only; no hardcoded colors.
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationStatus = 'pass' | 'warning' | 'fail';

export interface ValidationViolation {
	severity: ValidationSeverity;
	message: string;
	/** Optional "actual / threshold" pair for rendering beside the message. */
	actual?: number;
	threshold?: number;
}

export interface ValidationCheck {
	name: string;
	description: string;
	status: ValidationStatus;
	/** Summary line rendered below the header. */
	message: string;
	violations: readonly ValidationViolation[];
}

export interface ValidationReportData {
	status: ValidationStatus;
	checkedAt: string;
	checks: readonly ValidationCheck[];
}
</script>

<script lang="ts">
import Banner from './Banner.svelte';

const { report }: { report: ValidationReportData } = $props();

function statusLabel(status: ValidationStatus): string {
	if (status === 'pass') return 'PASS';
	if (status === 'warning') return 'WARN';
	return 'FAIL';
}

function statusClass(status: ValidationStatus): string {
	if (status === 'pass') return 'status-pass';
	if (status === 'warning') return 'status-warning';
	return 'status-fail';
}

function formatCheckedAt(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function keyForCheck(check: ValidationCheck): string {
	return check.name;
}

function keyForViolation(violation: { message: string }, index: number): string {
	return `${index}:${violation.message}`;
}
</script>

<div class="validation-report">
	<div class="report-header">
		<span class="overall-status {statusClass(report.status)}">
			{statusLabel(report.status)}
		</span>
		<span class="checked-at">Checked at {formatCheckedAt(report.checkedAt)}</span>
	</div>

	{#if report.status === 'fail'}
		<Banner tone="danger">
			Content validation has errors. Publish is blocked until all errors are resolved.
		</Banner>
	{:else if report.status === 'warning'}
		<Banner tone="warning">
			Content validation passed with warnings. Publish is allowed but review is recommended.
		</Banner>
	{/if}

	<div class="checks">
		{#each report.checks as check (keyForCheck(check))}
			<div class="check-card {statusClass(check.status)}">
				<div class="check-header">
					<span class="check-status">{statusLabel(check.status)}</span>
					<div class="check-info">
						<h3 class="check-name">{check.name}</h3>
						<span class="check-description">{check.description}</span>
					</div>
				</div>
				{#if check.violations.length > 0}
					<div class="check-message">{check.message}</div>
					<ul class="violations">
						{#each check.violations as violation, index (keyForViolation(violation, index))}
							<li class="violation v-{violation.severity}">
								{violation.message}
								{#if violation.actual !== undefined && violation.threshold !== undefined}
									<span class="violation-numbers">({violation.actual} / {violation.threshold})</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<div class="check-message pass-message">{check.message}</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.validation-report {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.report-header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.overall-status {
		font-weight: var(--font-weight-bold);
		font-size: var(--type-ui-control-size);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-md);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-wide);
	}

	.checked-at {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.check-card {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		border-left-width: 4px;
		background: var(--surface-panel);
	}

	.check-card.status-pass {
		border-left-color: var(--signal-success);
		background: var(--signal-success-wash);
	}

	.check-card.status-warning {
		border-left-color: var(--signal-warning);
		background: var(--signal-warning-wash);
	}

	.check-card.status-fail {
		border-left-color: var(--signal-danger);
		background: var(--signal-danger-wash);
	}

	.check-header {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
	}

	.check-status {
		font-weight: var(--font-weight-bold);
		font-size: var(--type-ui-caption-size);
		min-width: 3rem;
		text-align: center;
		padding: var(--space-2xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-wide);
	}

	.status-pass .check-status { color: var(--signal-success); }
	.status-warning .check-status { color: var(--signal-warning); }
	.status-fail .check-status { color: var(--signal-danger); }

	.overall-status.status-pass {
		background: var(--signal-success);
		color: var(--signal-success-ink);
	}
	.overall-status.status-warning {
		background: var(--signal-warning);
		color: var(--signal-warning-ink);
	}
	.overall-status.status-fail {
		background: var(--signal-danger);
		color: var(--signal-danger-ink);
	}

	.check-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.check-name {
		font-size: var(--type-ui-control-size);
		font-weight: var(--font-weight-bold);
		margin: 0;
		color: var(--ink-body);
	}

	.check-description {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.check-message {
		margin-top: var(--space-xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.pass-message {
		color: var(--signal-success);
	}

	.violations {
		margin-top: var(--space-xs);
		padding-left: var(--space-xl);
		list-style: disc;
	}

	.violation {
		font-size: var(--type-ui-label-size);
		padding: var(--space-2xs) 0;
	}

	.violation.v-error { color: var(--signal-danger); }
	.violation.v-warning { color: var(--signal-warning); }
	.violation.v-info { color: var(--signal-info); }

	.violation-numbers {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}
</style>
