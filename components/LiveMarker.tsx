import React, { useEffect, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { UnifiedEvent } from '../types';
import { categoryColor, categoryGlyph } from '../utils/categoryTheme';
import { timingLabel } from '../utils/eventFormat';

interface LiveMarkerProps {
  event: UnifiedEvent;
  onClick?: (event: UnifiedEvent) => void;
}

/**
 * One marker language for the whole map.
 *
 * Live events used to be bare dots scaled by severity while culture events
 * were icon badges, so the two layers never read as one system — and the size
 * encoded a number that was largely invented. Now both are the same badge with
 * a category glyph, and the pulsing ring means the one thing a reader scans
 * for: this is happening right now.
 */
const LiveMarker: React.FC<LiveMarkerProps> = ({ event, onClick }) => {
  const [, forceTick] = useState(0);

  useEffect(() => {
    // Keeps the "2 days left" tooltip honest without re-rendering the map.
    const timer = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const color = categoryColor(event.category);
  const glyph = categoryGlyph(event.category);
  const isLive = event.status === 'Active';

  const badge = 26;
  const hit = 40;

  const icon = L.divIcon({
    className: 'live-pulse-marker',
    html: `
      <div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="position:relative;width:${badge}px;height:${badge}px;display:flex;align-items:center;justify-content:center;">
          ${isLive ? `<span style="position:absolute;inset:-3px;border-radius:50%;border:2px solid ${color};opacity:.75;" class="animate-ping"></span>` : ''}
          <div style="
            width:${badge}px;height:${badge}px;border-radius:50%;
            background:color-mix(in srgb, ${color} 22%, #0d0c0b);
            border:1.5px solid ${color};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 4px rgb(0 0 0 / .5);
          ">
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path d="${glyph}" fill="${color}"/>
            </svg>
          </div>
        </div>
      </div>`,
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit / 2]
  });

  return (
    <Marker
      position={event.coordinates}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(event) }}
    >
      <Tooltip direction="top" offset={[0, -16]} className="custom-tooltip">
        <span className="font-semibold">{event.title}</span>
        <span className="block opacity-80">{timingLabel(event)}</span>
      </Tooltip>
    </Marker>
  );
};

export default LiveMarker;
