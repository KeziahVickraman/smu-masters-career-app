"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SavedRepo } from "@/app/api/interview/questions/route";

const KEY_SAVED_REPOS = "smu_saved_repos";

// ── Curated repo definitions ──────────────────────────────────────────────────
interface CuratedRepo extends SavedRepo {
  difficulty: "beginner" | "intermediate" | "advanced";
  href: string;
}

const CURATED_REPOS: CuratedRepo[] = [
  {
    full_name: "smu-msda/course-repo",
    description:
      "Course materials and assignments with issues tagged good-first-issue for practice contributions.",
    topics: ["python", "pandas", "git"],
    language: "Python",
    skills_to_gain: ["Python", "Pandas", "Git"],
    difficulty: "beginner",
    href: "https://github.com",
  },
  {
    full_name: "open-analytics/singapore-transit",
    description:
      "Public datasets and notebooks focusing on operations research and forecasting techniques.",
    topics: ["time-series", "sql", "operations-research"],
    language: "Jupyter Notebook",
    skills_to_gain: ["Time Series", "SQL", "Operations Research"],
    difficulty: "intermediate",
    href: "https://github.com",
  },
  {
    full_name: "quant-lab/research-toolkit",
    description:
      "Low-level utilities for backtesting and signal research; expect deeper PR review cycles.",
    topics: ["quantitative-finance", "backtesting", "statistics"],
    language: "C++",
    skills_to_gain: ["C++", "Quantitative Research", "Statistics"],
    difficulty: "advanced",
    href: "https://github.com",
  },
  {
    full_name: "biz-ai/knowledge-base",
    description:
      "Patterns for LLM evaluation and prompt engineering with doc-driven contribution paths.",
    topics: ["llm", "prompt-engineering", "evaluations"],
    language: "Python",
    skills_to_gain: ["LLM", "Prompt Engineering", "Evaluations"],
    difficulty: "intermediate",
    href: "https://github.com",
  },
];

function difficultyTone(
  level: CuratedRepo["difficulty"],
): "success" | "warning" | "primary" {
  if (level === "beginner") return "success";
  if (level === "intermediate") return "warning";
  return "primary";
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function readSavedRepos(): SavedRepo[] {
  try {
    const raw = localStorage.getItem(KEY_SAVED_REPOS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === "number") return [];
    const seen = new Set<string>();
    return (parsed as SavedRepo[]).filter(
      (r) => typeof r.full_name === "string" && r.full_name && !seen.has(r.full_name) && seen.add(r.full_name),
    );
  } catch {
    return [];
  }
}

function writeSavedRepos(repos: SavedRepo[]) {
  localStorage.setItem(KEY_SAVED_REPOS, JSON.stringify(repos));
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GitHubResourceSweeperPage() {
  const [savedRepos, setSavedRepos] = useState<SavedRepo[]>([]);

  useEffect(() => {
    setSavedRepos(readSavedRepos());
  }, []);

  // Derived set for O(1) lookup in card renders
  const savedNames = useMemo(
    () => new Set(savedRepos.map((r) => r.full_name)),
    [savedRepos],
  );

  const toggleSave = useCallback((repo: CuratedRepo) => {
    setSavedRepos((prev) => {
      const isSaved = prev.some((r) => r.full_name === repo.full_name);
      let next: SavedRepo[];
      if (isSaved) {
        next = prev.filter((r) => r.full_name !== repo.full_name);
      } else {
        // Strip display-only fields before storing
        const { href: _href, difficulty: _diff, ...savedRepo } = repo;
        next = [...prev, savedRepo];
      }
      writeSavedRepos(next);
      return next;
    });
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        <Link
          href="/"
          className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-8 max-w-[800px] animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            GitHub Resource Sweeper
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-ink-secondary">
            Save repos to your portfolio — Claude will reference your saved projects
            when generating interview questions, so every question is grounded in work
            you&apos;ve actually done or studied.
          </p>
        </section>

        {/* Two-column layout: repo feed on left, saved panel on right */}
        <div className="mt-10 flex items-start gap-8">
          {/* Repo cards grid */}
          <section className="min-w-0 flex-1 grid gap-5 sm:grid-cols-2">
            {CURATED_REPOS.map((repo, index) => {
              const isSaved = savedNames.has(repo.full_name);
              return (
                <Card
                  key={repo.full_name}
                  className="flex h-full flex-col animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={difficultyTone(repo.difficulty)}>
                      {repo.difficulty}
                    </Badge>
                    {isSaved && <Badge tone="success">Saved ✓</Badge>}
                  </div>

                  {/* Repo name */}
                  <p className="mt-2 font-mono text-sm text-ink">{repo.full_name}</p>

                  {/* Description */}
                  <p className="mt-3 flex-1 text-[0.9375rem] leading-6 text-ink-secondary">
                    {repo.description}
                  </p>

                  {/* Skill badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(repo.skills_to_gain ?? []).map((skill) => (
                      <Badge key={skill} tone="default">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="secondary"
                      href={repo.href}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View on GitHub
                    </Button>

                    <button
                      type="button"
                      onClick={() => toggleSave(repo)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                        isSaved
                          ? "border-warning/40 bg-surface-muted text-ink-secondary hover:border-accent/40 hover:text-accent"
                          : "border-primary bg-primary text-white hover:bg-primary-light"
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Saved — remove
                        </>
                      ) : (
                        <>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M6 1v10M1 6h10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          Save to portfolio
                        </>
                      )}
                    </button>
                  </div>
                </Card>
              );
            })}
          </section>

          {/* Saved Repos panel — sticky on desktop */}
          <aside className="hidden md:block w-64 shrink-0 sticky top-24">
            <div className="overflow-hidden rounded-lg border border-primary/25 bg-primary/3 shadow-[0_2px_8px_rgba(0,33,71,0.08)]">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-primary/15 bg-primary/6 px-4 py-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
                  Portfolio
                </p>
                <span className="font-mono text-[11px] font-semibold text-primary/70">
                  {savedRepos.length} / {CURATED_REPOS.length} saved
                </span>
              </div>

              <div className="p-4">
                {savedRepos.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-primary/20 px-4 py-6 text-center">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                      className="text-primary/30"
                    >
                      <rect
                        x="2"
                        y="3"
                        width="16"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M10 7v6M7 10h6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="text-[0.8125rem] leading-5 text-ink-muted">
                      Save repos from the feed to build your portfolio evidence
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col divide-y divide-primary/10">
                      {savedRepos.map((repo) => {
                        const curatedRepo = CURATED_REPOS.find(
                          (r) => r.full_name === repo.full_name,
                        );
                        return (
                          <div
                            key={repo.full_name}
                            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-mono text-[11px] leading-tight text-ink">
                                {repo.full_name}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  curatedRepo && toggleSave(curatedRepo)
                                }
                                aria-label={`Remove ${repo.full_name} from saved`}
                                className="shrink-0 text-ink-muted transition-colors duration-150 hover:text-accent"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 10 10"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M1 1l8 8M9 1L1 9"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {curatedRepo && (
                                <Badge tone={difficultyTone(curatedRepo.difficulty)}>
                                  {curatedRepo.difficulty}
                                </Badge>
                              )}
                              {(repo.skills_to_gain ?? []).slice(0, 3).map((skill) => (
                                <Badge key={skill} tone="default">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Link
                      href="/interview-prep"
                      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
                    >
                      Use in Interview Prep
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
