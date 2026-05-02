/**
 * Tests for `validateOutboundUrl`. Production callers wire DNS through
 * `node:dns/promises`; these tests inject a stub resolver via the
 * `resolveAll` option so the assertions are deterministic and offline.
 */

import { describe, expect, it } from 'vitest';
import { validateOutboundUrl } from './outbound-url';

function fakeResolver(records: readonly { address: string; family: number }[]) {
	return async () => records;
}

describe('validateOutboundUrl', () => {
	it('rejects AWS metadata IP literal', async () => {
		const result = await validateOutboundUrl('http://169.254.169.254/latest/meta-data/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('169.254.0.0/16');
	});

	it('rejects loopback IP literal', async () => {
		const result = await validateOutboundUrl('http://127.0.0.1:5435/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('127.0.0.0/8');
	});

	it('rejects RFC1918 10/8 IP literal', async () => {
		const result = await validateOutboundUrl('http://10.0.0.5/admin');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('10.0.0.0/8');
	});

	it('rejects RFC1918 172.16/12 IP literal', async () => {
		const result = await validateOutboundUrl('http://172.16.0.1/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('172.16.0.0/12');
	});

	it('rejects RFC1918 192.168/16 IP literal', async () => {
		const result = await validateOutboundUrl('http://192.168.1.1/router');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('192.168.0.0/16');
	});

	it('rejects 0.0.0.0', async () => {
		const result = await validateOutboundUrl('http://0.0.0.0/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('0.0.0.0/8');
	});

	it('rejects IPv6 link-local literal', async () => {
		const result = await validateOutboundUrl('http://[fe80::1]/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('fe80');
	});

	it('rejects IPv6 loopback ::1', async () => {
		const result = await validateOutboundUrl('http://[::1]/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason.toLowerCase()).toContain('denied');
	});

	it('rejects IPv6 unique-local fc00::/7', async () => {
		const result = await validateOutboundUrl('http://[fc00::1]/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason.toLowerCase()).toContain('denied');
	});

	it('rejects IPv4-mapped IPv6 that wraps loopback', async () => {
		const result = await validateOutboundUrl('http://[::ffff:127.0.0.1]/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('127.0.0.1');
	});

	it('rejects non-http(s) scheme', async () => {
		const result = await validateOutboundUrl('file:///etc/passwd');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('scheme');
	});

	it('rejects javascript: scheme', async () => {
		const result = await validateOutboundUrl('javascript:alert(1)');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('scheme');
	});

	it('rejects gopher: scheme', async () => {
		const result = await validateOutboundUrl('gopher://example.com/');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('scheme');
	});

	it('rejects unparseable URL', async () => {
		const result = await validateOutboundUrl('not a url');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('parseable');
	});

	it('accepts a valid public hostname when DNS resolves to a public IP', async () => {
		const result = await validateOutboundUrl('https://aeronav.faa.gov/visual/', {
			resolveAll: fakeResolver([{ address: '23.45.67.89', family: 4 }]),
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.url).toContain('aeronav.faa.gov');
	});

	it('accepts a valid public hostname with multiple public records', async () => {
		const result = await validateOutboundUrl('https://www.faa.gov/regs', {
			resolveAll: fakeResolver([
				{ address: '23.45.67.89', family: 4 },
				{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
			]),
		});
		expect(result.ok).toBe(true);
	});

	it('rejects a hostname that resolves to a private IP', async () => {
		const result = await validateOutboundUrl('https://attacker.example/path', {
			resolveAll: fakeResolver([{ address: '10.0.0.5', family: 4 }]),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain('attacker.example');
			expect(result.reason).toContain('10.0.0.0/8');
		}
	});

	it('rejects a hostname that resolves to AWS metadata', async () => {
		const result = await validateOutboundUrl('https://rebind.example/', {
			resolveAll: fakeResolver([{ address: '169.254.169.254', family: 4 }]),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain('169.254');
	});

	it('rejects a hostname whose AAAA record is link-local', async () => {
		const result = await validateOutboundUrl('https://v6.example/', {
			resolveAll: fakeResolver([{ address: 'fe80::5', family: 6 }]),
		});
		expect(result.ok).toBe(false);
	});

	it('rejects a hostname with mixed public + private records (defense in depth)', async () => {
		const result = await validateOutboundUrl('https://mixed.example/', {
			resolveAll: fakeResolver([
				{ address: '23.45.67.89', family: 4 },
				{ address: '10.0.0.1', family: 4 },
			]),
		});
		expect(result.ok).toBe(false);
	});

	it('reports DNS failure as a clean denial (no throw)', async () => {
		const result = await validateOutboundUrl('https://nx.example/', {
			resolveAll: async () => {
				throw new Error('ENOTFOUND');
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason.toLowerCase()).toContain('dns');
	});

	it('reports empty DNS records as a clean denial', async () => {
		const result = await validateOutboundUrl('https://empty.example/', {
			resolveAll: fakeResolver([]),
		});
		expect(result.ok).toBe(false);
	});

	it('accepts public IP literal as host', async () => {
		const result = await validateOutboundUrl('https://8.8.8.8/');
		expect(result.ok).toBe(true);
	});
});
