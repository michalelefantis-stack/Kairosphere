
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
    <div className="h-full relative text-white bg-transparent overflow-y-auto custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="relative px-6 pb-6 pt-[80px] border-b border-white/10 bg-black/20">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-1.5 bg-black/60 hover:bg-[#9fff00] rounded-full transition-all border border-white/10 shadow-lg text-gray-300 hover:text-black"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-black px-2 py-0.5 rounded" style={{ backgroundColor: color }}>
            {event.severity >= 4 ? <AlertTriangle className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
            LIVE SIGNAL
          </span>
          <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
            SEVERITY {event.severity}
          </span>
        </div>

        <h2 className="text-2xl font-black text-white leading-tight uppercase font-sans mb-2">
          {event.title}
        </h2>
        
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono uppercase tracking-widest">
          <Activity className="w-3 h-3 text-[#9fff00]" />
          <span>Detected via {event.sourceUrl ? 'Remote Sensor' : 'Unknown Source'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        
        {/* Description */}
        <div className="space-y-2">
          <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">Intercept Data</h4>
          <div className="bg-[#1a1a1a] p-4 rounded-lg border border-white/5">
            <p className="text-sm text-gray-300 leading-relaxed font-mono">
              {event.description}
            </p>
          </div>
        </div>

        {/* Confidence — only pipeline events carry provenance */}
        {event.provenance && <ConfidenceBadge provenance={event.provenance} />}

         {/* Metadata Grid */}
        <div className="grid grid-cols-1 gap-4">
           {/* Time */}
           <div className="flex items-start gap-3 p-3 bg-[#1a1a1a]/50 rounded-lg border border-white/5">
             <div className="p-2 bg-[#1a1a1a] rounded text-[#9fff00]">
               <Clock className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Detection Time</span>
               <span className="text-xs text-gray-200 font-mono">
                 {formatTime(event.detectedAt)}
               </span>
             </div>
           </div>

           {/* Status / Scope */}
           <div className="flex items-start gap-3 p-3 bg-[#1a1a1a]/50 rounded-lg border border-white/5">
             <div className="p-2 bg-[#1a1a1a] rounded text-[#9fff00]">
               <Activity className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Timeline Status</span>
               <span className={`text-xs font-mono font-bold ${event.status === 'Active' ? 'text-[#9fff00] animate-pulse' : 'text-gray-200'}`}>
                 {event.status === 'Active' ? 'HAPPENING NOW' : `SCHEDULED: ${new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`}
               </span>
             </div>
           </div>

           {/* Location */}
           <div className="flex items-start gap-3 p-3 bg-[#1a1a1a]/50 rounded-lg border border-white/5">
             <div className="p-2 bg-[#1a1a1a] rounded text-[#9fff00]">
               <MapPin className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Location</span>
               <span className="text-[11px] text-white font-bold leading-tight mb-1 uppercase">
                 {event.location ? `${event.location}${event.country && event.country !== event.location ? `, ${event.country}` : ''}` : (event.country || 'Global Context')}
               </span>
               <span className="text-[9px] text-gray-500 font-mono">
                 {/* Never print more decimals than the source actually supports. */}
                 COORD: {event.coordinates[0].toFixed(coordDigits)}, {event.coordinates[1].toFixed(coordDigits)}
                 {event.provenance && event.provenance.precision !== 'point' && (
                   <span className="text-gray-600"> ({event.provenance.precision})</span>
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
              className="flex items-center justify-between w-full p-3 bg-[#111] hover:bg-[#222] border border-[#333] hover:border-[#9fff00] rounded-lg transition-all group"
            >
              <span className="text-[10px] font-bold text-gray-400 group-hover:text-white uppercase tracking-widest">
                View Source Signal
              </span>
              <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[#9fff00]" />
            </a>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-4 bg-[#0a0a0a]/50 border-t border-white/5">
        <div className="flex items-center justify-between opacity-40">
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">UUID</span>
            <span className="text-[9px] font-mono text-white tracking-widest">{event.uuid.substring(0, 8)}...</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">TTL</span>
            <span className="text-[9px] font-mono text-[#9fff00] tracking-widest">
              {new Date(event.endTime).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDetailPanel;
