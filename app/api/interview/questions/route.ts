import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// ── Exported types (imported by the page) ───────────────────────────────────
export type QuestionCategory = "Behavioural" | "Technical" | "Case" | "Culture";
export type QuestionDifficulty = "Easy" | "Medium" | "Hard";

export interface InterviewQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  answer_framework: string;
  repo_reference?: string;
}

// Keep exported for JSON export consumers
export interface QuestionsResponse {
  questions: InterviewQuestion[];
}

// ── Request body types ───────────────────────────────────────────────────────
export interface SavedRepo {
  full_name: string;
  description?: string | null;
  topics?: string[];
  language?: string | null;
  skills_to_gain?: string[];
}

interface RequestProfile {
  programme: string;
  programme_year?: string;
  current_role: string;
  target_role: string;
  target_industry: string;
  current_industry: string;
  interview_stage: string;
  years_experience: number;
  skills_self_reported?: Record<string, string[]>;
  target_companies?: string[];
}

interface QuestionsRequest {
  profile: RequestProfile;
  savedRepos?: SavedRepo[];
}

// ── Route handler — streams raw JSON text back to client ──────────────────────
export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env.local." },
      { status: 503 },
    );
  }

  let body: QuestionsRequest;
  try {
    body = (await req.json()) as QuestionsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { profile, savedRepos = [] } = body;

  if (!profile?.target_role?.trim()) {
    return NextResponse.json(
      { error: "profile.target_role is required." },
      { status: 400 },
    );
  }

  // ── Build context strings ──────────────────────────────────────────────────
  const allSkills = Object.values(profile.skills_self_reported ?? {}).flat();

  const stageLabel: Record<string, string> = {
    pre: "not yet applying — needs preparation and company research",
    during: "actively interviewing — needs mock questions and case prep",
    post: "offer received — needs negotiation and decision-making guidance",
    not_interviewing: "not currently job hunting — upskilling focus",
  };

  const profileContext = `
User Profile:
- Programme: ${profile.programme.replace(/_/g, " ")}
- Year: ${profile.programme_year ?? "not specified"}
- Current role: ${profile.current_role}
- Target role: ${profile.target_role}
- Current industry: ${profile.current_industry}
- Target industry: ${profile.target_industry}
- Interview stage: ${stageLabel[profile.interview_stage] ?? profile.interview_stage}
- Years of experience: ${profile.years_experience}
- Skills: ${allSkills.length > 0 ? allSkills.join(", ") : "none listed"}
- Target companies: ${profile.target_companies?.join(", ") || "not specified"}
`.trim();

  const repoContext =
    savedRepos.length > 0
      ? `\n\nSaved GitHub Repositories (user's project portfolio):\n${savedRepos
          .map(
            (r) =>
              `- ${r.full_name}${r.description ? `: ${r.description}` : ""}` +
              (r.topics?.length ? ` [topics: ${r.topics.slice(0, 4).join(", ")}]` : "") +
              (r.language ? ` [language: ${r.language}]` : "") +
              (r.skills_to_gain?.length
                ? ` [skills to gain: ${r.skills_to_gain.join(", ")}]`
                : ""),
          )
          .join("\n")}`
      : "";

  // ── Prompt ─────────────────────────────────────────────────────────────────
  const systemPrompt = `You are a senior career coach specialising in SMU Masters students in Singapore targeting roles in finance, technology, and business AI.

Generate exactly 20 personalised interview questions for this user. Every question must feel like it was written specifically for them — reference their actual role, industry, skills, or GitHub projects. No generic questions.

Category breakdown (must hit these targets exactly):
- Behavioural: 6 questions
- Technical: 6 questions
- Case: 4 questions
- Culture: 4 questions

Difficulty spread per category: mix Easy, Medium, and Hard.

Answer framework guidelines:
- Behavioural: STAR format — Situation, Task, Action, Result. Give 2-3 sentences of specific guidance on what to highlight given their background.
- Technical: Structured step-by-step approach. Be specific to their skills (e.g. if they know Python, mention relevant libraries).
- Case: Name the framework (MECE, hypothesis-driven, profitability tree, etc.) and how to apply it to their target industry.
- Culture: Explain what the interviewer is actually assessing and what signal to give.

repo_reference: Only include if a specific saved repo directly relates to the question. Use the format "owner/repo-name".

Return ONLY a JSON array of exactly 20 objects. No markdown fences, no prose outside the JSON.

Schema for each object:
{
  "id": "q01",
  "question": "...",
  "category": "Behavioural" | "Technical" | "Case" | "Culture",
  "difficulty": "Easy" | "Medium" | "Hard",
  "answer_framework": "...",
  "repo_reference": "owner/repo" (optional, omit if not applicable)
}`;

  const userMessage = `${profileContext}${repoContext}

Generate the 20 personalised interview questions now. Return the JSON array only.`;

  // ── Stream Claude text deltas directly to the client ──────────────────────
  const client = new Anthropic({ apiKey: anthropicKey });

  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      anthropicStream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });
      anthropicStream.once("finalMessage", () => {
        controller.close();
      });
      anthropicStream.once("error", (err: Error) => {
        controller.error(err);
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
