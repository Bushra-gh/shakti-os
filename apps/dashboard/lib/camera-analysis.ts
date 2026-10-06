/** Mean RGB difference between two equally sized RGBA frames, normalized 0–1. */
export function frameChangeScore(
  previous: Uint8ClampedArray | null,
  current: Uint8ClampedArray,
): number {
  if (!previous || previous.length !== current.length || current.length < 4) return 0;

  let total = 0;
  let pixels = 0;
  for (let index = 0; index < current.length; index += 4) {
    total += Math.abs((current[index] ?? 0) - (previous[index] ?? 0));
    total += Math.abs((current[index + 1] ?? 0) - (previous[index + 1] ?? 0));
    total += Math.abs((current[index + 2] ?? 0) - (previous[index + 2] ?? 0));
    pixels += 1;
  }
  return pixels === 0 ? 0 : Math.min(1, total / (pixels * 3 * 255));
}
