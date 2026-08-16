
import React from 'react';
import { UnifiedEvent } from '../types';
import { X, MapPin, Radio, AlertTriangle, Clock, ExternalLink, Activity } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

interface LiveDetailPanelProps {
  event: UnifiedEvent;
  onClose: () => void;
}

const LiveDetailPanel: React.FC<LiveDetailPanelProps> = ({ event, onClose }) => {
  const getSeverityColor = (level: number) => {
    switch(level) {
      case 5: return '#ef4444'; // Red
      case 4: return '#f97316'; // Orange
      case 3: return '#eab308'; // Yellow
      default: return '#9fff00'; // Neon Green
    }
  };

  const color = getSeverityColor(event.severity);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // A blurred coordinate should not be displayed to four decimals.
  const coordDigits =
    event.provenance?.precision === 'country' ? 0 :
    event.provenance?.precision === 'regional' ? 1 : 4;

  return (
    <div className="h-full relative text-ink bg-transparent overflow-y-auto custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="relative px-6 pb-6 pt-[80px] border-b border-white/10 bg-black/20">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-1.5 bg-black/60 hover:bg-accent rounded-full transition-all border border-white/10 shadow-lg text-ink hover:text-on-accent"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-on-accent px-2 py-0.5 rounded" style={{ backgroundColor: color }}>
            {event.severity >= 4 ? <AlertTriangle className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
            LIVE SIGNAL
          </span>
          <span className="text-[12px] font-mono text-ink-faint flex items-center gap-1">
            SEVERITY {event.severity}
          </span>
        </div>

        <h2 className="text-2xl font-black text-ink leading-tight uppercase font-sans mb-2">
          {event.title}
        </h2>
        
        <div className="flex items-center gap-2 text-[12px] text-ink-dim font-mono uppercase tracking-widest">
          <Activity className="w-3 h-3 text-accent" />
          <span>Detected via {event.sourceUrl ? 'Remote Sensor' : 'Unknown Source'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        
        {/* Description */}
        <div className="space-y-2">
          <h4 className="text-[12px] text-ink-faint uppercase font-black tracking-[0.1em]">Intercept Data</h4>
          <div className="bg-raised p-4 rounded-lg border border-white/5">
            <p className="text-sm text-ink leading-relaxed font-mono">
              {event.description}
            </p>
          </div>
        </div>

        {/* Confidence — only pipeline events carry provenance */}
        {event.provenance && <ConfidenceBadge provenance={event.provenance} />}

         {/* Metadata Grid */}
        <div className="grid grid-cols-1 gap-4">
           {/* Time */}
           <div className="flex items-start gap-3 p-3 bg-raised/50 rounded-lg border border-white/5">
             <div className="p-2 bg-raised rounded text-accent">
               <Clock className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-0.5">Detection Time</span>
               <span className="text-xs text-ink font-mono">
                 {formatTime(event.detectedAt)}
               </span>
             </div>
           </div>

           {/* Status / Scope */}
           <div className="flex items-start gap-3 p-3 bg-raised/50 rounded-lg border border-white/5">
             <div className="p-2 bg-raised rounded text-accent">
               <Activity className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-0.5">Timeline Status</span>
               <span className={`text-xs font-mono font-bold ${event.status === 'Active' ? 'text-accent animate-pulse' : 'text-ink'}`}>
                 {event.status === 'Active' ? 'HAPPENING NOW' : `SCHEDULED: ${new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`}
               </span>
             </div>
           </div>

           {/* Location */}
           <div className="flex items-start gap-3 p-3 bg-raised/50 rounded-lg border border-white/5">
             <div className="p-2 bg-raised rounded text-accent">
               <MapPin className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest mb-0.5">Location</span>
               <span className="text-[12px] text-ink font-bold leading-tight mb-1 uppercase">
                 {event.location ? `${event.location}${event.country && event.country !== event.location ? `, ${event.country}` : ''}` : (event.country || 'Global Context')}
               </span>
               <span className="text-[11px] text-ink-faint font-mono">
                 {/* Never print more decimals than the source actually supports. */}
                 COORD: {event.coordinates[0].toFixed(coordDigits)}, {event.coordinates[1].toFixed(coordDigits)}
                 {event.provenance && event.provenance.precision !== 'point' && (
                   <span className="text-ink-faint"> ({event.provenance.precision})</span>
                 )}
               </span>
             </div>
           </div>
        </div>

        {/* Source Link */}
        {event.sourceUrl && (
          <div className="pt-4 border-t border-white/5">
            <a 
              href={event.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full p-3 bg-raised hover:bg-hover border border-line-hard hover:border-accent rounded-lg transition-all group"
            >
              <span className="text-[12px] font-bold text-ink-dim group-hover:text-ink uppercase tracking-widest">
                View Source Signal
              </span>
              <ExternalLink className="w-3 h-3 text-ink-faint group-hover:text-accent" />
            </a>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-4 bg-base/50 border-t border-white/5">
        <div className="flex items-center justify-between opacity-40">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase text-ink-faint tracking-widest">UUID</span>
            <span className="text-[11px] font-mono text-ink tracking-widest">{event.uuid.substring(0, 8)}...</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-black uppercase text-ink-faint tracking-widest">TTL</span>
            <span className="text-[11px] font-mono text-accent tracking-widest">
              {new Date(event.endTime).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDetailPanel;
