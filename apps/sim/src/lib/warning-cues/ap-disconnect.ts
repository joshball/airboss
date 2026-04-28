/**
 * Autopilot disconnect cue. Rapid pulsed tone for `SIM_AP_DISCONNECT.DURATION_MS`
 * whenever the AP is kicked off by the pilot, trim-runaway detection, or a
 * servo fault.
 *
 * The sim has no AP model yet; the cockpit exposes `firePilotDisconnect()`
 * which is scaffolded for the Phase 4 autopilot work. Today's scenarios
 * never call it, so the cue is wired but silent.
 */

import { SIM_AP_DISCONNECT, SIM_WARNING_CUES } from '@ab/constants';
import { captionStore } from './audio-captions.svelte';
import { getAudioContextCtor } from './shared';

export class ApDisconnect {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private pulseOsc: OscillatorNode | null = null;
	private masterGain: GainNode | null = null;
	private muted = false;
	private started = false;
	private stoppedScenario = false;
	private pulseTimer: ReturnType<typeof setTimeout> | null = null;

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
			osc.frequency.value = SIM_AP_DISCONNECT.CARRIER_HZ;

			const pulseGain = ctx.createGain();
			pulseGain.gain.value = 0.5;
			const pulseLfo = ctx.createOscillator();
			pulseLfo.type = 'square';
			pulseLfo.frequency.value = SIM_AP_DISCONNECT.PULSE_HZ;
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
			this.started = false;
		}
	}

	/** Scaffolded trigger for Phase 4 autopilot work. Fires the disconnect tone. */
	firePilotDisconnect(): void {
		if (this.stoppedScenario) return;
		if (this.muted) return;
		if (!this.ctx || !this.masterGain) return;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(SIM_AP_DISCONNECT.GAIN, now, 0.01);
		captionStore.show(SIM_WARNING_CUES.AP_DISCONNECT);
		if (this.pulseTimer !== null) clearTimeout(this.pulseTimer);
		this.pulseTimer = setTimeout(() => {
			this.silenceImmediately();
			captionStore.hide(SIM_WARNING_CUES.AP_DISCONNECT);
			this.pulseTimer = null;
		}, SIM_AP_DISCONNECT.DURATION_MS);
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		if (muted) this.silenceImmediately();
	}

	/** Stop for scenario outcome. */
	stop(): void {
		this.stoppedScenario = true;
		this.silenceImmediately();
	}

	/** Resume after a reset. */
	resume(): void {
		this.stoppedScenario = false;
	}

	private silenceImmediately(): void {
		if (!this.ctx || !this.masterGain) return;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(0, now, 0.02);
	}

	destroy(): void {
		if (this.pulseTimer !== null) {
			clearTimeout(this.pulseTimer);
			this.pulseTimer = null;
		}
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
