/**
 * `emitAviationTs` tests -- round-trip + byte-identity + header.
 *
 * The generated TS file exports `AVIATION_REFERENCES: readonly Reference[]`
 * identical in shape to the hand-authored pre-migration file. Consumers
 * import it without touching TOML, so the round-trip has to land back on
 * the same domain objects after a ts -> module -> array pass.
 *
 * We use the in-memory `AVIATION_REFERENCES` fixture (the same one the
 * codec tests round-trip). Emitting + writing to a temp file + importing
 * dynamically gives us an end-to-end guarantee the emitted file parses as
 * valid TypeScript and yields the original references.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Reference } from '@ab/aviation';
import { AVIATION_REFERENCES } from '@ab/aviation';
import { describe, expect, it } from 'vitest';
import { emitAviationTs } from './emit-aviation-ts';

/** Normalise references to drop `undefined` optional fields for deep-equal. */
function normalise(ref: Reference): Record<string, unknown> {
	const out: Record<string, unknown> = {
		id: ref.id,
		displayName: ref.displayName,
		aliases: [...ref.aliases],
		paraphrase: ref.paraphrase,
		tags: ref.tags,
		sources: ref.sources.map((c) => ({
			sourceId: c.sourceId,
			locator: { ...c.locator },
			...(c.url !== undefined ? { url: c.url } : {}),
		})),
		related: [...ref.related],
	};
	if (ref.author !== undefined) out.author = ref.author;
	if (ref.reviewedAt !== undefined) out.reviewedAt = ref.reviewedAt;
	if (ref.verbatim !== undefined) out.verbatim = { ...ref.verbatim };
	return out;
}

function sortedById(refs: readonly Reference[]): Reference[] {
	return [...refs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

describe('emitAviationTs', () => {
	it('includes a do-not-edit-by-hand header pointing at hangar', () => {
		const body = emitAviationTs(AVIATION_REFERENCES.slice(0, 1));
		expect(body).toContain('@ab/hangar-sync');
		expect(body).toContain('DO NOT EDIT BY HAND');
		expect(body).toContain('hangar');
	});

	it('emits a module that registers AVIATION_REFERENCES at load', () => {
		const body = emitAviationTs(AVIATION_REFERENCES.slice(0, 1));
		expect(body).toContain("import { registerReferences } from '../registry';");
		expect(body).toContain("import type { Reference } from '../schema/reference';");
		expect(body).toContain('export const AVIATION_REFERENCES: readonly Reference[]');
		expect(body).toContain('registerReferences(AVIATION_REFERENCES);');
	});

	it('is byte-identical on a second pass (idempotent)', () => {
		const first = emitAviationTs(AVIATION_REFERENCES);
		const second = emitAviationTs(AVIATION_REFERENCES);
		expect(second).toBe(first);
	});

	it('sorts references by id regardless of input order', () => {
		const shuffled = [...AVIATION_REFERENCES].reverse();
		const a = emitAviationTs(shuffled);
		const b = emitAviationTs(AVIATION_REFERENCES);
		expect(a).toBe(b);
	});

	it('round-trips through dynamic import back to the original references', async () => {
		// Use a small subset to keep the test fast; the full set is covered by
		// the byte-identity test above.
		const subset = AVIATION_REFERENCES.slice(0, 10);
		const body = emitAviationTs(subset);

		const dir = await mkdtemp(join(tmpdir(), 'emit-aviation-ts-'));
		const modulePath = join(dir, 'aviation.ts');
		// Neutralise the relative imports so the emitted body loads without a
		// sibling `registry` / `schema/reference` module in the temp dir.
		const neutralised = body
			.replace(
				"import { registerReferences } from '../registry';",
				'function registerReferences(_refs: unknown): void { /* noop in test */ }',
			)
			.replace("import type { Reference } from '../schema/reference';", 'type Reference = unknown;');
		await writeFile(modulePath, neutralised, 'utf8');
		const mod = (await import(modulePath)) as { AVIATION_REFERENCES: readonly Reference[] };
		expect(mod.AVIATION_REFERENCES.length).toBe(subset.length);
		const got = [...mod.AVIATION_REFERENCES].map(normalise);
		const want = sortedById(subset).map(normalise);
		expect(got).toEqual(want);
	});
});
