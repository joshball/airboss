<script lang="ts">
/**
 * `<NoteContextPicker>` -- collapsible context editor backed by 6 native
 * `<select>` dropdowns (reference / section / knowledge node / course /
 * goal / syllabus node). Pure component: emits `onchange(context)` with
 * a fully-spread context object every time any axis changes. The parent
 * decides what to do with the value (form serialization, BC call).
 *
 * Each axis renders a "No <kind> yet" placeholder when the options
 * array is absent or empty -- the picker stays usable in low-data
 * scenarios without throwing.
 */

import { EMPTY_NOTE_CONTEXT, type NoteContext, type NoteContextOptions } from './note-context-types';

let {
	context = EMPTY_NOTE_CONTEXT,
	options,
	onchange,
	disabled = false,
}: {
	context?: NoteContext;
	options: NoteContextOptions;
	onchange: (context: NoteContext) => void;
	disabled?: boolean;
} = $props();

function patch<K extends keyof NoteContext>(key: K, value: NoteContext[K]): void {
	onchange({ ...context, [key]: value });
}

function nullable(v: string): string | null {
	return v === '' ? null : v;
}
</script>

<fieldset class="picker" data-testid="note-context-picker" {disabled}>
	<legend class="legend">Context</legend>
	<div class="grid">
		<label class="field">
			<span class="label">Reference</span>
			<select
				name="referenceId"
				value={context.referenceId ?? ''}
				onchange={(e) => patch('referenceId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-reference"
			>
				<option value="">{(options.references ?? []).length === 0 ? 'No references yet' : 'No reference'}</option>
				{#each options.references ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Section</span>
			<select
				name="referenceSectionId"
				value={context.referenceSectionId ?? ''}
				onchange={(e) => patch('referenceSectionId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-section"
			>
				<option value="">{(options.sections ?? []).length === 0 ? 'No sections yet' : 'No section'}</option>
				{#each options.sections ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Knowledge node</span>
			<select
				name="knowledgeNodeId"
				value={context.knowledgeNodeId ?? ''}
				onchange={(e) => patch('knowledgeNodeId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-knowledge"
			>
				<option value=""
					>{(options.knowledgeNodes ?? []).length === 0 ? 'No knowledge nodes yet' : 'No knowledge node'}</option
				>
				{#each options.knowledgeNodes ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Course</span>
			<select
				name="courseId"
				value={context.courseId ?? ''}
				onchange={(e) => patch('courseId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-course"
			>
				<option value="">{(options.courses ?? []).length === 0 ? 'No courses yet' : 'No course'}</option>
				{#each options.courses ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Goal</span>
			<select
				name="goalId"
				value={context.goalId ?? ''}
				onchange={(e) => patch('goalId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-goal"
			>
				<option value="">{(options.goals ?? []).length === 0 ? 'No goals yet' : 'No goal'}</option>
				{#each options.goals ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="label">Syllabus node</span>
			<select
				name="syllabusNodeId"
				value={context.syllabusNodeId ?? ''}
				onchange={(e) => patch('syllabusNodeId', nullable((e.currentTarget as HTMLSelectElement).value))}
				data-testid="note-context-select-syllabus"
			>
				<option value=""
					>{(options.syllabusNodes ?? []).length === 0 ? 'No syllabus nodes yet' : 'No syllabus node'}</option
				>
				{#each options.syllabusNodes ?? [] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>
	</div>
</fieldset>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}
	.legend {
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-strong);
		padding: 0 var(--space-2xs);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-sm);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.label {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}
	select {
		font: inherit;
		padding: var(--space-2xs) var(--space-xs);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}
	select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}
</style>
