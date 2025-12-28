import { useEffect, useRef } from 'react';

/**
 * Hook to prevent screen from turning off during active gameplay
 * Uses the Screen Wake Lock API
 */
export function useWakeLock(enabled: boolean = true) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Release wake lock if disabled
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      return;
    }

    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      console.warn('Screen Wake Lock API not supported');
      return;
    }

    const requestWakeLock = async () => {
      try {
        // Only request if document is visible
        if (document.visibilityState !== 'visible') {
          console.log('⏸️ Page not visible, skipping wake lock request');
          return;
        }

        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('🔆 Screen wake lock activated');

        wakeLockRef.current.addEventListener('release', () => {
          console.log('🔅 Screen wake lock released');
        });
      } catch (err: any) {
        // Only log if it's not a visibility error
        if (err.name !== 'NotAllowedError') {
          console.error('Failed to acquire wake lock:', err);
        } else {
          console.log('⏸️ Wake lock not allowed (page may not be visible)');
        }
      }
    };

    // Request wake lock
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  return wakeLockRef;
}
