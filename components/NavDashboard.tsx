import React, { useState, useEffect } from 'react';
import { Calendar, Map as MapIcon, Backpack, Radio, Activity, Archive, Layers, User as UserIcon, Globe, Maximize, Minimize } from 'lucide-react';
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

  /**
   * Three tabs on a phone, five on a desktop.
   *
   * Five tabs on a 375px bar gave each 75px, which forced 11px uppercase
   * labels and still wrapped "LIVE MAP" onto two lines. More to the point,
   * two of the five were not places:
   *
   *   Live map is not a destination, it is a state of the home feed — local
   *   reports belong at the top of what you already opened. Putting them
   *   behind their own tab hid the one feature with a daily reason to return.
   *
   *   Calendar and Itinerary answer the same question, "I have these dates,
   *   what is on" — one tab, two views.
   *
   * Library lost its tab. It is a flattened list of the 21 books that
   * DetailPanel already shows on the 19 events they belong to, so a third of
   * the phone's navigation pointed at a duplicate — and background reading is
   * not what anyone opens this app for while deciding which bus to catch. The
   * books stay where they mean something, on the event.
   *
   * Collections took the slot instead, because it answers the one question
   * nothing else here does: not "what is near me" but "where should I go at
   * all".
   */
  const mobileNavItems = [
    { id: 'map', icon: <MapIcon className="w-[22px] h-[22px]" />, label: 'Nearby' },
    { id: 'collections', icon: <Layers className="w-[22px] h-[22px]" />, label: 'Explore' },
    { id: 'itinerary', icon: <Backpack className="w-[22px] h-[22px]" />, label: 'Plan' },
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
      {/* Floating rather than a full-width bar, matching the desktop nav pill:
          same glass, same rounded-full shape, same idea that the chrome sits
          over the content instead of walling it off. Content scrolls beneath
          it and stays legible through the blur. */}
      <div
        className="ui-layer fixed bottom-0 left-0 right-0 z-[60] sm:hidden flex justify-center px-4 pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      >
        <div className="bg-base/80 backdrop-blur-xl border border-line rounded-full shadow-xl flex items-stretch px-1 pointer-events-auto">
          {mobileNavItems.map((item) => {
            // Calendar folded into Plan, so the tab lights up for either.
            const isActive =
              activeTab === item.id ||
              (item.id === 'itinerary' && activeTab === 'calendar');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center justify-center gap-2 min-h-[52px] px-4 rounded-full transition-colors duration-200 ${
                  isActive ? 'text-accent bg-accent/10' : 'text-ink-faint active:text-ink'
                }`}
              >
                {item.icon}

                {/* Sentence case at 12px. The old 11px uppercase with letter
                    spacing was the least legible setting available and still
                    wrapped onto two lines. */}
                <span className={`text-[12px] font-semibold leading-none ${
                  isActive ? 'text-accent' : 'text-ink-faint'
                }`}>
                  {item.label}
                </span>

                {item.id === 'itinerary' && savedCount > 0 && (
                  <span className="absolute top-1.5 right-1/2 translate-x-5 bg-accent text-on-accent text-[10px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full leading-none px-1">
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
