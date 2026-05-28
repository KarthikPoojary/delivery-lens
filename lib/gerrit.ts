import type { MetricValue, MetricsData, ProcessMetrics, Tier, VelocityData, WeeklyCount } from '@/types/metrics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function gerritFetch(url: string) {
  return fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  });
}

async function gerritJson<T>(url: string): Promise<T | null> {
  try {
    const res = await gerritFetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    // Strip Gerrit's XSSI protection prefix: )]}'\n
    return JSON.parse(text.replace(/^\)]\}'\n/, '')) as T;
  } catch {
    return null;
  }
}

function parseGerritDate(s: string): Date {
  // Gerrit format: "2026-05-28 14:57:48.000000000" (UTC)
  return new Date(s.replace(' ', 'T').replace(/\.\d+$/, '') + 'Z');
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
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
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
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function tierHigher(v: number, elite: number, high: number, medium: number): Tier {
  if (v >= elite) return 'Elite';
  if (v >= high) return 'High';
  if (v >= medium) return 'Medium';
  return 'Low';
}

function tierLower(v: number, elite: number, high: number, medium: number): Tier {
  if (v < elite) return 'Elite';
  if (v < high) return 'High';
  if (v < medium) return 'Medium';
  return 'Low';
}

// ── Gerrit Types ─────────────────────────────────────────────────────────────

interface GerritCL {
  _number: number;
  project: string;
  subject: string;
  created: string;
  updated: string;
  submitted: string | null;
  status: 'NEW' | 'MERGED' | 'ABANDONED';
  owner: { _account_id: number; name?: string; email?: string };
  _more_changes?: boolean;
}

interface GerritTag {
  ref: string;
  created?: string;
}

interface GerritProject {
  name?: string;
  description?: string;
  web_links?: Array<{ name: string; url: string }>;
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchProjectInfo(instance: string, project: string) {
  const encoded = encodeURIComponent(project);
  const data = await gerritJson<GerritProject>(`https://${instance}/projects/${encoded}/`);
  return {
    owner: project.split('/')[0] ?? project,
    name: project.split('/').slice(1).join('/') || project,
    description: data?.description ?? null,
    url: `https://${instance}/q/project:${encodeURIComponent(project)}+status:merged`,
  };
}

async function fetchMergedCLs(instance: string, project: string): Promise<GerritCL[]> {
  const date = since(90);
  const q = `project:${encodeURIComponent(project)}+status:merged+after:${date}`;
  const url = `https://${instance}/changes/?q=${q}&n=500&o=DETAILED_ACCOUNTS`;
  const data = await gerritJson<GerritCL[]>(url);
  return data ?? [];
}

async function fetchTags(instance: string, project: string): Promise<GerritTag[]> {
  const encoded = encodeURIComponent(project);
  const data = await gerritJson<GerritTag[]>(`https://${instance}/projects/${encoded}/tags?n=100`);
  return data ?? [];
}

// ── Metric Computations ───────────────────────────────────────────────────────

function computeDeploymentFrequency(tags: GerritTag[]): MetricValue {
  const cutoff = new Date(since(90));
  const recentTags = tags.filter(t => {
    if (!t.created) return false;
    return parseGerritDate(t.created) >= cutoff;
  });
  const count = recentTags.length;
  const tier = tierHigher(count, 30, 10, 2);

  const weeks = lastNWeeks(12);
  const weekCounts = new Map<string, number>(weeks.map(w => [w, 0]));
  recentTags.forEach(t => {
    if (t.created) {
      const w = isoWeek(parseGerritDate(t.created));
      if (weekCounts.has(w)) weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
    }
  });

  return {
    value: count,
    formatted: String(count),
    tier,
    sparkline: weeks.map(w => weekCounts.get(w) ?? 0),
    empty: count === 0,
  };
}

function computeLeadTime(cls: GerritCL[]): MetricValue {
  const hours = cls
    .filter(cl => cl.submitted)
    .map(cl => (parseGerritDate(cl.submitted!).getTime() - parseGerritDate(cl.created).getTime()) / 3600000);

  if (hours.length === 0) return { value: 0, formatted: 'N/A', tier: 'Low', sparkline: [], empty: true };

  const med = median(hours);
  const tier = tierLower(med, 24, 168, 720);
  const formatted = med < 24 ? `${Math.round(med)}h` : `${(med / 24).toFixed(1)}d`;

  return { value: Math.round(med), formatted, tier, sparkline: [], empty: false };
}

function computeCFR(cls: GerritCL[]): MetricValue {
  if (cls.length === 0) return { value: 0, formatted: '0%', tier: 'Elite', sparkline: [], empty: true };
  // Gerrit convention: reverts start with "Revert " in the subject
  const failures = cls.filter(cl => /^Revert\b/i.test(cl.subject));
  const rate = (failures.length / cls.length) * 100;
  const tier = tierLower(rate, 16, 31, 46);
  return {
    value: Math.round(rate),
    formatted: `${rate.toFixed(1)}%`,
    tier,
    sparkline: [],
    empty: false,
  };
}

function computeVelocity(cls: GerritCL[]): VelocityData {
  const weeks = lastNWeeks(12);
  const weekCounts = new Map<string, number>(weeks.map(w => [w, 0]));
  cls.forEach(cl => {
    if (cl.submitted) {
      const w = isoWeek(parseGerritDate(cl.submitted));
      if (weekCounts.has(w)) weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
    }
  });
  const weeklyData: WeeklyCount[] = weeks.map(w => ({ week: w, count: weekCounts.get(w) ?? 0 }));
  const counts = weeklyData.map(d => d.count);
  const recent4w = counts.slice(-4);
  const prior8w = counts.slice(0, 8);
  const r4wAvg = recent4w.reduce((a, b) => a + b, 0) / 4;
  const p8wAvg = prior8w.reduce((a, b) => a + b, 0) / 8;
  const pct = p8wAvg === 0 ? (r4wAvg > 0 ? 100 : 0) : ((r4wAvg - p8wAvg) / p8wAvg) * 100;

  let tier: Tier;
  if (pct > 10) tier = 'Elite';
  else if (pct >= -5) tier = 'High';
  else if (pct >= -20) tier = 'Medium';
  else tier = 'Low';

  return {
    weeklyData,
    recent4wAvg: Math.round(r4wAvg * 10) / 10,
    prior8wAvg: Math.round(p8wAvg * 10) / 10,
    percentChange: Math.round(pct * 10) / 10,
    tier,
    sparkline: counts,
    empty: cls.length === 0,
  };
}

function computeContributorCount(cls: GerritCL[]): MetricValue {
  const authors = new Set(cls.map(cl => cl.owner._account_id));
  const count = authors.size;
  const tier = tierHigher(count, 20, 10, 5);
  return { value: count, formatted: String(count), tier, sparkline: [], empty: count === 0 };
}

function computeOverallHealth(
  deployFreq: MetricValue,
  leadTime: MetricValue,
  cfr: MetricValue,
  velocity: VelocityData,
): { tier: Tier; worstMetric: string } {
  const score = (t: Tier) => ({ Elite: 4, High: 3, Medium: 2, Low: 1 }[t]);
  const entries = [
    { name: 'Deployment Frequency', tier: deployFreq.tier },
    { name: 'Lead Time for Changes', tier: leadTime.tier },
    { name: 'Change Failure Rate', tier: cfr.tier },
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

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export async function fetchAllGerritMetrics(
  instance: string,
  project: string,
): Promise<MetricsData> {
  const [repoInfo, cls, tags] = await Promise.all([
    fetchProjectInfo(instance, project),
    fetchMergedCLs(instance, project),
    fetchTags(instance, project),
  ]);

  const deploymentFrequency = computeDeploymentFrequency(tags);
  const leadTime = computeLeadTime(cls);
  const changeFailureRate = computeCFR(cls);
  const velocityTrend = computeVelocity(cls);

  const meanTimeToRestore: MetricValue = {
    value: 0, formatted: 'N/A', tier: 'Elite', sparkline: [], empty: true,
  };

  const processMetrics: ProcessMetrics = {
    reviewResponseTime: { value: 0, formatted: 'N/A', tier: 'Elite', sparkline: [], empty: true },
    openBugBacklog: { value: 0, formatted: 'N/A', tier: 'Elite', sparkline: [], empty: true },
    contributorCount: computeContributorCount(cls),
  };

  const overallHealth = computeOverallHealth(
    deploymentFrequency,
    leadTime,
    changeFailureRate,
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
