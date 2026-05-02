import { describe, expect, it } from 'vitest';
import { isSensitiveKey, REDACTED_PLACEHOLDER, redactSensitive } from './redact';

describe('isSensitiveKey', () => {
	it('matches obvious credential keys', () => {
		expect(isSensitiveKey('token')).toBe(true);
		expect(isSensitiveKey('Token')).toBe(true);
		expect(isSensitiveKey('apiKey')).toBe(true);
		expect(isSensitiveKey('api_key')).toBe(true);
		expect(isSensitiveKey('access_token')).toBe(true);
		expect(isSensitiveKey('Authorization')).toBe(true);
		expect(isSensitiveKey('cookie')).toBe(true);
		expect(isSensitiveKey('password')).toBe(true);
		expect(isSensitiveKey('secret')).toBe(true);
		expect(isSensitiveKey('bearer')).toBe(true);
		expect(isSensitiveKey('private_key')).toBe(true);
	});

	it('does not match unrelated keys', () => {
		expect(isSensitiveKey('actorId')).toBe(false);
		expect(isSensitiveKey('outcome')).toBe(false);
		expect(isSensitiveKey('jobId')).toBe(false);
		expect(isSensitiveKey('email')).toBe(false);
		expect(isSensitiveKey('name')).toBe(false);
	});
});

describe('redactSensitive', () => {
	it('replaces sensitive top-level values with the placeholder', () => {
		const out = redactSensitive({ id: 'usr_x', token: 'abc.def.ghi' });
		expect(out).toEqual({ id: 'usr_x', token: REDACTED_PLACEHOLDER });
	});

	it('walks nested objects', () => {
		const out = redactSensitive({
			user: { id: 'usr_x', email: 'x@y.z' },
			session: { id: 'sess_y', cookie: 'session=abc; HttpOnly' },
		});
		expect(out).toEqual({
			user: { id: 'usr_x', email: 'x@y.z' },
			session: { id: 'sess_y', cookie: REDACTED_PLACEHOLDER },
		});
	});

	it('walks arrays without redacting their structure', () => {
		const out = redactSensitive([{ token: 'a' }, { id: 'b' }]);
		expect(out).toEqual([{ token: REDACTED_PLACEHOLDER }, { id: 'b' }]);
	});

	it('passes primitives through untouched', () => {
		expect(redactSensitive(null)).toBe(null);
		expect(redactSensitive(42)).toBe(42);
		expect(redactSensitive('hello')).toBe('hello');
		expect(redactSensitive(true)).toBe(true);
	});

	it('does not crash on cyclic input', () => {
		const a: Record<string, unknown> = { id: 'a' };
		a.self = a;
		const out = redactSensitive(a);
		expect((out as { id: string }).id).toBe('a');
	});
});
