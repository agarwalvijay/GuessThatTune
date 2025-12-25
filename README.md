# Song Quiz Game

A multi-player music quiz game where a quiz master manages the game on a TV display while participants join via their phones to compete in identifying songs.

## Overview

- **Quiz Master App**: React Native (Expo) app for Android/iOS that manages the game, plays music, and tracks scores
- **Participant Web App**: React web app that participants use to join and play (buzzer button)
- **Backend**: Node.js + Express + Socket.io server for real-time communication and game state management

## Features

- **Spotify Integration** - Connect with Spotify Premium to use your playlists
- Browse and select songs from your Spotify playlists
- Automatic metadata from Spotify API (title, artist, album, artwork)
- QR code generation for easy participant joining
- Real-time buzzer system with server-side timing
- Scoring formula: 60 - seconds_elapsed
- Random song start points to increase difficulty
- Live leaderboard and score tracking
- Supports 50+ simultaneous participants
- Session-based authentication (only quiz master needs Spotify)

## Project Structure

```
SongGame/
├── packages/
│   ├── backend/              # Node.js + Express + Socket.io server
│   │   ├── src/
│   │   │   ├── config/       # Environment configuration
│   │   │   ├── controllers/  # Business logic (future)
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Game session & music services
│   │   │   ├── socket/       # Socket.io event handlers
│   │   │   ├── utils/        # QR code generation, etc.
│   │   │   └── server.ts     # Main server file
│   │   └── package.json
│   │
│   ├── quiz-master/          # React Native (Expo) quiz master app
│   │   ├── App.tsx           # Main app component
│   │   └── package.json
│   │
│   ├── participant-web/      # React web app for participants
│   │   ├── src/
│   │   └── package.json
│   │
│   └── shared/               # Shared TypeScript types & constants
│       ├── src/
│       │   ├── types/        # GameSession, Participant, Song, etc.
│       │   ├── constants/    # Socket events, game config
│       │   └── utils/        # Scoring, validation
│       └── package.json
│
├── package.json              # Root workspace configuration
└── tsconfig.json             # Base TypeScript config
```

## Prerequisites

- Node.js 18+ and npm
- Android device or emulator for Quiz Master app
- **Spotify Premium account** (for quiz master)
- Spotify Developer App credentials ([Setup Guide](./SPOTIFY_SETUP.md))

## Setup Instructions

### 1. Install Dependencies

```bash
# Install root dependencies and all workspace dependencies
npm install

# If using workspaces doesn't work, install individually:
cd packages/shared && npm install
cd ../backend && npm install
cd ../quiz-master && npm install
cd ../participant-web && npm install
```

### 2. Set Up Spotify (Optional - for now)

The backend is ready to work with Spotify! Authentication happens in the Quiz Master app (to be implemented).

See [Spotify Setup Guide](./SPOTIFY_SETUP.md) for details on:
- Creating a Spotify Developer App (needed for Quiz Master app)
- How the authentication flow works
- No backend configuration required!

### 3. Configure Environment Variables

**Backend** (`packages/backend/.env`):
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
WEB_APP_URL=http://192.168.1.100:5173  # Update to your local IP for QR codes
```

That's it! No Spotify credentials needed on the backend.

**Quiz Master** (`packages/quiz-master/.env`):
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3000  # Update to your backend IP
```

**Participant Web** (`packages/participant-web/.env`):
```env
VITE_BACKEND_URL=http://192.168.1.100:3000  # Update to your backend IP
```

### 3. Build Shared Package

```bash
cd packages/shared
npm run build
```

## Running the Application

### Development Mode

**Terminal 1 - Backend Server**:
```bash
cd packages/backend
npm run dev
```

The backend will start on `http://localhost:3000`

**Terminal 2 - Quiz Master App**:
```bash
cd packages/quiz-master
npm start
```

Then press:
- `a` for Android emulator
- Scan QR code with Expo Go app on physical device

**Terminal 3 - Participant Web App**:
```bash
cd packages/participant-web
npm run dev
```

The web app will start on `http://localhost:5173`

### Using the Monorepo Scripts

From the root directory, you can also run:

```bash
# Run backend dev server
npm run dev:backend

# Run quiz master app
npm run dev:quiz

# Run participant web app
npm run dev:web

# Run backend and web in parallel
npm run dev
```

## How to Play

### Quiz Master Setup

1. Start the Quiz Master app on your Android device
2. Connect your Spotify Premium account
3. Browse your Spotify playlists
4. Select a playlist to use for the quiz
5. Create a game session
6. Display the QR code on a TV (via HDMI or screen casting)

### Participants Join

1. Scan the QR code with their phone camera
2. Opens the participant web app
3. Enter their name
4. Wait in the lobby for the game to start

### Gameplay

1. Quiz master starts the game
2. A random song plays from a random start point
3. Participants press the buzzer button when they know the answer
4. Quiz master sees the buzzer queue (who buzzed first, second, etc.)
5. Quiz master asks participants for their answers
6. Quiz master selects the person who got it right
7. Points awarded: 60 - seconds_elapsed
8. Quiz master starts the next song
9. Repeat until all songs are complete
10. Final leaderboard displayed

## API Endpoints

### Game Management

- `POST /api/game/create` - Create new game session
- `GET /api/game/:sessionId` - Get game details
- `POST /api/game/:sessionId/start` - Start the game
- `POST /api/game/:sessionId/next` - Next song
- `POST /api/game/:sessionId/score` - Award points
- `POST /api/game/:sessionId/pause` - Pause game
- `POST /api/game/:sessionId/resume` - Resume game
- `DELETE /api/game/:sessionId` - End game

### Spotify Integration

All endpoints require `Authorization: Bearer {token}` header (token from Quiz Master app):

- `GET /api/spotify/playlists` - Get user's playlists
- `GET /api/spotify/playlist/:id/tracks` - Get tracks from playlist
- `GET /api/spotify/user` - Get current user profile

## Socket.io Events

### Client → Server

- `join_game` - Participant joins session
- `buzzer_pressed` - Participant presses buzzer
- `leave_game` - Participant leaves

### Server → Client

- `game_state_update` - Game state changed
- `participant_joined` - New participant joined
- `participant_left` - Participant left
- `buzzer_event` - Someone pressed buzzer
- `song_started` - New song started
- `round_ended` - Round complete
- `score_update` - Scores updated
- `game_ended` - Game finished

## Architecture Highlights

### Server-Side Timing

All timing is server-authoritative to prevent cheating:

```typescript
const elapsedSeconds = (buzzerTime - songStartTime) / 1000;
const score = Math.max(0, 60 - Math.floor(elapsedSeconds));
```

### Random Song Start Points

Songs start at random positions (avoiding first/last 20%):

```typescript
const safeStart = duration * 0.2;
const safeEnd = duration * 0.8;
const randomOffset = Math.random() * (safeEnd - safeStart) + safeStart;
```

### Security Features

- Crypto-secure session IDs (`crypto.randomUUID()`)
- Session-based Spotify authentication
- Secure token storage per game session
- Rate limiting on buzzer presses (1 per second)
- CORS whitelist configuration
- Input sanitization

## Building for Production

### Backend

```bash
cd packages/backend
npm run build
npm start
```

Or use Docker:

```bash
docker build -t song-quiz-backend ./packages/backend
docker run -p 3000:3000 song-quiz-backend
```

### Quiz Master Android APK

```bash
cd packages/quiz-master
npx eas build --platform android --profile production
```

### Participant Web App

```bash
cd packages/participant-web
npm run build

# Serve the dist/ folder with the backend or deploy to Vercel/Netlify
```

## Network Setup

For local network play:

1. Ensure all devices are on the same WiFi network
2. Find your computer's local IP address (e.g., `192.168.1.100`)
3. Update environment variables with this IP
4. Backend accessible at `http://192.168.1.100:3000`
5. Participant web app at `http://192.168.1.100:5173`
6. QR code will contain the correct join URL

## Troubleshooting

### Backend won't start

- Check that port 3000 is not in use
- Verify Spotify credentials are set in `.env`
- Check .env file is present in packages/backend
- Look for "Spotify: Configured ✓" in startup logs

### Quiz Master can't connect

- Verify EXPO_PUBLIC_BACKEND_URL points to correct IP
- Ensure backend is running
- Check firewall settings

### Participants can't join

- Verify VITE_BACKEND_URL is correct
- Ensure backend CORS_ORIGIN includes participant web URL
- Check that Socket.io is working (backend logs)

### Spotify authentication fails

- Verify Spotify Client ID and Secret are correct
- Check redirect URI matches in Spotify Dashboard and `.env`
- Make sure Spotify Developer App is not in Development Mode restrictions
- See [Spotify Setup Guide](./SPOTIFY_SETUP.md) for detailed troubleshooting

## Development Roadmap

### Phase 1: MVP ✅
- [x] Monorepo structure
- [x] Shared types package
- [x] Backend with Socket.io
- [x] Game session management
- [x] NAS file browsing
- [x] MP3 metadata extraction
- [x] Quiz master app initialization
- [x] Participant web app initialization

### Phase 2: UI Implementation
- [ ] Quiz master screens (Setup, Game, Leaderboard)
- [ ] Audio playback with random start
- [ ] Participant buzzer button
- [ ] Real-time score display

### Phase 3: Testing & Polish
- [ ] End-to-end testing
- [ ] Error handling
- [ ] Loading states
- [ ] Animations
- [ ] Sound effects

### Phase 4: Deployment
- [ ] Android APK build
- [ ] Docker deployment
- [ ] Production configuration

## Contributing

This is a personal project, but suggestions and bug reports are welcome!

## License

MIT
