import React from 'react';
import { Plane, Hotel, ArrowRight, Clock } from 'lucide-react';
import { CultureItem } from '../types';
import {
  EventAirports,
  Feasibility,
  feasibility,
  flightSearchUrl,
  loadTravelData,
  nearestDeparture,
  staySearchUrl
} from '../utils/travelPlan';

/**
 * The part of the trip nobody else can tell you.
 *
 * A flight search asks where you are going. For Naghol the honest answer is
 * "an airstrip on Pentecost Island called Lonorore, reached from Santo",
 * which is not something anyone types into a search box, and not something
 * Google Flights can offer because it has never heard of the event. The
 * distance from the runway to the site is the other half: 1.7km at Agadez
 * for Gerewol, 108km and a second flight for the land diving.
 *
 * Every figure here is derived from a coordinate or a date. There is no
 * availability, no price, and no suggestion that a route exists on the day
 * you want it — only how far, how long you have, and a search that opens
 * with the boxes filled in.
 */

interface GettingTherePanelProps {
  item: CultureItem;
  /** Enables the origin airport, when the reader has shared a location. */
  userCoords?: [number, number] | null;
}

/** Colour only where the timing genuinely presses. */
function runwayClass(runway: Feasibility['runway']): string {
  if (runway === 'too-late' || runway === 'past') return 'text-ink-faint';
  if (runway === 'tight') return 'text-live';
  if (runway === 'workable') return 'text-accent';
  return 'text-ink-dim';
}

const AirportRow: React.FC<{
  label: string;
  iata: string;
  name: string;
  km: number;
}> = ({ label, iata, name, km }) => (
  <div className="flex items-baseline gap-3">
    <span className="font-mono text-[15px] font-bold text-ink tabular-nums shrink-0 w-10">
      {iata}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] text-ink truncate">{name}</p>
      <p className="text-[12px] text-ink-faint">
        {label} · {Math.round(km)} km from the site
      </p>
    </div>
  </div>
);

const GettingTherePanel: React.FC<GettingTherePanelProps> = ({ item, userCoords }) => {
  const [airports, setAirports] = React.useState<EventAirports | null>(null);
  const [origin, setOrigin] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    loadTravelData().then(data => {
      if (!live) return;
      setAirports(data.airports[item.id] ?? null);
      if (userCoords) {
        const from = nearestDeparture(userCoords, data.departures);
        setOrigin(from?.iata ?? null);
      }
      setLoaded(true);
    });
    return () => { live = false; };
  }, [item.id, userCoords]);

  if (!loaded) return null;

  if (!airports) {
    return (
      <p className="text-[13px] text-ink-dim">
        No airport resolved for these coordinates.
      </p>
    );
  }

  const plan = feasibility(item, airports);
  const target = airports.gateway ?? airports.arrival;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-raised p-4 space-y-3">
        {airports.gateway && (
          <AirportRow
            label="Fly in here"
            iata={airports.gateway.iata}
            name={airports.gateway.name}
            km={airports.gateway.km}
          />
        )}
        <AirportRow
          label={airports.gateway ? 'Then on to' : 'Nearest airport'}
          iata={airports.arrival.iata}
          name={airports.arrival.name}
          km={airports.arrival.km}
        />

        {airports.gateway && (
          // The forgotten leg. Someone who books only the international
          // flight arrives in the right country and misses the event.
          <p className="text-[12px] text-ink-faint border-t border-line-soft pt-3">
            Two legs — allow a day between them.
          </p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 text-ink-faint mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className={`text-[14px] font-medium ${runwayClass(plan.runway)}`}>
            {plan.label}
          </p>
          {plan.arriveBy && plan.runway !== 'past' && plan.runway !== 'unknown' && (
            <p className="text-[12px] text-ink-faint mt-0.5">
              Be on the ground by{' '}
              {plan.arriveBy.toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
              {plan.groundDays > 0 && ', allowing for the last leg'}.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={flightSearchUrl({
            toIata: target.iata,
            fromIata: origin,
            date: plan.arriveBy
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3 rounded-xl bg-accent text-on-accent
                     text-[14px] font-semibold inline-flex items-center justify-center gap-2
                     active:bg-accent-hi transition-colors"
        >
          <Plane className="w-4 h-4" />
          {origin ? `${origin} → ${target.iata}` : `Flights to ${target.iata}`}
        </a>
        <a
          href={staySearchUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3 rounded-xl border border-line text-ink-dim
                     text-[14px] font-medium inline-flex items-center justify-center gap-2
                     active:text-ink active:border-line-hard transition-colors"
        >
          <Hotel className="w-4 h-4" />
          Stays
        </a>
      </div>

      {/* Says what the buttons are, so nobody mistakes a handoff for a
          booking the app is standing behind. */}
      <p className="text-[11px] text-ink-faint inline-flex items-center gap-1">
        Opens a search elsewhere with the dates filled in
        <ArrowRight className="w-3 h-3" />
      </p>
    </div>
  );
};

export default GettingTherePanel;
