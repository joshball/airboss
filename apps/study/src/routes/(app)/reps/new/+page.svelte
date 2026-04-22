<script lang="ts">
import type { ScenarioOption } from '@ab/bc-study';
import {
	DIFFICULTIES,
	DIFFICULTY_LABELS,
	DIFFICULTY_VALUES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	PHASE_OF_FLIGHT_LABELS,
	PHASE_OF_FLIGHT_VALUES,
	ROUTES,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_OPTIONS_MIN,
} from '@ab/constants';
import { enhance } from '$app/forms';
import type { ActionData } from './$types';

let { form }: { form: ActionData } = $props();

type OptionDraft = ScenarioOption;

/** Seed a new blank option row. */
function blankOption(index: number): OptionDraft {
	return {
		id: `opt${index}`,
		text: '',
		isCorrect: index === 0,
		outcome: '',
		whyNot: '',
	};
}

// Preserve any user input that failed validation so re-submission keeps
// the form state. Svelte 5 warns about dereferencing reactive props at
// state-initializer time, so we stage these as local `untrack`-style seeds
// -- the initial submit is the authoritative source; subsequent reactive
// changes are driven by user typing, not `form` replacing itself.
// svelte-ignore state_referenced_locally -- seeding initial state from form; treat as independent thereafter
const seed = form?.values;
let loading = $state(false);

let title = $state<string>((seed?.title as string | undefined) ?? '');
let situation = $state<string>((seed?.situation as string | undefined) ?? '');
let teachingPoint = $state<string>((seed?.teachingPoint as string | undefined) ?? '');
let domain = $state<string>((seed?.domain as string | undefined) ?? '');
let difficulty = $state<string>((seed?.difficulty as string | undefined) ?? DIFFICULTIES.INTERMEDIATE);
let phaseOfFlight = $state<string>((seed?.phaseOfFlight as string | null | undefined) ?? '');
let regReferences = $state<string>(
	Array.isArray(seed?.regReferences) ? (seed.regReferences as string[]).join(', ') : '',
);

let options = $state<OptionDraft[]>(
	Array.isArray(seed?.options) && (seed.options as OptionDraft[]).length > 0
		? (seed.options as OptionDraft[]).map((o, i) => ({ ...o, id: o.id || `opt${i}` }))
		: [blankOption(0), blankOption(1)],
);

const fieldErrors = $derived<Record<string, string>>(form?.fieldErrors ?? {});

const canAdd = $derived(options.length < SCENARIO_OPTIONS_MAX);
const canRemove = $derived(options.length > SCENARIO_OPTIONS_MIN);
const correctIndex = $derived(options.findIndex((o) => o.isCorrect));

function addOption() {
	options = [...options, blankOption(options.length)];
}

function removeOption(index: number) {
	if (!canRemove) return;
	const wasCorrect = options[index]?.isCorrect;
	options = options.filter((_, i) => i !== index);
	// Ensure a correct option still exists after removal -- the BC will
	// reject the submit otherwise and the UX is to keep the form valid.
	if (wasCorrect && options.length > 0 && !options.some((o) => o.isCorrect)) {
		options[0].isCorrect = true;
	}
}

function setCorrect(index: number) {
	options = options.map((o, i) => ({ ...o, isCorrect: i === index }));
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? slug;
}

function phaseLabel(slug: string): string {
	return (PHASE_OF_FLIGHT_LABELS as Record<string, string>)[slug] ?? slug;
}

function difficultyLabel(slug: string): string {
	return (DIFFICULTY_LABELS as Record<string, string>)[slug] ?? slug;
}
</script>

<svelte:head>
	<title>New scenario -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>New scenario</h1>
			<p class="sub">Write a micro-decision: 2-3 sentences of situation, 2-5 options, exactly one correct.</p>
		</div>
		<a class="back" href={ROUTES.REPS_BROWSE}>Browse</a>
	</header>

	{#if fieldErrors._}
		<div class="error" role="alert">{fieldErrors._}</div>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
	>
		<label class="field">
			<span class="label">Title</span>
			<input
				type="text"
				name="title"
				required
				maxlength="200"
				bind:value={title}
				placeholder="Engine rough at 800 AGL"
				disabled={loading}
				aria-invalid={fieldErrors.title ? 'true' : undefined}
			/>
			{#if fieldErrors.title}<span class="err">{fieldErrors.title}</span>{/if}
		</label>

		<label class="field">
			<span class="label">Situation <span class="hint">(2-3 sentences of context)</span></span>
			<textarea
				name="situation"
				required
				rows="4"
				maxlength="10000"
				bind:value={situation}
				placeholder="You're climbing through 800 AGL after takeoff from a 5,000-ft runway..."
				disabled={loading}
				aria-invalid={fieldErrors.situation ? 'true' : undefined}
			></textarea>
			{#if fieldErrors.situation}<span class="err">{fieldErrors.situation}</span>{/if}
		</label>

		<fieldset class="options">
			<legend>
				<span class="label">Options</span>
				<span class="hint">({SCENARIO_OPTIONS_MIN}-{SCENARIO_OPTIONS_MAX}, exactly one correct)</span>
			</legend>
			{#if fieldErrors.options}
				<p class="err" role="alert">{fieldErrors.options}</p>
			{/if}

			<input type="hidden" name="options[correct]" value={correctIndex} />

			{#each options as opt, i (i)}
				<article class="option" class:correct={opt.isCorrect}>
					<div class="option-head">
						<label class="correct-radio">
							<input
								type="radio"
								name="correctRadio"
								checked={opt.isCorrect}
								onchange={() => setCorrect(i)}
								disabled={loading}
							/>
							<span>Correct</span>
						</label>
						<span class="option-num">Option {i + 1}</span>
						<button
							type="button"
							class="btn ghost remove"
							onclick={() => removeOption(i)}
							disabled={loading || !canRemove}
							aria-label={`Remove option ${i + 1}`}
						>
							Remove
						</button>
					</div>

					<input type="hidden" name={`options[${i}][id]`} value={opt.id} />

					<label class="field">
						<span class="sub-label">Text</span>
						<input
							type="text"
							name={`options[${i}][text]`}
							required
							maxlength="2000"
							bind:value={opt.text}
							placeholder="Land straight ahead in the field"
							disabled={loading}
							aria-invalid={fieldErrors[`options.${i}.text`] ? 'true' : undefined}
						/>
						{#if fieldErrors[`options.${i}.text`]}<span class="err">{fieldErrors[`options.${i}.text`]}</span>{/if}
					</label>

					<label class="field">
						<span class="sub-label">Outcome <span class="hint">(what happens if they pick this)</span></span>
						<textarea
							name={`options[${i}][outcome]`}
							required
							rows="2"
							maxlength="2000"
							bind:value={opt.outcome}
							placeholder="Controlled off-airport landing; aircraft damaged but occupants safe."
							disabled={loading}
							aria-invalid={fieldErrors[`options.${i}.outcome`] ? 'true' : undefined}
						></textarea>
						{#if fieldErrors[`options.${i}.outcome`]}
							<span class="err">{fieldErrors[`options.${i}.outcome`]}</span>
						{/if}
					</label>

					{#if !opt.isCorrect}
						<label class="field">
							<span class="sub-label">Why not <span class="hint">(why this is the wrong call)</span></span>
							<textarea
								name={`options[${i}][whyNot]`}
								rows="2"
								maxlength="2000"
								bind:value={opt.whyNot}
								placeholder="The impossible turn has killed pilots at exactly this altitude..."
								disabled={loading}
								aria-invalid={fieldErrors[`options.${i}.whyNot`] ? 'true' : undefined}
							></textarea>
							{#if fieldErrors[`options.${i}.whyNot`]}
								<span class="err">{fieldErrors[`options.${i}.whyNot`]}</span>
							{/if}
						</label>
					{:else}
						<!-- The correct option may optionally include a whyNot note.
						     Hidden to keep the form focused; still submitted as blank. -->
						<input type="hidden" name={`options[${i}][whyNot]`} value={opt.whyNot} />
					{/if}
				</article>
			{/each}

			<div class="options-actions">
				<button type="button" class="btn secondary" onclick={addOption} disabled={loading || !canAdd}>
					+ Add option
				</button>
				<span class="counter">{options.length} / {SCENARIO_OPTIONS_MAX}</span>
			</div>
		</fieldset>

		<label class="field">
			<span class="label">Teaching point</span>
			<textarea
				name="teachingPoint"
				required
				rows="4"
				maxlength="5000"
				bind:value={teachingPoint}
				placeholder="The engine-out decision is pre-brief work, not in-the-moment work. Know your turnback altitude BEFORE you take off."
				disabled={loading}
				aria-invalid={fieldErrors.teachingPoint ? 'true' : undefined}
			></textarea>
			{#if fieldErrors.teachingPoint}<span class="err">{fieldErrors.teachingPoint}</span>{/if}
		</label>

		<div class="row three">
			<label class="field">
				<span class="label">Domain</span>
				<select name="domain" required bind:value={domain} disabled={loading}>
					<option value="" disabled>Pick a domain</option>
					{#each DOMAIN_VALUES as d (d)}
						<option value={d}>{domainLabel(d)}</option>
					{/each}
				</select>
				{#if fieldErrors.domain}<span class="err">{fieldErrors.domain}</span>{/if}
			</label>

			<label class="field">
				<span class="label">Difficulty</span>
				<select name="difficulty" required bind:value={difficulty} disabled={loading}>
					{#each DIFFICULTY_VALUES as d (d)}
						<option value={d}>{difficultyLabel(d)}</option>
					{/each}
				</select>
				{#if fieldErrors.difficulty}<span class="err">{fieldErrors.difficulty}</span>{/if}
			</label>

			<label class="field">
				<span class="label">Phase of flight <span class="hint">(optional)</span></span>
				<select name="phaseOfFlight" bind:value={phaseOfFlight} disabled={loading}>
					<option value="">Any</option>
					{#each PHASE_OF_FLIGHT_VALUES as p (p)}
						<option value={p}>{phaseLabel(p)}</option>
					{/each}
				</select>
				{#if fieldErrors.phaseOfFlight}<span class="err">{fieldErrors.phaseOfFlight}</span>{/if}
			</label>
		</div>

		<label class="field">
			<span class="label">Regulation references <span class="hint">(comma-separated, optional)</span></span>
			<input
				type="text"
				name="regReferences"
				bind:value={regReferences}
				placeholder="14 CFR 91.3, AC 61-83K A.11"
				disabled={loading}
			/>
			{#if fieldErrors.regReferences}<span class="err">{fieldErrors.regReferences}</span>{/if}
		</label>

		<div class="actions">
			<a class="btn ghost" href={ROUTES.REPS}>Cancel</a>
			<button type="submit" class="btn primary" disabled={loading}>
				{loading ? 'Saving...' : 'Save scenario'}
			</button>
		</div>
	</form>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.back {
		color: var(--ab-color-fg-muted);
		text-decoration: none;
		font-size: var(--ab-font-size-sm);
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-sm);
	}

	.back:hover {
		background: var(--ab-color-surface-sunken);
	}

	.error {
		background: var(--ab-color-danger-subtle);
		border: 1px solid var(--ab-color-danger-subtle-border);
		color: var(--ab-color-danger-active);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.label {
		font-size: var(--ab-font-size-sm);
		font-weight: 500;
		color: var(--ab-color-fg-strong);
	}

	.sub-label {
		font-size: var(--ab-font-size-sm);
		font-weight: 500;
		color: var(--ab-color-fg-muted);
	}

	.hint {
		font-weight: 400;
		color: var(--ab-color-fg-faint);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		background: white;
		color: var(--ab-color-fg);
		transition: border-color 120ms, box-shadow 120ms;
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--ab-color-primary);
		box-shadow: var(--ab-shadow-focus-ring);
	}

	:disabled {
		background: var(--ab-color-surface-sunken);
		cursor: not-allowed;
	}

	.err {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-danger-hover);
	}

	.row.three {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 1rem;
	}

	.options {
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.options legend {
		padding: 0 0.5rem;
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}

	.option {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--ab-color-border);
		background: var(--ab-color-surface-muted);
		border-radius: var(--ab-radius-md);
	}

	.option.correct {
		border-color: var(--ab-color-success-subtle-border);
		background: var(--ab-color-success-subtle);
	}

	.option-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.correct-radio {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-strong);
		font-weight: 500;
	}

	.correct-radio input[type='radio'] {
		margin: 0;
	}

	.option.correct .correct-radio {
		color: var(--ab-color-success-hover);
	}

	.option-num {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-faint);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.remove {
		font-size: var(--ab-font-size-sm);
		padding: 0.25rem 0.625rem;
	}

	.options-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.25rem;
	}

	.counter {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-sm);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--ab-color-border);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover:not(:disabled) {
		background: var(--ab-color-surface-sunken);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.row.three {
			grid-template-columns: 1fr;
		}
	}
</style>
