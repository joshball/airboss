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
			/>
			<p class="hint">Lowercase slug, e.g. <code>cfr-14-91-155</code>. Immutable after create.</p>
			{#if fieldError('id')}<p class="err">{fieldError('id')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-display">Display name</label>
			<input id="ref-display" name="displayName" type="text" value={initial.displayName} required />
			{#if fieldError('displayName')}<p class="err">{fieldError('displayName')}</p>{/if}
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
		/>
		<p class="hint">Drives fuzzy match on <code>[[Text::]]</code> wiki-links and the glossary search.</p>
		{#if fieldError('aliases')}<p class="err">{fieldError('aliases')}</p>{/if}
	</div>

	<div class="field paraphrase">
		<label for="ref-paraphrase">Paraphrase</label>
		<div class="paraphrase-split">
			<textarea id="ref-paraphrase" name="paraphrase" rows="10" bind:value={paraphrase} required></textarea>
			<aside class="preview" aria-label="Live markdown preview">
				<div class="preview-heading">Preview</div>
				<MarkdownPreview source={paraphrase} />
			</aside>
		</div>
		<p class="hint">
			Plain-English explanation. Markdown supported (paragraphs, headings, lists, inline code, emphasis, links).
		</p>
		{#if fieldError('paraphrase')}<p class="err">{fieldError('paraphrase')}</p>{/if}
	</div>

	<fieldset class="tags">
		<legend>Tags (5-axis taxonomy)</legend>

		<div class="grid">
			<div class="field">
				<label for="ref-source-type">Source type</label>
				<select id="ref-source-type" name="sourceType" required>
					<option value="" selected={initial.sourceType === ''}>-- pick one --</option>
					{#each SOURCE_TYPE_VALUES as value (value)}
						<option {value} selected={initial.sourceType === value}>{SOURCE_TYPE_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.sourceType')}<p class="err">{fieldError('tags.sourceType')}</p>{/if}
			</div>

			<div class="field">
				<label for="ref-flight-rules">Flight rules</label>
				<select id="ref-flight-rules" name="flightRules" required>
					<option value="" selected={initial.flightRules === ''}>-- pick one --</option>
					{#each FLIGHT_RULES_VALUES as value (value)}
						<option {value} selected={initial.flightRules === value}>{FLIGHT_RULES_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.flightRules')}<p class="err">{fieldError('tags.flightRules')}</p>{/if}
			</div>

			<div class="field">
				<label for="ref-knowledge-kind">Knowledge kind</label>
				<select id="ref-knowledge-kind" name="knowledgeKind" required>
					<option value="" selected={initial.knowledgeKind === ''}>-- pick one --</option>
					{#each KNOWLEDGE_KIND_VALUES as value (value)}
						<option {value} selected={initial.knowledgeKind === value}>{KNOWLEDGE_KIND_LABELS[value]}</option>
					{/each}
				</select>
				{#if fieldError('tags.knowledgeKind')}<p class="err">{fieldError('tags.knowledgeKind')}</p>{/if}
			</div>
		</div>

		<div class="field">
			<span class="label-like">Aviation topic (1-4)</span>
			<div class="chipset" role="group" aria-label="Aviation topic">
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
			{#if fieldError('tags.aviationTopic')}<p class="err">{fieldError('tags.aviationTopic')}</p>{/if}
		</div>

		<div class="field">
			<span class="label-like">Phase of flight (0-3)</span>
			<div class="chipset" role="group" aria-label="Phase of flight">
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
			{#if fieldError('tags.phaseOfFlight')}<p class="err">{fieldError('tags.phaseOfFlight')}</p>{/if}
		</div>

		<div class="field">
			<span class="label-like">Cert applicability</span>
			<div class="chipset" role="group" aria-label="Cert applicability">
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
			{#if fieldError('tags.certApplicability')}<p class="err">{fieldError('tags.certApplicability')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-keywords">Keywords</label>
			<input
				id="ref-keywords"
				name="keywords"
				type="text"
				value={initial.keywordsText}
				placeholder="comma-separated freeform synonyms"
			/>
			{#if fieldError('tags.keywords')}<p class="err">{fieldError('tags.keywords')}</p>{/if}
		</div>
	</fieldset>

	<div class="field">
		<label for="ref-citations">Source citations (JSON array)</label>
		<textarea id="ref-citations" name="citations" rows="4">{initial.citationsJson}</textarea>
		<p class="hint">
			Each entry: <code>&#123; "sourceId": "...", "locator": &#123; ... &#125; &#125;</code>. Use
			<code>[]</code> when the reference has no authoritative citation.
		</p>
		{#if fieldError('sources')}<p class="err">{fieldError('sources')}</p>{/if}
	</div>

	<div class="field">
		<label for="ref-related">Related reference ids</label>
		<input
			id="ref-related"
			name="related"
			type="text"
			value={initial.relatedText}
			placeholder="comma-separated ids (must be symmetric)"
		/>
		{#if fieldError('related')}<p class="err">{fieldError('related')}</p>{/if}
	</div>

	<div class="grid">
		<div class="field">
			<label for="ref-author">Author</label>
			<input id="ref-author" name="author" type="text" value={initial.author} placeholder="optional" />
			{#if fieldError('author')}<p class="err">{fieldError('author')}</p>{/if}
		</div>

		<div class="field">
			<label for="ref-reviewed">Reviewed at (YYYY-MM-DD)</label>
			<input id="ref-reviewed" name="reviewedAt" type="text" value={initial.reviewedAt} placeholder="optional" />
			{#if fieldError('reviewedAt')}<p class="err">{fieldError('reviewedAt')}</p>{/if}
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
