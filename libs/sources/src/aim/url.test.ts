import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { AIM_LIVE_URL, getAimLiveUrl } from './url.ts';

describe('getAimLiveUrl', () => {
	it('returns the AIM landing URL for a paragraph', () => {
		expect(getAimLiveUrl('airboss-ref:aim/5-1-7' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});

	it('returns the AIM landing URL for a section', () => {
		expect(getAimLiveUrl('airboss-ref:aim/5-1' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});

	it('returns the AIM landing URL for a chapter', () => {
		expect(getAimLiveUrl('airboss-ref:aim/5' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});

	it('returns the AIM landing URL for a glossary entry', () => {
		expect(getAimLiveUrl('airboss-ref:aim/glossary/pilot-in-command' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});

	it('returns the AIM landing URL for an appendix', () => {
		expect(getAimLiveUrl('airboss-ref:aim/appendix-1' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});

	it('returns null for a malformed SourceId', () => {
		expect(getAimLiveUrl('airboss-ref:aim/abc' as SourceId, '2026-09')).toBeNull();
	});

	it('returns null for a non-aim SourceId', () => {
		expect(getAimLiveUrl('airboss-ref:regs/cfr-14/91/103' as SourceId, '2026')).toBeNull();
	});

	it('strips ?at= pin before parsing', () => {
		expect(getAimLiveUrl('airboss-ref:aim/5-1-7?at=2026-09' as SourceId, '2026-09')).toBe(AIM_LIVE_URL);
	});
});
