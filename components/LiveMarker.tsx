
import React, { useEffect, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { UnifiedEvent } from '../types';
import { Radio, AlertTriangle } from 'lucide-react';

interface LiveMarkerProps {
  event: UnifiedEvent;
  onClick?: (event: UnifiedEvent) => void;
}

const LiveMarker: React.FC<LiveMarkerProps> = ({ event, onClick }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = event.endTime - now;
      if (diff <= 0) {
        setTimeLeft('Archived');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${mins}m`);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [event.endTime]);

  const getSeverityColor = (level: number) => {
    switch(level) {
      case 5: return '#ef4444'; // Red
      case 4: return '#f97316'; // Orange
      case 3: return '#eab308'; // Yellow
      default: return '#9fff00'; // Neon Green
    }
  };

  const color = getSeverityColor(event.severity);
  const visualSize = 12 + (event.severity * 2); // Slightly larger for higher severity
  const hitBoxSize = Math.max(32, visualSize + 16); // Ensure hitbox is at least 32px
  
  const isPulsing = event.status !== 'Scheduled';

  const pulseIcon = L.divIcon({
    className: 'live-pulse-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer" style="width: ${hitBoxSize}px; height: ${hitBoxSize}px;">
        <div class="relative flex items-center justify-center" style="width: ${visualSize}px; height: ${visualSize}px;">
          ${isPulsing ? `<span class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style="background-color: ${color}"></span>` : ''}
          <div class="relative inline-flex rounded-full" style="width: ${visualSize/2}px; height: ${visualSize/2}px; background-color: ${color}; box-shadow: 0 0 3px ${color}55"></div>
        </div>
      </div>
    `,
    iconSize: [hitBoxSize, hitBoxSize],
    iconAnchor: [hitBoxSize/2, hitBoxSize/2]
  });

  return (
    <Marker 
      position={event.coordinates} 
      icon={pulseIcon}
      eventHandlers={{ 
        click: (e) => {
          if (onClick) {
            L.DomEvent.stopPropagation(e);
            onClick(event);
          }
        }
      }}
    >
      <Tooltip direction="top" offset={[0, -16]} className="custom-tooltip">
        {event.title}
      </Tooltip>
    </Marker>
  );
};

export default React.memo(LiveMarker);
