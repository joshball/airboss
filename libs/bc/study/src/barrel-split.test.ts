/**
 * Asserts the runtime barrel (`@ab/bc-study`) and the build-only barrel
 * (`@ab/bc-study/build`) re-export disjoint sets, AND that every
 * actor-bypass / shared-row mutator named in the chunk-2 security MAJOR
 * finding lives in the build barrel and not the runtime barrel.
 *
 * If a future BC change accidentally re-exports an upsert / writer / audit
 * helper from `./index.ts`, this test fails with the symbol name -- closing
 * the regression loop on
 * `docs/work/reviews/2026-05-01-study-bc-domain-security.md`.
 */

import { describe, expect, it } from 'vitest';
import * as buildBarrel from './build';
import * as runtimeBarrel from './index';

const runtimeKeys = new Set(Object.keys(runtimeBarrel));
const buildKeys = new Set(Object.keys(buildBarrel));

/**
 * Symbols that must be reachable from `@ab/bc-study/build` only. Touch
 * this list when a new build-only helper lands; the named-symbol
 * assertion ensures the build barrel keeps surfacing every actor-bypass
 * path that scripts/seeders need.
 */
const BUILD_ONLY_SYMBOLS = [
	// Knowledge-graph writers (`refreshEdgeTargetExists` was dropped per the
	// 2026-05-06 review §E -- edge target existence resolved at read time)
	'replaceNodeEdges',
	'upsertKnowledgeNode',
	// Credential writers + DAG validator
	'upsertCredential',
	'upsertCredentialPrereq',
	'upsertCredentialSyllabus',
	'validateCredentialDag',
	// Syllabus writers + leaf validator
	'replaceSyllabusNodeLinks',
	'upsertSyllabus',
	'upsertSyllabusNode',
	'validateAirbossRefForLeaf',
	// Reference writers
	'replaceFiguresForSection',
	'upsertReference',
	'upsertReferenceSection',
	// Citation audit (reads every row, no userId scope)
	'AUDIT_FINDING_KINDS',
	'auditCitations',
	// Manifest schemas (consumed by seeders only)
	'acManifestSchema',
	'acsManifestSchema',
	'aimManifestSchema',
	'cfrManifestSchema',
	'manifestSchema',
	'sectionTreeManifestSchema',
	'wholeDocManifestSchema',
	'safoManifestSchema',
	'infoManifestSchema',
	'bulletinManifestSectionSchema',
	'handbookManifestSectionSchema',
	'handbookManifestExtractionSchema',
	'handbookManifestErrataEntrySchema',
	'handbookSectionFrontmatterSchema',
	// Citation ingestion schemas (used by seeders, not route handlers)
	'citationSchema',
	'legacyCitationSchema',
	'structuredCitationSchema',
] as const;

/**
 * Symbols the runtime barrel MUST keep exposing. Route loaders / form
 * actions parse request bodies against the handbook input schemas, and
 * the runtime barrel is the only path TS routes resolve.
 */
const RUNTIME_REQUIRED_SYMBOLS = [
	'handbookHeartbeatInputSchema',
	'handbookNotesInputSchema',
	'handbookReadStatusSchema',
] as const;

describe('@ab/bc-study barrel split', () => {
	it('runtime + build barrel re-export disjoint sets', () => {
		const overlap = [...runtimeKeys].filter((key) => buildKeys.has(key));
		expect(overlap).toEqual([]);
	});

	it.each(BUILD_ONLY_SYMBOLS)('build barrel exports %s', (symbol) => {
		expect(buildKeys.has(symbol)).toBe(true);
	});

	it.each(BUILD_ONLY_SYMBOLS)('runtime barrel does NOT export %s', (symbol) => {
		expect(runtimeKeys.has(symbol)).toBe(false);
	});

	it.each(RUNTIME_REQUIRED_SYMBOLS)('runtime barrel exports %s', (symbol) => {
		expect(runtimeKeys.has(symbol)).toBe(true);
	});
});
