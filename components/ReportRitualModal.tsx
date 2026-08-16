
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Loader2, AlertTriangle, Radio, MapPin, RefreshCw, Globe, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { verifyRitualImage } from '../utils/aiAgent';
import { LiveRitual } from '../types';

interface ReportRitualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: LiveRitual) => void;
  userCoordinates?: [number, number]; 
}

// --- SUB-COMPONENT: MAP CLICK HANDLER ---
const LocationPickerMap: React.FC<{ 
  onPick: (coords: [number, number]) => void; 
  initialCoords: [number, number];
  selectedCoords: [number, number] | null;
}> = ({ onPick, initialCoords, selectedCoords }) => {
  const map = useMap();
  
  // Fix map rendering issues in modal
  useEffect(() => {
    map.invalidateSize();
    if (initialCoords) {
        map.setView(initialCoords, 13);
    }
  }, [map, initialCoords]);

  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });

  const pickerIcon = L.divIcon({
    html: `<div class="relative flex items-center justify-center w-6 h-6">
            <span class="absolute inline-flex h-full w-full rounded-full bg-[#9fff00] opacity-50 animate-ping"></span>
            <div class="relative w-3 h-3 bg-[#9fff00] rounded-full border-2 border-black shadow-[0_0_10px_#9fff00]"></div>
           </div>`,
    className: 'custom-picker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return selectedCoords ? <Marker position={selectedCoords} icon={pickerIcon} /> : null;
};

const ReportRitualModal: React.FC<ReportRitualModalProps> = ({ isOpen, onClose, onSubmit, userCoordinates }) => {
  const [image, setImage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Location State
  const [locationMode, setLocationMode] = useState<'gps' | 'map'>('gps');
  
  // GPS State
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Manual Map State
  const [manualCoords, setManualCoords] = useState<[number, number] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize location on open
  useEffect(() => {
    if (isOpen) {
      fetchLocation();
    }
  }, [isOpen]);

  const fetchLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    // Reset manual coords if we are fetching GPS to give fresh start
    // (Optional: keep manual coords if user switches back and forth)

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords([position.coords.latitude, position.coords.longitude]);
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setLocationError("GPS Signal Lost. Please enable location permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (!image) {
      setError("Please upload an image first.");
      return;
    }

    // Determine final coords based on mode
    const finalCoords = locationMode === 'gps' 
        ? (gpsCoords || userCoordinates) 
        : manualCoords;

    if (!finalCoords) {
      setError(locationMode === 'gps' ? "Valid GPS signal required." : "Please select a location on the map.");
      return;
    }

    // Fallback default if absolutely everything fails (shouldn't happen due to check above)
    const effectiveCoords = finalCoords || [35.6895, 139.6917];

    setVerifying(true);
    setError(null);

    try {
      const result = await verifyRitualImage(image);

      if (result.isRitual && result.confidence > 0.7) {
        // Construct the LiveRitual object
        const newEvent: LiveRitual = {
          id: `live-${Date.now()}`,
          type: result.type,
          title: result.title,
          coordinates: effectiveCoords,
          status: 'live',
          startTime: Date.now(),
          expiresAt: Date.now() + (2 * 60 * 60 * 1000), // Live for 2 hours
          etiquette: result.etiquette,
          imageUrl: image,
          confidence: result.confidence
        };
        onSubmit(newEvent);
        onClose();
        // Reset state
        setImage(null);
        setGpsCoords(null);
        setManualCoords(null);
        setLocationMode('gps');
      } else {
        setError(`Verification failed: ${result.reasoning || "Does not appear to be a cultural ritual."}`);
      }
    } catch (e) {
      setError("System error during verification.");
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in">
      <div className="bg-[#0c0c0c] border border-[#333] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#222] flex justify-between items-center bg-[#111]">
          <div className="flex items-center gap-2 text-[#FFD700]">
            <Radio className="w-5 h-5 animate-pulse" />
            <h2 className="text-sm font-black uppercase tracking-widest">Report Live Ritual</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Section 1: Image */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">1. Visual Proof</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all ${
                image ? 'border-[#9fff00] bg-[#1a1a1a]' : 'border-[#333] hover:border-gray-500 hover:bg-[#111]'
              }`}
            >
              {image ? (
                <img src={image} className="h-full w-full object-cover rounded-lg" alt="Preview" />
              ) : (
                <div className="text-center text-gray-500 space-y-2">
                  <Camera className="w-8 h-8 mx-auto" />
                  <span className="text-xs font-bold uppercase tracking-widest block">Tap to Capture</span>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload} 
              />
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">2. Location Data</label>
               {locationMode === 'gps' && locationError && (
                 <button onClick={fetchLocation} className="text-[10px] flex items-center gap-1 text-[#FFD700] hover:underline">
                   <RefreshCw className="w-3 h-3" /> Retry
                 </button>
               )}
             </div>

             {/* Mode Switcher */}
             <div className="flex p-1 bg-[#111] rounded-lg border border-[#222]">
                <button 
                  onClick={() => setLocationMode('gps')}
                  className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    locationMode === 'gps' ? 'bg-[#222] text-[#9fff00] shadow-sm' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Navigation className="w-3 h-3" /> Auto GPS
                </button>
                <button 
                  onClick={() => setLocationMode('map')}
                  className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    locationMode === 'map' ? 'bg-[#222] text-[#9fff00] shadow-sm' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Globe className="w-3 h-3" /> Select on Map
                </button>
             </div>
             
             {/* GPS MODE UI */}
             {locationMode === 'gps' && (
                <div className={`p-4 rounded-lg border flex items-center justify-between transition-colors ${
                  locationError ? 'bg-red-900/10 border-red-500/30' : 
                  gpsCoords ? 'bg-[#9fff00]/5 border-[#9fff00]/30' : 
                  'bg-[#111] border-[#222]'
                }`}>
                    <div className="flex items-center gap-3">
                      {isLocating ? (
                        <Loader2 className="w-4 h-4 text-[#FFD700] animate-spin" />
                      ) : locationError ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <MapPin className={`w-4 h-4 ${gpsCoords ? 'text-[#9fff00]' : 'text-gray-500'}`} />
                      )}
                      
                      <span className={`text-xs font-mono ${
                        isLocating ? 'text-[#FFD700]' : 
                        locationError ? 'text-red-400' : 
                        gpsCoords ? 'text-[#9fff00]' : 'text-gray-400'
                      }`}>
                        {isLocating ? "Acquiring Satellite Lock..." : 
                        locationError ? "Signal Failed" :
                        gpsCoords ? `${gpsCoords[0].toFixed(6)}, ${gpsCoords[1].toFixed(6)}` : 
                        "Waiting for Location..."}
                      </span>
                    </div>
                    
                    {gpsCoords && (
                      <div className="w-2 h-2 rounded-full bg-[#9fff00] animate-pulse shadow-[0_0_8px_#9fff00]"></div>
                    )}
                </div>
             )}

             {/* MAP MODE UI */}
             {locationMode === 'map' && (
               <div className="h-48 w-full rounded-lg border border-[#333] overflow-hidden relative group">
                  <MapContainer 
                    center={gpsCoords || userCoordinates || [20, 0]} 
                    zoom={2} 
                    className="w-full h-full bg-[#050505]"
                    zoomControl={false}
                  >
                     <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                     <LocationPickerMap 
                        onPick={(c) => setManualCoords(c)} 
                        initialCoords={gpsCoords || userCoordinates || [20, 0]} 
                        selectedCoords={manualCoords}
                     />
                  </MapContainer>
                  
                  {/* Overlay Hint */}
                  {!manualCoords && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                      <span className="text-[10px] bg-black/80 text-white px-2 py-1 rounded backdrop-blur border border-white/10">Tap to set location</span>
                    </div>
                  )}

                  {/* Manual Coordinates Display */}
                  {manualCoords && (
                    <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur border border-[#9fff00]/30 p-2 rounded flex justify-between items-center z-[500]">
                       <span className="text-[9px] text-gray-400 font-bold uppercase">Selected</span>
                       <span className="text-[10px] font-mono text-[#9fff00]">
                         {manualCoords[0].toFixed(4)}, {manualCoords[1].toFixed(4)}
                       </span>
                    </div>
                  )}
               </div>
             )}

             {locationError && locationMode === 'gps' && (
               <p className="text-[10px] text-red-400 mt-1">{locationError}</p>
             )}
          </div>

          {/* General Errors */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#222] bg-[#0c0c0c]">
          <button 
            onClick={handleVerifyAndSubmit}
            disabled={
              verifying || 
              !image || 
              (locationMode === 'gps' && !gpsCoords && !userCoordinates) ||
              (locationMode === 'map' && !manualCoords)
            }
            className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${
              verifying || !image || (locationMode === 'gps' && !gpsCoords && !userCoordinates) || (locationMode === 'map' && !manualCoords)
                ? 'bg-[#222] text-gray-500 cursor-not-allowed border border-[#333]'
                : 'bg-[#FFD700] hover:bg-[#e6c200] text-black shadow-[0_0_20px_rgba(255,215,0,0.3)] border border-[#FFD700]'
            }`}
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying with Gemini Agent...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Broadcast to Grid
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportRitualModal;
