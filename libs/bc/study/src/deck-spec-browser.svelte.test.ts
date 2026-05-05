import { describe, expect, it } from 'vitest';
import { decodeDeckSpec, encodeDeckSpec } from './deck-spec';
import type { ReviewSessionDeckSpec } from './schema';

// `libs/bc/study` is bundled into the browser; deck-spec encode/decode must
// work without Node globals. happy-dom polyfills `Buffer`, so this file
// cannot itself catch a `Buffer.from` regression -- the static lint guard
// in `tools/check-browser-globals.ts` does that. These cases stay as
// roundtrip coverage exercising the web-platform `TextEncoder` / `btoa` /
// `atob` path the encoder relies on.

describe('deck-spec encoder roundtrip', () => {
	it('roundtrips a simple spec', () => {
		const spec: ReviewSessionDeckSpec = { domain: 'weather', dueOnly: true };
		const encoded = encodeDeckSpec(spec);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeDeckSpec(encoded)).toEqual(spec);
	});

	it('roundtrips a spec with multibyte characters in tags', () => {
		const spec: ReviewSessionDeckSpec = { domain: 'airspace', tags: ['ifr', 'météo', '空域'] };
		const encoded = encodeDeckSpec(spec);
		const decoded = decodeDeckSpec(encoded);
		expect(decoded).toEqual(spec);
	});

	it('produces URL-safe output without padding', () => {
		const encoded = encodeDeckSpec({ domain: 'airspace' });
		expect(encoded).not.toContain('+');
		expect(encoded).not.toContain('/');
		expect(encoded).not.toContain('=');
	});
});
