"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GitHubRepo } from "@/app/api/github/search/route";
import type { SummariseResponse } from "@/app/api/github/summarise/route";

// ─── Profile helpers ──────────────────────────────────────────────────────────
type SkillsMap = Record<string, string[]>;

type StoredProfile = {
  user?: {
    programme?: string;
    target_role?: string;
    current_role?: string;
    skills_self_reported?: SkillsMap;
  };
};

function readProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("smu_career_profile");
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  } catch {
    return null;
  }
}

function flatSkills(skills?: SkillsMap): string[] {
  if (!skills) return [];
  return Object.values(skills).flat();
}

// ─── Saved repos helpers ──────────────────────────────────────────────────────
function readSaved(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("smu_saved_repos");
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("smu_saved_repos", JSON.stringify(ids));
}

// ─── Filter type ──────────────────────────────────────────────────────────────
type Filter = "All" | "Beginner" | "Intermediate" | "Advanced" | "Saved";
const FILTERS: Filter[] = ["All", "Beginner", "Intermediate", "Advanced", "Saved"];

// ─── Difficulty badge tone ────────────────────────────────────────────────────
type BadgeTone = "success" | "warning" | "primary";

function difficultyTone(level: GitHubRepo["difficulty"]): BadgeTone {
  if (level === "Beginner") return "success";
  if (level === "Intermediate") return "warning";
  return "primary";
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
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

// ─── AI summary state for a single card ──────────────────────────────────────
type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: SummariseResponse }
  | { status: "error"; message: string };

// ─── Individual repo card ─────────────────────────────────────────────────────
function RepoCard({
  repo,
  isSaved,
  onToggleSave,
  userProfile,
  animationDelay,
}: {
  repo: GitHubRepo;
  isSaved: boolean;
  onToggleSave: (id: number) => void;
  userProfile: StoredProfile | null;
  animationDelay: number;
}) {
  const [summary, setSummary] = useState<SummaryState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);
  const hasTriggered = useRef(false);

  // Difficulty comes from AI response once loaded, falls back to initial heuristic
  const displayDifficulty: GitHubRepo["difficulty"] =
    summary.status === "done" ? summary.data.difficulty : repo.difficulty;

  const handleExpand = useCallback(async () => {
    setExpanded(true);
    if (hasTriggered.current) return;
    hasTriggered.current = true;
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
          onClick={() => onToggleSave(repo.id)}
          aria-label={isSaved ? "Remove from checklist" : "Save to checklist"}
          className="shrink-0 text-sm font-medium transition-colors duration-150 text-ink-secondary hover:text-ink"
          title={isSaved ? "Saved" : "Save to checklist"}
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

      {/* Description (always visible) */}
      {repo.description && (
        <p className="mt-3 text-[0.9375rem] leading-6 text-ink-secondary line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Topics as skill tags */}
      {repo.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 6).map((topic) => (
            <Badge key={topic} tone="default">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* Expand / AI summary section */}
      {!expanded ? (
        <button
          type="button"
          onClick={handleExpand}
          className="mt-4 text-left text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
        >
          Get AI summary →
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-border bg-surface-muted/60 p-3">
          {summary.status === "loading" && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-full rounded bg-surface-muted" />
              <div className="h-3 w-5/6 rounded bg-surface-muted" />
              <div className="mt-3 flex gap-2">
                <div className="h-5 w-20 rounded-sm bg-surface-muted" />
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
                    Skills you'd gain
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
          onClick={() => onToggleSave(repo.id)}
          className="flex-1"
        >
          {isSaved ? "Remove" : "Save to Checklist"}
        </Button>
      </div>
    </Card>
  );
}

// ─── Error / empty states ─────────────────────────────────────────────────────
function EmptyState({ filter, query }: { filter: Filter; query: string }) {
  // No profile and no keyword search yet — prompt the user to get started
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
          Searched: <span className="font-mono text-[12px]">{query}</span>
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GitHubResourceSweeperPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const profileRef = useRef<StoredProfile | null>(null);

  const fetchRepos = useCallback(async (keywords: string) => {
    const user = profileRef.current?.user;
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
  }, []);

  // Initial load from profile
  useEffect(() => {
    const p = readProfile();
    setProfile(p);
    profileRef.current = p;
    setSavedIds(readSaved());

    // Only auto-fetch when the user has at least one profile element to anchor the query
    const user = p?.user;
    const hasProfileData = !!(
      user?.programme ||
      user?.target_role ||
      flatSkills(user?.skills_self_reported).length > 0
    );

    if (!hasProfileData) {
      setLoading(false);
      return;
    }

    fetchRepos("")
      .then((data) => {
        setRepos(data.repos ?? []);
        setQuery(data.query ?? "");
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [fetchRepos]);

  const handleSearch = useCallback(async () => {
    const kw = searchInput.trim();
    setSearching(true);
    setError(null);
    setFilter("All");
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

    const user = profileRef.current?.user;
    const hasProfileData = !!(
      user?.programme ||
      user?.target_role ||
      flatSkills(user?.skills_self_reported).length > 0
    );

    // No profile — just clear results and show the empty prompt
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
  }, [fetchRepos]);

  const handleToggleSave = useCallback((id: number) => {
    setSavedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      writeSaved(next);
      return next;
    });
  }, []);

  const visibleRepos = repos.filter((repo) => {
    if (filter === "Saved") return savedIds.includes(repo.id);
    if (filter === "All") return true;
    return repo.difficulty === filter;
  });

  // Derive display label from profile
  const programmeLabel = profile?.user?.programme?.replace(/_/g, " ") ?? null;
  const roleLabel = profile?.user?.target_role ?? null;

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        {/* Back link */}
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
                . Click <em>Get AI summary</em> on any card for a personalised analysis.
              </>
            ) : (
              <>
                Public repository explorer. Complete your{" "}
                <Link href="/onboarding" className="text-primary underline-offset-2 hover:underline">
                  onboarding profile
                </Link>{" "}
                to get personalised results.
              </>
            )}
          </p>
        </section>

        {/* Search bar */}
        <div
          className="mt-6 flex items-center gap-2 animate-fade-up"
          style={{ animationDelay: "50ms" }}
        >
          <div className="relative flex-1 max-w-xl">
            {/* Search icon */}
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
              onKeyDown={(e) => { if (e.key === "Enter") { void handleSearch(); } }}
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
            onClick={() => { void handleSearch(); }}
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
                  ? savedIds.filter((id) => repos.some((r) => r.id === id)).length
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

          {/* Query pill — shown when a search was made */}
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
            // Skeleton placeholders on initial load and keyword re-search
            Array.from({ length: 6 }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))
          ) : visibleRepos.length === 0 ? (
            <EmptyState filter={filter} query={query} />
          ) : (
            visibleRepos.map((repo, index) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                isSaved={savedIds.includes(repo.id)}
                onToggleSave={handleToggleSave}
                userProfile={profile}
                animationDelay={index * 50}
              />
            ))
          )}
        </section>

        {/* Footer — onboarding nudge when no profile */}
        {!loading && !profile?.user?.programme && repos.length > 0 && (
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
      </main>
    </>
  );
}
