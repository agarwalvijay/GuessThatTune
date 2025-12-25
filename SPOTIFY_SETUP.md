# Spotify Integration Setup

This guide will help you set up Spotify integration for the Song Quiz Game.

## Overview

Spotify authentication happens **entirely in the Quiz Master app** on your phone. The backend simply uses the access token provided by the app to fetch playlists and tracks.

## Prerequisites

- Spotify Premium account (required for full track playback)
- Spotify Developer account (free) - for Quiz Master app credentials

## Architecture

```
Quiz Master App (Phone)
    ↓
  Spotify OAuth (in-app)
    ↓
  Access Token
    ↓
  Send to Backend with API calls
    ↓
Backend uses token to fetch playlists/tracks
```

## Step 1: Create Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the details:
   - **App name**: Song Quiz Game
   - **App description**: Music quiz game with buzzer functionality
   - **Redirect URIs**:
     - `songgame://spotify/callback` (for React Native deep linking)
     - Or use your custom scheme
   - **API/SDKs**: Check "Web API" and "Web Playback SDK"
5. Accept the terms and click **"Save"**

## Step 2: Get Your Client ID

1. In your app dashboard, you'll see your **Client ID**
2. Copy this - you'll need it for the Quiz Master app
3. **Note:** You do NOT need the Client Secret for mobile apps

## Step 3: Configure Quiz Master App

The Quiz Master React Native app will handle authentication using the Spotify SDK.

### Required Scopes:
- `user-read-private` - Read user profile
- `user-read-email` - Read user email
- `playlist-read-private` - Access private playlists
- `playlist-read-collaborative` - Access collaborative playlists
- `streaming` - Play music in the app (required for Premium playback)
- `user-read-playback-state` - Read playback state
- `user-modify-playback-state` - Control playback

### Implementation (Quiz Master App):

```typescript
// The Quiz Master app will:
1. Use Spotify React Native SDK
2. Authenticate user with Spotify
3. Receive access token
4. Store token locally
5. Send token with all API requests to backend:

   fetch('http://backend/api/spotify/playlists', {
     headers: {
       'Authorization': `Bearer ${accessToken}`
     }
   })
```

## Backend Configuration

**Good news:** The backend needs **NO Spotify credentials**!

The backend `.env` file is already configured correctly. It only needs:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
WEB_APP_URL=http://localhost:5173
```

The backend will receive the access token from the Quiz Master app and use it to make Spotify API calls.

## API Flow

### 1. Quiz Master Authenticates
```
Quiz Master App → Spotify SDK → OAuth → Access Token
```

### 2. Get User's Playlists
```http
GET http://backend:3000/api/spotify/playlists
Authorization: Bearer {access_token_from_app}
```

Response:
```json
{
  "playlists": [
    {
      "id": "...",
      "name": "My Playlist",
      "images": [...],
      "tracks": { "total": 50 }
    }
  ]
}
```

### 3. Get Playlist Tracks
```http
GET http://backend:3000/api/spotify/playlist/{playlistId}/tracks
Authorization: Bearer {access_token_from_app}
```

Response:
```json
{
  "tracks": [...],
  "songs": [...],
  "count": 50
}
```

### 4. Get User Profile
```http
GET http://backend:3000/api/spotify/user
Authorization: Bearer {access_token_from_app}
```

## Testing the Backend

Once you have an access token from Spotify, you can test the backend endpoints:

```bash
# Get your access token from: https://developer.spotify.com/console/get-playlists/
# Click "Get Token" and copy it

# Test playlists endpoint
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/spotify/playlists

# Test user endpoint
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/spotify/user
```

## Token Management

### Access Token Lifetime:
- Spotify access tokens expire after **1 hour**
- The Quiz Master app should handle token refresh
- Use the refresh token to get a new access token when needed

### Token Refresh (handled by Quiz Master app):
The Spotify SDK in the Quiz Master app will automatically handle token refresh. When the access token expires:
1. App uses refresh token to get new access token
2. App updates stored token
3. App continues making API calls with new token

## Security Notes

1. **Never hardcode tokens** - Always get them from Spotify OAuth
2. **Store tokens securely** - Use secure storage on the device
3. **HTTPS in production** - Always use HTTPS for API calls
4. **Don't log tokens** - Never log access tokens or refresh tokens
5. **Token scope** - Only request the scopes you actually need

## Troubleshooting

### "Invalid access token" error
- Token may have expired (tokens last 1 hour)
- Use refresh token to get a new access token
- Re-authenticate if refresh token is invalid

### "Insufficient client scope" error
- The token doesn't have the required permissions
- Re-authenticate with the correct scopes

### Backend can't fetch playlists
- Check that the Authorization header is set correctly
- Format: `Authorization: Bearer {token}`
- Verify the token is valid by testing in Spotify Console

## Next Steps

1. ✅ Backend is ready (no configuration needed!)
2. 🔨 Implement Spotify SDK in Quiz Master React Native app
3. 🔨 Add Spotify authentication flow in app UI
4. 🔨 Implement playlist selection
5. 🔨 Add Spotify Web Playback SDK for music playback

## Resources

- [Spotify for Developers](https://developer.spotify.com/)
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify React Native SDK](https://github.com/spotify/react-native-spotify-remote) (deprecated - use Web API)
- [Authorization Guide](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
