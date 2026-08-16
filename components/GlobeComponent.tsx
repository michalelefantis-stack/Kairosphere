import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { CultureItem, UnifiedEvent } from '../types';
import { calculateDistance } from '../utils/geo';
import { categoryColor } from '../utils/categoryTheme';

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
  const globeRef = useRef<any>();
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
              el.innerHTML = `<div style="width: 12px; height: 12px; background-color: #4285F4; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`;
              return el;
          }

          if (d.isLive) {
              const event = d.event as UnifiedEvent;
              const isActive = event.status === 'Active';
              const color = event.severity >= 4 ? '#f97316' : event.severity === 5 ? '#ef4444' : '#9fff00';
              
              // We inject inline animation keyframes if not present, though tailwind ping works too.
              el.innerHTML = `
                 <div class="group relative flex items-center justify-center cursor-pointer pointer-events-auto" style="width:32px; height:32px;">
                    <div style="width:8px; height:8px; border-radius:50%; z-index:10; background-color: ${color}; box-shadow: 0 0 10px ${color}"></div>
                    ${isActive ? `<div style="position:absolute; width:100%; height:100%; border-radius:50%; border: 1px solid ${color}; opacity: 0.6; animation: custom-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
                    
                    <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-raised text-ink text-[12px] font-bold px-2 py-1 rounded border border-line-hard whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
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
          const sub  = (item.subCategory || '').toLowerCase();

          const color = categoryColor(type, item.subCategory);

          const getPath = () => {
            if (sub.includes('fire'))      return 'M8,2 C8,2 13,8 13,11 A5,5 0 0,1 3,11 C3,8 8,2 8,2Z';
            if (sub.includes('water'))     return 'M2,10 C4,7 6,12 8,9 C10,6 12,11 14,8';
            if (sub.includes('dance') || sub.includes('music') || sub.includes('musical')) return 'M11,2 L11,10 A3,3 0 1,0 8,10 M11,2 L7,4 L7,2Z';
            if (sub.includes('light'))     return 'M8,8 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M8,1 L8,3 M8,13 L8,15 M1,8 L3,8 M13,8 L15,8';
            if (sub.includes('harvest'))   return 'M8,14 L8,7 M8,7 C8,7 4,4 4,1 C7,2 8,7 8,7 M8,7 C8,7 12,4 12,1 C9,2 8,7 8,7';
            if (sub.includes('cosmic') || sub.includes('solar')) return 'M8,1 L9.8,6 L15,6 L10.8,9.2 L12.5,14.5 L8,11.5 L3.5,14.5 L5.2,9.2 L1,6 L6.2,6Z';
            if (sub.includes('mountain'))  return 'M8,2 L14,13 L2,13Z M5.5,13 L8,7.5 L10.5,13';
            if (sub.includes('ancestor') || sub.includes('trance')) return 'M2,9 Q8,3 14,9 Q8,15 2,9Z M8,6 A2.5,2.5 0 1,0 8,11 A2.5,2.5 0 1,0 8,6Z';
            switch (type) {
              case 'Festival':    return 'M8,1 L9.8,6 L15,6 L10.8,9.2 L12.5,14.5 L8,11.5 L3.5,14.5 L5.2,9.2 L1,6 L6.2,6Z';
              case 'Ceremony':    return 'M8,2 C8,2 13,8 13,11 A5,5 0 0,1 3,11 C3,8 8,2 8,2Z';
              case 'Spiritual':   return 'M2,9 Q8,3 14,9 Q8,15 2,9Z M8,6 A2.5,2.5 0 1,0 8,11 A2.5,2.5 0 1,0 8,6Z';
              case 'Pilgrimage':  return 'M8,1 A2.5,2.5 0 1,0 8,6 A2.5,2.5 0 1,0 8,1Z M8,6 L7,11 L9,11Z M7,11 L5,14 M9,11 L11,14';
              case 'Performance': return 'M11,2 L11,10 A3,3 0 1,0 8,10 M11,2 L7,4 L7,2Z';
              case 'Phenomenon':  return 'M10,1 L6,8 L9,8 L6,15 L13,6 L10,6Z';
              default:            return 'M8,8 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0';
            }
          };

          const badge = isSelected ? 26 : 20;
          const glow  = isSelected ? `0 0 14px ${color}, 0 0 6px ${color}88` : `0 0 8px ${color}99`;
          const iconSize = badge * 0.6;
          const path = getPath();

          el.innerHTML = `
             <div class="group relative flex flex-col items-center justify-center cursor-pointer pointer-events-auto" style="width: 36px; height: 36px;">
               <div style="
                 width:${badge}px;height:${badge}px;
                 background:${color}22;
                 border:1.5px solid ${color};
                 border-radius:50%;
                 display:flex;align-items:center;justify-content:center;
                 box-shadow:${glow};
                 opacity:${isSelected ? 1 : 0.85};
                 transition:all 0.25s ease;
               ">
                 <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 16 16" fill="none"
                      stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                      xmlns="http://www.w3.org/2000/svg">
                   <path d="${path}" fill="${color}55"/>
                 </svg>
               </div>
               <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-raised text-ink text-[12px] font-bold px-2 py-1 rounded border border-line-hard whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg" style="margin-left: -16px;">
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes custom-ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      ` }} />

      <div className="absolute bottom-4 right-4 z-50 text-[11px] font-mono text-ink-faint uppercase tracking-widest pointer-events-none bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
        Tiles © Esri — Source: Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, etc.
      </div>
    </div>
  );
};

export default GlobeComponent;
