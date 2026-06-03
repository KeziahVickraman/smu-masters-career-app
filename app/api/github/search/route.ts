import { NextRequest, NextResponse } from "next/server";

// ─── Programme → keyword map ────────────────────────────────────────────────
const PROGRAMME_KEYWORDS: Record<string, string[]> = {
  MITB_Analytics:          ["data analytics", "pandas", "sql", "data science"],
  MITB_AI:                 ["machine learning", "deep learning", "neural network"],
  MBAI:                    ["business ai", "llm", "generative ai", "ai product"],
  MSc_Finance:             ["quantitative finance", "financial modelling", "risk"],
  MSc_Accounting:          ["accounting", "audit", "financial reporting"],
  MSc_Marketing:           ["marketing analytics", "customer analytics", "brand"],
  MSc_Management:          ["management consulting", "strategy", "operations"],
  MSc_Economics:           ["economics", "econometrics", "policy analysis"],
  MSc_Computational_Finance: ["quant", "algorithmic trading", "fintech"],
  LLM:                     ["legal tech", "contract analysis", "compliance"],
  MSc_OBHR:                ["people analytics", "hr analytics", "organisational"],
};

// ─── Types ───────────────────────────────────────────────────────────────────
export type GitHubRepo = {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  topics: string[];
  html_url: string;
  language: string | null;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
};

type GitHubSearchItem = {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  html_url: string;
  language: string | null;
};

type GitHubSearchResponse = {
  total_count: number;
  items: GitHubSearchItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function inferDifficulty(
  stars: number,
  openIssues: number,
  forks: number,
): GitHubRepo["difficulty"] {
  // Weight: stars carry the most signal, forks and issues as tiebreakers
  if (stars >= 4000 || (stars >= 2000 && forks >= 500)) return "Advanced";
  if (stars >= 400 || (stars >= 150 && openIssues >= 20)) return "Intermediate";
  return "Beginner";
}

// Generic words that return noisy results — stripped from every query.
const STOPWORDS = new Set([
  "structured",
  "manager",
  "analyst",
  "role",
  "numpy",
]);

// Programmes whose relevant repos are predominantly Python / R / notebook code,
// where a language filter sharpens results. Other programmes skip it.
const DATA_FINANCE_PROGRAMMES = new Set([
  "MITB_Analytics",
  "MITB_AI",
  "MBAI",
  "MSc_Finance",
  "MSc_Computational_Finance",
  "MSc_Economics",
  "MSc_Accounting",
  "MSc_OBHR",
  "MSc_Marketing",
]);

// Finance-leaning programmes anchor the broad fallback query on "finance".
const FINANCE_PROGRAMMES = new Set([
  "MSc_Finance",
  "MSc_Computational_Finance",
  "MSc_Accounting",
  "MSc_Economics",
]);

const LANGUAGE_FILTER =
  "language:python OR language:r OR language:jupyter-notebook";
const STARS_FILTER = "stars:>50";

// Normalise free text into concrete lowercase search words: punctuation
// stripped, single letters (e.g. "r") and generic noise words dropped.
function cleanTerms(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Build 2-3 short, focused base queries (terms only — qualifiers added later).
// GitHub repo search ANDs all terms, so each query stays ≤3 words to avoid the
// over-constrained "matches nothing" problem.
function buildFocusedQueries(
  programme: string,
  targetRole: string,
  skills: string[],
): string[] {
  const queries: string[] = [];

  // Query 1 — target role (≤3 words)
  const roleTerms = cleanTerms(targetRole).slice(0, 3);
  if (roleTerms.length) queries.push(roleTerms.join(" "));

  // Query 2 — top 2 skill words (≤2 words)
  const skillTerms = cleanTerms(skills.join(" ")).slice(0, 2);
  if (skillTerms.length) queries.push(skillTerms.join(" "));

  // Query 3 — leading programme keyword (≤2 words)
  const progKeyword = PROGRAMME_KEYWORDS[programme]?.[0] ?? "";
  const progTerms = cleanTerms(progKeyword).slice(0, 2);
  if (progTerms.length) queries.push(progTerms.join(" "));

  // Drop duplicate/empty queries
  return [...new Set(queries)].filter(Boolean);
}

// Attach quality (and, for data/finance programmes, language) qualifiers.
function withQualifiers(baseQuery: string, programme: string): string {
  const parts = [baseQuery, STARS_FILTER];
  if (DATA_FINANCE_PROGRAMMES.has(programme)) parts.push(LANGUAGE_FILTER);
  return parts.join(" ").trim();
}

async function fetchGitHubPage(
  query: string,
  page: number,
  token: string,
): Promise<GitHubSearchItem[]> {
  // Enforce 500ms stagger between paginated calls via page offset (caller handles timing)
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "30");
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${msg}`);
  }

  const json = (await res.json()) as GitHubSearchResponse;
  return json.items ?? [];
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Run focused queries in sequence (staggered to respect the search rate limit)
// and concatenate their results. Partial failures are tolerated; `anyOk` reports
// whether at least one query succeeded so the caller can surface hard failures.
async function runQueries(
  queries: string[],
  token: string,
): Promise<{ items: GitHubSearchItem[]; error: string | null; anyOk: boolean }> {
  const items: GitHubSearchItem[] = [];
  let error: string | null = null;
  let anyOk = false;

  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await delay(350);
    try {
      items.push(...(await fetchGitHubPage(queries[i], 1, token)));
      anyOk = true;
    } catch (err) {
      error = String(err);
    }
  }

  return { items, error, anyOk };
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === "your_github_token_here") {
    return NextResponse.json(
      {
        repos: [],
        error:
          "GITHUB_TOKEN is not configured. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let body: {
    programme?: string;
    targetRole?: string;
    skills?: string[];
    keywords?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ repos: [], error: "Invalid JSON body." }, { status: 400 });
  }

  const { programme = "", targetRole = "", skills = [], keywords = "" } = body;

  // A user-typed keyword search becomes the single focused query (≤3 words);
  // otherwise derive 2-3 focused queries from the profile.
  const trimmedKeywords = keywords.trim();
  let baseQueries: string[];
  if (trimmedKeywords) {
    const kw = cleanTerms(trimmedKeywords).slice(0, 3).join(" ");
    baseQueries = kw ? [kw] : [];
  } else {
    baseQueries = buildFocusedQueries(programme, targetRole, skills);
  }

  // Nothing to search — no profile and no keywords typed yet
  if (baseQueries.length === 0) {
    return NextResponse.json({ repos: [], query: "" });
  }

  const primaryQuery = baseQueries[0];
  const fullQueries = baseQueries.map((q) => withQualifiers(q, programme));

  // Run each focused query and merge the results.
  const { items, error, anyOk } = await runQueries(fullQueries, token);

  // Only surface an error if no query succeeded at all (e.g. bad token / network).
  if (!anyOk && error) {
    return NextResponse.json({ repos: [], error }, { status: 502 });
  }

  let merged = items;

  // Fallback: every focused query came back empty. Run one broad query using the
  // target role's first word plus a finance/data anchor.
  if (merged.length === 0) {
    const firstWord =
      cleanTerms(targetRole)[0] ?? cleanTerms(primaryQuery)[0] ?? "";
    const anchor = FINANCE_PROGRAMMES.has(programme) ? "finance" : "data";
    const fallbackQuery = `${firstWord} ${anchor}`.trim();
    if (fallbackQuery) {
      try {
        merged = await fetchGitHubPage(fallbackQuery, 1, token);
      } catch {
        merged = [];
      }
    }
  }

  // Deduplicate by full repo name (first occurrence wins).
  const seen = new Set<string>();
  const deduped = merged.filter((r) => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });

  // Quality filter: ≥50 stars, sorted by stars descending.
  let ranked = deduped
    .filter((r) => r.stargazers_count >= 50)
    .sort((a, b) => b.stargazers_count - a.stargazers_count);

  // Relax the star threshold if nothing clears it, so the feed isn't empty.
  if (ranked.length === 0) {
    ranked = deduped.sort((a, b) => b.stargazers_count - a.stargazers_count);
  }

  const repos: GitHubRepo[] = ranked.slice(0, 12).map((item) => ({
    id: item.id,
    full_name: item.full_name,
    name: item.name,
    owner: item.owner?.login ?? "",
    description: item.description,
    stars: item.stargazers_count,
    forks: item.forks_count,
    open_issues: item.open_issues_count,
    topics: item.topics ?? [],
    html_url: item.html_url,
    language: item.language,
    difficulty: inferDifficulty(
      item.stargazers_count,
      item.open_issues_count,
      item.forks_count,
    ),
  }));

  return NextResponse.json({ repos, query: primaryQuery });
}
