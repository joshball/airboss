/**
 * Procedural engine sound via Web Audio. Two-oscillator additive synth
 * (sawtooth fundamental + triangle harmonic at 2x) plus a lowpass-filtered
 * noise source for exhaust/wind. Fundamental frequency tracks engine RPM;
 * throttle scales master gain; high AoA at high throttle detunes the
 * harmonic to produce a climb-straining wobble. Dynamic pressure drives
 * noise level so the wind grows with airspeed.
 *
 * Lifecycle mirrors `StallHorn`:
 * - AudioContext is created on the first user gesture (iOS/Safari locked).
 * - `update(snapshot, idleRpm)` ramps parameters smoothly toward targets.
 * - `setMuted(muted)` shares the cockpit's mute toggle with the stall horn.
 * - `stop()` ramps the master gain to 0 (used at scenario outcome).
 * - `destroy()` tears down oscillators and the context on unmount.
 *
 * Pure audio-parameter math lives in `@ab/bc-sim` (`audio-mapping.ts`) so
 * it's testable without a DOM AudioContext.
 */

import { engineFundamentalHz, noiseGainTarget, strainDetuneCents, throttleGainTarget } from '@ab/bc-sim';
import { SIM_ENGINE_SOUND } from '@ab/constants';

interface WindowWithWebkit {
	AudioContext?: typeof AudioContext;
	webkitAudioContext?: typeof AudioContext;
}

function getAudioContextCtor(): typeof AudioContext | null {
	if (typeof window === 'undefined') return null;
	const win = window as unknown as WindowWithWebkit;
	return win.AudioContext ?? win.webkitAudioContext ?? null;
}

/** Snapshot fields the engine sound reads each update. */
export interface EngineSoundSnapshot {
	/** Throttle lever position 0..1. */
	throttle: number;
	/** Engine RPM. */
	rpm: number;
	/** Alpha (radians). Used for the strain-detune wobble at high AoA. */
	alphaRad: number;
	/** True airspeed (m/s), used to approximate dynamic pressure. */
	trueAirspeed: number;
}

export class EngineSound {
	private ctx: AudioContext | null = null;
	private osc1: OscillatorNode | null = null;
	private osc2: OscillatorNode | null = null;
	private noiseSource: AudioBufferSourceNode | null = null;
	private noiseGain: GainNode | null = null;
	private throttleGain: GainNode | null = null;
	private masterGain: GainNode | null = null;
	private muted = false;
	private stopped = false;
	private started = false;

	/** Must be called from a user gesture on first use (click / keydown). */
	ensureStarted(): void {
		if (this.started) {
			if (this.ctx && this.ctx.state === 'suspended') {
				void this.ctx.resume();
			}
			return;
		}
		const Ctor = getAudioContextCtor();
		if (!Ctor) return;
		try {
			const ctx = new Ctor();

			// Master output chain: throttleGain -> masterGain -> destination.
			const master = ctx.createGain();
			master.gain.value = this.muted || this.stopped ? 0 : SIM_ENGINE_SOUND.MASTER_GAIN;
			master.connect(ctx.destination);

			const throttle = ctx.createGain();
			throttle.gain.value = SIM_ENGINE_SOUND.THROTTLE_GAIN_OFFSET;
			throttle.connect(master);

			// OSC1: sawtooth fundamental, full level into the throttle bus.
			const osc1 = ctx.createOscillator();
			osc1.type = 'sawtooth';
			osc1.frequency.value = SIM_ENGINE_SOUND.BASE_FREQ_HZ;
			const osc1Gain = ctx.createGain();
			osc1Gain.gain.value = 1;
			osc1.connect(osc1Gain);
			osc1Gain.connect(throttle);

			// OSC2: triangle at 2x fundamental, harmonic (softer).
			const osc2 = ctx.createOscillator();
			osc2.type = 'triangle';
			osc2.frequency.value = SIM_ENGINE_SOUND.BASE_FREQ_HZ * 2;
			osc2.detune.value = 0;
			const osc2Gain = ctx.createGain();
			osc2Gain.gain.value = SIM_ENGINE_SOUND.HARMONIC_GAIN;
			osc2.connect(osc2Gain);
			osc2Gain.connect(throttle);

			// Noise: looped 2s white-noise buffer lowpassed to NOISE_LOWPASS_HZ.
			const noiseBuffer = makeNoiseBuffer(ctx);
			const noiseSource = ctx.createBufferSource();
			noiseSource.buffer = noiseBuffer;
			noiseSource.loop = true;
			const noiseFilter = ctx.createBiquadFilter();
			noiseFilter.type = 'lowpass';
			noiseFilter.frequency.value = SIM_ENGINE_SOUND.NOISE_LOWPASS_HZ;
			const noiseGain = ctx.createGain();
			noiseGain.gain.value = 0;
			noiseSource.connect(noiseFilter);
			noiseFilter.connect(noiseGain);
			noiseGain.connect(throttle);

			osc1.start();
			osc2.start();
			noiseSource.start();

			this.ctx = ctx;
			this.osc1 = osc1;
			this.osc2 = osc2;
			this.noiseSource = noiseSource;
			this.noiseGain = noiseGain;
			this.throttleGain = throttle;
			this.masterGain = master;
			this.started = true;
		} catch {
			// AudioContext creation can throw on locked browsers; ignore and
			// the engine simply won't sound.
			this.started = false;
		}
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		this.applyMasterGain();
	}

	isMuted(): boolean {
		return this.muted;
	}

	/** Stop the engine sound (scenario outcome). Ramps gain to 0. */
	stop(): void {
		this.stopped = true;
		this.applyMasterGain();
	}

	/** Resume after a reset. */
	resume(): void {
		this.stopped = false;
		this.applyMasterGain();
	}

	/**
	 * Apply a new snapshot. Parameters ramp smoothly to the target values
	 * over RAMP_TAU_SECONDS; call at the snapshot rate (30-60 Hz).
	 */
	update(snapshot: EngineSoundSnapshot, idleRpm: number): void {
		if (!this.ctx || !this.osc1 || !this.osc2 || !this.throttleGain || !this.noiseGain) {
			return;
		}
		const now = this.ctx.currentTime;
		const tau = SIM_ENGINE_SOUND.RAMP_TAU_SECONDS;

		// Fundamental + harmonic frequency.
		const f0 = engineFundamentalHz(snapshot.rpm, idleRpm);
		this.osc1.frequency.setTargetAtTime(f0, now, tau);
		this.osc2.frequency.setTargetAtTime(f0 * 2, now, tau);

		// Strain detune on OSC2 when climbing hard.
		this.osc2.detune.setTargetAtTime(strainDetuneCents(snapshot.alphaRad, snapshot.throttle), now, tau);

		// Throttle gain: floor + slope.
		this.throttleGain.gain.setTargetAtTime(throttleGainTarget(snapshot.throttle), now, tau);

		// Noise level ramps with dynamic pressure.
		this.noiseGain.gain.setTargetAtTime(noiseGainTarget(snapshot.trueAirspeed), now, tau);
	}

	destroy(): void {
		try {
			this.osc1?.stop();
			this.osc2?.stop();
			this.noiseSource?.stop();
		} catch {
			// Ignore double-stop.
		}
		this.osc1 = null;
		this.osc2 = null;
		this.noiseSource = null;
		this.noiseGain = null;
		this.throttleGain = null;
		this.masterGain = null;
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.started = false;
	}

	private applyMasterGain(): void {
		if (!this.ctx || !this.masterGain) return;
		const target = this.muted || this.stopped ? 0 : SIM_ENGINE_SOUND.MASTER_GAIN;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(target, now, SIM_ENGINE_SOUND.RAMP_TAU_SECONDS);
	}
}

/** 2 seconds of white noise, seeded from Math.random. Looped as the source. */
function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
	const seconds = 2;
	const sampleRate = ctx.sampleRate;
	const buffer = ctx.createBuffer(1, seconds * sampleRate, sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	return buffer;
}
