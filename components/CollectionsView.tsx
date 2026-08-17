import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CultureItem } from '../types';
import { populatedCollections, PopulatedCollection } from '../utils/collections';
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
      <p className="text-[13px] font-medium text-ink leading-snug mt-1.5 line-clamp-2">
        {item.title}
      </p>
      <p className="text-[12px] text-ink-faint truncate">{item.region}</p>
    </button>
  );
};

/** A collection opened in full. */
const CollectionDetail: React.FC<{
  collection: PopulatedCollection;
  onBack: () => void;
  onSelect: (i: CultureItem) => void;
}> = ({ collection, onBack, onSelect }) => (
  <div className="h-full overflow-y-auto custom-scrollbar overscroll-contain pb-safe-tab">
    <div className="px-4 pt-safe-bar sm:pt-[100px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 min-h-[44px] -ml-1 pr-3
                   text-[14px] text-ink-dim active:text-ink transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Collections
      </button>
      <h2 className="text-[24px] font-bold text-ink leading-tight mt-1">
        {collection.title}
      </h2>
      <p className="text-[14px] text-ink-dim leading-relaxed mt-2">{collection.blurb}</p>
      <p className="text-[12px] text-ink-faint mt-3">{collection.events.length} events</p>
    </div>

    <div className="mt-3">
      {collection.events.map(item => {
        const lead = leadTime(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full flex gap-3 px-4 py-3 text-left select-none
                       active:bg-hover transition-colors"
          >
            <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden bg-hover
                            border border-line flex items-center justify-center">
              {(item as any).imageCredit && item.imageUrl ? (
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
        );
      })}
    </div>
  </div>
);

interface CollectionsViewProps {
  items: CultureItem[];
  onSelect: (item: CultureItem) => void;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ items, onSelect }) => {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const collections = React.useMemo(() => populatedCollections(items), [items]);
  const open = collections.find(c => c.id === openId) ?? null;

  if (open) {
    return (
      <CollectionDetail
        collection={open}
        onBack={() => setOpenId(null)}
        onSelect={onSelect}
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
