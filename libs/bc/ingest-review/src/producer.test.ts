/**
 * `runProducers` tests.
 *
 * Plug stub plugins into the registry; verify the producer pipeline:
 *   - only invokes plugins matching the requested corpus
 *   - upserts every yielded input through `upsertIssues`
 *   - flips disappeared issues to `stale` per (corpus, kind)
 *   - isolates a failing plugin so the other plugins still run
 *   - is idempotent on re-run with identical fixture
 *
 * All tests register their stubs through `registerPlugin` after a
 * `resetPluginRegistry` so the suite never collides with the real
 * caption / image-orphan plugins that ship from `./plugins/index.ts`.
 */

import { bauthUser } from '@ab/auth/schema';
import { INGEST_REVIEW, type IngestIssueKind } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerPlugin, resetPluginRegistry } from './plugin';
import { runProducers } from './producer';
import { listIssues } from './queries';
import { ingestIssue } from './schema';
import type { IngestIssuePlugin, IssueInput } from './types';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `producer-test-${TEST_USER_ID}@airboss.test`;
const TEST_TAG = TEST_USER_ID.slice(-12);

const seededExternalIds = new Set<string>();

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Producer test user',
			firstName: 'Producer',
			lastName: 'Test',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

beforeEach(() => {
	resetPluginRegistry();
});

afterEach(async () => {
	resetPluginRegistry();
	if (seededExternalIds.size > 0) {
		await db.delete(ingestIssue).where(inArray(ingestIssue.externalId, [...seededExternalIds]));
		seededExternalIds.clear();
	}
});

afterAll(async () => {
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

interface StubOptions {
	kind: IngestIssueKind;
	yields: readonly IssueInput[];
	throwOnProduce?: Error;
}

function makeStub(opts: StubOptions): IngestIssuePlugin {
	const { kind, yields, throwOnProduce } = opts;
	return {
		kind,
		async *produceIssues() {
			if (throwOnProduce) throw throwOnProduce;
			for (const input of yields) yield input;
		},
		async findCandidates() {
			return [];
		},
		validateAction() {
			// no-op
		},
		serializeForYaml(issue, override) {
			return {
				external_id: issue.externalId,
				kind: issue.kind,
				action: override.action,
				payload: override.payload as Record<string, unknown>,
			};
		},
	};
}

// Per-test sourceId so the `markStaleByDifference` scope at the end of
// each producer run only touches rows this test owns. Without this,
// other tests running in parallel against the shared dev DB see their
// `unresolved` rows flipped to `stale` by us.
const TEST_SOURCE_ID = `prod_${TEST_TAG}`;

function makeInput(kind: IngestIssueKind, suffix: string): IssueInput {
	const externalId = `prod_${TEST_TAG}_${kind.replace('.', '_')}_${suffix}`;
	seededExternalIds.add(externalId);
	return {
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		sourceId: TEST_SOURCE_ID,
		edition: 'FAA-H-8083-15B',
		pageNum: 83,
		kind,
		externalId,
		payload: { hint: suffix },
	};
}

function runOpts(extra: Partial<{ kind: IngestIssueKind }> = {}): {
	corpus: typeof INGEST_REVIEW.CORPUSES.HANDBOOK;
	repoRoot: string;
	sourceId: string;
	kind?: IngestIssueKind;
} {
	return {
		corpus: INGEST_REVIEW.CORPUSES.HANDBOOK,
		repoRoot: process.cwd(),
		sourceId: TEST_SOURCE_ID,
		...extra,
	};
}

describe('runProducers', () => {
	it('invokes only plugins whose kind matches the corpus prefix', async () => {
		const handbookPlugin = makeStub({
			kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
			yields: [makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'a')],
		});
		// A plugin from a different corpus must not run.
		const ghostPlugin: IngestIssuePlugin = {
			...handbookPlugin,
			kind: 'regs.fictional-orphan' as IngestIssueKind,
		};
		registerPlugin(handbookPlugin);
		registerPlugin(ghostPlugin);
		const result = await runProducers(runOpts());

		expect(result.totalPlugins).toBe(1);
		expect(result.totalUpserted).toBe(1);
		expect(result.perPlugin.map((p) => p.kind)).toEqual([INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN]);
	});

	it('upserts produced inputs into ingest_issue', async () => {
		const input = makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'upsert');
		registerPlugin(makeStub({ kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, yields: [input] }));
		await runProducers(runOpts());

		const rows = await listIssues({ corpus: INGEST_REVIEW.CORPUSES.HANDBOOK, sourceId: TEST_SOURCE_ID });
		expect(rows.some((r) => r.externalId === input.externalId)).toBe(true);
	});

	it('is idempotent on a second run with identical fixture', async () => {
		const input = makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'idem');
		registerPlugin(makeStub({ kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, yields: [input] }));
		await runProducers(runOpts());
		await runProducers(runOpts());

		const rows = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, input.externalId));
		expect(rows).toHaveLength(1);
	});

	it('flips a disappeared issue to stale on the next run', async () => {
		const a = makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'staleA');
		const b = makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'staleB');
		registerPlugin(makeStub({ kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, yields: [a, b] }));
		await runProducers(runOpts());

		// Re-register a different stub that only emits `a` -- `b` should go stale.
		resetPluginRegistry();
		registerPlugin(makeStub({ kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, yields: [a] }));
		const result = await runProducers(runOpts());
		expect(result.totalStaled).toBeGreaterThanOrEqual(1);
		const rowsB = await db.select().from(ingestIssue).where(eq(ingestIssue.externalId, b.externalId));
		expect(rowsB[0]?.status).toBe(INGEST_REVIEW.STATUS.STALE);
	});

	it('captures a failing plugin in perPlugin and continues with the rest', async () => {
		const failing = makeStub({
			kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
			yields: [],
			throwOnProduce: new Error('boom'),
		});
		const ok = makeStub({
			kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
			yields: [makeInput(INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN, 'survives')],
		});
		registerPlugin(failing);
		registerPlugin(ok);
		const result = await runProducers(runOpts());

		expect(result.totalErrors).toBe(1);
		const failingSummary = result.perPlugin.find((p) => p.kind === INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN);
		expect(failingSummary?.error?.message).toBe('boom');
		const okSummary = result.perPlugin.find((p) => p.kind === INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN);
		expect(okSummary?.upserted).toBe(1);
	});

	it('honours the optional kind filter', async () => {
		registerPlugin(
			makeStub({
				kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
				yields: [makeInput(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN, 'kindfilter1')],
			}),
		);
		registerPlugin(
			makeStub({
				kind: INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
				yields: [makeInput(INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN, 'kindfilter2')],
			}),
		);
		const result = await runProducers(runOpts({ kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN }));
		expect(result.totalPlugins).toBe(1);
		expect(result.perPlugin[0]?.kind).toBe(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN);
	});
});
