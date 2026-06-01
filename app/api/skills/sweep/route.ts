import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ── Exported types ─────────────────────────────────────────────────────────────

export interface TrendingSkill {
  skill: string;
  frequency: number;
  source: "github" | "jobs" | "both";
  momentum: "Rising" | "Stable" | "Declining";
}

export interface SkillsSweepResult {
  trending_skills: TrendingSkill[];
  /** Top 5 non-negotiable skills for this role right now */
  must_have: string[];
  /** Skills appearing more in the last 3 months — future demand signal */
  emerging: string[];
  /** Skills losing frequency — still useful but not differentiating */
  declining: string[];
  /** Skills that appear disproportionately in Singapore listings vs global */
  singapore_specific: string[];
  /** User's skills that match trending skills */
  your_strengths: string[];
  /** Trending skills the user does not have */
  your_gaps: string[];
  /** User's skills that are emerging — ahead of the curve */
  value_makers: string[];
}

export interface SkillsSweepMeta {
  github_repo_count: number;
  job_listing_count: number;
  target_role: string;
  /** True when MyCareersFuture returned no usable listings */
  jobs_unavailable: boolean;
}

export interface SkillsSweepResponse {
  result: SkillsSweepResult;
  meta: SkillsSweepMeta;
}

// ── Request type ───────────────────────────────────────────────────────────────

interface SweepRequest {
  target_role?: string;
  target_industry?: string;
  programme?: string;
  skills_self_reported?: Record<string, string[]>;
}

// ── GitHub: Source A — topic aggregation ─────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function roleSearchQuery(targetRole: string, programme: string): string {
  const parts = targetRole
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (parts.length > 0) return parts.join(" ");
  return programme.replace(/_/g, " ").trim();
}

interface GitHubTopicData {
  repoCount: number;
  topicFreq: Record<string, number>;
}

// Search GitHub for repos matching the role; aggregate topic tags across the
// top 30 by stars. Topic frequency ≈ what the OSS community ties to this role.
async function fetchGitHubTopics(
  query: string,
  token: string,
): Promise<GitHubTopicData> {
  if (!query.trim()) return { repoCount: 0, topicFreq: {} };

  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "30");

  try {
    const res = await fetch(url.toString(), {
      headers: ghHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return { repoCount: 0, topicFreq: {} };

    const json = (await res.json()) as {
      items?: Array<{ topics?: string[] }>;
    };
    const items = json.items ?? [];

    const topicFreq: Record<string, number> = {};
    for (const item of items) {
      for (const topic of item.topics ?? []) {
        const key = topic.trim().toLowerCase();
        if (!key) continue;
        topicFreq[key] = (topicFreq[key] ?? 0) + 1;
      }
    }
    return { repoCount: items.length, topicFreq };
  } catch {
    return { repoCount: 0, topicFreq: {} };
  }
}

// ── MyCareersFuture: Source B — live Singapore job listings ──────────────────────

interface JobMarketData {
  jobCount: number;
  titles: string[];
  skillFreq: Record<string, number>;
}

// MyCareersFuture exposes a public, key-less search API (POST JSON body) — no key
// needed. Pull the top 20 live listings and harvest skill signals from titles and
// any per-posting `skills` array the API returns.
async function fetchJobMarket(query: string): Promise<JobMarketData> {
  if (!query.trim()) return { jobCount: 0, titles: [], skillFreq: {} };

  const baseUrl = (
    process.env.MCF_API_BASE_URL ||
    process.env.MYCAREERSFUTURE_BASE_URL ||
    "https://api.mycareersfuture.gov.sg/v2"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/search?limit=20&page=0`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ search: query }),
      cache: "no-store",
    });
    if (!res.ok) return { jobCount: 0, titles: [], skillFreq: {} };

    const json = (await res.json()) as { results?: unknown[] };
    const rows = Array.isArray(json.results) ? json.results : [];

    const titles: string[] = [];
    const skillFreq: Record<string, number> = {};

    for (const row of rows) {
      const r = row as {
        title?: string;
        skills?: Array<string | { skill?: string; name?: string }>;
      };
      if (typeof r.title === "string" && r.title.trim()) {
        titles.push(r.title.trim());
      }
      for (const s of r.skills ?? []) {
        const name = typeof s === "string" ? s : s?.skill ?? s?.name;
        if (typeof name === "string" && name.trim()) {
          const key = name.trim();
          skillFreq[key] = (skillFreq[key] ?? 0) + 1;
        }
      }
    }

    return { jobCount: rows.length, titles, skillFreq };
  } catch {
    return { jobCount: 0, titles: [], skillFreq: {} };
  }
}

// ── Prompt building ──────────────────────────────────────────────────────────────

function freqLines(freq: Record<string, number>): string {
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "(none)";
  return entries.map(([name, count]) => `- ${name} (x${count})`).join("\n");
}

const SYSTEM_PROMPT =
  "You are a career intelligence analyst for Singapore's job market. Given these skill frequencies extracted from GitHub repos and live Singapore job listings for this role, return JSON only:\n" +
  "{\n" +
  "trending_skills: { skill: string, frequency: number, source: github|jobs|both, momentum: Rising|Stable|Declining }[],\n" +
  "must_have: string[] (top 5 non-negotiable skills for this role right now),\n" +
  "emerging: string[] (skills appearing more in last 3 months, signal of future demand),\n" +
  "declining: string[] (skills losing frequency, still useful but not differentiating),\n" +
  "singapore_specific: string[] (skills that appear disproportionately in Singapore listings vs global),\n" +
  "your_strengths: string[] (skills from user profile that match trending skills),\n" +
  "your_gaps: string[] (trending skills the user does not have),\n" +
  "value_makers: string[] (skills user has that are emerging — ahead of the curve)\n" +
  "}";

// ── Validation ───────────────────────────────────────────────────────────────────

const SOURCES = ["github", "jobs", "both"] as const;
const MOMENTA = ["Rising", "Stable", "Declining"] as const;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function normaliseResult(raw: unknown): SkillsSweepResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  const trending: TrendingSkill[] = Array.isArray(r.trending_skills)
    ? (r.trending_skills as unknown[])
        .map((item) => {
          const t = (item ?? {}) as Record<string, unknown>;
          const skill = typeof t.skill === "string" ? t.skill : "";
          const frequency =
            typeof t.frequency === "number" ? t.frequency : Number(t.frequency) || 0;
          const source = SOURCES.includes(t.source as (typeof SOURCES)[number])
            ? (t.source as TrendingSkill["source"])
            : "both";
          const momentum = MOMENTA.includes(t.momentum as (typeof MOMENTA)[number])
            ? (t.momentum as TrendingSkill["momentum"])
            : "Stable";
          return { skill, frequency, source, momentum };
        })
        .filter((t) => t.skill)
    : [];

  return {
    trending_skills: trending,
    must_have: asStringArray(r.must_have).slice(0, 5),
    emerging: asStringArray(r.emerging),
    declining: asStringArray(r.declining),
    singapore_specific: asStringArray(r.singapore_specific),
    your_strengths: asStringArray(r.your_strengths),
    your_gaps: asStringArray(r.your_gaps),
    value_makers: asStringArray(r.value_makers),
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: SweepRequest;
  try {
    body = (await req.json()) as SweepRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    target_role = "",
    target_industry = "",
    programme = "",
    skills_self_reported = {},
  } = body;

  const hasToken = !!(githubToken && githubToken !== "your_github_token_here");
  const githubQuery = roleSearchQuery(target_role, programme);
  const jobQuery = [target_role, target_industry].filter(Boolean).join(" ");

  // Source A and Source B in parallel.
  const [github, jobs] = await Promise.all([
    hasToken
      ? fetchGitHubTopics(githubQuery, githubToken!)
      : Promise.resolve<GitHubTopicData>({ repoCount: 0, topicFreq: {} }),
    fetchJobMarket(jobQuery),
  ]);

  const jobsUnavailable = jobs.jobCount === 0;

  // If neither source returned anything there's nothing to analyse.
  if (github.repoCount === 0 && jobsUnavailable) {
    return NextResponse.json(
      {
        error:
          "No market data available — GitHub and MyCareersFuture both returned no results for this role.",
      },
      { status: 502 },
    );
  }

  const userSkills = Object.values(skills_self_reported).flat();

  const dataBlock = [
    `Target role: ${target_role || "(unspecified)"}`,
    `Target industry: ${target_industry || "(unspecified)"}`,
    `Programme: ${programme || "(unspecified)"}`,
    "",
    `GitHub topic frequencies (aggregated across ${github.repoCount} top repositories matching this role):`,
    freqLines(github.topicFreq),
    "",
    jobsUnavailable
      ? "Singapore job listings: NONE AVAILABLE — MyCareersFuture returned no results. Base the analysis on GitHub data only, note that Singapore-specific signal is limited, and keep singapore_specific minimal or empty."
      : `Singapore job listings (${jobs.jobCount} live MyCareersFuture postings for this role + industry). Job titles:\n${jobs.titles.map((t) => `- ${t}`).join("\n")}`,
    jobsUnavailable || Object.keys(jobs.skillFreq).length === 0
      ? ""
      : `\nJob skill keyword frequencies:\n${freqLines(jobs.skillFreq)}`,
    "",
    `User's self-reported skills: ${userSkills.length > 0 ? userSkills.join(", ") : "(none reported)"}`,
  ].join("\n");

  const client = new Anthropic({ apiKey: anthropicKey });

  let rawText = "";
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${dataBlock}\n\nReturn the JSON object only — no markdown fences, no prose. frequency must be a number. source must be one of github, jobs, both. momentum must be one of Rising, Stable, Declining.`,
        },
      ],
    });

    const block = message.content[0];
    rawText = block.type === "text" ? block.text : "";
  } catch (err) {
    return NextResponse.json(
      { error: `Claude API error: ${String(err)}` },
      { status: 502 },
    );
  }

  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: "Claude returned malformed JSON." },
      { status: 502 },
    );
  }

  const result = normaliseResult(parsed);

  const response: SkillsSweepResponse = {
    result,
    meta: {
      github_repo_count: github.repoCount,
      job_listing_count: jobs.jobCount,
      target_role,
      jobs_unavailable: jobsUnavailable,
    },
  };

  return NextResponse.json(response);
}
