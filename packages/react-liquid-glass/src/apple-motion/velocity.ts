/**
 * The velocity a released pointer hands to the glass: the least-squares slope of its recent
 * positions, in units per second. A release that arrives a fraction of a millisecond after the
 * last move, as it often does at the end of a flick, cannot turn into a huge velocity, and a
 * pointer held still before release has none.
 */
export function createVelocityTracker(windowMs = 100, limit = 4000) {
  const samples: Array<{ time: number; value: number }> = [];
  return {
    reset() { samples.length = 0; },
    push(value: number, time = performance.now()) {
      samples.push({ time, value });
      while (samples.length > 2 && time - samples[0].time > windowMs) samples.shift();
    },
    velocity(now = performance.now()) {
      const recent = samples.filter(sample => now - sample.time <= windowMs);
      if (recent.length < 2 || recent[recent.length - 1].time - recent[0].time < 8) return 0;
      const meanTime = recent.reduce((sum, sample) => sum + sample.time, 0) / recent.length;
      const meanValue = recent.reduce((sum, sample) => sum + sample.value, 0) / recent.length;
      let covariance = 0, variance = 0;
      for (const sample of recent) {
        covariance += (sample.time - meanTime) * (sample.value - meanValue);
        variance += (sample.time - meanTime) ** 2;
      }
      const velocity = variance > 0 ? covariance / variance * 1000 : 0;
      return Math.max(-limit, Math.min(limit, velocity));
    },
  };
}
