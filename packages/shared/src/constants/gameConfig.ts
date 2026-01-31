export const DEFAULT_GAME_SETTINGS = {
  songDuration: 30, // Play up to 30 seconds of each song
  maxScore: 60, // Maximum points per correct answer
  randomStartOffset: true, // Start songs at random positions
  negativePointsPercentage: 25, // Deduct 25% of potential points for wrong answers
} as const;

export const SCORE_CALCULATION = {
  BASE_SCORE: 60,
  MIN_SCORE: 0,
} as const;

export const TIMING = {
  BUZZER_RATE_LIMIT_MS: 1000, // Minimum time between buzzer presses
  SONG_SAFE_ZONE_START: 0.2, // Start random offset after 20% of song
  SONG_SAFE_ZONE_END: 0.8, // End random offset before last 20% of song
} as const;

export const LIMITS = {
  MAX_PARTICIPANTS: 50,
  MAX_SONGS_PER_GAME: 100,
  MIN_SONG_DURATION: 10, // Minimum song duration in seconds
} as const;
