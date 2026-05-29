"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfiles } from "@/contexts/profile-context";

// ── Local state probes ──────────────────────────────────────────────────────
// Each reads a feature's localStorage and reports whether the user has made
// progress there. All reads are guarded — missing/malformed data counts as "not done".

function countSavedRepos(): number {
  const seen = new Set<string>();
  for (const key of ["smu_github_repos", "smu_saved_repos"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const r of parsed) {
        const name = (r as { full_name?: unknown }).full_name;
        if (typeof name === "string" && name) seen.add(name);
      }
    } catch {
      // ignore malformed key
    }
  }
  return seen.size;
}

function hasGeneratedQuestions(): boolean {
  try {
    const raw = localStorage.getItem("smu_interview_questions");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { questions?: unknown };
    return Array.isArray(parsed.questions) && parsed.questions.length > 0;
  } catch {
    return false;
  }
}

function countTrackedJobs(): number {
  try {
    const raw = localStorage.getItem("smu_job_tracker");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface StepView {
  label: string;
  title: string;
  done: boolean;
  href: string;
  cta: string;
}

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15">
      <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M1.5 5l2.5 2.5 4.5-4.5"
          stroke="var(--color-success)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function StepDot({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        active ? "border-primary" : "border-border-strong"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary" : "bg-border-strong"}`}
      />
    </span>
  );
}

export function NextSteps() {
  const { profiles, activeProfile } = useProfiles();

  // localStorage is read after mount to stay SSR-safe and avoid hydration mismatch.
  const [hydrated, setHydrated] = useState(false);
  const [repoCount, setRepoCount] = useState(0);
  const [hasQuestions, setHasQuestions] = useState(false);
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    setRepoCount(countSavedRepos());
    setHasQuestions(hasGeneratedQuestions());
    setJobCount(countTrackedJobs());
    setHydrated(true);
  }, [activeProfile]); // re-probe when the active profile changes

  const hasProfile = !!activeProfile;
  const hasAnyProfile = profiles.length > 0;

  const steps: StepView[] = [
    {
      label: "Step 01",
      title: hasProfile
        ? "Profile active"
        : hasAnyProfile
          ? "Activate a profile"
          : "Set up your profile",
      done: hasProfile,
      href: hasAnyProfile ? "/profile" : "/onboarding",
      cta: hasAnyProfile ? "Choose a profile →" : "Build your profile →",
    },
    {
      label: "Step 02",
      title:
        repoCount > 0
          ? `${repoCount} repo${repoCount === 1 ? "" : "s"} saved`
          : "Save & enrich GitHub repos",
      done: repoCount > 0,
      href: "/github",
      cta: "Open GitHub →",
    },
    {
      label: "Step 03",
      title: hasQuestions
        ? "Interview questions generated"
        : "Generate your interview questions",
      done: hasQuestions,
      href: "/interview-prep",
      cta: "Open Interview Prep →",
    },
    {
      label: "Step 04",
      title:
        jobCount > 0
          ? `${jobCount} application${jobCount === 1 ? "" : "s"} tracked`
          : "Search & track jobs",
      done: jobCount > 0,
      href: "/job-board",
      cta: "Open Job Board →",
    },
  ];

  // The "current" step is the first incomplete one.
  const currentIndex = hydrated ? steps.findIndex((s) => !s.done) : -1;
  const allDone = hydrated && currentIndex === -1;
  const completed = steps.filter((s) => s.done).length;

  return (
    <section className="mt-12 animate-fade-up">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[1.375rem] font-semibold text-ink">
            What to work on next
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            {allDone
              ? "You're set up across every module — keep your repos, questions, and applications current."
              : "Your personalised setup path. Each step builds on the last."}
          </p>
        </div>
        {hydrated && (
          <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            {completed} / {steps.length}
          </span>
        )}
      </div>

      <ul className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          return (
            <li key={step.label}>
              <Card
                interactive={isCurrent}
                className={`flex items-center gap-4 animate-fade-up ${
                  isCurrent ? "border-primary/40" : ""
                } ${step.done ? "opacity-70" : ""}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {step.done ? <CheckIcon /> : <StepDot active={isCurrent} />}

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    {step.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[0.9375rem] ${
                      step.done ? "text-ink-secondary" : "text-ink"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>

                {isCurrent ? (
                  <Button href={step.href} size="compact" className="shrink-0">
                    {step.cta}
                  </Button>
                ) : (
                  <Link
                    href={step.href}
                    className="shrink-0 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    {step.done ? "Review" : "Open"}
                  </Link>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
