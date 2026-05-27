import { NextRequest, NextResponse } from "next/server";

type SourceName = "mycareersfuture" | "indeed";

type JobResult = {
  id: string;
  role: string;
  company: string;
  location: string;
  posted: string;
  source: SourceName;
  url: string;
  description?: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function splitKeywords(value: string) {
  return normalizeText(value)
    .split(/[\s,/()-]+/)
    .filter((part) => part.length >= 3);
}

function isRelevant(job: JobResult, targetRole: string, targetIndustry: string) {
  const haystack = normalizeText(
    [job.role, job.company, job.location, job.description ?? ""].join(" "),
  );
  const roleKeywords = splitKeywords(targetRole);
  const industryKeywords = splitKeywords(targetIndustry);

  const roleMatch =
    roleKeywords.length === 0 || roleKeywords.some((kw) => haystack.includes(kw));
  const industryMatch =
    industryKeywords.length === 0 ||
    industryKeywords.some((kw) => haystack.includes(kw));

  return roleMatch && industryMatch;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toMcFJobs(payload: unknown): JobResult[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? ((payload as { data: unknown[] }).data ?? [])
      : Array.isArray((payload as { results?: unknown[] })?.results)
        ? ((payload as { results: unknown[] }).results ?? [])
        : [];

  return rows
    .map((row, idx) => {
      const entry = row as Record<string, unknown>;
      const id = toText(entry.uuid) || toText(entry.id) || `mcf-${idx}`;
      const url =
        toText(entry.url) ||
        toText(entry.job_post_url) ||
        toText(entry.redirect_url) ||
        "";
      return {
        id,
        role: toText(entry.title) || toText(entry.job_title),
        company: toText(entry.company) || toText(entry.company_name),
        location: toText(entry.location) || toText(entry.address),
        posted:
          toText(entry.posted_at) ||
          toText(entry.created_at) ||
          toText(entry.updated_at),
        source: "mycareersfuture" as const,
        url,
        description: toText(entry.description),
      };
    })
    .filter((job) => job.role && job.company);
}

function toIndeedJobs(payload: unknown): JobResult[] {
  const rows =
    Array.isArray((payload as { results?: unknown[] })?.results)
      ? ((payload as { results: unknown[] }).results ?? [])
      : Array.isArray((payload as { jobs?: unknown[] })?.jobs)
        ? ((payload as { jobs: unknown[] }).jobs ?? [])
        : [];

  return rows
    .map((row, idx) => {
      const entry = row as Record<string, unknown>;
      const id = toText(entry.jobkey) || toText(entry.id) || `indeed-${idx}`;
      const url = toText(entry.url) || toText(entry.job_url);
      return {
        id,
        role: toText(entry.jobtitle) || toText(entry.title),
        company: toText(entry.company),
        location: toText(entry.formattedLocation) || toText(entry.location),
        posted: toText(entry.date) || toText(entry.posted_at),
        source: "indeed" as const,
        url,
        description: toText(entry.snippet) || toText(entry.description),
      };
    })
    .filter((job) => job.role && job.company);
}

async function fetchMyCareersFuture(query: string) {
  const baseUrl = process.env.MCF_API_BASE_URL;
  const apiKey = process.env.MCF_API_KEY;
  if (!baseUrl || !apiKey) {
    return [] as JobResult[];
  }

  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "30");
  url.searchParams.set("location", "Singapore");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return toMcFJobs(json);
}

async function fetchIndeed(query: string) {
  const baseUrl = process.env.INDEED_API_BASE_URL;
  const publisherId = process.env.INDEED_PUBLISHER_API_KEY;
  if (!baseUrl || !publisherId) {
    return [] as JobResult[];
  }

  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("l", "Singapore");
  url.searchParams.set("publisher", publisherId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "30");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return toIndeedJobs(json);
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const targetRole = req.nextUrl.searchParams.get("targetRole") ?? "";
  const targetIndustry = req.nextUrl.searchParams.get("targetIndustry") ?? "";

  if (!targetRole || !targetIndustry) {
    return NextResponse.json({ jobs: [], error: "Missing target profile filters." });
  }

  const hasMcf =
    !!process.env.MCF_API_BASE_URL && !!process.env.MCF_API_KEY;
  const hasIndeed =
    !!process.env.INDEED_API_BASE_URL && !!process.env.INDEED_PUBLISHER_API_KEY;

  if (!hasMcf && !hasIndeed) {
    return NextResponse.json(
      {
        jobs: [],
        error:
          "Job search is not configured. Add API keys in .env.local (MyCareersFuture / Indeed) and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const query = `${targetRole} ${targetIndustry} Singapore ${search}`.trim();

  const [mcf, indeed] = await Promise.all([
    fetchMyCareersFuture(query),
    fetchIndeed(query),
  ]);

  const combined = [...mcf, ...indeed]
    .filter((job) => isRelevant(job, targetRole, targetIndustry))
    .slice(0, 60);

  return NextResponse.json({ jobs: combined });
}

