import { useEffect, useRef, useState, useCallback } from 'react';

export const AUTOLOCK_STORAGE_KEY = 'chatcon_autolock_minutes';
export const AUTOLOCK_CHANGED_EVENT = 'chatcon:autolock-config-changed';
export const DEFAULT_AUTOLOCK_MINUTES = '5';

export type AutoLockOption = '0.5' | '1' | '5' | '10' | '15' | '30' | '60' | 'never' | string;

export function getStoredAutoLockSetting(): string {
  try {
    const val = localStorage.getItem(AUTOLOCK_STORAGE_KEY);
    if (!val) return DEFAULT_AUTOLOCK_MINUTES;
    return val;
  } catch {
    return DEFAULT_AUTOLOCK_MINUTES;
  }
}

export function setStoredAutoLockSetting(value: string): void {
  try {
    localStorage.setItem(AUTOLOCK_STORAGE_KEY, value);
    window.dispatchEvent(
      new CustomEvent(AUTOLOCK_CHANGED_EVENT, { detail: { value } })
    );
  } catch (err) {
    console.error('Failed to save auto-lock setting', err);
  }
}

/**
 * Hook to manage auto-lock on inactivity.
 * When isUnlocked is true and an auto-lock interval is configured,
 * tracks user interactions and locks the app if idle for the set duration.
 */
export function useAutoLock(isUnlocked: boolean) {
  const [autoLockSetting, setAutoLockSetting] = useState<string>(getStoredAutoLockSetting);
  const lastActivityRef = useRef<number>(Date.now());
  const isUnlockedRef = useRef<boolean>(isUnlocked);

  // Keep ref up to date
  useEffect(() => {
    isUnlockedRef.current = isUnlocked;
    if (isUnlocked) {
      lastActivityRef.current = Date.now();
    }
  }, [isUnlocked]);

  // Listen for config changes from Settings or other components
  useEffect(() => {
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ value: string }>;
      const newVal = customEvent.detail?.value || getStoredAutoLockSetting();
      setAutoLockSetting(newVal);
      lastActivityRef.current = Date.now();
    };

    window.addEventListener(AUTOLOCK_CHANGED_EVENT, handleConfigChange);
    window.addEventListener('storage', (e) => {
      if (e.key === AUTOLOCK_STORAGE_KEY) {
        setAutoLockSetting(e.newValue || DEFAULT_AUTOLOCK_MINUTES);
        lastActivityRef.current = Date.now();
      }
    });

    return () => {
      window.removeEventListener(AUTOLOCK_CHANGED_EVENT, handleConfigChange);
    };
  }, []);

  const triggerLock = useCallback(() => {
    if (!isUnlockedRef.current) return;
    sessionStorage.removeItem('chatcon_app_unlocked');
    window.dispatchEvent(new CustomEvent('chatcon:lock-app'));
  }, []);

  // Monitor user activity and check idle timeout
  useEffect(() => {
    if (!isUnlocked) return;

    // Reset activity timestamp on user interaction (throttled to once per second)
    let lastThrottledCall = 0;
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastThrottledCall > 800) {
        lastThrottledCall = now;
        lastActivityRef.current = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    // Check on visibility change (e.g. if user switched tabs and returned after timeout)
    const handleVisibilityChange = () => {
      if (!document.hidden && isUnlockedRef.current) {
        const setting = getStoredAutoLockSetting();
        if (setting !== 'never') {
          const minutes = parseFloat(setting);
          if (!isNaN(minutes) && minutes > 0) {
            const timeoutMs = minutes * 60 * 1000;
            if (Date.now() - lastActivityRef.current >= timeoutMs) {
              triggerLock();
              return;
            }
          }
        }
        // If not timed out, refresh activity on return
        lastActivityRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check interval
    const interval = setInterval(() => {
      if (!isUnlockedRef.current) return;
      const setting = getStoredAutoLockSetting();
      if (setting === 'never') return;

      const minutes = parseFloat(setting);
      if (isNaN(minutes) || minutes <= 0) return;

      const timeoutMs = minutes * 60 * 1000;
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        triggerLock();
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, resetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [isUnlocked, triggerLock]);

  return {
    autoLockSetting,
    updateAutoLockSetting: (val: string) => {
      setAutoLockSetting(val);
      setStoredAutoLockSetting(val);
    },
    resetActivity: () => {
      lastActivityRef.current = Date.now();
    },
  };
}
