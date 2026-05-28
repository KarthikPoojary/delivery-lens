import type { MetricValue, Tier } from '@/types/metrics';
import MetricTooltip from './MetricTooltip';

const TIER_STYLES: Record<Tier, { badge: string; text: string }> = {
  Elite: {
    badge: 'bg-indigo-950 border-indigo-800 text-indigo-300',
    text: 'text-indigo-400',
  },
  High: {
    badge: 'bg-green-950 border-green-800 text-green-300',
    text: 'text-green-400',
  },
  Medium: {
    badge: 'bg-amber-950 border-amber-800 text-amber-300',
    text: 'text-amber-400',
  },
  Low: {
    badge: 'bg-red-950 border-red-800 text-red-300',
    text: 'text-red-400',
  },
};

function Sparkline({ data, tier }: { data: number[]; tier: Tier }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 80;
  const H = 24;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 2) - 1,
  }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const colorClass = TIER_STYLES[tier].text;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={`overflow-visible ${colorClass}`}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface MetricCardProps {
  name: string;
  subtitle: string;
  metric: MetricValue;
  tooltip: string;
}

export default function MetricCard({ name, subtitle, metric, tooltip }: MetricCardProps) {
  const styles = TIER_STYLES[metric.tier];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{name}</p>
          <p className="text-[11px] text-neutral-600 mt-0.5">{subtitle}</p>
        </div>
        <MetricTooltip content={tooltip} />
      </div>

      <div className="font-mono text-2xl font-semibold text-neutral-100">
        {metric.empty ? <span className="text-neutral-600 text-base">No data</span> : metric.formatted}
      </div>

      <span
        className={`inline-flex items-center self-start px-2.5 py-0.5 rounded-full border text-xs font-medium ${styles.badge}`}
      >
        {metric.tier}
      </span>

      {metric.sparkline.length > 1 && (
        <div className="pt-1">
          <Sparkline data={metric.sparkline} tier={metric.tier} />
        </div>
      )}
    </div>
  );
}
