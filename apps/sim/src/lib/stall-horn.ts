/**
 * Stall horn audio via Web Audio API. AudioContext is gesture-started
 * (Safari/iOS require a user gesture to resume). Tone is a square-ish
 * oscillator at the configured carrier frequency, pulsed at the pulse
 * rate via a square-wave gain envelope. Gain ramps up/down smoothly when
 * the horn triggers / silences so we never click.
 *
 * Public API:
 * - setActive(active): horn should be sounding.
 * - setMuted(muted): user mute toggle (persisted by the caller).
 * - ensureStarted(): resume the AudioContext on the first user gesture.
 * - destroy(): clean up everything.
 */

import { SIM_STALL_HORN, SIM_WARNING_CUES } from '@ab/constants';
import { captionStore } from './warning-cues/audio-captions.svelte';

interface WindowWithWebkit {
	AudioContext?: typeof AudioContext;
	webkitAudioContext?: typeof AudioContext;
}

function getAudioContextCtor(): typeof AudioContext | null {
	if (typeof window === 'undefined') return null;
	const win = window as unknown as WindowWithWebkit;
	return win.AudioContext ?? win.webkitAudioContext ?? null;
}

export class StallHorn {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private pulseOsc: OscillatorNode | null = null;
	private masterGain: GainNode | null = null;
	private active = false;
	private muted = false;
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
			const master = ctx.createGain();
			master.gain.value = 0;
			master.connect(ctx.destination);

			// Carrier oscillator.
			const osc = ctx.createOscillator();
			osc.type = 'square';
			osc.frequency.value = SIM_STALL_HORN.CARRIER_HZ;

			// Pulse: LFO -> gain -> master. LFO at PULSE_HZ drives a gain
			// between 0 and 1 so the carrier is gated on/off rapidly.
			const pulseGain = ctx.createGain();
			pulseGain.gain.value = 0.5;
			const pulseLfo = ctx.createOscillator();
			pulseLfo.type = 'square';
			pulseLfo.frequency.value = SIM_STALL_HORN.PULSE_HZ;
			const pulseAmp = ctx.createGain();
			pulseAmp.gain.value = 0.5;
			pulseLfo.connect(pulseAmp);
			pulseAmp.connect(pulseGain.gain);

			osc.connect(pulseGain);
			pulseGain.connect(master);

			osc.start();
			pulseLfo.start();

			this.ctx = ctx;
			this.osc = osc;
			this.pulseOsc = pulseLfo;
			this.masterGain = master;
			this.started = true;
		} catch {
			// AudioContext creation can throw on locked browsers; ignore and
			// the horn simply won't sound.
			this.started = false;
		}
	}

	setActive(active: boolean): void {
		if (this.active === active) return;
		this.active = active;
		this.applyGain();
		if (active && !this.muted) {
			captionStore.show(SIM_WARNING_CUES.STALL_WARNING);
		} else {
			captionStore.hide(SIM_WARNING_CUES.STALL_WARNING);
		}
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		this.applyGain();
	}

	isMuted(): boolean {
		return this.muted;
	}

	private applyGain(): void {
		if (!this.ctx || !this.masterGain) return;
		const target = this.active && !this.muted ? SIM_STALL_HORN.GAIN : 0;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(target, now, 0.03);
	}

	destroy(): void {
		try {
			this.osc?.stop();
			this.pulseOsc?.stop();
		} catch {
			// ignore double-stop
		}
		this.osc = null;
		this.pulseOsc = null;
		this.masterGain = null;
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.started = false;
	}
}
