
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, ArrowRight, Backpack } from 'lucide-react';
import { CultureItem, RitualType } from '../types';

interface CalendarViewProps {
  events: CultureItem[];
  onSelect: (item: CultureItem) => void;
  selectedId?: string;
  savedRitualIds?: Set<string>;
  onToggleSave?: (id: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelect, selectedId, savedRitualIds = new Set(), onToggleSave }) => {
  const [activeMonthIndex, setActiveMonthIndex] = useState(new Date().getMonth());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrolling = useRef(false);

  // Group events by month - ensures every event is placed in its UTC start month
  const groupedEvents = useMemo(() => {
    const groups: Record<number, CultureItem[]> = {};
    for (let i = 0; i < 12; i++) groups[i] = [];
    
    events.forEach(event => {
      const date = new Date(event.startDate);
      const month = date.getUTCMonth(); 
      if (groups[month]) {
        groups[month].push(event);
      }
    });

    Object.keys(groups).forEach(key => {
      groups[Number(key)].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    });

    return groups;
  }, [events]);

  // Mouse wheel horizontal scrolling for the top month navbar
  useEffect(() => {
    const nav = navContainerRef.current;
    if (!nav) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        nav.scrollLeft += e.deltaY;
      }
    };

    nav.addEventListener('wheel', handleWheel, { passive: false });
    return () => nav.removeEventListener('wheel', handleWheel);
  }, []);

  // Sync active month button in navbar when activeMonthIndex changes (e.g. from click)
  useEffect(() => {
    if (isAutoScrolling.current) {
      const nav = navContainerRef.current;
      const buttonsContainer = nav?.querySelector('.month-buttons-container');
      const activeBtn = buttonsContainer?.children[activeMonthIndex] as HTMLElement;
      if (nav && activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeMonthIndex]);

  // IntersectionObserver to sync vertical scroll position with the top navbar
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observerOptions = {
      root: container,
      threshold: [0.01, 0.1, 0.5], 
      rootMargin: "-10% 0px -50% 0px" 
    };

    const observer = new IntersectionObserver((entries) => {
      if (isAutoScrolling.current) return;
      
      const visibleEntry = entries.find(entry => entry.isIntersecting);
      
      if (visibleEntry) {
        const indexStr = visibleEntry.target.getAttribute('data-month-index');
        if (indexStr !== null) {
          const index = parseInt(indexStr);
          setActiveMonthIndex(index);
          
          // Ensure the active month in the navbar is scrolled into view horizontally
          const nav = navContainerRef.current;
          const buttonsContainer = nav?.querySelector('.month-buttons-container');
          const activeBtn = buttonsContainer?.children[index] as HTMLElement;
          if (nav && activeBtn) {
            const navRect = nav.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            if (btnRect.left < navRect.left || btnRect.right > navRect.right) {
              activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
        }
      }
    }, observerOptions);

    monthRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [events]);

  const scrollToMonth = (index: number) => {
    const target = monthRefs.current[index];
    const container = scrollContainerRef.current;
    
    if (target && container) {
      isAutoScrolling.current = true;
      setActiveMonthIndex(index);
      
      // Calculate position relative to container
      const topPos = target.offsetTop;
      
      container.scrollTo({
        top: topPos - 24, 
        behavior: 'smooth'
      });
      
      // Unlock observer after the smooth scroll finishes
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 1000);
    }
  };

  const getEventTypeColor = (type: RitualType) => {
    switch(type) {
      case RitualType.PHENOMENON: return '#00d4ff';
      case RitualType.SPIRITUAL: return '#d400ff';
      case RitualType.FESTIVAL: return '#9fff00';
      case RitualType.CEREMONY: return '#ff8a00';
      case RitualType.PILGRIMAGE: return '#ff0055';
      case RitualType.PERFORMANCE: return '#00ffa2';
      default: return '#ffffff';
    }
  };

  return (
    <div className="w-full h-full bg-[#050505] flex flex-col relative overflow-hidden min-h-0 pt-2 sm:pt-[80px]">
      {/* TOP NAVBAR: Horizontal Month Navigator */}
      <div 
        ref={navContainerRef}
        className="z-50 bg-[#080808]/90 backdrop-blur-3xl border-b border-[#1a1a1a] px-8 py-5 flex-shrink-0 shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center gap-10 min-w-max">
          <div className="flex items-center gap-3 pr-8 border-r border-[#222]">
            <div className="p-1.5 bg-[#9fff00]/10 rounded shadow-[0_0_10px_rgba(159,255,0,0.1)]">
              <CalendarIcon className="w-3.5 h-3.5 text-[#9fff00]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500">Timeline</span>
          </div>
          <div className="flex items-center gap-8 month-buttons-container">
            {MONTHS.map((month, index) => (
              <button
                key={month}
                onClick={() => scrollToMonth(index)}
                className={`text-[9px] font-black uppercase tracking-[0.3em] transition-all duration-300 relative py-2 ${
                  activeMonthIndex === index ? 'text-[#9fff00] scale-110' : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                {month}
                {activeMonthIndex === index && (
                  <div className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#9fff00] shadow-[0_0_15px_rgba(159,255,0,0.8)] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: Vertical Continuous Scroll */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-8 pt-4 pb-[20vh] scroll-smooth snap-y snap-proximity relative"
      >
        {MONTHS.map((month, index) => {
          const monthEvents = groupedEvents[index];
          
          return (
            <div 
              key={month} 
              data-month-index={index}
              ref={(el) => { monthRefs.current[index] = el; }}
              className="mb-8 pt-6 snap-start flex flex-col"
            >
              {/* Page Header */}
              <div className="flex items-end gap-4 mb-6 border-b border-[#1a1a1a] pb-4 relative group">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-black text-white leading-none tracking-tighter uppercase drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]">
                    {month}
                  </h2>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-[#222] via-[#222] to-transparent mb-4 opacity-30 group-hover:opacity-60 transition-opacity"></div>
                <div className="mb-2 text-right">
                  <span className="text-[9px] font-mono text-gray-600 block uppercase tracking-[0.2em] mb-1">Detections</span>
                  <span className="text-3xl font-mono text-white/10 font-black tracking-tighter">
                    {monthEvents.length.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Grid Layout - Adjusted for 5 cols */}
              {monthEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[#111] rounded-[32px] transition-all hover:border-[#1a1a1a] group/empty bg-white/[0.01]">
                  <Clock className="w-12 h-12 mb-4 opacity-5 group-hover/empty:opacity-10 transition-opacity" />
                  <p className="text-xl font-black tracking-[0.1em] uppercase opacity-10 group-hover/empty:opacity-20 transition-opacity">Temporal Static</p>
                  <p className="text-[9px] uppercase tracking-[0.6em] mt-2 opacity-10 group-hover/empty:opacity-20">No verified archival records</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pb-4">
                  {monthEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onSelect(event)}
                      className={`group relative h-[220px] bg-[#0c0c0c] rounded-2xl overflow-hidden border transition-all duration-700 cursor-pointer ${
                        selectedId === event.id 
                          ? 'border-[#9fff00] shadow-[0_0_40px_rgba(159,255,0,0.15)] ring-1 ring-[#9fff00]/50 scale-[1.02]' 
                          : 'border-[#1a1a1a] hover:border-[#444] hover:translate-y-[-4px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.8)]'
                      }`}
                    >
                      {/* Image Layer */}
                      <div className="absolute inset-0 z-0">
                        <img 
                          src={(() => {
                            const saved = localStorage.getItem('kairos_ai_images');
                            if (saved) {
                              const cache = JSON.parse(saved);
                              return cache[event.id] || event.imageUrl;
                            }
                            return event.imageUrl;
                          })()} 
                          className="w-full h-full object-cover opacity-30 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-50" 
                          alt={event.title}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/50 to-transparent"></div>
                      </div>

                      {/* Header Badge Layer */}
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20 pointer-events-none">
                         <div className="flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                           <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_currentcolor]" style={{ color: getEventTypeColor(event.ritualType), backgroundColor: getEventTypeColor(event.ritualType) }}></div>
                           <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/90 truncate max-w-[80px]">{event.ritualType}</span>
                         </div>
                         <div className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
                           <ArrowRight className="w-3 h-3 text-[#9fff00]" />
                         </div>
                      </div>

                      {/* Content Overlay */}
                      <div className="absolute inset-0 p-4 flex flex-col justify-end z-10 pointer-events-none">
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-black text-white group-hover:text-[#9fff00] transition-colors leading-[1.1] tracking-tighter uppercase line-clamp-2">
                            {event.title}
                          </h3>
                          
                          <div className="flex flex-col gap-1.5 pt-1.5 border-l-2 border-[#9fff00]/30 pl-3 relative">
                            <div className="flex items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                              <MapPin className="w-3.5 h-3.5 text-[#9fff00]" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate w-full">{event.region}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-mono tracking-tighter text-gray-400">
                                {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            
                            {/* Backpack Icon for saving */}
                            {onToggleSave && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSave(event.id);
                                }}
                                className={`absolute right-0 bottom-0 p-1.5 rounded-full backdrop-blur-md transition-all border shadow-lg pointer-events-auto ${
                                  savedRitualIds.has(event.id)
                                  ? 'bg-[#9fff00] border-[#9fff00] text-black' 
                                  : 'bg-black/60 border-white/10 text-gray-300 hover:bg-[#9fff00] hover:border-[#9fff00] hover:text-black'
                                }`}
                                title={savedRitualIds.has(event.id) ? "Remove from Itinerary" : "Add to Itinerary"}
                              >
                                <Backpack className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Meta on Hover */}
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-700 delay-100">
                          <div className="flex flex-col">
                            <span className="text-[7px] font-bold uppercase text-gray-600 tracking-[0.2em] mb-1">Verif.</span>
                            <div className="flex gap-0.5">
                               {Array.from({length: 6}).map((_, i) => (
                                 <div key={i} className={`w-2 h-1 rounded-full ${i < 5 ? 'bg-[#9fff00]/60' : 'bg-gray-900'}`}></div>
                               ))}
                            </div>
                          </div>
                          <span className="text-[8px] font-mono text-gray-700 font-black">#{event.id.substring(0, 3).toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Visual Category Stripe */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-700 opacity-0 group-hover:opacity-100"
                        style={{ backgroundColor: getEventTypeColor(event.ritualType), boxShadow: `0 -15px 40px ${getEventTypeColor(event.ritualType)}` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: #111; 
          border-radius: 10px;
          transition: background 0.3s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222; }
        
        /* Smooth snapping for vertical pages */
        .snap-mandatory {
          scroll-snap-type: y mandatory;
        }
        /* Proximity snapping for flexible content */
        .snap-proximity {
          scroll-snap-type: y proximity;
        }
        .snap-start {
          scroll-snap-align: start;
        }
      `}</style>
    </div>
  );
};

export default CalendarView;
