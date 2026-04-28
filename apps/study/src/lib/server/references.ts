/**
 * SvelteKit server load helper for the `@ab/sources/render` API.
 *
 * Source of truth: ADR 019 §2.5 + Phase 4 work package. The route's
 * `+page.server.ts` calls `loadLessonReferences(body, acks, opts)` and
 * passes the returned payload to its component as `data`. The component
 * imports `<RenderedLesson>` and consumes the payload directly.
 *
 * Internally: `extractIdentifiers` -> `batchResolve` -> `toSerializable`.
 * The resulting payload is JSON-safe; SvelteKit transports it.
 */

import type { LessonAcknowledgment } from '@ab/sources';
import {
	batchResolve,
	extractIdentifiers,
	type RenderMode,
	type SerializableResolvedMap,
	toSerializable,
} from '@ab/sources';

export interface LoadedLessonReferences {
	readonly body: string;
	readonly resolved: SerializableResolvedMap;
	readonly mode: RenderMode;
}

export interface LoadLessonReferencesOptions {
	readonly historicalLens?: boolean;
	readonly mode?: RenderMode;
}

export async function loadLessonReferences(
	body: string,
	acknowledgments: readonly LessonAcknowledgment[],
	options: LoadLessonReferencesOptions = {},
): Promise<LoadedLessonReferences> {
	const ids = extractIdentifiers(body);
	const resolved = await batchResolve(ids, {
		acknowledgments,
		historicalLens: options.historicalLens ?? false,
		body,
	});
	return {
		body,
		resolved: toSerializable(resolved),
		mode: options.mode ?? 'web',
	};
}
