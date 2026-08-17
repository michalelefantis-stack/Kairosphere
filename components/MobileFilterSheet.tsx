import React from 'react';
import { X, Check, SlidersHorizontal } from 'lucide-react';
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
          <div>
            <label htmlFor="filter-search" className="block text-[13px] text-ink-dim mb-2">
              Search
            </label>
            <input
              id="filter-search"
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Ritual, place, country…"
              className="w-full min-h-[48px] px-4 rounded-xl bg-hover border border-line
                         text-[16px] text-ink placeholder:text-ink-faint
                         focus:outline-none focus:border-accent"
            />
            {/* 16px is not a style choice: iOS Safari zooms the page on focus
                for anything smaller, which then strands the layout. */}
          </div>

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
 * The phone's top bar: identity, result count, one way in to the filters.
 *
 * Replaces four stacked control rows with a single 56px strip. The badge
 * matters — with the controls hidden, a filter left on from a previous
 * session would otherwise silently explain why the list looks short.
 */
export const MobileHomeBar: React.FC<{
  count: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
}> = ({ count, activeFilterCount, onOpenFilters }) => (
  <div
    className="shrink-0 flex items-center justify-between gap-3 px-4 h-14 border-b border-line-soft bg-base"
    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
  >
    <div className="flex items-center gap-2 min-w-0">
      <KairosLogo size={26} />
      <span className="text-[15px] font-bold tracking-[0.08em] text-ink truncate">
        KAIROSPHERE
      </span>
    </div>

    <button
      type="button"
      onClick={onOpenFilters}
      className="relative shrink-0 min-h-[44px] px-3 -mr-1 rounded-xl
                 inline-flex items-center gap-2 text-[14px] font-medium
                 text-ink-dim active:bg-hover transition-colors"
    >
      <SlidersHorizontal className="w-[18px] h-[18px]" />
      Filter
      {activeFilterCount > 0 && (
        <span className="absolute top-1 right-0 min-w-[18px] h-[18px] px-1
                         rounded-full bg-accent text-on-accent
                         text-[11px] font-bold leading-[18px] text-center">
          {activeFilterCount}
        </span>
      )}
      <span className="sr-only">
        {count} events match the current filters
      </span>
    </button>
  </div>
);

export default MobileFilterSheet;
