"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  SkillsSweepResponse,
  SkillsSweepResult,
  TrendingSkill,
} from "@/app/api/skills/sweep/route";
import type { UserProfile } from "@/lib/schema";

// ── Cache ────────────────────────────────────────────────────────────────────
// New key, written/read directly here (not profile data, so no profiles helper).
const KEY_SKILLS_SWEEP = "smu_skills_sweep";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // re-sweep allowed once a day

interface SkillsSweepCache {
  swept_at: string; // ISO date
  target_role: string;
  result: SkillsSweepResult;
  meta: SkillsSweepResponse["meta"];
}

function readCache(): SkillsSweepCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_SKILLS_SWEEP);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SkillsSweepCache;
    if (!parsed || typeof parsed.swept_at !== "string" || !parsed.result) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: SkillsSweepCache) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_SKILLS_SWEEP, JSON.stringify(cache));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function flatSkills(skills?: Record<string, string[]>): string[] {
  if (!skills) return [];
  return Object.values(skills).flat();
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function isStale(iso: string): boolean {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return true;
  return Date.now() - then > CACHE_TTL_MS;
}

// Classify a trending skill into a colour band per DESIGN: green = user has it,
// navy = emerging, amber = user doesn't have it.
type SkillBand = "have" | "emerging" | "gap";

function momentumGlyph(m: TrendingSkill["momentum"]): string {
  if (m === "Rising") return "↑";
  if (m === "Declining") return "↓";
  return "–";
}

// ── Skeletons ──────────────────────────────────────────────────────────────────
function SweepSkeleton() {
  return (
    <div className="mt-8 space-y-8 animate-pulse">
      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="h-3 w-28 rounded bg-surface-muted" />
            <div className="h-8 w-16 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
      {/* Heatmap */}
      <div className="card">
        <div className="h-4 w-40 rounded bg-surface-muted" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="h-7 rounded-sm bg-surface-muted"
              style={{ width: `${60 + ((i * 23) % 80)}px` }}
            />
          ))}
        </div>
      </div>
      {/* Lists */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card">
          <div className="h-4 w-56 rounded bg-surface-muted" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-6 w-24 rounded-sm bg-surface-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section shell ────────────────────────────────────────────────────────────
function SectionHeading({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <h2
      className="font-display text-[1.375rem] font-semibold text-primary animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </h2>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export function SkillsSweeper({
  activeProfile,
  onFindRepos,
}: {
  activeProfile: UserProfile | null;
  onFindRepos: (skill: string) => void;
}) {
  const [cache, setCache] = useState<SkillsSweepCache | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const user = activeProfile?.user;
  const hasProfile = !!(user?.target_role || user?.programme);

  const runSweep = useCallback(async () => {
    if (!user) return;
    setSweeping(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: user.target_role ?? "",
          target_industry: user.target_industry ?? "",
          programme: user.programme ?? "",
          skills_self_reported: user.skills_self_reported ?? {},
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? `Sweep failed (${res.status}).`);
        return;
      }

      const data = (await res.json()) as SkillsSweepResponse;
      const next: SkillsSweepCache = {
        swept_at: new Date().toISOString(),
        target_role: data.meta.target_role || user.target_role || "",
        result: data.result,
        meta: data.meta,
      };
      writeCache(next);
      setCache(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setSweeping(false);
    }
  }, [user]);

  // Load cache instantly on mount; sweep only when missing or stale (>24h).
  useEffect(() => {
    const cached = readCache();
    if (cached) setCache(cached);
    setHydrated(true);

    if (!hasProfile) return;
    if (!cached) {
      void runSweep(); // first ever sweep — skeletons shown (no cache)
    } else if (isStale(cached.swept_at)) {
      void runSweep(); // background refresh — cached data stays on screen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived view data ─────────────────────────────────────────────────────
  const result = cache?.result ?? null;
  const meta = cache?.meta ?? null;

  const userSkillSet = useMemo(
    () =>
      new Set(
        flatSkills(user?.skills_self_reported).map((s) => s.toLowerCase()),
      ),
    [user?.skills_self_reported],
  );

  const emergingSet = useMemo(
    () => new Set((result?.emerging ?? []).map((s) => s.toLowerCase())),
    [result?.emerging],
  );

  const strengthSet = useMemo(
    () => new Set((result?.your_strengths ?? []).map((s) => s.toLowerCase())),
    [result?.your_strengths],
  );

  const freqLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of result?.trending_skills ?? []) {
      map.set(t.skill.toLowerCase(), t.frequency);
    }
    return map;
  }, [result?.trending_skills]);

  const maxFreq = useMemo(
    () =>
      Math.max(1, ...(result?.trending_skills ?? []).map((t) => t.frequency)),
    [result?.trending_skills],
  );

  const classify = useCallback(
    (skill: string): SkillBand => {
      const lower = skill.toLowerCase();
      if (emergingSet.has(lower)) return "emerging";
      if (userSkillSet.has(lower) || strengthSet.has(lower)) return "have";
      return "gap";
    },
    [emergingSet, userSkillSet, strengthSet],
  );

  // Gaps ranked by frequency (Section E).
  const rankedGaps = useMemo(() => {
    return (result?.your_gaps ?? [])
      .map((skill) => ({ skill, frequency: freqLookup.get(skill.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.frequency - a.frequency);
  }, [result?.your_gaps, freqLookup]);

  // ── Render states ─────────────────────────────────────────────────────────
  // Avoid hydration mismatch: render nothing data-specific until mounted.
  if (!hydrated) {
    return <SweepSkeleton />;
  }

  if (!hasProfile) {
    return (
      <div className="mt-8 card text-center">
        <p className="text-[0.9375rem] font-medium text-ink">
          Complete your profile to sweep the skills market
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Skills Sweeper reads your target role, industry, and programme to
          compare what the open-source community and Singapore employers are
          asking for against the skills you already have.
        </p>
        <div className="mt-5 flex justify-center">
          <Button href="/onboarding">Complete profile →</Button>
        </div>
      </div>
    );
  }

  // First sweep in progress, nothing cached yet.
  if (sweeping && !result) {
    return <SweepSkeleton />;
  }

  if (!result) {
    return (
      <div className="mt-8 card">
        {error ? (
          <>
            <p className="text-[0.9375rem] font-medium text-ink">
              Couldn&apos;t sweep the market
            </p>
            <p className="mt-2 text-sm text-ink-muted">{error}</p>
          </>
        ) : (
          <p className="text-[0.9375rem] text-ink-secondary">
            No sweep results yet.
          </p>
        )}
        <div className="mt-4">
          <Button onClick={() => void runSweep()} disabled={sweeping}>
            {sweeping ? "Sweeping…" : "Run sweep"}
          </Button>
        </div>
      </div>
    );
  }

  const roleLabel = cache?.target_role || user?.target_role || "your role";

  return (
    <div className="mt-6">
      {/* Re-sweep control bar */}
      <div
        className="flex flex-wrap items-center gap-3 animate-fade-up"
        style={{ animationDelay: "20ms" }}
      >
        {cache && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Last swept {timeAgo(cache.swept_at)}
          </span>
        )}
        {sweeping && (
          <span className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-primary">
            Re-sweeping…
          </span>
        )}
        <button
          type="button"
          onClick={() => void runSweep()}
          disabled={sweeping}
          className="ml-auto inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink-secondary transition-all duration-150 hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sweeping ? "Sweeping…" : "Re-sweep"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-warning/40 bg-surface-muted p-3 text-sm text-ink-secondary">
          {error}
        </div>
      )}

      {/* ── Section A — Market Pulse ───────────────────────────────────────── */}
      <section className="mt-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { label: "Skills detected", value: result.trending_skills.length },
            { label: "Skills you have", value: result.your_strengths.length },
            { label: "Skills ahead of curve", value: result.value_makers.length },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="card animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-[2rem] font-semibold leading-none text-primary">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <p
          className="mt-3 text-sm text-ink-muted animate-fade-up"
          style={{ animationDelay: "150ms" }}
        >
          Based on{" "}
          <strong className="font-medium text-ink-secondary">
            {meta?.github_repo_count ?? 0} GitHub repos
          </strong>{" "}
          and{" "}
          <strong className="font-medium text-ink-secondary">
            {meta?.job_listing_count ?? 0} Singapore job listings
          </strong>{" "}
          for{" "}
          <span className="font-mono text-[13px] text-ink-secondary">
            {roleLabel}
          </span>
          {meta?.jobs_unavailable && (
            <>
              {" — "}
              <span className="text-warning">
                no live job listings were available, so this sweep reflects
                GitHub signal only.
              </span>
            </>
          )}
        </p>
      </section>

      {/* ── Section B — Trending Skills heatmap ────────────────────────────── */}
      {result.trending_skills.length > 0 && (
        <section className="mt-10">
          <SectionHeading>Trending skills</SectionHeading>
          <p className="mt-1 text-sm text-ink-muted">
            Larger = more frequent. Green = you have it · navy = emerging ·
            amber = gap.
          </p>
          <div className="card mt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {[...result.trending_skills]
                .sort((a, b) => b.frequency - a.frequency)
                .map((t, i) => {
                  const band = classify(t.skill);
                  const scale = 11 + (t.frequency / maxFreq) * 8; // 11–19px
                  const bandClasses =
                    band === "have"
                      ? "border-success/40 bg-success/5 text-success"
                      : band === "emerging"
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-warning/40 bg-warning/5 text-warning";
                  return (
                    <span
                      key={`${t.skill}-${i}`}
                      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-medium animate-fade-up ${bandClasses}`}
                      style={{
                        fontSize: `${scale}px`,
                        animationDelay: `${Math.min(i * 30, 400)}ms`,
                      }}
                      title={`${t.skill} — ${t.frequency} mention(s), ${t.momentum}`}
                    >
                      <span>{t.skill}</span>
                      <span aria-hidden="true" className="opacity-70">
                        {momentumGlyph(t.momentum)}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">
                        {t.source}
                      </span>
                    </span>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── Section C — Your Strengths ─────────────────────────────────────── */}
      {result.your_strengths.length > 0 && (
        <section className="mt-10">
          <SectionHeading>What the market wants — and you already have</SectionHeading>
          <div className="card mt-4 border-success/30">
            <div className="flex flex-wrap gap-2">
              {result.your_strengths.map((skill) => {
                const freq = freqLookup.get(skill.toLowerCase());
                return (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-success/40 bg-success/5 px-2.5 py-1 font-mono text-[12px] font-medium text-success"
                  >
                    {skill}
                    {freq != null && (
                      <span className="text-[10px] opacity-70">×{freq}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Section D — Value Makers ───────────────────────────────────────── */}
      {result.value_makers.length > 0 && (
        <section className="mt-10">
          <SectionHeading>Your edge — ahead of the curve</SectionHeading>
          <div className="card mt-4 border-primary/30">
            <div className="flex flex-wrap gap-2.5">
              {result.value_makers.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/5 px-2.5 py-1 font-mono text-[12px] font-medium text-primary"
                >
                  {skill}
                  <Badge tone="primary" className="!text-[9px]">
                    Emerging
                  </Badge>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Section E — Skills Gap ─────────────────────────────────────────── */}
      {rankedGaps.length > 0 && (
        <section className="mt-10">
          <SectionHeading>Where to focus to stay competitive</SectionHeading>
          <div className="card mt-4 border-warning/30">
            <ul className="divide-y divide-border">
              {rankedGaps.map(({ skill, frequency }) => (
                <li
                  key={skill}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] font-medium text-ink">
                      {skill}
                    </span>
                    {frequency > 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-warning">
                        ×{frequency}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onFindRepos(skill)}
                    className="shrink-0 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-light"
                  >
                    Find repos →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Singapore market signals ───────────────────────────────────────── */}
      {result.singapore_specific.length > 0 && (
        <section className="mt-10">
          <div className="card border-accent/30 bg-accent/3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[1.375rem] font-semibold text-primary">
                Singapore market signals
              </h2>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              These skills are especially valued by Singapore employers.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.singapore_specific.map((skill) => (
                <Badge key={skill} tone="accent">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
