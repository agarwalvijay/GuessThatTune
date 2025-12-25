// Client -> Server Events
export const CLIENT_EVENTS = {
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  BUZZER_PRESSED: 'buzzer_pressed',
} as const;

// Server -> Client Events
export const SERVER_EVENTS = {
  GAME_STATE_UPDATE: 'game_state_update',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  PARTICIPANT_RECONNECTED: 'participant_reconnected',
  BUZZER_EVENT: 'buzzer_event',
  SONG_STARTED: 'song_started',
  ROUND_ENDED: 'round_ended',
  SCORE_UPDATE: 'score_update',
  GAME_ENDED: 'game_ended',
  ERROR: 'error',
} as const;

export const SOCKET_EVENTS = {
  ...CLIENT_EVENTS,
  ...SERVER_EVENTS,
} as const;
