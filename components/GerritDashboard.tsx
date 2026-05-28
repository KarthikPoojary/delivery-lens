import { fetchAllGerritMetrics } from '@/lib/gerrit';
import MetricCard from './MetricCard';
import HealthScore from './HealthScore';
import VelocityChart from './VelocityChart';

const DORA_TOOLTIPS = {
  deploymentFrequency:
    'How often this project ships tagged releases. Elite teams release on-demand, multiple times per week.\n\nDORA Elite benchmark: on-demand (multiple deploys/day). Computed from git tags on the repository over the last 90 days.',
  leadTime:
    'Median time from CL creation to merge. A proxy for how quickly code moves through review and CI on Gerrit.\n\nDORA Elite benchmark: less than 1 hour. A practical threshold of <24h is used here for large open-source projects.',
  changeFailureRate:
    'Percentage of merged CLs whose subject starts with "Revert". Gerrit convention for reverting bad changes.\n\nDORA Elite benchmark: 0–15% of changes cause a failure.',
  meanTimeToRestore:
    'N/A for Gerrit source — Gerrit does not track incident or bug records. Use a companion bug tracker (Buganizer, Monorail) for MTTR.',
  velocityTrend:
    'Are we shipping more CLs than before? Compares merged CLs/week in the last 4 weeks vs the prior 8 weeks. Declining velocity may indicate growing review bottlenecks or scope creep.',
};

const PROCESS_TOOLTIPS = {
  reviewResponseTime:
    'N/A for Gerrit source — detailed reviewer timeline data is not exposed in public Gerrit REST APIs without authentication.',
  openBugBacklog:
    'N/A for Gerrit source — bug tracking is handled by external systems (Monorail, Buganizer, GitHub Issues).',
  contributorCount:
    'Number of unique CL authors who merged code in the last 90 days. A proxy for team bus factor and knowledge distribution across the project.',
};

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-6">
      <p className="text-sm font-medium text-red-400">Could not load metrics</p>
      <p className="text-xs text-red-400/70 mt-1">{message}</p>
    </div>
  );
}

export default async function GerritDashboard({
  instance,
  project,
}: {
  instance: string;
  project: string;
}) {
  let metrics;
  try {
    metrics = await fetchAllGerritMetrics(instance, project);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return <ErrorState message={message} />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-neutral-100 font-mono">
            {metrics.repo.owner}/{metrics.repo.name}
          </h2>
          <a
            href={metrics.repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            {instance}/{project}
          </a>
        </div>
        {metrics.repo.description && (
          <p className="text-sm text-neutral-500">{metrics.repo.description}</p>
        )}
        <p className="text-xs text-neutral-600">Source: Gerrit · {instance}</p>
      </div>

      <HealthScore
        tier={metrics.overallHealth.tier}
        worstMetric={metrics.overallHealth.worstMetric}
      />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
          DORA Metrics — Delivery Performance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <MetricCard
            name="Deployment Frequency"
            subtitle="Releases / 90 days"
            metric={metrics.deploymentFrequency}
            tooltip={DORA_TOOLTIPS.deploymentFrequency}
          />
          <MetricCard
            name="Lead Time for Changes"
            subtitle="Median CL create → merge"
            metric={metrics.leadTime}
            tooltip={DORA_TOOLTIPS.leadTime}
          />
          <MetricCard
            name="Change Failure Rate"
            subtitle="Reverts / total CLs"
            metric={metrics.changeFailureRate}
            tooltip={DORA_TOOLTIPS.changeFailureRate}
          />
          <MetricCard
            name="Mean Time to Restore"
            subtitle="N/A for Gerrit source"
            metric={metrics.meanTimeToRestore}
            tooltip={DORA_TOOLTIPS.meanTimeToRestore}
          />
          <MetricCard
            name="Velocity Trend"
            subtitle="Recent 4w vs prior 8w"
            metric={{
              value: metrics.velocityTrend.percentChange,
              formatted:
                metrics.velocityTrend.percentChange > 0
                  ? `+${metrics.velocityTrend.percentChange}%`
                  : `${metrics.velocityTrend.percentChange}%`,
              tier: metrics.velocityTrend.tier,
              sparkline: metrics.velocityTrend.sparkline,
              empty: metrics.velocityTrend.empty,
            }}
            tooltip={DORA_TOOLTIPS.velocityTrend}
          />
        </div>
      </section>

      {!metrics.velocityTrend.empty && (
        <VelocityChart
          weeklyData={metrics.velocityTrend.weeklyData}
          recent4wAvg={metrics.velocityTrend.recent4wAvg}
          prior8wAvg={metrics.velocityTrend.prior8wAvg}
          percentChange={metrics.velocityTrend.percentChange}
        />
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
          Process Health — Flow Efficiency
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            name="Review Response Time"
            subtitle="N/A for Gerrit source"
            metric={metrics.processMetrics.reviewResponseTime}
            tooltip={PROCESS_TOOLTIPS.reviewResponseTime}
          />
          <MetricCard
            name="Open Bug Backlog"
            subtitle="N/A for Gerrit source"
            metric={metrics.processMetrics.openBugBacklog}
            tooltip={PROCESS_TOOLTIPS.openBugBacklog}
          />
          <MetricCard
            name="Active Contributors"
            subtitle="Unique CL authors / 90 days"
            metric={metrics.processMetrics.contributorCount}
            tooltip={PROCESS_TOOLTIPS.contributorCount}
          />
        </div>
      </section>

      <p className="text-[11px] text-neutral-700 text-right">
        Data from Gerrit REST API. 90-day window. Cached 1 hour.
      </p>
    </div>
  );
}
