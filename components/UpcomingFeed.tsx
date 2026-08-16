
import React from 'react';
import { CultureItem } from '../types';
import { CheckCircle, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';

interface UpcomingFeedProps {
  data: CultureItem[];
  isOpen: boolean;
  onToggle: () => void;
}

const UpcomingFeed: React.FC<UpcomingFeedProps> = ({ data, isOpen, onToggle }) => {
  const getDaysUntil = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="bg-raised/90 backdrop-blur-md border border-line-hard rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
      <div 
        className="px-6 py-3 border-b border-line flex justify-between items-center bg-base cursor-pointer group select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink">Upcoming Events</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-ink-faint font-mono">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Global Tracking Active
          </div>
          <button className="p-1 bg-hover group-hover:bg-line-hard rounded transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4 text-ink-dim" /> : <ChevronUp className="w-4 h-4 text-accent" />}
          </button>
        </div>
      </div>
      
      <div 
        className={`p-4 flex gap-4 overflow-x-auto custom-scrollbar overflow-y-hidden transition-all duration-500 ${
          isOpen ? 'opacity-100 max-h-[300px] pb-6' : 'opacity-0 max-h-0 py-0 pb-0 overflow-hidden'
        }`}
      >
        {data.map((item) => {
          const daysUntil = getDaysUntil(item.startDate);
          return (
            <div 
              key={item.id}
              className="flex-shrink-0 w-[320px] bg-raised border border-line-hard rounded-lg p-4 space-y-3 hover:border-accent/50 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex justify-between items-start relative z-10">
                <span className={`text-[12px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-tighter ${
                  daysUntil <= 30 && daysUntil >= 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-hover text-ink-dim'
                }`}>
                  {daysUntil < 0 ? 'Active/Concluded' : `Starts in ${daysUntil} ${daysUntil === 1 ? 'Day' : 'Days'}`}
                </span>
                {item.verified && (
                  <CheckCircle className="w-4 h-4 text-accent fill-accent/10" />
                )}
              </div>
              
              <div className="relative z-10">
                <h3 className="text-sm font-bold text-ink group-hover:text-accent transition-colors leading-tight line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-[12px] text-ink-faint mt-0.5 flex items-center gap-1">
                  {item.region} • <span className="text-ink-dim">{new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </p>
              </div>

              <p className="text-[12px] text-ink-dim line-clamp-2 leading-relaxed h-[32px] relative z-10">
                {item.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-line relative z-10">
                <div className="flex -space-x-1.5">
                   {[1,2].map(i => (
                     <img 
                       key={i} 
                       src={`https://i.pravatar.cc/100?u=${item.id}${i}`} 
                       className="w-5 h-5 rounded-full border border-line-soft transition-all"
                       alt="Archivist"
                     />
                   ))}
                </div>
                <span className="text-[11px] text-ink-faint font-bold uppercase tracking-tighter">{item.ritualType}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingFeed;
