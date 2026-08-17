import React from 'react';
import { MapPin, Navigation, Loader2, CalendarDays } from 'lucide-react';
import { CultureItem } from '../types';
import { rankNearby, RankedEvent } from '../utils/nearby';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import { leadTime } from '../utils/tripPlanner';

/**
 * The phone's home screen.
 *
 * The map used to be home, and on a 375px screen that was the wrong choice.
 * Measured on an iPhone-sized viewport, the event list got 190px — 23% of the
 * display — while the map and four permanently-open filter rows took the
 * rest. The map was also the half that cannot answer the question: it has no
 * time axis, it cannot rank, and at world zoom it renders 373 events as a
 * dozen overlapping smudges.
 *
 * So the list is home and the map is a view you switch to. The ordering is
 * the product: near and soon first, computed in utils/nearby.
 *
 * Every card carries the four facts that decide whether to go — what it is,
 * how far, when, and how confident the date is. Distance in particular was
 * absent from the whole app, which for a reader who is already on the road is
 * half of the decision missing.
 */

interface NearbyFeedProps {
  items: CultureItem[];
  userCoords: [number, number] | null;
  isRequestingLocation: boolean;
  geoError: string | null;
  onRequestLocation: () => void;
  onSelect: (item: CultureItem) => void;
  /** Rendered above the list — local reports, staleness notices. */
  children?: React.ReactNode;
}

/** Photo, or the category glyph when there is no photo we can vouch for. */
const Thumb: React.FC<{ item: CultureItem }> = ({ item }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [item.id]);

  const showGlyph = failed || !item.imageUrl;

  return (
    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 bg-hover border border-line flex items-center justify-center">
      {showGlyph ? (
        <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true"
             style={{ color: categoryColor(item.ritualType, item.subCategory), opacity: 0.5 }}>
          <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
        </svg>
      ) : (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

const Card: React.FC<{ ranked: RankedEvent; onSelect: (i: CultureItem) => void }> = ({
  ranked,
  onSelect
}) => {
  const { item, reach } = ranked;
  const lead = leadTime(item);

  // Only imminence earns colour. If everything is highlighted the highlight
  // stops meaning anything, and "in 4 months" is not news.
  const whenClass =
    item.dateIsUnconfirmed ? 'text-ink-faint'
      : lead.urgency === 'imminent' ? 'text-live'
      : lead.urgency === 'soon' ? 'text-accent'
      : 'text-ink-dim';

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      // select-none: tapping a row used to select the word under the finger
      // instead of opening the event.
      className="w-full flex gap-3 px-4 py-3 text-left select-none active:bg-hover
                 transition-colors border-b border-line-soft"
    >
      <Thumb item={item} />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink leading-snug line-clamp-2">
          {item.title}
        </p>
        <p className="text-[13px] text-ink-dim mt-0.5 truncate">{item.region}</p>

        <div className="flex items-center gap-2 mt-1.5 text-[13px]">
          {reach && (
            <span className="inline-flex items-center gap-1 text-ink font-medium tabular-nums">
              <Navigation className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
              {reach.label}
            </span>
          )}
          {reach && <span className="text-ink-faint" aria-hidden="true">·</span>}
          <span className={whenClass}>
            {item.dateIsUnconfirmed ? 'Date not confirmed' : lead.label}
          </span>
        </div>
      </div>
    </button>
  );
};

/**
 * Asking for location.
 *
 * Phrased as what the reader gets, not as what the app wants. The feed still
 * works without it — ordered by timing alone — so this is an offer rather
 * than a gate, and it says where the coordinates go, because for an app whose
 * local feeds are resolved on-device that is a real answer and worth giving.
 */
const LocationPrompt: React.FC<{
  isRequesting: boolean;
  error: string | null;
  onRequest: () => void;
}> = ({ isRequesting, error, onRequest }) => (
  <div className="mx-4 my-3 p-4 rounded-2xl border border-line bg-raised">
    <p className="text-[14px] font-semibold text-ink">Sort by what you can actually reach</p>
    <p className="text-[13px] text-ink-dim mt-1 leading-relaxed">
      Without your location this list is ordered by date alone. Your coordinates
      stay on the device — the country is resolved here, not on a server.
    </p>
    <button
      type="button"
      onClick={onRequest}
      disabled={isRequesting}
      className="mt-3 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl
                 bg-accent text-on-accent text-[14px] font-semibold
                 active:bg-accent-hi disabled:opacity-60 transition-colors"
    >
      {isRequesting
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding you…</>
        : <><MapPin className="w-4 h-4" /> Use my location</>}
    </button>
    {error && (
      <p className="text-[12px] text-ink-faint mt-2">
        Location unavailable — {error}. The list below is ordered by date.
      </p>
    )}
  </div>
);

const NearbyFeed: React.FC<NearbyFeedProps> = ({
  items,
  userCoords,
  isRequestingLocation,
  geoError,
  onRequestLocation,
  onSelect,
  children
}) => {
  const ranked = React.useMemo(
    () => rankNearby(items, userCoords),
    [items, userCoords]
  );

  return (
    <div
      className="h-full overflow-y-auto custom-scrollbar overscroll-contain"
      // Clears the floating chrome at both ends. Padding rather than a
      // shorter viewport, so the list still scrolls the full height and
      // content passes under the glass instead of stopping at it.
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
    >
      {children}

      {!userCoords && (
        <LocationPrompt
          isRequesting={isRequestingLocation}
          error={geoError}
          onRequest={onRequestLocation}
        />
      )}

      <p className="px-4 pt-3 pb-2 text-[12px] text-ink-faint">
        {userCoords
          ? `${ranked.length} events, nearest and soonest first`
          : `${ranked.length} events, soonest first`}
      </p>

      {ranked.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <CalendarDays className="w-8 h-8 text-ink-faint mx-auto mb-3" />
          <p className="text-[14px] text-ink-dim">Nothing matches these filters.</p>
        </div>
      ) : (
        ranked.map(r => <Card key={r.item.id} ranked={r} onSelect={onSelect} />)
      )}

      {/* Clears the floating tab pill and the map switch above it, so the
          last card can be scrolled clear of both. */}
      <div className="h-40" aria-hidden="true" />
    </div>
  );
};

export default NearbyFeed;
