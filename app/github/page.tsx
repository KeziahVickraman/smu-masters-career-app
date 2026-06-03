"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GitHubRepo } from "@/app/api/github/search/route";
import type { SummariseResponse } from "@/app/api/github/summarise/route";
import type { RepoEnrichment } from "@/app/api/github/enrich/route";
import { useProfiles } from "@/contexts/profile-context";
import { SkillsSweeper } from "@/components/github/skills-sweeper";

// ── Enriched repo storage ─────────────────────────────────────────────────────
// Note: uses smu_github_repos (not smu_saved_repos) to avoid conflicting with
// the curated-sweeper page which writes the same key in a different format.
const KEY_GITHUB_REPOS = "smu_github_repos";

export interface EnrichedRepo {
  id: string;           // "owner/repo" — primary key
  full_name: string;    // alias of id, kept for backward compat with interview-prep consumers
  name: string;
  owner: string;
  url: string;
  stars: number;
  language: string | null;
  saved_at: string;
  enriched: boolean;
  enrichment: RepoEnrichment;
  // optional fields passed to quick-check / context building
  description?: string | null;
  topics?: string[];
}

function emptyEnrichment(): RepoEnrichment {
  return {
    summary: "",
    core_concepts: [],
    tools_and_technologies: [],
    difficulty: "Intermediate",
    estimated_hours_to_complete: 0,
    interview_talking_points: [],
    portfolio_strength: "Medium",
    why_relevant: "",
  };
}

function readSavedRepos(): EnrichedRepo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_GITHUB_REPOS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as EnrichedRepo[]).filter(
      (r) => typeof r.id === "string" && r.id,
    );
  } catch {
    return [];
  }
}

function writeSavedRepos(repos: EnrichedRepo[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_GITHUB_REPOS, JSON.stringify(repos));
}

// Map a persisted saved repo back into the GitHubRepo shape the feed renders.
// Lets the Saved filter show repos straight from localStorage, regardless of
// what the current live search results contain.
function enrichedToRepo(sr: EnrichedRepo): GitHubRepo {
  return {
    id: 0, // unused for rendering; cards key off full_name
    full_name: sr.full_name,
    name: sr.name,
    owner: sr.owner,
    description: sr.description ?? null,
    stars: sr.stars,
    forks: 0,
    open_issues: 0,
    topics: sr.topics ?? [],
    html_url: sr.url,
    language: sr.language,
    difficulty: sr.enrichment.difficulty,
  };
}

// ── Skill helpers ─────────────────────────────────────────────────────────────
function flatSkills(skills?: Record<string, string[]>): string[] {
  if (!skills) return [];
  return Object.values(skills).flat();
}

// ── Filter type ───────────────────────────────────────────────────────────────
type Filter = "All" | "Beginner" | "Intermediate" | "Advanced" | "Saved";
const FILTERS: Filter[] = ["All", "Beginner", "Intermediate", "Advanced", "Saved"];

// ── Difficulty badge tone ─────────────────────────────────────────────────────
type BadgeTone = "success" | "warning" | "primary";

function difficultyTone(level: GitHubRepo["difficulty"]): BadgeTone {
  if (level === "Beginner") return "success";
  if (level === "Intermediate") return "warning";
  return "primary";
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function RepoCardSkeleton() {
  return (
    <div className="card animate-pulse flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded-sm bg-surface-muted" />
        <div className="h-4 w-40 rounded bg-surface-muted" />
      </div>
      <div className="h-3 w-24 rounded bg-surface-muted" />
      <div className="mt-2 space-y-2">
        <div className="h-3 w-full rounded bg-surface-muted" />
        <div className="h-3 w-5/6 rounded bg-surface-muted" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 rounded-sm bg-surface-muted" />
        <div className="h-5 w-16 rounded-sm bg-surface-muted" />
      </div>
      <div className="mt-4 h-9 w-full rounded-md bg-surface-muted" />
    </div>
  );
}

// ── AI summary state ───────────────────────────────────────────────────────────
type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: SummariseResponse }
  | { status: "error"; message: string };

// ── Individual repo card ──────────────────────────────────────────────────────
function RepoCard({
  repo,
  isSaved,
  isEnriching,
  enrichmentFailed,
  enrichmentData,
  onToggleSave,
  onRetryEnrich,
  userProfile,
  animationDelay,
}: {
  repo: GitHubRepo;
  isSaved: boolean;
  isEnriching: boolean;
  enrichmentFailed: boolean;
  enrichmentData: RepoEnrichment | null;
  onToggleSave: (repo: GitHubRepo) => void;
  onRetryEnrich: (repo: GitHubRepo) => void;
  userProfile: { user?: { programme?: string; target_role?: string; current_role?: string; skills_self_reported?: Record<string, string[]> } } | null;
  animationDelay: number;
}) {
  const [summary, setSummary] = useState<SummaryState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const hasTriggeredRef = useRef(false);

  const displayDifficulty: GitHubRepo["difficulty"] =
    summary.status === "done" ? summary.data.difficulty : repo.difficulty;

  const handleExpand = useCallback(async () => {
    setExpanded(true);
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    setSummary({ status: "loading" });

    try {
      const res = await fetch("/api/github/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.full_name,
          description: repo.description,
          topics: repo.topics,
          language: repo.language,
          stars: repo.stars,
          userProfile: userProfile?.user
            ? {
                programme: userProfile.user.programme,
                target_role: userProfile.user.target_role,
                current_role: userProfile.user.current_role,
                skills_self_reported: userProfile.user.skills_self_reported,
              }
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setSummary({ status: "error", message: err.error ?? "Unknown error" });
        return;
      }

      const data = (await res.json()) as SummariseResponse;
      setSummary({ status: "done", data });
    } catch (err) {
      setSummary({ status: "error", message: String(err) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, userProfile]);

  return (
    <Card
      className="flex flex-col animate-fade-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Badge tone={difficultyTone(displayDifficulty)}>
            {displayDifficulty}
          </Badge>
          <span className="font-mono text-[13px] font-medium text-ink truncate max-w-[220px]">
            {repo.full_name}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(repo)}
          aria-label={isSaved ? "Remove from portfolio" : "Save to portfolio"}
          className="shrink-0 text-sm font-medium transition-colors duration-150 text-ink-secondary hover:text-ink"
        >
          {isSaved ? "★ Saved" : "☆ Save"}
        </button>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-3 text-[13px] text-ink-muted">
        <span>★ {repo.stars.toLocaleString()}</span>
        {repo.language && (
          <span className="font-mono text-[11px] uppercase tracking-wider">
            {repo.language}
          </span>
        )}
        <span>{repo.owner}</span>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="mt-3 text-[0.9375rem] leading-6 text-ink-secondary line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 6).map((topic) => (
            <Badge key={topic} tone="default">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* AI summary */}
      {!expanded ? (
        <button
          type="button"
          onClick={handleExpand}
          className="mt-4 text-left text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
        >
          {summary.status === "done" ? "Show AI summary →" : "Get AI summary →"}
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-border bg-surface-muted/60 p-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-expanded={true}
            className="mb-2 flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              AI summary
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="shrink-0 rotate-180 text-ink-muted transition-transform"
              aria-hidden="true"
            >
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {summary.status === "loading" && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full rounded bg-surface-muted" />
              <div className="h-3 w-5/6 rounded bg-surface-muted" />
              <div className="mt-3 flex gap-2">
                <div className="h-5 w-20 rounded-sm bg-surface-muted" />
                <div className="h-5 w-20 rounded-sm bg-surface-muted" />
              </div>
            </div>
          )}
          {summary.status === "error" && (
            <p className="text-sm text-ink-muted">
              Could not generate summary: {summary.message}
            </p>
          )}
          {summary.status === "done" && (
            <>
              <p className="text-[0.9375rem] leading-6 text-ink-secondary">
                {summary.data.summary}
              </p>
              {summary.data.skills_to_gain.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                    Skills you&apos;d gain
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.data.skills_to_gain.map((skill) => (
                      <Badge key={skill} tone="info">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Enrichment panel — only shown when saved */}
      {isSaved && isEnriching && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface-muted/60 px-3 py-2.5 animate-pulse">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-primary/60"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Analysing repo…
          </p>
        </div>
      )}

      {isSaved && enrichmentFailed && !isEnriching && (
        <div className="mt-4 flex items-center justify-between rounded-md border border-warning/30 bg-surface-muted/60 px-3 py-2.5">
          <p className="text-[0.8125rem] text-ink-muted">
            Analysis failed
          </p>
          <button
            type="button"
            onClick={() => onRetryEnrich(repo)}
            className="text-[0.8125rem] font-medium text-primary transition-colors hover:text-primary-light"
          >
            Retry →
          </button>
        </div>
      )}

      {isSaved && !isEnriching && !enrichmentFailed && enrichmentData && (
        <div className="mt-4 rounded-md border border-primary/15 bg-primary/3 p-3">
          {/* Portfolio strength badge — header doubles as collapse toggle */}
          <button
            type="button"
            onClick={() => setIntelOpen((o) => !o)}
            aria-expanded={intelOpen}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`shrink-0 text-primary/60 transition-transform ${intelOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary/70">
                Interview intel
              </span>
            </span>
            <Badge
              tone={
                enrichmentData.portfolio_strength === "High"
                  ? "success"
                  : enrichmentData.portfolio_strength === "Low"
                  ? "warning"
                  : "default"
              }
            >
              {enrichmentData.portfolio_strength} portfolio signal
            </Badge>
          </button>

          {intelOpen && (
            <>
              {/* Talking points */}
              {enrichmentData.interview_talking_points.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {enrichmentData.interview_talking_points.map((tp, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[0.8125rem] leading-5 text-ink-secondary"
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[10px] text-primary/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {tp}
                    </li>
                  ))}
                </ul>
              )}

              {/* Core concepts */}
              {enrichmentData.core_concepts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {enrichmentData.core_concepts.slice(0, 6).map((c) => (
                    <Badge key={c} tone="info">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Why relevant */}
              {enrichmentData.why_relevant && (
                <p className="mt-3 text-[0.8125rem] leading-5 text-ink-muted italic">
                  {enrichmentData.why_relevant}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          href={repo.html_url}
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          size="compact"
          className="flex-1"
        >
          View on GitHub ↗
        </Button>
        <Button
          type="button"
          variant={isSaved ? "danger" : "primary"}
          size="compact"
          onClick={() => onToggleSave(repo)}
          className="flex-1"
        >
          {isSaved ? "Remove" : "Save to Portfolio"}
        </Button>
      </div>
    </Card>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ filter, query }: { filter: Filter; query: string }) {
  if (!query && filter === "All") {
    return (
      <div className="col-span-2 py-20 text-center">
        <p className="text-[0.9375rem] font-medium text-ink">
          Discover repos matched to your goals
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Search by keyword above, or complete your profile to get repos
          tailored to your programme, role, and skills.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-light"
          >
            Complete profile →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-2 py-16 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">
        {filter === "Saved"
          ? "No saved repos yet."
          : `No ${filter === "All" ? "" : filter.toLowerCase() + " "}repos found.`}
      </p>
      {filter !== "Saved" && query && (
        <p className="mt-1 text-sm text-ink-muted">
          Searched:{" "}
          <span className="font-mono text-[12px]">{query}</span>
        </p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function GitHubResourceSweeperPage() {
  const { activeProfile } = useProfiles();

  // Active tab: "repos" = existing Repo Sweeper, "skills" = new Skills Sweeper
  const [view, setView] = useState<"repos" | "skills">("repos");
  // Cross-feature bridge: skill name a "Find repos →" click is showing repos for
  const [bridgeSkill, setBridgeSkill] = useState<string | null>(null);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [savedRepos, setSavedRepos] = useState<EnrichedRepo[]>([]);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Load saved repos from localStorage on mount
  useEffect(() => {
    setSavedRepos(readSavedRepos());
  }, []);

  const fetchRepos = useCallback(
    async (keywords: string) => {
      const user = activeProfile?.user;
      const skills = flatSkills(user?.skills_self_reported);

      const res = await fetch("/api/github/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme: user?.programme ?? "",
          targetRole: user?.target_role ?? "",
          skills,
          keywords,
        }),
      });
      const data = (await res.json()) as {
        repos?: GitHubRepo[];
        error?: string;
        query?: string;
      };
      if (data.error) throw new Error(data.error);
      return data;
    },
    [activeProfile],
  );

  // Initial load: fetch repos when profile is available
  useEffect(() => {
    const user = activeProfile?.user;
    const hasProfileData = !!(
      user?.programme ||
      user?.target_role ||
      flatSkills(user?.skills_self_reported).length > 0
    );

    if (!hasProfileData) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchRepos("")
      .then((data) => {
        setRepos(data.repos ?? []);
        setQuery(data.query ?? "");
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [fetchRepos, activeProfile]);

  const handleSearch = useCallback(async () => {
    const kw = searchInput.trim();
    setSearching(true);
    setError(null);
    setFilter("All");
    setBridgeSkill(null);
    try {
      const data = await fetchRepos(kw);
      setRepos(data.repos ?? []);
      setQuery(data.query ?? "");
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setSearching(false);
    }
  }, [searchInput, fetchRepos]);

  const handleClear = useCallback(async () => {
    setSearchInput("");
    setError(null);
    setFilter("All");
    setBridgeSkill(null);

    const user = activeProfile?.user;
    const hasProfileData = !!(
      user?.programme ||
      user?.target_role ||
      flatSkills(user?.skills_self_reported).length > 0
    );

    if (!hasProfileData) {
      setRepos([]);
      setQuery("");
      return;
    }

    setSearching(true);
    try {
      const data = await fetchRepos("");
      setRepos(data.repos ?? []);
      setQuery(data.query ?? "");
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setSearching(false);
    }
  }, [fetchRepos, activeProfile]);

  // Enrichment logic — extracted so it can be called on save and on retry
  const runEnrichment = useCallback(
    async (repo: GitHubRepo) => {
      const id = repo.full_name;

      setEnrichingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setFailedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      try {
        const res = await fetch("/api/github/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.name,
            stars: repo.stars,
            language: repo.language,
            description: repo.description,
            topics: repo.topics,
            url: repo.html_url,
            userProfile: activeProfile?.user
              ? {
                  programme: activeProfile.user.programme,
                  target_role: activeProfile.user.target_role,
                  current_role: activeProfile.user.current_role,
                  target_industry: activeProfile.user.target_industry,
                  skills_self_reported:
                    activeProfile.user.skills_self_reported,
                }
              : undefined,
          }),
        });

        if (res.ok) {
          const enrichment = (await res.json()) as import("@/app/api/github/enrich/route").RepoEnrichment;
          setSavedRepos((prev) => {
            const next = prev.map((r) =>
              r.id === id ? { ...r, enriched: true, enrichment } : r,
            );
            writeSavedRepos(next);
            return next;
          });
        } else {
          setFailedIds((prev) => new Set(prev).add(id));
        }
      } catch {
        setFailedIds((prev) => new Set(prev).add(id));
      } finally {
        setEnrichingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [activeProfile],
  );

  const handleToggleSave = useCallback(
    (repo: GitHubRepo) => {
      const id = repo.full_name;
      const isSaved = savedRepos.some((r) => r.id === id);

      if (isSaved) {
        setSavedRepos((prev) => {
          const next = prev.filter((r) => r.id !== id);
          writeSavedRepos(next);
          return next;
        });
        setEnrichingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setFailedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      // Instantly save with enriched: false
      const newEntry: EnrichedRepo = {
        id,
        full_name: id,
        name: repo.name,
        owner: repo.owner,
        url: repo.html_url,
        stars: repo.stars,
        language: repo.language,
        saved_at: new Date().toISOString(),
        enriched: false,
        enrichment: emptyEnrichment(),
        description: repo.description,
        topics: repo.topics,
      };

      setSavedRepos((prev) => {
        const next = [...prev, newEntry];
        writeSavedRepos(next);
        return next;
      });

      // Kick off background enrichment
      void runEnrichment(repo);
    },
    [savedRepos, runEnrichment],
  );

  const handleRetryEnrich = useCallback(
    (repo: GitHubRepo) => {
      void runEnrichment(repo);
    },
    [runEnrichment],
  );

  // Cross-feature bridge from Skills Sweeper: switch to Repo Sweeper, pre-load a
  // keyword search for the gap skill, and auto-trigger it.
  const handleFindRepos = useCallback(
    (skill: string) => {
      setView("repos");
      setSearchInput(skill);
      setBridgeSkill(skill);
      setFilter("All");
      setError(null);
      setSearching(true);
      fetchRepos(skill)
        .then((data) => {
          setRepos(data.repos ?? []);
          setQuery(data.query ?? "");
        })
        .catch((err: unknown) => setError(String(err)))
        .finally(() => setSearching(false));
    },
    [fetchRepos],
  );

  // Visible repos based on active filter. The Saved view reads from the
  // localStorage-backed savedRepos dataset directly, so saved repos show even
  // when they aren't part of the current live search results.
  const visibleRepos: GitHubRepo[] =
    filter === "Saved"
      ? savedRepos.map(enrichedToRepo)
      : repos.filter((repo) => {
          if (filter === "All") return true;
          return repo.difficulty === filter;
        });

  const programmeLabel = activeProfile?.user?.programme?.replace(/_/g, " ") ?? null;
  const roleLabel = activeProfile?.user?.target_role ?? null;

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

        {/* Page header */}
        <section className="mt-8 max-w-[800px] animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            GitHub Resource Sweeper
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-7 text-ink-secondary">
            {programmeLabel || roleLabel ? (
              <>
                Curated repos for{" "}
                {roleLabel && (
                  <strong className="font-medium text-ink">{roleLabel}</strong>
                )}
                {roleLabel && programmeLabel && " · "}
                {programmeLabel && (
                  <span className="font-mono text-[13px]">{programmeLabel}</span>
                )}
                . Save repos — Claude will analyse each one and surface
                interview talking points tailored to your role.
              </>
            ) : (
              <>
                Public repository explorer. Complete your{" "}
                <Link
                  href="/onboarding"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  onboarding profile
                </Link>{" "}
                to get personalised results.
              </>
            )}
          </p>
        </section>

        {/* Tab toggle — Repo Sweeper / Skills Sweeper */}
        <div
          className="mt-6 flex items-center gap-2 animate-fade-up"
          style={{ animationDelay: "20ms" }}
          role="tablist"
          aria-label="Sweeper view"
        >
          {(
            [
              { id: "repos", label: "Repo Sweeper" },
              { id: "skills", label: "Skills Sweeper" },
            ] as const
          ).map((tab) => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setView(tab.id)}
                className={`inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Skills Sweeper tab ─────────────────────────────────────────── */}
        {view === "skills" && (
          <SkillsSweeper
            activeProfile={activeProfile}
            onFindRepos={handleFindRepos}
          />
        )}

        {/* ── Repo Sweeper tab (existing) ────────────────────────────────── */}
        {view === "repos" && (
          <>
        {/* Bridge banner — set when arriving from a Skills Sweeper gap skill */}
        {bridgeSkill && (
          <div
            className="mt-5 flex items-center gap-3 rounded-md border border-primary/20 bg-primary/3 px-4 py-2.5 animate-fade-up"
            style={{ animationDelay: "20ms" }}
          >
            <p className="text-[0.8125rem] text-ink-secondary">
              Showing repos for:{" "}
              <span className="font-mono text-[12px] font-medium text-primary">
                {bridgeSkill}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setBridgeSkill(null)}
              aria-label="Dismiss"
              className="ml-auto shrink-0 text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Saved repos summary strip — shown when any repos are saved */}
        {savedRepos.length > 0 && (
          <div
            className="mt-5 flex items-center gap-3 rounded-md border border-primary/20 bg-primary/3 px-4 py-2.5 animate-fade-up"
            style={{ animationDelay: "30ms" }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-semibold text-white">
              {savedRepos.length}
            </span>
            <p className="text-[0.8125rem] text-ink-secondary">
              <strong className="font-medium text-ink">
                {savedRepos.length} {savedRepos.length === 1 ? "repo" : "repos"}
              </strong>{" "}
              saved to your portfolio
              {savedRepos.filter((r) => r.enriched).length > 0 && (
                <>
                  {" · "}
                  <span className="text-primary">
                    {savedRepos.filter((r) => r.enriched).length} enriched
                  </span>
                </>
              )}
              {enrichingIds.size > 0 && (
                <span className="ml-1 animate-pulse text-ink-muted">
                  · analysing {enrichingIds.size}…
                </span>
              )}
            </p>
            <Link
              href="/interview-prep"
              className="ml-auto shrink-0 text-[0.8125rem] font-medium text-primary transition-colors hover:text-primary-light"
            >
              Use in Interview Prep →
            </Link>
          </div>
        )}

        {/* Search bar */}
        <div
          className="mt-6 flex items-center gap-2 animate-fade-up"
          style={{ animationDelay: "50ms" }}
        >
          <div className="relative flex-1 max-w-xl">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
              placeholder="Search by keyword — e.g. transformer, NLP, portfolio…"
              aria-label="Search GitHub repositories by keyword"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-10 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none transition-colors duration-150"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors duration-150 hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching}
            className="inline-flex h-10 items-center justify-center rounded-md border border-primary bg-primary px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Filter bar */}
        <div
          className="mt-4 flex flex-wrap items-center gap-2 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f;
            const count =
              f === "All"
                ? repos.length
                : f === "Saved"
                ? savedRepos.length
                : repos.filter((r) => r.difficulty === f).length;

            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
                }`}
              >
                {f}
                {!loading && count > 0 && (
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

          {!loading && query && (
            <span className="ml-auto font-mono text-[11px] text-ink-muted">
              query:{" "}
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-ink-secondary">
                {query}
              </span>
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && !loading && (
          <div
            className="mt-6 rounded-md border border-warning/40 bg-surface-muted p-4 text-sm text-ink-secondary animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <strong className="font-medium text-ink">Setup required — </strong>
            {error}
          </div>
        )}

        {/* Repo grid */}
        <section
          className="mt-8 grid gap-5 md:grid-cols-2"
          aria-label="GitHub repositories"
        >
          {loading || searching ? (
            Array.from({ length: 6 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))
          ) : visibleRepos.length === 0 ? (
            <EmptyState filter={filter} query={query} />
          ) : (
            visibleRepos.map((repo, index) => {
              const savedEntry = savedRepos.find(
                (sr) => sr.id === repo.full_name,
              );
              const isSaved = !!savedEntry;
              return (
                <RepoCard
                  key={repo.full_name}
                  repo={repo}
                  isSaved={isSaved}
                  isEnriching={enrichingIds.has(repo.full_name)}
                  enrichmentFailed={failedIds.has(repo.full_name)}
                  enrichmentData={
                    savedEntry?.enriched ? savedEntry.enrichment : null
                  }
                  onToggleSave={handleToggleSave}
                  onRetryEnrich={handleRetryEnrich}
                  userProfile={activeProfile}
                  animationDelay={index * 50}
                />
              );
            })
          )}
        </section>

        {/* Onboarding nudge when no profile */}
        {!loading && !activeProfile?.user?.programme && repos.length > 0 && (
          <p
            className="mt-10 text-center text-sm text-ink-muted animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            Results are generic.{" "}
            <Link
              href="/onboarding"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Complete your profile →
            </Link>{" "}
            for programme-specific repos.
          </p>
        )}
          </>
        )}
      </main>
    </>
  );
}
