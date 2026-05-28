import type { MetricValue, MetricsData, Tier, VelocityData, WeeklyCount } from '@/types/metrics';

const BASE = 'https://api.github.com';

function ghFetch(path: string) {
  const token = process.env.GITHUB_TOKEN;
  return fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 3600 },
  });
}

function since(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function isoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function lastNWeeks(n: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(isoWeek(d));
  }
  return weeks;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function tierHigher(value: number, elite: number, high: number, medium: number): Tier {
  if (value >= elite) return 'Elite';
  if (value >= high) return 'High';
  if (value >= medium) return 'Medium';
  return 'Low';
}

function tierLower(value: number, elite: number, high: number, medium: number): Tier {
  if (value < elite) return 'Elite';
  if (value < high) return 'High';
  if (value < medium) return 'Medium';
  return 'Low';
}

interface GHRelease {
  published_at: string;
}

interface GHSearchItem {
  title: string;
  created_at: string;
  closed_at: string | null;
  pull_request?: { merged_at: string | null };
  merged_at?: string | null;
}

async function fetchRepoInfo(owner: string, name: string) {
  const res = await ghFetch(`/repos/${owner}/${name}`);
  if (res.status === 404) throw new Error(`Repository ${owner}/${name} not found`);
  if (res.status === 403) throw new Error('GitHub API rate limit reached. Try again in a minute.');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return {
    owner,
    name,
    description: (data.description as string | null) ?? null,
    url: data.html_url as string,
  };
}

async function fetchReleases(owner: string, name: string): Promise<GHRelease[]> {
  const res = await ghFetch(`/repos/${owner}/${name}/releases?per_page=100`);
  if (!res.ok) return [];
  const releases: GHRelease[] = await res.json();
  const cutoff = new Date(since(90));
  return releases.filter((r) => new Date(r.published_at) >= cutoff);
}

async function fetchTagCount(owner: string, name: string): Promise<number> {
  const res = await ghFetch(`/repos/${owner}/${name}/tags?per_page=100`);
  if (!res.ok) return 0;
  const tags: unknown[] = await res.json();
  return tags.length;
}

async function fetchMergedPRs(owner: string, name: string): Promise<GHSearchItem[]> {
  const date = since(90);
  const url = `/search/issues?q=repo:${owner}/${name}+type:pr+is:merged+merged:>${date}&per_page=100&sort=updated&order=desc`;
  const res = await ghFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GHSearchItem[];
}

async function fetchBugIssues(owner: string, name: string): Promise<GHSearchItem[]> {
  const date = since(90);
  const url = `/search/issues?q=repo:${owner}/${name}+type:issue+label:bug+is:closed+closed:>${date}&per_page=100`;
  const res = await ghFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GHSearchItem[];
}

function computeDeploymentFrequency(
  releases: GHRelease[],
  tagCount: number,
): MetricValue {
  const count = releases.length > 0 ? releases.length : tagCount;
  const tier = tierHigher(count, 30, 10, 2);

  const weeks = lastNWeeks(12);
  const weekCounts = new Map<string, number>(weeks.map((w) => [w, 0]));
  releases.forEach((r) => {
    const w = isoWeek(new Date(r.published_at));
    if (weekCounts.has(w)) weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
  });
  const sparkline = weeks.map((w) => weekCounts.get(w) ?? 0);

  return {
    value: count,
    formatted: String(count),
    tier,
    sparkline,
    empty: count === 0,
  };
}

function computeLeadTime(prs: GHSearchItem[]): MetricValue {
  const mergedAt = (pr: GHSearchItem): string | null =>
    pr.pull_request?.merged_at ?? pr.merged_at ?? null;

  const hours = prs
    .filter((pr) => mergedAt(pr))
    .map((pr) => {
      const created = new Date(pr.created_at).getTime();
      const merged = new Date(mergedAt(pr)!).getTime();
      return (merged - created) / (1000 * 60 * 60);
    });

  if (hours.length === 0) {
    return { value: 0, formatted: 'N/A', tier: 'Low', sparkline: [], empty: true };
  }

  const med = median(hours);
  const tier = tierLower(med, 24, 168, 720);
  const formatted = med < 24 ? `${Math.round(med)}h` : `${(med / 24).toFixed(1)}d`;

  return { value: Math.round(med), formatted, tier, sparkline: [], empty: false };
}

function computeChangeFailureRate(prs: GHSearchItem[]): MetricValue {
  if (prs.length === 0) {
    return { value: 0, formatted: '0%', tier: 'Elite', sparkline: [], empty: true };
  }

  const failPattern = /\b(revert|hotfix|rollback)\b/i;
  const failures = prs.filter((pr) => failPattern.test(pr.title));
  const rate = (failures.length / prs.length) * 100;

  // Elite <16%, High <31%, Medium <46%, Low >=46%
  const tier = tierLower(rate, 16, 31, 46);

  return {
    value: Math.round(rate),
    formatted: `${rate.toFixed(1)}%`,
    tier,
    sparkline: [],
    empty: false,
  };
}

function computeMTTR(issues: GHSearchItem[]): MetricValue {
  const days = issues
    .filter((i) => i.closed_at)
    .map((i) => {
      const created = new Date(i.created_at).getTime();
      const closed = new Date(i.closed_at!).getTime();
      return (closed - created) / (1000 * 60 * 60 * 24);
    });

  if (days.length === 0) {
    return { value: 0, formatted: 'N/A', tier: 'Elite', sparkline: [], empty: true };
  }

  const med = median(days);
  const tier = tierLower(med, 1, 7, 30);
  const formatted = med < 1 ? `${Math.round(med * 24)}h` : `${med.toFixed(1)}d`;

  return {
    value: Math.round(med * 10) / 10,
    formatted,
    tier,
    sparkline: [],
    empty: false,
  };
}

function computeVelocity(prs: GHSearchItem[]): VelocityData {
  const mergedAt = (pr: GHSearchItem): string | null =>
    pr.pull_request?.merged_at ?? pr.merged_at ?? null;

  const weeks = lastNWeeks(12);
  const weekCounts = new Map<string, number>(weeks.map((w) => [w, 0]));

  prs.forEach((pr) => {
    const ma = mergedAt(pr);
    if (ma) {
      const w = isoWeek(new Date(ma));
      if (weekCounts.has(w)) weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
    }
  });

  const weeklyData: WeeklyCount[] = weeks.map((w) => ({
    week: w,
    count: weekCounts.get(w) ?? 0,
  }));
  const counts = weeklyData.map((d) => d.count);

  const recent4w = counts.slice(-4);
  const prior8w = counts.slice(0, 8);
  const recent4wAvg = recent4w.reduce((a, b) => a + b, 0) / 4;
  const prior8wAvg = prior8w.reduce((a, b) => a + b, 0) / 8;

  const percentChange =
    prior8wAvg === 0
      ? recent4wAvg > 0 ? 100 : 0
      : ((recent4wAvg - prior8wAvg) / prior8wAvg) * 100;

  let tier: Tier;
  if (percentChange > 10) tier = 'Elite';
  else if (percentChange >= -5) tier = 'High';
  else if (percentChange >= -20) tier = 'Medium';
  else tier = 'Low';

  return {
    weeklyData,
    recent4wAvg: Math.round(recent4wAvg * 10) / 10,
    prior8wAvg: Math.round(prior8wAvg * 10) / 10,
    percentChange: Math.round(percentChange * 10) / 10,
    tier,
    sparkline: counts,
    empty: prs.length === 0,
  };
}

function computeOverallHealth(
  deployFreq: MetricValue,
  leadTime: MetricValue,
  cfr: MetricValue,
  mttr: MetricValue,
  velocity: VelocityData,
): { tier: Tier; worstMetric: string } {
  const score = (t: Tier) => ({ Elite: 4, High: 3, Medium: 2, Low: 1 }[t]);

  const entries = [
    { name: 'Deployment Frequency', tier: deployFreq.tier },
    { name: 'Lead Time for Changes', tier: leadTime.tier },
    { name: 'Change Failure Rate', tier: cfr.tier },
    { name: 'Mean Time to Restore', tier: mttr.tier },
    { name: 'Velocity Trend', tier: velocity.tier },
  ];

  const avg = entries.reduce((a, e) => a + score(e.tier), 0) / entries.length;
  const worst = entries.reduce((a, e) => (score(e.tier) < score(a.tier) ? e : a));

  let tier: Tier;
  if (avg >= 3.5) tier = 'Elite';
  else if (avg >= 2.5) tier = 'High';
  else if (avg >= 1.5) tier = 'Medium';
  else tier = 'Low';

  return { tier, worstMetric: worst.name };
}

export async function fetchAllMetrics(
  owner: string,
  name: string,
): Promise<MetricsData> {
  const [repoInfo, releases, mergedPRs, bugIssues] = await Promise.all([
    fetchRepoInfo(owner, name),
    fetchReleases(owner, name),
    fetchMergedPRs(owner, name),
    fetchBugIssues(owner, name),
  ]);

  let tagCount = 0;
  if (releases.length === 0) {
    tagCount = await fetchTagCount(owner, name);
  }

  const deploymentFrequency = computeDeploymentFrequency(releases, tagCount);
  const leadTime = computeLeadTime(mergedPRs);
  const changeFailureRate = computeChangeFailureRate(mergedPRs);
  const meanTimeToRestore = computeMTTR(bugIssues);
  const velocityTrend = computeVelocity(mergedPRs);
  const overallHealth = computeOverallHealth(
    deploymentFrequency,
    leadTime,
    changeFailureRate,
    meanTimeToRestore,
    velocityTrend,
  );

  return {
    repo: repoInfo,
    deploymentFrequency,
    leadTime,
    changeFailureRate,
    meanTimeToRestore,
    velocityTrend,
    overallHealth,
  };
}
