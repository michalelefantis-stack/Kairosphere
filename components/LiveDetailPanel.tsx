
import React from 'react';
import { UnifiedEvent } from '../types';
import { X, MapPin, Radio, AlertTriangle, Clock, ExternalLink, Activity } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

interface LiveDetailPanelProps {
  event: UnifiedEvent;
  onClose: () => void;
}

const LiveDetailPanel: React.FC<LiveDetailPanelProps> = ({ event, onClose }) => {
  // Severity is deliberately not shown. It was largely invented — GDELT events
  // are hardcoded to 2 or 4, and pipeline events derive it from confidence —
  // so displaying it was laundering a guess into a number. Category, timing
  // and confidence are all real.
  const isLive = event.status === 'Active';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  /** Which feed stood behind this, in plain words. */
  const sourceSummary = () => {
    const first = event.provenance?.sources?.[0]?.name;
    if (first) return first;
    try {
      return new URL(event.sourceUrl).hostname.replace('www.', '');
    } catch {
      return 'Source unconfirmed';
    }
  };

  // A blurred coordinate should not be displayed to four decimals.
  const coordDigits =
    event.provenance?.precision === 'country' ? 0 :
    event.provenance?.precision === 'regional' ? 1 : 4;

  return (
    <div className="h-full relative text-ink bg-transparent overflow-y-auto custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="relative px-6 pb-6 pt-[80px] border-b border-white/10 bg-black/20">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-1.5 bg-black/60 hover:bg-accent rounded-full transition-all border border-white/10 shadow-lg text-ink hover:text-on-accent"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLive && (
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-live">
              <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
              Happening now
            </span>
          </div>
        )}

        <h2 className="text-2xl font-semibold text-ink leading-tight mb-2">
          {event.title}
        </h2>

        <div className="flex items-center gap-2 text-[13px] text-ink-dim">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {event.location
              ? `${event.location}${event.country && event.country !== event.location ? `, ${event.country}` : ''}`
              : (event.country || 'Location unconfirmed')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">

        {/* Description */}
        <div className="space-y-2">
          <div className="bg-raised p-4 rounded-lg border border-line-soft">
            <p className="text-[14px] text-ink leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>

        {/* Confidence — only pipeline events carry provenance */}
        {event.provenance && <ConfidenceBadge provenance={event.provenance} />}

        {/* When and where, in a plain definition list rather than badge boxes */}
        <dl className="space-y-3 border-t border-line-soft pt-5">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-[13px] text-ink-faint">When</dt>
            <dd className="text-[13px] text-ink flex-1">
              {event.status === 'Active' ? (
                <span className="text-live font-medium">Happening now</span>
              ) : (
                <>Opens {new Date(event.startTime).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
                })}</>
              )}
              <span className="block text-ink-faint mt-0.5">
                through {new Date(event.endTime).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', timeZone: 'UTC'
                })}
              </span>
            </dd>
          </div>

          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-[13px] text-ink-faint">Coordinates</dt>
            <dd className="text-[13px] text-ink flex-1 tabular-nums">
              {/* Never print more decimals than the source actually supports. */}
              {event.coordinates[0].toFixed(coordDigits)}, {event.coordinates[1].toFixed(coordDigits)}
              {event.provenance && event.provenance.precision !== 'point' && (
                <span className="text-ink-faint"> ({event.provenance.precision} precision)</span>
              )}
            </dd>
          </div>

          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-[13px] text-ink-faint">Source</dt>
            <dd className="text-[13px] text-ink flex-1">{sourceSummary()}</dd>
          </div>

          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-[13px] text-ink-faint">Updated</dt>
            <dd className="text-[13px] text-ink flex-1">{formatTime(event.detectedAt)}</dd>
          </div>
        </dl>

        {/* Source Link */}
        {event.sourceUrl && (
          <div className="pt-2">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full p-3 bg-raised hover:bg-hover border border-line hover:border-accent rounded-lg transition-colors group"
            >
              <span className="text-[13px] font-medium text-ink-dim group-hover:text-ink">
                Open the source
              </span>
              <ExternalLink className="w-4 h-4 text-ink-faint group-hover:text-accent" />
            </a>
          </div>
        )}

      </div>
    </div>
  );
};

export default LiveDetailPanel;
