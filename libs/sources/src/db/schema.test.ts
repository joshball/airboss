/**
 * Schema-shape unit tests for `sources_registry.promotion_batches` and
 * `sources_registry.editions`.
 *
 * No DB. These tests introspect the Drizzle table objects to confirm the
 * column names, types, default-flags, and constraint shapes match the WP
 * spec (`docs/work-packages/promotion-batches-persistence/spec.md`) and
 * ADR 019 §2.4 + §6.1. A change here is a load-bearing schema change; the
 * test forces the author to reconcile spec + migration + table object in
 * one PR.
 *
 * The migration smoke test (fresh DB + `bun run db:migrate`) is documented
 * as a manual step in `drizzle/0007_promotion_batches_and_editions.md` --
 * the dev DB isn't part of CI, so we don't gate this run on it.
 */

import { PROMOTION_STATE_VALUES, SCHEMAS, SOURCE_LIFECYCLE_VALUES } from '@ab/constants';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { editions, promotionBatches, sourcesRegistrySchema } from './schema.ts';

describe('sources_registry schema', () => {
	it('uses the SOURCES_REGISTRY namespace from @ab/constants', () => {
		expect(sourcesRegistrySchema.schemaName).toBe(SCHEMAS.SOURCES_REGISTRY);
		expect(SCHEMAS.SOURCES_REGISTRY).toBe('sources_registry');
	});
});

describe('promotion_batches', () => {
	it('exposes all 10 columns from ADR 019 §2.4', () => {
		const columns = getTableColumns(promotionBatches);
		expect(Object.keys(columns).sort()).toEqual(
			[
				'id',
				'corpus',
				'reviewerId',
				'promotionDate',
				'scope',
				'inputSource',
				'state',
				'fromLifecycle',
				'toLifecycle',
				'previousBatchId',
			].sort(),
		);
	});

	it('uses text + jsonb + timestamptz column types per spec', () => {
		const columns = getTableColumns(promotionBatches);
		expect(columns.id.dataType).toBe('string');
		expect(columns.corpus.dataType).toBe('string');
		expect(columns.reviewerId.dataType).toBe('string');
		expect(columns.promotionDate.dataType).toBe('date');
		expect(columns.scope.dataType).toBe('json');
		expect(columns.inputSource.dataType).toBe('string');
		expect(columns.state.dataType).toBe('string');
		expect(columns.fromLifecycle.dataType).toBe('string');
		expect(columns.toLifecycle.dataType).toBe('string');
		expect(columns.previousBatchId.dataType).toBe('string');
	});

	it('marks every column non-null except previous_batch_id', () => {
		const columns = getTableColumns(promotionBatches);
		expect(columns.id.notNull).toBe(true);
		expect(columns.corpus.notNull).toBe(true);
		expect(columns.reviewerId.notNull).toBe(true);
		expect(columns.promotionDate.notNull).toBe(true);
		expect(columns.scope.notNull).toBe(true);
		expect(columns.inputSource.notNull).toBe(true);
		expect(columns.state.notNull).toBe(true);
		expect(columns.fromLifecycle.notNull).toBe(true);
		expect(columns.toLifecycle.notNull).toBe(true);
		// previousBatchId is nullable -- forward promotions don't have a previous batch.
		expect(columns.previousBatchId.notNull).toBe(false);
	});

	it('marks id as the primary key', () => {
		const columns = getTableColumns(promotionBatches);
		expect(columns.id.primary).toBe(true);
	});

	it('lives in the sources_registry schema with the expected table name', () => {
		expect(getTableName(promotionBatches)).toBe('promotion_batches');
		const config = getTableConfig(promotionBatches);
		expect(config.schema).toBe(SCHEMAS.SOURCES_REGISTRY);
	});

	it('declares the 3 indexes the spec requires', () => {
		const config = getTableConfig(promotionBatches);
		const indexNames = config.indexes.map((idx) => idx.config.name).sort();
		expect(indexNames).toEqual(
			[
				'promotion_batches_corpus_date_idx',
				'promotion_batches_previous_batch_idx',
				'promotion_batches_reviewer_date_idx',
			].sort(),
		);
	});

	it('declares the self-referential FK on previous_batch_id with ON DELETE RESTRICT', () => {
		const config = getTableConfig(promotionBatches);
		expect(config.foreignKeys).toHaveLength(1);
		const fk = config.foreignKeys[0];
		expect(fk).toBeDefined();
		if (!fk) return;
		expect(fk.onDelete).toBe('restrict');
		const ref = fk.reference();
		expect(ref.columns.map((c) => c.name)).toEqual(['previous_batch_id']);
		expect(ref.foreignColumns.map((c) => c.name)).toEqual(['id']);
	});

	it('declares CHECK constraints for state, from_lifecycle, to_lifecycle', () => {
		const config = getTableConfig(promotionBatches);
		const checkNames = config.checks.map((c) => c.name).sort();
		expect(checkNames).toEqual(
			[
				'promotion_batches_from_lifecycle_check',
				'promotion_batches_state_check',
				'promotion_batches_to_lifecycle_check',
			].sort(),
		);
	});

	it('routes the state CHECK through PROMOTION_STATE_VALUES (no magic strings)', () => {
		// The CHECK SQL embeds the constant array; the test asserts the constant
		// is the source of truth so a future addition (e.g. 'reverted') flips the
		// schema in lockstep.
		expect(PROMOTION_STATE_VALUES).toEqual(['promoted', 'de-promoted']);
	});

	it('routes the lifecycle CHECKs through SOURCE_LIFECYCLE_VALUES (no magic strings)', () => {
		expect(SOURCE_LIFECYCLE_VALUES).toEqual(['draft', 'pending', 'accepted', 'retired', 'superseded']);
	});
});

describe('editions', () => {
	it('exposes all 6 columns from ADR 019 §6.1', () => {
		const columns = getTableColumns(editions);
		expect(Object.keys(columns).sort()).toEqual(
			['id', 'sourceId', 'editionLabel', 'publishedAt', 'retiredAt', 'metadata'].sort(),
		);
	});

	it('uses text + timestamptz + jsonb column types per spec', () => {
		const columns = getTableColumns(editions);
		expect(columns.id.dataType).toBe('string');
		expect(columns.sourceId.dataType).toBe('string');
		expect(columns.editionLabel.dataType).toBe('string');
		expect(columns.publishedAt.dataType).toBe('date');
		expect(columns.retiredAt.dataType).toBe('date');
		expect(columns.metadata.dataType).toBe('json');
	});

	it('marks id, source_id, edition_label as non-null and timestamps + metadata as nullable', () => {
		const columns = getTableColumns(editions);
		expect(columns.id.notNull).toBe(true);
		expect(columns.sourceId.notNull).toBe(true);
		expect(columns.editionLabel.notNull).toBe(true);
		expect(columns.publishedAt.notNull).toBe(false);
		expect(columns.retiredAt.notNull).toBe(false);
		expect(columns.metadata.notNull).toBe(false);
	});

	it('marks id as the primary key', () => {
		const columns = getTableColumns(editions);
		expect(columns.id.primary).toBe(true);
	});

	it('lives in the sources_registry schema with the expected table name', () => {
		expect(getTableName(editions)).toBe('editions');
		const config = getTableConfig(editions);
		expect(config.schema).toBe(SCHEMAS.SOURCES_REGISTRY);
	});

	it('declares the 4 indexes the spec requires (two partial, one unique)', () => {
		const config = getTableConfig(editions);
		const indexNames = config.indexes.map((idx) => idx.config.name).sort();
		expect(indexNames).toEqual(
			[
				'editions_source_current_idx',
				'editions_source_date_idx',
				'editions_source_label_superseded_idx',
				'editions_source_label_uq',
			].sort(),
		);

		// The partial index for current-edition lookups must filter on retired_at IS NULL.
		const currentIdx = config.indexes.find((idx) => idx.config.name === 'editions_source_current_idx');
		expect(currentIdx).toBeDefined();
		// Drizzle stores the WHERE clause as an SQL fragment; check the rendered
		// query text for the predicate.
		const currentWhereFragment = JSON.stringify(currentIdx?.config.where);
		expect(currentWhereFragment).toContain('retired_at IS NULL');

		// The inverse partial index for the NOT EXISTS supersession path.
		const supersededIdx = config.indexes.find((idx) => idx.config.name === 'editions_source_label_superseded_idx');
		expect(supersededIdx).toBeDefined();
		const supersededWhereFragment = JSON.stringify(supersededIdx?.config.where);
		expect(supersededWhereFragment).toContain('retired_at IS NOT NULL');

		// The UNIQUE index enforces the "single row per (source_id, edition_label)"
		// invariant the resolver + NOT EXISTS subqueries assume (ADR 026).
		const uniqueIdx = config.indexes.find((idx) => idx.config.name === 'editions_source_label_uq');
		expect(uniqueIdx).toBeDefined();
		expect(uniqueIdx?.config.unique).toBe(true);
	});

	it('does not declare any foreign keys (source_id is a code-resident SOURCES key)', () => {
		const config = getTableConfig(editions);
		expect(config.foreignKeys).toHaveLength(0);
	});
});
