import React from 'react';
import { CultureItem } from '../types';

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
              className={`flex-shrink-0 w-64 bg-[#111]/90 backdrop-blur-md border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/50 hover:-translate-y-1 ${
                selectedId === item.id ? 'border-white' : 'border-[#333]'
              }`}
            >
              <div className="h-32 w-full overflow-hidden">
                <img
                  src={(() => {
                    const saved = localStorage.getItem('kairos_ai_images');
                    if (saved) {
                      const cache = JSON.parse(saved);
                      return cache[item.id] || item.imageUrl;
                    }
                    return item.imageUrl;
                  })()}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-3">
                <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                <p className="text-xs text-gray-400 mt-1 truncate">{item.region}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-[#222] px-2 py-1 rounded">
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
