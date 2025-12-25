import { LIMITS } from '../constants/gameConfig';

export function isValidParticipantName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.trim().length <= 50
  );
}

export function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

export function sanitizeParticipantName(name: string): string {
  return name.trim().slice(0, 50);
}

export function canAddParticipant(currentParticipantCount: number): boolean {
  return currentParticipantCount < LIMITS.MAX_PARTICIPANTS;
}

export function isValidSongDuration(duration: number): boolean {
  return duration >= LIMITS.MIN_SONG_DURATION;
}
