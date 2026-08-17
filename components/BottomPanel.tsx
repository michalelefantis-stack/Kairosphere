import React from 'react';
import { CultureItem } from '../types';
import { aiImageFor } from '../utils/aiImageCache';

interface BottomPanelProps {
  items: CultureItem[];
  onSelectItem: (item: CultureItem) => void;
  selectedId?: string;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ items, onSelectItem, selectedId }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
      <div className="max-w-full overflow-x-auto no-scrollbar pointer-events-auto">
        <div className="flex gap-4 pb-2">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={`flex-shrink-0 w-64 bg-raised/90 backdrop-blur-md border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/50 hover:-translate-y-1 ${
                selectedId === item.id ? 'border-white' : 'border-line-hard'
              }`}
            >
              <div className="h-32 w-full overflow-hidden">
                <img
                  src={aiImageFor(item.id, item.imageUrl)}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-3">
                <h4 className="text-sm font-bold text-ink truncate">{item.title}</h4>
                <p className="text-xs text-ink-dim mt-1 truncate">{item.region}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] uppercase tracking-wider text-ink-faint bg-hover px-2 py-1 rounded">
                    {item.ritualType}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default BottomPanel;
