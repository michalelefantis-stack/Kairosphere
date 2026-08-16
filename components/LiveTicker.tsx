import React from 'react';
import { UnifiedEvent } from '../types';
import { AlertCircle, ChevronRight, Loader2, MapPin, Navigation } from 'lucide-react';
import LiveDetailPanel from './LiveDetailPanel';
import { ConfidenceChip } from './ConfidenceBadge';
import LocalReports from './LocalReports';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import {
  BUCKET_LABEL,
  EventBucket,
  bucketFor,
  distanceKm,
  distanceLabel,
  placeLabel,
  relativeTime,
  timingLabel
} from '../utils/eventFormat';

interface LiveTickerProps {
  events: UnifiedEvent[];
  onEventClick: (event: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onCloseDetail: () => void;
  userCoords?: [number, number] | null;
  feedIsStale?: boolean;
  feedGeneratedAt?: number | null;
}

const NEARBY_RADIUS_KM = 2000;

/** Category glyph, drawn at a size you can actually see. */
const CategoryMark: React.FC<{ event: UnifiedEvent }> = ({ event }) => (
  <svg
    width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
    className="shrink-0 mt-[3px]"
    style={{ color: categoryColor(event.category) }}
  >
    <path d={categoryGlyph(event.category)} fill="currentColor" />
  </svg>
);

const LiveTicker: React.FC<LiveTickerProps> = ({
  events, onEventClick, selectedEvent, onCloseDetail, userCoords, feedIsStale, feedGeneratedAt
}) => {
  const [nearbyOnly, setNearbyOnly] = React.useState(false);
  const now = Date.now();

  const visible = React.useMemo(() => {
    const list = userCoords && nearbyOnly
      ? events.filter(e => {
          const km = distanceKm(e, userCoords);
          return km !== null && km <= NEARBY_RADIUS_KM;
        })
      : events;

    // Within a section, proximity is the deciding factor when we know where
    // the reader is — "can I get there" beats "how sure are we". Without a
    // location, fall back to confidence.
    return [...list].sort((a, b) => {
      if (userCoords) {
        const da = distanceKm(a, userCoords) ?? Infinity;
        const db = distanceKm(b, userCoords) ?? Infinity;
        if (Math.abs(da - db) > 1) return da - db;
      }
      const ca = a.provenance?.confidence ?? 0.5;
      const cb = b.provenance?.confidence ?? 0.5;
      if (Math.abs(ca - cb) > 0.001) return cb - ca;
      return a.startTime - b.startTime;
    });
  }, [events, nearbyOnly, userCoords]);

  const sections = React.useMemo(() => {
    const groups: Record<EventBucket, UnifiedEvent[]> = { now: [], soon: [], later: [] };
    visible.forEach(e => groups[bucketFor(e, now)].push(e));
    return (['now', 'soon', 'later'] as EventBucket[])
      .map(key => ({ key, events: groups[key] }))
      .filter(section => section.events.length > 0);
  }, [visible, now]);

  return (
    <div className="h-full bg-transparent flex flex-col w-full relative">
      {/* Header */}
      <div className="px-4 pb-3 pt-[80px] border-b border-line">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-xl font-bold tracking-tight text-ink">Happening now</h2>
          <button
            onClick={() => setNearbyOnly(!nearbyOnly)}
            disabled={!userCoords}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              nearbyOnly
                ? 'bg-accent text-on-accent border-accent'
                : 'bg-transparent text-ink-dim border-line hover:text-ink hover:border-line-hard'
            } ${!userCoords ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={userCoords ? 'Show only events within 2,000 km' : 'Enable location to filter by distance'}
          >
            <Navigation className="w-3.5 h-3.5" />
            {nearbyOnly ? 'Near me' : 'Everywhere'}
          </button>
        </div>

        {/* Real status, not invented telemetry. */}
        <p className="text-[12px] text-ink-faint">
          {visible.length} {visible.length === 1 ? 'event' : 'events'}
          {feedGeneratedAt ? ` · updated ${relativeTime(feedGeneratedAt, now)}` : ''}
          {nearbyOnly ? ` · within ${NEARBY_RADIUS_KM.toLocaleString()} km` : ''}
        </p>
      </div>

      {feedIsStale && (
        <div className="px-4 py-2 bg-gold/10 border-b border-gold/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-gold shrink-0 mt-px" />
          <span className="text-[12px] text-gold leading-snug">
            This feed hasn’t refreshed recently, so the confidence shown has decayed.
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {selectedEvent ? (
          <div className="absolute inset-0 z-10 bg-transparent">
            <LiveDetailPanel event={selectedEvent} onClose={onCloseDetail} />
          </div>
        ) : (
          <div className="pb-4">
            {events.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin mb-3 text-accent" />
                <span className="text-[13px] text-ink-dim">Finding what’s happening…</span>
              </div>
            )}

            {events.length > 0 && visible.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full mt-10">
                <MapPin className="w-8 h-8 mb-3 text-ink-faint" />
                <span className="text-[14px] font-semibold text-ink">
                  Nothing within {NEARBY_RADIUS_KM.toLocaleString()} km
                </span>
                <span className="text-[13px] text-ink-faint mt-1.5 max-w-[240px] leading-snug">
                  Switch to Everywhere to see what’s happening elsewhere in the world.
                </span>
              </div>
            )}

            {/* Unconfirmed press reports sit below the verified feed, never
                mixed into it. */}
            <LocalReports userCoords={userCoords} />

            {sections.map(section => (
              <section key={section.key}>
                <h3 className="sticky top-0 z-10 px-4 py-1.5 bg-panel/95 backdrop-blur-sm text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint border-b border-line-soft">
                  {BUCKET_LABEL[section.key]}
                  <span className="ml-1.5 text-ink-faint/70">{section.events.length}</span>
                </h3>

                <ul>
                  {section.events.map(event => {
                    const distance = distanceLabel(event, userCoords);
                    const live = section.key === 'now';
                    return (
                      <li key={event.uuid}>
                        <button
                          onClick={() => onEventClick(event)}
                          className="w-full text-left px-4 py-3 border-b border-line-soft hover:bg-hover/60 transition-colors group flex gap-2.5"
                        >
                          <CategoryMark event={event} />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <h4 className="text-[15px] font-semibold text-ink leading-snug flex-1 min-w-0">
                                {event.title}
                              </h4>
                              <ChevronRight className="w-4 h-4 text-ink-faint shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <p className="text-[13px] text-ink-dim mt-0.5 truncate">
                              {placeLabel(event)}
                            </p>

                            <p className="text-[13px] mt-0.5">
                              <span className={live ? 'text-live font-medium' : 'text-ink-dim'}>
                                {timingLabel(event, now)}
                              </span>
                              {distance && <span className="text-ink-faint"> · {distance}</span>}
                            </p>

                            {event.provenance && (
                              <div className="mt-2">
                                <ConfidenceChip provenance={event.provenance} />
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTicker;
