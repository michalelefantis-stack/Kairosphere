import React from 'react';
import {
  AlertTriangle, Archive, Backpack, CalendarDays, Compass, MapPin, Plane, X
} from 'lucide-react';
import { CultureItem } from '../types';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import {
  Trip,
  clusterIntoTrips,
  eventsInWindow,
  findConflicts,
  formatRange,
  leadTime,
  presetWindows
} from '../utils/tripPlanner';

interface ItineraryViewProps {
  allEvents: CultureItem[];
  savedEvents: CultureItem[];
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  onViewInsights: (item: CultureItem) => void;
}

/**
 * The itinerary tab.
 *
 * Replaces a "Where / When" search that matched substrings against the region
 * field and the month's name — strictly less capable than the map's own
 * filters, and silently empty for "summer" or "March–April".
 *
 * The query is inverted instead: the reader supplies the dates they are free
 * and the app answers what is on. That is the one question the map cannot
 * answer, and it is answerable only because the timing data is good.
 */

const URGENCY_STYLE: Record<string, string> = {
  imminent: 'text-live',
  soon: 'text-accent',
  planning: 'text-ink-dim',
  distant: 'text-ink-faint',
  past: 'text-ink-faint'
};

const CategoryMark: React.FC<{ item: CultureItem; size?: number }> = ({ item, size = 16 }) => (
  <svg
    width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"
    className="shrink-0" style={{ color: categoryColor(item.ritualType, item.subCategory) }}
  >
    <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
  </svg>
);

const EventRow: React.FC<{
  item: CultureItem;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onOpen: (item: CultureItem) => void;
}> = ({ item, saved, onToggleSave, onOpen }) => {
  const lead = leadTime(item);
  return (
    <li className="flex items-start gap-3 py-3 border-b border-line-soft last:border-0">
      <CategoryMark item={item} />
      <button onClick={() => onOpen(item)} className="flex-1 min-w-0 text-left group">
        <p className="text-[15px] font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
          {item.title}
        </p>
        <p className="text-[13px] text-ink-dim truncate">{item.preciseLocation || item.region}</p>
        <p className="text-[13px] mt-0.5">
          <span className={URGENCY_STYLE[lead.urgency]}>{lead.label}</span>
          {item.dateIsUnconfirmed ? (
            <span className="text-ink-faint"> · date not confirmed</span>
          ) : item.dateIsMovable ? (
            <span className="text-ink-faint"> · date varies by lunar calendar</span>
          ) : (
            <span className="text-ink-faint">
              {' '}· {formatRange(new Date(item.startDate), new Date(item.endDate || item.startDate))}
            </span>
          )}
        </p>
      </button>
      <button
        onClick={() => onToggleSave(item.id)}
        title={saved ? 'Remove from itinerary' : 'Save to itinerary'}
        className={`p-2 rounded-lg border transition-colors shrink-0 ${
          saved
            ? 'bg-accent text-on-accent border-accent'
            : 'border-line text-ink-faint hover:text-ink hover:border-line-hard'
        }`}
      >
        {saved ? <X className="w-4 h-4" /> : <Backpack className="w-4 h-4" />}
      </button>
    </li>
  );
};

const TripCard: React.FC<{
  trip: Trip;
  index: number;
  onToggleSave: (id: string) => void;
  onOpen: (item: CultureItem) => void;
}> = ({ trip, index, onToggleSave, onOpen }) => {
  const lead = leadTime(trip.events[0]);
  // One search per journey, not one per event — the affiliate link belongs to
  // the trip, which is also the honest unit to monetise.
  const destination = trip.regions[0].split(',').pop()?.trim() ?? trip.regions[0];

  return (
    <article className="bg-panel border border-line rounded-2xl overflow-hidden">
      <header className="p-5 border-b border-line-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Trip {index + 1}
            </p>
            <h3 className="text-lg font-semibold text-ink mt-0.5 truncate">
              {trip.regions.slice(0, 2).join(' · ')}
              {trip.regions.length > 2 && ` +${trip.regions.length - 2}`}
            </h3>
          </div>
          <span className={`text-[13px] font-medium shrink-0 ${URGENCY_STYLE[lead.urgency]}`}>
            {lead.label}
          </span>
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px]">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-ink-faint" />
            <dd className="text-ink">{formatRange(trip.start, trip.end)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-ink-faint" />
            <dd className="text-ink">
              {trip.events.length} {trip.events.length === 1 ? 'event' : 'events'} over{' '}
              {trip.spanDays} days
            </dd>
          </div>
          {trip.spreadKm > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-ink-faint" />
              <dd className="text-ink">{trip.spreadKm} km apart</dd>
            </div>
          )}
        </dl>
      </header>

      <ul className="px-5">
        {trip.events.map(event => (
          <EventRow
            key={event.id}
            item={event}
            saved
            onToggleSave={onToggleSave}
            onOpen={onOpen}
          />
        ))}
      </ul>

      <footer className="p-5 pt-4 flex flex-wrap gap-2 border-t border-line-soft">
        <a
          href={`https://www.tourradar.com/search?q=${encodeURIComponent(destination)}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-accent text-on-accent rounded-lg text-[13px] font-semibold hover:bg-accent-hi transition-colors"
        >
          <Compass className="w-4 h-4" /> Tours in {destination}
        </a>
        <a
          href={`https://www.google.com/travel/flights?q=${encodeURIComponent(`flights to ${destination}`)}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-line text-ink-dim rounded-lg text-[13px] font-medium hover:text-ink hover:border-line-hard transition-colors"
        >
          <Plane className="w-4 h-4" /> Flights
        </a>
        <a
          href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${trip.start.toISOString().slice(0, 10)}&checkout=${trip.end.toISOString().slice(0, 10)}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-line text-ink-dim rounded-lg text-[13px] font-medium hover:text-ink hover:border-line-hard transition-colors"
        >
          <MapPin className="w-4 h-4" /> Stays for these dates
        </a>
      </footer>
    </article>
  );
};

const ItineraryView: React.FC<ItineraryViewProps> = ({
  allEvents, savedEvents, savedIds, onToggleSave, onViewInsights
}) => {
  const presets = React.useMemo(() => presetWindows(), []);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  const window = React.useMemo(() => {
    if (!from || !to) return null;
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return { from: start, to: end };
  }, [from, to]);

  const matches = React.useMemo(
    () => (window ? eventsInWindow(allEvents, window) : []),
    [allEvents, window]
  );

  const trips = React.useMemo(() => clusterIntoTrips(savedEvents), [savedEvents]);
  const conflicts = React.useMemo(() => findConflicts(trips), [trips]);

  const applyPreset = (preset: { from: Date; to: Date }) => {
    setFrom(preset.from.toISOString().slice(0, 10));
    setTo(preset.to.toISOString().slice(0, 10));
  };

  return (
    <div className="w-full h-full p-6 md:p-10 pt-16 sm:pt-[100px] md:pt-[120px] pb-safe-tab overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto space-y-12">

        {/* ── When are you free? ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">When can you travel?</h2>
          <p className="text-[14px] text-ink-dim mt-1 max-w-prose">
            Give your dates and see what is actually happening then. The map answers where
            something is; this answers what is on while you are free.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.window)}
                className="px-3 py-1.5 rounded-full border border-line text-[13px] text-ink-dim hover:text-ink hover:border-line-hard transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <label className="flex-1">
              <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-1.5">
                From
              </span>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full bg-raised border border-line rounded-lg px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-1.5">
                To
              </span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={e => setTo(e.target.value)}
                className="w-full bg-raised border border-line rounded-lg px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>

          {window && (
            <div className="mt-6">
              <h3 className="text-[13px] text-ink-dim">
                <span className="font-semibold text-ink">{matches.length}</span>{' '}
                {matches.length === 1 ? 'event' : 'events'} between{' '}
                {formatRange(window.from, window.to)}
              </h3>
              {matches.length > 0 ? (
                <ul className="mt-2">
                  {matches.slice(0, 25).map(item => (
                    <EventRow
                      key={item.id}
                      item={item}
                      saved={savedIds.has(item.id)}
                      onToggleSave={onToggleSave}
                      onOpen={onViewInsights}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-ink-faint mt-2">
                  Nothing in the catalogue falls in that window. Try a wider range.
                </p>
              )}
              {matches.length > 25 && (
                <p className="text-[13px] text-ink-faint mt-3">
                  Showing the first 25 of {matches.length}. Narrow the window to see fewer.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Saved, grouped into journeys ───────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Your trips</h2>
            {savedEvents.length > 0 && (
              <span className="text-[13px] text-ink-faint">
                {savedEvents.length} saved · {trips.length} {trips.length === 1 ? 'journey' : 'journeys'}
              </span>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
              <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <div className="text-[13px] text-ink leading-relaxed space-y-1">
                {conflicts.map((c, i) => (
                  <p key={i}>
                    <span className="font-semibold">{c.a.regions[0]}</span> and{' '}
                    <span className="font-semibold">{c.b.regions[0]}</span> overlap by{' '}
                    {c.overlapDays} {c.overlapDays === 1 ? 'day' : 'days'} and sit{' '}
                    {c.km.toLocaleString('en-GB')} km apart —{' '}
                    {c.severity === 'impossible'
                      ? 'you will have to choose.'
                      : 'doable only with a flight in between.'}
                  </p>
                ))}
              </div>
            </div>
          )}

          {savedEvents.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-2xl">
              <Backpack className="w-10 h-10 text-ink-faint mb-3" />
              <p className="text-[15px] font-medium text-ink">Nothing saved yet</p>
              <p className="text-[13px] text-ink-faint mt-1.5 max-w-xs text-center leading-snug">
                Save events from the list, the map, or a date search above, and anything close
                in time and place will be grouped into a trip.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {trips.map((trip, i) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  index={i}
                  onToggleSave={onToggleSave}
                  onOpen={onViewInsights}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ItineraryView;
