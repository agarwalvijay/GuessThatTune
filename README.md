# Hear and Guess 🎵👂

A multiplayer music quiz game where players compete to identify songs from Spotify playlists. The quiz master controls the game while participants join via their phones to buzz in with answers.

**Live at:** [hearandguess.com](https://hearandguess.com) | [songgame.theagarwals.com](https://songgame.theagarwals.com)

## Overview

- **Quiz Master Web App**: React web app for managing the game, controlling Spotify playback, and tracking scores
- **Participant Web App**: React web app for participants to join, buzz in, and view scores
- **Backend**: Node.js + Express + Socket.io server for real-time communication and game state management
- **Shared Package**: TypeScript types, constants, and utilities used across all apps

## Features

### Game Features
- **Spotify Integration** - Use any Spotify playlist for your quiz
- **Smart Playback Control** - Plays songs on your Spotify device (phone, tablet, computer, speaker)
- **Real-time Buzzer System** - Server-side timing prevents cheating
- **Configurable Settings**:
  - Song duration (10-60 seconds)
  - Number of songs (5-30)
  - Buzzer countdown timer (1-10 seconds)
  - Wrong answer penalty (0-100%)
  - Spotify device selection
- **Dynamic Scoring** - Points based on speed: faster buzz = more points
- **Negative Points** - Configurable penalty for wrong answers
- **Sound Effects** - Buzz sounds, correct/incorrect feedback
- **Haptic Feedback** - Vibration on buzz (mobile devices)
- **Album Artwork** - Display album art when revealing answers
- **QR Code Joining** - Easy participant access via QR code
- **Manual Session Codes** - 5-character codes for joining (e.g., ABC12)
- **Auto-pause** - Playback pauses when someone buzzes in
- **Session Restart** - Keep the same players for multiple games

### Technical Features
- **Google Analytics** - Track games played, participants, and usage patterns
- **Multiple Domains** - Works on hearandguess.com and songgame.theagarwals.com
- **SSL/HTTPS** - Secure connections with Let's Encrypt certificates
- **WebSocket Support** - Real-time updates via Socket.io
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Server-side Timing** - Prevents client-side cheating
- **Cross-domain Tracking** - Analytics across both domains

## Project Structure

```
SongGame/
├── packages/
│   ├── backend/              # Node.js + Express + Socket.io server
│   │   ├── src/
│   │   │   ├── config/       # Environment configuration
│   │   │   ├── routes/       # API routes (game, health)
│   │   │   ├── services/     # Game session management
│   │   │   ├── socket/       # Socket.io event handlers
│   │   │   └── server.ts     # Main server file
│   │   └── package.json
│   │
│   ├── quiz-master-web/      # React web app for quiz master
│   │   ├── src/
│   │   │   ├── config/       # Environment config, Spotify setup
│   │   │   ├── pages/        # Login, Playlists, Setup, Control, Results, Info
│   │   │   ├── services/     # API, Socket.io, Spotify, Analytics
│   │   │   ├── store/        # Zustand state management
│   │   │   └── utils/        # Sound effects, hooks
│   │   ├── public/           # Static assets (logo)
│   │   └── package.json
│   │
│   ├── participant-web/      # React web app for participants
│   │   ├── src/
│   │   │   ├── pages/        # Join, Waiting, Game, Results
│   │   │   ├── services/     # Socket.io, Analytics
│   │   │   ├── store/        # Zustand state management
│   │   │   └── utils/        # Sound effects
│   │   └── package.json
│   │
│   └── shared/               # Shared TypeScript types & constants
│       ├── src/
│       │   ├── types/        # GameSession, Participant, Song, etc.
│       │   ├── constants/    # Socket events, game config
│       │   └── utils/        # Scoring, validation
│       └── package.json
│
├── ecosystem.config.js       # PM2 configuration for production
├── package.json              # Root workspace configuration
└── README.md                 # This file
```

## Prerequisites

- Node.js 18+ and npm
- **Spotify account** (Premium recommended for best experience)
- Spotify Developer App credentials ([Create one here](https://developer.spotify.com/dashboard))

## Setup Instructions

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 2. Configure Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URIs:
   - `http://localhost:5173/callback` (for local development)
   - `https://hearandguess.com/callback` (for production)
   - `https://www.hearandguess.com/callback` (for production)
4. Note your Client ID and Client Secret

### 3. Configure Environment Variables

**Backend** (`packages/backend/.env`):
```env
PORT=4000
NODE_ENV=production
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
CORS_ORIGIN=https://hearandguess.com,https://www.hearandguess.com,https://songgame.theagarwals.com
```

**Quiz Master Web** - Update `packages/quiz-master-web/src/config/environment.ts`:
- Spotify Client ID is configured in the file
- Uses `window.location.origin` for dynamic URLs

### 4. Build Shared Package

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

**Terminal 2 - Quiz Master Web App**:
```bash
cd packages/quiz-master-web
npm run dev
```

**Terminal 3 - Participant Web App**:
```bash
cd packages/participant-web
npm run dev
```

Access the apps:
- Quiz Master: http://localhost:5173
- Participants: http://localhost:5173/join

## How to Play

### Quiz Master Setup

1. **Prepare Spotify:**
   - Open Spotify on your phone, tablet, or computer
   - Play any song for 1-2 seconds (this activates your device)

2. **Login:**
   - Visit [hearandguess.com](https://hearandguess.com)
   - Click "Connect with Spotify"
   - Authorize the app

3. **Configure Settings (Optional):**
   - Click the settings icon (⚙️)
   - Adjust song duration, number of songs, penalties, countdown timer
   - Select which Spotify device to use for playback

4. **Select Playlist:**
   - Choose any of your Spotify playlists
   - The app will use available songs from that playlist

5. **Share the Game:**
   - Show participants the QR code
   - Or share the session code (5 characters, e.g., "ABC12")

6. **Start Playing:**
   - Wait for participants to join
   - Click "Start Game"
   - Control playback and award points

### For Participants

1. Scan the QR code or visit hearandguess.com/join
2. Enter the session code (if not using QR)
3. Enter your name
4. Wait for the game to start
5. Press the buzz button when you know the answer
6. Answer quickly for more points!

### Gameplay Flow

1. Quiz master starts each round
2. A song plays from your selected Spotify device
3. Participants buzz in when they recognize the song
4. Countdown timer appears (configurable, default 3 seconds)
5. Quiz master sees who buzzed and when
6. Quiz master marks answers as correct (✓) or incorrect (✗)
7. Points awarded based on speed
8. Next round begins
9. Final leaderboard shows at the end

### Scoring

- **Points = 60 - seconds elapsed** when you buzz
- Faster buzz = more points
- Wrong answers = penalty (configurable, default 25% of potential points)
- Earlier buzzers automatically marked wrong when someone else is marked correct

## Production Deployment

### Current Setup

The app runs on a GCP instance with:
- **nginx** - Reverse proxy and SSL termination
- **PM2** - Process manager for Node.js backend
- **Let's Encrypt** - SSL certificates (auto-renewing)
- **Domains**:
  - hearandguess.com (primary)
  - www.hearandguess.com
  - songgame.theagarwals.com (legacy)

### Deployment Process

```bash
# Build all apps
npm run build:prod

# Deploy to server (from local machine)
cd packages/quiz-master-web
rsync -avz --delete dist/ user@server:~/app/songgame/packages/quiz-master-web/dist/

cd ../participant-web
rsync -avz --delete dist/ user@server:~/app/songgame/packages/participant-web/dist/

cd ../backend
rsync -avz dist/ user@server:~/app/songgame/packages/backend/dist/

# Restart backend (on server)
pm2 restart songgame
```

### nginx Configuration

Located at `/etc/nginx/sites-available/songgame`:
- Serves both quiz-master-web and participant-web static files
- Proxies `/api/*` and `/socket.io/*` to backend on port 4000
- SSL certificates from Let's Encrypt
- Handles all three domains

## API Endpoints

### Game Management

- `POST /api/game/create` - Create new game session
- `POST /api/game/:sessionId/start` - Start the game
- `GET /api/game/:sessionId` - Get game state
- `POST /api/game/:sessionId/next` - Advance to next round
- `POST /api/game/:sessionId/score` - Award points to participant
- `POST /api/game/:sessionId/incorrect` - Mark answer as incorrect
- `POST /api/game/:sessionId/end` - End the game
- `POST /api/game/:sessionId/restart` - Restart with same participants

### Health Check

- `GET /api/health` - Server health status

## Socket.io Events

### Client → Server

- `join_session` - Participant joins game
- `leave_session` - Participant leaves
- `buzzer` - Participant presses buzzer

### Server → Client

- `game_state_update` - Game state changed
- `participant_joined` - New participant joined
- `participant_left` - Participant left
- `round_started` - New round started
- `song_started` - Song playback started
- `buzzer_event` - Someone buzzed in
- `round_ended` - Round completed
- `score_update` - Scores updated
- `game_ended` - Game finished

## Architecture Highlights

### Server-Side Timing

All timing is server-authoritative to prevent cheating:

```typescript
const elapsedSeconds = (Date.now() - songStartTime) / 1000;
const score = Math.max(0, 60 - Math.floor(elapsedSeconds));
```

### Session IDs

5-character alphanumeric codes (case-insensitive):
- Easy to type and share
- No ambiguous characters (0, O, 1, I removed)
- Example: "ABC12", "XY7Z3"

### Spotify Playback

Uses Spotify Connect API (not Web Playback SDK):
- Controls existing Spotify devices remotely
- Works with phones, tablets, computers, speakers
- Requires device to be "active" (play a song briefly first)
- Device selection available in settings

### Sound Effects

Web Audio API for responsive feedback:
- Buzz sound on button press (participant)
- Two-tone siren when someone buzzes (quiz master)
- Rising arpeggio for correct answers
- Descending tone for incorrect answers
- Beep at end of countdown

## Analytics

Google Analytics 4 tracking:
- **Measurement ID**: G-FRNR97D18L
- **Tracked Events**:
  - Game created (with settings)
  - Game started (with participant count)
  - Game ended (completion stats)
  - Participant joined
  - Page views across both apps

## Info & Legal

Visit [hearandguess.com/info](https://hearandguess.com/info) for:
- Complete how-to-play guide
- Privacy policy
- Terms of service
- Contact information

## Troubleshooting

### Spotify device not detected

1. Open Spotify app on your device
2. Play any song for 1-2 seconds
3. Return to Hear and Guess
4. Go to Settings and select your device
5. If device disappears, repeat steps 1-2

### Participants can't join

- Check that session code is correct (5 characters)
- Ensure backend server is running
- Verify CORS settings include participant URL
- Check Socket.io connection in browser console

### Songs won't play

- Verify Spotify Premium is active
- Ensure Spotify app is open and has played recently
- Check device selection in settings
- Try transferring playback to your device manually in Spotify
- Refresh the page and try again

### Wrong answers not penalized

- Check that negative points percentage is > 0 in settings
- Ensure you're clicking the ✗ button (not just skipping)
- Verify score updates in the leaderboard

## Development Roadmap

### Completed ✅
- [x] Monorepo structure with workspaces
- [x] Backend with Socket.io and game management
- [x] Quiz master web app with Spotify integration
- [x] Participant web app with buzzer system
- [x] Real-time scoring and leaderboard
- [x] Configurable game settings
- [x] Buzzer countdown timer
- [x] Sound effects and haptic feedback
- [x] Negative points system
- [x] Album artwork display
- [x] Google Analytics integration
- [x] Production deployment on GCP
- [x] SSL certificates with Let's Encrypt
- [x] Multiple domain support
- [x] Info/legal page
- [x] Branding update to "Hear and Guess"

### Future Enhancements
- [ ] Team mode (teams compete)
- [ ] Playlist creation from app
- [ ] Song difficulty ratings
- [ ] Historical leaderboards
- [ ] Custom sound effects
- [ ] Theme customization
- [ ] Mobile app versions
- [ ] Spotify playlist analysis/recommendations

## Contributing

Suggestions and bug reports are welcome! For contributions, please contact us first.

## Copyright

Copyright © 2026 Vijay Agarwal. All rights reserved.

This software is proprietary. For licensing inquiries, please contact [kj3yihkvm@mozmail.com](mailto:kj3yihkvm@mozmail.com)

## Contact

Questions? Contact us at [kj3yihkvm@mozmail.com](mailto:kj3yihkvm@mozmail.com)

---

Built with ♥ using React, TypeScript, Node.js, Socket.io, and Spotify API

Not affiliated with Spotify.
