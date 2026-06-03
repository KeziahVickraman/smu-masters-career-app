"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProfiles } from "@/contexts/profile-context";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "search" | "log";

type ApplicationStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected";

type JobSource = "mycareersfuture" | "jsearch" | "manual";

interface JobSearchResult {
  id: string;
  role: string;
  company: string;
  location: string;
  posted: string;
  source: Exclude<JobSource, "manual">;
  url: string;
}

interface JobLogEntry {
  id: string;
  role: string;
  company: string;
  status: ApplicationStatus;
  appliedDate: string;
  url?: string;
  notes?: string;
  // Optional provenance fields — present on entries saved from search results
  source?: JobSource;
  location?: string;
  posted?: string;
  createdAt?: string;
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

// ── Storage helpers ───────────────────────────────────────────────────────────
const LOG_KEY = "smu_job_tracker";
const LEGACY_LOG_KEY = "smu_job_log";

function loadLog(): JobLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as JobLogEntry[];

    // One-time migration from the legacy key
    const legacy = localStorage.getItem(LEGACY_LOG_KEY);
    if (legacy) {
      const entries = JSON.parse(legacy) as JobLogEntry[];
      localStorage.setItem(LOG_KEY, legacy);
      localStorage.removeItem(LEGACY_LOG_KEY);
      return entries;
    }

    return [];
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

function toLower(value: string) {
  return value.toLowerCase().trim();
}

// ── Shared input class ────────────────────────────────────────────────────────
const inputCls =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JobBoardPage() {
  const { activeProfile } = useProfiles();
  const targetRole = activeProfile?.user.target_role ?? "";
  const targetIndustry = activeProfile?.user.target_industry ?? "";

  const [tab, setTab] = useState<Tab>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");

  // Log state
  const [entries, setEntries] = useState<JobLogEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddForm, string>>>({});

  useEffect(() => {
    setEntries(loadLog());
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  async function runSearch() {
    setSearchError("");

    if (!targetRole && !targetIndustry && !searchQuery.trim()) {
      setSearchError(
        "Enter a search keyword, or activate a profile to personalise results.",
      );
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        targetRole,
        targetIndustry,
      });
      const res = await fetch(`/api/jobs/search?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as
        | { jobs?: JobSearchResult[]; error?: string }
        | null;

      if (!res.ok || data?.error) {
        setSearchError(data?.error || "Job search request failed.");
        setResults([]);
        return;
      }

      setResults(data?.jobs ?? []);
    } catch {
      setSearchError("Unable to fetch job listings at the moment.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // ── Tracker mutations ───────────────────────────────────────────────────────
  const savedKeys = useMemo(
    () =>
      new Set(
        entries.map((e) => `${toLower(e.role)}|${toLower(e.company)}|${toLower(e.url ?? "")}`),
      ),
    [entries],
  );

  function isAlreadySaved(job: JobSearchResult) {
    return savedKeys.has(`${toLower(job.role)}|${toLower(job.company)}|${toLower(job.url)}`);
  }

  function saveFromSearch(job: JobSearchResult) {
    if (isAlreadySaved(job)) return;

    const entry: JobLogEntry = {
      id: newId(),
      role: job.role,
      company: job.company,
      status: "Saved",
      appliedDate: "",
      url: job.url || undefined,
      source: job.source,
      location: job.location,
      posted: job.posted,
      createdAt: new Date().toISOString(),
    };

    const next = [entry, ...entries];
    setEntries(next);
    saveLog(next);
  }

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
      source: "manual",
      createdAt: new Date().toISOString(),
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
      active ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"
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
            Search Singapore roles matched to your profile, then track your
            applications in one place.
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
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="job-search"
                    className="mb-1.5 block text-xs font-medium text-ink-secondary"
                  >
                    Search jobs
                  </label>
                  <input
                    id="job-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                    placeholder={
                      activeProfile
                        ? "Add keywords, e.g. graduate, internship..."
                        : "Search roles or companies, e.g. data analyst..."
                    }
                    className="h-10 w-full max-w-xl rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <Button type="button" onClick={runSearch} disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="default">Singapore</Badge>
                {targetRole && <Badge tone="default">{targetRole}</Badge>}
                {targetIndustry && <Badge tone="default">{targetIndustry}</Badge>}
                {!activeProfile && (
                  <Badge tone="muted">
                    All roles — activate a profile to personalise
                  </Badge>
                )}
              </div>

              {searchError && (
                <p className="mt-4 text-sm text-accent">{searchError}</p>
              )}
            </Card>

            <Card
              className="mt-8 overflow-hidden p-0 animate-fade-up"
              interactive={false}
            >
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/60 text-left">
                        {["Role", "Company", "Location", "Posted", "Source", ""].map(
                          (h, i) => (
                            <th
                              key={i}
                              className="px-6 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {results.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-8 text-center text-ink-muted"
                          >
                            {isSearching
                              ? "Searching live listings..."
                              : hasSearched
                                ? "No matching roles found. Try different keywords."
                                : "Hit Search to pull live Singapore listings for your profile."}
                          </td>
                        </tr>
                      ) : (
                        results.map((job) => {
                          const saved = isAlreadySaved(job);
                          return (
                            <tr
                              key={`${job.source}-${job.id}`}
                              className="border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-surface-muted"
                            >
                              <td className="px-6 py-4 font-medium text-ink">
                                {job.url ? (
                                  <a
                                    href={job.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary"
                                  >
                                    {job.role}
                                  </a>
                                ) : (
                                  job.role
                                )}
                              </td>
                              <td className="px-6 py-4 text-ink-secondary">
                                {job.company}
                              </td>
                              <td className="px-6 py-4 text-ink-secondary">
                                {job.location || "Singapore"}
                              </td>
                              <td className="px-6 py-4 text-ink-secondary">
                                {job.posted || "—"}
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
                                {job.source}
                              </td>
                              <td className="px-6 py-4">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="compact"
                                  onClick={() => saveFromSearch(job)}
                                  disabled={saved}
                                >
                                  {saved ? "Saved" : "Save"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
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

                          {/* Status — colour badge styled as an obvious dropdown */}
                          <td className="px-5 py-3">
                            <div className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface py-1 pl-1.5 pr-2 transition-colors hover:border-border-strong">
                              <Badge tone={STATUS_TONE[entry.status]}>
                                {entry.status}
                              </Badge>
                              {/* Chevron signals this is editable */}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                aria-hidden="true"
                                className="pointer-events-none text-ink-muted"
                              >
                                <path
                                  d="M2.5 4L5 6.5 7.5 4"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <select
                                value={entry.status}
                                onChange={(e) =>
                                  updateStatus(
                                    entry.id,
                                    e.target.value as ApplicationStatus,
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
                            {entry.appliedDate || "—"}
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
                  Save roles from Job Search, or hit &ldquo;+ Add application&rdquo; to log one manually.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
