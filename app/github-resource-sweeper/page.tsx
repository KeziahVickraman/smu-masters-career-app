"use client";

import { useEffect, useState, useCallback } from "react";
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
    // Legacy format was number[] — ignore it
    if (typeof parsed[0] === "number") return [];
    return parsed as SavedRepo[];
  } catch {
    return [];
  }
}

function writeSavedRepos(repos: SavedRepo[]) {
  localStorage.setItem(KEY_SAVED_REPOS, JSON.stringify(repos));
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GitHubResourceSweeperPage() {
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = readSavedRepos();
    setSavedNames(new Set(saved.map((r) => r.full_name)));
  }, []);

  const toggleSave = useCallback((repo: CuratedRepo) => {
    setSavedNames((prev) => {
      const next = new Set(prev);
      const existing = readSavedRepos();

      if (next.has(repo.full_name)) {
        // Remove
        next.delete(repo.full_name);
        writeSavedRepos(existing.filter((r) => r.full_name !== repo.full_name));
      } else {
        // Add — strip display-only fields before storing
        const { href: _href, difficulty: _diff, ...savedRepo } = repo;
        next.add(repo.full_name);
        writeSavedRepos([
          ...existing.filter((r) => r.full_name !== repo.full_name),
          savedRepo,
        ]);
      }

      return next;
    });
  }, []);

  const savedCount = savedNames.size;

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

          {/* Saved repos banner */}
          {savedCount > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 animate-fade-up">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {savedCount}
              </span>
              <p className="text-sm text-ink-secondary">
                {savedCount === 1 ? "1 repo" : `${savedCount} repos`} saved to your
                portfolio.{" "}
                <Link
                  href="/interview-prep"
                  className="font-medium text-primary hover:text-primary-light"
                >
                  Go to Interview Prep →
                </Link>
              </p>
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
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
      </main>
    </>
  );
}
