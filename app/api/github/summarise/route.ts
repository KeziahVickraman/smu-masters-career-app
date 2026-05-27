import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────
type UserProfile = {
  programme?: string;
  target_role?: string;
  current_role?: string;
  skills_self_reported?: Record<string, string[]>;
};

type SummariseRequest = {
  repoFullName: string;
  description: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  userProfile?: UserProfile;
};

export type SummariseResponse = {
  summary: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  skills_to_gain: string[];
};

// ─── README fetcher ───────────────────────────────────────────────────────────
async function fetchReadme(repoFullName: string, token: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/readme`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return "";

  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return "";

  // Decode base64 and truncate to ~3000 chars to stay within token budget
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return decoded.slice(0, 3000);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env.local." },
      { status: 503 },
    );
  }

  let body: SummariseRequest;
  try {
    body = (await req.json()) as SummariseRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    repoFullName,
    description,
    topics,
    language,
    stars,
    userProfile,
  } = body;

  if (!repoFullName) {
    return NextResponse.json({ error: "repoFullName is required." }, { status: 400 });
  }

  // Fetch README server-side (token never leaves the server)
  const readme =
    githubToken && githubToken !== "your_github_token_here"
      ? await fetchReadme(repoFullName, githubToken)
      : "";

  // Build the prompt
  const profileContext = userProfile
    ? `
User profile:
- Programme: ${userProfile.programme ?? "unknown"}
- Current role: ${userProfile.current_role ?? "unknown"}
- Target role: ${userProfile.target_role ?? "unknown"}
- Skills already known: ${
        Object.values(userProfile.skills_self_reported ?? {})
          .flat()
          .join(", ") || "none listed"
      }
`
    : "";

  const repoContext = `
Repository: ${repoFullName}
Description: ${description ?? "(no description)"}
Primary language: ${language ?? "unknown"}
Stars: ${stars.toLocaleString()}
Topics: ${topics.length > 0 ? topics.join(", ") : "none"}
README excerpt:
${readme || "(no README available)"}
`;

  const client = new Anthropic({ apiKey: anthropicKey });

  let rawText = "";
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "You are a career advisor for SMU Masters students. Respond with valid JSON only — no markdown, no prose outside the JSON object.",
      messages: [
        {
          role: "user",
          content: `${profileContext}
${repoContext}

Given this GitHub repo and the user's profile, respond with a JSON object with exactly these keys:
{
  "summary": "<2-sentence summary of what this repo is about and why it matters for someone targeting the user's role>",
  "difficulty": "<one of: Beginner, Intermediate, Advanced>",
  "skills_to_gain": ["<skill 1>", "<skill 2>", "<skill 3>"]
}

Difficulty guide: Beginner = good first contributions, light prerequisites; Intermediate = requires solid fundamentals, moderate codebase complexity; Advanced = requires deep domain knowledge, large codebase or research-level content.`,
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

  // Parse JSON from the response (strip any accidental markdown fences)
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: SummariseResponse;
  try {
    parsed = JSON.parse(jsonText) as SummariseResponse;
  } catch {
    // Fall back: return raw text as summary with inferred values
    parsed = {
      summary: rawText.slice(0, 300),
      difficulty: "Intermediate",
      skills_to_gain: [],
    };
  }

  // Validate difficulty value
  const validDifficulties = ["Beginner", "Intermediate", "Advanced"] as const;
  if (!validDifficulties.includes(parsed.difficulty)) {
    parsed.difficulty = "Intermediate";
  }

  return NextResponse.json(parsed);
}
