import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ── Exported types ─────────────────────────────────────────────────────────────

export interface RepoEnrichment {
  summary: string;
  core_concepts: string[];
  tools_and_technologies: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimated_hours_to_complete: number;
  interview_talking_points: string[];
  portfolio_strength: "Low" | "Medium" | "High";
  why_relevant: string;
}

// ── Request type ───────────────────────────────────────────────────────────────

interface EnrichRequest {
  owner: string;
  repo: string;
  stars?: number;
  language?: string | null;
  description?: string | null;
  topics?: string[];
  url?: string;
  userProfile?: {
    programme?: string;
    target_role?: string;
    current_role?: string;
    target_industry?: string;
    skills_self_reported?: Record<string, string[]>;
  };
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchReadme(fullName: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/readme`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") return "";
    return Buffer.from(data.content, "base64").toString("utf-8").slice(0, 4000);
  } catch {
    return "";
  }
}

async function fetchCommitInfo(
  fullName: string,
  token: string,
): Promise<{ lastCommitDate: string; recentFiles: string[] }> {
  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${fullName}/commits?per_page=1`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!listRes.ok) return { lastCommitDate: "", recentFiles: [] };

    const commits = (await listRes.json()) as Array<{
      sha: string;
      commit: { committer?: { date?: string } };
    }>;
    if (!commits.length) return { lastCommitDate: "", recentFiles: [] };

    const { sha, commit } = commits[0];
    const lastCommitDate = commit.committer?.date ?? "";

    const detailRes = await fetch(
      `https://api.github.com/repos/${fullName}/commits/${sha}`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!detailRes.ok) return { lastCommitDate, recentFiles: [] };

    const detail = (await detailRes.json()) as {
      files?: Array<{ filename: string }>;
    };
    const recentFiles = (detail.files ?? []).slice(0, 5).map((f) => f.filename);

    return { lastCommitDate, recentFiles };
  } catch {
    return { lastCommitDate: "", recentFiles: [] };
  }
}

async function fetchContributorCount(
  fullName: string,
  token: string,
): Promise<number> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/contributors?per_page=100&anon=false`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as unknown[];
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
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

  let body: EnrichRequest;
  try {
    body = (await req.json()) as EnrichRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    owner,
    repo,
    stars,
    language,
    description,
    topics = [],
    url,
    userProfile,
  } = body;

  if (!owner?.trim() || !repo?.trim()) {
    return NextResponse.json(
      { error: "owner and repo are required." },
      { status: 400 },
    );
  }

  const fullName = `${owner}/${repo}`;
  const hasToken = !!(githubToken && githubToken !== "your_github_token_here");

  // Fetch GitHub data — README and contributors run in parallel with commit info
  const [readme, commitInfo, contributorCount] = await Promise.all([
    hasToken ? fetchReadme(fullName, githubToken!) : Promise.resolve(""),
    hasToken
      ? fetchCommitInfo(fullName, githubToken!)
      : Promise.resolve({ lastCommitDate: "", recentFiles: [] }),
    hasToken
      ? fetchContributorCount(fullName, githubToken!)
      : Promise.resolve(0),
  ]);

  // Build repo context string for Claude
  const repoContext = [
    `Repository: ${fullName}`,
    `URL: ${url ?? `https://github.com/${fullName}`}`,
    `Description: ${description ?? "(no description)"}`,
    `Primary language: ${language ?? "unknown"}`,
    `Stars: ${stars != null ? stars.toLocaleString() : "unknown"}`,
    `Topics: ${topics.length > 0 ? topics.join(", ") : "none"}`,
    `Contributors: ${contributorCount > 0 ? String(contributorCount) : "unknown"}`,
    `Last commit: ${
      commitInfo.lastCommitDate
        ? new Date(commitInfo.lastCommitDate).toLocaleDateString("en-SG")
        : "unknown"
    }`,
    `Recently modified files: ${
      commitInfo.recentFiles.length > 0
        ? commitInfo.recentFiles.join(", ")
        : "unknown"
    }`,
    `README excerpt:\n${readme || "(no README available)"}`,
  ].join("\n");

  const profileContext = userProfile
    ? [
        "User profile:",
        `- Programme: ${userProfile.programme ?? "unknown"}`,
        `- Current role: ${userProfile.current_role ?? "unknown"}`,
        `- Target role: ${userProfile.target_role ?? "unknown"}`,
        `- Target industry: ${userProfile.target_industry ?? "unknown"}`,
        `- Skills: ${
          Object.values(userProfile.skills_self_reported ?? {})
            .flat()
            .join(", ") || "none listed"
        }`,
      ].join("\n")
    : "";

  const client = new Anthropic({ apiKey: anthropicKey });

  let rawText = "";
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system:
        "You are a technical career coach. Given this GitHub repository's README, file structure, topics and languages, extract the following and return JSON only — no markdown, no prose outside the JSON object.",
      messages: [
        {
          role: "user",
          content: `${profileContext ? profileContext + "\n\n" : ""}${repoContext}

Return a JSON object with exactly these keys:
{
  "summary": "<3 sentences max: what the repo does and what you learn>",
  "core_concepts": ["<concept 1>", "<concept 2>", "..."],
  "tools_and_technologies": ["<tool 1>", "<tool 2>", "..."],
  "difficulty": "<Beginner|Intermediate|Advanced>",
  "estimated_hours_to_complete": <number>,
  "interview_talking_points": ["<specific thing 1>", "...", "<up to 5 things the user could speak to in an interview>"],
  "portfolio_strength": "<Low|Medium|High>",
  "why_relevant": "<1 sentence linking this repo to the user's target role>"
}`,
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

  // Strip any accidental markdown fences
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: RepoEnrichment;
  try {
    parsed = JSON.parse(jsonText) as RepoEnrichment;
  } catch {
    parsed = {
      summary: rawText.slice(0, 300),
      core_concepts: [],
      tools_and_technologies: topics,
      difficulty: "Intermediate",
      estimated_hours_to_complete: 20,
      interview_talking_points: [],
      portfolio_strength: "Medium",
      why_relevant: "",
    };
  }

  // Validate enum fields
  const validDifficulties = ["Beginner", "Intermediate", "Advanced"] as const;
  if (!validDifficulties.includes(parsed.difficulty)) {
    parsed.difficulty = "Intermediate";
  }

  const validStrengths = ["Low", "Medium", "High"] as const;
  if (!validStrengths.includes(parsed.portfolio_strength)) {
    parsed.portfolio_strength = "Medium";
  }

  // Ensure arrays
  if (!Array.isArray(parsed.core_concepts)) parsed.core_concepts = [];
  if (!Array.isArray(parsed.tools_and_technologies))
    parsed.tools_and_technologies = [];
  if (!Array.isArray(parsed.interview_talking_points))
    parsed.interview_talking_points = [];

  return NextResponse.json(parsed);
}
