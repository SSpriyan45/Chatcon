// Web Audio API synthesized sounds (no external file dependencies)
class SoundManager {
  private ctx: AudioContext | null = null;
  private ringOscillator: OscillatorNode | null = null;
  private ringOscillator2: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private isRinging = false;
  private ringInterval: NodeJS.Timeout | null = null;

  private getContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playSent() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted
    }
  }

  playReact() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.07); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio context might be restricted
    }
  }

  playReceived() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.06); // G5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio context might be restricted
    }
  }

  playSend() {
    this.playSent();
  }

  playReceive() {
    this.playReceived();
  }

  playConnected() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // Audio context might be restricted
    }
  }

  playBusy() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, ctx.currentTime);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Ignore
    }
  }

  playMissedCall() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.12); // A4
      osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.24); // F4

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {
      // Ignore
    }
  }

  playCallAlert() {
    try {
      const ctx = this.getContext();
      const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.14);
      });
    } catch {
      // Ignore
    }
  }

  startRingtone(melody: 'modern' | 'classic' | 'gentle' = 'modern') {
    if (this.isRinging) return;
    this.isRinging = true;

    // Trigger mobile vibration pattern
    this.vibrate([400, 200, 400, 200, 400, 200, 1000]);
    this.ringInterval = setInterval(() => {
      if (this.isRinging) {
        this.vibrate([400, 200, 400, 200, 400, 200, 1000]);
      }
    }, 2800);

    try {
      const ctx = this.getContext();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      if (melody === 'classic') {
        // Dual-tone traditional telephone ring (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(2.5, ctx.currentTime); // 2.5Hz cadence
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.14, ctx.currentTime);
        lfo.connect(lfoGain.gain);
        lfo.start();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();

        this.ringOscillator = osc1;
        this.ringOscillator2 = osc2;
        this.lfo = lfo;
      } else if (melody === 'gentle') {
        // Soft warm marimba pulse (523Hz C5)
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(1.8, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.12, ctx.currentTime);
        lfo.connect(gain.gain);
        lfo.start();

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        this.ringOscillator = osc;
        this.lfo = lfo;
      } else {
        // Modern melodious ringtone (440Hz with harmonic pulse)
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(2.2, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.12, ctx.currentTime);
        lfo.connect(gain.gain);
        lfo.start();

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        this.ringOscillator = osc;
        this.lfo = lfo;
      }

      this.ringGain = gain;
    } catch {
      // Audio context might be restricted
    }
  }

  stopRingtone() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    this.vibrate(0);

    try {
      if (this.ringOscillator) {
        this.ringOscillator.stop();
        this.ringOscillator.disconnect();
        this.ringOscillator = null;
      }
      if (this.ringOscillator2) {
        this.ringOscillator2.stop();
        this.ringOscillator2.disconnect();
        this.ringOscillator2 = null;
      }
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfo = null;
      }
      if (this.ringGain) {
        this.ringGain.disconnect();
        this.ringGain = null;
      }
    } catch {
      // Ignore
    }
  }

  vibrate(pattern: number | number[]) {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore unsupported platforms
    }
  }

  playKeypress() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Ignore
    }
  }

  playUnlock() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.07); // G5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.09);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.3);
      this.vibrate([30, 40, 60]);
    } catch {
      // Ignore
    }
  }

  playError() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.18);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
      this.vibrate([80, 50, 80]);
    } catch {
      // Ignore
    }
  }
}

export const soundManager = new SoundManager();
