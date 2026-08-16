import { UnifiedEvent } from '../types';
import { calculateDistance } from './geo';

/**
 * Turning event data into the phrases a reader actually wants.
 *
 * The old row led with a clock time (when the scraper ran) and a severity
 * level. Neither answers the question someone opens this app with: can I get
 * to this, and is it still on?
 */

const DAY_MS = 86400000;

export type EventBucket = 'now' | 'soon' | 'later';

/** Which section of the list an event belongs in. */
export function bucketFor(event: UnifiedEvent, now: number = Date.now()): EventBucket {
  if (now >= event.startTime && now <= event.endTime) return 'now';
  if (event.startTime - now <= 7 * DAY_MS) return 'soon';
  return 'later';
}

export const BUCKET_LABEL: Record<EventBucket, string> = {
  now: 'Happening now',
  soon: 'This week',
  later: 'On the horizon'
};

/**
 * Timing as a human sentence.
 *
 * Relative for anything close ("ends tomorrow", "opens in 3 days") because
 * that is what governs whether a trip is possible; absolute further out, where
 * a date is more useful than a countdown.
 */
export function timingLabel(event: UnifiedEvent, now: number = Date.now()): string {
  const startsIn = event.startTime - now;
  const endsIn = event.endTime - now;

  if (now >= event.startTime && now <= event.endTime) {
    const days = Math.round(endsIn / DAY_MS);
    if (endsIn < DAY_MS) return 'Ends today';
    if (days <= 1) return 'Ends tomorrow';
    if (days <= 14) return `${days} days left`;
    return `Until ${formatDate(event.endTime)}`;
  }

  if (startsIn > 0) {
    const days = Math.ceil(startsIn / DAY_MS);
    if (days <= 1) return 'Opens tomorrow';
    if (days <= 14) return `Opens in ${days} days`;
    return `Opens ${formatDate(event.startTime)}`;
  }

  return `Ended ${formatDate(event.endTime)}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

/**
 * Distance, rounded to the precision the number deserves. Nobody needs
 * "11,432 km" — the useful distinction is near, far, or a flight away.
 */
export function distanceLabel(
  event: UnifiedEvent,
  userCoords?: [number, number] | null
): string | null {
  if (!userCoords || !event.coordinates) return null;
  const metres = calculateDistance(
    userCoords[0], userCoords[1],
    event.coordinates[0], event.coordinates[1]
  );
  const km = metres / 1000;
  if (km < 1) return 'less than 1 km away';
  if (km < 10) return `${km.toFixed(1)} km away`;
  if (km < 1000) return `${Math.round(km)} km away`;
  return `${Math.round(km / 100) * 100} km away`;
}

export function distanceKm(
  event: UnifiedEvent,
  userCoords?: [number, number] | null
): number | null {
  if (!userCoords || !event.coordinates) return null;
  return calculateDistance(
    userCoords[0], userCoords[1],
    event.coordinates[0], event.coordinates[1]
  ) / 1000;
}

export function placeLabel(event: UnifiedEvent): string {
  if (event.location && event.country && event.country !== event.location) {
    return `${event.location}, ${event.country}`;
  }
  return event.location || event.country || 'Location unconfirmed';
}

/** "updated 14 minutes ago" for the feed status line. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const mins = Math.round((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
