/**
 * Utility for audio and haptic feedback on successful barcode/QR scans.
 * Uses the Web Audio API for lightweight, offline chime generation
 * and the Navigator Vibration API for mobile haptic pulses.
 */

/**
 * Plays a pleasant two-tone confirmation chime using the Web Audio API.
 * Frequency progression: 587.33 Hz (D5) -> 880.00 Hz (A5)
 */
export function playScanSuccessSound(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First tone (D5 - mid chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Second tone (A5 - higher cheerful chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.07);
    gain2.gain.setValueAtTime(0.16, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.22);

    // Dispose context after audio completes
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 300);
  } catch {
    // Silently ignore environments blocking autoplay audio
  }
}

/**
 * Triggers physical vibration on devices that support the Vibration API.
 * Default pattern: two short crisp pulses.
 */
export function triggerHapticFeedback(pattern: number | number[] = [40, 30, 45]): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently ignore if not permitted
  }
}

/**
 * Fires both audio chime and haptic feedback on successful scan.
 */
export function playScanSuccessFeedback(): void {
  playScanSuccessSound();
  triggerHapticFeedback();
}

