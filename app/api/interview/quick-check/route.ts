import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { SavedRepo } from "../questions/route";

// ── Request body type ─────────────────────────────────────────────────────────
interface QuickCheckRequest {
  repo: SavedRepo;
  targetRole?: string;
  jobDescription?: string;
}

// ── Route handler — streams 6 focused questions for a specific repo ───────────
export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env.local." },
      { status: 503 },
    );
  }

  let body: QuickCheckRequest;
  try {
    body = (await req.json()) as QuickCheckRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { repo, targetRole, jobDescription } = body;

  if (!repo?.full_name?.trim()) {
    return NextResponse.json(
      { error: "repo.full_name is required." },
      { status: 400 },
    );
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const repoLines = [
    `Repository: ${repo.full_name}`,
    repo.description ? `Description: ${repo.description}` : null,
    repo.language ? `Primary language: ${repo.language}` : null,
    repo.topics?.length ? `Topics: ${repo.topics.join(", ")}` : null,
    repo.skills_to_gain?.length
      ? `Skills covered: ${repo.skills_to_gain.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const contextLines = [
    repoLines,
    targetRole ? `\nTarget role: ${targetRole}` : "",
    jobDescription
      ? `\nJob description excerpt:\n${jobDescription.slice(0, 800)}`
      : "",
  ].join("");

  const systemPrompt = `You are a senior technical interviewer. Generate exactly 6 focused interview questions based on a specific GitHub repository.

Category breakdown:
- Technical: 4 questions — target the repo's specific stack, patterns, design decisions, or trade-offs. Do NOT ask generic "what is X" questions; ask how the candidate would approach a real task using this repo's tools.
- Behavioural: 2 questions — ask about collaboration, contribution process, or handling challenges specific to this type of project.

${
  targetRole
    ? `Anchor all questions to the target role. Technical questions should reflect what an interviewer at this role would actually ask when they see this repo on a CV.`
    : ""
}
${
  jobDescription
    ? `Cross-reference the repo skills against the job description. Highlight gaps or strengths the candidate should address.`
    : ""
}

Every question must directly reference the repository name, its tech stack, or a specific pattern relevant to it.

Answer framework guidelines:
- Technical: Step-by-step approach naming specific tools, APIs, or patterns from this repo.
- Behavioural: STAR format tailored to open-source or project contribution context.

Return ONLY a JSON array of exactly 6 objects. No markdown, no prose.

Schema:
{
  "id": "q01",
  "question": "...",
  "category": "Technical" | "Behavioural",
  "difficulty": "Easy" | "Medium" | "Hard",
  "answer_framework": "...",
  "repo_reference": "${repo.full_name}"
}`;

  const userMessage = `${contextLines}

Generate the 6 focused questions now. Return the JSON array only.`;

  // ── Stream via Haiku for speed ────────────────────────────────────────────
  const client = new Anthropic({ apiKey: anthropicKey });

  const anthropicStream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
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
