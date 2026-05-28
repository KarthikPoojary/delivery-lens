import type { Tier } from '@/types/metrics';

const TIER_STYLES: Record<Tier, { banner: string; badge: string }> = {
  Elite: {
    banner: 'bg-indigo-950/40 border-indigo-800/50',
    badge: 'bg-indigo-950 border-indigo-700 text-indigo-300',
  },
  High: {
    banner: 'bg-green-950/40 border-green-800/50',
    badge: 'bg-green-950 border-green-700 text-green-300',
  },
  Medium: {
    banner: 'bg-amber-950/40 border-amber-800/50',
    badge: 'bg-amber-950 border-amber-700 text-amber-300',
  },
  Low: {
    banner: 'bg-red-950/40 border-red-800/50',
    badge: 'bg-red-950 border-red-700 text-red-300',
  },
};

interface HealthScoreProps {
  tier: Tier;
  worstMetric: string;
}

export default function HealthScore({ tier, worstMetric }: HealthScoreProps) {
  const styles = TIER_STYLES[tier];

  return (
    <div className={`rounded-xl border px-5 py-4 flex flex-wrap items-center gap-4 ${styles.banner}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-400 font-medium">Overall Health</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${styles.badge}`}>
          {tier}
        </span>
      </div>
      {tier !== 'Elite' && (
        <p className="text-xs text-neutral-400">
          Lowest-performing metric:{' '}
          <span className="text-neutral-200 font-medium">{worstMetric}</span>
        </p>
      )}
      {tier === 'Elite' && (
        <p className="text-xs text-neutral-400">All five metrics are performing at Elite level.</p>
      )}
    </div>
  );
}
