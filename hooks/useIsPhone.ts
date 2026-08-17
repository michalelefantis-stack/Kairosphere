import { useEffect, useState } from 'react';

/**
 * True on a phone-sized viewport.
 *
 * Matches Tailwind's `sm` breakpoint so this and the `sm:` classes cannot
 * disagree. Used where hiding with CSS is not enough — a component that is
 * merely `hidden` has still been imported, mounted, and has still started
 * whatever it does on mount.
 */
const PHONE_QUERY = '(max-width: 639px)';

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mq.addEventListener('change', onChange);
    // Re-read on mount: the viewport can change between first render and here.
    setIsPhone(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
