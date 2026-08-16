import React, { useState, useEffect } from 'react';
import { Calendar, Map as MapIcon, Backpack, Radio, Activity, Archive, User as UserIcon, Globe, Maximize, Minimize } from 'lucide-react';
import KairosLogo from './KairosLogo';
import AccountMenu from './AccountMenu';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';

interface NavDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  savedCount?: number;
  viewMode?: 'flat' | 'globe';
  setViewMode?: (mode: 'flat' | 'globe') => void;
}

const NavDashboard: React.FC<NavDashboardProps> = ({ activeTab, setActiveTab, savedCount = 0, viewMode = 'flat', setViewMode }) => {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { t } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const navItems = [
    { id: 'map', icon: <MapIcon className="w-5 h-5 sm:w-4 sm:h-4" />, label: t('map') },
    { id: 'live', icon: <Activity className="w-5 h-5 sm:w-4 sm:h-4" />, label: t('liveMap') },
    { id: 'calendar', icon: <Calendar className="w-5 h-5 sm:w-4 sm:h-4" />, label: t('calendar') },
    { id: 'itinerary', icon: <Backpack className="w-5 h-5 sm:w-4 sm:h-4" />, label: t('itinerary') },
    { id: 'library', icon: <Archive className="w-5 h-5 sm:w-4 sm:h-4" />, label: t('library') },
  ];

  return (
    <>
      {/* ═══ DESKTOP: Floating pill (unchanged, hidden on mobile) ═══ */}
      <div className="ui-layer absolute top-4 left-4 right-4 items-start justify-between z-[60] pointer-events-none hidden sm:flex">
        {/* Left Section - Brand Identity */}
        <div className="flex-1 flex justify-start">
          <div 
            className="flex items-center gap-3 pt-1.5 pl-3 cursor-pointer group pointer-events-auto"
            onClick={() => setActiveTab('map')}
          >
            <KairosLogo size={34} className="transition-transform group-hover:scale-110" />
            <span className="text-[18px] font-black tracking-[0.1em] text-ink hidden md:block mt-1.5 drop-shadow-md">
              KAIROSPHERE
            </span>
          </div>
        </div>

        {/* Center Section - Nav Items */}
        <div className="flex-shrink flex items-center gap-1.5 bg-base/80 backdrop-blur-md border border-line rounded-full p-1.5 pointer-events-auto shadow-lg overflow-x-auto no-scrollbar max-w-none">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 group relative flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-300 ${
                activeTab === item.id ? 'bg-accent/10 text-accent border border-accent/20' : 'text-ink-faint hover:text-ink hover:bg-white/5 border border-transparent'
              }`}
            >
              {item.icon}
              <span className={`text-[12px] font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === item.id ? 'opacity-100' : 'block'
              }`}>
                {item.label}
              </span>
              {item.id === 'itinerary' && savedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-on-accent text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                  {savedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right Section - spacer for layout balance */}
        <div className="flex-1" />
      </div>

      {/* ═══ MOBILE: Bottom tab bar (hidden on desktop) ═══ */}
      <div 
        className="ui-layer fixed bottom-0 left-0 right-0 z-[60] sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="bg-base/95 backdrop-blur-xl border-t border-line flex items-stretch justify-around px-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 min-w-0 flex-1 transition-colors duration-200 ${
                  isActive ? 'text-accent' : 'text-ink-faint active:text-ink'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-accent rounded-b-full shadow-[0_0_10px_var(--k-glow-strong)]" />
                )}
                
                {item.icon}
                
                <span className={`text-[11px] font-bold uppercase tracking-wide leading-tight ${
                  isActive ? 'text-accent' : 'text-ink-faint'
                }`}>
                  {item.label}
                </span>
                
                {/* Badge for itinerary */}
                {item.id === 'itinerary' && savedCount > 0 && (
                  <span className="absolute top-1 right-1/2 translate-x-4 bg-accent text-on-accent text-[10px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full leading-none">
                    {savedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default NavDashboard;
