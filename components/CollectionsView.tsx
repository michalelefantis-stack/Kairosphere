import React from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { CultureItem } from '../types';
import { populatedCollections, PopulatedCollection } from '../utils/collections';
import { reachFrom } from '../utils/nearby';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import { leadTime } from '../utils/tripPlanner';

/**
 * Browsing by theme instead of by date or distance.
 *
 * The rest of the app is built for someone already travelling. This is for
 * the other half of the question — where to go at all — which no amount of
 * sorting by proximity answers, because the reader has no location in mind
 * yet and no dates to filter by.
 *
 * Collections are shown as strips rather than a grid: a strip states how
 * many there are and shows four, which is enough to convey what the theme
 * means without pretending the whole set fits on a phone.
 */

/** Small tile used inside a collection strip. */
const Tile: React.FC<{ item: CultureItem; onSelect: (i: CultureItem) => void }> = ({
  item,
  onSelect
}) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [item.id]);
  const verified = !!(item as any).imageCredit;
  const showPhoto = verified && !!item.imageUrl && !failed;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="shrink-0 w-[150px] text-left select-none active:opacity-80 transition-opacity"
    >
      <div className="w-[150px] h-[110px] rounded-xl overflow-hidden bg-hover border border-line
                      flex items-center justify-center">
        {showPhoto ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <svg width="26" height="26" viewBox="0 0 16 16" aria-hidden="true"
               style={{ color: categoryColor(item.ritualType, item.subCategory), opacity: 0.45 }}>
            <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
          </svg>
        )}
      </div>
      {/* Two lines' worth of space whether the title needs it or not, so the
          dates sit on one line across the strip instead of stepping up and
          down with every title length. */}
      <p className="text-[13px] font-medium text-ink leading-snug mt-1.5 line-clamp-2 min-h-[34px]">
        {item.title}
      </p>
      <p className="text-[12px] text-ink-faint truncate">{item.region}</p>
      {/* What, where, when — the same order as the feed cards, so moving
          between the two screens does not mean re-learning where to look.
          A tile without a date is browsing; with one it is planning. */}
      <p className={`text-[12px] mt-0.5 truncate ${tileWhenClass(item)}`}>
        {item.dateIsUnconfirmed ? 'Date not confirmed' : leadTime(item).label}
      </p>
    </button>
  );
};

/** Only imminence earns colour, or the highlight stops meaning anything. */
function tileWhenClass(item: CultureItem): string {
  if (item.dateIsUnconfirmed) return 'text-ink-faint';
  const urgency = leadTime(item).urgency;
  if (urgency === 'imminent') return 'text-live';
  if (urgency === 'soon') return 'text-accent';
  return 'text-ink-dim';
}

/** One row in a collection, with the save control on it. */
const Row: React.FC<{
  item: CultureItem;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onSelect: (i: CultureItem) => void;
}> = ({ item, saved, onToggleSave, onSelect }) => {
  const lead = leadTime(item);
  const photo = (item as any).imageCredit && item.imageUrl;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-line-soft">
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex gap-3 flex-1 min-w-0 text-left select-none active:opacity-80"
      >
        <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden bg-hover
                        border border-line flex items-center justify-center">
          {photo ? (
            <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
                 className="w-full h-full object-cover" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"
                 style={{ color: categoryColor(item.ritualType, item.subCategory), opacity: 0.5 }}>
              <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink leading-snug line-clamp-2">
            {item.title}
          </p>
          <p className="text-[13px] text-ink-dim mt-0.5 truncate">{item.region}</p>
          <p className="text-[13px] text-ink-faint mt-0.5">
            {item.dateIsUnconfirmed ? 'Date not confirmed' : lead.label}
          </p>
        </div>
      </button>

      {/* Saving from the list, not only from the detail view. Browsing a
          collection is exactly when someone decides they want to keep
          something, and making them open each one first turns a browse into
          a chore. */}
      <button
        type="button"
        onClick={() => onToggleSave(item.id)}
        aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
        aria-pressed={saved}
        className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center
                   text-ink-faint active:bg-hover transition-colors"
      >
        <Heart
          className={`w-5 h-5 ${saved ? 'fill-accent text-accent' : ''}`}
        />
      </button>
    </div>
  );
};

/** A collection opened in full. */
const CollectionDetail: React.FC<{
  collection: PopulatedCollection;
  onBack: () => void;
  onSelect: (i: CultureItem) => void;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
}> = ({ collection, onBack, onSelect, savedIds, onToggleSave }) => {
  // The strongest photograph in the collection becomes its cover. Borrowed
  // from how AllTrails opens an editorial list: a full-bleed image and a
  // sentence of context before any list, which makes a theme feel curated
  // rather than computed.
  const cover = collection.events.find(e => (e as any).imageCredit && e.imageUrl);
  const swipeBack = useSwipeBack(onBack);

  return (
    <div
      className="h-full overflow-y-auto custom-scrollbar overscroll-contain pb-safe-tab"
      {...swipeBack}
    >
      {cover && (
        <div className="relative">
          <img
            src={cover.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-[260px] object-cover"
          />
          {/* Fades into the page so the cover reads as a header rather than a
              photograph the reader is meant to inspect. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-base" />
        </div>
      )}

      <div className={`px-4 ${cover ? '-mt-14 relative' : 'pt-safe-bar sm:pt-[100px]'}`}>
        {/* Below the cover rather than floating on it. A circular back button
            in the top-left corner is the obvious place and is already taken
            by the app's own logo bubble; two overlapping circles is worse
            than a plainly labelled link. */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 min-h-[44px] -ml-1 pr-3 text-[14px]
                     text-ink-dim active:text-ink transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Collections
        </button>

        <h2 className="text-[26px] font-bold text-ink leading-tight">
          {collection.title}
        </h2>
        <p className="text-[14px] text-ink-dim leading-relaxed mt-2">{collection.blurb}</p>
        <p className="text-[12px] text-ink-faint mt-3">{collection.events.length} events</p>
      </div>

      <div className="mt-4">
        {collection.events.map(item => (
          <Row
            key={item.id}
            item={item}
            saved={savedIds.has(item.id)}
            onToggleSave={onToggleSave}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

interface CollectionsViewProps {
  items: CultureItem[];
  onSelect: (item: CultureItem) => void;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  userCoords?: [number, number] | null;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({
  items,
  onSelect,
  savedIds,
  onToggleSave,
  userCoords
}) => {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const collections = React.useMemo(() => populatedCollections(items), [items]);
  const open = collections.find(c => c.id === openId) ?? null;

  /**
   * The one section that is actually about this reader.
   *
   * Everything else on this screen is the same for everybody. This is not a
   * recommendation engine — it is the nearest dozen events, which is a claim
   * the app can stand behind and a reader can check.
   */
  const nearby = React.useMemo(() => {
    if (!userCoords) return [];
    return items
      .map(item => ({ item, reach: reachFrom(userCoords, item) }))
      .filter(r => r.reach)
      .sort((a, b) => a.reach!.km - b.reach!.km)
      .slice(0, 10)
      .map(r => r.item);
  }, [items, userCoords]);

  if (open) {
    return (
      <CollectionDetail
        collection={open}
        onBack={() => setOpenId(null)}
        onSelect={onSelect}
        savedIds={savedIds}
        onToggleSave={onToggleSave}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar overscroll-contain pb-safe-tab">
      <div className="px-4 pt-safe-bar sm:pt-[100px]">
        <h1 className="text-[26px] font-bold text-ink leading-tight">Collections</h1>
        <p className="text-[14px] text-ink-dim mt-1.5 leading-relaxed">
          Themes that cut across the map. For when the question is where to go
          at all, rather than what is nearby.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {nearby.length > 0 && (
          <section>
            <div className="px-4">
              <h2 className="text-[18px] font-semibold text-ink">Closest to you</h2>
              <p className="text-[13px] text-ink-dim leading-snug mt-0.5">
                The nearest {nearby.length}, whatever they are and whenever they fall.
              </p>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 mt-3">
              {nearby.map(item => (
                <Tile key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}

        {collections.map(collection => (
          <section key={collection.id}>
            <button
              type="button"
              onClick={() => setOpenId(collection.id)}
              className="w-full px-4 text-left select-none active:opacity-80 transition-opacity"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[18px] font-semibold text-ink">{collection.title}</h2>
                <span className="shrink-0 text-[13px] text-ink-faint inline-flex items-center gap-0.5">
                  {collection.events.length}
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-[13px] text-ink-dim leading-snug mt-1">{collection.blurb}</p>
            </button>

            <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 mt-3">
              {collection.events.slice(0, 6).map(item => (
                <Tile key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {collections.length === 0 && (
        <p className="px-4 py-16 text-center text-[14px] text-ink-dim">
          No collections match the current filters.
        </p>
      )}
    </div>
  );
};

export default CollectionsView;
