<script lang="ts">
import type { ReferenceFormInitial } from '@ab/bc-hangar';
import {
	AVIATION_TOPIC_LABELS,
	AVIATION_TOPIC_VALUES,
	CERT_APPLICABILITY_LABELS,
	CERT_APPLICABILITY_VALUES,
	FLIGHT_RULES_LABELS,
	FLIGHT_RULES_VALUES,
	KNOWLEDGE_KIND_LABELS,
	KNOWLEDGE_KIND_VALUES,
	REFERENCE_PHASE_OF_FLIGHT_LABELS,
	REFERENCE_PHASE_OF_FLIGHT_VALUES,
	SOURCE_TYPE_LABELS,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import MarkdownPreview from '$lib/components/MarkdownPreview.svelte';

/**
 * Shared form body for create (/glossary/new) + edit (/glossary/[id]).
 * Emits real <input>s so progressive enhancement works without JS; the
 * script only adds live markdown preview + fieldError surfacing.
 */

let {
	initial,
	fieldErrors = {},
	formError = null,
	mode,
	rev = null,
}: {
	initial: ReferenceFormInitial;
	fieldErrors?: Record<string, string>;
	formError?: string | null;
	mode: 'create' | 'edit';
	rev?: number | null;
} = $props();

// svelte-ignore state_referenced_locally
let paraphrase = $state(initial.paraphrase);

function fieldError(key: string): string | undefined {
	return fieldErrors[key];
}

/** Stable id for the error <p> tied to a field via `aria-describedby`. */
function errId(inputId: string): string {
	return `${inputId}-err`;
}

function isChecked(values: readonly string[], candidate: string): boolean {
	return values.includes(candidate);
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
			<label for="ref-id">ID</label>
			<input
				id="ref-id"
				name="id"
				type="text"
				value={initial.id}
				readonly={mode === 'edit'}
				required
				autocomplete="off"
				spellcheck="false"
				aria-invalid={fieldError('id') ? 'true' : undefined}
				aria-describedby={fieldError('id') ? errId('ref-id') : undefined}
			/>
			<p class="hint">Lowercase slug, e.g. <code>cfr-14-91-155</code>. Immutable after create.</p>
			{#if fieldError('id')}<p class="err" id={errId('ref-id')}>{fieldError('id')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-display">Display name</label>
			<input
				id="ref-display"
				name="displayName"
				type="text"
				value={initial.displayName}
				required
				aria-invalid={fieldError('displayName') ? 'true' : undefined}
				aria-describedby={fieldError('displayName') ? errId('ref-display') : undefined}
			/>
			{#if fieldError('displayName')}<p class="err" id={errId('ref-display')}>{fieldError('displayName')}</p>{/if}
		</div>
	</div>

	<div class="field">
		<label for="ref-aliases">Aliases</label>
		<input
			id="ref-aliases"
			name="aliases"
			type="text"
			value={initial.aliasesText}
			placeholder="comma-separated alternate labels"
			aria-invalid={fieldError('aliases') ? 'true' : undefined}
			aria-describedby={fieldError('aliases') ? errId('ref-aliases') : undefined}
		/>
		<p class="hint">Drives fuzzy match on <code>[[Text::]]</code> wiki-links and the glossary search.</p>
		{#if fieldError('aliases')}<p class="err" id={errId('ref-aliases')}>{fieldError('aliases')}</p>{/if}
	</div>

	<div class="field paraphrase">
		<label for="ref-paraphrase">Paraphrase</label>
		<div class="paraphrase-split">
			<textarea
				id="ref-paraphrase"
				name="paraphrase"
				rows="10"
				bind:value={paraphrase}
				required
				aria-invalid={fieldError('paraphrase') ? 'true' : undefined}
				aria-describedby={fieldError('paraphrase') ? errId('ref-paraphrase') : undefined}
			></textarea>
			<aside class="preview" aria-label="Live markdown preview">
				<div class="preview-heading">Preview</div>
				<MarkdownPreview source={paraphrase} />
			</aside>
		</div>
		<p class="hint">
			Plain-English explanation. Markdown supported (paragraphs, headings, lists, inline code, emphasis, links).
		</p>
		{#if fieldError('paraphrase')}<p class="err" id={errId('ref-paraphrase')}>{fieldError('paraphrase')}</p>{/if}
	</div>

	<fieldset class="tags">
		<legend>Tags (5-axis taxonomy)</legend>

		<div class="grid">
			<div class="field">
				<label for="ref-source-type">Source type</label>
				<select
					id="ref-source-type"
					name="sourceType"
					required
					aria-invalid={fieldError('tags.sourceType') ? 'true' : undefined}
					aria-describedby={fieldError('tags.sourceType') ? errId('ref-source-type') : undefined}
				>
					<option value="" selected={initial.sourceType === ''}>-- pick one --</option>
					{#each SOURCE_TYPE_VALUES as value (value)}
						<option {value} selected={initial.sourceType === value}>{SOURCE_TYPE_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.sourceType')}<p class="err" id={errId('ref-source-type')}>{fieldError('tags.sourceType')}</p>{/if}
			</div>

			<div class="field">
				<label for="ref-flight-rules">Flight rules</label>
				<select
					id="ref-flight-rules"
					name="flightRules"
					required
					aria-invalid={fieldError('tags.flightRules') ? 'true' : undefined}
					aria-describedby={fieldError('tags.flightRules') ? errId('ref-flight-rules') : undefined}
				>
					<option value="" selected={initial.flightRules === ''}>-- pick one --</option>
					{#each FLIGHT_RULES_VALUES as value (value)}
						<option {value} selected={initial.flightRules === value}>{FLIGHT_RULES_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.flightRules')}<p class="err" id={errId('ref-flight-rules')}>{fieldError('tags.flightRules')}</p>{/if}
			</div>

			<div class="field">
				<label for="ref-knowledge-kind">Knowledge kind</label>
				<select
					id="ref-knowledge-kind"
					name="knowledgeKind"
					required
					aria-invalid={fieldError('tags.knowledgeKind') ? 'true' : undefined}
					aria-describedby={fieldError('tags.knowledgeKind') ? errId('ref-knowledge-kind') : undefined}
				>
					<option value="" selected={initial.knowledgeKind === ''}>-- pick one --</option>
					{#each KNOWLEDGE_KIND_VALUES as value (value)}
						<option {value} selected={initial.knowledgeKind === value}>{KNOWLEDGE_KIND_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.knowledgeKind')}<p class="err" id={errId('ref-knowledge-kind')}>{fieldError('tags.knowledgeKind')}</p>{/if}
			</div>
		</div>

		<div class="field">
			<span class="label-like" id="ref-aviation-topic-label">Aviation topic (1-4)</span>
			<div
				class="chipset"
				role="group"
				aria-labelledby="ref-aviation-topic-label"
				aria-describedby={fieldError('tags.aviationTopic') ? errId('ref-aviation-topic') : undefined}
			>
				{#each AVIATION_TOPIC_VALUES as value (value)}
					<label class="chip">
						<input
							type="checkbox"
							name="aviationTopic"
							{value}
							checked={isChecked(initial.aviationTopic, value)}
						/>
						<span>{AVIATION_TOPIC_LABELS[value]}</span>
					</label>
				{/each}
			</div>
			{#if fieldError('tags.aviationTopic')}<p class="err" id={errId('ref-aviation-topic')}>{fieldError('tags.aviationTopic')}</p>{/if}
		</div>

		<div class="field">
			<span class="label-like" id="ref-phase-of-flight-label">Phase of flight (0-3)</span>
			<div
				class="chipset"
				role="group"
				aria-labelledby="ref-phase-of-flight-label"
				aria-describedby={fieldError('tags.phaseOfFlight') ? errId('ref-phase-of-flight') : undefined}
			>
				{#each REFERENCE_PHASE_OF_FLIGHT_VALUES as value (value)}
					<label class="chip">
						<input
							type="checkbox"
							name="phaseOfFlight"
							{value}
							checked={isChecked(initial.phaseOfFlight, value)}
						/>
						<span>{REFERENCE_PHASE_OF_FLIGHT_LABELS[value]}</span>
					</label>
				{/each}
			</div>
			{#if fieldError('tags.phaseOfFlight')}<p class="err" id={errId('ref-phase-of-flight')}>{fieldError('tags.phaseOfFlight')}</p>{/if}
		</div>

		<div class="field">
			<span class="label-like" id="ref-cert-applicability-label">Cert applicability</span>
			<div
				class="chipset"
				role="group"
				aria-labelledby="ref-cert-applicability-label"
				aria-describedby={fieldError('tags.certApplicability') ? errId('ref-cert-applicability') : undefined}
			>
				{#each CERT_APPLICABILITY_VALUES as value (value)}
					<label class="chip">
						<input
							type="checkbox"
							name="certApplicability"
							{value}
							checked={isChecked(initial.certApplicability, value)}
						/>
						<span>{CERT_APPLICABILITY_LABELS[value]}</span>
					</label>
				{/each}
			</div>
			{#if fieldError('tags.certApplicability')}<p class="err" id={errId('ref-cert-applicability')}>{fieldError('tags.certApplicability')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-keywords">Keywords</label>
			<input
				id="ref-keywords"
				name="keywords"
				type="text"
				value={initial.keywordsText}
				placeholder="comma-separated freeform synonyms"
				aria-invalid={fieldError('tags.keywords') ? 'true' : undefined}
				aria-describedby={fieldError('tags.keywords') ? errId('ref-keywords') : undefined}
			/>
			{#if fieldError('tags.keywords')}<p class="err" id={errId('ref-keywords')}>{fieldError('tags.keywords')}</p>{/if}
		</div>
	</fieldset>

	<div class="field">
		<label for="ref-citations">Source citations (JSON array)</label>
		<textarea
			id="ref-citations"
			name="citations"
			rows="4"
			aria-invalid={fieldError('sources') ? 'true' : undefined}
			aria-describedby={fieldError('sources') ? errId('ref-citations') : undefined}
		>{initial.citationsJson}</textarea>
		<p class="hint">
			Each entry: <code>&#123; "sourceId": "...", "locator": &#123; ... &#125; &#125;</code>. Use
			<code>[]</code> when the reference has no authoritative citation.
		</p>
		{#if fieldError('sources')}<p class="err" id={errId('ref-citations')}>{fieldError('sources')}</p>{/if}
	</div>

	<div class="field">
		<label for="ref-related">Related reference ids</label>
		<input
			id="ref-related"
			name="related"
			type="text"
			value={initial.relatedText}
			placeholder="comma-separated ids (must be symmetric)"
			aria-invalid={fieldError('related') ? 'true' : undefined}
			aria-describedby={fieldError('related') ? errId('ref-related') : undefined}
		/>
		{#if fieldError('related')}<p class="err" id={errId('ref-related')}>{fieldError('related')}</p>{/if}
	</div>

	<div class="grid">
		<div class="field">
			<label for="ref-author">Author</label>
			<input
				id="ref-author"
				name="author"
				type="text"
				value={initial.author}
				placeholder="optional"
				aria-invalid={fieldError('author') ? 'true' : undefined}
				aria-describedby={fieldError('author') ? errId('ref-author') : undefined}
			/>
			{#if fieldError('author')}<p class="err" id={errId('ref-author')}>{fieldError('author')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-reviewed">Reviewed at (YYYY-MM-DD)</label>
			<input
				id="ref-reviewed"
				name="reviewedAt"
				type="text"
				value={initial.reviewedAt}
				placeholder="optional"
				aria-invalid={fieldError('reviewedAt') ? 'true' : undefined}
				aria-describedby={fieldError('reviewedAt') ? errId('ref-reviewed') : undefined}
			/>
			{#if fieldError('reviewedAt')}<p class="err" id={errId('ref-reviewed')}>{fieldError('reviewedAt')}</p>{/if}
		</div>
	</div>
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

	.field label,
	.label-like {
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
		line-height: var(--line-height-normal);
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

	.paraphrase-split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	@media (max-width: 700px) {
		.paraphrase-split {
			grid-template-columns: 1fr;
		}
	}

	.paraphrase-split textarea {
		min-height: 16rem;
	}

	.preview {
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		overflow-y: auto;
		max-height: 28rem;
	}

	.preview-heading {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		margin-bottom: var(--space-xs);
		font-weight: var(--font-weight-semibold);
	}

	.tags {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		background: var(--surface-raised);
	}

	.tags legend {
		padding: 0 var(--space-xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		font-weight: var(--font-weight-semibold);
	}

	.chipset {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		color: var(--ink-body);
		font-size: var(--type-ui-caption-size);
		cursor: pointer;
	}

	.chip:hover {
		background: var(--edge-default);
	}

	.chip input {
		accent-color: var(--action-default);
	}

	.chip:has(input:checked) {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default-hover);
	}
</style>
