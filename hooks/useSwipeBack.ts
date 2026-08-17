import { useRef } from 'react';

/**
 * Swipe right to go back.
 *
 * A close button in the top-right corner is the hardest target on a phone to
 * reach one-handed, and on a full-screen panel it is the only way out. Both
 * platforms train people to swipe back instead, so the gesture should work
 * whether or not anyone finds the button.
 *
 * Deliberately conservative about what counts:
 *
 *   - rightward only, because that is the direction that means "back"
 *   - horizontal by a clear margin, so scrolling the panel with a slightly
 *     angled thumb never dismisses it by accident
 *   - single finger, so a pinch-zoom on a photograph is not a swipe
 *   - fired once per gesture, and only on release, so the reader can change
 *     their mind mid-drag by returning towards where they started
 */

/** How far the thumb must travel before this counts as a swipe. */
const DISTANCE_PX = 72;
/** How much more horizontal than vertical the travel has to be. */
const DIRECTION_RATIO = 1.6;

export function useSwipeBack(onBack: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancelled = useRef(false);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) {
        cancelled.current = true;
        return;
      }
      cancelled.current = false;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },

    onTouchMove: (e: React.TouchEvent) => {
      // A second finger mid-gesture means the reader is zooming, not leaving.
      if (e.touches.length !== 1) cancelled.current = true;
    },

    onTouchEnd: (e: React.TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!from || cancelled.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;

      if (dx > DISTANCE_PX && Math.abs(dx) > Math.abs(dy) * DIRECTION_RATIO) {
        onBack();
      }
    }
  };
}
