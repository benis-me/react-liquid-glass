/**
 * How far glass pulled `distance` past its end follows, against resistance that rises as it goes,
 * as a scroll view's edge does: it moves by `resistance` of the pull at first and never reaches
 * `limit`. Signed like `distance`.
 */
export function elasticReach(distance: number, limit: number, resistance: number) {
  if (limit <= 0) return 0;
  return Math.sign(distance) * limit * (1 - 1 / (1 + resistance * Math.abs(distance) / limit));
}
