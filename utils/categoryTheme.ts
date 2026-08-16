import { EventCategory, RitualType } from '../types';

/**
 * One source of truth for what a category looks like.
 *
 * This taxonomy was previously duplicated as a switch statement in
 * CalendarView, DetailPanel, MapComponent and Sidebar — four copies that had
 * already drifted. Colours resolve to theme tokens rather than literals, so a
 * palette change is one edit in index.css.
 *
 * The app carries two overlapping taxonomies: RitualType for curated culture
 * items and EventCategory for pipeline events. Both map onto the same six
 * visual buckets so one legend covers the whole map.
 */

export type CategoryKey =
  | 'ritual'
  | 'migration'
  | 'flora'
  | 'atmospheric'
  | 'cosmic'
  | 'unrest';

/**
 * Six categories, three colours.
 *
 * Six categorical hues cannot survive colour blindness — validated, the
 * original set had two pairs indistinguishable under deuteranopia and one
 * pair too close in normal vision. Colour therefore encodes the domain and
 * the glyph encodes the kind. See the note in index.css.
 */
export type CategoryFamily = 'human' | 'life' | 'sky';

const KEY_TO_FAMILY: Record<CategoryKey, CategoryFamily> = {
  ritual: 'human',
  unrest: 'human',
  migration: 'life',
  flora: 'life',
  atmospheric: 'sky',
  cosmic: 'sky'
};

export function categoryFamily(type?: string, subCategory?: string): CategoryFamily {
  return KEY_TO_FAMILY[categoryKey(type, subCategory)];
}

export const FAMILY_LABEL: Record<CategoryFamily, string> = {
  human: 'People',
  life: 'Living world',
  sky: 'Sky & weather'
};

/**
 * Colour encodes the broad domain; the glyph encodes the specific kind.
 *
 * Ten fully distinct hues would need a ten-swatch legend nobody reads, and the
 * old palette spent six saturated neons on ritual sub-types alone. Grouping to
 * three colours here (gathering / devotional / sky) keeps one legend for the
 * whole map, and CATEGORY_GLYPH still separates a pilgrimage from a festival.
 */
const RITUAL_TO_KEY: Record<string, CategoryKey> = {
  [RitualType.FESTIVAL]: 'ritual',
  [RitualType.CEREMONY]: 'ritual',
  [RitualType.PERFORMANCE]: 'ritual',
  [RitualType.SPIRITUAL]: 'cosmic',
  [RitualType.PILGRIMAGE]: 'cosmic',
  [RitualType.PHENOMENON]: 'atmospheric'
};

const EVENT_TO_KEY: Record<string, CategoryKey> = {
  [EventCategory.RITUAL]: 'ritual',
  [EventCategory.MIGRATION]: 'migration',
  [EventCategory.FLORA]: 'flora',
  [EventCategory.ATMOSPHERIC]: 'atmospheric',
  [EventCategory.COSMIC]: 'cosmic',
  [EventCategory.UNREST]: 'unrest'
};

/**
 * Sub-categories give the map more resolution than the six buckets.
 * Anything unmatched falls back to its parent bucket.
 */
const SUBCATEGORY_TO_KEY: Record<string, CategoryKey> = {
  wildlife: 'migration',
  animal: 'migration',
  migration: 'migration',
  botanical: 'flora',
  bloom: 'flora',
  nature: 'flora',
  astronomical: 'cosmic',
  cosmic: 'cosmic',
  celestial: 'cosmic',
  weather: 'atmospheric',
  atmospheric: 'atmospheric',
  geological: 'atmospheric'
};

export function categoryKey(type?: string, subCategory?: string): CategoryKey {
  if (subCategory) {
    const hit = SUBCATEGORY_TO_KEY[subCategory.toLowerCase()];
    if (hit) return hit;
  }
  if (type) {
    return EVENT_TO_KEY[type] ?? RITUAL_TO_KEY[type] ?? 'ritual';
  }
  return 'ritual';
}

/** CSS colour for a category — a token reference, never a literal. */
export function categoryColor(type?: string, subCategory?: string): string {
  return `var(--k-cat-${categoryFamily(type, subCategory)})`;
}

/** Tailwind text class, for when a class is more convenient than a style. */
export function categoryTextClass(type?: string, subCategory?: string): string {
  return `text-cat-${categoryFamily(type, subCategory)}`;
}

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  ritual: 'Human ritual',
  migration: 'Animal migration',
  flora: 'Bloom',
  atmospheric: 'Atmospheric',
  cosmic: 'Cosmic',
  unrest: 'Civil unrest'
};

/**
 * Marker glyphs, drawn on a 16x16 grid.
 *
 * Deliberately simple: these render at ~14px inside a map badge, where a
 * detailed path turns to mush. Two or three strokes each, closed shapes so
 * they can take a solid fill.
 */
export const CATEGORY_GLYPH: Record<CategoryKey, string> = {
  // Flame
  ritual: 'M8 1.5c2.2 2.4 3.4 4.2 3.4 6a3.4 3.4 0 0 1-6.8 0c0-1.1.4-2 1.2-3 .1 1 .6 1.6 1.3 1.8-.3-1.8.3-3.4.9-4.8Z',
  // Bird
  migration: 'M1.5 6.5c2 0 3.2-.8 4.3-2 .8-.9 1.4-1.3 2.2-1.3 1.5 0 2.4 1.1 2.9 2.2.4.9 1.1 1.4 2.6 1.6-1.2 1-2.2 1.3-3.4 1.1-.2 1.9-1.6 3.4-3.6 3.4-.6 0-1.1-.1-1.6-.4 1.4-.3 2.3-1.1 2.6-2.3-1.9.3-3.9-.6-6-2.3Z',
  // Blossom
  flora: 'M8 2.2c1.1 0 1.9.8 1.9 1.8 1-.5 2.1-.1 2.6.8.5.9.2 2-.7 2.6.9.6 1.2 1.7.7 2.6-.5.9-1.6 1.3-2.6.8 0 1-.8 1.8-1.9 1.8s-1.9-.8-1.9-1.8c-1 .5-2.1.1-2.6-.8-.5-.9-.2-2 .7-2.6-.9-.6-1.2-1.7-.7-2.6.5-.9 1.6-1.3 2.6-.8 0-1 .8-1.8 1.9-1.8Z',
  // Cloud with a bolt
  atmospheric: 'M4.4 10.5a2.9 2.9 0 0 1-.3-5.7 3.7 3.7 0 0 1 7.1.6 2.6 2.6 0 0 1 .2 5.1H9.2l1-2.3H7.5l-1.1 2.3Z',
  // Star
  cosmic: 'M8 1.6l1.7 4.1 4.4.3-3.4 2.8 1.1 4.3L8 10.7l-3.8 2.4 1.1-4.3-3.4-2.8 4.4-.3Z',
  // Raised hands / crowd
  unrest: 'M3.2 14V8.2a1 1 0 0 1 2 0v2.1h.6V6.4a1 1 0 0 1 2 0v3.9h.6V5.2a1 1 0 0 1 2 0v5.1h.6V7.4a1 1 0 0 1 2 0V14Z'
};

/**
 * Ritual sub-types share a colour but keep their own glyph, so a pilgrimage
 * still reads differently from a festival at 20px on the map.
 */
const RITUAL_GLYPH: Record<string, string> = {
  // Flame
  [RitualType.FESTIVAL]: CATEGORY_GLYPH.ritual,
  // Bowl / offering
  [RitualType.CEREMONY]:
    'M2.4 6.5h11.2c0 3.2-2.5 5.8-5.6 5.8S2.4 9.7 2.4 6.5Zm5.6-3.3c.7.6.7 1.3 0 2.1-.7-.8-.7-1.5 0-2.1Z',
  // Praying hands / arch
  [RitualType.SPIRITUAL]:
    'M8 1.8c2.6 0 4.7 2.1 4.7 4.7V14H9.4V8.2a1.4 1.4 0 0 0-2.8 0V14H3.3V6.5C3.3 3.9 5.4 1.8 8 1.8Z',
  // Footsteps
  [RitualType.PILGRIMAGE]:
    'M4.6 2.2c1 0 1.7 1 1.7 2.4 0 1.3-.6 2.3-1.6 2.3S3 5.9 3 4.6c0-1.4.6-2.4 1.6-2.4Zm-.2 6.2c1.1 0 1.8.6 1.8 1.5s-.6 1.4-.6 2.2c0 .7-.5 1.2-1.3 1.2s-1.4-.6-1.4-1.6c0-1.2.4-1.7.4-2.3 0-.6.3-1 1.1-1Zm7-7.4c1 0 1.6 1 1.6 2.3 0 1.4-.6 2.4-1.6 2.4S9.7 4.7 9.7 3.3c0-1.3.7-2.3 1.7-2.3Zm.2 6.1c.8 0 1.1.4 1.1 1 0 .6.4 1.1.4 2.3 0 1-.6 1.6-1.4 1.6s-1.3-.5-1.3-1.2c0-.8-.6-1.3-.6-2.2s.7-1.5 1.8-1.5Z',
  // Mask
  [RitualType.PERFORMANCE]:
    'M8 2c3 0 5.2 1 5.2 2.6 0 4.2-2.3 8.4-5.2 8.4S2.8 8.8 2.8 4.6C2.8 3 5 2 8 2Zm-2.3 4.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Zm4.6 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z',
  // Bolt
  [RitualType.PHENOMENON]: 'M9.6 1.4 4.2 8.9h3.1L6.4 14.6l5.4-7.9H8.6Z'
};

export function categoryGlyph(type?: string, subCategory?: string): string {
  if (type && RITUAL_GLYPH[type]) return RITUAL_GLYPH[type];
  return CATEGORY_GLYPH[categoryKey(type, subCategory)];
}

/**
 * Sub-category glyphs give the map more resolution than the six buckets.
 *
 * These are open paths inherited from the original marker set, so they must be
 * stroked rather than filled — a filled wave or sunburst looks like a blob.
 * `mode` records that, which is why glyphs are objects and not bare strings.
 */
export interface Glyph {
  d: string;
  mode: 'fill' | 'stroke';
}

const SUBCATEGORY_GLYPH: Array<[string[], string]> = [
  [['fire'], 'M8,2 C8,2 13,8 13,11 A5,5 0 0,1 3,11 C3,8 8,2 8,2Z M6.5,11 C6.5,9.5 8,8.5 9,10'],
  [['water'], 'M2,10 C4,7 6,12 8,9 C10,6 12,11 14,8'],
  [['dance', 'music', 'musical'], 'M11,2 L11,10 A3,3 0 1,0 8,10 M11,2 L7,4 L7,2Z'],
  [['light'], 'M8,8 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M8,1 L8,3 M8,13 L8,15 M1,8 L3,8 M13,8 L15,8 M3.5,3.5 L5,5 M11,11 L12.5,12.5 M12.5,3.5 L11,5 M5,11 L3.5,12.5'],
  [['harvest', 'flora', 'botanical'], 'M8,14 L8,7 M8,7 C8,7 4,4 4,1 C7,2 8,7 8,7 M8,7 C8,7 12,4 12,1 C9,2 8,7 8,7'],
  [['cosmic', 'solar', 'atmospheric'], 'M8,1 L9.8,6 L15,6 L10.8,9.2 L12.5,14.5 L8,11.5 L3.5,14.5 L5.2,9.2 L1,6 L6.2,6Z'],
  [['mountain', 'geological'], 'M8,2 L14,13 L2,13Z M5.5,13 L8,7.5 L10.5,13'],
  [['ancestor', 'trance', 'shamanic'], 'M2,9 Q8,3 14,9 Q8,15 2,9Z M8,6 A2.5,2.5 0 1,0 8,11 A2.5,2.5 0 1,0 8,6Z'],
  [['initiation', 'journey', 'pilgrimage'], 'M8,1 A2.5,2.5 0 1,0 8,6 A2.5,2.5 0 1,0 8,1Z M8,6 L7,11 L9,11Z M7,11 L5,14 M9,11 L11,14']
];

/**
 * The single glyph resolver every renderer uses — flat map, globe and list.
 * Previously each of those carried its own copy of this table, and they had
 * already drifted apart.
 */
export function glyphFor(type?: string, subCategory?: string): Glyph {
  const sub = (subCategory || '').toLowerCase();
  if (sub) {
    for (const [keys, d] of SUBCATEGORY_GLYPH) {
      if (keys.some(k => sub.includes(k))) return { d, mode: 'stroke' };
    }
  }
  if (type && RITUAL_GLYPH[type]) return { d: RITUAL_GLYPH[type], mode: 'fill' };
  return { d: CATEGORY_GLYPH[categoryKey(type, subCategory)], mode: 'fill' };
}
