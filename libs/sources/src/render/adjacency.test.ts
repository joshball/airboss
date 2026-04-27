import { describe, expect, it } from 'vitest';
import { computeAdjacencyGroups, indexGroupsByMember, memberIndex } from './adjacency.ts';

describe('computeAdjacencyGroups', () => {
	it('returns [] for body with no links', () => {
		expect(computeAdjacencyGroups('Just prose, no links.')).toEqual([]);
	});

	it('emits a 1-element group for a single link', () => {
		const body = 'See [§91.103](airboss-ref:regs/cfr-14/91/103?at=2026).';
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.members).toEqual(['airboss-ref:regs/cfr-14/91/103?at=2026']);
		expect(groups[0]?.shape).toBe('list');
	});

	it('merges two adjacent same-corpus same-pin links separated by ", "', () => {
		const body =
			'Refs [§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026).';
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.members.length).toBe(2);
	});

	it('merges three contiguous adjacents separated by ", " and ", and "', () => {
		const body = `Trio at [§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.168](airboss-ref:regs/cfr-14/91/168?at=2026), and [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026).`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.members.length).toBe(3);
		expect(groups[0]?.shape).toBe('range');
	});

	it('emits comma-list shape for non-contiguous run', () => {
		const body = `[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026), and [§91.171](airboss-ref:regs/cfr-14/91/171?at=2026).`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.shape).toBe('list');
		expect(groups[0]?.members.length).toBe(3);
	});

	it('does NOT merge across prose between two same-corpus links', () => {
		const body = `[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026) covers fuel, while [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026) covers alternates.`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(2);
	});

	it('does NOT merge two adjacent links with different pins', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/103?at=2026), [b](airboss-ref:regs/cfr-14/91/103?at=2027)`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(2);
	});

	it('does NOT merge adjacent links across corpora', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/103?at=2026), [b](airboss-ref:aim/5-1-7?at=2026-09)`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(2);
	});

	it('treats markdown emphasis around adjacents as still-adjacent', () => {
		const body = `*[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.168](airboss-ref:regs/cfr-14/91/168?at=2026)*`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.members.length).toBe(2);
	});

	it('treats semicolons as adjacents', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/167?at=2026); [b](airboss-ref:regs/cfr-14/91/168?at=2026)`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
	});

	it('falls back to list for paragraph-suffix locators', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/103/b?at=2026), [b](airboss-ref:regs/cfr-14/91/103/c?at=2026)`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.shape).toBe('list');
	});

	it('falls back to list for non-numeric last segment', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/subpart-b?at=2026), [b](airboss-ref:regs/cfr-14/91/subpart-c?at=2026)`;
		const groups = computeAdjacencyGroups(body);
		expect(groups.length).toBe(1);
		expect(groups[0]?.shape).toBe('list');
	});
});

describe('indexGroupsByMember + memberIndex', () => {
	it('builds a lookup from member id to group', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/167?at=2026), [b](airboss-ref:regs/cfr-14/91/168?at=2026)`;
		const groups = computeAdjacencyGroups(body);
		const idx = indexGroupsByMember(groups);
		expect(idx.size).toBe(2);
		expect(idx.get('airboss-ref:regs/cfr-14/91/167?at=2026')).toBe(groups[0]);
	});

	it('memberIndex returns position within group', () => {
		const body = `[a](airboss-ref:regs/cfr-14/91/167?at=2026), [b](airboss-ref:regs/cfr-14/91/168?at=2026)`;
		const groups = computeAdjacencyGroups(body);
		const g = groups[0];
		expect(g).toBeDefined();
		if (g === undefined) return;
		expect(memberIndex(g, 'airboss-ref:regs/cfr-14/91/167?at=2026')).toBe(0);
		expect(memberIndex(g, 'airboss-ref:regs/cfr-14/91/168?at=2026')).toBe(1);
		expect(memberIndex(g, 'airboss-ref:regs/cfr-14/91/missing?at=2026')).toBe(-1);
	});
});
