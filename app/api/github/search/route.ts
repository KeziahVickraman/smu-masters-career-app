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

function buildSearchQuery(
  programme: string,
  targetRole: string,
  skills: string[],
): string {
  const programmeKws = PROGRAMME_KEYWORDS[programme] ?? [];
  // Take the first programme keyword + target role words + top 2 skills
  const roleParts = targetRole
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  const skillParts = skills.slice(0, 3).map((s) =>
    s.replace(/[^a-zA-Z0-9 ]/g, " ").trim(),
  );

  const parts = [
    ...(programmeKws.length > 0 ? [programmeKws[0]] : []),
    ...roleParts,
    ...skillParts,
  ];

  // Deduplicate and join — GitHub Search treats spaces as OR between terms
  const unique = [...new Set(parts.map((p) => p.toLowerCase()))].filter(Boolean);

  return unique.join(" ");
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

  // buildSearchQuery falls back to a sensible default when both are empty
  const baseQuery = buildSearchQuery(programme, targetRole, skills);
  // Append any extra user-supplied keywords, deduplicated
  const keywordParts = keywords
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .map((k) => k.toLowerCase())
    .filter((k) => k.length >= 2 && !baseQuery.includes(k));
  const query = keywordParts.length > 0
    ? `${baseQuery} ${keywordParts.join(" ")}`.trim()
    : baseQuery;

  // Nothing to search — no profile and no keywords typed yet
  if (!query.trim()) {
    return NextResponse.json({ repos: [], query: "" });
  }

  // Fetch page 1; if we need more to find ≥12 repos with ≥50 stars, try page 2
  let items: GitHubSearchItem[] = [];
  try {
    items = await fetchGitHubPage(query, 1, token);
  } catch (err) {
    return NextResponse.json(
      { repos: [], error: String(err) },
      { status: 502 },
    );
  }

  // Filter to ≥50 stars
  let filtered = items.filter((r) => r.stargazers_count >= 50);

  // If fewer than 12, grab page 2 after 500ms to respect rate limits
  if (filtered.length < 12) {
    await delay(500);
    try {
      const page2 = await fetchGitHubPage(query, 2, token);
      filtered = [...filtered, ...page2.filter((r) => r.stargazers_count >= 50)];
    } catch {
      // Non-fatal — work with what we have
    }
  }

  // If still not enough after filtering, relax the star threshold to include any results
  if (filtered.length === 0) {
    filtered = items;
  }

  const repos: GitHubRepo[] = filtered.slice(0, 12).map((item) => ({
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

  return NextResponse.json({ repos, query });
}
