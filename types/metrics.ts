export type Tier = 'Elite' | 'High' | 'Medium' | 'Low';

export interface RepoInfo {
  owner: string;
  name: string;
  description: string | null;
  url: string;
}

export interface MetricValue {
  value: number;
  formatted: string;
  tier: Tier;
  sparkline: number[];
  empty: boolean;
}

export interface WeeklyCount {
  week: string;
  count: number;
}

export interface VelocityData {
  weeklyData: WeeklyCount[];
  recent4wAvg: number;
  prior8wAvg: number;
  percentChange: number;
  tier: Tier;
  sparkline: number[];
  empty: boolean;
}

export interface ProcessMetrics {
  reviewResponseTime: MetricValue;  // hours to first review comment
  openBugBacklog: MetricValue;       // total open issues labeled bug
  contributorCount: MetricValue;     // unique PR authors in 90 days
}

export interface MetricsData {
  repo: RepoInfo;
  deploymentFrequency: MetricValue;
  leadTime: MetricValue;
  changeFailureRate: MetricValue;
  meanTimeToRestore: MetricValue;
  velocityTrend: VelocityData;
  processMetrics: ProcessMetrics;
  overallHealth: {
    tier: Tier;
    worstMetric: string;
  };
}
