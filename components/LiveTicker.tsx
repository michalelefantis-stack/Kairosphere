
import React from 'react';
import { UnifiedEvent, EventCategory } from '../types';
import { AlertCircle, Zap, Flower, Cross, Radio, ChevronRight, Activity, Globe, ExternalLink, Loader2, Navigation, AlertTriangle } from 'lucide-react';
import LiveDetailPanel from './LiveDetailPanel';
import { ConfidenceChip } from './ConfidenceBadge';
import { calculateDistance } from '../utils/geo';

interface LiveTickerProps {
  events: UnifiedEvent[];
  onEventClick: (event: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onCloseDetail: () => void;
  userCoords?: [number, number] | null;
  feedIsStale?: boolean;
}

const LiveTicker: React.FC<LiveTickerProps> = ({ events, onEventClick, selectedEvent, onCloseDetail, userCoords, feedIsStale }) => {
  const [showLocalOnly, setShowLocalOnly] = React.useState(false);
  
  const filteredEvents = React.useMemo(() => {
    // Rank by what a reader actually wants: happening now, and how sure we are.
    // Sorting on detectedAt alone just favours whichever feed ran most
    // recently, which buries verified entries under freshly-scraped noise.
    // Events with no provenance sort as "unknown" rather than as zero.
    const UNKNOWN_CONFIDENCE = 0.5;
    const rank = (e: UnifiedEvent) => e.provenance?.confidence ?? UNKNOWN_CONFIDENCE;

    let sorted = [...events].sort((a, b) => {
      const aActive = a.status === 'Active' ? 1 : 0;
      const bActive = b.status === 'Active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const byConfidence = rank(b) - rank(a);
      if (Math.abs(byConfidence) > 0.001) return byConfidence;
      return b.detectedAt - a.detectedAt;
    });
    if (!showLocalOnly || !userCoords) return sorted;
    return sorted.filter(e => {
        if (!e.coordinates) return false;
        const dist = calculateDistance(userCoords[0], userCoords[1], e.coordinates[0], e.coordinates[1]);
        return dist <= 2000; // 2000km radius
    });
  }, [events, showLocalOnly, userCoords]);
  
  const getCategoryIcon = (cat: EventCategory) => {
    switch (cat) {
      case EventCategory.COSMIC: return <Zap className="w-3 h-3" />;
      case EventCategory.ATMOSPHERIC: return <Activity className="w-3 h-3" />;
      case EventCategory.FLORA: return <Flower className="w-3 h-3" />;
      case EventCategory.MIGRATION: return <Globe className="w-3 h-3" />;
      case EventCategory.RITUAL: return <Cross className="w-3 h-3" />;
      case EventCategory.UNREST: return <AlertTriangle className="w-3 h-3" />;
      default: return <Radio className="w-3 h-3" />;
    }
  };

  const getSeverityColor = (level: number) => {
    switch (level) {
      case 5: return 'text-red-500 border-red-500 bg-red-500/10 animate-pulse';
      case 4: return 'text-orange-500 border-orange-500 bg-orange-500/10';
      case 3: return 'text-yellow-500 border-yellow-500 bg-yellow-500/10';
      default: return 'text-accent border-accent bg-accent/10';
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  };

  return (
    <div className="h-full bg-transparent flex flex-col w-full relative">
      {/* Header */}
      <div className="p-4 pt-[80px] border-b border-line bg-transparent">
        <div className="flex items-center justify-between mb-3">
           <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
             <Activity className="w-5 h-5 text-accent" />
             Live Pulse
           </h2>
           <button 
             onClick={() => setShowLocalOnly(!showLocalOnly)}
             disabled={!userCoords}
             className={`flex items-center gap-1.5 text-[12px] font-bold uppercase px-3 py-1.5 rounded-full transition-all border ${showLocalOnly ? 'bg-accent text-on-accent border-accent shadow-[0_0_10px_var(--k-glow)]' : 'bg-base text-ink-dim border-line-hard hover:text-ink hover:border-line-hard'} ${!userCoords && 'opacity-50 cursor-not-allowed hidden sm:flex'}`}
             title={!userCoords ? "Enable location in your browser first" : "Toggle local radar"}
           >
             <Navigation className={`w-3.5 h-3.5 ${showLocalOnly ? 'text-on-accent' : 'text-accent'}`} />
             {showLocalOnly ? 'Local Radar' : 'Global Scan'}
           </button>
        </div>
        <div className="flex gap-2 text-[11px] font-mono text-ink-faint justify-between items-center">
          <div className="flex gap-2">
            <span>MONITORS: ACTIVE</span>
            <span>|</span>
            <span className="text-accent animate-pulse">LATENCY: 42ms</span>
          </div>
          {showLocalOnly && <span className="font-bold text-accent">{filteredEvents.length} NEARBY</span>}
        </div>
      </div>

      {/* A stale feed says so rather than presenting old numbers as current. */}
      {feedIsStale && (
        <div className="px-4 py-2 bg-gold/10 border-b border-gold/30 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-gold shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-gold">
            Feed not refreshed recently — confidence shown is decayed
          </span>
        </div>
      )}

      {/* Content: Detail Panel or List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {selectedEvent ? (
          <div className="absolute inset-0 z-10 bg-transparent">
            <LiveDetailPanel event={selectedEvent} onClose={onCloseDetail} />
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {events.length === 0 && (
                <div className="p-8 text-center opacity-50 flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    <span className="text-[12px] uppercase tracking-widest text-ink-faint">Acquiring Global Signals...</span>
                </div>
            )}
            
            {(events.length > 0 && filteredEvents.length === 0) && (
                <div className="p-8 text-center opacity-70 flex flex-col items-center justify-center h-full mt-10">
                    <Navigation className="w-8 h-8 mx-auto mb-3 text-ink-faint" />
                    <span className="text-xs font-bold uppercase tracking-widest text-ink-dim">Silence on Radar</span>
                    <span className="text-[12px] text-ink-faint mt-2">No cultural anomalies detected within 2000km. Ensure your location is granted or switch to Global.</span>
                </div>
            )}

            {filteredEvents.map((event) => (
              <div 
                key={event.uuid}
                onClick={() => onEventClick(event)}
                className="group relative bg-panel border border-line-soft hover:border-line-hard p-3 rounded cursor-pointer transition-all hover:translate-x-1"
              >
                {/* Severity Stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getSeverityColor(event.severity).split(' ')[0].replace('text-', 'bg-')}`}></div>

                <div className="pl-3">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    {/* Pipeline events lead with confidence; legacy feeds keep severity. */}
                    {event.provenance ? (
                      <ConfidenceChip provenance={event.provenance} />
                    ) : (
                      <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded border ${getSeverityColor(event.severity)}`}>
                         LEV {event.severity}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-ink-faint shrink-0">
                      {new Date(event.detectedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  
                  <h3 className="text-xs font-bold text-ink group-hover:text-ink leading-tight mb-1">
                    {event.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-[11px] font-mono text-ink-faint mb-1.5 mt-1 border-b border-line-soft pb-1.5 opacity-80">
                     <span className="truncate pr-2 uppercase">
                        {event.location ? `${event.location}${event.country && event.country !== event.location ? `, ${event.country}` : ''}` : (event.country || 'Global Context')}
                     </span>
                     <span className={event.status === 'Active' ? "text-accent font-bold animate-pulse whitespace-nowrap flex items-center gap-1" : "text-ink-dim whitespace-nowrap"}>
                        {event.status === 'Active' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                            HAPPENING NOW
                          </>
                        ) : new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                     </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-[12px] text-ink-faint mb-2 mt-1.5">
                    {getCategoryIcon(event.category)}
                    <span className="uppercase tracking-wide">{event.category}</span>
                  </div>
                  
                  {/* Source Link */}
                  <div className="mt-2 pt-2 border-t border-line-soft flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity">
                     <a 
                       href={event.sourceUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-1.5 hover:text-accent transition-colors z-10"
                       onClick={(e) => e.stopPropagation()} // Prevent triggering parent click
                     >
                         <Globe className="w-3 h-3" />
                         <span className="text-[11px] font-mono text-ink-faint hover:text-accent hover:underline decoration-accent truncate max-w-[120px]">
                            {getHostname(event.sourceUrl)}
                         </span>
                         <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                     </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="p-3 border-t border-line bg-panel text-[11px] font-mono text-ink-faint flex justify-between z-20">
         <span>EVENTS (24H): {filteredEvents.length}</span>
         <span>SYS: ONLINE</span>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
};

export default LiveTicker;
