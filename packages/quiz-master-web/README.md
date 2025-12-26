# Quiz Master Web App

A web-based quiz master application for the Song Quiz Game. This application allows hosts to create and manage music quiz games using Spotify.

## Features

- Spotify authentication and playlist selection
- Create game sessions with QR code for participants to join
- Real-time game control with Spotify Web Playback SDK
- Live participant tracking and score management
- Socket.IO for real-time updates

## Technology Stack

- React 18 with TypeScript
- Vite for build tooling
- Zustand for state management
- React Router for navigation
- Socket.IO client for real-time communication
- Axios for HTTP requests
- Spotify Web Playback SDK for audio control
- QRCode.react for QR code generation

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Spotify Premium account (required for Web Playback SDK)
- Running backend server

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
VITE_BACKEND_URL=http://192.168.1.134:3000
VITE_WEB_APP_URL=http://192.168.1.134:3000
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── config/          # Configuration files
│   └── environment.ts
├── services/        # Service layer
│   ├── spotifyAuthService.ts
│   ├── apiService.ts
│   ├── socketService.ts
│   └── spotifyPlaybackService.ts
├── store/           # State management
│   └── appStore.ts
├── pages/           # Page components
│   ├── SpotifyLoginPage.tsx
│   ├── PlaylistSelectionPage.tsx
│   ├── GameSetupPage.tsx
│   └── GameControlPage.tsx
├── types/           # TypeScript type definitions
│   └── spotify-web-playback-sdk.d.ts
├── App.tsx          # Main app component with routing
└── main.tsx         # Entry point
```

## Usage Flow

1. **Login**: Connect with Spotify account
2. **Select Playlist**: Choose a playlist to create a quiz from
3. **Game Setup**: Configure game settings and wait for participants to join via QR code
4. **Game Control**: Host the game, control playback, and view live scores

## Notes

- Requires Spotify Premium account for playback control
- Backend server must be running and accessible
- Participants join via the participant web app by scanning the QR code
