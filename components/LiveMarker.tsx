import React, { useEffect, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { UnifiedEvent } from '../types';
import { markerHtml, MARKER_HIT_SIZE } from '../utils/markerIcon';
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

  const icon = L.divIcon({
    className: 'live-pulse-marker',
    html: markerHtml({ type: event.category, live: event.status === 'Active' }),
    iconSize: [MARKER_HIT_SIZE, MARKER_HIT_SIZE],
    iconAnchor: [MARKER_HIT_SIZE / 2, MARKER_HIT_SIZE / 2]
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
