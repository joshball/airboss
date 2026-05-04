<script lang="ts" module>
import {
	FRONTMATTER_REVIEW_STATUS_VALUES,
	FRONTMATTER_STATUS_VALUES,
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	type ReviewKind,
} from '@ab/constants';

export interface BucketFormInitial {
	readonly name: string;
	readonly kindId: string;
	readonly sortOrder: string;
	readonly filterKind: string;
	readonly filterFmStatuses: readonly string[];
	readonly filterReviewStatuses: readonly string[];
	readonly filterNoPassing: boolean;
	readonly advancedJson: string;
}

export interface BucketFormProps {
	readonly initial: BucketFormInitial;
	readonly errors: Record<string, string>;
	readonly submitLabel: string;
	readonly action: string;
	readonly saving: boolean;
}

export const KIND_OPTIONS = REVIEW_KIND_VALUES.map((id) => ({
	id,
	label: REVIEW_KIND_LABELS[id as ReviewKind] ?? id,
}));
export const FM_STATUS_OPTIONS = FRONTMATTER_STATUS_VALUES;
export const REVIEW_STATUS_OPTIONS = FRONTMATTER_REVIEW_STATUS_VALUES;
</script>

<script lang="ts">
import Button from '@ab/ui/components/Button.svelte';

let { initial, errors, submitLabel, saving }: BucketFormProps = $props();
</script>

<div class="form">
	<label class="field">
		<span class="label">Name</span>
		<input
			name="name"
			type="text"
			required
			maxlength="200"
			value={initial.name}
			autofocus
			aria-invalid={errors.name ? 'true' : undefined}
		/>
		{#if errors.name}<small class="err">{errors.name}</small>{/if}
	</label>

	<label class="field">
		<span class="label">Kind</span>
		<select name="kindId" required aria-invalid={errors.kindId ? 'true' : undefined}>
			<option value="">-- select --</option>
			{#each KIND_OPTIONS as opt (opt.id)}
				<option value={opt.id} selected={initial.kindId === opt.id}>{opt.label}</option>
			{/each}
		</select>
		{#if errors.kindId}<small class="err">{errors.kindId}</small>{/if}
	</label>

	<label class="field">
		<span class="label">Sort order</span>
		<input
			name="sortOrder"
			type="number"
			min="0"
			step="1"
			value={initial.sortOrder}
			aria-invalid={errors.sortOrder ? 'true' : undefined}
		/>
		{#if errors.sortOrder}<small class="err">{errors.sortOrder}</small>{/if}
	</label>

	<fieldset class="filter-fs">
		<legend>Filter criteria</legend>

		<label class="field">
			<span class="label">Kind narrow (optional)</span>
			<select name="filterKind">
				<option value="" selected={initial.filterKind === ''}>(any)</option>
				{#each KIND_OPTIONS as opt (opt.id)}
					<option value={opt.id} selected={initial.filterKind === opt.id}>{opt.label}</option>
				{/each}
			</select>
			{#if errors.filterKind}<small class="err">{errors.filterKind}</small>{/if}
		</label>

		<fieldset class="checks">
			<legend>Frontmatter status</legend>
			{#each FM_STATUS_OPTIONS as v (v)}
				<label class="check">
					<input
						type="checkbox"
						name="filterFmStatuses"
						value={v}
						checked={initial.filterFmStatuses.includes(v)}
					/>
					{v}
				</label>
			{/each}
			{#if errors.filterFmStatuses}<small class="err">{errors.filterFmStatuses}</small>{/if}
		</fieldset>

		<fieldset class="checks">
			<legend>Review status</legend>
			{#each REVIEW_STATUS_OPTIONS as v (v)}
				<label class="check">
					<input
						type="checkbox"
						name="filterReviewStatuses"
						value={v}
						checked={initial.filterReviewStatuses.includes(v)}
					/>
					{v}
				</label>
			{/each}
			{#if errors.filterReviewStatuses}<small class="err">{errors.filterReviewStatuses}</small>{/if}
		</fieldset>

		<label class="check">
			<input type="checkbox" name="filterNoPassing" checked={initial.filterNoPassing} />
			Only items with no passing session (e.g. references that haven't been TOC-walked yet)
		</label>
	</fieldset>

	<details class="advanced">
		<summary>Advanced JSON predicate</summary>
		<label class="field">
			<span class="label">Filter criteria JSON (overrides structured fields)</span>
			<textarea
				name="advancedJson"
				rows="4"
				placeholder={'{ "kind": "wp_spec", "frontmatterStatus": ["unread"] }'}
				aria-invalid={errors.advancedJson ? 'true' : undefined}
			>{initial.advancedJson}</textarea>
			{#if errors.advancedJson}<small class="err">{errors.advancedJson}</small>{/if}
			<small class="hint">
				Validated server-side via <code>validateBucketFilterCriteria</code>. Allowed keys: <code>kind</code>,
				<code>frontmatterStatus</code>, <code>reviewStatus</code>, <code>noPassingSession</code>.
			</small>
		</label>
	</details>

	<div class="actions">
		<Button type="submit" variant="primary" loading={saving} loadingLabel="Saving...">{submitLabel}</Button>
	</div>
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
	}

	input,
	textarea,
	select {
		font: inherit;
		font-size: var(--type-ui-control-size);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.filter-fs {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
	}

	.filter-fs legend {
		padding: 0 var(--space-2xs);
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
	}

	.checks {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		padding: 0;
		border: 0;
	}

	.checks legend {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
		padding: 0;
	}

	.check {
		display: inline-flex;
		gap: var(--space-3xs);
		align-items: center;
		font-size: var(--type-ui-label-size);
	}

	.advanced {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
	}

	.advanced summary {
		cursor: pointer;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.err {
		color: var(--signal-danger-ink);
		font-size: var(--type-ui-caption-size);
	}

	.actions {
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}
</style>
