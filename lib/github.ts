import type { MetricValue, MetricsData, ProcessMetrics, Tier, VelocityData, WeeklyCount } from '@/types/metrics';

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
  number: number;
  title: string;
  created_at: string;
  closed_at: string | null;
  pull_request?: { merged_at: string | null };
  merged_at?: string | null;
  user?: { login: string };
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
  const url = `/search/issues?q=repo:${owner}/${name}+type:pr+is:merged+merged:>${date}&per_page=100&sort=merged&order=desc`;
  const res = await ghFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GHSearchItem[];
}

// Returns [totalMergedCount, failureCount] using exact search counts — avoids
// sampling bias when a repo has thousands of PRs in 90 days.
// Three separate keyword searches because GitHub Search uses AND logic between terms;
// combining them would require ALL three words in a title.
async function fetchCFRCounts(owner: string, name: string): Promise<[number, number]> {
  const date = since(90);
  const base = `repo:${owner}/${name}+type:pr+is:merged+merged:>${date}`;
  const [totalRes, revertRes, hotfixRes, rollbackRes] = await Promise.all([
    ghFetch(`/search/issues?q=${base}&per_page=1`),
    ghFetch(`/search/issues?q=${base}+revert+in:title&per_page=1`),
    ghFetch(`/search/issues?q=${base}+hotfix+in:title&per_page=1`),
    ghFetch(`/search/issues?q=${base}+rollback+in:title&per_page=1`),
  ]);
  if (!totalRes.ok) return [0, 0];
  const [total, rev, hot, roll] = await Promise.all([
    totalRes.json(),
    revertRes.ok ? revertRes.json() : Promise.resolve({ total_count: 0 }),
    hotfixRes.ok ? hotfixRes.json() : Promise.resolve({ total_count: 0 }),
    rollbackRes.ok ? rollbackRes.json() : Promise.resolve({ total_count: 0 }),
  ]);
  // Sums across three keywords — rare overlap (PR titled both "revert" and "hotfix") is negligible
  const failures = (rev.total_count ?? 0) + (hot.total_count ?? 0) + (roll.total_count ?? 0);
  return [total.total_count ?? 0, failures];
}

// Returns [recent4wTotal, prior8wTotal] as exact counts for velocity comparison.
// Uses two cumulative queries and subtracts to avoid the `merged:<date` URL encoding
// issue where GitHub Search misparses the `<` operator in query strings.
async function fetchVelocityCounts(owner: string, name: string): Promise<[number, number]> {
  const w4ago = since(28);
  const w12ago = since(84);
  const base = `repo:${owner}/${name}+type:pr+is:merged`;
  const [recentRes, total12wRes] = await Promise.all([
    ghFetch(`/search/issues?q=${base}+merged:>${w4ago}&per_page=1`),
    ghFetch(`/search/issues?q=${base}+merged:>${w12ago}&per_page=1`),
  ]);
  if (!recentRes.ok || !total12wRes.ok) return [0, 0];
  const [recent, total12w] = await Promise.all([recentRes.json(), total12wRes.json()]);
  const recent4w = recent.total_count ?? 0;
  const prior8w = Math.max(0, (total12w.total_count ?? 0) - recent4w);
  return [recent4w, prior8w];
}

async function fetchBugIssues(owner: string, name: string): Promise<GHSearchItem[]> {
  // Query bugs *created* in the window that are now closed — avoids ancient bugs being
  // triaged recently inflating MTTR (e.g. a 2020 issue closed last week = 1800d MTTR).
  const date = since(90);
  const url = `/search/issues?q=repo:${owner}/${name}+type:issue+label:bug+is:closed+created:>${date}&per_page=100`;
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

function computeChangeFailureRate(totalPRs: number, failurePRs: number): MetricValue {
  if (totalPRs === 0) {
    return { value: 0, formatted: '0%', tier: 'Elite', sparkline: [], empty: true };
  }

  const rate = (failurePRs / totalPRs) * 100;
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

function computeVelocity(
  prs: GHSearchItem[],
  recent4wTotal: number,
  prior8wTotal: number,
): VelocityData {
  const mergedAt = (pr: GHSearchItem): string | null =>
    pr.pull_request?.merged_at ?? pr.merged_at ?? null;

  // Weekly sparkline from sample — indicative shape, not exact counts for high-volume repos
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

  // Use exact counts for the trend comparison — avoids sample bias
  const recent4wAvg = recent4wTotal / 4;
  const prior8wAvg = prior8wTotal / 8;
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
    sparkline: weeklyData.map((d) => d.count),
    empty: recent4wTotal === 0 && prior8wTotal === 0,
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

// ── Process Health Metrics ──────────────────────────────────────────────────

async function fetchReviewResponseTime(owner: string, name: string, prs: GHSearchItem[]): Promise<MetricValue> {
  // Sample the first 20 merged PRs and fetch their first review comment time
  const sample = prs.filter(p => p.pull_request?.merged_at).slice(0, 20);
  if (sample.length === 0) return { value: 0, formatted: 'N/A', tier: 'Low', sparkline: [], empty: true };

  const reviewTimes = await Promise.all(
    sample.map(async pr => {
      const res = await ghFetch(`/repos/${owner}/${name}/issues/${pr.number}/timeline?per_page=100`);
      if (!res.ok) return null;
      const events: Array<{ event: string; created_at?: string }> = await res.json();
      const firstReview = events.find(e =>
        e.event === 'reviewed' || e.event === 'commented' || e.event === 'review_requested'
      );
      if (!firstReview?.created_at) return null;
      return (new Date(firstReview.created_at).getTime() - new Date(pr.created_at).getTime()) / 3600000;
    })
  );

  const valid = reviewTimes.filter((h): h is number => h !== null && h > 0);
  if (valid.length === 0) return { value: 0, formatted: 'N/A', tier: 'Low', sparkline: [], empty: true };

  const sorted = [...valid].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  // Elite <4h, High <24h, Medium <72h, Low >=72h
  const tier = tierLower(med, 4, 24, 72);
  const formatted = med < 24 ? `${Math.round(med)}h` : `${(med / 24).toFixed(1)}d`;

  return { value: Math.round(med), formatted, tier, sparkline: [], empty: false };
}

async function fetchOpenBugBacklog(owner: string, name: string): Promise<MetricValue> {
  const res = await ghFetch(`/search/issues?q=repo:${owner}/${name}+type:issue+label:bug+is:open&per_page=1`);
  if (!res.ok) return { value: 0, formatted: '0', tier: 'Elite', sparkline: [], empty: true };
  const data = await res.json();
  const count: number = data.total_count ?? 0;

  // Lower is better. Elite <10, High <50, Medium <200, Low >=200
  const tier = tierLower(count, 10, 50, 200);
  return { value: count, formatted: String(count), tier, sparkline: [], empty: count === 0 };
}

function computeContributorCount(prs: GHSearchItem[]): MetricValue {
  const authors = new Set(prs.map(p => (p as unknown as { user?: { login: string } }).user?.login).filter(Boolean));
  const count = authors.size;
  // Elite >=20 unique contributors in 90d, High >=10, Medium >=5, Low <5
  const tier = tierHigher(count, 20, 10, 5);
  return { value: count, formatted: String(count), tier, sparkline: [], empty: count === 0 };
}

// ── Main Orchestrator ───────────────────────────────────────────────────────

export async function fetchAllMetrics(
  owner: string,
  name: string,
): Promise<MetricsData> {
  const [repoInfo, releases, mergedPRs, bugIssues, cfrCounts, velocityCounts, openBugBacklog] = await Promise.all([
    fetchRepoInfo(owner, name),
    fetchReleases(owner, name),
    fetchMergedPRs(owner, name),
    fetchBugIssues(owner, name),
    fetchCFRCounts(owner, name),
    fetchVelocityCounts(owner, name),
    fetchOpenBugBacklog(owner, name),
  ]);

  let tagCount = 0;
  if (releases.length === 0) {
    tagCount = await fetchTagCount(owner, name);
  }

  const deploymentFrequency = computeDeploymentFrequency(releases, tagCount);
  const leadTime = computeLeadTime(mergedPRs);
  const changeFailureRate = computeChangeFailureRate(cfrCounts[0], cfrCounts[1]);
  const meanTimeToRestore = computeMTTR(bugIssues);
  const velocityTrend = computeVelocity(mergedPRs, velocityCounts[0], velocityCounts[1]);
  const reviewResponseTime = await fetchReviewResponseTime(owner, name, mergedPRs);
  const contributorCount = computeContributorCount(mergedPRs);

  const processMetrics: ProcessMetrics = {
    reviewResponseTime,
    openBugBacklog,
    contributorCount,
  };

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
    processMetrics,
    overallHealth,
  };
}
