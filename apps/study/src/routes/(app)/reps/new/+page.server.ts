import { requireAuth } from '@ab/auth';
import { createScenario, newScenarioSchema, type ScenarioOption, type ScenarioRow } from '@ab/bc-study';
import { type DIFFICULTY_VALUES, type DOMAIN_VALUES, type PHASE_OF_FLIGHT_VALUES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const log = createLogger('study:reps-new');

/**
 * Parse the dynamic option form data. Options are submitted as parallel
 * arrays keyed by index: options[0][text], options[0][isCorrect], etc.
 * Empty slots are dropped so a user that removed an option in the middle
 * of the form doesn't ship a phantom blank row.
 */
function parseOptions(form: FormData): ScenarioOption[] {
	const indexSet = new Set<number>();
	for (const key of form.keys()) {
		const match = key.match(/^options\[(\d+)\]/);
		if (match) indexSet.add(Number(match[1]));
	}
	const indexes = [...indexSet].sort((a, b) => a - b);
	const result: ScenarioOption[] = [];
	for (const i of indexes) {
		const id = String(form.get(`options[${i}][id]`) ?? '').trim();
		const text = String(form.get(`options[${i}][text]`) ?? '').trim();
		const outcome = String(form.get(`options[${i}][outcome]`) ?? '').trim();
		const whyNot = String(form.get(`options[${i}][whyNot]`) ?? '').trim();
		const correctIndex = String(form.get('options[correct]') ?? '');
		const isCorrect = correctIndex !== '' && Number(correctIndex) === i;
		// Drop the row entirely when the user left the option blank -- they
		// clicked Remove but the row stayed in the DOM, or they added a blank
		// row and never filled it in.
		if (text.length === 0 && outcome.length === 0 && whyNot.length === 0) continue;
		result.push({
			id: id || `opt${i}`,
			text,
			isCorrect,
			outcome,
			whyNot,
		});
	}
	return result;
}

function parseRegRefs(raw: string): string[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;

		const form = await request.formData();
		const rawTitle = String(form.get('title') ?? '');
		const rawSituation = String(form.get('situation') ?? '');
		const rawTeachingPoint = String(form.get('teachingPoint') ?? '');
		const rawDomain = String(form.get('domain') ?? '');
		const rawDifficulty = String(form.get('difficulty') ?? '');
		const rawPhase = String(form.get('phaseOfFlight') ?? '');
		const rawRegRefs = String(form.get('regReferences') ?? '');

		const options = parseOptions(form);
		const regReferences = parseRegRefs(rawRegRefs);

		const input = {
			title: rawTitle,
			situation: rawSituation,
			options,
			teachingPoint: rawTeachingPoint,
			domain: rawDomain,
			difficulty: rawDifficulty,
			phaseOfFlight: rawPhase || null,
			regReferences,
		};

		const parsed = newScenarioSchema.safeParse(input);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				// Flatten zod paths into a dot-path key so the form template can
				// target specific option rows (`options.0.text`) as well as
				// top-level fields.
				const key = issue.path.length === 0 ? '_' : issue.path.join('.');
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			return fail(400, { values: input, fieldErrors });
		}

		let created: ScenarioRow;
		try {
			created = await createScenario({
				userId: user.id,
				title: parsed.data.title,
				situation: parsed.data.situation,
				options: parsed.data.options as ScenarioOption[],
				teachingPoint: parsed.data.teachingPoint,
				domain: parsed.data.domain as (typeof DOMAIN_VALUES)[number],
				difficulty: parsed.data.difficulty as (typeof DIFFICULTY_VALUES)[number],
				phaseOfFlight: (parsed.data.phaseOfFlight ?? null) as (typeof PHASE_OF_FLIGHT_VALUES)[number] | null,
				regReferences: parsed.data.regReferences,
			});
		} catch (err) {
			log.error(
				'createScenario threw',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { values: input, fieldErrors: { _: 'Could not save the scenario. Please try again.' } });
		}

		// Land the user on browse with `?created=<id>` so the page can surface
		// a success banner and highlight the new row. Confirmation, not guesswork --
		// see DESIGN_PRINCIPLES.md #7.
		redirect(303, `${ROUTES.REPS_BROWSE}?created=${encodeURIComponent(created.id)}`);
	},
} satisfies Actions;
