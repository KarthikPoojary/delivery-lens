# Delivery Lens

**A DORA-aligned engineering health dashboard for GitHub and Gerrit projects.**

**Live demo: https://delivery-lens.vercel.app**

---

## Why this exists

Technical Program Managers are accountable for more than shipping on time — they are expected to *develop, build, and evolve metrics with reliable supporting datasets* that help engineering leaders make decisions with confidence. In practice, that means knowing whether a team is accelerating or accumulating risk, and being able to explain the difference to a VP or a peer who doesn't live in the codebase.

Delivery Lens answers one question quickly: **is this engineering team healthy right now, and where is the friction?** It pulls live data from the GitHub REST API or any public Gerrit instance and presents DORA-aligned metrics — the same framework Google's DevOps Research and Assessment team uses to benchmark software delivery performance — in a single view that a TPM, engineering director, or skip-level can read in under a minute.

This is a portfolio project demonstrating applied TPM skills: metric selection and definition, data pipeline design, and the ability to translate raw developer activity into actionable signals.

---

## Features

- **Two source types:** GitHub repositories and Gerrit code review systems (googlesource.com)
- **DORA metrics:** Deployment Frequency, Lead Time for Changes, Change Failure Rate, Mean Time to Restore, Velocity Trend
- **Process Health metrics:** Review Response Time, Open Bug Backlog, Active Contributors
- **Performance tiers:** Elite / High / Medium / Low with DORA benchmark context on every metric
- **Velocity chart:** 12-week merged PR/CL sparkline with trend comparison
- **Preset repos:** Google-stack presets on both tabs for instant demo
- **Custom input:** Any public `owner/repo` (GitHub) or `instance/project` (Gerrit)
- **No database:** Live data from APIs, 1-hour server-side cache via Next.js fetch

---

## Preset repositories

### GitHub tab
| Repo | Context |
|------|---------|
| `kubernetes/kubernetes` | GKE · Container orchestration — high volume, enterprise-grade process |
| `grpc/grpc` | gRPC · Underpins all GCP APIs — polyglot, disciplined release cadence |
| `istio/istio` | Anthos · Service mesh — active contributor base, frequent point releases |

### Gerrit tab
| Project | Context |
|---------|---------|
| `chromium-review / chromium/src` | Google Chrome — one of the largest and most active Gerrit monorepos |
| `fuchsia-review / fuchsia` | Google Fuchsia OS — modern microkernel, strict review SLAs |
| `dart-review / sdk` | Dart SDK · Flutter — high CL velocity, strong revert discipline |

---

## The metrics

### DORA — Delivery Performance

Each metric covers the last 90 days and is assigned a tier: **Elite**, **High**, **Medium**, or **Low**.

#### 1. Deployment Frequency
How many releases or tags shipped in the last 90 days. The single best leading indicator of team agility — teams that ship frequently take smaller risks per release and recover from mistakes faster.

| Tier | Threshold |
|------|-----------|
| Elite | 30+ releases |
| High | 10–29 |
| Medium | 2–9 |
| Low | < 2 |

#### 2. Lead Time for Changes
Median time from PR/CL creation to merge. Long lead time means code is sitting in queues — waiting for reviewers, blocked on CI, or caught in long feedback loops.

| Tier | Threshold |
|------|-----------|
| Elite | < 24 hours |
| High | < 1 week |
| Medium | < 1 month |
| Low | > 1 month |

#### 3. Change Failure Rate
Percentage of merged changes that were reverts or hotfixes — a signal that a previous change caused a production problem. Rising CFR is a conversation about test coverage, staging environments, and release gating.

| Tier | Threshold |
|------|-----------|
| Elite | 0–15% |
| High | 16–30% |
| Medium | 31–45% |
| Low | > 45% |

#### 4. Mean Time to Restore *(GitHub only)*
Median time from a "bug" issue being opened to closed. Reflects incident response capability, observability tooling, and system understanding. Shown as N/A for Gerrit (bug tracking is external).

| Tier | Threshold |
|------|-----------|
| Elite | < 1 day |
| High | < 1 week |
| Medium | < 1 month |
| Low | > 1 month |

#### 5. Velocity Trend
Merged PRs/CLs per week: recent 4-week average vs prior 8-week average. Surfaces directional change — a team can score High on the DORA four while quietly slowing down.

| Tier | Threshold |
|------|-----------|
| Elite | > +10% vs prior period |
| High | -5% to +10% (stable) |
| Medium | -20% to -5% (mild decline) |
| Low | > -20% decline |

---

### Process Health — Flow Efficiency

A second layer of signals that a Google-scale TPM uses to identify upstream bottlenecks before they show up in DORA numbers.

| Metric | What it measures | Why it matters |
|--------|-----------------|----------------|
| **Review Response Time** | Median hours from PR creation to first review event (sampled from 20 recent PRs) | Engineers blocked on review is the leading cause of high Lead Time |
| **Open Bug Backlog** | Total open issues currently labeled "bug" | A growing backlog signals defects accumulating faster than the team can address them |
| **Active Contributors** | Unique PR/CL authors in the last 90 days | Proxy for bus factor and knowledge distribution risk |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Data sources | GitHub REST API, Gerrit REST API |
| Auth | GitHub PAT (server-side only, never in client bundle) |
| Hosting | Vercel |
| Caching | Next.js fetch cache, 1-hour revalidation |

---

## Local development

**Prerequisites:** Node.js 18+, a GitHub Personal Access Token.

```bash
git clone https://github.com/KarthikPoojary/delivery-lens
cd delivery-lens
npm install
cp .env.local.example .env.local
# Edit .env.local and set GITHUB_TOKEN
npm run dev
```

Open http://localhost:3000.

**Creating a GitHub token:** Go to https://github.com/settings/tokens, create a classic token. No special scopes needed for public repos. Without a token the app uses 60 unauthenticated requests/hour — fine for light use, exhausts quickly in development.

---

## Design decisions

**Why DORA?**
The DORA framework is the most widely validated model for measuring software delivery performance. It is the same framework used internally at Google and cited in *Accelerate*. Framing metrics around an established model means results are comparable across teams and organisations.

**Why Gerrit in addition to GitHub?**
Google engineers primarily work in Gerrit (Chromium, Fuchsia, Android, internal monorepo). A tool focused on Google-scale delivery should speak the language of Gerrit CLs, not just GitHub PRs. The Gerrit REST API is public for open-source googlesource.com instances.

**Why the Process Health layer?**
The DORA four are lagging indicators — by the time Lead Time or CFR degrades, the problem has been building for weeks. Review Response Time and Bug Backlog are leading indicators: they tell you the upstream conditions that will produce DORA problems if left unaddressed. A Google TPM thinking about programme risk looks at both layers.

**Why server-side GitHub authentication?**
The GitHub token never leaves the server. There is no API route — `lib/github.ts` is called directly from an async Server Component. The token is only read in the Next.js Node.js runtime, never bundled into client JavaScript.

**Why no database?**
Live data is the entire value of this tool. A database adds latency, maintenance overhead, and data freshness risk. Next.js fetch-level caching (1-hour `revalidate`) provides the right tradeoff: fast repeated loads without stale data.

**Why a 90-day window?**
Short enough to be current; long enough to smooth sprint-cycle noise and one-off events. A single week of low activity (a holiday, an all-hands) should not mislead.

---

## Roadmap

- Export metric snapshot as a shareable image (for slide decks and QBRs)
- Side-by-side repo comparison view
- Historical trend: how has this repo's health changed over 6 months?
- Connect GitHub Actions workflow data for more accurate Deployment Frequency
- Support GitLab repositories

---

## About

Built by [Karthik Poojary](https://github.com/KarthikPoojary) as a portfolio project demonstrating applied technical programme management skills: metric definition, data system design, and the ability to surface engineering signals for leadership.
