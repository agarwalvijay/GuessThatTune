import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * Polls Spotify for available playback devices.
 * Returns null while the first check is in flight, then true/false.
 */
export function useSpotifyDeviceCheck(accessToken: string | null, intervalMs = 12000) {
  const [hasDevice, setHasDevice] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!accessToken) return;
    const devices = await apiService.getSpotifyDevices(accessToken);
    setHasDevice(devices.length > 0);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    check();
    intervalRef.current = setInterval(check, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check, intervalMs]);

  return hasDevice;
}
