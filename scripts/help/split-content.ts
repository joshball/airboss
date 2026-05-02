#!/usr/bin/env bun
/**
 * Split each `apps/<app>/src/lib/help/content/*.ts` (and concepts subdir)
 * into a metadata-only index file + a body file under `bodies/`.
 *
 * Why: per docs/work/reviews/2026-05-02-ui-library-themes-perf.md, the
 * help registry is statically imported by `(app)/+layout.svelte`. With
 * unsplit content files every signed-in route ships ~2,300 lines of help
 * markdown even though only `/help/[id]` and the PageHelp drawer ever
 * read the bodies. Splitting lets `pages-index.ts` static-import only
 * metadata (+ a precomputed lowercased search haystack) while bodies
 * load via dynamic import on demand.
 *
 * Idempotent: running again rewrites both files from the live `HelpPage`
 * export, so this script doubles as a re-sync after a body edit. The
 * splitter understands two source shapes:
 *
 *   1. Legacy (pre-split): `content/<file>.ts` exports a single
 *      `HelpPage` -- this is the migration entry point.
 *   2. Already-split: `content/<file>.ts` exports `<name>Index:
 *      HelpPageIndex` and `content/bodies/<file>.ts` exports
 *      `<name>Body: HelpPageBody`. The splitter merges them, recomputes
 *      the haystack, and rewrites both files.
 *
 * Usage:
 *   bun scripts/help/split-content.ts
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { HelpPage } from '@ab/help';
// Static-import each app's pages list. The pages module pulls in every
// content file transitively, which bootstraps Bun's tsconfig path
// resolution for the `@ab/constants` references inside content. Dynamic
// `import(absolutePath)` doesn't trigger the same resolution, hence the
// static dependency here.
import { hangarHelpPages } from '../../apps/hangar/src/lib/help/pages';
import { studyHelpPages } from '../../apps/study/src/lib/help/pages';

interface AppTarget {
	app: string;
	contentDir: string;
	pages: readonly HelpPage[];
}

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const TARGETS: readonly AppTarget[] = [
	{ app: 'study', contentDir: join(REPO_ROOT, 'apps/study/src/lib/help/content'), pages: studyHelpPages },
	{ app: 'hangar', contentDir: join(REPO_ROOT, 'apps/hangar/src/lib/help/content'), pages: hangarHelpPages },
];

interface SourceFileMeta {
	/** Absolute path to the index/legacy file. */
	indexPath: string;
	/** Path of the file relative to the content dir (e.g. `concepts/fsrs.ts`). */
	relPath: string;
	/** Export name root, e.g. `gettingStarted` (no `Index`/`Body` suffix). */
	exportName: string;
	/** Page id authored inside the file. */
	pageId: string;
	/** Original raw source text -- preserves the leading block comment. */
	rawSource: string;
}

const ID_FROM_HELPPAGE_RE = /export\s+const\s+(\w+)\s*:\s*HelpPage\s*=\s*\{[\s\S]*?\bid:\s*'([^']+)'/;
const ID_FROM_INDEX_RE = /export\s+const\s+(\w+?)Index\s*:\s*HelpPageIndex\s*=\s*\{[\s\S]*?\bid:\s*'([^']+)'/;

function listSourceFiles(dir: string, base = dir): SourceFileMeta[] {
	const out: SourceFileMeta[] = [];
	for (const entry of readdirSync(dir)) {
		const abs = join(dir, entry);
		const stat = statSync(abs);
		if (stat.isDirectory()) {
			if (entry === 'bodies') continue;
			out.push(...listSourceFiles(abs, base));
			continue;
		}
		if (!entry.endsWith('.ts')) continue;
		const raw = readFileSync(abs, 'utf8');
		let exportName = '';
		let pageId = '';
		const helpPageMatch = raw.match(ID_FROM_HELPPAGE_RE);
		if (helpPageMatch) {
			[, exportName, pageId] = helpPageMatch;
		} else {
			const indexMatch = raw.match(ID_FROM_INDEX_RE);
			if (!indexMatch) {
				// Skip files that don't carry a HelpPage / HelpPageIndex export
				// (e.g. a future shared util).
				continue;
			}
			[, exportName, pageId] = indexMatch;
		}
		out.push({ indexPath: abs, relPath: relative(base, abs), exportName, pageId, rawSource: raw });
	}
	return out;
}

function leadingComment(source: string): string {
	const trimmed = source.trimStart();
	if (!trimmed.startsWith('/**') && !trimmed.startsWith('/*')) return '';
	const end = trimmed.indexOf('*/');
	if (end === -1) return '';
	return `${trimmed.slice(0, end + 2)}\n\n`;
}

/**
 * Strip wiki-link syntax from body text so the precomputed haystack does
 * not duplicate `[[display::id]]` markers. Without this step, every body
 * wiki-link would also appear in the haystack -- and because the
 * haystack ships as a regular double-quoted string in the index file,
 * the references scanner would (mis-)count those quoted occurrences as
 * separate wiki-link sites in addition to the body file's own.
 *
 * Replacement keeps the display text so substring search across the
 * haystack still hits authored prose.
 */
function stripWikilinks(text: string): string {
	return text.replace(/\[\[([^[\]:]*?)::[^[\]]+]]/g, (_, display) => display);
}

function buildHaystack(page: HelpPage): string {
	const parts: string[] = [stripWikilinks(page.summary)];
	for (const section of page.sections) {
		parts.push(stripWikilinks(section.body));
	}
	for (const keyword of page.tags.keywords ?? []) {
		parts.push(keyword);
	}
	return parts.join(' ').toLowerCase();
}

function escapeBacktickString(s: string): string {
	return s.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

function jsonIndent(value: unknown, indent: string): string {
	return JSON.stringify(value, null, '\t').replace(/\n/g, `\n${indent}`);
}

function sectionIndexLiteral(page: HelpPage): string {
	const items = page.sections.map((s) => `\t\t{ id: ${JSON.stringify(s.id)}, title: ${JSON.stringify(s.title)} },`);
	return `[\n${items.join('\n')}\n\t]`;
}

function sectionBodiesLiteral(page: HelpPage): string {
	const items = page.sections.map((s) => {
		const tagsBlob = s.tags ? `,\n\t\t\ttags: ${jsonIndent(s.tags, '\t\t\t')}` : '';
		const relatedBlob = s.related && s.related.length > 0 ? `,\n\t\t\trelated: ${JSON.stringify(s.related)}` : '';
		return `\t\t{
\t\t\tid: ${JSON.stringify(s.id)},
\t\t\ttitle: ${JSON.stringify(s.title)},
\t\t\tbody: \`${escapeBacktickString(s.body)}\`${tagsBlob}${relatedBlob},
\t\t},`;
	});
	return `[\n${items.join('\n')}\n\t]`;
}

function externalRefsLiteral(page: HelpPage): string | undefined {
	if (!page.externalRefs || page.externalRefs.length === 0) return undefined;
	return jsonIndent(page.externalRefs, '\t');
}

function relatedLiteral(related: readonly string[] | undefined): string | undefined {
	if (!related || related.length === 0) return undefined;
	return JSON.stringify(related);
}

/**
 * Map closed-enum string values back to their `@ab/constants` reference
 * shape so emitted index files keep using the typed constants instead of
 * raw string literals (per CLAUDE.md "no magic strings" rule).
 */
const APP_SURFACE_NAMES: Record<string, string> = {
	dashboard: 'APP_SURFACES.DASHBOARD',
	memory: 'APP_SURFACES.MEMORY',
	reps: 'APP_SURFACES.REPS',
	calibration: 'APP_SURFACES.CALIBRATION',
	knowledge: 'APP_SURFACES.KNOWLEDGE',
	session: 'APP_SURFACES.SESSION',
	plans: 'APP_SURFACES.PLANS',
	credentials: 'APP_SURFACES.CREDENTIALS',
	lens: 'APP_SURFACES.LENS',
	library: 'APP_SURFACES.LIBRARY',
	hangar: 'APP_SURFACES.HANGAR',
	global: 'APP_SURFACES.GLOBAL',
};
const HELP_KIND_NAMES: Record<string, string> = {
	concept: 'HELP_KINDS.CONCEPT',
	'how-to': 'HELP_KINDS.HOW_TO',
	reference: 'HELP_KINDS.REFERENCE',
};
const CONCEPT_GROUP_NAMES: Record<string, string> = {
	'learning-science': 'CONCEPT_GROUPS.LEARNING_SCIENCE',
	'airboss-architecture': 'CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE',
	'aviation-doctrine': 'CONCEPT_GROUPS.AVIATION_DOCTRINE',
};

interface ConstantsImportTracker {
	appSurfaces: boolean;
	helpKinds: boolean;
	conceptGroups: boolean;
}

function tagsLiteralTyped(page: HelpPage, tracker: ConstantsImportTracker): string {
	const tags = page.tags;
	const parts: string[] = [];
	const surfaceRefs = tags.appSurface.map((s) => {
		if (APP_SURFACE_NAMES[s]) {
			tracker.appSurfaces = true;
			return APP_SURFACE_NAMES[s];
		}
		return JSON.stringify(s);
	});
	parts.push(`\t\tappSurface: [${surfaceRefs.join(', ')}]`);
	if (HELP_KIND_NAMES[tags.helpKind]) {
		tracker.helpKinds = true;
		parts.push(`\t\thelpKind: ${HELP_KIND_NAMES[tags.helpKind]}`);
	} else {
		parts.push(`\t\thelpKind: ${JSON.stringify(tags.helpKind)}`);
	}
	if (tags.conceptGroup) {
		if (CONCEPT_GROUP_NAMES[tags.conceptGroup]) {
			tracker.conceptGroups = true;
			parts.push(`\t\tconceptGroup: ${CONCEPT_GROUP_NAMES[tags.conceptGroup]}`);
		} else {
			parts.push(`\t\tconceptGroup: ${JSON.stringify(tags.conceptGroup)}`);
		}
	}
	if (tags.aviationTopic && tags.aviationTopic.length > 0) {
		parts.push(`\t\taviationTopic: ${JSON.stringify(tags.aviationTopic)}`);
	}
	if (tags.keywords && tags.keywords.length > 0) {
		parts.push(`\t\tkeywords: ${JSON.stringify(tags.keywords)}`);
	}
	return `{\n${parts.join(',\n')},\n\t}`;
}

function indexFile(meta: SourceFileMeta, page: HelpPage): string {
	const comment = leadingComment(meta.rawSource);
	const indexExport = `${meta.exportName}Index`;
	const tracker: ConstantsImportTracker = { appSurfaces: false, helpKinds: false, conceptGroups: false };
	const tagsBlob = tagsLiteralTyped(page, tracker);
	const constantsImports: string[] = [];
	if (tracker.appSurfaces) constantsImports.push('APP_SURFACES');
	if (tracker.conceptGroups) constantsImports.push('CONCEPT_GROUPS');
	if (tracker.helpKinds) constantsImports.push('HELP_KINDS');
	const lines: string[] = [];
	lines.push(comment.trimEnd());
	if (comment) lines.push('');
	if (constantsImports.length > 0) {
		lines.push(`import { ${constantsImports.join(', ')} } from '@ab/constants';`);
	}
	lines.push(`import type { HelpPageIndex } from '@ab/help';`);
	lines.push('');
	lines.push(`export const ${indexExport}: HelpPageIndex = {`);
	lines.push(`\tid: ${JSON.stringify(page.id)},`);
	lines.push(`\ttitle: ${JSON.stringify(page.title)},`);
	lines.push(`\tsummary: ${JSON.stringify(page.summary)},`);
	lines.push(`\ttags: ${tagsBlob},`);
	lines.push(`\tsections: ${sectionIndexLiteral(page)},`);
	lines.push(`\tsearchHaystack: ${JSON.stringify(buildHaystack(page))},`);
	if (page.documents) lines.push(`\tdocuments: ${JSON.stringify(page.documents)},`);
	const related = relatedLiteral(page.related);
	if (related) lines.push(`\trelated: ${related},`);
	if (page.author) lines.push(`\tauthor: ${JSON.stringify(page.author)},`);
	if (page.reviewedAt) lines.push(`\treviewedAt: ${JSON.stringify(page.reviewedAt)},`);
	if (page.concept) lines.push(`\tconcept: ${page.concept},`);
	lines.push('};');
	return `${lines.join('\n')}\n`;
}

function bodyFile(meta: SourceFileMeta, page: HelpPage): string {
	const bodyExport = `${meta.exportName}Body`;
	const lines: string[] = [];
	lines.push('/**');
	lines.push(` * Body markdown for help page \`${page.id}\`.`);
	lines.push(' *');
	lines.push(' * Hand-edit this file -- the body is the source of truth. Run');
	lines.push(' * `bun scripts/help/split-content.ts` to re-sync the matching index');
	lines.push(' * file (precomputed search haystack) after editing a body.');
	lines.push(' */');
	lines.push('');
	lines.push("import type { HelpPageBody } from '@ab/help';");
	lines.push('');
	lines.push(`export const ${bodyExport}: HelpPageBody = {`);
	lines.push(`\tid: ${JSON.stringify(page.id)},`);
	lines.push(`\tsections: ${sectionBodiesLiteral(page)},`);
	const refs = externalRefsLiteral(page);
	if (refs) lines.push(`\texternalRefs: ${refs},`);
	lines.push('};');
	return `${lines.join('\n')}\n`;
}

function bodyPathFor(meta: SourceFileMeta, contentDir: string): string {
	const subdir = meta.relPath.includes('/') ? meta.relPath.slice(0, meta.relPath.lastIndexOf('/')) : '';
	const baseName = meta.relPath.split('/').pop() ?? meta.relPath;
	const bodiesDir = subdir ? join(contentDir, 'bodies', subdir) : join(contentDir, 'bodies');
	return join(bodiesDir, baseName);
}

function main(): void {
	for (const target of TARGETS) {
		const sources = listSourceFiles(target.contentDir);
		const byId = new Map<string, SourceFileMeta>();
		for (const meta of sources) {
			if (byId.has(meta.pageId)) {
				throw new Error(`Duplicate page id ${meta.pageId} (${meta.indexPath} vs ${byId.get(meta.pageId)?.indexPath})`);
			}
			byId.set(meta.pageId, meta);
		}

		for (const page of target.pages) {
			const meta = byId.get(page.id);
			if (!meta) {
				throw new Error(`No source file matches page id ${page.id} in ${target.app}`);
			}
			const indexPath = meta.indexPath;
			const bodyPath = bodyPathFor(meta, target.contentDir);
			mkdirSync(dirname(bodyPath), { recursive: true });
			writeFileSync(indexPath, indexFile(meta, page));
			writeFileSync(bodyPath, bodyFile(meta, page));
			console.log(`split: ${relative(REPO_ROOT, indexPath)}  +  ${relative(REPO_ROOT, bodyPath)}`);
		}
	}
}

main();
