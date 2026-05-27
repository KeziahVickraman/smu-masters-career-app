"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLACEHOLDER_ROWS = [
  {
    role: "Graduate Analyst, Risk Modelling",
    company: "DBS Bank",
    location: "Singapore",
    posted: "2d ago",
    tags: "Finance · Risk",
    applyLabel: "Apply",
    href: "#",
  },
  {
    role: "Associate Product Manager Intern",
    company: "Grab",
    location: "Singapore · Hybrid",
    posted: "5d ago",
    tags: "PM · Ops",
    applyLabel: "Apply",
    href: "#",
  },
  {
    role: "Data Science Associate",
    company: "GIC",
    location: "Singapore",
    posted: "1w ago",
    tags: "Analyst · Research",
    applyLabel: "Apply",
    href: "#",
  },
];

export default function JobBoardPage() {
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

        <div className="mt-8 animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            Job Board
          </h1>
          <p className="mt-1 max-w-[800px] text-[0.9375rem] text-ink-secondary">
            Table-first layout scaffold. Real listings and ingest pipelines land in a future iteration.
          </p>
        </div>

        <Card className="mt-8 animate-fade-up" interactive={false}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Filters
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="compact">
                Singapore
              </Button>
              <Button type="button" variant="secondary" size="compact">
                Masters-relevant
              </Button>
              <Button type="button" variant="secondary" size="compact">
                Last 7 days
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <input
              type="search"
              placeholder="Search roles or companies..."
              aria-label="Search jobs"
              className="h-10 w-full max-w-xl rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
        </Card>

        <Card className="mt-8 overflow-hidden p-0 animate-fade-up" interactive={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left">
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Role
                  </th>
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Company
                  </th>
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Location
                  </th>
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Posted
                  </th>
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Tags
                  </th>
                  <th className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Apply
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_ROWS.map((row) => (
                  <tr
                    key={row.role}
                    className="border-b border-border transition-colors duration-150 hover:bg-surface-muted"
                  >
                    <td className="px-6 py-4 font-medium text-ink">{row.role}</td>
                    <td className="px-6 py-4 text-ink-secondary">{row.company}</td>
                    <td className="px-6 py-4 text-ink-secondary">{row.location}</td>
                    <td className="px-6 py-4 text-ink-secondary">{row.posted}</td>
                    <td className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.05em] text-ink-secondary">
                      {row.tags}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={row.href}
                        className="text-sm font-medium text-primary hover:text-primary-light"
                      >
                        {row.applyLabel}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
