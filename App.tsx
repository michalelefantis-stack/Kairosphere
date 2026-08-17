
import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import NavDashboard from './components/NavDashboard';
import KairosLogo from './components/KairosLogo';
import LiveTicker from './components/LiveTicker';
import MapControls, { LAYER_GROUPS } from './components/MapControls';
import JsonLdSchema from './components/JsonLdSchema';
import { FilterState, CultureItem, UnifiedEvent } from './types';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ExternalLink, Radio, Ear, Backpack, MapPin, Calendar as CalendarIcon, ArrowRight, Plane, X, Archive, Star, StarHalf, BookOpen, Compass, Search } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useIsPhone } from './hooks/useIsPhone';

import LiveDetailPanel from './components/LiveDetailPanel';
import DetailPanel from './components/DetailPanel';
import NearbyFeed from './components/NearbyFeed';
import MobileFilterSheet, { MobileTopBar } from './components/MobileFilterSheet';
import AccountMenu from './components/AccountMenu';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { readJson, writeJson } from './utils/safeStorage';

// ── Lazy-loaded components (only fetched when their tab/modal is active) ──
const CalendarView = React.lazy(() => import('./components/CalendarView'));
const InsightsView = React.lazy(() => import('./components/InsightsView'));
const ReportRitualModal = React.lazy(() => import('./components/ReportRitualModal'));
const WhisperOverlay = React.lazy(() => import('./components/WhisperOverlay'));
const SignalIntelligence = React.lazy(() => import('./components/SignalIntelligence'));
const ItineraryView = React.lazy(() => import('./components/ItineraryView'));
const GlobeComponent = React.lazy(() => import('./components/GlobeComponent'));

// Minimal loading fallback for lazy components
const LazyFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-base">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="text-[12px] uppercase tracking-[0.12em] text-ink-faint font-bold">Loading module...</span>
    </div>
  </div>
);

const StarRating: React.FC<{ rating: number, count?: string }> = ({ rating, count }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5 mt-1.5 mb-2">
      <div className="flex text-gold">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-3.5 h-3.5 fill-current" />
        ))}
        {hasHalfStar && <StarHalf className="w-3.5 h-3.5 fill-current" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-3.5 h-3.5 text-ink-faint" />
        ))}
      </div>
      <span className="text-[12px] font-bold text-gold/90">{rating.toFixed(2)}</span>
      {count && <span className="text-[11px] text-ink-faint ml-1">({count} ratings)</span>}
    </div>
  );
};

const App: React.FC = () => {
  // ── Lazy-load mockData (303KB) — fetched after initial render ──
  const [cultureData, setCultureData] = useState<CultureItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  useEffect(() => {
    Promise.all([
      import('./mockData'),
      import('./data/southeastAsia'),
      import('./utils/eventSchedule'),
      import('./utils/eventImages')
    ]).then(async ([mod, sea, schedule, images]) => {
      // The catalogue stores one historical instance per event and 89% of
      // them have already passed. Resolve each to its next occurrence here,
      // so the map, calendar and insights all see upcoming dates.
      const resolved = schedule.withResolvedSchedules([
        ...mod.MOCK_CULTURE_DATA,
        ...sea.SOUTHEAST_ASIA_EVENTS
      ]);
      // Overlay photographs verified against Wikimedia descriptions, replacing
      // the generic stock that had one image serving four unrelated events.
      setCultureData(images.applyEventImages(resolved, await images.loadEventImages()));
      setDataLoaded(true);
    });
  }, []);

  const [activeTab, setActiveTab] = useState('map');
  const [viewMode, setViewMode] = useState<'flat' | 'globe'>('flat');

  /**
   * What the phone shows on the home tab.
   *
   * Desktop keeps map-with-a-sidebar, which works on a wide screen. The phone
   * cannot show both usefully — splitting a 375px display gave the list 23% of
   * it — so the two are separate views with an explicit switch, and the list
   * is the one you land on.
   */
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const isPhone = useIsPhone();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Only used to show whether the reader is signed in; AccountMenu keeps its
  // own subscription for everything else.
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, user => setIsSignedIn(!!user)), []);
  const [mobileSheetState, setMobileSheetState] = useState<'collapsed' | 'half' | 'full'>('half');
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const dragLastY = useRef<number>(0);
  const dragLastTime = useRef<number>(0);
  const dragVelocity = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const getMobileHeightClass = () => {
    switch (mobileSheetState) {
      case 'collapsed': return 'h-[175px] sm:h-auto';
      case 'full': return 'h-[75dvh] sm:h-auto';
      case 'half':
      default: return 'h-[55vh] sm:h-auto';
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    isDragging.current = false;
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetRef.current.getBoundingClientRect().height;
    dragLastY.current = e.touches[0].clientY;
    dragLastTime.current = Date.now();
    dragVelocity.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY;
    
    if (Math.abs(deltaY) > 5) {
      isDragging.current = true;
    }
    
    if (isDragging.current) {
      const newHeight = dragStartHeight.current + deltaY;
      
      const now = Date.now();
      const timeDelta = now - dragLastTime.current;
      if (timeDelta > 0) {
        dragVelocity.current = (dragLastY.current - currentY) / timeDelta;
        dragLastTime.current = now;
        dragLastY.current = currentY;
      }
      
      const minHeight = 175;
      const maxHeight = window.innerHeight - 67;
      setDragHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || dragHeight === null) return;
    
    const minHeight = 175;
    const halfHeight = window.innerHeight * 0.6;
    const fullHeight = window.innerHeight - 67;
    
    if (Math.abs(dragVelocity.current) > 0.5) {
      if (dragVelocity.current > 0) {
        if (mobileSheetState === 'collapsed') setMobileSheetState('half');
        else setMobileSheetState('full');
      } else {
        if (mobileSheetState === 'full') setMobileSheetState('half');
        else setMobileSheetState('collapsed');
      }
    } else {
      const distCollapsed = Math.abs(dragHeight - minHeight);
      const distHalf = Math.abs(dragHeight - halfHeight);
      const distFull = Math.abs(dragHeight - fullHeight);
      
      const minDist = Math.min(distCollapsed, distHalf, distFull);
      if (minDist === distCollapsed) setMobileSheetState('collapsed');
      else if (minDist === distHalf) setMobileSheetState('half');
      else setMobileSheetState('full');
    }
    
    setDragHeight(null);
    setTimeout(() => { isDragging.current = false; }, 50);
  };

  const handleDragClick = (e?: React.MouseEvent) => {
    if (isDragging.current) return;
    if (mobileSheetState === 'collapsed') setMobileSheetState('half');
    else if (mobileSheetState === 'half') setMobileSheetState('full');
    else setMobileSheetState('half');
  };

  // LAYER FILTER STATE — maps to exact subCategory values
  const ALL_LAYER_IDS = LAYER_GROUPS.flatMap(g => g.items.map(i => i.id));
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(() => new Set(ALL_LAYER_IDS));

  const handleToggleLayer = (layerId: string) => {
    setEnabledLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const handleSetAllLayers = (enabled: boolean) => {
    if (enabled) {
      setEnabledLayers(new Set(ALL_LAYER_IDS));
    } else {
      setEnabledLayers(new Set());
    }
  };

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: 'All' as any,
    region: 'All Region',
    month: 0
  });

  /**
   * Badge on the Filter button. With the controls behind a sheet, a filter
   * left on from a previous session is invisible, and the reader is left
   * wondering why half the catalogue is missing.
   */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search.trim()) n += 1;
    if (filters.type && (filters.type as string) !== 'All') n += 1;
    if (filters.month) n += 1;
    return n;
  }, [filters]);

  const [selectedItem, setSelectedItem] = useState<CultureItem | null>(null);
  const [insightsItem, setInsightsItem] = useState<CultureItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // ITINERARY STATE
  const [savedRitualIds, setSavedRitualIds] = useState<Set<string>>(() => {
    // Guarded: this runs inside a useState initialiser, so a throw here
    // white-screened the whole app before any of it rendered.
    return new Set(readJson<string[]>('kairos_saved_ids', []));
  });

  const toggleSaveRitual = (id: string) => {
    setSavedRitualIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
      writeJson('kairos_saved_ids', Array.from(newSet));
      return newSet;
    });
  };



  // --- LIVE EVENT SYSTEM: phenomena pipeline + GDELT ---
  const [liveEvents, setLiveEvents] = useState<UnifiedEvent[]>([]);
  const [selectedLiveEvent, setSelectedLiveEvent] = useState<UnifiedEvent | null>(null);
  const [feedIsStale, setFeedIsStale] = useState(false);
  const [feedGeneratedAt, setFeedGeneratedAt] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval>;
    const loadEvents = async () => {
        // The pipeline feed and GDELT are independent; a failure in one must
        // not blank the other, so they settle separately.
        const [phenomena, gdelt] = await Promise.allSettled([
          import('./utils/phenomenaService').then(m => m.fetchPhenomena()),
          import('./utils/gdeltService').then(m => m.fetchGdeltLiveEvents())
        ]);

        if (!isMounted) return;

        const merged: UnifiedEvent[] = [];
        if (phenomena.status === 'fulfilled') {
          merged.push(...phenomena.value.events);
          setFeedIsStale(phenomena.value.isStale);
          setFeedGeneratedAt(phenomena.value.generatedAt);
        } else {
          console.warn('Failed to load phenomena feed:', phenomena.reason);
        }
        if (gdelt.status === 'fulfilled') {
          // Pipeline entries win on title collision — they carry provenance.
          const known = new Set(merged.map(e => e.title.toLowerCase().slice(0, 40)));
          merged.push(...gdelt.value.filter(e => !known.has(e.title.toLowerCase().slice(0, 40))));
        } else {
          console.warn('Failed to load GDELT events:', gdelt.reason);
        }

        setLiveEvents(merged);
    };

    // Defer live event fetch by 3s so the map/UI renders first
    const startDelay = setTimeout(() => {
      loadEvents();
      // Refresh every 3 minutes
      interval = setInterval(loadEvents, 3 * 60 * 1000);
    }, 3000);

    return () => {
        isMounted = false;
        clearTimeout(startDelay);
        if (interval) clearInterval(interval);
    };
  }, []);



  // Reset selections when tab changes
  useEffect(() => {
    setSelectedItem(null);
    setSelectedLiveEvent(null);
  }, [activeTab]);

  // --- END LIVE EVENT SYSTEM ---

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // WHISPER / GEOLOCATION STATE
  const { coords: userCoords, error: geoError, isRequesting: isRequestingLocation, requestLocation } = useGeolocation();
  const [whisperRitual, setWhisperRitual] = useState<any | null>(null);
  const [showWhisperPrompt, setShowWhisperPrompt] = useState<any | null>(null);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);

  // When switching to live tab, if we haven't requested location yet, we show the popup
  const showLocationPopup = activeTab === 'live' && !userCoords && !hasRequestedLocation && !geoError;

  const handleAllowLocation = () => {
    setHasRequestedLocation(true);
    requestLocation();
  };

  const handleDenyLocation = () => {
    setHasRequestedLocation(true);
  };

  const filteredData = useMemo(() => {
    const onlyVerified = enabledLayers.has('verified') && !ALL_LAYER_IDS.every(id => enabledLayers.has(id));

    const filtered = cultureData.filter(item => {
      // Layer filter: match exact subCategory using the 'sub-[Category]' layer format.
      // Fails OPEN. A subCategory with no matching layer used to drop the event
      // from the map silently — two events had been invisible that way, and
      // every new one risked the same. An unknown category now shows through
      // instead of disappearing, since no toggle exists to bring it back.
      const layerId = item.subCategory ? `sub-${item.subCategory.toLowerCase()}` : `sub-general`;
      const layerIsToggleable = ALL_LAYER_IDS.includes(layerId);
      if (layerIsToggleable && !enabledLayers.has(layerId)) {
        return false;
      }

      // Verified filter
      if (onlyVerified && !item.verified) return false;

      const matchesSearch = item.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                          item.description.toLowerCase().includes(filters.search.toLowerCase());
      const matchesType = filters.type === 'All' || item.ritualType === filters.type;
      const matchesRegion = filters.region === 'All Region' || item.region === filters.region;
      const itemMonth = new Date(item.startDate).getUTCMonth() + 1;
      const matchesMonth = filters.month === 0 || itemMonth === filters.month;
      return matchesSearch && matchesType && matchesRegion && matchesMonth;
    });
    return filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [filters, enabledLayers, cultureData]);

  // Data for Calendar/Itinerary... (omitted for brevity, same logic)
  const itineraryData = useMemo(() => {
    return cultureData.filter(item => savedRitualIds.has(item.id));
  }, [savedRitualIds, cultureData]);

  const allBooks = useMemo(() => {
    const booksMap = new Map();
    cultureData.forEach(item => {
      if (item.recommendedBooks) {
        item.recommendedBooks.forEach(book => {
          if (!booksMap.has(book.title)) {
            booksMap.set(book.title, { ...book, relatedEvent: item });
          }
        });
      }
    });
    return Array.from(booksMap.values());
  }, [cultureData]);

  const handleSelectItem = (item: CultureItem | null) => {
    setSelectedItem(item);
    setSelectedLiveEvent(null);
    if (item && activeTab === 'map') {
      setIsSidebarOpen(true);
      if (mobileSheetState === 'collapsed') {
        setMobileSheetState('half');
      }
    }
  };

  const handleEventClick = (event: UnifiedEvent) => {
    setSelectedLiveEvent(event);
    setSelectedItem(null);
    if (activeTab === 'map') {
       setIsSidebarOpen(true);
    }
    if (mobileSheetState === 'collapsed') {
      setMobileSheetState('half');
    }
  };

  const handleViewInsights = (item: CultureItem) => {
    setInsightsItem(item);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // Layout Constants
  const SIDEBAR_WIDTH = 380;

  return (
    <div
      className="relative h-screen w-full bg-base text-ink overflow-hidden font-sans flex flex-col"
      style={{ height: '100vh', width: '100vw' }}
    >
      {/* JSON-LD Structured Data for SEO */}
      <JsonLdSchema events={cultureData} />

      {/* Main Content Row */}
      <div className="flex-1 relative overflow-hidden flex flex-row h-full">
        
        {/* TOP: Nav Dashboard */}
        <NavDashboard 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          savedCount={savedRitualIds.size} 
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        
        {/* LEFT PANEL: LiveTicker (Live Mode) */}
        {activeTab === 'live' && (
          <div 
            ref={activeTab === 'live' ? sheetRef : undefined}
            className={`ui-layer absolute left-0 sm:left-4 top-auto sm:top-4 bottom-[64px] sm:bottom-4 z-[40] sm:z-30 flex flex-col w-full sm:w-[380px] bg-panel/95 sm:backdrop-blur-md border-0 sm:border border-line rounded-t-[32px] sm:rounded-2xl shadow-[0_-15px_40px_rgba(0,0,0,0.8)] sm:shadow-2xl overflow-hidden pointer-events-auto ${dragHeight === null ? 'transition-all duration-300 ' + getMobileHeightClass() : ''}`}
            style={dragHeight !== null && activeTab === 'live' ? { height: `${dragHeight}px` } : undefined}
          >
             {/* Drag Handle & Mobile Top Bar */}
             <div 
               className={`w-full flex items-center justify-center pt-3 pb-6 block sm:hidden ${selectedLiveEvent ? 'absolute top-0 left-0 z-[60] bg-gradient-to-b from-base/80 via-base/40 to-transparent rounded-t-[32px]' : 'relative bg-panel/95 rounded-t-[32px]'} sm:bg-transparent`}
               onTouchStart={handleTouchStart}
               onTouchMove={handleTouchMove}
               onTouchEnd={handleTouchEnd}
             >
               <div 
                 className="flex-1 flex justify-center cursor-pointer absolute inset-0 items-start pt-3"
                 onClick={handleDragClick}
               >
                 <div className="w-12 h-1.5 bg-white/40 shadow-[0_2px_4px_rgba(0,0,0,0.5)] rounded-full"></div>
               </div>
               {!selectedLiveEvent && (
                 <button 
                   onClick={() => setMobileSheetState('collapsed')}
                   className="absolute right-4 top-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-ink transition-colors z-50"
                   style={{ display: mobileSheetState === 'collapsed' ? 'none' : 'block' }}
                 >
                   <X className="w-3.5 h-3.5" />
                 </button>
               )}
             </div>
             <LiveTicker
               events={liveEvents}
               onEventClick={handleEventClick}
               selectedEvent={selectedLiveEvent}
               onCloseDetail={() => setSelectedLiveEvent(null)}
               userCoords={userCoords}
               feedIsStale={feedIsStale}
               feedGeneratedAt={feedGeneratedAt}
             />
          </div>
        )}

        {/* ═══ MOBILE HOME: ranked feed, with the map as a switchable view ═══

            Desktop keeps its map-plus-sidebar below; this replaces it entirely
            on a phone, where splitting the screen left the list unusable. */}
        {activeTab === 'map' && (
          // Transparent and inert by default so the map underneath stays
          // live; each child that needs taps opts back in. Switching to the
          // map used to hide this whole layer, which took the filter and the
          // account with it — the map is the view where filtering matters
          // most, and there is no reason signing in should depend on which
          // way you happen to be looking at the same events.
          <div className="sm:hidden absolute inset-0 z-[45] flex flex-col pointer-events-none">
            {selectedItem ? (
              <div className="flex-1 min-h-0 pb-[64px] bg-base pointer-events-auto">
                <DetailPanel
                  item={selectedItem}
                  onClose={() => setSelectedItem(null)}
                  onViewInsights={handleViewInsights}
                  isSaved={savedRitualIds.has(selectedItem.id)}
                  onToggleSave={() => toggleSaveRitual(selectedItem.id)}
                />
              </div>
            ) : (
              <>
                <div className="pointer-events-auto">
                  <MobileTopBar
                    filter={{
                      count: filteredData.length,
                      activeCount: activeFilterCount,
                      onOpen: () => setIsFilterSheetOpen(true)
                    }}
                    onOpenAccount={() => setIsAccountOpen(true)}
                    signedIn={isSignedIn}
                  />
                </div>

                {mobileView === 'list' && (
                  <div className="flex-1 min-h-0 bg-base pointer-events-auto">
                    <NearbyFeed
                      items={filteredData}
                      userCoords={userCoords}
                      isRequestingLocation={isRequestingLocation}
                      geoError={geoError}
                      onRequestLocation={requestLocation}
                      onSelect={handleSelectItem}
                    />
                  </div>
                )}
              </>
            )}

            {/* Switch between the feed and the map. Bottom-centre, above the
                tab bar: the reachable third of the screen, unlike the
                top-right rail this replaces on mobile. */}
            {!selectedItem && (
              <button
                type="button"
                onClick={() => setMobileView(v => (v === 'list' ? 'map' : 'list'))}
                className="absolute left-1/2 -translate-x-1/2 bottom-[76px] z-[50]
                           min-h-[44px] px-5 rounded-full bg-ink text-base
                           text-[14px] font-semibold shadow-xl pointer-events-auto
                           inline-flex items-center gap-2 active:opacity-80"
              >
                {mobileView === 'list'
                  ? <><MapPin className="w-4 h-4" /> Map</>
                  : <><Search className="w-4 h-4" /> List</>}
              </button>
            )}
          </div>
        )}

        {/* LEFT PANEL / BOTTOM SHEET: Sidebar (Map Mode) — desktop only */}
        {activeTab === 'map' && isSidebarOpen && (
          <div
            ref={activeTab === 'map' ? sheetRef : undefined}
            className={`ui-layer absolute left-0 sm:left-4 top-auto sm:top-4 bottom-[64px] sm:bottom-4 z-[40] sm:z-30 hidden sm:flex flex-col pointer-events-none w-full sm:w-[380px] ${dragHeight === null ? 'transition-all duration-300 ' + getMobileHeightClass() : ''}`}
            style={dragHeight !== null && activeTab === 'map' ? { height: `${dragHeight}px` } : undefined}
          >
            <div className={`flex-1 overflow-hidden pointer-events-auto flex flex-col ${selectedItem || selectedLiveEvent ? 'bg-panel/95 sm:backdrop-blur-md border-0 sm:border border-line sm:rounded-2xl shadow-[0_-15px_40px_rgba(0,0,0,0.8)] sm:shadow-2xl rounded-t-[32px]' : 'rounded-t-[32px] sm:rounded-none bg-panel/95 sm:bg-transparent shadow-[0_-15px_40px_rgba(0,0,0,0.8)] sm:shadow-none border-0 sm:border sm:border-transparent border-line'}`}>
              {/* Drag Handle & Mobile Top Bar */}
              <div 
                className={`w-full flex items-center justify-center pt-3 pb-6 block sm:hidden ${selectedItem || selectedLiveEvent ? 'absolute top-0 left-0 z-[60] bg-gradient-to-b from-base/80 via-base/40 to-transparent rounded-t-[32px]' : 'relative bg-panel/95 rounded-t-[32px]'} sm:bg-transparent`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div 
                  className="flex-1 flex justify-center cursor-pointer absolute inset-0 items-start pt-3"
                  onClick={handleDragClick}
                >
                  <div className="w-12 h-1.5 bg-white/40 shadow-[0_2px_4px_rgba(0,0,0,0.5)] rounded-full"></div>
                </div>
                {!selectedItem && !selectedLiveEvent && (
                  <button 
                    onClick={() => setMobileSheetState('collapsed')}
                    className="absolute right-4 top-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-ink transition-colors z-50"
                    style={{ display: mobileSheetState === 'collapsed' ? 'none' : 'block' }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Sidebar 
                filters={filters} 
                setFilters={setFilters} 
                items={filteredData} 
                onSelectItem={handleSelectItem}
                selectedId={selectedItem?.id}
                selectedItem={selectedItem}
                selectedLiveEvent={selectedLiveEvent}
                onCloseDetail={() => {
                  setSelectedItem(null);
                  setSelectedLiveEvent(null);
                }}
                onViewInsights={handleViewInsights}
                isSaved={selectedItem ? savedRitualIds.has(selectedItem.id) : false}
                onToggleSave={() => selectedItem && toggleSaveRitual(selectedItem.id)}
                userCoords={userCoords}
              />
            </div>
            {/* Collapse Button */}
            <button 
              onClick={toggleSidebar}
              className="absolute -right-3 top-1/2 -translate-y-1/2 bg-panel border border-line p-1.5 rounded-full hover:bg-raised hover:text-accent transition-colors z-40 shadow-lg pointer-events-auto hidden sm:block"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Expand Button for Sidebar when closed */}
        {activeTab === 'map' && !isSidebarOpen && (
           <div className="ui-layer absolute left-0 sm:top-1/2 bottom-5 sm:bottom-auto sm:-translate-y-1/2 z-30 pointer-events-auto hidden sm:flex w-full sm:w-auto justify-center sm:justify-start">
             <button 
              onClick={toggleSidebar}
              className="bg-panel/90 backdrop-blur-md border border-line sm:border-l-0 p-2 rounded-full sm:rounded-r-xl sm:rounded-l-none hover:bg-raised hover:text-accent transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.7)] text-ink-dim"
            >
              <ChevronRight className="w-5 h-5 block" />
            </button>
           </div>
        )}

        {/* CENTER/RIGHT: Main Viewport (Map, Calendar, etc) */}
        <div className="flex-1 relative z-0 h-full overflow-hidden flex flex-col min-w-0 bg-base">
          
          {/* MAP COMPONENT: Shared by Map and Live tabs */}
          {(activeTab === 'map' || activeTab === 'live') && (
            <>
              {/* Flat Map Layer */}
              <div 
                className={`absolute inset-0 transition-opacity duration-300 ${
                  viewMode === 'flat' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                <MapComponent 
                  data={activeTab === 'map' ? filteredData : []} 
                  onSelect={handleSelectItem} 
                  selectedItem={selectedItem}
                  liveEvents={activeTab === 'live' ? liveEvents : []}
                  focusCoords={activeTab === 'map' ? selectedItem?.coordinates : selectedLiveEvent?.coordinates}
                  onLiveEventSelect={handleEventClick}
                  userCoords={userCoords}
                  activeTab={activeTab}
                />
              </div>

              {/* 3D Globe Layer — desktop only.
                  Not merely hidden on a phone but never mounted: it pulls
                  several megabytes of Earth textures from unpkg at runtime, so
                  it is dead weight on mobile data and simply broken offline,
                  which is exactly when someone on the road needs the app. It
                  is also worse than the flat map at every task on a 375px
                  screen, and its own overlay tells the reader to use a mouse
                  wheel. */}
              {!isPhone && (
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  viewMode === 'globe' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
              <Suspense fallback={<LazyFallback />}>
                <GlobeComponent
                  data={activeTab === 'map' ? filteredData : []} 
                  onSelect={handleSelectItem} 
                  selectedItem={selectedItem}
                  liveEvents={activeTab === 'live' ? liveEvents : []}
                  focusCoords={activeTab === 'map' ? selectedItem?.coordinates : selectedLiveEvent?.coordinates}
                  onLiveEventSelect={handleEventClick}
                  userCoords={userCoords}
                  activeTab={activeTab}
                />
              </Suspense>
              </div>
              )}

              {/* Right-side Map Controls */}
              <MapControls
                viewMode={viewMode}
                setViewMode={setViewMode}
                savedCount={savedRitualIds.size}
                savedEvents={itineraryData}
                onOpenItinerary={() => setActiveTab('itinerary')}
                onSelectSavedEvent={handleSelectItem}
                totalEvents={filteredData.length}
                liveEventsCount={liveEvents.length}
                onToggleTheme={() => {
                  const html = document.documentElement;
                  html.classList.toggle('light-mode');
                }}
                isLightMode={typeof document !== 'undefined' && document.documentElement.classList.contains('light-mode')}
                activeTab={activeTab}
                enabledLayers={enabledLayers}
                onToggleLayer={handleToggleLayer}
                onSetAllLayers={handleSetAllLayers}
              />
            </>
          )}

          {(activeTab === 'calendar' || activeTab === 'itinerary') && (
            <div className="h-full min-h-0 flex flex-col">
              {isPhone && (
                <MobileTopBar
                  onOpenAccount={() => setIsAccountOpen(true)}
                  signedIn={isSignedIn}
                />
              )}
              {/* Calendar and Itinerary answer one question — "I have these
                  dates, what is on" — so on a phone they are two views of one
                  tab rather than two of five tabs. Desktop still has room to
                  show them separately in the top nav. */}
              <div className="sm:hidden shrink-0 flex gap-2 px-4 py-3 border-b border-line-soft bg-base">
                {([
                  { id: 'itinerary', label: 'My trips' },
                  { id: 'calendar', label: 'Calendar' }
                ] as const).map(view => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveTab(view.id)}
                    className={`min-h-[44px] px-4 rounded-xl text-[14px] font-semibold transition-colors ${
                      activeTab === view.id
                        ? 'bg-accent text-on-accent'
                        : 'bg-hover text-ink-dim active:bg-raised'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0">
                <Suspense fallback={<LazyFallback />}>
                  {activeTab === 'calendar' ? (
                    <div className="pb-safe-tab h-full min-h-0 flex flex-col">
                      <CalendarView
                        events={filteredData}
                        onSelect={handleViewInsights}
                        selectedId={insightsItem?.id || selectedItem?.id}
                        savedRitualIds={savedRitualIds}
                        onToggleSave={toggleSaveRitual}
                      />
                    </div>
                  ) : (
                    <ItineraryView
                      allEvents={cultureData}
                      savedEvents={itineraryData}
                      savedIds={savedRitualIds}
                      onToggleSave={toggleSaveRitual}
                      onViewInsights={handleViewInsights}
                    />
                  )}
                </Suspense>
              </div>
            </div>
          )}
          {activeTab === 'signals' && (
            <div className="w-full h-full pt-4 sm:pt-[80px] pb-safe-tab">
              <Suspense fallback={<LazyFallback />}>
                <SignalIntelligence onEventFound={() => {}} />
              </Suspense>
            </div>
          )}
          {activeTab === 'library' && (
            <div className="w-full h-full flex flex-col min-h-0">
            {isPhone && (
              <MobileTopBar
                onOpenAccount={() => setIsAccountOpen(true)}
                signedIn={isSignedIn}
              />
            )}
            <div className="w-full flex-1 min-h-0 p-6 md:p-12 pt-6 sm:pt-[100px] md:pt-[120px] pb-safe-tab overflow-y-auto custom-scrollbar">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-gold/10 rounded-xl border border-gold/20">
                    <Archive className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Archival Library</h2>
                    <p className="text-sm text-ink-faint font-mono mt-1">{allBooks.length} Recommended Texts</p>
                  </div>
                </div>

                {allBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-line rounded-3xl bg-base">
                    <Archive className="w-12 h-12 text-ink-faint mb-4" />
                    <p className="text-ink-dim font-bold uppercase tracking-widest">No books available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {allBooks.map((book, idx) => (
                      <div key={idx} className="bg-panel border border-line hover:border-gold/50 transition-all rounded-2xl overflow-hidden group flex flex-col">
                        {book.coverUrl ? (
                          <div className="w-full h-48 bg-raised overflow-hidden">
                            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-gradient-to-br from-raised to-base flex items-center justify-center border-b border-line">
                            <Archive className="w-12 h-12 text-[#333]" />
                          </div>
                        )}
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold leading-tight mb-1 group-hover:text-gold transition-colors">{book.title}</h3>
                          <p className="text-sm text-ink-dim mb-1">{book.author}</p>
                          {book.goodreadsRating && (
                            <StarRating rating={book.goodreadsRating} count={book.ratingCount} />
                          )}
                          
                          {book.description && (
                            <div className="text-xs text-ink-faint max-h-24 overflow-y-auto custom-scrollbar pr-2 mb-4 flex-1">
                              {book.description}
                            </div>
                          )}
                          
                          <div className="mt-auto pt-4 border-t border-line flex items-center justify-between">
                            <button 
                              onClick={() => handleViewInsights(book.relatedEvent)}
                              className="text-[12px] font-bold uppercase tracking-wider text-ink-faint hover:text-ink transition-colors flex items-center gap-1"
                            >
                              <MapPin className="w-3 h-3" />
                              {book.relatedEvent.title}
                            </button>
                            
                            <div className="flex items-center gap-2">
                              {book.bookshopLink && (
                                <a 
                                  href={book.bookshopLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff3c20]/10 hover:bg-[#ff3c20]/20 border border-[#ff3c20]/30 hover:border-[#ff3c20] text-[#ff3c20] rounded-lg text-[12px] uppercase font-bold tracking-wider transition-all"
                                  title="Support Local Bookstores via Bookshop.org"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>Bookshop</span>
                                </a>
                              )}
                              {(!book.bookshopLink && (book.amazonLink || book.url)) && (
                                <a 
                                  href={book.amazonLink || book.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-raised hover:bg-gold/20 text-ink-dim hover:text-gold border border-line hover:border-gold/50 rounded-lg transition-all"
                                  title="View on Amazon"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Detail Panel - Anchored to the LEFT (next to sidebar) */}
          {/* REMOVED FLOATING PANEL */}
        </div>

        {/* Insights Overlay */}
        {insightsItem && (
          <Suspense fallback={<LazyFallback />}>
            <InsightsView 
              item={insightsItem} 
              onClose={() => setInsightsItem(null)} 
              isSaved={savedRitualIds.has(insightsItem.id)}
              onToggleSave={toggleSaveRitual}
            />
          </Suspense>
        )}

        {/* Location Permission Popup */}
        {showLocationPopup && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-raised border border-line-hard rounded-2xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Enable Location</h3>
              <p className="text-ink-dim mb-8 leading-relaxed">
                To show you live events and signals in your immediate vicinity (500km radius), we need access to your location.
              </p>
              <div className="flex gap-4 w-full">
                <button 
                  onClick={handleDenyLocation}
                  className="flex-1 py-3 px-4 rounded-xl border border-line-hard text-ink hover:bg-hover transition-colors font-bold"
                >
                  Skip
                </button>
                <button 
                  onClick={handleAllowLocation}
                  className="flex-1 py-3 px-4 rounded-xl bg-accent text-on-accent hover:bg-white transition-colors font-bold"
                >
                  Allow Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account, reachable from every mobile tab.
          AccountMenu is a self-contained panel, so it only needs somewhere to
          sit; on a phone that is a bottom sheet rather than a map flyout. */}
      {isAccountOpen && isPhone && (
        <div className="sm:hidden fixed inset-0 z-[90] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close account"
            onClick={() => setIsAccountOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            className="relative bg-panel rounded-t-[28px] border-t border-line max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
          >
            <div className="w-10 h-1 bg-line-hard rounded-full mx-auto mt-3" aria-hidden="true" />
            <AccountMenu onClose={() => setIsAccountOpen(false)} />
          </div>
        </div>
      )}

      <MobileFilterSheet
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
        resultCount={filteredData.length}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        
        .leaflet-tooltip.custom-tooltip {
          background-color: #111;
          color: #fff;
          border: 1px solid #333;
          border-radius: 6px;
          font-family: inherit;
          font-weight: 600;
          padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .leaflet-tooltip-top.custom-tooltip::before {
          border-top-color: #333;
        }
      `}</style>
    </div>
  );
};

export default App;
