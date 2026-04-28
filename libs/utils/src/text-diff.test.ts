import { describe, expect, it } from 'vitest';
import { type DiffOp, wordDiff } from './text-diff';

describe('wordDiff', () => {
	it('returns a single equal op for identical strings', () => {
		const ops = wordDiff('the quick brown fox', 'the quick brown fox');
		expect(ops).toEqual([{ kind: 'equal', text: 'the quick brown fox' }]);
	});

	it('returns no ops when both inputs are empty', () => {
		expect(wordDiff('', '')).toEqual([]);
	});

	it('returns a single add op for pure addition (empty -> something)', () => {
		expect(wordDiff('', 'hello world')).toEqual([{ kind: 'add', text: 'hello world' }]);
	});

	it('returns a single remove op for pure removal (something -> empty)', () => {
		expect(wordDiff('hello world', '')).toEqual([{ kind: 'remove', text: 'hello world' }]);
	});

	it('produces one add op for an inserted word at the end', () => {
		const ops = wordDiff('the cat', 'the cat sat');
		// equal: "the cat", add: " sat"
		const kinds = ops.map((o) => o.kind);
		expect(kinds).toContain('add');
		expect(reassemble(ops, 'a')).toBe('the cat');
		expect(reassemble(ops, 'b')).toBe('the cat sat');
	});

	it('produces remove + add for a replaced word in the middle', () => {
		const ops = wordDiff('the quick brown fox', 'the slow brown fox');
		const kinds = ops.map((o) => o.kind);
		expect(kinds).toContain('remove');
		expect(kinds).toContain('add');
		expect(reassemble(ops, 'a')).toBe('the quick brown fox');
		expect(reassemble(ops, 'b')).toBe('the slow brown fox');
	});

	it('preserves leading and trailing whitespace verbatim', () => {
		const ops = wordDiff('  hello\n', '  hello world\n');
		expect(reassemble(ops, 'a')).toBe('  hello\n');
		expect(reassemble(ops, 'b')).toBe('  hello world\n');
	});

	it('handles multi-paragraph inputs', () => {
		const a = 'paragraph one.\n\nparagraph two.';
		const b = 'paragraph one.\n\nparagraph two and a half.';
		const ops = wordDiff(a, b);
		expect(reassemble(ops, 'a')).toBe(a);
		expect(reassemble(ops, 'b')).toBe(b);
		expect(ops.some((o) => o.kind === 'add')).toBe(true);
	});

	it('merges consecutive ops of the same kind into a single span', () => {
		const ops = wordDiff('alpha beta', 'alpha gamma delta');
		// "alpha" is shared, "beta" removed, "gamma delta" added.
		// The two added tokens "gamma" and " delta" must collapse into one add op.
		const addOps = ops.filter((o) => o.kind === 'add');
		expect(addOps).toHaveLength(1);
		expect(addOps[0]?.text.trim()).toBe('gamma delta');
	});

	it('round-trips: assembling sides recovers original inputs', () => {
		const cases: Array<[string, string]> = [
			['', ''],
			['x', ''],
			['', 'y'],
			['a b c', 'a b c'],
			['a b c', 'a b c d'],
			['a b c d', 'a b c'],
			['a b c d', 'a x c d'],
			['the quick brown fox', 'the slow lazy brown fox jumps'],
		];
		for (const [a, b] of cases) {
			const ops = wordDiff(a, b);
			expect(reassemble(ops, 'a')).toBe(a);
			expect(reassemble(ops, 'b')).toBe(b);
		}
	});
});

/**
 * Recover one side of the diff (`a` = original, `b` = replacement) by
 * concatenating the op spans visible to that side.
 */
function reassemble(ops: DiffOp[], side: 'a' | 'b'): string {
	let out = '';
	for (const op of ops) {
		if (op.kind === 'equal') out += op.text;
		else if (op.kind === 'remove' && side === 'a') out += op.text;
		else if (op.kind === 'add' && side === 'b') out += op.text;
	}
	return out;
}
