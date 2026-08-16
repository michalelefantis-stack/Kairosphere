import React from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { LocalReport, LocalReportsResult, fetchLocalReports } from '../utils/localReports';
import { relativeTime } from '../utils/eventFormat';

/**
 * Unconfirmed reports from the local press.
 *
 * Deliberately styled unlike everything else in the app: dashed border, no
 * confidence percentage, no marker on the map. These are newspaper headlines a
 * classifier thinks describe a public event — the layer that would have caught
 * a royal cremation announced in Ubud two days out, but also the layer most
 * likely to be wrong.
 *
 * Every row links out to the original article in its own language, because the
 * honest end of this feature is "here is what the local paper said, go read
 * it" rather than "here is an event, we promise".
 */

const ReportRow: React.FC<{ report: LocalReport }> = ({ report }) => (
  <li className="py-3 border-b border-line-soft/60 last:border-0">
    <a
      href={report.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <p className="text-[14px] text-ink leading-snug group-hover:text-accent transition-colors">
        {report.title}
      </p>
      <p className="text-[12px] text-ink-faint mt-1 flex flex-wrap items-center gap-x-2">
        {report.place && <span className="text-ink-dim">{report.place}</span>}
        {report.whenText && <span>· {report.whenText}</span>}
        <span>· {report.source || report.sourceDomain}</span>
        <span>· {relativeTime(Date.parse(report.publishedAt))}</span>
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </p>
    </a>
  </li>
);

interface LocalReportsProps {
  userCoords?: [number, number] | null;
}

const LocalReports: React.FC<LocalReportsProps> = ({ userCoords }) => {
  const [state, setState] = React.useState<LocalReportsResult | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!userCoords) {
      setState(null);
      return;
    }
    fetchLocalReports(userCoords).then(result => {
      if (alive) setState(result);
    });
    return () => { alive = false; };
  }, [userCoords?.[0], userCoords?.[1]]);

  // Nothing to say without a location, outside covered countries, or when the
  // feed has not been through the classifier.
  if (!state || state.uncovered || state.suppressed || state.reports.length === 0) {
    return null;
  }

  const shown = expanded ? state.reports : state.reports.slice(0, 4);

  return (
    <section className="mx-4 mb-4 rounded-xl border border-dashed border-line-hard p-4">
      <header className="flex items-start gap-2.5 mb-1">
        <Newspaper className="w-4 h-4 text-ink-faint shrink-0 mt-0.5" />
        <div>
          <h3 className="text-[13px] font-semibold text-ink">
            In the local press{state.countryName ? ` · ${state.countryName}` : ''}
          </h3>
          <p className="text-[12px] text-ink-faint leading-snug mt-0.5">
            Unconfirmed. Picked up from local-language news, not verified by anyone —
            read the source before you travel for it.
          </p>
        </div>
      </header>

      <ul className="mt-2">
        {shown.map(report => <ReportRow key={report.id} report={report} />)}
      </ul>

      {state.reports.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[12px] text-ink-dim hover:text-accent transition-colors"
        >
          {expanded ? 'Show fewer' : `Show all ${state.reports.length}`}
        </button>
      )}
    </section>
  );
};

export default LocalReports;
