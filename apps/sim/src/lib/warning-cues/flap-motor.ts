/**
 * Flap motor cue. A lowpassed noise + saw-tooth carrier that simulates the
 * mechanical whirr of the flap motor. Phase 0.5 flaps are instantaneous-
 * detent, so each commanded change kicks the motor cue for a fixed duration
 * (`SIM_FLAP_MOTOR.DURATION_MS`). Phase 6 continuous-flap modeling will
 * replace the timer with `motorRunning` driven by actual surface travel.
 */

import { SIM_FLAP_MOTOR, SIM_WARNING_CUES } from '@ab/constants';
import { captionStore } from './audio-captions.svelte';
import { getAudioContextCtor } from './shared';

export class FlapMotor {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private noiseSource: AudioBufferSourceNode | null = null;
	private masterGain: GainNode | null = null;
	private muted = false;
	private started = false;
	private runTimer: ReturnType<typeof setTimeout> | null = null;

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
			const master = ctx.createGain();
			master.gain.value = 0;
			master.connect(ctx.destination);

			// Sawtooth carrier at motor RPM frequency.
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.value = SIM_FLAP_MOTOR.CARRIER_HZ;
			const oscGain = ctx.createGain();
			oscGain.gain.value = 0.5;
			osc.connect(oscGain);
			oscGain.connect(master);

			// Lowpassed noise for the gear-train hiss.
			const noiseBuffer = makeNoiseBuffer(ctx);
			const noiseSource = ctx.createBufferSource();
			noiseSource.buffer = noiseBuffer;
			noiseSource.loop = true;
			const noiseFilter = ctx.createBiquadFilter();
			noiseFilter.type = 'lowpass';
			noiseFilter.frequency.value = SIM_FLAP_MOTOR.NOISE_LOWPASS_HZ;
			const noiseGain = ctx.createGain();
			noiseGain.gain.value = 0.5;
			noiseSource.connect(noiseFilter);
			noiseFilter.connect(noiseGain);
			noiseGain.connect(master);

			osc.start();
			noiseSource.start();

			this.ctx = ctx;
			this.osc = osc;
			this.noiseSource = noiseSource;
			this.masterGain = master;
			this.started = true;
		} catch {
			this.started = false;
		}
	}

	/** Called when a commanded flap-detent change is observed. */
	trigger(): void {
		if (this.runTimer !== null) {
			clearTimeout(this.runTimer);
		}
		this.applyGain(true);
		captionStore.show(SIM_WARNING_CUES.FLAP_MOTOR);
		this.runTimer = setTimeout(() => {
			this.applyGain(false);
			captionStore.hide(SIM_WARNING_CUES.FLAP_MOTOR);
			this.runTimer = null;
		}, SIM_FLAP_MOTOR.DURATION_MS);
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		// If currently running but user muted, drop the gain immediately. On
		// unmute while running, the timer will restore on next run.
		if (muted) this.applyGain(false);
	}

	/** Stop for scenario outcome. Cancels any in-flight motor run. */
	stop(): void {
		if (this.runTimer !== null) {
			clearTimeout(this.runTimer);
			this.runTimer = null;
		}
		this.applyGain(false);
		captionStore.hide(SIM_WARNING_CUES.FLAP_MOTOR);
	}

	private applyGain(running: boolean): void {
		if (!this.ctx || !this.masterGain) return;
		const target = running && !this.muted ? SIM_FLAP_MOTOR.GAIN : 0;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(target, now, 0.05);
	}

	destroy(): void {
		if (this.runTimer !== null) {
			clearTimeout(this.runTimer);
			this.runTimer = null;
		}
		try {
			this.osc?.stop();
			this.noiseSource?.stop();
		} catch {
			// ignore double-stop
		}
		this.osc = null;
		this.noiseSource = null;
		this.masterGain = null;
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.started = false;
	}
}

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
