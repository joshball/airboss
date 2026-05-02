/**
 * PfdTickState contract -- step / quiescence / loop idle.
 *
 * Pins the perf invariants the rAF loop relies on so the optimisation
 * does not regress silently:
 *   - `step()` returns `false` once every channel is inside its
 *     quiescence epsilon; the rAF loop uses the return value to idle.
 *   - The first quiescent `step()` call snaps `rendered = target` once,
 *     then returns false from then on without touching state again.
 *   - Writes to `target` after settle dirty the state again so `step()`
 *     resumes returning true (the loop re-arms via `$effect`).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PFD_VALUES, PfdTickState } from '../src/pfd/pfd-tick.svelte';

describe('PfdTickState.step quiescence', () => {
	it('returns true while moving toward target', () => {
		const state = new PfdTickState();
		state.target = { ...DEFAULT_PFD_VALUES, altitudeFeet: 5000 };
		expect(state.step(1 / 60)).toBe(true);
		expect(state.rendered.altitudeFeet).not.toBe(5000);
	});

	it('returns false once every channel sits inside the quiescence epsilon', () => {
		const state = new PfdTickState();
		// Iterate until quiescent (each frame is clamped to MAX_DT_SECONDS;
		// a few hundred frames of 1/15 s is plenty for the low-pass to
		// converge to within 0.05 ft / 0.01 deg).
		state.target = { ...DEFAULT_PFD_VALUES, altitudeFeet: 3001 };
		for (let i = 0; i < 500; i += 1) {
			if (!state.step(1 / 15)) break;
		}
		expect(state.step(1 / 60)).toBe(false);
	});

	it('snaps rendered to target on the first quiescent step', () => {
		const state = new PfdTickState();
		// Park rendered just inside the altitude epsilon (0.05 ft).
		state.target = { ...DEFAULT_PFD_VALUES, altitudeFeet: 3000 };
		state.rendered = { ...DEFAULT_PFD_VALUES, altitudeFeet: 3000.01 };
		const moved = state.step(1 / 60);
		expect(moved).toBe(false);
		expect(state.rendered.altitudeFeet).toBe(3000);
	});

	it('re-arms after a target write', () => {
		const state = new PfdTickState();
		// Defaults are already at target: state should be quiescent on the
		// first step, no iteration needed.
		expect(state.step(1 / 60)).toBe(false);

		state.target = { ...state.target, airspeedKnots: state.target.airspeedKnots + 25 };
		expect(state.step(1 / 60)).toBe(true);
	});

	it('isQuiescent reports correct boundary at the heading wrap', () => {
		const state = new PfdTickState();
		// Place rendered just past 0 with target just below 360 -- the raw
		// difference is 359.99, but the shortest-arc difference is 0.01 (well
		// inside the heading epsilon of 0.05).
		state.rendered = { ...state.rendered, headingDeg: 0.005 };
		state.target = { ...state.target, headingDeg: 359.995 };
		expect(state.isQuiescent()).toBe(true);
	});
});
