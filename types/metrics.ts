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

export interface MetricsData {
  repo: RepoInfo;
  deploymentFrequency: MetricValue;
  leadTime: MetricValue;
  changeFailureRate: MetricValue;
  meanTimeToRestore: MetricValue;
  velocityTrend: VelocityData;
  overallHealth: {
    tier: Tier;
    worstMetric: string;
  };
}
