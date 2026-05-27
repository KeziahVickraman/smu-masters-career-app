"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const ROLE_FILTERS = [
  "All roles",
  "Data Analyst",
  "Product Manager",
  "Quant",
  "Consulting",
] as const;

export default function InterviewPrepPage() {
  const [activeRole, setActiveRole] = useState<(typeof ROLE_FILTERS)[number]>(
    "Data Analyst",
  );

  const questionTitle = useMemo(() => {
    if (activeRole === "Quant") {
      return "Walk through how you’d sanity-check backtest assumptions before handing results to stakeholders.";
    }
    if (activeRole === "Product Manager") {
      return "Tell me how you’d prioritise a backlog when stakeholders disagree but shipping pressure is high.";
    }
    return "Describe an end-to-end analytics workflow you shipped, from question framing to business impact.";
  }, [activeRole]);

  const progressPct = activeRole === "Quant" ? 62 : activeRole === "Product Manager" ? 38 : 45;

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

        <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
          <aside className="lg:w-[220px] lg:shrink-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Role type
            </p>
            <ul className="mt-4 space-y-2">
              {ROLE_FILTERS.map((role) => {
                const active = role === activeRole;
                return (
                  <li key={role}>
                    <button
                      type="button"
                      onClick={() => setActiveRole(role)}
                      className={`w-full rounded-sm border border-border px-2 py-[3px] text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] transition-colors duration-150 ${
                        active
                          ? "bg-surface-muted text-ink outline outline-2 outline-offset-[-2px] outline-accent"
                          : "bg-surface-muted text-ink-secondary hover:border-border-strong hover:text-ink"
                      }`}
                    >
                      {role}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-display text-[2rem] font-semibold text-primary">
                  Interview Prep
                </h1>
                <p className="mt-1 text-sm text-ink-secondary">
                  Scaffold: question flows and AI feedback will plug in later.
                </p>
              </div>
              <Card className="sm:max-w-[280px]" interactive={false}>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                  Session progress
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-muted">
                  <div
                    className="h-full rounded-sm bg-primary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-secondary">
                  {progressPct}% of tonight&apos;s curated set reviewed
                </p>
              </Card>
            </div>

            <Card className="mt-8" interactive={false}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Practice</Badge>
                <Badge>Difficulty: Intermediate</Badge>
                <Badge>{activeRole}</Badge>
              </div>
              <h2 className="mt-4 text-[1.125rem] font-medium text-ink">{questionTitle}</h2>
              <p className="mt-3 text-[0.9375rem] text-ink-secondary">
                Tap expand to reveal an answer outline once response evaluation is wired.
              </p>
              <details className="group mt-6 rounded-md border border-border bg-surface-muted/50 p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Expand answer outline
                </summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-secondary">
                  <li>Frame the business question and success metric.</li>
                  <li>Explain data sources, assumptions, and validation.</li>
                  <li>Describe analysis steps and stakeholder communication.</li>
                  <li>Close with measurable impact and lessons learned.</li>
                </ol>
              </details>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
