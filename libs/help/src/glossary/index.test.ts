import { describe, expect, it } from 'vitest';
import { GLOSSARY_ENTRIES } from './entries';
import { getGlossaryEntry, listGlossaryEntries, stripFrontmatter } from './index';

describe('glossary entries', () => {
	it('all keys are unique', () => {
		const seen = new Set<string>();
		for (const e of GLOSSARY_ENTRIES) {
			expect(seen.has(e.key), `duplicate key: ${e.key}`).toBe(false);
			seen.add(e.key);
		}
	});

	it('every entry has non-empty term + short + longRef', () => {
		for (const e of GLOSSARY_ENTRIES) {
			expect(e.term.length, e.key).toBeGreaterThan(0);
			expect(e.short.length, e.key).toBeGreaterThan(0);
			expect(e.longRef.endsWith('.md'), e.key).toBe(true);
		}
	});

	it('every related key resolves', () => {
		const keys = new Set(GLOSSARY_ENTRIES.map((e) => e.key));
		for (const e of GLOSSARY_ENTRIES) {
			for (const r of e.related) {
				expect(keys.has(r), `entry ${e.key} relates to unknown key ${r}`).toBe(true);
			}
		}
	});

	it('every entry has a corresponding long-form markdown file', () => {
		const all = listGlossaryEntries();
		for (const e of all) {
			expect(e.long.length, `missing long-form for ${e.key}`).toBeGreaterThan(0);
		}
	});
});

describe('getGlossaryEntry', () => {
	it('returns merged short + long for a known key', () => {
		const qual = getGlossaryEntry('qual');
		expect(qual).not.toBeNull();
		expect(qual?.term).toBe('Qual');
		expect(qual?.short.length).toBeGreaterThan(0);
		expect(qual?.long).toContain('# Qual');
	});

	it('returns null for an unknown key', () => {
		expect(getGlossaryEntry('not-a-real-key')).toBeNull();
	});
});

describe('stripFrontmatter', () => {
	it('removes a leading YAML frontmatter block', () => {
		const input = '---\nkey: x\nterm: X\n---\n\n# X\n\nbody';
		expect(stripFrontmatter(input)).toBe('# X\n\nbody');
	});

	it('passes through markdown without frontmatter', () => {
		expect(stripFrontmatter('# Heading\n\nbody')).toBe('# Heading\n\nbody');
	});

	it('returns empty string for malformed frontmatter', () => {
		expect(stripFrontmatter('---\nkey: x\nno close')).toBe('---\nkey: x\nno close');
	});
});
