import { NextRequest, NextResponse } from "next/server";

type SourceName = "mycareersfuture" | "jsearch";

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

  // MCF search results have no description and their titles rarely contain the
  // industry word, so match on EITHER role or industry — the upstream MCF search
  // has already ranked results against the full query.
  return roleMatch || industryMatch;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

// Shape of a single result from the MyCareersFuture v2 /search response.
type McfResult = {
  uuid?: string;
  title?: string;
  postedCompany?: { name?: string } | null;
  metadata?: { newPostingDate?: string; jobDetailsUrl?: string } | null;
  address?: {
    isOverseas?: boolean;
    overseasCountry?: string | null;
    districts?: Array<{ location?: string; region?: string }> | null;
  } | null;
};

function mcfLocation(address: McfResult["address"]): string {
  if (!address) return "Singapore";
  if (address.isOverseas && address.overseasCountry) return address.overseasCountry;
  const names = (address.districts ?? [])
    .map((d) => d.location || d.region)
    .filter((v): v is string => !!v);
  return names.length > 0 ? names.join(", ") : "Singapore";
}

function toMcFJobs(payload: unknown): JobResult[] {
  const rows = Array.isArray((payload as { results?: unknown[] })?.results)
    ? ((payload as { results: unknown[] }).results ?? [])
    : [];

  return rows
    .map((row, idx) => {
      const r = row as McfResult;
      return {
        id: toText(r.uuid) || `mcf-${idx}`,
        role: toText(r.title),
        company: toText(r.postedCompany?.name),
        location: mcfLocation(r.address),
        posted: toText(r.metadata?.newPostingDate),
        source: "mycareersfuture" as const,
        url: toText(r.metadata?.jobDetailsUrl),
      };
    })
    .filter((job) => job.role && job.company);
}

// Shape of a single job from the JSearch (RapidAPI) /search response `data[]`.
type JSearchJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_apply_link?: string;
  job_posted_at_datetime_utc?: string | null;
  job_description?: string;
};

function jsearchLocation(j: JSearchJob): string {
  const parts = [j.job_city, j.job_state, j.job_country].filter(
    (v): v is string => !!v,
  );
  return parts.length > 0 ? parts.join(", ") : "Singapore";
}

function toJSearchJobs(payload: unknown): JobResult[] {
  const rows = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data: unknown[] }).data ?? [])
    : [];

  return rows
    .map((row, idx) => {
      const j = row as JSearchJob;
      return {
        id: toText(j.job_id) || `jsearch-${idx}`,
        role: toText(j.job_title),
        company: toText(j.employer_name),
        location: jsearchLocation(j),
        // job_posted_at_datetime_utc is a full ISO timestamp — keep just the date
        posted: toText(j.job_posted_at_datetime_utc).slice(0, 10),
        source: "jsearch" as const,
        url: toText(j.job_apply_link),
        description: toText(j.job_description),
      };
    })
    .filter((job) => job.role && job.company);
}

// MyCareersFuture exposes a public, key-less search API (POST with a JSON body).
// Default to the official endpoint; an override may be set via env. No key needed.
async function fetchMyCareersFuture(query: string) {
  const baseUrl = (
    process.env.MCF_API_BASE_URL ||
    process.env.MYCAREERSFUTURE_BASE_URL ||
    "https://api.mycareersfuture.gov.sg/v2"
  ).replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/search?limit=30&page=0`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ search: query }),
    cache: "no-store",
  });

  if (!res.ok) return [] as JobResult[];
  const json = (await res.json()) as unknown;
  return toMcFJobs(json);
}

// JSearch (RapidAPI) aggregates listings from LinkedIn, Glassdoor, Indeed, etc.
// Requires a RapidAPI key; returns [] when unset so the route still works on MCF alone.
async function fetchJSearch(query: string) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [] as JobResult[];

  const host = process.env.RAPIDAPI_JSEARCH_HOST || "jsearch.p.rapidapi.com";
  const url = new URL(`https://${host}/search`);
  url.searchParams.set("query", `${query} in Singapore`);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("country", "sg");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": host,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return toJSearchJobs(json);
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const targetRole = req.nextUrl.searchParams.get("targetRole") ?? "";
  const targetIndustry = req.nextUrl.searchParams.get("targetIndustry") ?? "";

  if (!targetRole && !targetIndustry && !search) {
    return NextResponse.json({
      jobs: [],
      error: "Enter a search keyword or activate a profile.",
    });
  }

  // MyCareersFuture is a public, key-less API, so search always works.
  // JSearch (aggregated LinkedIn/Glassdoor/etc.) is added when RAPIDAPI_KEY is set.
  const query = [targetRole, targetIndustry, search].filter(Boolean).join(" ");

  const [jsearch, mcf] = await Promise.all([
    fetchJSearch(query),
    fetchMyCareersFuture(query),
  ]);

  // Aggregated (JSearch) listings first, then MyCareersFuture. Dedupe across
  // sources by role + company so the same posting doesn't appear twice.
  const seen = new Set<string>();
  const combined = [...jsearch, ...mcf]
    .filter((job) => isRelevant(job, targetRole, targetIndustry))
    .filter((job) => {
      const key = `${normalizeText(job.role)}|${normalizeText(job.company)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);

  return NextResponse.json({ jobs: combined });
}

