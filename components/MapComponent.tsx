
import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CultureItem, UnifiedEvent } from '../types';
import LiveMarker from './LiveMarker';
import { calculateDistance } from '../utils/geo';
import { markerHtml, userMarkerHtml, MARKER_HIT_SIZE } from '../utils/markerIcon';

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


const CustomMarkerIcon = (isSelected: boolean, type: string, subCategory?: string) => {
  const cacheKey = `${type}-${subCategory || ''}-${isSelected}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  const icon = L.divIcon({
    html: markerHtml({ type, subCategory, selected: isSelected }),
    className: 'custom-map-marker',
    iconSize:   [MARKER_HIT_SIZE, MARKER_HIT_SIZE],
    iconAnchor: [MARKER_HIT_SIZE / 2, MARKER_HIT_SIZE / 2],
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
              html: userMarkerHtml(),
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
