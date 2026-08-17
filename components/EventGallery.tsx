import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { EventImage } from '../utils/eventImages';

/**
 * The other photographs of an event.
 *
 * One image tells you an event exists; several tell you what it is like. A
 * single still of Naghol shows a wooden tower — the second and third show a
 * man on it, and the ground.
 *
 * Every frame carries its credit, because Commons material is CC-BY or
 * CC-BY-SA and the attribution travels with the picture. It is shown in the
 * lightbox rather than under each thumbnail, where it would be noise.
 */

interface EventGalleryProps {
  images: NonNullable<EventImage['gallery']>;
  title: string;
}

const EventGallery: React.FC<EventGalleryProps> = ({ images, title }) => {
  const [open, setOpen] = React.useState<number | null>(null);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());

  // A Commons file can vanish or hotlink-fail; drop those frames rather than
  // leaving a grey rectangle in the strip.
  const usable = React.useMemo(
    () => images.filter(image => !broken.has(image.url)),
    [images, broken]
  );

  const step = React.useCallback(
    (delta: number) =>
      setOpen(i => (i === null || usable.length === 0
        ? null
        : (i + delta + usable.length) % usable.length)),
    [usable.length]
  );

  // Capture phase, and the event stops here: the reader behind this also
  // closes on Escape, and one key press should dismiss one layer — the photo
  // you opened, not the whole article underneath it. Immediate, because a
  // synthetic event dispatched at window puts both listeners in the same
  // phase, where plain stopPropagation does nothing.
  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(null); }
      if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); step(1); }
      if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); step(-1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, step]);

  // A frame failing while the lightbox is on it would otherwise index past
  // the end of the shortened list.
  React.useEffect(() => {
    if (open !== null && open >= usable.length) setOpen(usable.length ? 0 : null);
  }, [open, usable.length]);

  if (usable.length === 0) return null;
  const shown = open !== null ? usable[open] : null;

  return (
    <>
      <div className="k-gallery-strip flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {usable.map((image, i) => (
          <button
            key={image.url}
            type="button"
            onClick={() => setOpen(i)}
            className="shrink-0 w-28 h-20 rounded-xl overflow-hidden border border-line
                       bg-hover active:opacity-80 transition-opacity"
            aria-label={`Photograph ${i + 1} of ${title}`}
          >
            <img
              src={image.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => setBroken(prev => new Set(prev).add(image.url))}
            />
          </button>
        ))}
      </div>

      {shown && (
        <div
          className="fixed inset-0 z-[95] bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photograph`}
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10
                       backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <img
              src={shown.url}
              alt=""
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()}
              onError={() => setBroken(prev => new Set(prev).add(shown.url))}
            />
          </div>

          {usable.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photograph"
                onClick={e => { e.stopPropagation(); step(-1); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full
                           bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Next photograph"
                onClick={e => { e.stopPropagation(); step(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full
                           bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="shrink-0 px-5 pb-8 pt-2 text-center" onClick={e => e.stopPropagation()}>
            <a
              href={shown.sourcePage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-white/60 hover:text-white/90 transition-colors"
            >
              {shown.credit} · {shown.license}
            </a>
            {usable.length > 1 && (
              <p className="text-[12px] text-white/40 mt-1">
                {open! + 1} of {usable.length}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EventGallery;
