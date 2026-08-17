import React from 'react';
import { X, Check, SlidersHorizontal, UserCircle2, Search as SearchIcon } from 'lucide-react';
import { FilterState } from '../types';
import KairosLogo from './KairosLogo';

/**
 * Filters, on demand rather than always.
 *
 * Four controls — search, category, month, sort — sat permanently open above
 * the phone's event list, costing about 230px of a 812px screen. The list
 * itself got 190px. Most sessions change no filter at all, so the default
 * state was paying full price for something rarely used.
 *
 * Everything moves behind one button into this sheet. Controls are sized for
 * a thumb: the category chips were 27px tall, which is below every platform
 * minimum and roughly half a fingertip.
 */

const CATEGORIES = [
  'All', 'Phenomenon', 'Spiritual', 'Festival', 'Ceremony', 'Pilgrimage', 'Performance'
] as const;

const MONTHS = [
  'Any month', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * There is no sort control here on purpose.
 *
 * The feed is already ordered by reachability against time pressure, which is
 * the app's actual opinion about what matters. Offering "Soonest / Nearest"
 * beside it would be a second ordering competing with the first, and would
 * invite the reader to defeat the one useful thing the ranking does — combine
 * both. Finding a specific known event is what search is for.
 */
interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  /** How many events survive the current filters. */
  resultCount: number;
}

/** Minimum 44px tall, which is the whole point of this component. */
const Chip: React.FC<{
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`min-h-[44px] px-4 rounded-xl text-[14px] font-medium transition-colors
                inline-flex items-center gap-1.5 select-none
      ${active
        ? 'bg-accent text-on-accent'
        : disabled
          ? 'bg-hover text-ink-faint opacity-50'
          : 'bg-hover text-ink-dim active:bg-raised'}`}
  >
    {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
    {children}
  </button>
);

const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  open,
  onClose,
  filters,
  setFilters,
  resultCount
}) => {
  // Escape closes, and the body must not scroll behind the sheet.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sm:hidden fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        role="dialog"
        aria-label="Filter events"
        className="relative bg-panel rounded-t-[28px] border-t border-line
                   max-h-[85vh] overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="sticky top-0 bg-panel px-4 pt-3 pb-3 border-b border-line-soft z-10">
          <div className="w-10 h-1 bg-line-hard rounded-full mx-auto mb-3" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink">Filter</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full
                         text-ink-dim active:bg-hover"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-6">
          {/* No search field here: it lives in the top bar, always visible.
              Two inputs bound to the same value invite the reader to type in
              one and wonder why the other disagrees. */}
          <div>
            <p className="text-[13px] text-ink-dim mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <Chip
                  key={category}
                  active={(filters.type as string) === category}
                  onClick={() => setFilters(f => ({ ...f, type: category as any }))}
                >
                  {category}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] text-ink-dim mb-2">Month</p>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month, index) => (
                <Chip
                  key={month}
                  active={filters.month === index}
                  onClick={() => setFilters(f => ({ ...f, month: index }))}
                >
                  {index === 0 ? month : month.slice(0, 3)}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-panel border-t border-line-soft px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl bg-accent text-on-accent
                       text-[15px] font-semibold active:bg-accent-hi transition-colors"
          >
            Show {resultCount} {resultCount === 1 ? 'event' : 'events'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The phone's top bar: identity, filters, account.
 *
 * Replaces four stacked control rows with a single 56px strip, and is shared
 * by all three mobile tabs so the account is reachable from anywhere. It had
 * become reachable from nowhere: the only sign-in affordance lived in the
 * desktop map rail, and NavDashboard still imports AccountMenu and tracks a
 * user it never renders.
 *
 * Sits inside each tab's flex column rather than being fixed, so no screen
 * has to know the bar's height — including the part of it that is notch.
 */
/** Same glass treatment as the desktop nav pill, so the two read as one app. */
const BUBBLE =
  'bg-base/80 backdrop-blur-xl border border-line rounded-full shadow-lg pointer-events-auto';

export const MobileTopBar: React.FC<{
  /** Omit on screens that do not search or filter. */
  search?: {
    value: string;
    onChange: (v: string) => void;
    count: number;
    activeCount: number;
    onOpenFilters: () => void;
  };
  onOpenAccount: () => void;
  signedIn: boolean;
}> = ({ search, onOpenAccount, signedIn }) => (
  <div
    className="absolute top-0 left-0 right-0 z-[55] flex items-start
               gap-2 px-3 pointer-events-none"
    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
  >
    {search ? (
      // Search occupies the bar, with the filter tucked inside it. It is the
      // most-used control on the screen and was two taps away behind the
      // filter sheet; the logo it replaces was decoration, and the app's name
      // is already on the launcher icon and the splash.
      <div className={`${BUBBLE} flex items-center h-11 flex-1 min-w-0 pl-3 pr-1`}>
        <SearchIcon className="w-[18px] h-[18px] text-ink-faint shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={search.value}
          onChange={e => search.onChange(e.target.value)}
          placeholder="Search rituals, places…"
          aria-label="Search events"
          // 16px: anything smaller and iOS Safari zooms the page on focus.
          className="flex-1 min-w-0 h-11 bg-transparent px-2 text-[16px] text-ink
                     placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={search.onOpenFilters}
          aria-label="Filter events"
          className="relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center
                     text-ink-dim active:text-ink transition-colors"
        >
          <SlidersHorizontal className="w-[18px] h-[18px]" />
          {search.activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1
                             rounded-full bg-accent text-on-accent
                             text-[10px] font-bold leading-[16px] text-center">
              {search.activeCount}
            </span>
          )}
          <span className="sr-only">
            {search.count} events match the current filters
          </span>
        </button>
      </div>
    ) : (
      <div className={`${BUBBLE} w-11 h-11 flex items-center justify-center`}>
        <KairosLogo size={24} />
      </div>
    )}

    <button
      type="button"
      onClick={onOpenAccount}
      aria-label={signedIn ? 'Account' : 'Sign in'}
      className={`${BUBBLE} w-11 h-11 shrink-0 ml-auto flex items-center justify-center
                  text-ink-dim active:text-ink transition-colors`}
    >
      {/* A filled ring when signed in: the only thing the reader needs from
          this control at a glance is whether their saved trips are backed up
          or living on this handset alone. */}
      <UserCircle2
        className={`w-[22px] h-[22px] ${signedIn ? 'text-accent' : ''}`}
        strokeWidth={signedIn ? 2.2 : 1.8}
      />
    </button>
  </div>
);

export default MobileFilterSheet;
