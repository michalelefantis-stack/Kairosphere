import { CultureItem } from '../types';
import { fetchContent } from './contentSource';

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
  const payload = await fetchContent<{ images?: Record<string, EventImage> }>(
    'event_images.json', {}
  );
  cache = payload.images ?? {};
  return cache;
}

/**
 * Overlay verified photographs onto the catalogue, then remove the stock
 * photos that are standing in for several events at once.
 *
 * The original catalogue reused images heavily — one Unsplash frame served
 * four different Aboriginal festivals, another three unrelated Middle Eastern
 * entries. A reused photo is proof it was never chosen for the subject, and
 * showing it implies a documentary claim the image does not support: the
 * reader believes they are looking at Yarrabah. The category glyph says
 * nothing instead, which is the honest answer.
 *
 * Verified photographs are exempt. Those were matched against a Wikimedia
 * description naming the event, and the resolver already keeps any one photo
 * to a single event.
 */
export function applyEventImages(
  items: CultureItem[],
  images: Record<string, EventImage>
): CultureItem[] {
  const overlaid = items.map(item => {
    const found = images?.[item.id];
    if (!found?.url) return item;
    return { ...item, imageUrl: found.url, imageCredit: found } as CultureItem;
  });

  const uses = new Map<string, number>();
  for (const item of overlaid) {
    if (!item.imageUrl) continue;
    uses.set(item.imageUrl, (uses.get(item.imageUrl) ?? 0) + 1);
  }

  return overlaid.map(item => {
    const shared = item.imageUrl && (uses.get(item.imageUrl) ?? 0) > 1;
    if (!shared || (item as CultureItem).imageCredit) return item;
    return { ...item, imageUrl: '' } as CultureItem;
  });
}

/** "© Photographer / CC BY-SA 4.0" — the attribution the licence requires. */
export function creditLine(image: EventImage): string {
  const who = image.credit?.trim() || 'Wikimedia Commons';
  const license = image.license?.trim();
  return license && license !== 'See source page' ? `${who} · ${license}` : who;
}
