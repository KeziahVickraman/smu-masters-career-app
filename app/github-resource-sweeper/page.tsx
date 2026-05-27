import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const REPO_PLACEHOLDERS = [
  {
    name: "smu-msda/course-repo",
    summary:
      "Course materials and assignments with issues tagged good-first-issue for practice contributions.",
    skills: ["Python", "Pandas", "Git"],
    difficulty: "beginner" as const,
    href: "https://github.com",
  },
  {
    name: "open-analytics/singapore-transit",
    summary:
      "Public datasets and notebooks focusing on operations research and forecasting techniques.",
    skills: ["Time series", "SQL", "OR"],
    difficulty: "intermediate" as const,
    href: "https://github.com",
  },
  {
    name: "quant-lab/research-toolkit",
    summary:
      "Low-level utilities for backtesting and signal research; expect deeper PR review cycles.",
    skills: ["C++", "Research", "Stats"],
    difficulty: "advanced" as const,
    href: "https://github.com",
  },
  {
    name: "biz-ai/knowledge-base",
    summary:
      "Patterns for LLM evaluation and prompt engineering with doc-driven contribution paths.",
    skills: ["LLM", "Evals", "Docs"],
    difficulty: "intermediate" as const,
    href: "https://github.com",
  },
];

function difficultyTone(
  level: (typeof REPO_PLACEHOLDERS)[number]["difficulty"],
): "success" | "warning" | "primary" {
  if (level === "beginner") {
    return "success";
  }
  if (level === "intermediate") {
    return "warning";
  }
  return "primary";
}

export default function GitHubResourceSweeperPage() {
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

        <section className="mt-8 max-w-[800px] animate-fade-up">
          <h1 className="font-display text-[2rem] font-semibold text-primary">
            GitHub Resource Sweeper
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-ink-secondary">
            Two-column repo grid scaffold. Difficulty badges use semantic hues from the design rules;
            summaries will be powered by curated metadata and AI later.
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {REPO_PLACEHOLDERS.map((repo, index) => (
            <Card
              key={repo.name}
              className="flex h-full flex-col animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={difficultyTone(repo.difficulty)}>{repo.difficulty}</Badge>
                <p className="font-mono text-sm text-ink">{repo.name}</p>
              </div>
              <p className="mt-4 flex-1 text-[0.9375rem] leading-6 text-ink-secondary">
                {repo.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {repo.skills.map((skill) => (
                  <Badge key={skill} tone="default">
                    {skill}
                  </Badge>
                ))}
              </div>
              <Button
                variant="secondary"
                href={repo.href}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-6"
              >
                View on GitHub
              </Button>
            </Card>
          ))}
        </section>
      </main>
    </>
  );
}
