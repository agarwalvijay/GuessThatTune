import { SCORE_CALCULATION } from '../constants/gameConfig';

/**
 * Calculate score based on time elapsed since song started
 * Formula: max(0, BASE_SCORE - floor(elapsedSeconds))
 */
export function calculateScore(elapsedSeconds: number): number {
  const { BASE_SCORE, MIN_SCORE } = SCORE_CALCULATION;
  const score = BASE_SCORE - Math.floor(elapsedSeconds);
  return Math.max(MIN_SCORE, score);
}

/**
 * Calculate random start offset for a song
 * Avoids first and last 20% of the song
 */
export function getRandomStartOffset(durationSeconds: number): number {
  const safeStart = durationSeconds * 0.2;
  const safeEnd = durationSeconds * 0.8;
  const randomPoint = Math.random() * (safeEnd - safeStart) + safeStart;
  return Math.floor(randomPoint);
}
