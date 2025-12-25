import { Router, Request, Response } from 'express';
import { spotifyService } from '../services/SpotifyService';

const router = Router();

/**
 * Helper function to extract access token from Authorization header
 */
function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * GET /api/spotify/playlists
 * Get current user's playlists
 * Requires: Authorization header with Bearer token (from Quiz Master app)
 */
router.get('/playlists', async (req: Request, res: Response) => {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const playlists = await spotifyService.getUserPlaylists(accessToken);
    return res.json({ playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

/**
 * GET /api/spotify/playlist/:playlistId/tracks
 * Get tracks from a specific playlist
 * Requires: Authorization header with Bearer token (from Quiz Master app)
 */
router.get('/playlist/:playlistId/tracks', async (req: Request, res: Response) => {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const { playlistId } = req.params;
    const spotifyTracks = await spotifyService.getPlaylistTracks(accessToken, playlistId);
    const songs = spotifyService.convertTracksToSongs(spotifyTracks);

    return res.json({
      tracks: spotifyTracks,
      songs,
      count: songs.length,
    });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    return res.status(500).json({ error: 'Failed to fetch playlist tracks' });
  }
});

/**
 * GET /api/spotify/user
 * Get current user profile
 * Requires: Authorization header with Bearer token (from Quiz Master app)
 */
router.get('/user', async (req: Request, res: Response) => {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const user = await spotifyService.getCurrentUser(accessToken);
    return res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
