/**
 * Procedural engine sound via Web Audio.
 *
 * The synth models a 4-cylinder 4-stroke engine + 2-blade prop at the
 * level of detail a training-grade sim needs: low fundamental at the
 * exhaust firing rate, an odd-harmonic stack with 1/N rolloff for the
 * pulse train, a separate prop-blade-pass tone that overlays the
 * propeller "whip" you hear from the cockpit, a slow tremolo modulator
 * (the cylinder-to-cylinder envelope variation real engines have), a
 * bandpass formant centred on the engine compartment resonance, and a
 * throttle-tied noise source for wind + exhaust burble.
 *
 * The earlier two-oscillator synth (sawtooth fundamental + triangle
 * harmonic + lowpass noise) sounded right in the same way an Atari
 * sounds like a car -- recognisable, but not believable. This version
 * trades the simplest-possible recipe for one whose ear-test passes.
 *
 * Pure audio-parameter math lives in `@ab/bc-sim` (`audio-mapping.ts`)
 * so it's testable without a DOM AudioContext.
 *
 * Lifecycle mirrors `StallHorn`:
 * - AudioContext is created on the first user gesture (iOS/Safari locked).
 * - `update(snapshot, idleRpm)` ramps parameters smoothly toward targets.
 * - `setMuted(muted)` shares the cockpit's mute toggle with the stall horn.
 * - `stop()` ramps the master gain to 0 (used at scenario outcome).
 * - `destroy()` tears down oscillators and the context on unmount.
 */

import {
	engineFiringHz,
	noiseGainTarget,
	propBladePassHz,
	strainDetuneCents,
	throttleGainTarget,
	tremoloHz,
} from '@ab/bc-sim';
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

/**
 * Harmonic stack of the firing-rate fundamental. Odd harmonics
 * dominate (sawtooth-like exhaust pulses); a small amount of even-2
 * adds body. Amplitudes follow 1/N for the natural pulse-train rolloff.
 */
const HARMONICS: ReadonlyArray<{ ratio: number; gain: number }> = [
	{ ratio: 1, gain: 1.0 },
	{ ratio: 2, gain: 0.35 },
	{ ratio: 3, gain: 0.55 },
	{ ratio: 5, gain: 0.3 },
	{ ratio: 7, gain: 0.18 },
];

/** Bandpass centre frequency (Hz) modelling the engine-compartment formant. */
const FORMANT_HZ = 280;
const FORMANT_Q = 1.4;
/** Tremolo depth (linear gain swing). 0.12 = +/- 1 dB modulation. */
const TREMOLO_DEPTH = 0.12;

export class EngineSound {
	private ctx: AudioContext | null = null;
	private oscs: OscillatorNode[] = [];
	private propOsc: OscillatorNode | null = null;
	private noiseSource: AudioBufferSourceNode | null = null;
	private noiseFilter: BiquadFilterNode | null = null;
	private noiseGain: GainNode | null = null;
	private throttleGain: GainNode | null = null;
	private masterGain: GainNode | null = null;
	private tremoloOsc: OscillatorNode | null = null;
	private muted = false;
	private stopped = false;
	private started = false;

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

			// Output chain: harmonic stack + prop -> formant -> tremolo
			//                                                    -> throttleGain -> masterGain -> destination.
			const master = ctx.createGain();
			master.gain.value = this.muted || this.stopped ? 0 : SIM_ENGINE_SOUND.MASTER_GAIN;
			master.connect(ctx.destination);

			const throttle = ctx.createGain();
			throttle.gain.value = SIM_ENGINE_SOUND.THROTTLE_GAIN_OFFSET;
			throttle.connect(master);

			// Tremolo: a low-frequency oscillator modulates a gain stage so
			// the master rides up and down at the cylinder-to-cylinder
			// burble rate. Depth sets the swing magnitude.
			const tremoloGainNode = ctx.createGain();
			tremoloGainNode.gain.value = 1;
			tremoloGainNode.connect(throttle);

			const tremoloOsc = ctx.createOscillator();
			tremoloOsc.type = 'sine';
			tremoloOsc.frequency.value = 6;
			const tremoloDepth = ctx.createGain();
			tremoloDepth.gain.value = TREMOLO_DEPTH;
			tremoloOsc.connect(tremoloDepth);
			tremoloDepth.connect(tremoloGainNode.gain);

			// Engine compartment formant: a peaking bandpass at FORMANT_HZ.
			const formant = ctx.createBiquadFilter();
			formant.type = 'bandpass';
			formant.frequency.value = FORMANT_HZ;
			formant.Q.value = FORMANT_Q;
			formant.connect(tremoloGainNode);

			// Harmonic stack: one oscillator per harmonic ratio, summed at
			// `formant`. We use sawtooth on the fundamental to capture the
			// exhaust pulse-train shape, sine on harmonics so the stack
			// stays clean rather than buzzing.
			const oscs: OscillatorNode[] = [];
			for (let i = 0; i < HARMONICS.length; i += 1) {
				const spec = HARMONICS[i];
				const osc = ctx.createOscillator();
				osc.type = i === 0 ? 'sawtooth' : 'sine';
				osc.frequency.value = SIM_ENGINE_SOUND.BASE_FREQ_HZ * spec.ratio;
				const gain = ctx.createGain();
				gain.gain.value = spec.gain;
				osc.connect(gain);
				gain.connect(formant);
				osc.start();
				oscs.push(osc);
			}

			// Prop blade-pass tone: a separate sub-saw at the prop's blade-
			// pass frequency, which the cockpit hears as the propeller's
			// "whip" overlay on the engine note. Sub-saw at half-amplitude
			// keeps it perceptible without overpowering the harmonics.
			const propOsc = ctx.createOscillator();
			propOsc.type = 'sawtooth';
			propOsc.frequency.value = SIM_ENGINE_SOUND.BASE_FREQ_HZ;
			const propGainNode = ctx.createGain();
			propGainNode.gain.value = 0.3;
			propOsc.connect(propGainNode);
			propGainNode.connect(formant);
			propOsc.start();

			// Noise: looped white-noise lowpassed; cutoff sweeps with throttle
			// so wind grows with airspeed (existing semantic, preserved).
			const noiseBuffer = makeNoiseBuffer(ctx);
			const noiseSource = ctx.createBufferSource();
			noiseSource.buffer = noiseBuffer;
			noiseSource.loop = true;
			const noiseFilter = ctx.createBiquadFilter();
			noiseFilter.type = 'lowpass';
			noiseFilter.frequency.value = SIM_ENGINE_SOUND.NOISE_LOWPASS_HZ;
			const noiseGainNode = ctx.createGain();
			noiseGainNode.gain.value = 0;
			noiseSource.connect(noiseFilter);
			noiseFilter.connect(noiseGainNode);
			noiseGainNode.connect(throttle);

			noiseSource.start();
			tremoloOsc.start();

			this.ctx = ctx;
			this.oscs = oscs;
			this.propOsc = propOsc;
			this.noiseSource = noiseSource;
			this.noiseFilter = noiseFilter;
			this.noiseGain = noiseGainNode;
			this.throttleGain = throttle;
			this.masterGain = master;
			this.tremoloOsc = tremoloOsc;
			this.started = true;
		} catch {
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

	stop(): void {
		this.stopped = true;
		this.applyMasterGain();
	}

	resume(): void {
		this.stopped = false;
		this.applyMasterGain();
	}

	/**
	 * Apply a new snapshot. Parameters ramp smoothly to the target values
	 * over RAMP_TAU_SECONDS; call at the snapshot rate (30-60 Hz).
	 */
	update(snapshot: EngineSoundSnapshot, idleRpm: number, maxRpm = 2700): void {
		if (!this.ctx || this.oscs.length === 0 || !this.propOsc || !this.throttleGain || !this.noiseGain) {
			return;
		}
		const now = this.ctx.currentTime;
		const tau = SIM_ENGINE_SOUND.RAMP_TAU_SECONDS;

		// Firing-rate fundamental drives the harmonic stack; prop blade-
		// pass overlays at its own frequency. At idle RPM=800 the firing
		// rate is ~27 Hz; we shift the stack up by a fixed factor so the
		// audible note sits in a useful range without changing the
		// harmonic relationships.
		const f0 = engineFiringHz(snapshot.rpm) * AUDIBLE_SHIFT;
		const blade = propBladePassHz(snapshot.rpm) * AUDIBLE_SHIFT;
		const detune = strainDetuneCents(snapshot.alphaRad, snapshot.throttle);

		for (let i = 0; i < this.oscs.length; i += 1) {
			const osc = this.oscs[i];
			const ratio = HARMONICS[i].ratio;
			osc.frequency.setTargetAtTime(f0 * ratio, now, tau);
			// Strain detune fades the higher harmonics under climb-strain so
			// the engine sounds laboured rather than bright.
			osc.detune.setTargetAtTime(i === 0 ? 0 : detune, now, tau);
		}
		this.propOsc.frequency.setTargetAtTime(blade, now, tau);

		// Tremolo rate rises with RPM.
		this.tremoloOsc?.frequency.setTargetAtTime(tremoloHz(snapshot.rpm, idleRpm, maxRpm), now, tau);

		// Throttle gain: floor + slope.
		this.throttleGain.gain.setTargetAtTime(throttleGainTarget(snapshot.throttle), now, tau);

		// Noise level ramps with dynamic pressure.
		this.noiseGain.gain.setTargetAtTime(noiseGainTarget(snapshot.trueAirspeed), now, tau);

		// Noise lowpass cutoff opens with throttle (more wind / exhaust
		// burble at full power, calmer at idle).
		if (this.noiseFilter) {
			const cutoff = SIM_ENGINE_SOUND.NOISE_LOWPASS_HZ * (0.5 + snapshot.throttle * 1.5);
			this.noiseFilter.frequency.setTargetAtTime(cutoff, now, tau);
		}
	}

	destroy(): void {
		try {
			for (const osc of this.oscs) osc.stop();
			this.propOsc?.stop();
			this.noiseSource?.stop();
			this.tremoloOsc?.stop();
		} catch {
			// Ignore double-stop.
		}
		this.oscs = [];
		this.propOsc = null;
		this.noiseSource = null;
		this.noiseFilter = null;
		this.noiseGain = null;
		this.throttleGain = null;
		this.masterGain = null;
		this.tremoloOsc = null;
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

/**
 * Multiplier applied to the firing-rate fundamental + prop blade-pass
 * to lift the audible note from the ~27 Hz idle floor into a range
 * that perceptually reads as "an engine running." The actual exhaust
 * frequency for a 4-cylinder at 800 RPM is below the threshold of
 * pitch perception; what the cockpit hears is dominated by the body
 * formant + harmonic content. Shifting the stack up preserves the
 * RPM-tracking feel without losing low-end weight.
 */
const AUDIBLE_SHIFT = 2.2;

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
