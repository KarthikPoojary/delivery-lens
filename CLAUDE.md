# Delivery Lens
*Last updated: 2026-05-27 (Claude session)*

## One-sentence pitch
A single-page TPM tool that shows DORA-aligned engineering health metrics for any public GitHub repository.

## Current status
- **Works:** Full project scaffold complete. All source files written.
- **Not yet verified:** App has not been started and tested in browser. TypeScript compilation not checked.
- **Partially built:** README.md not yet written (placeholder from scaffold).
- **Last worked on:** Initial scaffold + all source files written (2026-05-27).

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
- **README.md** not yet written — needs pitch, why-it-exists, screenshot, live demo URL, metrics explained, tech stack, local dev, design decisions, roadmap.
- **TypeScript strict check** — `tsc --noEmit` not yet run. Do before deploying.
- **Velocity tier thresholds** — custom values (+10%=Elite, -5%=High, -20%=Medium). Not from official DORA research. Flag in README.
- **Tag fallback date filtering** — tags endpoint has no date filter; deployment freq via tags is approximate. Consider noting in UI.
- **kubernetes/kubernetes scale** — Search API returns max 100 items; metrics computed from a sample for very active repos.
- **LinkedIn URL** — hardcoded as `linkedin.com/in/karthikpoojary` in footer. Verify before deploying.

## Next steps
1. `npm run dev` — verify app renders and all three preset repos load correctly
2. Add `GITHUB_TOKEN` to `.env.local`
3. Run `npx tsc --noEmit` — fix any type errors
4. Write `README.md` per the spec
5. Push to github.com/KarthikPoojary/delivery-lens
6. Deploy to Vercel, set `GITHUB_TOKEN` in dashboard
7. Add screenshot to README after deployment

## Session log

### 2026-05-27
- Scaffolded Next.js 16.2.6 with TypeScript, Tailwind v4, App Router
- Installed Recharts
- Read Next.js 16 breaking changes: `searchParams`/`params` are Promises; fetch caching unchanged
- Created `types/metrics.ts`, `lib/github.ts` (full GitHub API client + metric computations)
- Created all components: RepoPicker, MetricCard, MetricTooltip, SkeletonCard, HealthScore, VelocityChart, MetricsDashboard
- Rewrote `app/page.tsx`, updated `app/layout.tsx` metadata
- Created `.env.local.example`
- Decided: no API route; lib called directly from async Server Component
- Decided: Suspense `key={repo}` pattern for re-suspension on repo change
