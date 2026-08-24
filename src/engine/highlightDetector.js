// ═══════════════════════════════════════════════════════════════
// Highlight Detector — suggests the "best" export window from the
// waveform's energy envelope (the same 200-bar data used by the
// scrubber, from waveform.worker.js).
//
// This is a heuristic, not music understanding: it has no notion of
// melody, chorus, or lyrics. It looks for a sustained-loud, dynamic
// window that starts right on a rise in energy — mirroring the same
// "fast/local average vs slower baseline" idea the live beat detector
// uses (see App.jsx), just applied at bar resolution instead of
// per-frame, to find macro transitions instead of individual beats.
// ═══════════════════════════════════════════════════════════════

/**
 * @param {number[]} bars - normalized energy envelope (0..1), e.g. waveformData
 * @param {number} audioDuration - total track duration in seconds
 * @param {number} windowDuration - desired highlight length in seconds
 * @returns {{ start: number, end: number, score: number } | null}
 */
export function findBestHighlight(bars, audioDuration, windowDuration) {
  if (!Array.isArray(bars) || bars.length < 4 || !audioDuration || !windowDuration) return null;

  const N = bars.length;
  const secondsPerBar = audioDuration / N;
  const windowBars = Math.max(2, Math.round(windowDuration / secondsPerBar));

  // Window covers (almost) the whole track — nothing meaningful to pick.
  if (windowBars >= N) return { start: 0, end: audioDuration, score: 0 };

  // Per-bar "onset strength": how much louder this bar is than the local
  // baseline just before it. High onset = a rise/transition starting here.
  const baselineSpan = Math.max(3, Math.round(windowBars / 4));
  const onset = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let sum = 0, count = 0;
    for (let k = 1; k <= baselineSpan; k++) {
      if (i - k >= 0) { sum += bars[i - k]; count++; }
    }
    const baseline = count ? sum / count : bars[i];
    onset[i] = Math.max(0, bars[i] - baseline);
  }

  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i <= N - windowBars; i++) {
    let sum = 0, sumSq = 0;
    for (let j = i; j < i + windowBars; j++) {
      sum += bars[j];
      sumSq += bars[j] * bars[j];
    }
    const mean = sum / windowBars;
    const variance = Math.max(0, sumSq / windowBars - mean * mean);
    const stdDev = Math.sqrt(variance);

    // Sustained loudness + internal movement (not a flat wall of sound)
    // + bonus for starting right as the energy rises, so the cut lands
    // on a transition instead of mid-phrase.
    const score = mean * 1.0 + stdDev * 0.6 + onset[i] * 1.2;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const start = Math.max(0, bestIdx * secondsPerBar);
  const end = Math.min(audioDuration, start + windowDuration);
  return { start, end, score: bestScore };
}
