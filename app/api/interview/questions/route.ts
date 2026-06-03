import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { TIHTopic } from "@/app/api/sources/tech-interview-handbook/route";

// ── Exported types (imported by the page) ───────────────────────────────────
export type QuestionCategory = "Behavioural" | "Technical" | "Case" | "Culture";
export type QuestionDifficulty = "Easy" | "Medium" | "Hard";

// Where a question came from. Generated = produced by Claude for this profile.
export type QuestionOrigin = "Generated" | "Tech Interview Handbook";

export interface InterviewQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  answer_framework: string;
  repo_reference?: string;
  origin?: QuestionOrigin;
  source_url?: string;
}

// Keep exported for JSON export consumers
export interface QuestionsResponse {
  questions: InterviewQuestion[];
}

// ── Request body types ───────────────────────────────────────────────────────
export interface RepoEnrichmentContext {
  summary?: string;
  core_concepts?: string[];
  tools_and_technologies?: string[];
  difficulty?: string;
  interview_talking_points?: string[];
  portfolio_strength?: string;
  why_relevant?: string;
}

export interface SavedRepo {
  full_name: string;
  description?: string | null;
  topics?: string[];
  language?: string | null;
  skills_to_gain?: string[];
  // Enrichment fields — present on repos saved from the live GitHub search page
  enriched?: boolean;
  enrichment?: RepoEnrichmentContext;
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
  // Which content sources are active for this session, e.g. ["profile", "saved_repos", "tih"].
  sources?: string[];
  // Ingested Tech Interview Handbook content (cached client-side in localStorage).
  // Sent only when "tih" is among `sources`.
  tihContent?: TIHTopic[];
}

// ── TIH merge helpers ────────────────────────────────────────────────────────
// Flatten a question to a comparable word set for cheap semantic-similarity dedup.
function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

// Programme → which TIH categories / question types to prioritise.
function tihPriorities(programme: string): {
  categories: Set<string>;
  types: Set<string>;
} {
  const p = programme;
  if (p === "MITB_Analytics" || p === "MITB_AI" || p === "MBAI") {
    return { categories: new Set(["coding", "algorithms"]), types: new Set(["Technical"]) };
  }
  if (p === "MSc_Finance" || p === "MSc_Computational_Finance") {
    return { categories: new Set(["coding", "algorithms"]), types: new Set(["Technical", "Behavioural"]) };
  }
  if (p === "MSc_Management" || p === "MSc_OBHR") {
    return { categories: new Set(["behavioral"]), types: new Set(["Behavioural", "Culture"]) };
  }
  // Default: a balanced spread.
  return { categories: new Set(["behavioral", "coding"]), types: new Set(["Behavioural", "Technical"]) };
}

interface ScoredTihQuestion {
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  answer_framework: string;
  source_url: string;
  score: number;
  words: Set<string>;
}

const VALID_CATS = new Set(["Behavioural", "Technical", "Case", "Culture"]);
const VALID_DIFFS = new Set(["Easy", "Medium", "Hard"]);
const MAX_TIH_QUESTIONS = 8;

// Select, prioritise, and dedupe TIH questions for this profile.
function selectTihQuestions(
  tihContent: TIHTopic[],
  profile: RequestProfile,
): Omit<ScoredTihQuestion, "score" | "words">[] {
  const { categories, types } = tihPriorities(profile.programme);
  const relevanceWords = wordSet(
    `${profile.target_role} ${profile.target_industry} ${profile.programme.replace(/_/g, " ")}`,
  );

  const scored: ScoredTihQuestion[] = [];
  for (const topic of tihContent) {
    const catMatch = categories.has(topic.category.toLowerCase());
    for (const q of topic.questions) {
      if (!q.question?.trim()) continue;
      const words = wordSet(q.question);
      let score = 0;
      if (catMatch) score += 2;
      if (types.has(q.type)) score += 2;
      // Light relevance boost from role/industry/programme overlap.
      score += jaccard(words, relevanceWords) * 3;
      scored.push({
        question: q.question.trim(),
        category: VALID_CATS.has(q.type) ? (q.type as QuestionCategory) : "Technical",
        difficulty: VALID_DIFFS.has(q.difficulty) ? (q.difficulty as QuestionDifficulty) : "Medium",
        answer_framework: q.answer_framework?.trim() || "Use a structured, example-led approach.",
        source_url: topic.url,
        score,
        words,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Dedupe TIH-vs-TIH by similarity, then cap.
  const picked: ScoredTihQuestion[] = [];
  for (const cand of scored) {
    if (picked.some((p) => jaccard(p.words, cand.words) > 0.6)) continue;
    picked.push(cand);
    if (picked.length >= MAX_TIH_QUESTIONS) break;
  }

  return picked.map(({ question, category, difficulty, answer_framework, source_url }) => ({
    question,
    category,
    difficulty,
    answer_framework,
    source_url,
  }));
}

// Brace-counting extraction of top-level JSON objects from streamed Claude text,
// used server-side to dedupe generated questions against TIH ones.
function extractQuestionStrings(text: string): { question: string; words: Set<string> }[] {
  const out: { question: string; words: Set<string> }[] = [];
  let pos = 0;
  while (pos < text.length) {
    const start = text.indexOf("{", pos);
    if (start === -1) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) break;
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      if (typeof obj.question === "string" && obj.question.trim()) {
        out.push({ question: obj.question, words: wordSet(obj.question) });
      }
    } catch { /* skip fragment */ }
    pos = end + 1;
  }
  return out;
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

  const { profile, savedRepos = [], sources = [], tihContent = [] } = body;

  if (!profile?.target_role?.trim()) {
    return NextResponse.json(
      { error: "profile.target_role is required." },
      { status: 400 },
    );
  }

  // ── Tech Interview Handbook questions — selected/prioritised/deduped below ──
  const tihActive = sources.includes("tih") && tihContent.length > 0;
  const tihCandidates = tihActive
    ? selectTihQuestions(tihContent, profile)
    : [];

  // Saved repos only contribute when explicitly enabled (default on when unset).
  const reposActive =
    sources.length === 0 || sources.includes("saved_repos");

  // ── Partition repos — only enriched ones contribute to Claude context ──────
  const enrichedRepos = (reposActive ? savedRepos : []).filter(
    (r) => r.enriched === true && r.enrichment,
  );
  const contextSources = enrichedRepos.map((r) => r.full_name);

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

  // Only enriched repos are passed as context; unenriched repos are ignored
  const repoContext =
    enrichedRepos.length > 0
      ? `\n\nSaved GitHub Repositories (enriched — use these for specific references):\n${enrichedRepos
          .map((r) => {
            const e = r.enrichment!;
            const lines = [
              `- ${r.full_name}`,
              e.why_relevant ? `  Relevance: ${e.why_relevant}` : "",
              e.core_concepts?.length
                ? `  Core concepts: ${e.core_concepts.join(", ")}`
                : "",
              e.tools_and_technologies?.length
                ? `  Tools: ${e.tools_and_technologies.join(", ")}`
                : "",
              e.interview_talking_points?.length
                ? `  Interview talking points: ${e.interview_talking_points.join(" | ")}`
                : "",
            ];
            return lines.filter(Boolean).join("\n");
          })
          .join("\n\n")}`
      : "";

  // ── Prompt ─────────────────────────────────────────────────────────────────
  const systemPrompt = `You are a senior career coach for SMU Masters students in Singapore. Generate exactly 20 interview questions. For each question, reference specific repos, tools, or concepts from the user's saved repos where relevant. Do not generate generic questions. Every technical question must be grounded in the user's actual saved repo content where repos are available.

Category breakdown (must hit these targets exactly):
- Behavioural: 6 questions
- Technical: 6 questions
- Case: 4 questions
- Culture: 4 questions

Difficulty spread per category: mix Easy, Medium, and Hard.

Answer framework guidelines:
- Behavioural: STAR format — Situation, Task, Action, Result. Give 2-3 sentences of specific guidance on what to highlight given their background.
- Technical: Structured step-by-step approach. Be specific to their skills and repos. Reference actual tools and concepts from their saved repos.
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
      // Accumulate the generated text so TIH questions can be deduped against
      // it before being appended to the same stream.
      let generatedText = "";

      anthropicStream.on("text", (delta) => {
        generatedText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      anthropicStream.once("finalMessage", () => {
        if (tihCandidates.length > 0) {
          // Dedupe TIH questions against the generated set by similarity.
          const generated = extractQuestionStrings(generatedText);
          let idx = 0;
          for (const tq of tihCandidates) {
            const words = wordSet(tq.question);
            const isDup = generated.some((g) => jaccard(g.words, words) > 0.6);
            if (isDup) continue;
            idx++;
            const obj = {
              id: `tih${String(idx).padStart(2, "0")}`,
              question: tq.question,
              category: tq.category,
              difficulty: tq.difficulty,
              answer_framework: tq.answer_framework,
              origin: "Tech Interview Handbook" as const,
              source_url: tq.source_url,
            };
            // Leading comma keeps objects separated; the client parser is
            // brace-based and ignores commas / array structure.
            controller.enqueue(encoder.encode(`,\n${JSON.stringify(obj)}`));
          }
        }
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
      "X-Context-Sources": JSON.stringify(contextSources),
    },
  });
}
