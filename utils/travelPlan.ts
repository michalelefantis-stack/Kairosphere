import { CultureItem } from '../types';
import { calculateDistance } from './geo';
import { fetchContent } from './contentSource';

/**
 * How you would actually get there, and whether there is still time.
 *
 * This is the question a flight search cannot answer, because a flight
 * search does not know the event exists. It asks where you are going; for
 * most of this catalogue that is the hard part. Nobody knows the code for
 * the airstrip on Pentecost Island, and the trip dies at "I don't even know
 * how you'd get there" long before it gets to a price.
 *
 * So the app answers it: which airport, how far from the site, how long you
 * have left to arrange it, and a search that opens with the boxes already
 * filled in.
 *
 * What it deliberately does not do is pretend to know about flights. There
 * is no availability here, no price, no claim that a route exists. Every
 * number below comes from a coordinate or a date. The moment this starts
 * implying "you can make it" rather than "here is how long you have", it is
 * lying to someone about a trip that costs thousands.
 */

const DAY_MS = 86400000;

export interface Airport {
  iata: string;
  name: string;
  place: string;
  km: number;
  type: string;
}

export interface EventAirports {
  /** Closest strip with an IATA code — where you actually land. */
  arrival: Airport;
  /** Closest airport reachable from abroad, when that is somewhere else. */
  gateway?: Airport;
}

interface DepartureAirport {
  iata: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
}

interface TravelData {
  airports: Record<string, EventAirports>;
  departures: DepartureAirport[];
}

let cache: TravelData | null = null;
let inFlight: Promise<TravelData> | null = null;

export function loadTravelData(): Promise<TravelData> {
  if (cache) return Promise.resolve(cache);
  // Memoise the request, not only its result. The guard below tested the
// resolved value, so two components mounting in the same tick both saw an
// empty cache and both fetched the file — every one of these was pulled
// twice on a cold start, catalogue.json included, and that one is 300KB.
  inFlight ??= fetchContent<Partial<TravelData>>('event_airports.json', {})
    .then(payload => {
      cache = {
        airports: payload.airports ?? {},
        departures: payload.departures ?? []
      };
      return cache;
    });
  return inFlight;
}

/** Where this reader would fly from — nearest large scheduled airport. */
export function nearestDeparture(
  coords: [number, number],
  departures: DepartureAirport[]
): DepartureAirport | null {
  let best: DepartureAirport | null = null;
  let bestKm = Infinity;
  for (const airport of departures) {
    const km = calculateDistance(coords[0], coords[1], airport.lat, airport.lon) / 1000;
    if (km < bestKm) {
      best = airport;
      bestKm = km;
    }
  }
  return best;
}

export type Runway = 'past' | 'too-late' | 'tight' | 'workable' | 'early' | 'unknown';

export interface Feasibility {
  runway: Runway;
  /** Days from today to the first day of the event. */
  daysUntil: number;
  /** Plain statement of how much time is left, never a promise. */
  label: string;
  /** Last sensible day to be travelling, allowing for the ground leg. */
  arriveBy: Date | null;
  /** Extra days needed after the international leg, if any. */
  groundDays: number;
}

/**
 * How long is left, allowing for the journey after the plane.
 *
 * The ground leg is the part people forget. Gerewol is 1.7km from Agadez,
 * which is easy; Naghol is a 108km hop from Santo to a grass strip, which is
 * a day and a flight of its own.
 */
export function feasibility(
  item: CultureItem,
  airports: EventAirports | null,
  now: Date = new Date()
): Feasibility {
  const start = new Date(item.startDate).getTime();
  const groundDays = groundLegDays(airports);

  if (Number.isNaN(start) || item.dateIsUnconfirmed) {
    return {
      runway: 'unknown',
      daysUntil: NaN,
      label: 'No confirmed date to plan against',
      arriveBy: null,
      groundDays
    };
  }

  const daysUntil = Math.ceil((start - now.getTime()) / DAY_MS);
  // Be on the ground the day before, plus whatever the last leg costs.
  const arriveBy = new Date(start - (1 + groundDays) * DAY_MS);
  const usable = daysUntil - (1 + groundDays);

  if (daysUntil < 0) {
    return { runway: 'past', daysUntil, label: 'Already started', arriveBy, groundDays };
  }
  if (usable <= 1) {
    return {
      runway: 'too-late',
      daysUntil,
      label: 'Only if you are already in the region',
      arriveBy,
      groundDays
    };
  }
  if (usable <= 14) {
    return {
      runway: 'tight',
      daysUntil,
      label: `${usable} days to arrange it`,
      arriveBy,
      groundDays
    };
  }
  if (usable <= 60) {
    return {
      runway: 'workable',
      daysUntil,
      label: `${usable} days to arrange it`,
      arriveBy,
      groundDays
    };
  }
  return {
    runway: 'early',
    daysUntil,
    label: `${Math.round(usable / 30)} months out`,
    arriveBy,
    groundDays
  };
}

/** Days the journey after the international flight is likely to cost. */
function groundLegDays(airports: EventAirports | null): number {
  if (!airports) return 0;
  // A separate gateway means a second flight, which realistically means a
  // night somewhere.
  if (airports.gateway) return 1;
  // Otherwise it is a transfer from the airport you landed at.
  if (airports.arrival.km > 150) return 1;
  return 0;
}

/**
 * A flight search that opens on results rather than an empty form.
 *
 * Google Flights because it needs no account and no approval, so this works
 * from day one. It is also the single place to swap in an affiliate deep
 * link — Travelpayouts, Skyscanner or whoever — without touching any
 * component, since nothing else in the app builds a booking URL.
 */
export function flightSearchUrl(opts: {
  toIata: string;
  fromIata?: string | null;
  date?: Date | null;
}): string {
  const parts = ['Flights', 'to', opts.toIata];
  if (opts.fromIata) parts.push('from', opts.fromIata);
  if (opts.date && !Number.isNaN(opts.date.getTime())) {
    parts.push('on', opts.date.toISOString().slice(0, 10));
  }
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`;
}

/**
 * Somewhere to sleep, near the event rather than near the airport.
 *
 * Uses the event's own region, because for most of this catalogue the
 * nearest town to the site is not the city with the airport in it.
 */
export function staySearchUrl(item: CultureItem): string {
  const checkin = new Date(item.startDate);
  const checkout = new Date(item.endDate || item.startDate);
  const iso = (d: Date) =>
    Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);

  const params = new URLSearchParams({ ss: item.region });
  if (iso(checkin)) params.set('checkin', iso(checkin));
  if (iso(checkout)) params.set('checkout', iso(checkout));

  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
