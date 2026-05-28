import { fetchAllMetrics } from '@/lib/github';
import MetricCard from './MetricCard';
import HealthScore from './HealthScore';
import VelocityChart from './VelocityChart';

const TOOLTIPS = {
  deploymentFrequency:
    'How often this team ships to production. Elite teams deploy multiple times per week. Low frequency means longer feedback loops and higher risk per release. As a TPM, use this to assess release cadence and deployment pipeline health.',
  leadTime:
    'Median time from PR creation to merge. Proxy for how quickly code moves through review and CI. High lead time points to bottlenecks — large PRs, slow reviewers, flaky tests, or understaffed teams. Target: keep PRs small and reviewable.',
  changeFailureRate:
    'Percentage of merged PRs with "revert", "hotfix", or "rollback" in the title. A proxy for deployment quality. High CFR suggests gaps in testing, review, or release processes. Low CFR alone is not good if deploys are rare.',
  meanTimeToRestore:
    'Median time from a bug issue being opened to closed. Reflects how quickly the team detects and resolves production incidents. Long MTTR indicates weak on-call processes, poor observability, or complex blast-radius incidents.',
  velocityTrend:
    'Are we shipping more or less than before? Compares merged PRs in the last 4 weeks vs the prior 8 weeks. Declining velocity may indicate growing tech debt, onboarding friction, or scope creep. Rising velocity without quality checks can increase CFR.',
};

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-6">
      <p className="text-sm font-medium text-red-400">Could not load metrics</p>
      <p className="text-xs text-red-400/70 mt-1">{message}</p>
    </div>
  );
}

export default async function MetricsDashboard({ repo }: { repo: string }) {
  const parts = repo.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return <ErrorState message={`Invalid repository format: "${repo}". Use owner/repo.`} />;
  }

  const [owner, name] = parts;

  let metrics;
  try {
    metrics = await fetchAllMetrics(owner, name);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return <ErrorState message={message} />;
  }

  return (
    <div className="space-y-6">
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
            github.com/{metrics.repo.owner}/{metrics.repo.name}
          </a>
        </div>
        {metrics.repo.description && (
          <p className="text-sm text-neutral-500">{metrics.repo.description}</p>
        )}
      </div>

      <HealthScore
        tier={metrics.overallHealth.tier}
        worstMetric={metrics.overallHealth.worstMetric}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          name="Deployment Frequency"
          subtitle="Releases / 90 days"
          metric={metrics.deploymentFrequency}
          tooltip={TOOLTIPS.deploymentFrequency}
        />
        <MetricCard
          name="Lead Time for Changes"
          subtitle="Median PR create → merge"
          metric={metrics.leadTime}
          tooltip={TOOLTIPS.leadTime}
        />
        <MetricCard
          name="Change Failure Rate"
          subtitle="Reverts + hotfixes / total PRs"
          metric={metrics.changeFailureRate}
          tooltip={TOOLTIPS.changeFailureRate}
        />
        <MetricCard
          name="Mean Time to Restore"
          subtitle="Median bug issue open → close"
          metric={metrics.meanTimeToRestore}
          tooltip={TOOLTIPS.meanTimeToRestore}
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
          tooltip={TOOLTIPS.velocityTrend}
        />
      </div>

      {!metrics.velocityTrend.empty && (
        <VelocityChart
          weeklyData={metrics.velocityTrend.weeklyData}
          recent4wAvg={metrics.velocityTrend.recent4wAvg}
          prior8wAvg={metrics.velocityTrend.prior8wAvg}
          percentChange={metrics.velocityTrend.percentChange}
        />
      )}

      <p className="text-[11px] text-neutral-700 text-right">
        Data from GitHub REST API. 90-day window. Cached 1 hour.
      </p>
    </div>
  );
}
