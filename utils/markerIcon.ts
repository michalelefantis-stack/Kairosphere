import { Glyph, categoryColor, glyphFor } from './categoryTheme';

/**
 * The marker badge, built once for every renderer.
 *
 * The flat map, the 3D globe and the live layer each used to build their own
 * badge markup. They drifted: the globe stayed on a 20px badge with a 12px
 * glyph at 33% alpha and neon severity colours long after the flat map moved
 * on. Anything that changes how a marker looks belongs here, so the two views
 * cannot disagree again.
 */

export interface MarkerOptions {
  /** Ritual type or event category. */
  type?: string;
  subCategory?: string;
  /** Draws the pulsing ring — reserved for "happening now". */
  live?: boolean;
  selected?: boolean;
}

export const MARKER_HIT_SIZE = 40;

export function markerBadgeSize(selected = false): number {
  return selected ? 30 : 26;
}

/** Inner markup of a marker, without the hit-box wrapper. */
export function markerBadgeHtml(options: MarkerOptions = {}): string {
  const { type, subCategory, live = false, selected = false } = options;
  const color = categoryColor(type, subCategory);
  const glyph: Glyph = glyphFor(type, subCategory);
  const badge = markerBadgeSize(selected);
  const size = selected ? 17 : 15;

  // Open legacy paths have to be stroked; closed ones read better filled.
  const svgPaint =
    glyph.mode === 'stroke'
      ? `fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`
      : `fill="${color}" stroke="none"`;

  return `
    <div style="position:relative;width:${badge}px;height:${badge}px;display:flex;align-items:center;justify-content:center;">
      ${live ? `<span style="position:absolute;inset:-3px;border-radius:50%;border:2px solid ${color};opacity:.7;animation:custom-ping 1.6s cubic-bezier(0,0,.2,1) infinite;"></span>` : ''}
      <div style="
        width:${badge}px;height:${badge}px;border-radius:50%;
        background:color-mix(in srgb, ${color} 22%, #0d0c0b);
        border:${selected ? 2 : 1.5}px solid ${color};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 1px 4px rgb(0 0 0 / .5);
      ">
        <svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <path d="${glyph.d}" ${svgPaint}/>
        </svg>
      </div>
    </div>`;
}

/** Full marker including the hit box, for renderers that need one element. */
export function markerHtml(options: MarkerOptions = {}): string {
  return `
    <div style="width:${MARKER_HIT_SIZE}px;height:${MARKER_HIT_SIZE}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      ${markerBadgeHtml(options)}
    </div>`;
}

/**
 * "You are here". Deliberately not a category badge — it is the reader, not an
 * event — and deliberately the conventional blue rather than a brand colour.
 */
export function userMarkerHtml(): string {
  return `<div style="width:14px;height:14px;border-radius:50%;background:var(--k-user);border:2px solid #fff;box-shadow:0 0 0 1px rgb(0 0 0 / .4), 0 1px 4px rgb(0 0 0 / .5);"></div>`;
}

/** A plain location dot, for mini-maps that only need to show one point. */
export function dotMarkerHtml(color = 'var(--k-accent)'): string {
  return `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid var(--k-base);box-shadow:0 1px 4px rgb(0 0 0 / .5);"></div>`;
}
