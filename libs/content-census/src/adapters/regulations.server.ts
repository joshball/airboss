// @browser-globals: server-only -- never imported by client .svelte
/**
 * The regulations-course census adapter -- a Phase-2 Layer-1 adapter.
 *
 * The FAR navigation course is organised as ten weekly directories under
 * `course/regulations/`. Each `week-NN-*` directory carries an overview, a
 * set of numbered lesson files, a drills file, and an oral file. The unit of
 * this census is the WEEK.
 *
 * Derived-state rule (design.md):
 *   - `full`    -- the week has its overview, drills, and oral, AND every
 *     numbered lesson file clears the skeleton-body threshold.
 *   - `partial` -- a modality is missing, the week has zero lessons, or one
 *     or more lesson files are still a skeleton (too thin to teach).
 *
 * Gap view / intent view are Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { COURSE_FILE_AUTHORED_BODY_MIN_LINES, REGULATIONS_WEEK_REQUIRED_MODALITIES, ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import {
	dirsWithPrefix,
	fileExists,
	frontmatterString,
	listMarkdownFiles,
	nonBlankLineCount,
	parseMarkdownFile,
} from './markdown.server';

const REGULATIONS_DIR = 'course/regulations';

const STATE_FULL = 'full';
const STATE_PARTIAL = 'partial';

/** A numbered lesson file is `NN-slug.md` -- `01-title-14-shape.md` etc. */
const LESSON_FILE = /^\d+-.+\.md$/;

const REGULATIONS_DOCS: DocLink[] = [
	{
		label: 'FAR navigation course -- README',
		href: ROUTES.HANGAR_DOCS_PATH('course/regulations/README.md'),
		role: 'The course charter: scope, audience, and the ten-week structure this census walks.',
	},
	{
		label: 'FAR navigation course -- syllabus',
		href: ROUTES.HANGAR_DOCS_PATH('course/regulations/SYLLABUS.md'),
		role: "The week-by-week plan -- the authoring target each week's completeness is measured against.",
	},
	{
		label: 'ADR 028 -- Content-intent frontmatter',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/028-content-intent-frontmatter.md'),
		role: 'The proposed Layer-2 intent block; once approved, each week carries planned / wanted authoring intent.',
	},
];

/** One week's structural facts -- which files exist and which lessons are thin. */
interface WeekFacts {
	hasOverview: boolean;
	hasDrills: boolean;
	hasOral: boolean;
	lessonCount: number;
	thinLessons: number;
}

/** Read a week directory and gather its structural facts. */
function inspectWeek(weekDir: string): WeekFacts {
	const rel = `${REGULATIONS_DIR}/${weekDir}`;
	const files = listMarkdownFiles(rel);
	const lessonFiles = files.filter((name) => LESSON_FILE.test(name));
	let thinLessons = 0;
	for (const lesson of lessonFiles) {
		const { body } = parseMarkdownFile(`${rel}/${lesson}`);
		if (nonBlankLineCount(body) < COURSE_FILE_AUTHORED_BODY_MIN_LINES) thinLessons += 1;
	}
	return {
		hasOverview: fileExists(`${rel}/overview.md`),
		hasDrills: fileExists(`${rel}/drills.md`),
		hasOral: fileExists(`${rel}/oral.md`),
		lessonCount: lessonFiles.length,
		thinLessons,
	};
}

/** Classify a week from its structural facts. */
function deriveState(facts: WeekFacts): string {
	const modalitiesPresent = facts.hasOverview && facts.hasDrills && facts.hasOral;
	const lessonsAuthored = facts.lessonCount > 0 && facts.thinLessons === 0;
	return modalitiesPresent && lessonsAuthored ? STATE_FULL : STATE_PARTIAL;
}

/**
 * Build the regulations-course census. Walks the ten weekly directories,
 * derives a full / partial state per week, and reports the modality-coverage
 * metrics.
 */
export function regulationsCensus(): CorpusCensus {
	const weeks = dirsWithPrefix(REGULATIONS_DIR, 'week-');

	const items: CensusItem[] = [];
	let totalLessons = 0;
	let weeksWithAllModalities = 0;
	for (const weekDir of weeks) {
		const facts = inspectWeek(weekDir);
		totalLessons += facts.lessonCount;
		if (facts.hasOverview && facts.hasDrills && facts.hasOral) weeksWithAllModalities += 1;
		const overview = parseMarkdownFile(`${REGULATIONS_DIR}/${weekDir}/overview.md`);
		const title = frontmatterString(overview.frontmatter, 'title') ?? weekDir;
		items.push({
			id: weekDir,
			label: title,
			derivedState: deriveState(facts),
			detail: `${facts.lessonCount} lessons - overview ${facts.hasOverview ? 'y' : 'n'}, drills ${facts.hasDrills ? 'y' : 'n'}, oral ${facts.hasOral ? 'y' : 'n'}${facts.thinLessons > 0 ? ` - ${facts.thinLessons} thin` : ''}`,
		});
	}

	const totalWeeks = items.length;
	const full = items.filter((item) => item.derivedState === STATE_FULL).length;
	const partial = items.filter((item) => item.derivedState === STATE_PARTIAL).length;

	const metrics: CensusMetric[] = [
		{
			key: 'weeks',
			label: 'Course weeks',
			value: totalWeeks,
			whatItMeasures:
				'The number of weekly modules in the FAR navigation course -- each `week-NN-*` directory is one week of structured regulatory study.',
			whyItMatters:
				"The weeks are the course's spine. They sequence a learner from the shape of Title 14 through to an integrated capstone oral; a missing or empty week breaks the progression.",
			whatToDo: {
				text: 'The week plan is fixed in the syllabus; author content into the existing week directories.',
				href: ROUTES.HANGAR_DOCS_PATH('course/regulations/SYLLABUS.md'),
			},
		},
		{
			key: 'full-weeks',
			label: 'Full weeks',
			value: `${full} / ${totalWeeks}`,
			whatItMeasures: `How many weeks carry all three modalities -- ${REGULATIONS_WEEK_REQUIRED_MODALITIES.join(', ')} -- with every numbered lesson file authored past the skeleton threshold.`,
			whyItMatters:
				'A full week gives the learner the complete loop: read the lessons, drill the rules, rehearse the oral. A partial week leaves the loop open -- lessons with no drills are untested, drills with no oral are unintegrated.',
			whatToDo: {
				text: 'Bring partial weeks to full by authoring their missing modality or fleshing out skeleton lesson files.',
				href: ROUTES.HANGAR_DOCS_PATH('course/regulations/SYLLABUS.md'),
			},
		},
		{
			key: 'partial-weeks',
			label: 'Partial weeks',
			value: partial,
			whatItMeasures:
				'How many weeks are missing a modality, have no numbered lessons, or carry one or more lesson files still too thin to teach.',
			whyItMatters:
				'A partial week looks present on the syllabus but under-delivers. A learner reaching it gets an incomplete experience -- the week appears authored but a piece of the read / drill / oral loop is absent.',
			whatToDo: {
				text: "Inspect each partial week's detail column to see which modality or lesson is missing, and author it.",
				href: ROUTES.HANGAR_DOCS_PATH('course/regulations/README.md'),
			},
		},
		{
			key: 'lessons',
			label: 'Lesson files',
			value: totalLessons,
			whatItMeasures:
				'The total count of numbered lesson files across all weeks -- the `NN-slug.md` teaching units inside each week directory.',
			whyItMatters:
				'Lessons are where the regulations are actually explained. Drills and orals exercise what the lessons teach; the lesson count is the breadth of the regulatory ground the course covers.',
			whatToDo: {
				text: 'Add lesson files into the relevant week directory following the NN-slug.md naming.',
				href: ROUTES.HANGAR_DOCS_PATH('course/regulations/README.md'),
			},
		},
		{
			key: 'modality-coverage',
			label: 'Weeks with all modalities',
			value: `${weeksWithAllModalities} / ${totalWeeks}`,
			whatItMeasures:
				'How many weeks carry all three modality files present on disk -- an overview, a drills file, and an oral file -- regardless of how thin the lessons are.',
			whyItMatters:
				'This is the structural-completeness floor. A week missing the drills or oral file cannot be a full week no matter how good its lessons are; this metric isolates the structural gap from the authoring-depth gap.',
			whatToDo: {
				text: 'Create the missing drills.md or oral.md file for any week below all-modalities.',
				href: ROUTES.HANGAR_DOCS_PATH('course/regulations/README.md'),
			},
		},
	];

	return {
		id: 'regulations',
		label: 'Regulations course',
		whatItIs:
			'The structured FAR navigation course -- a ten-week walk through Parts 1, 61, 91, 141, and 135, organised so a pilot learns to navigate the regulatory system, not just memorise rules.',
		whyItExists:
			'Pilots need to find and apply regulations under pressure. The course teaches Title 14 as a system to live inside, pairing lessons with drills and oral rehearsal so the knowledge transfers to a checkride and the cockpit.',
		location: `${REGULATIONS_DIR}/week-*`,
		mode: 'census',
		stateRule: `A week is "full" when it carries an overview, a drills file, and an oral file, AND every numbered lesson file clears the ${COURSE_FILE_AUTHORED_BODY_MIN_LINES}-non-blank-line authored threshold; otherwise "partial".`,
		docs: REGULATIONS_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Regulations course'),
	};
}
