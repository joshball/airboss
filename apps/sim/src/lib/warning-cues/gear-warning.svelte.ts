/**
 * Gear warning horn. Continuous pulsed tone, driven by the BC
 * `shouldSoundGearWarning` predicate. For the Phase 0.5 C172 the predicate
 * is wired with `gearDown: true` (fixed gear) so the cue never fires today;
 * retractable airframes will pass `gearDown` from their own state.
 *
 * Lifecycle mirrors `StallHorn`: gesture-started AudioContext, shared mute
 * flag, stops on scenario outcome, caption pushed to `captionStore` while
 * active.
 */

import { SIM_GEAR_WARNING, SIM_WARNING_CUES } from '@ab/constants';
import { captionStore } from './audio-captions.svelte';
import { getAudioContextCtor } from './shared';

export class GearWarning {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private pulseOsc: OscillatorNode | null = null;
	private masterGain: GainNode | null = null;
	private active = false;
	private muted = false;
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
			const master = ctx.createGain();
			master.gain.value = 0;
			master.connect(ctx.destination);

			const osc = ctx.createOscillator();
			osc.type = 'square';
			osc.frequency.value = SIM_GEAR_WARNING.CARRIER_HZ;

			const pulseGain = ctx.createGain();
			pulseGain.gain.value = 0.5;
			const pulseLfo = ctx.createOscillator();
			pulseLfo.type = 'square';
			pulseLfo.frequency.value = SIM_GEAR_WARNING.PULSE_HZ;
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
			captionStore.show(SIM_WARNING_CUES.GEAR_WARNING);
		} else {
			captionStore.hide(SIM_WARNING_CUES.GEAR_WARNING);
		}
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		this.applyGain();
	}

	/** Stop for scenario outcome. Ramps gain to 0 and drops the caption. */
	stop(): void {
		this.setActive(false);
	}

	private applyGain(): void {
		if (!this.ctx || !this.masterGain) return;
		const target = this.active && !this.muted ? SIM_GEAR_WARNING.GAIN : 0;
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
