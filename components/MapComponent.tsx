
import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CultureItem, UnifiedEvent } from '../types';
import LiveMarker from './LiveMarker';
import { calculateDistance } from '../utils/geo';
import { categoryColor } from '../utils/categoryTheme';

interface MapComponentProps {
  data: CultureItem[];
  onSelect: (item: CultureItem) => void;
  selectedItem: CultureItem | null;
  liveEvents?: UnifiedEvent[]; 
  focusCoords?: [number, number] | null;
  onLiveEventSelect?: (event: UnifiedEvent) => void;
  userCoords?: [number, number] | null;
  activeTab?: string;
}

// ── Icon cache ──────────────────────────────────────────────────────────────
const iconCache = new Map<string, L.DivIcon>();

// Returns an inline SVG path string for the given type/subCategory
const getIconPath = (type: string, subCategory?: string): string => {
  const sub = (subCategory || '').toLowerCase();

  // subCategory overrides first
  if (sub.includes('fire'))      return 'M8,2 C8,2 13,8 13,11 A5,5 0 0,1 3,11 C3,8 8,2 8,2Z M6.5,11 C6.5,9.5 8,8.5 9,10';
  if (sub.includes('water'))     return 'M2,10 C4,7 6,12 8,9 C10,6 12,11 14,8';
  if (sub.includes('dance') || sub.includes('music') || sub.includes('musical')) return 'M11,2 L11,10 A3,3 0 1,0 8,10 M11,2 L7,4 L7,2Z';
  if (sub.includes('light'))     return 'M8,8 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M8,1 L8,3 M8,13 L8,15 M1,8 L3,8 M13,8 L15,8 M3.5,3.5 L5,5 M11,11 L12.5,12.5 M12.5,3.5 L11,5 M5,11 L3.5,12.5';
  if (sub.includes('harvest') || sub.includes('flora') || sub.includes('botanical')) return 'M8,14 L8,7 M8,7 C8,7 4,4 4,1 C7,2 8,7 8,7 M8,7 C8,7 12,4 12,1 C9,2 8,7 8,7';
  if (sub.includes('cosmic') || sub.includes('solar') || sub.includes('atmospheric')) return 'M8,1 L9.8,6 L15,6 L10.8,9.2 L12.5,14.5 L8,11.5 L3.5,14.5 L5.2,9.2 L1,6 L6.2,6Z';
  if (sub.includes('mountain') || sub.includes('geological')) return 'M8,2 L14,13 L2,13Z M5.5,13 L8,7.5 L10.5,13';
  if (sub.includes('ancestor') || sub.includes('trance') || sub.includes('shamanic')) return 'M2,9 Q8,3 14,9 Q8,15 2,9Z M8,6 A2.5,2.5 0 1,0 8,11 A2.5,2.5 0 1,0 8,6Z';
  if (sub.includes('initiation') || sub.includes('journey') || sub.includes('pilgrimage')) return 'M8,1 A2.5,2.5 0 1,0 8,6 A2.5,2.5 0 1,0 8,1Z M8,6 L7,11 L9,11Z M7,11 L5,14 M9,11 L11,14';

  // Fallback by ritual type
  switch (type) {
    case 'Festival':    return 'M8,1 L9.8,6 L15,6 L10.8,9.2 L12.5,14.5 L8,11.5 L3.5,14.5 L5.2,9.2 L1,6 L6.2,6Z'; // star
    case 'Ceremony':    return 'M8,2 C8,2 13,8 13,11 A5,5 0 0,1 3,11 C3,8 8,2 8,2Z'; // flame
    case 'Spiritual':   return 'M2,9 Q8,3 14,9 Q8,15 2,9Z M8,6 A2.5,2.5 0 1,0 8,11 A2.5,2.5 0 1,0 8,6Z'; // eye
    case 'Pilgrimage':  return 'M8,1 A2.5,2.5 0 1,0 8,6 A2.5,2.5 0 1,0 8,1Z M8,6 L7,11 L9,11Z M7,11 L5,14 M9,11 L11,14'; // person
    case 'Performance': return 'M11,2 L11,10 A3,3 0 1,0 8,10 M11,2 L7,4 L7,2Z'; // music note
    case 'Phenomenon':  return 'M10,1 L6,8 L9,8 L6,15 L13,6 L10,6Z'; // lightning
    default:            return 'M8,8 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0'; // circle
  }
};


const CustomMarkerIcon = (isSelected: boolean, type: string, subCategory?: string) => {
  const cacheKey = `${type}-${subCategory || ''}-${isSelected}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  const color = categoryColor(type);
  const path  = getIconPath(type, subCategory);

  // Matches LiveMarker exactly so the two layers read as one system. The old
  // badge was 20px carrying a 12px glyph at 1.6px stroke with a 33%-alpha
  // fill, which is unreadable at map scale — bigger badge, solid fill.
  const badge = isSelected ? 30 : 26;
  const hit   = 40;
  const glyph = isSelected ? 17 : 15;

  const icon = L.divIcon({
    html: `
      <div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="
          width:${badge}px;height:${badge}px;
          background:color-mix(in srgb, ${color} 22%, #0d0c0b);
          border:${isSelected ? 2 : 1.5}px solid ${color};
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 1px 4px rgb(0 0 0 / .5);
          transition:width .2s ease, height .2s ease;
        ">
          <svg width="${glyph}" height="${glyph}" viewBox="0 0 16 16" aria-hidden="true"
               xmlns="http://www.w3.org/2000/svg">
            <path d="${path}" fill="${color}"/>
          </svg>
        </div>
      </div>`,
    className: 'custom-map-marker',
    iconSize:   [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
  });

  iconCache.set(cacheKey, icon);
  return icon;
};

const MapSetup: React.FC<{ coords: [number, number] | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  useEffect(() => {
    if (coords) map.flyTo(coords, map.getZoom() < 5 ? 5 : map.getZoom(), { duration: 1.2 });
  }, [coords, map]);
  return null;
};

const LiveMapSetup: React.FC<{ userCoords: [number, number] | null, liveEvents: UnifiedEvent[], activeTab: string }> = ({ userCoords, liveEvents, activeTab }) => {
  const map = useMap();
  
  useEffect(() => {
    if (activeTab !== 'live' || !userCoords) return;
    
    // Calculate distances to all live events
    if (liveEvents.length === 0) {
      // No live events, just center on user with some default zoom
      map.flyTo(userCoords, 5);
      return;
    }

    // Find the closest event
    let closestEvent = liveEvents[0];
    let minDistance = calculateDistance(userCoords[0], userCoords[1], closestEvent.coordinates[0], closestEvent.coordinates[1]);

    for (let i = 1; i < liveEvents.length; i++) {
      const dist = calculateDistance(userCoords[0], userCoords[1], liveEvents[i].coordinates[0], liveEvents[i].coordinates[1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestEvent = liveEvents[i];
      }
    }

    // 500km = 500,000 meters
    if (minDistance <= 500000) {
      // Within 500km, zoom to 500km radius around user
      const latOffset = 500 / 111; // roughly 4.5 degrees
      const lonOffset = 500 / (111 * Math.cos(userCoords[0] * Math.PI / 180));
      const bounds = L.latLngBounds(
        [userCoords[0] - latOffset, userCoords[1] - lonOffset],
        [userCoords[0] + latOffset, userCoords[1] + lonOffset]
      );
      map.flyToBounds(bounds, { duration: 1.5 });
    } else {
      // Zoom out to include user and closest event
      const bounds = L.latLngBounds([userCoords, closestEvent.coordinates]);
      // Pad the bounds a bit
      map.flyToBounds(bounds.pad(0.2), { duration: 1.5 });
    }
  }, [userCoords, liveEvents, activeTab, map]);

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ data, onSelect, selectedItem, liveEvents = [], focusCoords, onLiveEventSelect, userCoords, activeTab = 'map' }) => {
  const mapRef = useRef<L.Map | null>(null);
  const maxBounds = useMemo(() => new L.LatLngBounds(new L.LatLng(-85, -Infinity), new L.LatLng(85, Infinity)), []);

  // Determine what to fly to: prop focusCoords takes precedence, then selectedItem
  const targetCoords = focusCoords || selectedItem?.coordinates || null;

  return (
    <div className="w-full h-full bg-base relative overflow-hidden">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        worldCopyJump={true}
        scrollWheelZoom={true}
        className="absolute inset-0 w-full h-full"
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          noWrap={false}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.6}
          noWrap={false}
        />

        {/* Historic/Archive Markers */}
        {data.map((item) => (
          <Marker 
            key={item.id} 
            position={item.coordinates} 
            icon={CustomMarkerIcon(selectedItem?.id === item.id, item.ritualType, item.subCategory)}
            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onSelect(item); } }}
          >
            <Tooltip direction="top" offset={[0, -16]} className="custom-tooltip">
              {item.title}
            </Tooltip>
          </Marker>
        ))}

        {/* Live Event Markers (The Pulse) */}
        {liveEvents.map((event) => (
          <LiveMarker key={event.uuid} event={event} onClick={onLiveEventSelect} />
        ))}

        {/* User Location Marker (Optional, but good for context) */}
        {activeTab === 'live' && userCoords && (
          <Marker 
            position={userCoords}
            icon={L.divIcon({
              html: `<div style="width: 12px; height: 12px; background-color: #4285F4; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
              className: 'user-location-marker',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}
          />
        )}

        <MapSetup coords={targetCoords} />
        <LiveMapSetup userCoords={userCoords || null} liveEvents={liveEvents} activeTab={activeTab} />
      </MapContainer>
    </div>
  );
};

export default React.memo(MapComponent);
