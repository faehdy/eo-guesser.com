import distance from "@turf/distance";
import { point } from "@turf/helpers";

/**
 * Calculates the Haversine distance in kilometres between two [lng, lat] points.
 */
export function calculateDistance(
  guess: [number, number],
  actual: [number, number]
): number {
  const from = point(guess);
  const to = point(actual);
  return distance(from, to, { units: "kilometers" });
}

/**
 * Exponential decay scoring (max 5 000 points).
 * Score ≈ 5 000 at 0–1 km, ≈ 0 at 10 000+ km.
 */
export function calculateScore(distanceKm: number): number {
  const maxScore = 5000;
  if (distanceKm <= 1) return maxScore;
  const score = maxScore * Math.exp(-distanceKm / 2000);
  return Math.max(0, Math.round(score));
}

/**
 * Formats a distance in a human-readable string.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${Math.round(distanceKm).toLocaleString()} km`;
}
