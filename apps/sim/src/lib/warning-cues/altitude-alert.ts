/**
 * Altitude-alert cue. Single-shot tone that fires when the aircraft crosses
 * `target - SIM_ALTITUDE_ALERT.LEAD_FEET` in either direction. The target is
 * set via `setTarget(feet | null)`; the caller feeds snapshots via
 * `observeAltitude(feet)` which delegates the crossing detection to the BC
 * `altitudeAlertCrossed` pure function.
 *
 * Phase 4 scenario work wires `setTarget` from scripted scenarios (cleared
 * altitudes, step-downs). Today's scenarios do not call it, so the cue is
 * wired but silent.
 */

import { altitudeAlertCrossed } from '@ab/bc-sim';
import { SIM_ALTITUDE_ALERT, SIM_WARNING_CUES } from '@ab/constants';
import { captionStore } from './audio-captions.svelte';
import { getAudioContextCtor } from './shared';

export class AltitudeAlert {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private masterGain: GainNode | null = null;
	private muted = false;
	private started = false;
	private stoppedScenario = false;
	private targetFt: number | null = null;
	private lastAltitudeFt: number | null = null;
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
			osc.type = 'sine';
			osc.frequency.value = SIM_ALTITUDE_ALERT.CARRIER_HZ;
			osc.connect(master);
			osc.start();

			this.ctx = ctx;
			this.osc = osc;
			this.masterGain = master;
			this.started = true;
		} catch {
			this.started = false;
		}
	}

	/**
	 * Set a new altitude target (feet MSL). Pass null to disarm.
	 *
	 * On a fresh arm (previous target was null and the new target is a
	 * number) we fire the cue once as an arming confirmation -- this
	 * mirrors a real altitude-alerter's "ding" when you dial in a new
	 * cleared altitude. Re-arming to the same value or changing between
	 * two non-null targets does NOT pulse, since those are mid-clearance
	 * adjustments rather than a fresh acknowledgement.
	 */
	setTarget(feet: number | null): void {
		const wasDisarmed = this.targetFt === null;
		this.targetFt = feet;
		this.lastAltitudeFt = null;
		if (wasDisarmed && feet !== null && !this.stoppedScenario) {
			this.fire();
		}
	}

	/** Feed a fresh altitude sample (feet MSL). Fires the tone on threshold crossings. */
	observeAltitude(feet: number): void {
		if (this.stoppedScenario) return;
		if (this.targetFt === null) {
			this.lastAltitudeFt = feet;
			return;
		}
		if (this.lastAltitudeFt === null) {
			this.lastAltitudeFt = feet;
			return;
		}
		const crossed = altitudeAlertCrossed(this.lastAltitudeFt, feet, this.targetFt, SIM_ALTITUDE_ALERT.LEAD_FEET);
		this.lastAltitudeFt = feet;
		if (crossed) this.fire();
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
		this.lastAltitudeFt = null;
	}

	private fire(): void {
		if (this.muted) return;
		if (!this.ctx || !this.masterGain) return;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(SIM_ALTITUDE_ALERT.GAIN, now, 0.01);
		captionStore.show(SIM_WARNING_CUES.ALTITUDE_ALERT);
		if (this.pulseTimer !== null) clearTimeout(this.pulseTimer);
		this.pulseTimer = setTimeout(() => {
			this.silenceImmediately();
			captionStore.hide(SIM_WARNING_CUES.ALTITUDE_ALERT);
			this.pulseTimer = null;
		}, SIM_ALTITUDE_ALERT.DURATION_MS);
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
		} catch {
			// ignore double-stop
		}
		this.osc = null;
		this.masterGain = null;
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.started = false;
	}
}
