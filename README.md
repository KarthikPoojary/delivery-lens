# Delivery Lens

**A DORA-aligned engineering health dashboard for any public GitHub repository.**

Live demo: https://delivery-lens.vercel.app

---

## Why this exists

Technical Program Managers are accountable for more than shipping on time — they are expected to *develop, build, and evolve metrics with reliable supporting datasets* that help engineering leaders make decisions with confidence. In practice, that means knowing whether a team is accelerating or accumulating risk, and being able to explain the difference to a VP or a peer who doesn't live in the codebase.

Delivery Lens was built to answer one question quickly: **is this engineering team healthy right now, and where is the friction?** It pulls live data from the GitHub REST API and presents five DORA-aligned metrics — the same framework Google's DevOps Research and Assessment team uses to benchmark software delivery performance — in a single view that a TPM, engineering director, or skip-level can read in under a minute.

This is a portfolio project demonstrating applied TPM skills: metric selection and definition, data pipeline design, and the ability to translate raw developer activity into actionable signals.

---

## Screenshot

*Screenshot will be added after production deployment.*

---

## The five metrics

Each metric is computed from the last 90 days of public GitHub activity and assigned a performance tier: **Elite**, **High**, **Medium**, or **Low**.

### 1. Deployment Frequency
**What it measures:** How many releases or tags the repository has published in the last 90 days.

**Why it matters to a TPM:** Deployment frequency is the single best leading indicator of team agility. Teams that ship frequently get faster feedback, take smaller risks per release, and recover from mistakes sooner. A Low score here almost always precedes problems with the other four metrics. If you are planning a roadmap and the team ships twice a quarter, plan accordingly.

| Tier | Threshold |
|------|-----------|
| Elite | 30+ releases |
| High | 10–29 releases |
| Medium | 2–9 releases |
| Low | Fewer than 2 releases |

---

### 2. Lead Time for Changes
**What it measures:** Median time from pull request creation to merge, for all merged PRs in the last 90 days.

**Why it matters to a TPM:** Lead time is a proxy for review process health. Long lead times mean code is sitting in queues — waiting for reviewers, blocked on CI, or caught in long feedback loops. It also limits how quickly the team can respond to an incident or a priority change. A High or Elite score here means the team has healthy review norms and fast CI.

| Tier | Threshold |
|------|-----------|
| Elite | Under 24 hours |
| High | Under 1 week (168h) |
| Medium | Under 1 month (720h) |
| Low | Over 1 month |

---

### 3. Change Failure Rate
**What it measures:** Percentage of merged PRs whose title contains "revert", "hotfix", or "rollback" — a signal that a previous change caused a production problem.

**Why it matters to a TPM:** CFR directly reflects quality and testing practices. A rising CFR means the team is shipping faster than their safety net can catch problems. It also has downstream cost: every hotfix consumes capacity that was not in the roadmap. As a TPM, a High CFR is a conversation to have about test coverage, staging environments, and release gating.

| Tier | Threshold |
|------|-----------|
| Elite | 0–15% |
| High | 16–30% |
| Medium | 31–45% |
| Low | Over 45% |

---

### 4. Mean Time to Restore
**What it measures:** Median time from a GitHub issue labeled "bug" being opened to being closed, for issues resolved in the last 90 days.

**Why it matters to a TPM:** MTTR is a measure of incident response capability. It reflects on-call process maturity, observability tooling, and how well the team understands their own system. Long MTTR means users are experiencing degraded service for longer, and teams are spending unplanned capacity on firefighting. Short MTTR means the team can detect, diagnose, and ship a fix quickly.

| Tier | Threshold |
|------|-----------|
| Elite | Under 1 day |
| High | Under 1 week |
| Medium | Under 1 month |
| Low | Over 1 month |

---

### 5. Velocity Trend
**What it measures:** Merged PRs per week over the last 12 weeks, compared as recent 4-week average vs prior 8-week average.

**Why it matters to a TPM:** An absolute velocity number is hard to interpret without context. Velocity trend tells you the direction: is the team accelerating, holding steady, or slowing down? Sustained decline often signals growing tech debt, team attrition, or scope creep. A spike can mean a sprint push — useful to know before planning the next quarter. This metric is the one to watch when a team has just undergone a reorganisation or started a new programme.

| Tier | Threshold |
|------|-----------|
| Elite | More than +10% vs prior period |
| High | -5% to +10% (stable) |
| Medium | -20% to -5% (mild decline) |
| Low | More than -20% decline |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Data | GitHub REST API (live, no database) |
| Auth | GitHub Personal Access Token (server-side only) |
| Hosting | Vercel (Hobby tier) |
| Caching | Next.js fetch cache, 1-hour revalidation |

---

## Local development

**Prerequisites:** Node.js 18+, a GitHub Personal Access Token.

```bash
git clone https://github.com/KarthikPoojary/delivery-lens
cd delivery-lens
npm install
cp .env.local.example .env.local
# Edit .env.local and add your GITHUB_TOKEN
npm run dev
```

Open http://localhost:3000. Click a preset repo or enter any `owner/repo` in the input.

**Creating a GitHub token:**
Go to https://github.com/settings/tokens, create a classic token with no special scopes (public repository access requires none). Without a token the app falls back to 60 unauthenticated requests per hour, which exhausts quickly during development.

---

## Design decisions

**Why DORA?**
The DORA framework (from Google's DevOps Research and Assessment programme) is the most widely validated model for measuring software delivery performance. It is the same framework used internally at Google and cited in the *Accelerate* book. Framing metrics around an established model means results are comparable across teams and organisations, not just internally meaningful.

**Why these five metrics specifically?**
The first four (Deployment Frequency, Lead Time, Change Failure Rate, Mean Time to Restore) are the canonical DORA four. Velocity Trend was added as a fifth signal because it surfaces directional change — a team can score High on the other four while quietly slowing down, which DORA alone won't catch.

**Why a 90-day window?**
Short enough to be current; long enough to smooth out sprint-cycle noise and one-off events. A single week of low activity (a holiday, an all-hands) should not mislead.

**Why server-side GitHub authentication?**
The GitHub token never leaves the server. The API route does not exist — `lib/github.ts` is called directly from an async Server Component, which means the token is only ever read in the Next.js Node.js runtime on the server, not bundled into client JavaScript.

**Why no database?**
The entire value of this tool comes from live data. A database would add latency, maintenance overhead, and data freshness risk. Next.js fetch-level caching (1-hour `revalidate`) provides the right tradeoff: fast repeated loads without stale data risk.

---

## Preset repositories

The three built-in presets were chosen to demonstrate the tool across different organisational scales and activity levels:

| Repo | Why it's a good demo |
|------|---------------------|
| `vercel/next.js` | High-velocity open source project, many contributors, frequent releases |
| `supabase/supabase` | Fast-growing product, mix of feature work and bug fixing |
| `kubernetes/kubernetes` | Extremely high volume, enterprise-grade processes, interesting CFR and MTTR patterns |

The app also accepts any public GitHub repository via the custom input.

---

## Roadmap

- Add a screenshot and live demo link once deployed
- Export metric snapshot as a shareable image (for slide decks)
- Side-by-side repo comparison view
- Historical trend view (how has this repo's health changed over 6 months?)
- Support for GitLab and Bitbucket repositories

---

## About

Built by [Karthik Poojary](https://github.com/KarthikPoojary) as part of a portfolio of TPM-focused engineering tools.

This project is one of three portfolio pieces demonstrating applied technical programme management skills: metric definition, data system design, and the ability to surface engineering signals for non-technical stakeholders.
