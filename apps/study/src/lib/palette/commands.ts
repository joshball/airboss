/**
 * Study-app palette commands (Phase 4 of the command-palette WP).
 *
 * Declared as a flat list. `registerStudyCommands()` mounts every command
 * against the singleton `paletteCommands` registry on layout setup; the
 * companion `unregisterStudyCommands()` runs on layout teardown so
 * navigation away from the (app) group doesn't leave dangling commands
 * (matters for tests + HMR).
 *
 * Per the WP brief ("be honest about what's wired"), a command is included
 * here only when its target route exists in `ROUTES`. Anything that would
 * require inventing a route is dropped with a TODO comment instead.
 */

import { APP_IDS, ROUTES } from '@ab/constants';
import { type PaletteCommand, paletteCommands } from '@ab/help';
import { goto } from '$app/navigation';

const COMMANDS: readonly PaletteCommand[] = [
	{
		id: 'study.new-plan',
		type: 'cmd.goto',
		label: 'New plan',
		subtitle: 'Program / Plans',
		keywords: ['plan', 'program', 'new', 'create'],
		surface: APP_IDS.STUDY,
		handler: () => {
			void goto(ROUTES.PROGRAM_PLANS_NEW);
		},
	},
	{
		id: 'study.todays-reps',
		type: 'cmd.goto',
		label: "Go to today's reps",
		subtitle: 'Learn / Reps',
		keywords: ['reps', 'today', 'queue', 'practice'],
		surface: APP_IDS.STUDY,
		handler: () => {
			void goto(ROUTES.REPS);
		},
	},
	{
		id: 'study.memory-inbox',
		type: 'cmd.goto',
		label: 'Memory inbox',
		subtitle: 'Learn / Cards',
		keywords: ['memory', 'inbox', 'cards', 'pending', 'review'],
		surface: APP_IDS.STUDY,
		handler: () => {
			void goto(ROUTES.MEMORY);
		},
	},
	{
		id: 'study.open-dashboard',
		type: 'cmd.goto',
		label: 'Open dashboard',
		subtitle: 'Insights',
		keywords: ['dashboard', 'insights', 'stats', 'overview', 'home'],
		surface: APP_IDS.STUDY,
		handler: () => {
			void goto(ROUTES.INSIGHTS);
		},
	},
	{
		id: 'study.new-card',
		type: 'cmd.goto',
		label: 'New card',
		subtitle: 'Memory / New',
		keywords: ['card', 'new', 'flashcard', 'memory', 'create'],
		surface: APP_IDS.STUDY,
		handler: () => {
			void goto(ROUTES.MEMORY_NEW);
		},
	},
];

/**
 * Register every study command. Idempotent across HMR: we unregister
 * first so re-runs of the same module don't throw the duplicate-id guard.
 */
export function registerStudyCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
	for (const cmd of COMMANDS) paletteCommands.register(cmd);
}

export function unregisterStudyCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
}

export { COMMANDS as STUDY_PALETTE_COMMANDS };
