
import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Globe2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Heart,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Radio,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Flame,
  Mountain,
  Waves,
  TreePine,
  Bird,
  Music,
  Footprints,
  Zap,
  User as UserIcon,
  ArrowRight,
  Backpack
} from 'lucide-react';
import AccountMenu from './AccountMenu';
import { CultureItem } from '../types';

interface MapControlsProps {
  viewMode: 'flat' | 'globe';
  setViewMode: (mode: 'flat' | 'globe') => void;
  savedCount: number;
  savedEvents: CultureItem[];
  onOpenItinerary: () => void;
  onSelectSavedEvent: (event: CultureItem) => void;
  totalEvents: number;
  liveEventsCount: number;
  onToggleTheme: () => void;
  isLightMode: boolean;
  activeTab: string;
  enabledLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
  onSetAllLayers: (enabled: boolean) => void;
}

// ─── Layer category definitions ─────────────────────────────────────────────
export interface LayerItem {
  id: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}

export interface LayerGroup {
  id: string;
  title: string;
  items: LayerItem[];
}

export const LAYER_GROUPS: LayerGroup[] = [
  {
    id: 'phenomenon',
    title: 'Natural Phenomena',
    items: [
      { id: 'sub-atmospheric', label: 'Atmospheric', color: 'var(--k-cat-atmospheric)', icon: <Zap className="w-3.5 h-3.5" /> },
      { id: 'sub-botanical', label: 'Flora / Botanical', color: 'var(--k-cat-flora)', icon: <TreePine className="w-3.5 h-3.5" /> },
      { id: 'sub-fauna', label: 'Wildlife Migrations', color: '#fbbf24', icon: <Bird className="w-3.5 h-3.5" /> },
      { id: 'sub-cosmic', label: 'Cosmic & Solar', color: 'var(--k-cat-cosmic)', icon: <Sun className="w-3.5 h-3.5" /> },
      { id: 'sub-geological', label: 'Geological', color: '#f87171', icon: <Mountain className="w-3.5 h-3.5" /> },
      { id: 'sub-natural', label: 'Other Phenomena', color: '#94a3b8', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'festival',
    title: 'Festivals',
    items: [
      { id: 'sub-fire', label: 'Fire Festivals', color: 'var(--k-cat-ritual)', icon: <Flame className="w-3.5 h-3.5" /> },
      { id: 'sub-water', label: 'Water Festivals', color: 'var(--k-cat-atmospheric)', icon: <Waves className="w-3.5 h-3.5" /> },
      { id: 'sub-harvest', label: 'Harvest Festivals', color: 'var(--k-accent)', icon: <TreePine className="w-3.5 h-3.5" /> },
      { id: 'sub-light', label: 'Light Festivals', color: '#fef08a', icon: <Sun className="w-3.5 h-3.5" /> },
      { id: 'sub-cultural', label: 'Cultural Festivals', color: 'var(--k-cat-cosmic)', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'ceremony',
    title: 'Ceremonies',
    items: [
      { id: 'sub-ancestor', label: 'Ancestor Veneration', color: '#94a3b8', icon: <Eye className="w-3.5 h-3.5" /> },
      { id: 'sub-healing', label: 'Healing & Cleansing', color: '#60a5fa', icon: <Waves className="w-3.5 h-3.5" /> },
      { id: 'sub-initiation', label: 'Rites of Passage', color: '#f43f5e', icon: <UserIcon className="w-3.5 h-3.5" /> },
      { id: 'sub-seasonal', label: 'Seasonal Transitions', color: '#fcd34d', icon: <Sun className="w-3.5 h-3.5" /> },
      { id: 'sub-ritual', label: 'Other Ceremonies', color: 'var(--k-cat-cosmic)', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'spiritual',
    title: 'Spiritual Practices',
    items: [
      { id: 'sub-trance/shamanic', label: 'Trance & Shamanic', color: 'var(--k-cat-cosmic)', icon: <Eye className="w-3.5 h-3.5" /> },
      { id: 'sub-prayer/offering', label: 'Prayer & Offerings', color: '#fbbf24', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: 'sub-meditation', label: 'Meditation & Devotion', color: '#60a5fa', icon: <EyeOff className="w-3.5 h-3.5" /> },
      { id: 'sub-devotional', label: 'Other Spiritual', color: '#94a3b8', icon: <Heart className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'pilgrimage',
    title: 'Pilgrimages',
    items: [
      { id: 'sub-mountain', label: 'Mountain Ascents', color: 'var(--k-cat-cosmic)', icon: <Mountain className="w-3.5 h-3.5" /> },
      { id: 'sub-river/lake', label: 'Sacred Waters', color: 'var(--k-cat-atmospheric)', icon: <Waves className="w-3.5 h-3.5" /> },
      { id: 'sub-shrine/temple', label: 'Shrines & Temples', color: '#fbbf24', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: 'sub-sacred journey', label: 'Other Journeys', color: '#f43f5e', icon: <Footprints className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'performance',
    title: 'Performances',
    items: [
      { id: 'sub-dance', label: 'Traditional Dance', color: '#f43f5e', icon: <UserIcon className="w-3.5 h-3.5" /> },
      { id: 'sub-music', label: 'Music & Song', color: 'var(--k-accent)', icon: <Music className="w-3.5 h-3.5" /> },
      { id: 'sub-theatrical', label: 'Theatrical Arts', color: 'var(--k-cat-cosmic)', icon: <Eye className="w-3.5 h-3.5" /> },
      { id: 'sub-storytelling', label: 'Storytelling', color: '#fbbf24', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: 'sub-cultural art', label: 'Other Performances', color: '#94a3b8', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ]
  },
  {
    id: 'map-features',
    title: 'Map Features',
    items: [
      { id: 'labels', label: 'Show Place Names', color: '#94a3b8', icon: <MapIcon className="w-3.5 h-3.5" /> },
      { id: 'verified', label: 'Verified Only', color: '#22d3ee', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────
const MapControls: React.FC<MapControlsProps> = ({
  viewMode,
  setViewMode,
  savedCount,
  totalEvents,
  liveEventsCount,
  onToggleTheme,
  isLightMode,
  activeTab,
  enabledLayers,
  onToggleLayer,
  onSetAllLayers,
  savedEvents,
  onOpenItinerary,
  onSelectSavedEvent
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['event-types']));

  const layersPanelRef = useRef<HTMLDivElement>(null);


  // Close account panel on outside click
  const accountPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (accountPanelRef.current && !accountPanelRef.current.contains(e.target as Node)) {
        setShowAccountPanel(false);
      }
    };
    if (showAccountPanel) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [showAccountPanel]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleLayer = (layerId: string) => {
    onToggleLayer(layerId);
  };

  const enabledCount = enabledLayers.size;
  const totalLayerCount = LAYER_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

  const ControlButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    accent?: string;
    badge?: string | number;
  }> = ({ icon, label, onClick, isActive = false, accent, badge }) => (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative w-[34px] h-[34px] flex items-center justify-center rounded-xl transition-all duration-200
        ${isActive
          ? 'bg-white/10 text-ink shadow-lg shadow-black/20'
          : 'text-ink-dim hover:text-ink hover:bg-white/5'
        }
      `}
      style={isActive && accent ? { color: accent, boxShadow: `0 0 12px ${accent}30` } : {}}
    >
      {icon}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent text-on-accent text-[11px] font-black px-1">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="ui-layer absolute right-3 top-4 z-30 flex flex-row gap-2 pointer-events-auto" ref={layersPanelRef}>
      
      {/* ── FAVORITES FLYOUT PANEL ───────────────────────────────────── */}
      {showFavoritesPanel && (
        <div className="w-[280px] max-h-[calc(100vh-120px)] bg-panel/95 backdrop-blur-xl border border-line rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <div className="flex items-center gap-2.5">
              <Backpack className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-ink">Saved Events</span>
            </div>
            <button
              onClick={() => setShowFavoritesPanel(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {savedEvents.length === 0 ? (
              <div className="p-6 text-center text-ink-faint text-xs">
                No events saved yet.
              </div>
            ) : (
              <div className="space-y-1">
                {savedEvents.map(event => {
                  const sDate = new Date(event.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const eDate = new Date(event.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  return (
                    <div 
                      key={event.id} 
                      onClick={() => {
                        onSelectSavedEvent(event);
                        setShowFavoritesPanel(false);
                      }}
                      className="p-3 hover:bg-raised rounded-xl transition-colors flex flex-col gap-1 border border-transparent hover:border-line cursor-pointer"
                    >
                      <span className="text-accent text-[11px] uppercase font-black tracking-widest">
                        {sDate} - {eDate} • {event.region}
                      </span>
                      <span className="text-sm text-ink font-bold leading-tight line-clamp-2">{event.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-line-soft">
            <button
              onClick={() => {
                setShowFavoritesPanel(false);
                onOpenItinerary();
              }}
              className="w-full py-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-xl text-[12px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_var(--k-glow)]"
            >
               Open Full Itinerary <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── LAYERS FLYOUT PANEL ───────────────────────────────────── */}
      {showLayersPanel && (
        <div className="w-[280px] max-h-[calc(100vh-120px)] bg-panel/95 backdrop-blur-xl border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-[#00d4ff]" />
              <span className="text-sm font-bold text-ink">Layers</span>
            </div>
            <button
              onClick={() => setShowLayersPanel(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Enable/Disable All */}
          <div className="px-4 py-2.5 border-b border-line-soft">
            <button
              onClick={() => {
                onSetAllLayers(enabledCount !== totalLayerCount);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                bg-gradient-to-r from-[#00d4ff]/20 to-accent/20 border border-[#00d4ff]/30 text-[#00d4ff] hover:border-[#00d4ff]/60 hover:from-[#00d4ff]/30 hover:to-accent/30"
            >
              <Eye className="w-3.5 h-3.5" />
              {enabledCount === totalLayerCount ? 'Hide All Layers' : 'Show All Layers'}
            </button>
          </div>

          {/* Layer Groups */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {LAYER_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const groupEnabled = group.items.filter(i => enabledLayers.has(i.id)).length;
              return (
                <div key={group.id} className="border-b border-line-soft last:border-b-0">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{group.title}</span>
                      <span className="text-[12px] text-ink-faint font-mono">
                        {groupEnabled}/{group.items.length}
                      </span>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-ink-faint" />
                      : <ChevronDown className="w-4 h-4 text-ink-faint" />
                    }
                  </button>

                  {/* Group Items */}
                  {isExpanded && (
                    <div className="pb-2 px-2">
                      {group.items.map((item) => {
                        const enabled = enabledLayers.has(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleLayer(item.id)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150
                              ${enabled ? 'hover:bg-white/5' : 'opacity-40 hover:opacity-70'}
                            `}
                          >
                            {/* Toggle Dot */}
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                enabled ? 'border-transparent' : 'border-line-hard'
                              }`}
                              style={enabled ? { backgroundColor: item.color + '25', borderColor: item.color } : {}}
                            >
                              {enabled && (
                                <div
                                  className="w-2 h-2 rounded-sm"
                                  style={{ backgroundColor: item.color }}
                                />
                              )}
                            </div>

                            {/* Icon */}
                            <span style={{ color: enabled ? item.color : '#555' }}>
                              {item.icon}
                            </span>

                            {/* Label */}
                            <span className={`text-[12px] font-medium ${enabled ? 'text-ink' : 'text-ink-faint'}`}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-line-soft flex items-center justify-between">
            <span className="text-[12px] text-ink-faint font-mono uppercase tracking-wide">
              {enabledCount} of {totalLayerCount} active
            </span>
            <div className="flex gap-0.5">
              {LAYER_GROUPS[0].items.map(item => (
                <div
                  key={item.id}
                  className="w-2 h-2 rounded-full transition-opacity"
                  style={{
                    backgroundColor: item.color,
                    opacity: enabledLayers.has(item.id) ? 1 : 0.15,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNT FLYOUT PANEL ───────────────────────────────── */}
      {showAccountPanel && (
        <div ref={accountPanelRef} className="w-[280px] max-h-[calc(100vh-120px)] overflow-hidden rounded-2xl">
          <AccountMenu onClose={() => setShowAccountPanel(false)} />
        </div>
      )}

      {/* ── CONTROL BUTTONS (RIGHT STRIP) ─────────────────────── */}
      <div className="flex flex-col gap-1">
        {/* Profile Button */}
        <div className="flex flex-col items-center bg-base/90 backdrop-blur-xl border border-line rounded-2xl p-1.5 shadow-2xl">
          <ControlButton
            icon={<UserIcon className="w-[18px] h-[18px]" />}
            label="Account"
            onClick={() => {
              setShowAccountPanel(!showAccountPanel);
              setShowLayersPanel(false);
              setShowFavoritesPanel(false);
            }}
            isActive={showAccountPanel}
            accent="var(--k-accent)"
          />
        </div>

        {/* Primary Controls Group */}
        <div className="flex flex-col items-center gap-0.5 bg-base/90 backdrop-blur-xl border border-line rounded-2xl p-1.5 shadow-2xl">
          {/* View Mode Toggle — single button that swaps */}
          <ControlButton
            icon={viewMode === 'flat'
              ? <Globe2 className="w-[18px] h-[18px]" />
              : <MapIcon className="w-[18px] h-[18px]" />
            }
            label={viewMode === 'flat' ? 'Switch to 3D Globe' : 'Switch to Flat Map'}
            onClick={() => setViewMode(viewMode === 'flat' ? 'globe' : 'flat')}
            isActive={true}
            accent={viewMode === 'flat' ? 'var(--k-accent)' : 'var(--k-cat-atmospheric)'}
          />

          <div className="w-6 h-px bg-line-hard my-1" />

          {/* Saved Events */}
          <ControlButton
            icon={<Backpack className="w-[18px] h-[18px]" />}
            label={`Saved Events (${savedCount})`}
            onClick={() => {
              setShowFavoritesPanel(!showFavoritesPanel);
              setShowLayersPanel(false);
              setShowAccountPanel(false);
            }}
            isActive={showFavoritesPanel}
            accent="var(--k-accent)"
            badge={savedCount > 0 ? savedCount : undefined}
          />

          {/* LAYERS Button */}
          <ControlButton
            icon={<Layers className="w-[18px] h-[18px]" />}
            label="Layers"
            onClick={() => {
              setShowLayersPanel(!showLayersPanel);
              setShowFavoritesPanel(false);
              setShowAccountPanel(false);
            }}
            isActive={showLayersPanel}
            accent="#00d4ff"
          />

          {/* Theme Toggle */}
          <ControlButton
            icon={isLightMode ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            label={isLightMode ? "Dark Mode" : "Light Mode"}
            onClick={onToggleTheme}
          />
        </div>

        {/* Stats Group */}
        <div className="flex flex-col items-center bg-base/90 backdrop-blur-xl border border-line rounded-2xl p-1.5 shadow-2xl w-[48px]">
          <div className="flex flex-col items-center py-1.5 px-0 cursor-default" title="Total Events on Map">
            <MapPin className="w-4 h-4 text-accent mb-0.5" />
            <span className="text-[12px] font-black text-ink leading-none">{totalEvents}</span>
          </div>

          {activeTab === 'live' && liveEventsCount > 0 && (
            <>
              <div className="w-6 h-px bg-line-hard my-0.5" />
              <div className="flex flex-col items-center py-1.5 px-0 cursor-default" title="Live Events">
                <Radio className="w-4 h-4 text-red-500 mb-0.5 animate-pulse" />
                <span className="text-[12px] font-black text-red-400 leading-none">{liveEventsCount}</span>
              </div>
            </>
          )}
        </div>

        {/* Fullscreen */}
        <div className="hidden sm:flex flex-col items-center bg-base/90 backdrop-blur-xl border border-line rounded-2xl p-1.5 shadow-2xl">
          <ControlButton
            icon={isFullscreen
              ? <Minimize2 className="w-[18px] h-[18px]" />
              : <Maximize2 className="w-[18px] h-[18px]" />
            }
            label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
          />
        </div>
      </div>
    </div>
  );
};

export default MapControls;
