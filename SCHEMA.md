# USER PROFILE SCHEMA — SMU Career Companion

> Reference this file alongside `schema.json` when building forms, API routes, or any feature that reads/writes user data. All user data must conform to `schema.json`.

---

## Overview

Every user in the app is represented by a single JSON profile object. This object is:
- Built during the **onboarding flow** (3-step form)
- Stored in **localStorage** for MVP (migrate to DB later)
- Passed as context to **every AI call** (interview prep, risk scoring, checklist generation)
- Updated when the user edits their profile

---

## Field Reference

### `user.programme`
Which SMU Masters programme they are enrolled in. This is the most important field — it determines which interview question bank, which GitHub repos, and which displacement risk profile to load.

| Value | Programme | Primary Output Modules |
|---|---|---|
| `MITB_Analytics` | Master of IT in Business (Analytics) | Data roles, analytics interviews, Python/R repos |
| `MITB_AI` | Master of IT in Business (AI) | ML/AI roles, technical interviews, ML repos |
| `MBAI` | Master of Science in Business AI | AI product/strategy roles, hybrid interviews |
| `MSc_Finance` | MSc Finance | Finance/banking interviews, financial report resources |
| `MSc_Accounting` | MSc Accounting | Audit/accounting interviews, Big 4 prep |
| `MSc_Marketing` | MSc Marketing | Marketing analytics, brand strategy interviews |
| `MSc_Management` | MSc Management | Consulting/general management interviews |
| `MSc_Economics` | MSc Economics | Policy, research, quant economics interviews |
| `MSc_Computational_Finance` | MSc Computational Finance | Quant/fintech interviews, coding challenges |
| `LLM` | Master of Laws | Legal interviews, contract/compliance resources |
| `MSc_OBHR` | MSc Organisational Behaviour & HR | HR/people analytics interviews |

---

### `user.interview_stage`
Where the user is in their job search. Drives which interview prep content to surface first.

| Value | Meaning | Content to surface |
|---|---|---|
| `pre` | Haven't started applying yet | Company research, CV prep, skills gap |
| `during` | Actively interviewing | Mock questions, case prep, negotiation |
| `post` | Received offer / finished round | Offer evaluation, onboarding prep |
| `not_interviewing` | Not job hunting right now | Upskilling, project suggestions |

---

### `user.skills_self_reported`
Grouped into 5 categories. Used to:
1. Calculate **skills gap** vs target role requirements
2. Personalise **GitHub repo recommendations** (surface repos matching skills they want to build)
3. Generate **checklist items** for missing skills

**Do not** ask users to rate proficiency level in MVP — binary (have / don't have) is enough.

---

### `assessment_mode`
Controls which pipeline modules run on submission.

| Value | Runs |
|---|---|
| `full` | All modules — risk score, interview prep, checklist, resources |
| `interview_only` | Interview question bank only |
| `skills_only` | Skills gap + checklist only |
| `risk_only` | Job displacement score only |

Default to `full` for new users.

---

### `output_format`
Array of modules to return. Maps directly to dashboard sections:

| Value | Dashboard Section |
|---|---|
| `risk_score` | Job Safety Score card |
| `skills_gap` | Skills Gap breakdown |
| `interview_prep` | Interview Prep page |
| `checklist` | Action Checklist |
| `github_resources` | GitHub Resource Sweeper |
| `job_listings` | Job Board |
| `resource_feed` | YouTube / Podcast feed |

---

## localStorage Structure

For MVP, store the profile under a single key:

```js
localStorage.setItem('smu_career_profile', JSON.stringify(userProfile))
localStorage.getItem('smu_career_profile')
```

When migrating to a database, this key maps 1:1 to a `user_profiles` table row.

---

## Example: Completed Profile Object

```json
{
  "user": {
    "programme": "MBAI",
    "programme_year": "Year 1",
    "current_industry": "Financial Services",
    "target_industry": "Technology",
    "current_role": "Business Analyst",
    "target_role": "AI Product Manager",
    "years_experience": 2,
    "skills_self_reported": {
      "data_and_analytics": ["Python", "SQL", "Excel"],
      "ai_and_ml": ["LLMs / Prompt Engineering", "RAG"],
      "finance": ["Financial Modelling"],
      "technology": ["APIs / REST", "Git"],
      "soft_skills": ["Stakeholder Management", "Data Storytelling"]
    },
    "interview_stage": "pre",
    "target_companies": ["Google", "GIC", "McKinsey"]
  },
  "assessment_mode": "full",
  "output_format": ["risk_score", "skills_gap", "interview_prep", "checklist", "github_resources"],
  "metadata": {
    "created_at": "2026-05-27T10:00:00Z",
    "updated_at": "2026-05-27T10:00:00Z",
    "session_id": "abc123",
    "onboarding_complete": true
  }
}
```

---

## Rules for Cursor

- Every form field in the onboarding flow must map to a field in `schema.json`
- No field should be collected that isn't in the schema
- On onboarding completion, validate the output against `schema.json` before storing
- When making Claude API calls, always pass the full user profile as context
- `target_companies` is optional — do not block onboarding completion if empty

---

*Last updated: May 2026*
