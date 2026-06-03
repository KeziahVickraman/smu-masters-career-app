import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Tech Interview Handbook ingestion route.
//
// Fetches markdown content from the public yangshun/tech-interview-handbook
// repo (specific folders only — NOT the whole repo), passes it to Claude to
// structure into interview questions, and returns the structured payload. The
// client caches the result in localStorage under `smu_source_tih`.
//
// All GitHub API calls use GITHUB_TOKEN (server-side only).
// ─────────────────────────────────────────────────────────────────────────────

const REPO = "yangshun/tech-interview-handbook";
// Primary content root, with a fallback for older repo layouts. Folders are
// looked up under the first base that returns files.
const CONTENTS_BASE = "apps/website/contents";
const CONTENTS_BASES = [CONTENTS_BASE, "contents"];
// Only these folders are fetched — never the entire repo.
const TARGET_FOLDERS = [
  "coding",
  "algorithms",
  "behavioral",
  "resume",
  "negotiation",
] as const;

// Public reading site the markdown is published to — used as the question's
// "original page" link.
const SITE_BASE = "https://www.techinterviewhandbook.org";

// Bounds to keep the ingestion fast and within token limits.
const MAX_FILES_PER_FOLDER = 5;
const MAX_DIR_DEPTH = 2;
const MAX_FILE_CHARS = 6000;

// ── Exported types (imported by the page + questions route) ──────────────────
export type TIHQuestionType = "Behavioural" | "Technical" | "Case" | "Culture";
export type TIHDifficulty = "Easy" | "Medium" | "Hard";

export interface TIHQuestion {
  question: string;
  difficulty: TIHDifficulty;
  type: TIHQuestionType;
  answer_framework: string;
}

export interface TIHTopic {
  source: "Tech Interview Handbook";
  category: string;
  topic: string;
  questions: TIHQuestion[];
  tips: string[];
  url: string;
}

export interface TIHIngestResponse {
  source: "Tech Interview Handbook";
  fetched_at: string;
  content: TIHTopic[];
}

// ── GitHub helpers ───────────────────────────────────────────────────────────
function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

interface GhContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | string;
  url: string; // API URL (includes ?ref=)
}

interface CollectedFile {
  path: string;
  url: string; // reading-site URL
  content: string;
}

// Map a repo content path to its public reading-site URL.
// e.g. apps/website/contents/coding/coding-interview-prep.mdx
//   -> https://www.techinterviewhandbook.org/coding/coding-interview-prep
function pathToSiteUrl(path: string): string {
  let slug = path;
  for (const base of CONTENTS_BASES) {
    if (slug.startsWith(`${base}/`)) {
      slug = slug.slice(base.length + 1);
      break;
    }
  }
  slug = slug.replace(/\.(md|mdx)$/i, "");
  slug = slug.replace(/\/index$/i, "");
  return `${SITE_BASE}/${slug}`;
}

async function listDir(
  path: string,
  token: string,
): Promise<GhContentItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return Array.isArray(json) ? (json as GhContentItem[]) : [];
}

async function fetchFileRaw(apiUrl: string, token: string): Promise<string> {
  // Use the GitHub API (token-authenticated) with the raw media type rather
  // than the unauthenticated download_url, to honour the GITHUB_TOKEN guardrail.
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) return "";
  return (await res.text()).slice(0, MAX_FILE_CHARS);
}

// Recursively collect up to MAX_FILES_PER_FOLDER markdown files from a folder.
async function collectFolderFiles(
  folder: string,
  token: string,
): Promise<CollectedFile[]> {
  const collected: CollectedFile[] = [];

  async function walk(path: string, depth: number): Promise<void> {
    if (depth > MAX_DIR_DEPTH || collected.length >= MAX_FILES_PER_FOLDER) return;
    const items = await listDir(path, token);

    // Files first (markdown), then descend into dirs.
    const files = items.filter(
      (i) => i.type === "file" && /\.(md|mdx)$/i.test(i.name),
    );
    const dirs = items.filter((i) => i.type === "dir");

    for (const file of files) {
      if (collected.length >= MAX_FILES_PER_FOLDER) return;
      const content = await fetchFileRaw(file.url, token);
      if (content.trim()) {
        collected.push({
          path: file.path,
          url: pathToSiteUrl(file.path),
          content,
        });
      }
    }

    for (const dir of dirs) {
      if (collected.length >= MAX_FILES_PER_FOLDER) return;
      await walk(dir.path, depth + 1);
    }
  }

  // Try each known content root until one yields files.
  for (const base of CONTENTS_BASES) {
    await walk(`${base}/${folder}`, 0);
    if (collected.length > 0) break;
  }
  return collected;
}

// ── Claude structuring ───────────────────────────────────────────────────────
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

const VALID_TYPES = new Set(["Behavioural", "Technical", "Case", "Culture"]);
const VALID_DIFFS = new Set(["Easy", "Medium", "Hard"]);

function normalizeTopic(
  raw: Record<string, unknown>,
  folder: string,
  fallbackUrl: string,
): TIHTopic | null {
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
  const questions: TIHQuestion[] = questionsRaw
    .map((q) => q as Record<string, unknown>)
    .filter((q) => typeof q.question === "string" && q.question.trim())
    .map((q) => ({
      question: String(q.question).trim(),
      difficulty: VALID_DIFFS.has(String(q.difficulty))
        ? (q.difficulty as TIHDifficulty)
        : "Medium",
      type: VALID_TYPES.has(String(q.type))
        ? (q.type as TIHQuestionType)
        : "Technical",
      answer_framework:
        typeof q.answer_framework === "string" && q.answer_framework.trim()
          ? String(q.answer_framework).trim()
          : "Use a structured, example-led approach.",
    }));

  const tips = Array.isArray(raw.tips)
    ? raw.tips.map((t) => String(t)).filter((t) => t.trim())
    : [];

  if (questions.length === 0 && tips.length === 0) return null;

  return {
    source: "Tech Interview Handbook",
    category: typeof raw.category === "string" && raw.category.trim() ? String(raw.category) : folder,
    topic: typeof raw.topic === "string" && raw.topic.trim() ? String(raw.topic) : folder,
    questions,
    tips,
    url: typeof raw.url === "string" && /^https?:\/\//.test(String(raw.url)) ? String(raw.url) : fallbackUrl,
  };
}

async function structureFolder(
  client: Anthropic,
  folder: string,
  files: CollectedFile[],
): Promise<TIHTopic[]> {
  if (files.length === 0) return [];

  const fallbackUrl = `${SITE_BASE}/${folder}`;
  const corpus = files
    .map((f) => `### FILE: ${f.path}\nURL: ${f.url}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const system = `You structure content from the Tech Interview Handbook into interview-prep data. Extract concrete interview questions and actionable tips from the provided markdown. Return ONLY a JSON array — no markdown fences, no prose.

Each array element represents one topic:
{
  "category": "${folder}",
  "topic": "<short topic name drawn from the file heading>",
  "questions": [
    {
      "question": "<a real interview question a candidate could be asked>",
      "difficulty": "Easy" | "Medium" | "Hard",
      "type": "Behavioural" | "Technical" | "Case" | "Culture",
      "answer_framework": "<1-2 sentences on how to approach the answer>"
    }
  ],
  "tips": ["<concise actionable tip>"],
  "url": "<the URL of the source FILE this topic came from>"
}

Rules:
- Set "url" to the exact URL given for the file the topic is derived from.
- "type": coding/algorithms content is usually "Technical"; behavioral content is "Behavioural"; resume/negotiation guidance is usually "Culture" unless clearly a case.
- Produce 3-8 questions per topic where the source supports it. Omit a topic entirely if it has no usable questions or tips.
- Do not invent URLs.`;

  const userMessage = `Structure the following ${folder} content into the JSON array described.\n\n${corpus}`;

  let rawText = "";
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = message.content[0];
    rawText = block && block.type === "text" ? block.text : "";
  } catch {
    return [];
  }

  const jsonText = stripFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((t) => normalizeTopic(t as Record<string, unknown>, folder, fallbackUrl))
    .filter((t): t is TIHTopic => t !== null);
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST() {
  const githubToken = process.env.GITHUB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!githubToken || githubToken === "your_github_token_here") {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured in .env.local." },
      { status: 503 },
    );
  }
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env.local." },
      { status: 503 },
    );
  }

  // Fetch all target folders' files in parallel.
  let folderFiles: { folder: string; files: CollectedFile[] }[];
  try {
    folderFiles = await Promise.all(
      TARGET_FOLDERS.map(async (folder) => ({
        folder,
        files: await collectFolderFiles(folder, githubToken),
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: `GitHub fetch failed: ${String(err)}` },
      { status: 502 },
    );
  }

  const totalFiles = folderFiles.reduce((n, f) => n + f.files.length, 0);
  if (totalFiles === 0) {
    return NextResponse.json(
      {
        error:
          "No markdown content found in the Tech Interview Handbook folders.",
      },
      { status: 502 },
    );
  }

  // Structure each folder with Claude (one call per folder).
  const client = new Anthropic({ apiKey: anthropicKey });
  const topicGroups = await Promise.all(
    folderFiles.map(({ folder, files }) =>
      structureFolder(client, folder, files),
    ),
  );

  const content: TIHTopic[] = topicGroups.flat();
  if (content.length === 0) {
    return NextResponse.json(
      { error: "Could not structure any Tech Interview Handbook content." },
      { status: 502 },
    );
  }

  const payload: TIHIngestResponse = {
    source: "Tech Interview Handbook",
    fetched_at: new Date().toISOString(),
    content,
  };

  return NextResponse.json(payload);
}
