"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "search" | "log";

type ApplicationStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected";

interface JobLogEntry {
  id: string;
  role: string;
  company: string;
  status: ApplicationStatus;
  appliedDate: string;
  url?: string;
  notes?: string;
}

interface AddForm {
  role: string;
  company: string;
  status: ApplicationStatus;
  appliedDate: string;
  url: string;
  notes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES: ApplicationStatus[] = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

const STATUS_TONE: Record<
  ApplicationStatus,
  "muted" | "info" | "warning" | "success" | "accent"
> = {
  Saved: "muted",
  Applied: "info",
  Interview: "warning",
  Offer: "success",
  Rejected: "accent",
};

const PLACEHOLDER_ROWS = [
  {
    role: "Graduate Analyst, Risk Modelling",
    company: "DBS Bank",
    location: "Singapore",
    posted: "2d ago",
    tags: "Finance · Risk",
    href: "#",
  },
  {
    role: "Associate Product Manager Intern",
    company: "Grab",
    location: "Singapore · Hybrid",
    posted: "5d ago",
    tags: "PM · Ops",
    href: "#",
  },
  {
    role: "Data Science Associate",
    company: "GIC",
    location: "Singapore",
    posted: "1w ago",
    tags: "Analyst · Research",
    href: "#",
  },
];

// ── Storage helpers ───────────────────────────────────────────────────────────
const LOG_KEY = "smu_job_log";

function loadLog(): JobLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as JobLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: JobLogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): AddForm {
  return {
    role: "",
    company: "",
    status: "Applied",
    appliedDate: todayIso(),
    url: "",
    notes: "",
  };
}

// ── Shared input class ────────────────────────────────────────────────────────
const inputCls =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JobBoardPage() {
  const [tab, setTab] = useState<Tab>("search");

  // Log state
  const [entries, setEntries] = useState<JobLogEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddForm, string>>>({});

  useEffect(() => {
    setEntries(loadLog());
  }, []);

  function addEntry() {
    const errors: Partial<Record<keyof AddForm, string>> = {};
    if (!form.role.trim()) errors.role = "Required";
    if (!form.company.trim()) errors.company = "Required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const entry: JobLogEntry = {
      id: newId(),
      role: form.role.trim(),
      company: form.company.trim(),
      status: form.status,
      appliedDate: form.appliedDate,
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    const next = [entry, ...entries];
    setEntries(next);
    saveLog(next);
    setForm(emptyForm());
    setFormErrors({});
    setShowForm(false);
  }

  function removeEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveLog(next);
  }

  function updateStatus(id: string, status: ApplicationStatus) {
    const next = entries.map((e) => (e.id === id ? { ...e, status } : e));
    setEntries(next);
    saveLog(next);
  }

  function tabCls(active: boolean) {
    return `rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
      active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
    }`;
  }

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
        <div className="mt-8 animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            Job Board
          </h1>
          <p className="mt-1 max-w-[800px] text-[0.9375rem] text-ink-secondary">
            Browse Singapore roles and track your applications in one place.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="mt-6 flex w-fit gap-0 rounded-lg border border-border bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={tabCls(tab === "search")}
          >
            Job Search
          </button>
          <button
            type="button"
            onClick={() => setTab("log")}
            className={`${tabCls(tab === "log")} flex items-center gap-2`}
          >
            Job Log
            {entries.length > 0 && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                {entries.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Job Search ──────────────────────────────────────────────────── */}
        {tab === "search" && (
          <>
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

            <Card
              className="mt-8 overflow-hidden p-0 animate-fade-up"
              interactive={false}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/60 text-left">
                      {["Role", "Company", "Location", "Posted", "Tags", "Apply"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted"
                          >
                            {h}
                          </th>
                        )
                      )}
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
                        <td className="px-6 py-4 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
                          {row.tags}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={row.href}
                            className="text-sm font-medium text-primary hover:text-primary-light"
                          >
                            Apply
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── Job Log ─────────────────────────────────────────────────────── */}
        {tab === "log" && (
          <div className="mt-8 animate-fade-up">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">Your Applications</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {entries.length === 0
                    ? "Nothing logged yet."
                    : `${entries.length} application${entries.length === 1 ? "" : "s"} tracked.`}
                </p>
              </div>
              {!showForm && (
                <Button type="button" onClick={() => setShowForm(true)}>
                  + Add application
                </Button>
              )}
            </div>

            {/* Add form */}
            {showForm && (
              <Card className="mt-5" interactive={false}>
                <p className="text-sm font-medium text-ink">
                  Log a new application
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {/* Role */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Role <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      placeholder="e.g. Data Analyst"
                      className={inputCls}
                    />
                    {formErrors.role && (
                      <p className="mt-1 text-xs text-accent">{formErrors.role}</p>
                    )}
                  </div>

                  {/* Company */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Company <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) =>
                        setForm({ ...form, company: e.target.value })
                      }
                      placeholder="e.g. DBS Bank"
                      className={inputCls}
                    />
                    {formErrors.company && (
                      <p className="mt-1 text-xs text-accent">
                        {formErrors.company}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value as ApplicationStatus,
                        })
                      }
                      className={inputCls}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Applied */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Date Applied
                    </label>
                    <input
                      type="date"
                      value={form.appliedDate}
                      onChange={(e) =>
                        setForm({ ...form, appliedDate: e.target.value })
                      }
                      className={inputCls}
                    />
                  </div>

                  {/* Job URL */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Job URL{" "}
                      <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      placeholder="https://..."
                      className={inputCls}
                    />
                  </div>

                  {/* Notes — full width */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                      Notes{" "}
                      <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      placeholder="Recruiter contact, deadline, anything useful..."
                      rows={2}
                      className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <Button type="button" onClick={addEntry}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowForm(false);
                      setForm(emptyForm());
                      setFormErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Log table */}
            {entries.length > 0 ? (
              <Card className="mt-6 overflow-hidden p-0" interactive={false}>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/60 text-left">
                        {[
                          "Role",
                          "Company",
                          "Status",
                          "Applied",
                          "Link",
                          "",
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-surface-muted/40"
                        >
                          {/* Role + notes */}
                          <td className="px-5 py-3">
                            <p className="font-medium text-ink">{entry.role}</p>
                            {entry.notes && (
                              <p className="mt-0.5 max-w-[200px] truncate text-xs text-ink-muted">
                                {entry.notes}
                              </p>
                            )}
                          </td>

                          {/* Company */}
                          <td className="px-5 py-3 text-ink-secondary">
                            {entry.company}
                          </td>

                          {/* Status — Badge overlaid with a transparent <select> */}
                          <td className="px-5 py-3">
                            <div className="relative inline-flex cursor-pointer">
                              <Badge tone={STATUS_TONE[entry.status]}>
                                {entry.status}
                              </Badge>
                              <select
                                value={entry.status}
                                onChange={(e) =>
                                  updateStatus(
                                    entry.id,
                                    e.target.value as ApplicationStatus
                                  )
                                }
                                aria-label="Update status"
                                className="absolute inset-0 cursor-pointer opacity-0"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-5 py-3 text-sm text-ink-secondary">
                            {entry.appliedDate}
                          </td>

                          {/* URL */}
                          <td className="px-5 py-3">
                            {entry.url ? (
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:text-primary-light"
                              >
                                Open →
                              </a>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>

                          {/* Remove */}
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id)}
                              aria-label={`Remove ${entry.role} at ${entry.company}`}
                              className="text-ink-muted transition-colors duration-150 hover:text-accent"
                            >
                              {/* Trash icon */}
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M2 4h12M6 4V2h4v2M5.5 4l.5 9h4l.5-9"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : !showForm ? (
              /* Empty state */
              <div className="mt-14 text-center">
                <p className="text-[0.9375rem] font-medium text-ink">
                  No applications logged yet
                </p>
                <p className="mt-1.5 text-sm text-ink-muted">
                  Hit &ldquo;+ Add application&rdquo; above to start tracking.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
