// @browser-globals: server-only -- never imported by client .svelte
/**
 * CFR navigation-tree YAML writer -- the ingest-time emitter for the
 * `nav-tree.yaml` sidecar.
 *
 * # Why this module exists separately from `nav-tree.ts`
 *
 * `nav-tree.ts` ships the browser-safe reader surface (`getCfrNavTree`,
 * `buildEcfrUrl`, `findChapterForPart`, ...) and is re-exported from the
 * `@ab/sources` runtime barrel -- which is bundled into the browser.
 *
 * `writeCfrNavTree` statically reaches `../io/write-if-changed.ts`, which
 * statically imports `node:fs`. A `vite build` for the client follows BOTH
 * static and dynamic import edges: a `nav-tree.ts`-internal
 * `await import('../io/write-if-changed.ts')` still pulls `write-if-changed`
 * (and `node:fs`) into the client bundle as a lazy chunk, which Rollup then
 * compiles against the browser-externalised `node:fs` stub and crashes the
 * build. Deferring the import only defers *execution*, not *bundling*.
 *
 * Keeping the writer in its own server-only module gives `nav-tree.ts` zero
 * edges (static or dynamic) to `node:fs`, so the runtime barrel stays
 * browser-safe. Ingest callers (`regs/ingest.ts`, scripts) import
 * `writeCfrNavTree` from here or from `@ab/sources/server`.
 *
 * Source of truth: ADR 022 §"byte-equal idempotent regen" + the
 * browser-hydration debug playbook.
 */

import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { writeIfChanged } from '../io/write-if-changed.ts';
import { bustNavTreeCache, type CfrTitleNumber } from './nav-tree.ts';
import type { RawNavTree } from './xml-walker.ts';

const NAV_TREE_FILENAME = 'nav-tree.yaml';

export interface WriteCfrNavTreeInput {
	readonly title: CfrTitleNumber;
	readonly editionDate: string;
	readonly outRoot: string;
	readonly raw: RawNavTree;
}

interface YamlShape {
	readonly title: number;
	readonly 'title-name': string;
	readonly 'edition-date': string;
	readonly chapters: readonly YamlChapter[];
}
interface YamlChapter {
	readonly id: string;
	readonly name: string;
	readonly subchapters?: readonly YamlSubchapter[];
	readonly 'direct-parts'?: readonly string[];
}
interface YamlSubchapter {
	readonly id: string;
	readonly name: string;
	readonly parts: readonly string[];
}

/**
 * Serialise a `RawNavTree` to the kebab-cased YAML shape persisted on disk.
 * Pure -- no I/O. Exposed for the round-trip test in `nav-tree.test.ts`.
 */
export function toYamlShape(raw: RawNavTree, editionDate: string): YamlShape {
	return {
		title: Number.parseInt(raw.title, 10),
		'title-name': raw.titleName,
		'edition-date': editionDate,
		chapters: raw.chapters.map((c) => {
			const out: YamlChapter = {
				id: c.id,
				name: c.name,
				...(c.subchapters.length > 0
					? {
							subchapters: c.subchapters.map((s) => ({
								id: s.id,
								name: s.name,
								parts: [...s.parts],
							})),
						}
					: {}),
				...(c.directParts.length > 0 ? { 'direct-parts': [...c.directParts] } : {}),
			};
			return out;
		}),
	};
}

/**
 * Serialise a `RawNavTree` to `regulations/cfr-<title>/<edition>/nav-tree.yaml`.
 * Idempotent via `writeIfChanged`. Server-only -- reaches `node:fs`.
 */
export async function writeCfrNavTree(input: WriteCfrNavTreeInput): Promise<{ wrote: boolean; path: string }> {
	const path = join(input.outRoot, `cfr-${input.title}`, input.editionDate, NAV_TREE_FILENAME);
	const yaml = stringifyYaml(toYamlShape(input.raw, input.editionDate), { lineWidth: 0 });
	const result = writeIfChanged(path, yaml);
	// Bust the in-memory reader cache so subsequent reads in the same process
	// see the new contents.
	bustNavTreeCache(input.title, input.editionDate);
	return { wrote: result.wrote, path };
}
