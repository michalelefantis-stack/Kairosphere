
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
    <div className="bg-[#111]/90 backdrop-blur-md border border-[#333] rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
      <div 
        className="px-6 py-3 border-b border-[#222] flex justify-between items-center bg-[#0a0a0a] cursor-pointer group select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#9fff00]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">Upcoming Events</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#9fff00] animate-pulse"></span>
            Global Tracking Active
          </div>
          <button className="p-1 bg-[#222] group-hover:bg-[#333] rounded transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-[#9fff00]" />}
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
              className="flex-shrink-0 w-[320px] bg-[#1a1a1a] border border-[#333] rounded-lg p-4 space-y-3 hover:border-[#9fff00]/50 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex justify-between items-start relative z-10">
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-tighter ${
                  daysUntil <= 30 && daysUntil >= 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#222] text-gray-400'
                }`}>
                  {daysUntil < 0 ? 'Active/Concluded' : `Starts in ${daysUntil} ${daysUntil === 1 ? 'Day' : 'Days'}`}
                </span>
                {item.verified && (
                  <CheckCircle className="w-4 h-4 text-[#9fff00] fill-[#9fff00]/10" />
                )}
              </div>
              
              <div className="relative z-10">
                <h3 className="text-sm font-bold text-white group-hover:text-[#9fff00] transition-colors leading-tight line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                  {item.region} • <span className="text-gray-400">{new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </p>
              </div>

              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed h-[32px] relative z-10">
                {item.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[#222] relative z-10">
                <div className="flex -space-x-1.5">
                   {[1,2].map(i => (
                     <img 
                       key={i} 
                       src={`https://i.pravatar.cc/100?u=${item.id}${i}`} 
                       className="w-5 h-5 rounded-full border border-[#1a1a1a] transition-all"
                       alt="Archivist"
                     />
                   ))}
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{item.ritualType}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingFeed;
