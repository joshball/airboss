/**
 * Unit tests for the dev-seed production guard.
 */

import { DEV_SEED_BYPASS_FLAG } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { decideSeedGuard, extractHost, isHostAllowlisted } from './seed-guard';

describe('extractHost', () => {
	it('extracts hostname from a standard URL', () => {
		expect(extractHost('postgresql://user:pw@localhost:5435/airboss')).toBe('localhost');
	});

	it('lowercases the hostname', () => {
		expect(extractHost('postgres://USER:PW@LocalHost/db')).toBe('localhost');
	});

	it('handles a URL without credentials', () => {
		expect(extractHost('postgresql://airboss-db/airboss')).toBe('airboss-db');
	});

	it('returns null for garbage', () => {
		expect(extractHost('')).toBeNull();
		expect(extractHost('not a url')).toBeNull();
	});
});

describe('isHostAllowlisted', () => {
	it('allows exact matches', () => {
		expect(isHostAllowlisted('localhost')).toBe(true);
		expect(isHostAllowlisted('127.0.0.1')).toBe(true);
		expect(isHostAllowlisted('airboss-db')).toBe(true);
	});

	it('allows .local suffix', () => {
		expect(isHostAllowlisted('mymachine.local')).toBe(true);
		expect(isHostAllowlisted('airboss-db.local')).toBe(true);
	});

	it('rejects unknown hosts', () => {
		expect(isHostAllowlisted('prod.aws.amazonaws.com')).toBe(false);
		expect(isHostAllowlisted('db.airboss.app')).toBe(false);
	});
});

describe('decideSeedGuard', () => {
	it('allows local host with NODE_ENV=development', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://airboss:airboss@localhost:5435/airboss',
			nodeEnv: 'development',
			flags: new Set(),
		});
		expect(decision.kind).toBe('allow');
	});

	it('allows local host with NODE_ENV undefined', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://airboss:airboss@127.0.0.1:5435/airboss',
			nodeEnv: undefined,
			flags: new Set(),
		});
		expect(decision.kind).toBe('allow');
	});

	it('blocks when DATABASE_URL is empty', () => {
		const decision = decideSeedGuard({
			databaseUrl: '',
			nodeEnv: 'development',
			flags: new Set(),
		});
		expect(decision.kind).toBe('block');
		if (decision.kind === 'block') {
			expect(decision.reason).toBe('database-url-missing');
		}
	});

	it('blocks NODE_ENV=production even on localhost', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://u:p@localhost/airboss',
			nodeEnv: 'production',
			flags: new Set(),
		});
		expect(decision.kind).toBe('block');
		if (decision.kind === 'block') {
			expect(decision.reason).toBe('production-host');
			expect(decision.message).toContain('NODE_ENV=production');
		}
	});

	it('blocks production-looking host without bypass flag', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://u:p@db.airboss.app/airboss',
			nodeEnv: 'development',
			flags: new Set(),
		});
		expect(decision.kind).toBe('block');
		if (decision.kind === 'block') {
			expect(decision.reason).toBe('production-host');
		}
	});

	it('returns allow-bypass when prod host AND bypass flag present', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://u:p@db.airboss.app/airboss',
			nodeEnv: 'production',
			flags: new Set([DEV_SEED_BYPASS_FLAG]),
		});
		expect(decision.kind).toBe('allow-bypass');
	});

	it('the bypass flag alone (without prod host) is irrelevant -- still allows local normally', () => {
		const decision = decideSeedGuard({
			databaseUrl: 'postgresql://u:p@localhost/airboss',
			nodeEnv: 'development',
			flags: new Set([DEV_SEED_BYPASS_FLAG]),
		});
		expect(decision.kind).toBe('allow');
	});
});
