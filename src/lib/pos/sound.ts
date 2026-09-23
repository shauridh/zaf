"use client";

/** Bunyi chime dua nada via WebAudio — tanpa file audio. */
export function playChime(volume = 0.35): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    gain.connect(ctx.destination);

    const notes = [880, 1174.66]; // A5, D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.18);
      osc.connect(gain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });

    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // audio tidak tersedia — abaikan
  }
}
