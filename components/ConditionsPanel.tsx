import React from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import { ClimateNormals, Daylight, describeRain } from '../utils/eventContext';

/**
 * Climate and daylight, drawn rather than written.
 *
 * These were four identical label-and-paragraph blocks — the same rhythm
 * repeated down the page, with numbers buried in prose. Both are quantities,
 * and a quantity is read faster as a position than as a word.
 *
 * Forms are deliberately modest: a range bar, a proportion meter and a
 * day/night strip. None of them is a chart with axes, because none of this
 * data has enough dimensions to earn one. Every value is also written out, so
 * colour is never the only channel.
 *
 * The panel sizes itself to its container, not the window. It had viewport
 * breakpoints, which meant a desktop-width window put three columns inside a
 * 330px sidebar: "typical daily range" broke across three lines beside its
 * own number. Container queries ask the right question — how much room do I
 * have — and the label now sits above the value, where it cannot collide
 * with it at any width.
 */

/** Plausible span of inhabited daily temperatures, for positioning the bar. */
const SCALE_MIN = -15;
const SCALE_MAX = 45;

const pct = (celsius: number) =>
  Math.max(0, Math.min(100, ((celsius - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

/** Caption, then value, then the drawing. One vertical rhythm for all three. */
const Metric: React.FC<{
  label: string;
  value: string;
  children: React.ReactNode;
}> = ({ label, value, children }) => (
  <div>
    <p className="text-[11px] text-ink-faint uppercase tracking-[0.1em] font-medium">
      {label}
    </p>
    <p className="mt-1.5 text-[28px] font-semibold tabular-nums text-ink leading-none">
      {value}
    </p>
    {children}
  </div>
);

const TemperatureRange: React.FC<{ low: number; high: number }> = ({ low, high }) => {
  const left = pct(low);
  const width = Math.max(2, pct(high) - left);

  return (
    <Metric label="Typical daily range" value={`${low}°–${high}°`}>
      {/* Track spans the inhabited range so the bar's position carries meaning:
          a Nordic winter sits left, an equatorial lowland sits right. */}
      <div className="relative mt-3 h-1.5 rounded-full bg-hover overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: `${left}%`, width: `${width}%`, background: 'var(--k-data-warm)' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-ink-faint tabular-nums">
        <span>{SCALE_MIN}°</span>
        <span>0°</span>
        <span>{SCALE_MAX}°</span>
      </div>
    </Metric>
  );
};

const RainMeter: React.FC<{ share: number; mm: number }> = ({ share, mm }) => {
  const percent = Math.round(share * 100);
  // Ten cells read as "3 days in 10" far quicker than a continuous bar.
  const filled = Math.round(share * 10);

  return (
    <Metric label="Days that see rain" value={`${percent}%`}>
      <div className="flex gap-1 mt-3" role="img" aria-label={`${filled} days in ten see rain`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < filled ? 'var(--k-data-rain)' : 'var(--k-hover)' }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        {describeRain(share)}
        {mm > 0 && ` · about ${mm}mm on a wet day`}
      </p>
    </Metric>
  );
};

const DaylightStrip: React.FC<{ daylight: Daylight }> = ({ daylight }) => {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const rise = toMinutes(daylight.sunrise);
  const set = toMinutes(daylight.sunset);
  const left = (rise / 1440) * 100;
  const width = Math.max(2, ((set - rise) / 1440) * 100);

  return (
    <Metric label="Hours of daylight" value={`${daylight.hours}h`}>
      {/* The full bar is midnight to midnight, so the lit block shows both the
          length of the day and where it sits — which is what matters for a
          dawn alignment or a night-sky event. */}
      <div className="relative mt-3 h-1.5 rounded-full bg-hover overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: `${left}%`, width: `${width}%`, background: 'var(--k-data-warm)' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-ink-faint tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Sunrise className="w-3 h-3" /> {daylight.sunrise}
        </span>
        <span className="inline-flex items-center gap-1">
          {daylight.sunset} <Sunset className="w-3 h-3" />
        </span>
      </div>
    </Metric>
  );
};

interface ConditionsPanelProps {
  climate: ClimateNormals | null;
  daylight: Daylight | null;
}

const ConditionsPanel: React.FC<ConditionsPanelProps> = ({ climate, daylight }) => {
  if (!climate && !daylight) {
    return (
      <p className="text-[14px] text-ink-dim">
        No climate record available for these coordinates.
      </p>
    );
  }

  return (
    <div className="@container space-y-5">
      <div className="grid gap-6 @[24rem]:grid-cols-2 @[40rem]:grid-cols-3">
        {climate && <TemperatureRange low={climate.low} high={climate.high} />}
        {climate && <RainMeter share={climate.wetDayShare} mm={climate.wetDayRain} />}
        {daylight && <DaylightStrip daylight={daylight} />}
      </div>

      {climate && (
        <p className="text-[12px] text-ink-faint border-t border-line-soft pt-3">
          Sampled from {climate.daysSampled} days in the same calendar window across the last{' '}
          {climate.yearsSampled} years — Open-Meteo reanalysis
          {daylight?.approximated && ', daylight from the same date last year'}.
        </p>
      )}
    </div>
  );
};

export default ConditionsPanel;
