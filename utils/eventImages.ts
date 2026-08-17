import { CultureItem } from '../types';

/**
 * Verified event photographs, keyed by event id.
 *
 * Built by `python -m pipeline.images` and kept as a separate mapping rather
 * than written into the catalogue, so it can be re-run and reviewed without
 * touching source data.
 *
 * Only images whose Wikimedia description names the event — and usually the
 * place — get in. Everything else keeps whatever the catalogue had, because a
 * generic photo of the wrong thing is worse than an honest gap.
 */

export interface EventImage {
  url: string;
  credit: string;
  license: string;
  licenseUrl: string;
  sourcePage: string;
  /** Which words tied this photo to this event, e.g. "nyepi + bali". */
  verifiedBy: string;
  via: 'commons-category' | 'commons-search' | 'wikipedia-lead';
  score?: number;
}

let cache: Record<string, EventImage> | null = null;

export async function loadEventImages(): Promise<Record<string, EventImage>> {
  if (cache) return cache;
  try {
    const response = await fetch('data/event_images.json');
    if (!response.ok) {
      cache = {};
      return cache;
    }
    const payload = await response.json();
    cache = (payload?.images ?? {}) as Record<string, EventImage>;
    return cache;
  } catch {
    cache = {};
    return cache;
  }
}

/** Overlay verified photographs onto the catalogue. */
export function applyEventImages(
  items: CultureItem[],
  images: Record<string, EventImage>
): CultureItem[] {
  if (!images || Object.keys(images).length === 0) return items;
  return items.map(item => {
    const found = images[item.id];
    if (!found?.url) return item;
    return { ...item, imageUrl: found.url, imageCredit: found } as CultureItem;
  });
}

/** "© Photographer / CC BY-SA 4.0" — the attribution the licence requires. */
export function creditLine(image: EventImage): string {
  const who = image.credit?.trim() || 'Wikimedia Commons';
  const license = image.license?.trim();
  return license && license !== 'See source page' ? `${who} · ${license}` : who;
}
