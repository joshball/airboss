/**
 * Pure-table-shape tests. No DB connection; the Drizzle table objects are
 * compile-time + value-time guards over the column set, indexes, and
 * CHECK constraints.
 */

import {
	CORPUS_VALUES,
	INGEST_ISSUE_KIND_VALUES,
	INGEST_OVERRIDE_ACTION_VALUES,
	INGEST_STATUS_VALUES,
} from '@ab/constants';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { ingestIssue, ingestOverride } from './schema';

/** Drizzle's `check(...)` value is a SQL builder; flatten its query
 * chunks to a string so the literals are inspectable. */
function checkSqlText(checkValue: unknown): string {
	const obj = checkValue as { queryChunks?: ReadonlyArray<{ value?: unknown }> };
	if (!obj.queryChunks) return '';
	return obj.queryChunks
		.map((c) => {
			if (typeof c === 'string') return c;
			const v = (c as { value?: unknown }).value;
			if (Array.isArray(v)) return v.join('');
			if (typeof v === 'string') return v;
			return '';
		})
		.join('');
}

describe('ingestIssue table', () => {
	const cfg = getTableConfig(ingestIssue);
	const columns = new Map(cfg.columns.map((c) => [c.name, c]));

	it('has the documented columns', () => {
		const expected = [
			'id',
			'corpus',
			'source_id',
			'edition',
			'page_num',
			'kind',
			'external_id',
			'payload',
			'status',
			'first_seen_at',
			'last_seen_at',
			'created_at',
			'updated_at',
		];
		for (const name of expected) {
			expect(columns.has(name), `missing column ${name}`).toBe(true);
		}
	});

	it('declares the unique (kind, external_id) index', () => {
		const indexes = cfg.indexes;
		const uq = indexes.find((idx) => idx.config.name === 'hangar_ingest_issue_kind_external_id_uq');
		expect(uq).toBeDefined();
		expect(uq?.config.unique).toBe(true);
	});

	it('declares the corpus / kind / status CHECK constraints with the constants', () => {
		const checkNames = cfg.checks.map((c) => c.name);
		expect(checkNames).toContain('hangar_ingest_issue_corpus_chk');
		expect(checkNames).toContain('hangar_ingest_issue_kind_chk');
		expect(checkNames).toContain('hangar_ingest_issue_status_chk');
		const checks = new Map(cfg.checks.map((c) => [c.name, checkSqlText(c.value)]));
		const corpusSql = checks.get('hangar_ingest_issue_corpus_chk') ?? '';
		for (const value of CORPUS_VALUES) {
			expect(corpusSql).toContain(`'${value}'`);
		}
		const kindSql = checks.get('hangar_ingest_issue_kind_chk') ?? '';
		for (const value of INGEST_ISSUE_KIND_VALUES) {
			expect(kindSql).toContain(`'${value}'`);
		}
		const statusSql = checks.get('hangar_ingest_issue_status_chk') ?? '';
		for (const value of INGEST_STATUS_VALUES) {
			expect(statusSql).toContain(`'${value}'`);
		}
	});
});

describe('ingestOverride table', () => {
	const cfg = getTableConfig(ingestOverride);
	const columns = new Map(cfg.columns.map((c) => [c.name, c]));

	it('has the documented columns', () => {
		const expected = ['id', 'issue_id', 'action', 'payload', 'created_by_user_id', 'created_at', 'updated_at'];
		for (const name of expected) {
			expect(columns.has(name), `missing column ${name}`).toBe(true);
		}
	});

	it('declares the unique issue_id index', () => {
		const indexes = cfg.indexes;
		const uq = indexes.find((idx) => idx.config.name === 'hangar_ingest_override_issue_id_uq');
		expect(uq).toBeDefined();
		expect(uq?.config.unique).toBe(true);
	});

	it('cascades delete from issue', () => {
		const fk = cfg.foreignKeys.find((f) => {
			const ref = f.reference();
			return ref.foreignTable === ingestIssue;
		});
		expect(fk, 'expected an FK referencing ingest_issue').toBeDefined();
		expect(fk?.onDelete).toBe('cascade');
	});

	it('declares the action CHECK with every action literal', () => {
		const sql = cfg.checks.map((c) => checkSqlText(c.value)).join('\n');
		for (const value of INGEST_OVERRIDE_ACTION_VALUES) {
			expect(sql).toContain(`'${value}'`);
		}
	});
});
