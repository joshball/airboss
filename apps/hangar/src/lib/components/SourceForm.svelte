<script lang="ts">
import type { SourceFormInitial } from '@ab/bc-hangar';
import {
	type ReferenceSourceType,
	SECTIONAL_CADENCE_DAYS,
	SOURCE_KIND_BY_TYPE,
	SOURCE_KINDS,
	SOURCE_TYPE_LABELS,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import { untrack } from 'svelte';

/** Shared form body for /glossary/sources/new + /glossary/sources/[id]. */

let {
	initial,
	fieldErrors = {},
	formError = null,
	mode,
	rev = null,
}: {
	initial: SourceFormInitial;
	fieldErrors?: Record<string, string>;
	formError?: string | null;
	mode: 'create' | 'edit';
	rev?: number | null;
} = $props();

const FORMATS = ['xml', 'pdf', 'html', 'txt', 'json', 'csv', 'geotiff-zip'] as const;

// Local state tracks the user's current type pick so the non-textual panel
// toggles responsively before submit. The form intentionally captures the
// prop value at mount and lets the user edit; untrack tells Svelte that the
// initial-only read is deliberate.
let currentType = $state(untrack(() => initial.type));
const currentKind = $derived(SOURCE_KIND_BY_TYPE[currentType as ReferenceSourceType] ?? SOURCE_KINDS.TEXT);
const isBinaryVisual = $derived(currentKind === SOURCE_KINDS.BINARY_VISUAL);

function fieldError(key: string): string | undefined {
	return fieldErrors[key];
}
</script>

<div class="form-layout">
	{#if formError}
		<p class="form-error" role="alert">{formError}</p>
	{/if}

	{#if rev != null}
		<input type="hidden" name="rev" value={rev} />
	{/if}

	<div class="grid">
		<div class="field">
			<label for="src-id">ID</label>
			<input
				id="src-id"
				name="id"
				type="text"
				value={initial.id}
				readonly={mode === 'edit'}
				required
				autocomplete="off"
			/>
			<p class="hint">Lowercase slug, e.g. <code>cfr-14</code>, <code>aim-2026-01</code>.</p>
			{#if fieldError('id')}<p class="err">{fieldError('id')}</p>{/if}
		</div>

		<div class="field">
			<label for="src-type">Source type</label>
			<select id="src-type" name="type" required bind:value={currentType}>
				<option value="" selected={initial.type === ''}>-- pick one --</option>
				{#each SOURCE_TYPE_VALUES as value (value)}
					<option {value}>{SOURCE_TYPE_LABELS[value]}</option>
				{/each}
			</select>
			{#if fieldError('type')}<p class="err">{fieldError('type')}</p>{/if}
			<p class="hint">
				Kind: <code class="kind-chip">{currentKind}</code>. Binary-visual sources (sectional charts, plates)
				use the non-textual panel below instead of the extraction pipeline.
			</p>
		</div>
	</div>

	<div class="field">
		<label for="src-title">Title</label>
		<input id="src-title" name="title" type="text" value={initial.title} required />
		{#if fieldError('title')}<p class="err">{fieldError('title')}</p>{/if}
	</div>

	<div class="grid">
		<div class="field">
			<label for="src-version">Version</label>
			<input id="src-version" name="version" type="text" value={initial.version} required />
			<p class="hint">e.g. <code>revised-2026-01-01</code>.</p>
			{#if fieldError('version')}<p class="err">{fieldError('version')}</p>{/if}
		</div>

		<div class="field">
			<label for="src-format">Format</label>
			<select id="src-format" name="format" required>
				{#each FORMATS as value (value)}
					<option {value} selected={initial.format === value}>{value}</option>
				{/each}
			</select>
			{#if fieldError('format')}<p class="err">{fieldError('format')}</p>{/if}
		</div>
	</div>

	<div class="field">
		<label for="src-url">URL</label>
		<input id="src-url" name="url" type="url" value={initial.url} required />
		<p class="hint">Canonical URL so the user can cross-check the live source.</p>
		{#if fieldError('url')}<p class="err">{fieldError('url')}</p>{/if}
	</div>

	<div class="field">
		<label for="src-path">Path</label>
		<input id="src-path" name="path" type="text" value={initial.path} required />
		<p class="hint">Repo-relative path under <code>data/sources/</code>.</p>
		{#if fieldError('path')}<p class="err">{fieldError('path')}</p>{/if}
	</div>

	<div class="grid">
		<div class="field">
			<label for="src-checksum">Checksum</label>
			<input id="src-checksum" name="checksum" type="text" value={initial.checksum} required />
			<p class="hint">
				SHA-256 of the downloaded binary. Use <code>pending-download</code> until the fetch lands.
			</p>
			{#if fieldError('checksum')}<p class="err">{fieldError('checksum')}</p>{/if}
		</div>

		<div class="field">
			<label for="src-downloaded">Downloaded at</label>
			<input id="src-downloaded" name="downloadedAt" type="text" value={initial.downloadedAt} required />
			<p class="hint">ISO-8601 or <code>pending-download</code>.</p>
			{#if fieldError('downloadedAt')}<p class="err">{fieldError('downloadedAt')}</p>{/if}
		</div>

		<div class="field">
			<label for="src-size">Size bytes</label>
			<input
				id="src-size"
				name="sizeBytes"
				type="number"
				min="0"
				step="1"
				value={initial.sizeBytes}
				placeholder="optional"
			/>
			{#if fieldError('sizeBytes')}<p class="err">{fieldError('sizeBytes')}</p>{/if}
		</div>
	</div>

	{#if isBinaryVisual}
		<fieldset class="panel">
			<legend>Non-textual details</legend>
			<p class="panel-hint">
				Binary-visual sources require an upstream index URL to resolve the current edition, and a URL template
				with <code>{'{edition-date}'}</code> / <code>{'{region}'}</code> placeholders. The fetch handler
				substitutes these before downloading.
			</p>
			<div class="grid">
				<div class="field">
					<label for="src-region">Region</label>
					<input
						id="src-region"
						name="bv_region"
						type="text"
						value={initial.bvRegion ?? ''}
						placeholder="e.g. Denver"
						required
					/>
					{#if fieldError('bv_region')}<p class="err">{fieldError('bv_region')}</p>{/if}
				</div>
				<div class="field">
					<label for="src-cadence">Cadence (days)</label>
					<input
						id="src-cadence"
						name="bv_cadence_days"
						type="number"
						min="1"
						step="1"
						value={initial.bvCadenceDays ?? String(SECTIONAL_CADENCE_DAYS)}
					/>
					{#if fieldError('bv_cadence_days')}<p class="err">{fieldError('bv_cadence_days')}</p>{/if}
				</div>
			</div>
			<div class="field">
				<label for="src-index-url">Index URL</label>
				<input
					id="src-index-url"
					name="bv_index_url"
					type="url"
					value={initial.bvIndexUrl ?? ''}
					placeholder="https://aeronav.faa.gov/visual/"
					required
				/>
				<p class="hint">Upstream page the resolver scrapes for the current edition date.</p>
				{#if fieldError('bv_index_url')}<p class="err">{fieldError('bv_index_url')}</p>{/if}
			</div>
		</fieldset>
	{:else}
		<div class="field">
			<label for="src-locator">Locator shape (JSON)</label>
			<textarea id="src-locator" name="locatorShape" rows="4">{initial.locatorShapeJson}</textarea>
			<p class="hint">
				UI hint for citation locator forms. Example: <code>&#123; "title": "number", "part": "number" &#125;</code>.
			</p>
		</div>
	{/if}
</div>

<style>
	.form-layout {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.form-error {
		margin: 0;
		padding: var(--space-md);
		background: var(--signal-danger-wash);
		color: var(--signal-danger);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-md);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field input,
	.field select,
	.field textarea {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field textarea {
		resize: vertical;
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
	}

	.field input[readonly] {
		background: var(--surface-muted);
		color: var(--ink-muted);
	}

	.field input:focus-visible,
	.field select:focus-visible,
	.field textarea:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}

	.hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.hint code,
	.field code {
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-code-inline-size);
	}

	.err {
		margin: 0;
		color: var(--signal-danger);
		font-size: var(--type-ui-caption-size);
	}

	/* wp-hangar-non-textual: binary-visual panel */
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.panel legend {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		padding: 0 var(--space-xs);
	}

	.panel-hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.kind-chip {
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-code-inline-size);
	}
</style>
