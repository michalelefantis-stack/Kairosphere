import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { CultureItem, UnifiedEvent } from '../types';
import { calculateDistance } from '../utils/geo';
import { markerBadgeHtml, userMarkerHtml, MARKER_HIT_SIZE } from '../utils/markerIcon';

interface GlobeComponentProps {
  data: CultureItem[];
  onSelect: (item: CultureItem) => void;
  selectedItem: CultureItem | null;
  liveEvents?: UnifiedEvent[]; 
  focusCoords?: [number, number] | null;
  onLiveEventSelect?: (event: UnifiedEvent) => void;
  userCoords?: [number, number] | null;
  activeTab?: string;
}

const GlobeComponent: React.FC<GlobeComponentProps> = ({ 
  data, 
  onSelect, 
  selectedItem, 
  liveEvents = [], 
  focusCoords, 
  onLiveEventSelect,
  userCoords,
  activeTab = 'map'
}) => {
  const globeRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const globeReadyRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update view when focus changes
  useEffect(() => {
    if (globeRef.current && focusCoords) {
      // Globe expects { lat, lng, altitude }
      globeRef.current.pointOfView({ lat: focusCoords[0], lng: focusCoords[1], altitude: 1.5 }, 1000);
    } else if (globeRef.current && selectedItem) {
      globeRef.current.pointOfView({ lat: selectedItem.coordinates[0], lng: selectedItem.coordinates[1], altitude: 1.5 }, 1000);
    }
  }, [focusCoords, selectedItem]);

  useEffect(() => {
     // If activeTab is 'live' and userCoords are available, point view towards user
     if (activeTab === 'live' && userCoords && globeRef.current) {
         globeRef.current.pointOfView({ lat: userCoords[0], lng: userCoords[1], altitude: 1.8 }, 1500);
     }
  }, [activeTab, userCoords]);

  // Combine regular data and live events for htmlElementsData
  const htmlElements: any[] = [];

  // Historic Events
  if (activeTab === 'map') {
      data.forEach((item) => {
         htmlElements.push({
             lat: item.coordinates[0],
             lng: item.coordinates[1],
             isLive: false,
             item: item,
             id: item.id
         });
      });
  }

  // Live Events
  if (activeTab === 'live') {
      liveEvents.forEach((event) => {
         htmlElements.push({
             lat: event.coordinates[0],
             lng: event.coordinates[1],
             isLive: true,
             event: event,
             id: event.uuid
         });
      });
      
      if (userCoords) {
          htmlElements.push({
             lat: userCoords[0],
             lng: userCoords[1],
             isUser: true,
             id: 'user-loc'
          });
      }
  }

  // Boost globe geometry resolution & texture anisotropy on ready
  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current || globeReadyRef.current) return;
    globeReadyRef.current = true;

    const globe = globeRef.current;

    // Access the Three.js renderer and maximise anisotropy
    const renderer: THREE.WebGLRenderer | undefined = globe.renderer?.();
    const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;

    // Access the internal Three.js globe mesh
    const scene: THREE.Scene | undefined = globe.scene?.();
    if (scene) {
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.SphereGeometry) {
          // Check if this is the main globe sphere (the largest one)
          const params = (obj.geometry as THREE.SphereGeometry).parameters;
          if (params && params.widthSegments && params.widthSegments < 128) {
            // Replace geometry with higher segment count to fix pole distortion
            const newGeo = new THREE.SphereGeometry(
              params.radius,
              128,  // width segments (was typically 50-75)
              96    // height segments
            );
            obj.geometry.dispose();
            obj.geometry = newGeo;
          }
          // Boost texture filtering on all globe materials
          const mat = obj.material;
          if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
            if (mat.map) {
              mat.map.anisotropy = maxAniso;
              mat.map.minFilter = THREE.LinearMipmapLinearFilter;
              mat.map.magFilter = THREE.LinearFilter;
              mat.map.generateMipmaps = true;
              mat.map.needsUpdate = true;
            }
            if ((mat as any).bumpMap) {
              (mat as any).bumpMap.anisotropy = maxAniso;
              (mat as any).bumpMap.needsUpdate = true;
            }
          }
        }
      });
    }
  }, []);

  return (
    <div className="globe-container relative w-full h-full bg-base overflow-hidden cursor-move pointer-events-auto z-10">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onGlobeReady={handleGlobeReady}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4da6ff"
        atmosphereAltitude={0.15}
        htmlElementsData={htmlElements}
        htmlElement={(d: any) => {
          const el = document.createElement('div');
          el.style.pointerEvents = 'auto'; // allow clicking through globe overlay
          
          if (d.isUser) {
              el.innerHTML = userMarkerHtml();
              return el;
          }

          if (d.isLive) {
              const event = d.event as UnifiedEvent;

              // Same badge as the flat map. This used to be an 8px dot
              // coloured by severity — including the old lime — so the two
              // views disagreed about what a live event even looks like.
              el.innerHTML = `
                 <div class="group relative flex items-center justify-center cursor-pointer pointer-events-auto" style="width:${MARKER_HIT_SIZE}px; height:${MARKER_HIT_SIZE}px;">
                    ${markerBadgeHtml({ type: event.category, live: event.status === 'Active' })}
                    <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-raised text-ink text-[12px] font-semibold px-2 py-1 rounded border border-line whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                      ${event.title}
                    </div>
                 </div>
              `;
              
              el.onclick = (e) => { e.stopPropagation(); if(onLiveEventSelect) onLiveEventSelect(event); };
              el.onwheel = (e) => {
                 const canvas = document.querySelector('.globe-container canvas');
                 if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', e));
              };
              return el;
          }

          // Historic Events
          const item = d.item as CultureItem;
          const isSelected = selectedItem?.id === item.id;
          const type = item.ritualType;

          el.innerHTML = `
             <div class="group relative flex flex-col items-center justify-center cursor-pointer pointer-events-auto" style="width:${MARKER_HIT_SIZE}px; height:${MARKER_HIT_SIZE}px;">
               ${markerBadgeHtml({ type, subCategory: item.subCategory, selected: isSelected })}
               <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-raised text-ink text-[12px] font-semibold px-2 py-1 rounded border border-line whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                 ${item.title}
               </div>
            </div>
          `;

          el.onclick = (e) => { e.stopPropagation(); onSelect(item); };
          el.onwheel = (e) => {
             const canvas = document.querySelector('.globe-container canvas');
             if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', e));
          };
          
          return el;
        }}
      />

      <div className="absolute bottom-4 right-4 z-50 text-[11px] font-mono text-ink-faint uppercase tracking-widest pointer-events-none bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
        Tiles © Esri — Source: Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, etc.
      </div>
    </div>
  );
};

export default GlobeComponent;
