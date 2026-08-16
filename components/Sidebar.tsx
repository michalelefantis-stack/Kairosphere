import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Search, Sliders, X, Play, SkipBack, SkipForward, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterState, CultureItem, UnifiedEvent } from '../types';
import DetailPanel from './DetailPanel';
import LiveDetailPanel from './LiveDetailPanel';

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
}

const getCategoryColor = (type: string) => {
  switch (type) {
    case 'Phenomenon': return '#00d4ff';
    case 'Spiritual': return '#d400ff';
    case 'Festival': return '#9fff00';
    case 'Ceremony': return '#ff8a00';
    case 'Pilgrimage': return '#ff0055';
    case 'Performance': return '#00ffa2';
    default: return '#ffffff';
  }
};

const ITEM_HEIGHT = 82; // px per list item (64px image + padding)
const BUFFER_COUNT = 5; // extra items above/below viewport

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
}) => {
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
  const endIdx = Math.min(items.length, startIdx + visibleCount);
  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * ITEM_HEIGHT;

  return (
    <div className="h-full flex flex-col bg-transparent text-white font-sans gap-4">
      {/* Search & Filter Header - Top Card */}
      <div className="p-4 pt-6 sm:pt-[64px] space-y-4 bg-[#0c0c0c]/95 sm:backdrop-blur-md border-0 sm:border border-[#222] sm:rounded-2xl shadow-2xl flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search rituals, places..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-[#111] border border-[#333] rounded-full py-2 pl-9 pr-4 text-sm text-gray-200 focus:outline-none focus:border-[#9fff00] transition-colors placeholder:text-gray-600"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center -mx-2">
          <button
            onClick={scrollLeft}
            className="p-1 text-gray-600 hover:text-white transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1 flex-1 scroll-smooth"
          >
            {['All', 'Phenomenon', 'Spiritual', 'Festival', 'Ceremony', 'Pilgrimage', 'Performance'].map((cat) => {
              const isActive = filters.type === cat;
              const color = cat === 'All' ? '#fff' : getCategoryColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setFilters({ ...filters, type: cat as any })}
                  className={`
                    whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-all
                    ${isActive ? 'bg-opacity-20' : 'bg-transparent border-[#333] text-gray-400 hover:border-[#555] hover:text-gray-200'}
                  `}
                  style={isActive ? { borderColor: color, color: color, backgroundColor: `${color}15` } : {}}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <button
            onClick={scrollRight}
            className="p-1 text-gray-600 hover:text-white transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Timeline Slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Timeline</span>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
            className="flex-1 h-0.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#9fff00]"
          />
          <span className="text-[10px] font-mono text-[#9fff00] w-8 text-right">
            {filters.month === 0 ? 'ALL' : new Date(0, filters.month - 1).toLocaleString('en-US', { month: 'short' }).toUpperCase()}
          </span>
        </div>
      </div>

      {/* List Content - Bottom Card (VIRTUALIZED) */}
      <div className="flex-1 overflow-hidden bg-[#0c0c0c]/95 sm:backdrop-blur-md border-0 sm:border border-[#222] sm:rounded-2xl shadow-2xl flex flex-col min-h-0">
        <div className="px-4 py-3 text-[10px] font-mono text-gray-500 uppercase tracking-widest border-b border-[#1a1a1a] flex-shrink-0">
          {items.length} Results Found
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
                  group px-4 py-3 border-b border-[#1a1a1a] cursor-pointer transition-all hover:bg-[#111]
                  ${selectedId === item.id ? 'bg-[#111] border-l-2 border-l-[#9fff00]' : 'border-l-2 border-l-transparent'}
                `}
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-16 h-16 bg-[#222] rounded-lg overflow-hidden flex-shrink-0 border border-[#333] relative">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.style.display = 'flex';
                            target.parentElement.style.alignItems = 'center';
                            target.parentElement.style.justifyContent = 'center';
                            target.parentElement.style.fontSize = '24px';
                            target.parentElement.textContent = '🌍';
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                      <h3 className={`text-sm font-bold leading-tight transition-colors truncate ${selectedId === item.id ? 'text-[#9fff00]' : 'text-gray-200 group-hover:text-white'}`}>
                        {item.title}
                      </h3>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-gray-400 font-medium truncate pr-2">{item.region}</span>
                        <span
                          className="uppercase tracking-wider text-[9px] font-bold border px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
                          style={{ borderColor: getCategoryColor(item.ritualType), color: getCategoryColor(item.ritualType), backgroundColor: `${getCategoryColor(item.ritualType)}15` }}
                        >
                          {item.ritualType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {items.length === 0 && (
            <div className="p-8 text-center text-gray-600 text-sm">
              No rituals found matching your criteria.
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default Sidebar;
