/**
 * Build the TOC entries the flightbag's `<TOCDrawer>` consumes for an ACS
 * publication. Mirrors `lib/toc.ts` (handbook flat-reading-order builder)
 * but emits the publication tree as a collapsible-groups payload: each
 * area is a top-level group header; tasks live under their area as
 * children with `groupId === area.id`.
 *
 * The page-server load already produces the (areas, tasks) view. This
 * helper takes that shape and emits the entry list. Pure function, no
 * DB access -- safe to import from any layer.
 */

import { ROUTES } from '@ab/constants';
import type { TOCDrawerEntry } from '@ab/library';

export interface AcsTocTask {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly letter: string;
}

export interface AcsTocArea {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly padded: string;
	readonly tasks: ReadonlyArray<AcsTocTask>;
}

export interface AcsTocOptions {
	/** Document slug for URL building. */
	readonly documentSlug: string;
	/** Area + task tree from the page-server load. */
	readonly areas: ReadonlyArray<AcsTocArea>;
	/** Task id of the currently-active page, or null on the publication landing. */
	readonly activeTaskId?: string | null;
}

/**
 * Builds the flat entry list `<TOCDrawer>` consumes. Each area emits one
 * group-header entry (no `href`, no `groupId`); each task emits one entry
 * with `groupId === area.id` and an href to the task reader. Reading-time
 * minutes default to 0 (the ACS doesn't have per-task word counts in the
 * seed today).
 */
export function buildAcsTocEntries(options: AcsTocOptions): TOCDrawerEntry[] {
	const { documentSlug, areas, activeTaskId } = options;
	const entries: TOCDrawerEntry[] = [];
	for (const area of areas) {
		entries.push({
			sectionId: area.id,
			code: `Area ${area.code}`,
			title: area.title,
			depth: 0,
			href: null,
			minutesToRead: 0,
			isActive: false,
		});
		for (const task of area.tasks) {
			entries.push({
				sectionId: task.id,
				code: `Task ${task.letter.toUpperCase()}`,
				title: task.title,
				depth: 1,
				href: ROUTES.FLIGHTBAG_ACS_TASK(documentSlug, area.padded, task.letter),
				minutesToRead: 0,
				isActive: activeTaskId !== null && activeTaskId !== undefined && task.id === activeTaskId,
				groupId: area.id,
			});
		}
	}
	return entries;
}

/**
 * Returns the area id that contains the given task id, or null when the
 * task isn't found. Page loads use this to seed the TOC drawer's
 * `defaultExpandedGroupIds` so the area containing the current task is
 * the only one expanded at first render.
 */
export function findAreaIdForTask(areas: ReadonlyArray<AcsTocArea>, taskId: string): string | null {
	for (const area of areas) {
		for (const task of area.tasks) {
			if (task.id === taskId) return area.id;
		}
	}
	return null;
}
