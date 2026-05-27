"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { UserProfile } from "@/lib/schema";

type JobSearchResult = {
  id: string;
  role: string;
  company: string;
  location: string;
  posted: string;
  source: "mycareersfuture" | "indeed";
  url: string;
};

type TrackerStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected";

type TrackerItem = {
  id: string;
  role: string;
  company: string;
  url: string;
  status: TrackerStatus;
  dateApplied: string;
  notes: string;
  source: "mycareersfuture" | "indeed" | "manual";
  location?: string;
  posted?: string;
  createdAt: string;
};

type ManualForm = {
  role: string;
  company: string;
  url: string;
  status: TrackerStatus;
  dateApplied: string;
  notes: string;
};

const TRACKER_KEY = "smu_job_tracker";
const PROFILE_KEY = "smu_career_profile";

const STATUS_OPTIONS: TrackerStatus[] = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

function getInitialClientState(): {
  targetRole: string;
  targetIndustry: string;
  tracker: TrackerItem[];
  error: string;
} {
  if (typeof window === "undefined") {
    return { targetRole: "", targetIndustry: "", tracker: [], error: "" };
  }

  let targetRole = "";
  let targetIndustry = "";
  let error = "";
  let tracker: TrackerItem[] = [];

  const rawProfile = localStorage.getItem(PROFILE_KEY);
  if (rawProfile) {
    try {
      const parsed = JSON.parse(rawProfile) as UserProfile;
      targetRole = parsed.user.target_role ?? "";
      targetIndustry = parsed.user.target_industry ?? "";
    } catch {
      error = "Could not read smu_career_profile. Please complete onboarding first.";
    }
  } else {
    error = "No smu_career_profile found. Complete onboarding to personalise job search.";
  }

  const rawTracker = localStorage.getItem(TRACKER_KEY);
  if (rawTracker) {
    try {
      tracker = JSON.parse(rawTracker) as TrackerItem[];
    } catch {
      tracker = [];
    }
  }

  return { targetRole, targetIndustry, tracker, error };
}

function toLower(value: string) {
  return value.toLowerCase().trim();
}

function targetFilter(job: JobSearchResult, role: string, industry: string) {
  const haystack = toLower([job.role, job.company, job.location].join(" "));
  const roleWords = toLower(role)
    .split(/[\s,/()-]+/)
    .filter((w) => w.length >= 3);
  const industryWords = toLower(industry)
    .split(/[\s,/()-]+/)
    .filter((w) => w.length >= 3);

  const roleOk = roleWords.length === 0 || roleWords.some((w) => haystack.includes(w));
  const industryOk =
    industryWords.length === 0 || industryWords.some((w) => haystack.includes(w));
  return roleOk && industryOk;
}

function statusTone(status: TrackerStatus): Parameters<typeof Badge>[0]["tone"] {
  if (status === "Applied") return "info";
  if (status === "Interview") return "warning";
  if (status === "Offer") return "success";
  if (status === "Rejected") return "muted";
  return "default";
}

function newTrackerId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function JobsPage() {
  const initial = useMemo(() => getInitialClientState(), []);

  const [targetRole] = useState(initial.targetRole);
  const [targetIndustry] = useState(initial.targetIndustry);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobSearchResult[]>([]);
  const [error, setError] = useState(initial.error);

  const [tracker, setTracker] = useState<TrackerItem[]>(initial.tracker);
  const [manualForm, setManualForm] = useState<ManualForm>({
    role: "",
    company: "",
    url: "",
    status: "Saved",
    dateApplied: "",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
  }, [tracker]);

  async function runSearch() {
    setError("");
    if (!targetRole || !targetIndustry) {
      setError("Target role and industry are required from your onboarding profile.");
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        targetRole,
        targetIndustry,
      });
      const res = await fetch(`/api/jobs/search?${params.toString()}`, {
        method: "GET",
      });
      if (!res.ok) {
        const maybe = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(maybe?.error || "Job search request failed.");
        setJobs([]);
        return;
      }
      const data = (await res.json()) as { jobs?: JobSearchResult[]; error?: string };
      if (data.error) {
        setError(data.error);
      }
      const fetched = data.jobs ?? [];
      const filtered = fetched.filter((job) => targetFilter(job, targetRole, targetIndustry));
      setJobs(filtered);
    } catch {
      setError("Unable to fetch job listings at the moment.");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }

  function saveFromSearch(job: JobSearchResult) {
    const duplicate = tracker.some(
      (item) =>
        toLower(item.role) === toLower(job.role) &&
        toLower(item.company) === toLower(job.company) &&
        toLower(item.url) === toLower(job.url),
    );
    if (duplicate) return;

    const newItem: TrackerItem = {
      id: newTrackerId(),
      role: job.role,
      company: job.company,
      url: job.url,
      status: "Saved",
      dateApplied: "",
      notes: "",
      source: job.source,
      location: job.location,
      posted: job.posted,
      createdAt: new Date().toISOString(),
    };
    setTracker((prev) => [newItem, ...prev]);
  }

  function addManualEntry() {
    if (!manualForm.role.trim() || !manualForm.company.trim()) {
      setError("Manual tracker entry requires role and company.");
      return;
    }

    const item: TrackerItem = {
      id: newTrackerId(),
      role: manualForm.role.trim(),
      company: manualForm.company.trim(),
      url: manualForm.url.trim(),
      status: manualForm.status,
      dateApplied: manualForm.dateApplied,
      notes: manualForm.notes.trim(),
      source: "manual",
      createdAt: new Date().toISOString(),
    };
    setTracker((prev) => [item, ...prev]);
    setManualForm({
      role: "",
      company: "",
      url: "",
      status: "Saved",
      dateApplied: "",
      notes: "",
    });
  }

  function updateTrackerStatus(id: string, status: TrackerStatus) {
    setTracker((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  function removeTrackerItem(id: string) {
    setTracker((prev) => prev.filter((item) => item.id !== id));
  }

  const sortedTracker = useMemo(
    () =>
      [...tracker].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [tracker],
  );

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
          >
            ← Back to dashboard
          </Link>
          <Badge tone="default">Jobs</Badge>
        </div>

        <section className="mt-8 content-narrow">
          <h1 className="font-display text-[3rem] italic leading-[1.1] text-primary">Job Board</h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-ink-secondary">
            Search jobs aligned to your profile, then track applications in one place.
          </p>
        </section>

        <section className="mt-10">
          <Card interactive={false} className="animate-fade-up">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="job-search">Job search</Label>
                <Input
                  id="job-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keywords (optional)"
                />
              </div>
              <Button type="button" onClick={runSearch} disabled={isLoading}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{targetRole || "No target role"}</Badge>
              <Badge>{targetIndustry || "No target industry"}</Badge>
            </div>

            {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

            <div className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-ink-secondary">
                        No matching jobs found for your target role and industry.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <TableRow key={`${job.source}-${job.id}`}>
                        <TableCell className="font-medium text-ink">{job.role}</TableCell>
                        <TableCell>{job.company}</TableCell>
                        <TableCell>{job.location || "Singapore"}</TableCell>
                        <TableCell>{job.posted || "-"}</TableCell>
                        <TableCell className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
                          {job.source}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="secondary"
                            size="compact"
                            onClick={() => saveFromSearch(job)}
                          >
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>

        <section className="mt-8">
          <Card interactive={false} className="animate-fade-up">
            <h2 className="font-display text-[2rem] italic text-primary">Application Tracker</h2>
            <p className="mt-2 text-sm text-ink-secondary">
              Save from search results or add manually (including LinkedIn via URL paste only).
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-role">Role</Label>
                <Input
                  id="manual-role"
                  value={manualForm.role}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                  placeholder="Enter role title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-company">Company</Label>
                <Input
                  id="manual-company"
                  value={manualForm.company}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, company: e.target.value }))
                  }
                  placeholder="Enter company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-url">Job URL (LinkedIn paste supported)</Label>
                <Input
                  id="manual-url"
                  value={manualForm.url}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-status">Status</Label>
                <Select
                  value={manualForm.status}
                  onValueChange={(status) =>
                    setManualForm((prev) => ({ ...prev, status: status as TrackerStatus }))
                  }
                >
                  <SelectTrigger id="manual-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-date">Date applied</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualForm.dateApplied}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, dateApplied: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="manual-notes">Notes</Label>
                <Textarea
                  id="manual-notes"
                  value={manualForm.notes}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Add follow-up notes..."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={addManualEntry}>
                Add to tracker
              </Button>
            </div>

            <div className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Applied</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTracker.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-ink-secondary">
                        No tracked applications yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTracker.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-ink">{item.role}</TableCell>
                        <TableCell>{item.company}</TableCell>
                        <TableCell>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary hover:text-primary-light"
                            >
                              Open link
                            </a>
                          ) : (
                            <span className="text-ink-muted">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                            <Select
                              value={item.status}
                              onValueChange={(status) =>
                                updateTrackerStatus(item.id, status as TrackerStatus)
                              }
                            >
                              <SelectTrigger className="h-8 w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>{item.dateApplied || "-"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{item.notes || "-"}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="danger"
                            size="compact"
                            onClick={() => removeTrackerItem(item.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}

