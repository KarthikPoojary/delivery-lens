# Delivery Lens
*Last updated: 2026-05-27 (Claude session)*

## One-sentence pitch
A single-page TPM tool that shows DORA-aligned engineering health metrics for any public GitHub repository.

## Current status
- **Deployed:** https://delivery-lens.vercel.app (Vercel production, 2026-05-28)
- **GitHub repo:** https://github.com/KarthikPoojary/delivery-lens
- **Works:** GitHub tab (5 DORA + 3 Process Health metrics) and Gerrit tab (Chromium, Fuchsia, Dart presets). TypeScript clean. Nav bar, overflow/tooltip fixes applied.
- **Verified metric values (GitHub presets, as of 2026-05-27):**
  - kubernetes/kubernetes → Deploy High, Lead Time High, CFR Elite, MTTR N/A (uses kind/bug), Velocity Elite (+12%)
  - grpc/grpc → active, good demo values
  - istio/istio → Deploy High, 13 releases, CFR Elite, Velocity Elite (+12%)
- **Vercel env:** GITHUB_TOKEN set in production via Vercel CLI (not in git, not in GitHub).
- **Last worked on:** Gerrit page, nav bar, overflow fix, deployment (2026-05-28).

## Tech stack
- Next.js 16.2.6 (App Router, TypeScript)
- React (canary, bundled with Next.js 16)
- Tailwind CSS v4 (`@import "tailwindcss"` in globals.css — no tailwind.config.ts)
- Recharts (latest) — client-side chart library
- GitHub REST API via native `fetch()` — no SDK
- No database
- Deployment target: Vercel Hobby (delivery-lens.vercel.app)

## Key files and their purpose
```
types/metrics.ts             — Shared TS types: Tier, MetricValue, VelocityData, MetricsData
lib/github.ts                — GitHub API client + all 5 metric compute functions + fetchAllMetrics()
components/RepoPicker.tsx    — Client: 3 preset cards + custom owner/repo input, pushes to URL
components/MetricCard.tsx    — Server: metric name, value, tier badge, inline SVG sparkline
components/MetricTooltip.tsx — CSS group-hover tooltip (no JS state)
components/SkeletonCard.tsx  — Loading skeleton + SkeletonDashboard for Suspense fallback
components/HealthScore.tsx   — Server: composite tier banner + worst metric callout
components/VelocityChart.tsx — Client: Recharts 12-week merged-PR line chart
components/MetricsDashboard.tsx — Async server: calls fetchAllMetrics, renders all cards + chart
app/page.tsx                 — Root page: awaits searchParams, Suspense-wraps MetricsDashboard
app/layout.tsx               — Root layout, Geist fonts, updated metadata
app/globals.css              — Tailwind v4 CSS + theme variables
.env.local.example           — GITHUB_TOKEN placeholder
```

## Design decisions and rationale
- **No API route** — `lib/github.ts` called directly from async Server Component. Calling your own API route from a Server Component is an anti-pattern; direct calls benefit from React fetch memoization.
- **Suspense with key={repo}** — Forces re-suspension on every repo change, showing skeletons during each new fetch.
- **Shared merged PR fetch** — Lead Time, CFR, and Velocity Trend all come from one Search API call. React memoization deduplicates within a render; 1-hour `revalidate` handles cross-request caching.
- **Search API over /pulls pagination** — `merged:>date` filter means one request for the 90-day window.
- **Tag fallback for deployment frequency** — Fetch releases first; if empty, fall back to `/tags` count (approximate — no date filtering on tags endpoint).
- **SVG sparklines in server component** — Inline SVG path from data array; no Recharts needed for card sparklines.
- **searchParams awaited** — Next.js 16 breaking change: `searchParams` is a Promise.
- **Dark theme only** — Neutral-950 background. No light/dark toggle. Fits engineering dashboard aesthetic.
- **Tier colors** — Elite=indigo, High=green, Medium=amber, Low=red. Consistent across badges, sparklines, and health banner.

## Conventions
- Server components by default; `'use client'` only when needed (RepoPicker, VelocityChart).
- Metric values pre-formatted in `lib/github.ts` (e.g., "12.5h", "3.2d") — components are display-only.
- No emoji in UI.
- `font-mono` for all numeric values.
- Tier badge/color mapping defined per-component (not a shared util — simple enough).

## Environment variables
| Variable | Purpose | Required |
|---|---|---|
| `GITHUB_TOKEN` | GitHub PAT for authenticated API (5000 req/hr vs 60 unauth) | Strongly recommended |

Set in `.env.local` locally. Set in Vercel dashboard for production. No special scopes needed for public repos.

## Open questions / parked items
- **MTTR N/A for k8s** — kubernetes uses `kind/bug` label, not `bug`. MTTR shows N/A. Honest for v1; could add multi-label support.
- **Lead Time is a sample** — computed from 100 most-recently-merged PRs, not all. Representative sample for high-volume repos. Acceptable for v1.
- **Velocity chart sparkline vs exact counts** — sparkline uses sampled PRs (indicative shape), 4w/8w comparison uses exact API counts. Fine for v1.
- **LinkedIn URL** — hardcoded as `linkedin.com/in/karthikpoojary` in footer. Verify this is the correct slug.
- **Gerrit review response time** — returns N/A because public Gerrit REST API doesn't expose reviewer timeline without auth. Could add OAuth Gerrit auth later.
- **Vercel preview env GITHUB_TOKEN** — only set in production; preview deploys use unauthenticated GitHub API (60 req/hr). Fine for now.

## Next steps
- Verify LinkedIn URL slug is correct
- Add a screenshot to README once a good viewport capture is taken
- Consider adding GitHub Actions deployment data for more accurate Deploy Frequency

## Session log

### 2026-05-27
- Scaffolded Next.js 16.2.6 with TypeScript, Tailwind v4, App Router
- Installed Recharts
- Read Next.js 16 breaking changes: `searchParams`/`params` are Promises; fetch caching unchanged
- Created `types/metrics.ts`, `lib/github.ts` (full GitHub API client + metric computations)
- Created all components: RepoPicker, MetricCard, MetricTooltip, SkeletonCard, HealthScore, VelocityChart, MetricsDashboard
- Rewrote `app/page.tsx`, updated `app/layout.tsx` metadata
- Created GitHub repo (KarthikPoojary/delivery-lens), pushed all code
- Wrote full README with DORA framing, TPM context, metric explanations, design decisions
- Removed scaffold leftovers (5 SVGs, AGENTS.md)
- Fixed 3 metric accuracy bugs found during live data verification:
  - MTTR: changed to `created:>date` query to avoid ancient bug resolutions inflating median
  - CFR: split into 3 separate keyword searches (was treating revert+hotfix+rollback as AND)
  - Velocity: replaced `merged:<date` range with two cumulative counts + subtraction (URL encoding bug)
- Verified live metric values against GitHub API for all 3 preset repos
