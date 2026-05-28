# SMU Career Companion

> *The job market doesn't wait. Neither should your prep.*

A career intelligence platform built exclusively for SMU Masters students — combining AI-powered interview preparation, live Singapore job listings, and curated GitHub resources into one personalised pipeline.

---

## What It Does

Most career tools are generic. This one isn't. SMU Career Companion reads your programme, target role, and skills profile to surface content that's actually relevant to where you're going — not where everyone else is.

**Interview Prep**
Generate 20 personalised interview questions grounded in your saved GitHub repos and target role. Export a full prep guide as PDF or JSON. Track your practice progress question by question.

**Job Board**
Search live Singapore job listings pulled from MyCareersFuture (official Singapore government jobs API) and Indeed. Save applications directly to a personal tracker with status tracking — from first application to offer.

**GitHub Resource Sweeper**
Search public GitHub repos matched to your programme and target role. Save repos to your portfolio — each saved repo is deeply enriched via AI: README analysis, core concepts, difficulty scoring, and interview talking points extracted automatically.

**Job Displacement Risk Score**
Get a data-driven displacement risk score (0–100) based on your current role, target industry, and skills profile — grounded in WEF Future of Jobs 2025 and Singapore MAS/MTI labour market data. Includes a personalised action plan.

**Multi-Profile System**
Create up to 5 career profiles for different job contexts — activate the right one for each application without losing the others.

---

## Built For

All SMU Masters programmes:

- Master of IT in Business (MITB) — Analytics & AI tracks
- Master of Science in Business AI (MBAI)
- MSc Finance
- MSc Accounting
- MSc Marketing
- MSc Management
- MSc Economics
- MSc Computational Finance
- Master of Laws (LLM)
- MSc Organisational Behaviour & Human Resources

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI | Claude API (claude-sonnet-4-20250514) |
| Job Data | MyCareersFuture API + Indeed Publisher API |
| Repo Data | GitHub REST API v3 |
| Storage | localStorage (MVP) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub Personal Access Token (for GitHub API)
- An Anthropic API key (for Claude)
- MyCareersFuture / Indeed API credentials

### Installation

```bash
git clone https://github.com/KeziahVickraman/smu-masters-career-app.git
cd smu-masters-career-app
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# GitHub API
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Job APIs
MYCAREERSFUTURE_API_KEY=xxxxxxxxxxxx
INDEED_PUBLISHER_ID=xxxxxxxxxxxx
```

> ⚠️ Never commit `.env.local` — it is gitignored by default.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
smu_masters_career_app/
├── app/
│   ├── api/
│   │   ├── github/
│   │   │   ├── search/         # GitHub repo search
│   │   │   ├── summarise/      # AI repo summarisation
│   │   │   └── enrich/         # Deep repo enrichment pipeline
│   │   ├── interview/
│   │   │   └── questions/      # Personalised question generation
│   │   ├── jobs/               # Job listing aggregation
│   │   └── risk/
│   │       ├── score/          # Displacement risk scoring
│   │       └── explain/        # Claude-powered score explanation
│   ├── dashboard/              # Main dashboard
│   ├── github/                 # GitHub Resource Sweeper
│   ├── interview-prep/         # Interview preparation
│   ├── job-board/              # Job search + application tracker
│   ├── onboarding/             # 3-step profile setup
│   └── profile/                # Multi-profile management
├── components/
│   ├── dashboard/              # Risk score card, activity feed
│   ├── layout/                 # Site header, navigation
│   ├── onboarding/             # Step components
│   └── ui/                     # shadcn/ui components
├── lib/
│   └── risk-scoring.ts         # Deterministic risk scoring logic
├── DESIGN.md                   # Design system and tokens
├── PIPELINE.md                 # Build order and architecture
├── SCHEMA.md                   # User profile field reference
└── schema.json                 # JSON schema for user profiles
```

---

## Key Design Decisions

**Why localStorage for MVP?**
Keeps the architecture simple for initial deployment — no auth, no backend database. The schema is designed for a clean migration to Supabase or PlanetScale when user accounts are introduced.

**Why MyCareersFuture over LinkedIn scraping?**
MyCareersFuture is Singapore's official government jobs portal with a free public API. LinkedIn's ToS prohibits scraping. LinkedIn jobs are supported via manual URL import.

**Why enrichment on save rather than on search?**
Enriching all 12 search results at once would hit GitHub and Claude API rate limits immediately. Enrichment is triggered only when a user saves a repo — making each API call intentional and user-driven.

**Why deterministic risk scoring?**
The displacement score in `lib/risk-scoring.ts` uses a pure TypeScript function with no randomness — same inputs always return the same score. Claude is used only for the *explanation* of the score, not the score itself.

---

## Roadmap

- [ ] User authentication (Supabase)
- [ ] RAG pipeline with vector DB (Supabase pgvector)
- [ ] Company document ingestion (annual reports, filings)
- [ ] YouTube / podcast resource feed
- [ ] Mobile responsive layout
- [ ] Cohort features (share prep guides with classmates)
- [ ] SMU Career Connect integration

---

## Contributing

This project is currently in active development. If you're an SMU Masters student and want to contribute or provide feedback, please open an issue.

---

## Disclaimer

Job displacement risk scores are indicative only, based on publicly available labour market research (WEF Future of Jobs 2025, MAS, MTI Singapore). They are not a substitute for professional career advice.

---

*Built by Keziah Vickraman · SMU MBAI 2026 · Singapore*
