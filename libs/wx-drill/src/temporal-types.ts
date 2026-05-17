/**
 * `@ab/wx-drill` -- temporal-drill types.
 *
 * The temporal drill (`wx-scenario drill --temporal`) builds sequence-based
 * exercises over a v2 scenario's evolution window: "what changed between
 * these two METARs", "where did the TAF get it wrong", "which airport is
 * behind the front at 1800Z".
 *
 * These types are pure data; browser-safe. The exercise GENERATORS in
 * `temporal-drill.ts` are pure functions over a `TemporalDrillBundle`; the
 * server-only bundle BUILDER lives in `temporal-bundle.ts` (`./server`).
 */

import type { WxScenario } from '@ab/constants';

/** A METAR observed for one station at one timestamp inside the window. */
export interface TemporalMetar {
	/** Observation timestamp (UTC ISO). */
	at: string;
	/** Zulu hour label (`DDHHZ`). */
	zulu: string;
	station: string;
	raw: string;
}

/** A TAF as issued at one issue time. */
export interface TemporalTaf {
	/** Issue timestamp (UTC ISO). */
	issuedAt: string;
	/** Zulu label of the issue time. */
	issuedZulu: string;
	station: string;
	raw: string;
}

/** A front polyline at one snapshot instant. */
export interface TemporalFrontSnapshot {
	/** Front id (stable across the window). */
	id: string;
	/** `cold` / `warm` / `stationary` / `occluded`. */
	kind: string;
	/** The polyline vertices at this instant. */
	points: [number, number][];
	/** Cardinal side the pips face (the warm sector for a cold front). */
	pipSide: 'N' | 'S' | 'E' | 'W';
}

/** One snapshot of the evolving world: timestamp + front geometry. */
export interface TemporalSnapshot {
	at: string;
	zulu: string;
	fronts: TemporalFrontSnapshot[];
}

/** A station's fixed position, for the "which airport" spatial exercise. */
export interface TemporalStation {
	icao: string;
	lon: number;
	lat: number;
	name: string;
}

/**
 * The slim, serializable subset of one scenario's timeline bundle that the
 * pure temporal-drill generators consume. Built server-side by
 * `buildTemporalDrillBundle` (which runs the wx-engine), then handed to the
 * browser-safe generators.
 */
export interface TemporalDrillBundle {
	scenarioSlug: WxScenario;
	/** Human label for the scenario. */
	label: string;
	window: { start: string; end: string; stepMinutes: number };
	/** Every hourly METAR across every station. */
	metars: TemporalMetar[];
	/** Every TAF across every station + issue time. */
	tafs: TemporalTaf[];
	/** Front geometry per snapshot. */
	snapshots: TemporalSnapshot[];
	/** Station positions for the spatial exercise. */
	stations: TemporalStation[];
}

/** The three temporal exercise kinds. */
export type TemporalExerciseKind = 'sequence-change' | 'taf-vs-actuals' | 'front-position';

/** One generated temporal exercise. */
export interface TemporalExercise {
	index: number;
	kind: TemporalExerciseKind;
	scenarioSlug: WxScenario;
	/** The exercise prompt shown to the student. */
	prompt: string;
	/**
	 * The encoded-text products the prompt references, in display order.
	 * Each carries a label (`KICT 1500Z`) and the raw product text.
	 */
	products: { label: string; raw: string }[];
	/**
	 * Multiple-choice options. Exactly one is correct. Ordering is
	 * seed-shuffled so the correct answer is not always first.
	 */
	options: { text: string; correct: boolean }[];
	/** Truth-anchored explanation of the correct answer. */
	explanation: string;
}

/** A generated pack of temporal exercises. */
export interface TemporalDrillPack {
	generatedAt: string;
	seed: number;
	scenarioSlugs: WxScenario[];
	exercises: TemporalExercise[];
}
