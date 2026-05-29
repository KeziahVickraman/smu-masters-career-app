"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  InterviewQuestion,
  QuestionCategory,
  QuestionDifficulty,
  RepoEnrichmentContext,
  SavedRepo,
} from "@/app/api/interview/questions/route";
import { useProfiles } from "@/contexts/profile-context";
import type { UserProfile } from "@/lib/schema";

// ── localStorage keys ─────────────────────────────────────────────────────────
const KEY_SAVED_REPOS = "smu_saved_repos";    // legacy curated repos (read-only; sweeper page removed)
const KEY_GITHUB_REPOS = "smu_github_repos";  // enriched repos (github live-search page)
const KEY_QUESTIONS = "smu_interview_questions";
const KEY_PROGRESS = "smu_interview_progress";

// ── Client-side validation sets ───────────────────────────────────────────────
const VALID_CATEGORIES = new Set<string>(["Behavioural", "Technical", "Case", "Culture"]);
const VALID_DIFFICULTIES = new Set<string>(["Easy", "Medium", "Hard"]);

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionsCache = {
  profile_id: string;
  profile_updated_at: string;
  repo_signature: string;
  questions: InterviewQuestion[];
};

type PageTab = "full" | "quick";

type LoadState =
  | { status: "loading" }
  | { status: "streaming"; questions: InterviewQuestion[] }
  | { status: "done"; questions: InterviewQuestion[] }
  | { status: "error"; message: string }
  | { status: "no-profile" };

type QuickCheckState =
  | { status: "idle" }
  | { status: "streaming"; questions: InterviewQuestion[] }
  | { status: "done"; questions: InterviewQuestion[] }
  | { status: "error"; message: string };

// ── Storage helpers ───────────────────────────────────────────────────────────
function readQuestionsCache(): QuestionsCache | null {
  try {
    const raw = localStorage.getItem(KEY_QUESTIONS);
    return raw ? (JSON.parse(raw) as QuestionsCache) : null;
  } catch {
    return null;
  }
}

function readSavedRepos(): SavedRepo[] {
  const seen = new Set<string>();
  const result: SavedRepo[] = [];

  for (const key of [KEY_SAVED_REPOS, KEY_GITHUB_REPOS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      if (typeof parsed[0] === "number") continue;
      for (const r of parsed as SavedRepo[]) {
        const name = typeof r.full_name === "string" ? r.full_name : "";
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push(r);
        }
      }
    } catch {
      // skip malformed key
    }
  }

  return result;
}

function repoSignature(repos: SavedRepo[]): string {
  return repos
    .map((r) => r.full_name)
    .sort()
    .join(",");
}

function writeQuestionsCache(
  profileId: string,
  updatedAt: string,
  repoSig: string,
  questions: InterviewQuestion[],
) {
  localStorage.setItem(
    KEY_QUESTIONS,
    JSON.stringify({
      profile_id: profileId,
      profile_updated_at: updatedAt,
      repo_signature: repoSig,
      questions,
    } satisfies QuestionsCache),
  );
}

function readProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY_PROGRESS);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeProgress(ids: Set<string>) {
  localStorage.setItem(KEY_PROGRESS, JSON.stringify([...ids]));
}

// ── Streaming helpers ─────────────────────────────────────────────────────────
/**
 * Scan accumulated text for complete JSON objects (by brace counting).
 * Returns parsed objects and the position in `text` where parsing ended.
 */
function extractObjects(
  text: string,
  startPos: number,
): { objects: Record<string, unknown>[]; endPos: number } {
  const objects: Record<string, unknown>[] = [];
  let pos = startPos;

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
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end === -1) break; // object not complete yet — wait for more data

    const objStr = text.slice(start, end + 1);
    try {
      const obj = JSON.parse(objStr) as Record<string, unknown>;
      objects.push(obj);
    } catch {
      // skip malformed fragment
    }
    pos = end + 1;
  }

  return { objects, endPos: pos };
}

function normalizeQuestion(
  q: Record<string, unknown>,
  index: number,
): InterviewQuestion {
  return {
    id: typeof q.id === "string" ? q.id : `q${String(index + 1).padStart(2, "0")}`,
    question: String(q.question ?? "").trim(),
    category: VALID_CATEGORIES.has(String(q.category ?? ""))
      ? (q.category as QuestionCategory)
      : "Behavioural",
    difficulty: VALID_DIFFICULTIES.has(String(q.difficulty ?? ""))
      ? (q.difficulty as QuestionDifficulty)
      : "Medium",
    answer_framework:
      typeof q.answer_framework === "string" && String(q.answer_framework).trim()
        ? String(q.answer_framework).trim()
        : "Use a structured approach to answer clearly and concisely.",
    ...(q.repo_reference ? { repo_reference: String(q.repo_reference) } : {}),
  };
}

/**
 * Read a streaming `text/plain` response and progressively call `onProgress`
 * as complete JSON question objects are extracted. Returns the full array when done.
 */
async function streamQuestions(
  response: Response,
  signal: AbortSignal,
  onProgress: (questions: InterviewQuestion[]) => void,
): Promise<InterviewQuestion[]> {
  if (!response.body) throw new Error("Response has no body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let parsePos = 0;
  const all: InterviewQuestion[] = [];

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      accumulated += decoder.decode(value, { stream: true });
      const { objects, endPos } = extractObjects(accumulated, parsePos);
      parsePos = endPos;

      if (objects.length > 0) {
        for (const obj of objects) {
          if (typeof obj.question === "string" && obj.question.trim()) {
            all.push(normalizeQuestion(obj, all.length));
          }
        }
        onProgress([...all]);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Fallback: if no questions were streamed in, try parsing the full text at once
  if (all.length === 0 && accumulated.trim()) {
    const { objects } = extractObjects(accumulated, 0);
    for (const obj of objects) {
      if (typeof obj.question === "string" && obj.question.trim()) {
        all.push(normalizeQuestion(obj, all.length));
      }
    }
  }

  return all;
}

// ── Design helpers ────────────────────────────────────────────────────────────
const CATEGORY_TONE: Record<
  QuestionCategory,
  "info" | "primary" | "warning" | "success"
> = {
  Behavioural: "info",
  Technical: "primary",
  Case: "warning",
  Culture: "success",
};

const DIFFICULTY_TONE: Record<string, "success" | "warning" | "accent"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "accent",
};

type CategoryFilter = "All" | QuestionCategory;
const CATEGORIES: CategoryFilter[] = [
  "All",
  "Behavioural",
  "Technical",
  "Case",
  "Culture",
];

function tabCls(active: boolean) {
  return `rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
    active
      ? "bg-surface shadow-sm text-ink"
      : "text-ink-secondary hover:text-ink"
  }`;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function QuestionSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-5 w-24 rounded-sm bg-surface-muted" />
          <div className="h-5 w-14 rounded-sm bg-surface-muted" />
        </div>
        <div className="h-7 w-32 rounded-md bg-surface-muted" />
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-4 w-full rounded bg-surface-muted" />
        <div className="h-4 w-11/12 rounded bg-surface-muted" />
        <div className="h-4 w-3/4 rounded bg-surface-muted" />
      </div>
      <div className="mt-5 h-4 w-44 rounded bg-surface-muted" />
    </div>
  );
}

// ── Full-prep question card (with practised toggle) ───────────────────────────
function QuestionCard({
  question,
  isPractised,
  onTogglePractised,
  animDelay,
  repoEnrichment,
}: {
  question: InterviewQuestion;
  isPractised: boolean;
  onTogglePractised: (id: string) => void;
  animDelay: number;
  repoEnrichment?: RepoEnrichmentContext;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="animate-fade-up"
      style={{ animationDelay: `${animDelay}ms` }}
      interactive={false}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY_TONE[question.category]}>{question.category}</Badge>
          <Badge tone={DIFFICULTY_TONE[question.difficulty]}>{question.difficulty}</Badge>
        </div>
        <button
          type="button"
          onClick={() => onTogglePractised(question.id)}
          aria-label={isPractised ? "Mark as not practised" : "Mark as practised"}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
            isPractised
              ? "border-success/40 bg-surface-muted text-success"
              : "border-border text-ink-muted hover:border-border-strong hover:text-ink"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            {isPractised ? (
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            )}
          </svg>
          {isPractised ? "Practised" : "Mark as practised"}
        </button>
      </div>

      <p className="mt-4 text-[0.9375rem] leading-7 text-ink">{question.question}</p>

      {question.repo_reference && (
        <p className="mt-2 font-mono text-[11px] text-ink-muted">
          ↗ ref:{" "}
          <a
            href={`https://github.com/${question.repo_reference}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-light"
          >
            {question.repo_reference}
          </a>
        </p>
      )}

      <div className="mt-4">
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
          >
            Show answer framework →
          </button>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mb-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              ↑ Hide framework
            </button>
            <div className="rounded-md border border-border bg-surface-muted/50 px-4 py-3">
              <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                Answer framework
              </p>
              <p className="text-[0.9375rem] leading-6 text-ink-secondary">
                {question.answer_framework}
              </p>

              {question.repo_reference && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                    Source
                  </p>
                  <a
                    href={`https://github.com/${question.repo_reference}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-[12px] text-primary transition-colors hover:text-primary-light"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1C3.239 1 1 3.239 1 6c0 2.209 1.434 4.082 3.421 4.745.25.046.341-.109.341-.241 0-.119-.004-.434-.007-.852-1.392.303-1.686-.671-1.686-.671-.228-.578-.556-.732-.556-.732-.454-.310.034-.304.034-.304.502.035.766.516.766.516.446.764 1.170.543 1.455.415.045-.323.174-.543.317-.668-1.110-.126-2.277-.555-2.277-2.470 0-.546.195-.992.515-1.342-.052-.126-.223-.635.049-1.323 0 0 .420-.134 1.375.513A4.795 4.795 0 016 3.802c.425.002.853.057 1.253.168.954-.647 1.374-.513 1.374-.513.273.688.101 1.197.050 1.323.321.350.514.796.514 1.342 0 1.921-1.170 2.343-2.284 2.466.180.155.340.461.340.929 0 .670-.006 1.211-.006 1.376 0 .134.089.290.342.241A5.003 5.003 0 0011 6c0-2.761-2.239-5-5-5z" fill="currentColor"/>
                    </svg>
                    {question.repo_reference}
                  </a>

                  {repoEnrichment?.interview_talking_points &&
                    repoEnrichment.interview_talking_points.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 font-mono text-[10px] text-ink-muted">
                          Talking points used to ground this question:
                        </p>
                        <ul className="space-y-1.5">
                          {repoEnrichment.interview_talking_points.map((tp, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-[0.8125rem] leading-5 text-ink-secondary"
                            >
                              <span className="mt-0.5 shrink-0 font-mono text-[10px] text-primary/40">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              {tp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Quick-check question card (simpler — no practise toggle) ──────────────────
function QuickCard({
  question,
  animDelay,
}: {
  question: InterviewQuestion;
  animDelay: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="animate-fade-up"
      style={{ animationDelay: `${animDelay}ms` }}
      interactive={false}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY_TONE[question.category]}>{question.category}</Badge>
        <Badge tone={DIFFICULTY_TONE[question.difficulty]}>{question.difficulty}</Badge>
        {question.repo_reference && (
          <a
            href={`https://github.com/${question.repo_reference}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-ink-muted hover:text-primary"
          >
            ↗ {question.repo_reference}
          </a>
        )}
      </div>

      <p className="mt-4 text-[0.9375rem] leading-7 text-ink">{question.question}</p>

      <div className="mt-4">
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
          >
            Show answer framework →
          </button>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mb-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              ↑ Hide framework
            </button>
            <div className="rounded-md border border-border bg-surface-muted/50 px-4 py-3">
              <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                Answer framework
              </p>
              <p className="text-[0.9375rem] leading-6 text-ink-secondary">
                {question.answer_framework}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Export modal ──────────────────────────────────────────────────────────────
function ExportModal({
  onClose,
  onExportPdf,
  onExportJson,
  exporting,
}: {
  onClose: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  exporting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close export modal"
          className="absolute right-4 top-4 text-ink-muted transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <p className="font-medium text-ink">Export Prep Guide</p>
        <p className="mt-1 text-sm text-ink-muted">
          Download your personalised interview prep as PDF or JSON.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exporting}
            className="flex w-full items-start gap-4 rounded-md border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-border-strong hover:bg-surface-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="1" width="9" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M11 4v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M8 11l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Export as PDF</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Profile summary, all questions with frameworks, and practice progress.
              </p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">
                SMU_Career_Prep_[Role]_[Date].pdf
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            disabled={exporting}
            className="flex w-full items-start gap-4 rounded-md border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-border-strong hover:bg-surface-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4c-1 0-1.5.5-1.5 1v2c0 .5-.5 1-1 1s.5.5 1 1v2c0 .5.5 1 1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M13 4c1 0 1.5.5 1.5 1v2c0 .5.5 1 1 1s-.5.5-1 1v2c0 .5-.5 1-1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="8" r="1" fill="currentColor" />
                <circle cx="5.5" cy="8" r="1" fill="currentColor" />
                <circle cx="10.5" cy="8" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Export as JSON</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Full structured data — profile, questions, repos, and progress.
              </p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">
                SMU_Career_Prep_[Role]_[Date].json
              </p>
            </div>
          </button>
        </div>

        {exporting && (
          <p className="mt-4 text-center text-sm text-ink-muted">Generating PDF…</p>
        )}
      </div>
    </div>
  );
}

// ── PDF generation — dynamic import, client-side only ─────────────────────────
async function generatePDF(
  profile: UserProfile | null,
  questions: InterviewQuestion[],
  practised: Set<string>,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 15;
  const MR = 15;
  const MT = 18;
  const MB = 22;
  const CW = PW - ML - MR;

  let y = MT;

  function checkBreak(needed = 14) {
    if (y + needed > PH - MB) {
      doc.addPage();
      y = MT;
    }
  }

  function gap(mm = 5) {
    y += mm;
  }

  function drawTitle(text: string) {
    checkBreak(14);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#002147");
    doc.text(text, ML, y);
    gap(11);
  }

  function drawHeading(text: string) {
    checkBreak(10);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#002147");
    doc.text(text, ML, y);
    gap(8);
  }

  function drawSubheading(text: string) {
    checkBreak(8);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#002147");
    doc.text(text, ML, y);
    gap(6);
  }

  function drawBody(text: string, indent = 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#111110");
    const lines = doc.splitTextToSize(text, CW - indent) as string[];
    const lh = 5;
    checkBreak(lines.length * lh + 2);
    doc.text(lines, ML + indent, y);
    gap(lines.length * lh);
  }

  function drawMuted(text: string, indent = 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#6b6a67");
    const lines = doc.splitTextToSize(text, CW - indent) as string[];
    const lh = 4.5;
    checkBreak(lines.length * lh + 1);
    doc.text(lines, ML + indent, y);
    gap(lines.length * lh);
  }

  function drawItalic(text: string, indent = 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor("#6b6a67");
    const lines = doc.splitTextToSize(text, CW - indent) as string[];
    const lh = 5;
    checkBreak(lines.length * lh + 1);
    doc.text(lines, ML + indent, y);
    gap(lines.length * lh);
  }

  function drawLabel(text: string) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#a8a7a3");
    doc.text(text.toUpperCase(), ML, y);
    gap(4);
  }

  function drawDivider() {
    checkBreak(6);
    doc.setDrawColor("#e4e3df");
    doc.line(ML, y, PW - MR, y);
    gap(6);
  }

  // Cover
  drawTitle("SMU Career Companion");
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#6b6a67");
  doc.text("Interview Prep Guide", ML, y);
  gap(7);
  drawMuted(
    `Generated: ${new Date().toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" })}`,
  );
  gap(3);
  drawDivider();

  // Profile summary
  const user = profile?.user;
  drawHeading("Profile Summary");

  if (user) {
    const fields: [string, string | number | undefined][] = [
      ["Programme", user.programme?.replace(/_/g, " ")],
      ["Year", user.programme_year],
      ["Target Role", user.target_role],
      ["Current Role", user.current_role],
      ["Target Industry", user.target_industry],
      ["Interview Stage", user.interview_stage],
      [
        "Experience",
        user.years_experience !== undefined
          ? `${user.years_experience} year${user.years_experience === 1 ? "" : "s"}`
          : undefined,
      ],
    ];

    for (const [lbl, val] of fields) {
      if (!val && val !== 0) continue;
      checkBreak(6);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor("#111110");
      doc.text(`${lbl}:`, ML, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor("#6b6a67");
      doc.text(String(val), ML + 40, y);
      gap(6);
    }

    const allSkills = Object.values(user.skills_self_reported ?? {}).flat();
    if (allSkills.length > 0) {
      gap(2);
      drawBody(`Skills: ${allSkills.join(", ")}`);
    }
    if (user.target_companies?.length) {
      gap(1);
      drawBody(`Target companies: ${user.target_companies.join(", ")}`);
    }
  } else {
    drawMuted("No profile saved.");
  }

  gap(4);
  drawDivider();

  // Practice progress
  drawHeading("Practice Progress");
  drawBody(`${practised.size} of ${questions.length} questions marked as practised.`);
  if (practised.size > 0) {
    const pct = Math.round((practised.size / questions.length) * 100);
    gap(1);
    drawMuted(`${pct}% complete`);
  }
  gap(4);
  drawDivider();

  // Questions by category
  drawHeading(`Interview Questions (${questions.length})`);

  const catOrder: QuestionCategory[] = [
    "Behavioural",
    "Technical",
    "Case",
    "Culture",
  ];

  for (const cat of catOrder) {
    const catQs = questions.filter((q) => q.category === cat);
    if (catQs.length === 0) continue;

    gap(3);
    drawSubheading(`${cat} (${catQs.length})`);

    for (let i = 0; i < catQs.length; i++) {
      const q = catQs[i];
      const isPractised = practised.has(q.id);

      checkBreak(35);
      gap(2);
      drawLabel(
        `${q.difficulty}  ·  ${cat}${isPractised ? "  ·  practised" : ""}`,
      );
      drawBody(q.question);
      gap(1);
      drawMuted("Answer Framework:");
      drawItalic(q.answer_framework, 4);

      if (q.repo_reference) {
        gap(1);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor("#002147");
        doc.text(`ref: ${q.repo_reference}`, ML + 4, y);
        gap(5);
      }

      if (i < catQs.length - 1) {
        gap(4);
        doc.setDrawColor("#e4e3df");
        doc.line(ML + 4, y, PW - MR - 4, y);
        gap(4);
      }
    }
  }

  const role = user?.target_role?.replace(/[^a-zA-Z0-9]/g, "_") ?? "Role";
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`SMU_Career_Prep_${role}_${date}.pdf`);
}

// ── JSON export — native browser download ────────────────────────────────────
function generateJSON(
  profile: UserProfile | null,
  questions: InterviewQuestion[],
  practised: Set<string>,
  savedRepos: SavedRepo[],
) {
  const payload = {
    generated_at: new Date().toISOString(),
    user: profile?.user ?? null,
    questions,
    saved_repos: savedRepos,
    progress: {
      practised_ids: [...practised],
      practised_count: practised.size,
      total_count: questions.length,
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const role =
    profile?.user?.target_role?.replace(/[^a-zA-Z0-9]/g, "_") ?? "Role";
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SMU_Career_Prep_${role}_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InterviewPrepPage() {
  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PageTab>("full");

  const { activeProfile, activeProfileId } = useProfiles();

  // ── Full prep state ───────────────────────────────────────────────────────
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [savedRepos, setSavedRepos] = useState<SavedRepo[]>([]);
  const [contextSources, setContextSources] = useState<string[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [practised, setPractised] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fullAbortRef = useRef<AbortController | null>(null);

  // ── Quick check state ─────────────────────────────────────────────────────
  const [qcState, setQcState] = useState<QuickCheckState>({ status: "idle" });
  const [qcRepoName, setQcRepoName] = useState("");
  const [qcRole, setQcRole] = useState("");
  const [qcJd, setQcJd] = useState("");
  const qcAbortRef = useRef<AbortController | null>(null);

  // ── Load full prep questions ───────────────────────────────────────────────
  const loadQuestions = useCallback(async (p: typeof activeProfile, pid: string | null) => {
    // Abort any in-flight stream for this tab
    fullAbortRef.current?.abort();
    const ctl = new AbortController();
    fullAbortRef.current = ctl;

    const repos = readSavedRepos();
    setSavedRepos(repos);

    if (!p?.user?.target_role) {
      setLoadState({ status: "no-profile" });
      return;
    }

    // Cache hit: skip API call if profile (id + timestamp) + repos unchanged
    const updatedAt = p.metadata?.updated_at ?? "";
    const repoSig = repoSignature(repos);
    const cache = readQuestionsCache();
    if (
      cache &&
      pid &&
      cache.profile_id === pid &&
      updatedAt &&
      cache.profile_updated_at === updatedAt &&
      cache.repo_signature === repoSig
    ) {
      setLoadState({ status: "done", questions: cache.questions });
      return;
    }

    setLoadState({ status: "loading" });

    let res: Response;
    try {
      res = await fetch("/api/interview/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          profile: {
            programme: p.user.programme ?? "",
            programme_year: p.user.programme_year,
            current_role: p.user.current_role ?? "",
            target_role: p.user.target_role,
            target_industry: p.user.target_industry ?? "",
            current_industry: p.user.current_industry ?? "",
            interview_stage: p.user.interview_stage ?? "pre",
            years_experience: p.user.years_experience ?? 0,
            skills_self_reported: p.user.skills_self_reported,
            target_companies: p.user.target_companies,
          },
          savedRepos: repos,
        }),
      });
    } catch (err) {
      if (ctl.signal.aborted) return;
      setLoadState({ status: "error", message: String(err) });
      return;
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as { error?: string };
        message = errBody.error ?? message;
      } catch { /* ignore */ }
      setLoadState({ status: "error", message });
      return;
    }

    try {
      const questions = await streamQuestions(
        res,
        ctl.signal,
        (partial) => setLoadState({ status: "streaming", questions: partial }),
      );

      if (ctl.signal.aborted) return;

      if (questions.length === 0) {
        setLoadState({ status: "error", message: "No questions returned." });
        return;
      }

      if (updatedAt && pid) writeQuestionsCache(pid, updatedAt, repoSig, questions);

      // Read which repos were used as context from the response header
      const csHeader = res.headers.get("X-Context-Sources");
      setContextSources(csHeader ? (JSON.parse(csHeader) as string[]) : []);

      setLoadState({ status: "done", questions });
    } catch (err) {
      if (ctl.signal.aborted) return;
      setLoadState({ status: "error", message: String(err) });
    }
  }, []);

  useEffect(() => {
    setPractised(readProgress());
    void loadQuestions(activeProfile, activeProfileId);
    return () => { fullAbortRef.current?.abort(); };
  }, [loadQuestions, activeProfile, activeProfileId]);

  // ── Toggle practised ──────────────────────────────────────────────────────
  const togglePractised = useCallback((id: string) => {
    setPractised((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeProgress(next);
      return next;
    });
  }, []);

  // ── Quick check ───────────────────────────────────────────────────────────
  const runQuickCheck = useCallback(async () => {
    const repo = savedRepos.find((r) => r.full_name === qcRepoName);
    if (!repo) return;

    qcAbortRef.current?.abort();
    const ctl = new AbortController();
    qcAbortRef.current = ctl;

    setQcState({ status: "streaming", questions: [] });

    let res: Response;
    try {
      res = await fetch("/api/interview/quick-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          repo,
          targetRole: qcRole.trim() || undefined,
          jobDescription: qcJd.trim() || undefined,
        }),
      });
    } catch (err) {
      if (ctl.signal.aborted) return;
      setQcState({ status: "error", message: String(err) });
      return;
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as { error?: string };
        message = errBody.error ?? message;
      } catch { /* ignore */ }
      setQcState({ status: "error", message });
      return;
    }

    try {
      const questions = await streamQuestions(
        res,
        ctl.signal,
        (partial) => setQcState({ status: "streaming", questions: partial }),
      );

      if (ctl.signal.aborted) return;

      if (questions.length === 0) {
        setQcState({ status: "error", message: "No questions returned." });
        return;
      }

      setQcState({ status: "done", questions });
    } catch (err) {
      if (ctl.signal.aborted) return;
      setQcState({ status: "error", message: String(err) });
    }
  }, [savedRepos, qcRepoName, qcRole, qcJd]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (loadState.status !== "done") return;
    setExporting(true);
    try {
      await generatePDF(activeProfile, loadState.questions, practised);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }, [loadState, activeProfile, practised]);

  const handleExportJson = useCallback(() => {
    if (loadState.status !== "done") return;
    generateJSON(activeProfile, loadState.questions, practised, savedRepos);
    setShowExport(false);
  }, [loadState, activeProfile, practised, savedRepos]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isLoading = loadState.status === "loading";
  const isStreaming = loadState.status === "streaming";
  const isDone = loadState.status === "done";

  const fullQuestions =
    isDone || isStreaming ? loadState.questions : [];

  const visible =
    category === "All"
      ? fullQuestions
      : fullQuestions.filter((q) => q.category === category);

  const counts: Record<CategoryFilter, number> = {
    All: fullQuestions.length,
    Behavioural: fullQuestions.filter((q) => q.category === "Behavioural").length,
    Technical: fullQuestions.filter((q) => q.category === "Technical").length,
    Case: fullQuestions.filter((q) => q.category === "Case").length,
    Culture: fullQuestions.filter((q) => q.category === "Culture").length,
  };

  const totalTarget = 20;
  const practisedCount = practised.size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        {/* Back */}
        <Link
          href="/"
          className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
        >
          ← Back to dashboard
        </Link>

        {/* Page header */}
        <div className="mt-8 animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            Interview Prep
          </h1>
          <p className="mt-1 text-[0.9375rem] text-ink-secondary">
            A full question bank for your role and programme, or a quick drill on one saved repo.
          </p>
        </div>

        {/* Tab toggle */}
        <div
          className="mt-5 flex w-fit gap-0 rounded-lg border border-border bg-surface-muted p-1 animate-fade-up"
          style={{ animationDelay: "30ms" }}
        >
          <button type="button" onClick={() => setActiveTab("full")} className={tabCls(activeTab === "full")}>
            Question Bank
          </button>
          <button type="button" onClick={() => setActiveTab("quick")} className={tabCls(activeTab === "quick")}>
            Repo Drill
          </button>
        </div>

        {/* ── FULL PREP TAB ──────────────────────────────────────────────── */}
        {activeTab === "full" && (
          <>
            {/* Saved repos indicator */}
            <div
              className="mt-4 animate-fade-up"
              style={{ animationDelay: "40ms" }}
            >
              {savedRepos.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-2 text-sm text-ink-secondary">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                      {savedRepos.length}
                    </span>
                    Generating questions based on{" "}
                    <Link
                      href="/github"
                      className="font-medium text-primary hover:text-primary-light"
                    >
                      {savedRepos.length} saved {savedRepos.length === 1 ? "repo" : "repos"}
                    </Link>
                    {(() => {
                      const enrichedCount = savedRepos.filter(
                        (r) => r.enriched === true,
                      ).length;
                      return enrichedCount > 0 ? (
                        <span className="text-ink-muted">
                          ({enrichedCount} enriched)
                        </span>
                      ) : null;
                    })()}
                  </p>
                  {contextSources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-6">
                      <span className="font-mono text-[11px] text-ink-muted">
                        grounded in:
                      </span>
                      {contextSources.map((src) => (
                        <span
                          key={src}
                          className="rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[11px] text-primary/80"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-secondary">
                  No saved repos —{" "}
                  <Link
                    href="/github"
                    className="font-medium text-primary hover:text-primary-light"
                  >
                    save &amp; enrich repos in GitHub
                  </Link>{" "}
                  to ground these questions in your own portfolio
                </p>
              )}
            </div>

            {/* Sub-header */}
            <div
              className="mt-6 animate-fade-up"
              style={{ animationDelay: "50ms" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  {loadState.status === "no-profile" ? (
                    <p className="text-[0.9375rem] text-ink-secondary">
                      Complete your{" "}
                      <Link
                        href="/onboarding"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        profile
                      </Link>{" "}
                      to generate personalised questions for your role.
                    </p>
                  ) : isStreaming ? (
                    <p className="text-[0.9375rem] text-ink-secondary">
                      Generating…{" "}
                      <span className="font-medium text-ink">
                        {fullQuestions.length}
                      </span>{" "}
                      / {totalTarget} questions
                    </p>
                  ) : isDone ? (
                    <p className="text-[0.9375rem] text-ink-secondary">
                      {fullQuestions.length} questions personalised to{" "}
                      <strong className="font-medium text-ink">
                        {activeProfile?.user?.target_role}
                      </strong>
                      {savedRepos.length > 0 && (
                        <>
                          {" — "}
                          <Link
                            href="/github"
                            className="text-ink-muted hover:text-ink"
                          >
                            {savedRepos.length} repo
                            {savedRepos.length !== 1 ? "s" : ""} included
                          </Link>
                        </>
                      )}
                    </p>
                  ) : loadState.status === "error" ? (
                    <p className="text-[0.9375rem] text-ink-secondary">
                      Could not load questions.
                    </p>
                  ) : (
                    <p className="text-[0.9375rem] text-ink-secondary">
                      Generating your personalised question set…
                    </p>
                  )}
                </div>

                {(isDone || isStreaming) && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(KEY_QUESTIONS);
                      setLoadState({ status: "loading" });
                      void loadQuestions(activeProfile, activeProfileId);
                    }}
                    className="shrink-0 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    ↺ Regenerate
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-4 flex items-center gap-3">
                <p className="shrink-0 text-sm font-medium text-ink">
                  {isDone || isStreaming ? (
                    <>
                      <span className="text-primary">{practisedCount}</span>
                      {" of "}
                      <span>{fullQuestions.length || totalTarget}</span>
                      {" practised"}
                    </>
                  ) : (
                    "— of 20 practised"
                  )}
                </p>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{
                      width:
                        (isDone || isStreaming) && fullQuestions.length > 0
                          ? `${(practisedCount / fullQuestions.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                {isDone &&
                  practisedCount > 0 &&
                  practisedCount === fullQuestions.length && (
                    <p className="shrink-0 text-sm font-medium text-success">
                      Complete ✓
                    </p>
                  )}
                {isStreaming && (
                  <span className="shrink-0 flex items-center gap-1.5 text-sm text-ink-muted">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    generating
                  </span>
                )}
              </div>
            </div>

            {/* No-profile state */}
            {loadState.status === "no-profile" && (
              <div className="mt-14 flex flex-col items-center gap-4 py-8 text-center animate-fade-up">
                <p className="text-[0.9375rem] font-medium text-ink">
                  No profile found
                </p>
                <p className="max-w-sm text-sm text-ink-muted">
                  Interview questions are personalised to your programme, role, and
                  skills. Set up your profile first — it takes 3 steps.
                </p>
                <Button href="/onboarding">Set up profile →</Button>
              </div>
            )}

            {/* Error state */}
            {loadState.status === "error" && (
              <div className="mt-8 rounded-md border border-warning/40 bg-surface-muted p-4 text-sm text-ink-secondary animate-fade-up">
                <strong className="font-medium text-ink">Error — </strong>
                {loadState.message}
                <button
                  type="button"
                  onClick={() => {
                    setLoadState({ status: "loading" });
                    void loadQuestions(activeProfile, activeProfileId);
                  }}
                  className="ml-3 font-medium text-primary hover:text-primary-light"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Two-column layout */}
            {(isLoading || isStreaming || isDone) && (
              <div
                className="mt-8 animate-fade-up"
                style={{ animationDelay: "50ms" }}
              >
                {/* Mobile filter row */}
                <div className="mb-6 flex flex-wrap gap-2 md:hidden">
                  {CATEGORIES.map((cat) => {
                    const isActive = category === cat;
                    const count = counts[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
                        }`}
                      >
                        {cat}
                        {(isDone || isStreaming) && count > 0 && (
                          <span
                            className={`rounded-sm px-1 py-0.5 font-mono text-[10px] ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-surface-muted text-ink-muted"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-8">
                  {/* Desktop sidebar */}
                  <aside className="hidden w-44 shrink-0 md:block">
                    <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                      Category
                    </p>
                    <nav className="flex flex-col gap-1">
                      {CATEGORIES.map((cat) => {
                        const isActive = category === cat;
                        const count = counts[cat];
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ${
                              isActive
                                ? "bg-primary text-white"
                                : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                            }`}
                          >
                            <span>{cat}</span>
                            {(isDone || isStreaming) && count > 0 && (
                              <span
                                className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                                  isActive
                                    ? "bg-white/20 text-white"
                                    : "bg-surface-muted text-ink-muted"
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </aside>

                  {/* Main question panel */}
                  <section className="min-w-0 flex-1">
                    {isLoading ? (
                      <div className="flex flex-col gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <QuestionSkeleton key={i} />
                        ))}
                      </div>
                    ) : (isStreaming || isDone) && visible.length === 0 ? (
                      isStreaming ? (
                        // Waiting for first question — show skeletons
                        <div className="flex flex-col gap-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <QuestionSkeleton key={i} />
                          ))}
                        </div>
                      ) : (
                        <div className="py-16 text-center">
                          <p className="text-[0.9375rem] font-medium text-ink">
                            No{" "}
                            {category !== "All"
                              ? category.toLowerCase() + " "
                              : ""}
                            questions.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col gap-4">
                        {visible.map((q, i) => (
                          <QuestionCard
                            key={q.id}
                            question={q}
                            isPractised={practised.has(q.id)}
                            onTogglePractised={togglePractised}
                            animDelay={i * 40}
                            repoEnrichment={
                              q.repo_reference
                                ? savedRepos.find(
                                    (r) => r.full_name === q.repo_reference,
                                  )?.enrichment
                                : undefined
                            }
                          />
                        ))}
                        {/* Placeholder skeletons while more questions stream in */}
                        {isStreaming &&
                          Array.from({ length: 2 }).map((_, i) => (
                            <QuestionSkeleton key={`sk-${i}`} />
                          ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── QUICK CHECK TAB ────────────────────────────────────────────── */}
        {activeTab === "quick" && (
          <div
            className="mt-6 animate-fade-up"
            style={{ animationDelay: "50ms" }}
          >
            {savedRepos.length === 0 ? (
              <div className="mt-8 flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-[0.9375rem] font-medium text-ink">
                  No saved repos yet
                </p>
                <p className="max-w-sm text-sm text-ink-muted">
                  Save repos in GitHub — Claude will generate 6
                  targeted technical questions based on that repo&apos;s stack in
                  seconds.
                </p>
                <Button href="/github">Browse repos →</Button>
              </div>
            ) : (
              <>
                {/* Form */}
                <div className="max-w-[540px]">
                  <p className="text-[0.9375rem] text-ink-secondary">
                    Pick a saved repo and optionally add context — Claude
                    generates 6 focused questions using Haiku (fast).
                  </p>

                  <div className="mt-6 flex flex-col gap-5">
                    {/* Repo select */}
                    <div>
                      <label
                        className="mb-1.5 block text-sm font-medium text-ink"
                        htmlFor="qc-repo"
                      >
                        Repository{" "}
                        <span className="font-normal text-accent">*</span>
                      </label>
                      <select
                        id="qc-repo"
                        value={qcRepoName}
                        onChange={(e) => {
                          setQcRepoName(e.target.value);
                          setQcState({ status: "idle" });
                        }}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option key="__placeholder__" value="">Select a saved repo…</option>
                        {savedRepos.map((r) => (
                          <option key={r.full_name} value={r.full_name}>
                            {r.full_name}
                            {r.language ? ` · ${r.language}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target role */}
                    <div>
                      <label
                        className="mb-1.5 block text-sm font-medium text-ink"
                        htmlFor="qc-role"
                      >
                        Target role{" "}
                        <span className="font-normal text-ink-muted">
                          (optional)
                        </span>
                      </label>
                      <input
                        id="qc-role"
                        type="text"
                        value={qcRole}
                        onChange={(e) => setQcRole(e.target.value)}
                        placeholder="e.g. Data Engineer, ML Engineer, Quant Analyst"
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Job description */}
                    <div>
                      <label
                        className="mb-1.5 block text-sm font-medium text-ink"
                        htmlFor="qc-jd"
                      >
                        Job description{" "}
                        <span className="font-normal text-ink-muted">
                          (optional — paste a snippet)
                        </span>
                      </label>
                      <textarea
                        id="qc-jd"
                        value={qcJd}
                        onChange={(e) => setQcJd(e.target.value)}
                        placeholder="Paste key requirements or the full JD — Claude will cross-reference your repo skills against the role."
                        rows={4}
                        maxLength={1000}
                        className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {qcJd.length > 800 && (
                        <p className="mt-1 text-right text-xs text-ink-muted">
                          {qcJd.length} / 1000
                        </p>
                      )}
                    </div>

                    {/* Generate button */}
                    <button
                      type="button"
                      onClick={() => void runQuickCheck()}
                      disabled={!qcRepoName || qcState.status === "streaming"}
                      className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-primary bg-primary px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {qcState.status === "streaming" ? (
                        <>
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          Generating…
                        </>
                      ) : (
                        "Generate 6 questions →"
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick check results */}
                {qcState.status !== "idle" && (
                  <div className="mt-10">
                    {qcState.status === "error" && (
                      <div className="rounded-md border border-warning/40 bg-surface-muted p-4 text-sm text-ink-secondary animate-fade-up">
                        <strong className="font-medium text-ink">Error — </strong>
                        {qcState.message}
                        <button
                          type="button"
                          onClick={() => void runQuickCheck()}
                          className="ml-3 font-medium text-primary hover:text-primary-light"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {(qcState.status === "streaming" ||
                      qcState.status === "done") && (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm font-medium text-ink-secondary">
                            {qcState.status === "streaming" ? (
                              <>
                                Generating…{" "}
                                <span className="text-ink">
                                  {qcState.questions.length} / 6
                                </span>
                              </>
                            ) : (
                              <>
                                {qcState.questions.length} questions for{" "}
                                <span className="font-mono text-ink">
                                  {qcRepoName}
                                </span>
                              </>
                            )}
                          </p>
                          {qcState.status === "done" && (
                            <button
                              type="button"
                              onClick={() => setQcState({ status: "idle" })}
                              className="text-sm text-ink-muted transition-colors hover:text-ink"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-4">
                          {qcState.questions.map((q, i) => (
                            <QuickCard
                              key={q.id}
                              question={q}
                              animDelay={i * 60}
                            />
                          ))}
                          {qcState.status === "streaming" &&
                            qcState.questions.length < 3 &&
                            Array.from({ length: 3 }).map((_, i) => (
                              <QuestionSkeleton key={`qcsk-${i}`} />
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Fixed export button — only for full prep done state */}
      {isDone && activeTab === "full" && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-white shadow-md transition-all duration-150 hover:bg-primary-light"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7 1v8M4 6l3 3 3-3M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export Prep Guide
          </button>
        </div>
      )}

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          onExportPdf={() => void handleExportPdf()}
          onExportJson={handleExportJson}
          exporting={exporting}
        />
      )}
    </>
  );
}
