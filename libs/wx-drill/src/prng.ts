/**
 * Deterministic PRNG for the drill sampler. mulberry32: small, fast, fine for
 * non-cryptographic sequencing. Same seed -> same drill pack, every run.
 */

export function mulberry32(seed: number): () => number {
	let t = seed | 0;
	return () => {
		t = (t + 0x6d2b79f5) | 0;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
	const idx = Math.floor(rand() * arr.length);
	const value = arr[idx];
	if (value === undefined) {
		throw new Error('pick: cannot sample from empty array');
	}
	return value;
}
