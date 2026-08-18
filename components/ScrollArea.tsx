import React from 'react';

/**
 * A scroll container whose scrollbar takes up no width.
 *
 * On Windows a styled `::-webkit-scrollbar` is not an overlay — it reserves a
 * gutter out of the content box, and content physically cannot paint there.
 * So the detail panel's photograph stopped a few pixels short of the panel
 * edge, with the bar sitting in the gap. macOS does not do this, which is why
 * overlay scrollbars are the thing to imitate rather than work around.
 *
 * Hiding the native bar and drawing the thumb over the content gives every
 * platform the same behaviour: the photograph runs to both edges, it still
 * scrolls away with everything else, and the thumb appears above it while you
 * are scrolling or have the pointer in the panel.
 */

/** Long enough to grab, on a panel long enough to need one. */
const MIN_THUMB = 28;
/** How long the thumb lingers after the last scroll event. */
const LINGER_MS = 900;

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Classes for the scrolling element itself, not the positioning wrapper. */
  viewportClassName?: string;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className = '',
  viewportClassName = '',
  viewportRef,
  ...rest
}) => {
  const own = React.useRef<HTMLDivElement | null>(null);
  const viewport = viewportRef ?? own;
  const linger = React.useRef<number | undefined>(undefined);

  const [thumb, setThumb] = React.useState({ top: 0, height: 0, shown: false });
  const [scrolling, setScrolling] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;

    // Nothing to scroll, nothing to draw.
    if (scrollHeight <= clientHeight + 1) {
      setThumb(t => (t.shown ? { ...t, shown: false } : t));
      return;
    }

    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight);
    const travel = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * travel;
    setThumb({ top, height, shown: true });
  }, [viewport]);

  // Content arrives late here — briefings, photographs and climate all land
  // after their own fetches — so the height is watched rather than read once.
  React.useEffect(() => {
    const el = viewport.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, children]);

  React.useEffect(() => () => window.clearTimeout(linger.current), []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    measure();
    setScrolling(true);
    window.clearTimeout(linger.current);
    linger.current = window.setTimeout(() => setScrolling(false), LINGER_MS);
    rest.onScroll?.(e);
  };

  return (
    <div
      {...rest}
      className={`relative ${className}`}
      onMouseEnter={e => { setHovered(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); rest.onMouseLeave?.(e); }}
      onScroll={undefined}
    >
      <div
        ref={viewport}
        onScroll={handleScroll}
        className={`h-full overflow-y-auto overflow-x-hidden no-scrollbar ${viewportClassName}`}
      >
        {children}
      </div>

      {thumb.shown && (
        <div
          aria-hidden="true"
          className="absolute right-[3px] w-[5px] rounded-full pointer-events-none
                     transition-opacity duration-300 z-30"
          style={{
            top: thumb.top,
            height: thumb.height,
            background: 'var(--scrollbar-thumb)',
            opacity: scrolling || hovered ? 1 : 0,
          }}
        />
      )}
    </div>
  );
};

export default ScrollArea;
