// @browser-globals: server-only -- never imported by client .svelte
/**
 * Knowledge-node resolver for layer-4 commentary callouts.
 *
 * Every `CommentaryCallout.knowledgeNodeIds[*]` entry MUST resolve to a real
 * directory under `course/knowledge/weather/<dir>/`, where `<dir>` is the
 * node id with the `wx-` prefix stripped. The convention is enforced across
 * the corpus: every node.md frontmatter `id: wx-<dir>` line carries the
 * leading `wx-`, while the directory itself drops it (see
 * `course/knowledge/weather/airmasses-and-fronts/node.md` whose id is
 * `wx-airmasses-and-fronts`).
 *
 * The resolver is server-only -- it touches `node:fs` + `node:path` -- and
 * lazy-loads the built-ins via `process.getBuiltinModule(...)` per the
 * canonical pattern at `libs/constants/src/source-cache.ts`.
 *
 * Source of truth: `docs/work-packages/wx-engine/design.md`
 * "Browser-safety contract" + `docs/work-packages/wx-engine/spec.md`
 * "Validation -> Commentary knowledge-node binding".
 */

import type { CommentaryCallout } from './types';

type NodeFs = {
	existsSync: (p: string) => boolean;
	statSync: (p: string) => { isDirectory: () => boolean };
};

type NodePath = {
	resolve: (...parts: string[]) => string;
};

type GetBuiltinModule = (spec: string) => unknown;

/** Lazy-load a Node built-in hidden from Vite's static analyzer. */
function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`knowledge-link: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

/** Default repo root: the current working directory. */
function defaultRepoRoot(): string {
	if (typeof process === 'undefined') throw new Error('knowledge-link: process is undefined; cannot resolve repo root');
	return process.cwd();
}

/**
 * Map a knowledge node id to its on-disk directory name. Strips the leading
 * `wx-` prefix per the corpus convention. Returns `null` when the id does
 * not carry the prefix -- the resolver treats unprefixed ids as
 * unresolvable since every weather node id starts with `wx-`.
 */
function idToDir(id: string): string | null {
	if (!id.startsWith('wx-')) return null;
	const dir = id.slice('wx-'.length);
	if (dir.length === 0) return null;
	return dir;
}

/**
 * Return true when `course/knowledge/weather/<dir>/` exists, where
 * `<dir>` is the id with the `wx-` prefix stripped.
 *
 * @param id Knowledge node id, e.g. `wx-airmasses-and-fronts`.
 * @param repoRoot Repo root (defaults to `process.cwd()`).
 */
export function resolveKnowledgeNodeId(id: string, repoRoot?: string): boolean {
	const dir = idToDir(id);
	if (dir === null) return false;
	const root = repoRoot ?? defaultRepoRoot();
	const fs = loadBuiltin<NodeFs>('node:fs');
	const path = loadBuiltin<NodePath>('node:path');
	const target = path.resolve(root, 'course', 'knowledge', 'weather', dir);
	if (!fs.existsSync(target)) return false;
	try {
		return fs.statSync(target).isDirectory();
	} catch {
		return false;
	}
}

/** Validation report from `validateAllKnowledgeNodes`. */
export interface KnowledgeNodeValidationReport {
	/** Distinct unresolved knowledge-node ids across all callouts. */
	unresolved: string[];
	/** Callout ids whose `knowledgeNodeIds` contained at least one unresolved id. */
	calloutIds: string[];
}

/**
 * Walk every callout, collect knowledge-node ids that fail to resolve.
 * Used by the round-trip check (Phase F) and by `writeScenarioBundle`
 * before it emits commentary -- both fail loud when an id misses.
 */
export function validateAllKnowledgeNodes(
	callouts: readonly CommentaryCallout[],
	opts?: { repoRoot?: string },
): KnowledgeNodeValidationReport {
	const repoRoot = opts?.repoRoot;
	const unresolvedSet = new Set<string>();
	const calloutIdSet = new Set<string>();
	for (const callout of callouts) {
		for (const id of callout.knowledgeNodeIds) {
			if (!resolveKnowledgeNodeId(id, repoRoot)) {
				unresolvedSet.add(id);
				calloutIdSet.add(callout.id);
			}
		}
	}
	return {
		unresolved: [...unresolvedSet].sort(),
		calloutIds: [...calloutIdSet].sort(),
	};
}
