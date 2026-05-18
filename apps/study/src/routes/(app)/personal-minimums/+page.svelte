<script lang="ts">
import { NAV_LABELS, PERSONAL_MINIMUMS_DEFAULTS, PERSONAL_MINIMUMS_NOTES_MAX_LENGTH, ROUTES } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import { formatFieldValue, PERSONAL_MINIMUMS_FIELDS, type PersonalMinimumsFieldKey } from './_lib/fields';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const KNOWLEDGE_NODE_URL = ROUTES.REFERENCE_KNOWLEDGE_SLUG('wx-personal-minimums');

/** The empty-state defaults, keyed to match the form field names. */
const DEFAULT_VALUES: Record<PersonalMinimumsFieldKey, number> = {
	ceilingFt: PERSONAL_MINIMUMS_DEFAULTS.CEILING_FT,
	visibilitySm: PERSONAL_MINIMUMS_DEFAULTS.VISIBILITY_SM,
	windTotalKt: PERSONAL_MINIMUMS_DEFAULTS.WIND_TOTAL_KT,
	crosswindTotalKt: PERSONAL_MINIMUMS_DEFAULTS.CROSSWIND_TOTAL_KT,
	nightRequiredRecencyLandings: PERSONAL_MINIMUMS_DEFAULTS.NIGHT_REQUIRED_RECENCY_LANDINGS,
	imcRequiredRecencyApproaches: PERSONAL_MINIMUMS_DEFAULTS.IMC_REQUIRED_RECENCY_APPROACHES,
	paxMax: PERSONAL_MINIMUMS_DEFAULTS.PAX_MAX,
	terrainBufferAgl: PERSONAL_MINIMUMS_DEFAULTS.TERRAIN_BUFFER_AGL,
};

const active = $derived(data.active);
const hasActive = $derived(active !== null);

const fieldErrors = $derived(form && 'fieldErrors' in form ? (form.fieldErrors ?? {}) : {});
const conflict = $derived(form !== null && form !== undefined && 'conflict' in form && form.conflict === true);
const submittedValues = $derived(form && 'values' in form ? form.values : null);
const hasFieldErrors = $derived(Object.keys(fieldErrors).length > 0);

// Edit mode. The loader echoes `data.editing` from the `?edit=1` query
// param (and forces it true when there is no active record -- the empty
// state IS the form). A failed submission keeps the form open so the user
// can fix the inputs. Edit / Cancel are plain links that flip the param.
const editing = $derived(data.editing || hasFieldErrors);
const editHref = $derived(`${ROUTES.STUDY_PERSONAL_MINIMUMS}?edit=1`);

/**
 * The implications violations grouped by scenario, preserving the
 * scenario order from the computation. Each group lists its below-floor
 * stations. Empty when there are no violations (or no active record).
 */
const violationsByScenario = $derived.by(() => {
	const implications = data.implications;
	if (implications === null) return [];
	const groups: { scenario: string; scenarioLabel: string; violations: typeof implications.violations }[] = [];
	for (const v of implications.violations) {
		let group = groups.find((g) => g.scenario === v.scenario);
		if (group === undefined) {
			group = { scenario: v.scenario, scenarioLabel: v.scenarioLabel, violations: [] };
			groups.push(group);
		}
		group.violations.push(v);
	}
	return groups;
});

const saved = $derived(page.url.searchParams.get('saved') === '1');
const deactivated = $derived(page.url.searchParams.get('deactivated') === '1');

/** Pre-fill value for an edit-mode input: last submission > active record > default. */
function initialValue(key: PersonalMinimumsFieldKey): number | string {
	if (submittedValues !== null) {
		const v = submittedValues[key];
		return typeof v === 'number' && Number.isFinite(v) ? v : '';
	}
	if (active !== null) return active[key];
	return DEFAULT_VALUES[key];
}

/** Pre-fill notes for the textarea. */
const initialNotes = $derived.by(() => {
	if (submittedValues !== null) {
		const v = submittedValues.notes;
		return typeof v === 'string' ? v : '';
	}
	return active?.notes ?? '';
});

let notesValue = $state('');
$effect(() => {
	notesValue = initialNotes;
});

function effectiveSince(value: Date | string): string {
	return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<svelte:head>
	<title>{NAV_LABELS.PERSONAL_MINIMUMS} -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title={NAV_LABELS.PERSONAL_MINIMUMS} subtitle="Your self-imposed go / no-go floors, recorded as a contract.">
		{#snippet actions()}
			{#if hasActive && !editing}
				<Button variant="secondary" size="sm" href={editHref}>Edit</Button>
			{/if}
			<Button variant="ghost" size="sm" href={ROUTES.STUDY_PERSONAL_MINIMUMS_HISTORY}>History</Button>
		{/snippet}
	</PageHeader>

	<p class="lead">
		Personal minimums are the numbers you commit to when you are <em>not</em> under decision pressure. Read
		<a href={KNOWLEDGE_NODE_URL}>why they matter</a> first, then record yours here. Saving a change keeps a full
		revision history.
	</p>

	{#if saved}
		<Banner tone="success">Saved. Your new minimums are effective immediately.</Banner>
	{/if}
	{#if deactivated}
		<Banner tone="info">Your minimums are deactivated. Set new ones whenever you are ready.</Banner>
	{/if}
	{#if conflict}
		<Banner tone="warning">
			Your minimums changed in another tab. Reload the page before saving again so you don't overwrite that change.
		</Banner>
	{/if}
	{#if fieldErrors._}
		<Banner tone="danger">{fieldErrors._}</Banner>
	{/if}

	{#if !editing && active !== null}
		<!-- Read mode -->
		<article class="record" data-testid="pmin-record">
			<dl class="fields">
				{#each PERSONAL_MINIMUMS_FIELDS as field (field.key)}
					<div class="field-row">
						<dt>{field.label}</dt>
						<dd data-testid="pmin-value-{field.key}">{formatFieldValue(field, active[field.key])}</dd>
					</div>
				{/each}
			</dl>

			{#if data.activeNotesHtml}
				<section class="notes" aria-label="Notes">
					<h2>Notes</h2>
					<!-- Server-rendered + sanitized via the shared markdown pipeline. -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="notes-body">{@html data.activeNotesHtml}</div>
				</section>
			{/if}

			<p class="effective">Effective since {effectiveSince(active.effectiveFrom)}.</p>

			<form method="POST" action="?/deactivate" use:enhance class="deactivate-form">
				<Button variant="ghost" size="sm" type="submit">Deactivate</Button>
			</form>
		</article>
	{:else}
		<!-- Edit mode / empty state -->
		<form method="POST" action="?/save" use:enhance class="editor" data-testid="pmin-form">
			{#if !hasActive}
				<p class="empty-hint">
					You haven't set your personal minimums yet. The form below is pre-filled with the FAA P-8740-25 baseline for a
					~200-hour private pilot -- a starting point. Tune every number to what <em>you</em> will commit to.
				</p>
			{/if}

			<div class="fields-grid">
				{#each PERSONAL_MINIMUMS_FIELDS as field (field.key)}
					{@const err = fieldErrors[field.key]}
					<div class="field-edit" class:has-error={Boolean(err)}>
						<label for="pmin-{field.key}">{field.label}{#if field.unit}<span class="unit"> ({field.unit})</span>{/if}</label>
						<input
							id="pmin-{field.key}"
							name={field.name}
							type="number"
							inputmode={field.step < 1 ? 'decimal' : 'numeric'}
							min={field.min}
							max={field.max}
							step={field.step}
							value={initialValue(field.key)}
							required
							aria-invalid={err ? 'true' : undefined}
							aria-describedby={err ? `pmin-${field.key}-error` : `pmin-${field.key}-hint`}
							data-testid="pmin-input-{field.key}"
						/>
						{#if err}
							<p class="field-error" id="pmin-{field.key}-error" data-testid="pmin-error-{field.key}">{err}</p>
						{:else}
							<p class="field-hint" id="pmin-{field.key}-hint">{field.hint}</p>
						{/if}
					</div>
				{/each}
			</div>

			<div class="notes-edit">
				<label for="pmin-notes">Notes <span class="optional">(optional, markdown)</span></label>
				<textarea
					id="pmin-notes"
					name="notes"
					rows="5"
					maxlength={PERSONAL_MINIMUMS_NOTES_MAX_LENGTH}
					bind:value={notesValue}
					placeholder="Why these numbers? e.g. tightening the night ceiling for 30 days -- haven't flown after dark since November."
					data-testid="pmin-input-notes"
				></textarea>
				<p class="field-hint">
					{notesValue.length} / {PERSONAL_MINIMUMS_NOTES_MAX_LENGTH} characters.
					{#if fieldErrors.notes}<span class="field-error-inline">{fieldErrors.notes}</span>{/if}
				</p>
			</div>

			<div class="editor-actions">
				<Button variant="primary" type="submit">Save</Button>
				{#if hasActive}
					<Button variant="ghost" href={ROUTES.STUDY_PERSONAL_MINIMUMS}>Cancel</Button>
				{/if}
			</div>
		</form>
	{/if}

	<!-- Implications subpanel: what the active minimums imply against the
	     wx-engine scenarios. Suppressed (placeholder only) when no record. -->
	<section class="implications" aria-label="Implications" data-testid="pmin-implications">
		<h2>What these minimums imply</h2>
		{#if data.implications === null}
			<p class="implications-empty" data-testid="pmin-implications-placeholder">
				Set your minimums to see which weather scenarios they would have meant a no-go for.
			</p>
		{:else}
			{#if violationsByScenario.length === 0}
				<p class="implications-empty" data-testid="pmin-implications-none">
					No registered weather scenario violates your stated floor.
				</p>
			{:else}
				<p class="implications-lead">
					Stations where these floors would have meant a no-go, across the platform's weather scenarios:
				</p>
				{#each violationsByScenario as group (group.scenario)}
					<div class="scenario-group">
						<h3>{group.scenarioLabel}</h3>
						<ul>
							{#each group.violations as v (v.station)}
								<li data-testid="pmin-violation">
									<strong>{v.station}</strong>
									<span class="violation-notes">{v.result.notes.join('; ')}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}

			<div class="night-currency" data-testid="pmin-night-currency">
				<h3>Night currency</h3>
				<p>{data.implications.nightCurrencyPlaceholder}</p>
			</div>
		{/if}
	</section>

	{#if data.history.length > 0}
		<section class="history-preview" aria-label="Recent revisions">
			<h2>Recent revisions</h2>
			<ul>
				{#each data.history as rev (rev.id)}
					<li>
						<span class="rev-window">
							{#if rev.isActive}
								<strong>active</strong> -- since {effectiveSince(rev.effectiveFrom)}
							{:else}
								{effectiveSince(rev.effectiveFrom)} -> {rev.effectiveUntil ? effectiveSince(rev.effectiveUntil) : '--'}
							{/if}
						</span>
						<span class="rev-ceiling">ceiling {rev.ceilingFt} ft</span>
					</li>
				{/each}
			</ul>
			<a href={ROUTES.STUDY_PERSONAL_MINIMUMS_HISTORY}>View full history</a>
		</section>
	{/if}
</section>

<style>
.page {
	max-width: 56rem;
	margin: 0 auto;
	padding: var(--space-xl) var(--space-lg);
	display: flex;
	flex-direction: column;
	gap: var(--space-lg);
}

.lead {
	color: var(--ink-muted);
	max-width: 44rem;
}

.lead a {
	color: var(--action-link);
}

.record,
.editor,
.history-preview,
.implications {
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	padding: var(--space-lg);
	background: var(--surface-raised);
}

.implications-empty,
.implications-lead {
	color: var(--ink-muted);
}

.scenario-group {
	margin-top: var(--space-md);
}

.scenario-group ul {
	list-style: none;
	margin: var(--space-2xs) 0 0;
	padding: 0;
	display: grid;
	gap: var(--space-3xs);
}

.scenario-group li {
	display: flex;
	gap: var(--space-xs);
	flex-wrap: wrap;
	font-size: var(--font-size-sm);
}

.violation-notes {
	color: var(--signal-warning-ink);
}

.night-currency {
	margin-top: var(--space-md);
	padding-top: var(--space-md);
	border-top: 1px solid var(--edge-subtle);
	color: var(--ink-muted);
}

.fields {
	display: grid;
	gap: var(--space-2xs);
	margin: 0;
}

.field-row {
	display: flex;
	justify-content: space-between;
	gap: var(--space-md);
	padding: var(--space-xs) 0;
	border-bottom: 1px solid var(--edge-subtle);
}

.field-row dt {
	color: var(--ink-muted);
}

.field-row dd {
	margin: 0;
	font-variant-numeric: tabular-nums;
	font-weight: var(--font-weight-semibold);
}

.notes {
	margin-top: var(--space-md);
}

.notes-body {
	color: var(--ink-body);
}

.effective {
	margin-top: var(--space-md);
	color: var(--ink-muted);
	font-size: var(--font-size-sm);
}

.deactivate-form {
	margin-top: var(--space-sm);
}

.empty-hint,
.field-hint,
.optional,
.unit {
	color: var(--ink-muted);
}

.empty-hint {
	margin-bottom: var(--space-md);
}

.fields-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	gap: var(--space-md);
}

.field-edit {
	display: flex;
	flex-direction: column;
	gap: var(--space-3xs);
}

.field-edit label {
	font-weight: var(--font-weight-semibold);
}

.field-edit input,
.notes-edit textarea {
	padding: var(--space-xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	font: inherit;
}

.field-edit.has-error input {
	border-color: var(--signal-danger-edge);
}

.field-hint,
.field-error {
	font-size: var(--font-size-xs);
	margin: 0;
}

.field-error,
.field-error-inline {
	color: var(--signal-danger-ink);
}

.notes-edit {
	display: flex;
	flex-direction: column;
	gap: var(--space-3xs);
	margin-top: var(--space-md);
}

.notes-edit textarea {
	resize: vertical;
}

.editor-actions {
	display: flex;
	gap: var(--space-xs);
	margin-top: var(--space-md);
}

.history-preview ul {
	list-style: none;
	margin: var(--space-sm) 0;
	padding: 0;
	display: grid;
	gap: var(--space-3xs);
}

.history-preview li {
	display: flex;
	justify-content: space-between;
	gap: var(--space-md);
	font-size: var(--font-size-sm);
	font-variant-numeric: tabular-nums;
}

.history-preview a {
	color: var(--action-link);
}
</style>
