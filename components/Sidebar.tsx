import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Search, Sliders, X, Play, SkipBack, SkipForward, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterState, CultureItem, UnifiedEvent } from '../types';
import DetailPanel from './DetailPanel';
import LiveDetailPanel from './LiveDetailPanel';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import { leadTime } from '../utils/tripPlanner';
import { calculateDistance } from '../utils/geo';
import { occurrenceKind } from '../utils/eventSchedule';

/** Thumbnail with a fallback that survives list recycling. */
const Thumbnail: React.FC<{ item: CultureItem }> = ({ item }) => {
  const [failed, setFailed] = React.useState(false);
  // Reset when the row is recycled onto a different event, otherwise one
  // broken image would blank every event that later reuses the node.
  React.useEffect(() => setFailed(false), [item.id]);

  // An empty url is deliberate, not missing data: applyEventImages strips
  // stock photos shared between events rather than implying one depicts the
  // other. Fall straight through to the glyph instead of loading an empty src.
  const showGlyph = failed || !item.imageUrl;

  return (
    <div className="w-16 h-16 bg-hover rounded-lg overflow-hidden flex-shrink-0 border border-line relative flex items-center justify-center">
      {showGlyph ? (
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true"
             style={{ color: categoryColor(item.ritualType, item.subCategory), opacity: 0.55 }}>
          <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
        </svg>
      ) : (
        <img
          src={item.imageUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

/** Short, honest timing for a list row. */
function sidebarWhen(item: CultureItem): string {
  if (item.dateIsUnconfirmed) return 'Date not confirmed';
  if (item.dateIsMovable) return 'Date varies each year';
  return leadTime(item).label;
}

function sidebarWhenClass(item: CultureItem): string {
  if (item.dateIsUnconfirmed || item.dateIsMovable) return 'text-ink-faint';
  const urgency = leadTime(item).urgency;
  if (urgency === 'imminent') return 'text-live font-medium';
  if (urgency === 'soon') return 'text-accent';
  return 'text-ink-faint';
}

interface SidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  items: CultureItem[];
  onSelectItem: (item: CultureItem) => void;
  selectedId?: string;
  selectedItem: CultureItem | null;
  selectedLiveEvent: UnifiedEvent | null;
  onCloseDetail: () => void;
  onViewInsights: (item: CultureItem) => void;
  isSaved: boolean;
  onToggleSave: () => void;
  /** Enables sorting by proximity when the reader has shared a location. */
  userCoords?: [number, number] | null;
}


const ITEM_HEIGHT = 82; // px per list item (64px image + padding)
const BUFFER_COUNT = 5; // extra items above/below viewport

type SortMode = 'date' | 'distance' | 'name';

const Sidebar: React.FC<SidebarProps> = ({
  filters,
  setFilters,
  items,
  onSelectItem,
  selectedId,
  selectedItem,
  selectedLiveEvent,
  onCloseDetail,
  onViewInsights,
  isSaved,
  onToggleSave
, userCoords }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  // Track scroll position for virtualization
  const handleScroll = useCallback(() => {
    if (listScrollRef.current) {
      setScrollTop(listScrollRef.current.scrollTop);
    }
  }, []);

  // Measure container height on mount/resize
  useEffect(() => {
    const measure = () => {
      if (listScrollRef.current) {
        setContainerHeight(listScrollRef.current.clientHeight);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const [sortMode, setSortMode] = React.useState<SortMode>('date');

  // Sort before virtualising. Catalogue order put six lunar festivals at the
  // top, all reading "Date varies each year", which made the date column look
  // useless on first glance.
  //
  // Declared here, above the detail-panel early returns below, and not next to
  // the code that uses it: selecting an event returns before the end of this
  // function, so a hook placed after that point runs on some renders and not
  // others. React counts hooks by call order, and the mismatch crashed the
  // panel the moment a marker was clicked.
  const sorted = React.useMemo(() => {
    // "Soonest" means soonest to act on, which is not always the start date.
    // A viewing season that opened in January has a start date eight months
    // old and would sort above a festival beginning next week; what matters
    // about an open window is when it shuts. So: anything already under way
    // is ranked by when it ends, everything else by when it begins.
    const actionableAt = (e: CultureItem) => {
      const start = new Date(e.startDate).getTime();
      const end = new Date(e.endDate || e.startDate).getTime();
      // Undated entries sink rather than colonising the top of the list. So do
      // the year-round ones: a nightly ceremony technically starts today, every
      // day, which sorted it above every real festival in the catalogue.
      if (
        Number.isNaN(start) ||
        e.dateIsUnconfirmed ||
        e.dateIsMovable ||
        occurrenceKind(e) === 'always'
      ) {
        return Infinity;
      }
      const now = Date.now();
      if (start <= now) return Number.isNaN(end) ? start : end;
      return start;
    };
    const copy = [...items];
    if (sortMode === 'name') return copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === 'distance' && userCoords) {
      const away = (e: CultureItem) =>
        calculateDistance(userCoords[0], userCoords[1], e.coordinates[0], e.coordinates[1]);
      return copy.sort((a, b) => away(a) - away(b));
    }
    return copy.sort((a, b) => actionableAt(a) - actionableAt(b));
  }, [items, sortMode, userCoords]);

  // If a detail panel is active, render it directly
  if (selectedItem) {
    return (
      <DetailPanel
        item={selectedItem}
        onClose={onCloseDetail}
        onViewInsights={onViewInsights}
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    );
  }

  if (selectedLiveEvent) {
    return (
      <LiveDetailPanel
        event={selectedLiveEvent}
        onClose={onCloseDetail}
      />
    );
  }

  // Virtual list calculations
  const totalHeight = items.length * ITEM_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_COUNT);

  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_COUNT * 2;
  const endIdx = Math.min(sorted.length, startIdx + visibleCount);
  const visibleItems = sorted.slice(startIdx, endIdx);
  const offsetY = startIdx * ITEM_HEIGHT;

  return (
    <div className="h-full flex flex-col bg-transparent text-ink font-sans gap-4">
      {/* Search & Filter Header - Top Card */}
      <div className="p-4 pt-6 sm:pt-[64px] space-y-4 bg-panel/95 sm:backdrop-blur-md border-0 sm:border border-line sm:rounded-2xl shadow-2xl flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Search rituals, places..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-raised border border-line-hard rounded-full py-2 pl-9 pr-4 text-sm text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-ink-faint"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center -mx-2">
          <button
            onClick={scrollLeft}
            className="p-1 text-ink-faint hover:text-ink transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1 flex-1 scroll-smooth"
          >
            {['All', 'Phenomenon', 'Spiritual', 'Festival', 'Ceremony', 'Pilgrimage', 'Performance'].map((cat) => {
              const isActive = filters.type === cat;
              const color = cat === 'All' ? '#fff' : categoryColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setFilters({ ...filters, type: cat as any })}
                  className={`
                    whitespace-nowrap px-3 py-1 rounded-full text-[12px] font-mono uppercase tracking-wider border transition-all
                    ${isActive ? 'bg-opacity-20' : 'bg-transparent border-line-hard text-ink-dim hover:border-line-hard hover:text-ink'}
                  `}
                  style={isActive ? { borderColor: color, color: color, backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` } : {}}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <button
            onClick={scrollRight}
            className="p-1 text-ink-faint hover:text-ink transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month filter and sort. The month control stays a filter — the
            itinerary tab owns proper date-range planning — but the list now
            has an order, which it did not before. */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[12px] text-ink-faint shrink-0">Month</span>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
            className="flex-1 h-0.5 bg-line-hard rounded-lg appearance-none cursor-pointer accent-accent"
            aria-label="Filter by month"
          />
          <span className="text-[12px] text-accent w-9 text-right tabular-nums">
            {filters.month === 0 ? 'All' : new Date(0, filters.month - 1).toLocaleString('en-GB', { month: 'short' })}
          </span>
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-[12px] text-ink-faint shrink-0">Sort</span>
          {([
            ['date', 'Soonest'],
            ['distance', 'Nearest'],
            ['name', 'A–Z'],
          ] as [SortMode, string][]).map(([mode, label]) => {
            const disabled = mode === 'distance' && !userCoords;
            return (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                disabled={disabled}
                title={disabled ? 'Enable location to sort by distance' : undefined}
                className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                  sortMode === mode
                    ? 'bg-accent text-on-accent border-accent font-semibold'
                    : 'border-line text-ink-dim hover:text-ink hover:border-line-hard'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List Content - Bottom Card (VIRTUALIZED) */}
      <div className="flex-1 overflow-hidden bg-panel/95 sm:backdrop-blur-md border-0 sm:border border-line sm:rounded-2xl shadow-2xl flex flex-col min-h-0">
        <div className="px-4 py-2.5 text-[12px] text-ink-faint border-b border-line-soft flex-shrink-0">
          {items.length.toLocaleString('en-GB')} {items.length === 1 ? 'event' : 'events'}
        </div>
        <div 
          ref={listScrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
          onScroll={handleScroll}
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`
                  group px-4 py-3 border-b border-line-soft cursor-pointer transition-all hover:bg-raised
                  ${selectedId === item.id ? 'bg-raised border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'}
                `}
                >
                  <div className="flex gap-3 items-center">
                    <Thumbnail item={item} />
                    <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                      <div className="flex items-start gap-1.5">
                        <svg
                          width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"
                          className="shrink-0 mt-[3px]"
                          style={{ color: categoryColor(item.ritualType, item.subCategory) }}
                        >
                          <path d={categoryGlyph(item.ritualType, item.subCategory)} fill="currentColor" />
                        </svg>
                        <h3 className={`text-[14px] font-semibold leading-snug transition-colors truncate ${selectedId === item.id ? 'text-accent' : 'text-ink'}`}>
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-[12px] text-ink-dim truncate mt-0.5">{item.region}</p>
                      {/* When it happens. The whole product is timing accuracy,
                          and this list showed everything except the date. */}
                      <p className="text-[12px] mt-0.5 truncate">
                        <span className={sidebarWhenClass(item)}>{sidebarWhen(item)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {items.length === 0 && (
            <div className="p-8 text-center text-ink-faint text-sm">
              No rituals found matching your criteria.
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--k-line); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--k-line-hard); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default Sidebar;
