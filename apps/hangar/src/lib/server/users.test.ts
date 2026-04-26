/**
 * Unit coverage for the users.ts helpers that don't need a live db --
 * the role narrower and the search-filter builder. The DB-touching
 * helpers (listUsers, countUsers, etc.) follow the registry.test.ts
 * pattern when integration-level coverage is added.
 */

import { ROLES } from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { describe, expect, it } from 'vitest';
import { buildUserSearchWhere, narrowRole } from './users';

describe('narrowRole', () => {
	it.each(Object.values(ROLES))('accepts canonical role %s', (role) => {
		expect(narrowRole(role)).toBe(role);
	});

	it('returns null for unknown role values', () => {
		expect(narrowRole('superuser')).toBeNull();
		expect(narrowRole('')).toBeNull();
	});

	it('returns null when the column is null (better-auth allows it)', () => {
		expect(narrowRole(null)).toBeNull();
	});
});

describe('buildUserSearchWhere', () => {
	it('returns undefined for an empty search so the WHERE clause is dropped', () => {
		expect(buildUserSearchWhere(undefined)).toBeUndefined();
		expect(buildUserSearchWhere('')).toBeUndefined();
		expect(buildUserSearchWhere('   ')).toBeUndefined();
	});

	it('returns a SQL expression when a search term is provided', () => {
		const expr = buildUserSearchWhere('jane');
		// Drizzle returns an SQL chunk; the only contract this layer cares
		// about is "non-undefined when there's a term, undefined otherwise."
		// Reading internals would couple us to ORM private surface, so we
		// only assert truthiness here.
		expect(expr).toBeDefined();
	});

	it('relies on escapeLikePattern so user-supplied % and _ are literal', () => {
		// The SQL chunk Drizzle builds isn't safely JSON-serialisable
		// (PgTable holds back-references), so we verify the contract
		// indirectly: the helper composes its pattern from
		// escapeLikePattern, and that primitive escapes the wildcards.
		expect(escapeLikePattern('jane_doe')).toBe('jane\\_doe');
		expect(escapeLikePattern('100%')).toBe('100\\%');
		expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash');
	});
});
