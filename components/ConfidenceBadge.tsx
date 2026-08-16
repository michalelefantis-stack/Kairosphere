import React from 'react';
import { Provenance, SourceTier } from '../types';
import { ShieldCheck, Satellite, Users, PencilLine, Clock } from 'lucide-react';

/**
 * Confidence as a first-class, visible dimension.
 *
 * Every travel blog says the northern lights are "best October to March".
 * What nobody offers is "predicted 12-19 Sept, +/-4 days, 72% confident, last
 * verified 2 days ago, 3 sources" — so that string is the thing this renders.
 */

const BAND_STYLE: Record<string, { text: string; border: string; bg: string; label: string }> = {
  high:        { text: 'text-accent', border: 'border-accent/40', bg: 'bg-accent/10', label: 'High confidence' },
  medium:      { text: 'text-gold', border: 'border-gold/40', bg: 'bg-gold/10', label: 'Moderate confidence' },
  low:         { text: 'text-orange-400', border: 'border-orange-400/40', bg: 'bg-orange-400/10', label: 'Low confidence' },
  speculative: { text: 'text-ink-dim',  border: 'border-line-hard/40',  bg: 'bg-ink-faint/10',  label: 'Speculative' }
};

const TIER_META: Record<SourceTier, { icon: React.ReactNode; label: string; blurb: string }> = {
  [SourceTier.DETERMINISTIC]: {
    icon: <ShieldCheck className="w-3 h-3" />,
    label: 'Computed',
    blurb: 'Calculated from orbital and calendar math — not a forecast.'
  },
  [SourceTier.MODEL]: {
    icon: <Satellite className="w-3 h-3" />,
    label: 'Model feed',
    blurb: 'Published scientific model output, refreshed on a schedule.'
  },
  [SourceTier.CITIZEN]: {
    icon: <Users className="w-3 h-3" />,
    label: 'Observed',
    blurb: 'Aggregated from citizen-science sightings; regional, not exact.'
  },
  [SourceTier.CURATED]: {
    icon: <PencilLine className="w-3 h-3" />,
    label: 'Verified by hand',
    blurb: 'Confirmed by a person against local sources.'
  }
};

function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  }
  if (sameMonth) {
    return `${start.getUTCDate()}-${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-GB', opts)} - ${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

export function formatStaleness(days: number): string {
  if (days < 1) return 'verified today';
  if (days < 2) return 'verified yesterday';
  if (days < 45) return `verified ${Math.round(days)} days ago`;
  const months = Math.round(days / 30);
  return `verified ${months} month${months === 1 ? '' : 's'} ago`;
}

/** Compact inline pill, for list rows. */
export const ConfidenceChip: React.FC<{ provenance: Provenance }> = ({ provenance }) => {
  const style = BAND_STYLE[provenance.band] ?? BAND_STYLE.speculative;
  const tier = TIER_META[provenance.tier];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${style.border} ${style.bg} ${style.text}`}
      title={`${style.label} - ${tier?.blurb ?? ''} ${formatStaleness(provenance.stalenessDays)}.`}
    >
      {tier?.icon}
      <span className="text-[11px] font-black tracking-wider tabular-nums">
        {Math.round(provenance.confidence * 100)}%
      </span>
      {provenance.uncertaintyDays >= 1 && (
        <span className="text-[11px] font-mono opacity-70">
          ±{Math.round(provenance.uncertaintyDays)}d
        </span>
      )}
    </span>
  );
};

/** Full panel block, for the detail view. */
const ConfidenceBadge: React.FC<{ provenance: Provenance }> = ({ provenance }) => {
  const style = BAND_STYLE[provenance.band] ?? BAND_STYLE.speculative;
  const tier = TIER_META[provenance.tier];
  const pct = Math.round(provenance.confidence * 100);
  const isBlurred = provenance.precision !== 'point';

  return (
    <div className="space-y-2">
      <h4 className="text-[12px] text-ink-faint uppercase font-black tracking-[0.1em]">
        Prediction Confidence
      </h4>

      <div className={`rounded-lg border ${style.border} ${style.bg} p-4 space-y-3`}>
        {/* Headline number */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-3xl font-black tabular-nums leading-none ${style.text}`}>{pct}%</div>
            <div className={`text-[12px] font-bold uppercase tracking-widest mt-1 ${style.text}`}>
              {style.label}
            </div>
          </div>
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded border ${style.border} ${style.text} text-[11px] font-black uppercase tracking-widest shrink-0`}
            title={tier?.blurb}
          >
            {tier?.icon}
            {tier?.label}
          </span>
        </div>

        {/* Confidence bar */}
        <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${style.text}`}
            style={{ width: `${Math.max(2, pct)}%`, backgroundColor: 'currentColor' }}
          />
        </div>

        {/* The claim, spelled out */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest">Predicted window</span>
            <span className="text-[12px] font-mono text-ink text-right">
              {formatWindow(provenance.windowStart, provenance.windowEnd)}
              {provenance.uncertaintyDays >= 1 && (
                <span className="text-ink-dim"> ±{Math.round(provenance.uncertaintyDays)}d</span>
              )}
            </span>
          </div>

          {provenance.peak && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest">Peak</span>
              <span className="text-[12px] font-mono text-ink">
                {new Date(provenance.peak).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', timeZone: 'UTC'
                })}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest">Last verified</span>
            <span className="text-[12px] font-mono text-ink flex items-center gap-1">
              <Clock className="w-3 h-3 opacity-60" />
              {formatStaleness(provenance.stalenessDays)}
            </span>
          </div>
        </div>
      </div>

      {/* Why we believe it */}
      {provenance.sources.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-ink-faint uppercase tracking-widest">
            {provenance.sources.length} source{provenance.sources.length === 1 ? '' : 's'}
          </span>
          {provenance.sources.map((source, index) => (
            <div key={`${source.url}-${index}`} className="text-[12px] leading-snug">
              {source.url?.startsWith('http') ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:text-accent underline decoration-gray-700 underline-offset-2"
                >
                  {source.name}
                </a>
              ) : (
                <span className="text-ink">{source.name}</span>
              )}
              {source.note && <p className="text-ink-faint mt-0.5">{source.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Access and precision caveats */}
      {(isBlurred || provenance.sensitivity === 'restricted') && (
        <div className="text-[12px] text-ink-faint leading-snug border-l-2 border-gold/40 pl-2 py-1">
          {isBlurred && (
            <p>
              Location shown at {provenance.precision === 'country' ? 'country' : 'regional'} precision
              {provenance.sensitivity === 'restricted' ? ' — this gathering is access-controlled.' : '.'}
            </p>
          )}
          {/* Skip if a source note already said the same thing. */}
          {provenance.consent &&
            !provenance.sources.some(s => s.note === provenance.consent) && (
              <p className="mt-1 text-ink-faint">{provenance.consent}</p>
            )}
        </div>
      )}
    </div>
  );
};

export default ConfidenceBadge;
