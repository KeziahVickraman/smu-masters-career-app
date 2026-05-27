export type AppFeature = {
  slug: "interview-prep" | "job-board" | "github-resource-sweeper";
  title: string;
  subtitle: string;
  description: string;
  status: string;
};

export const APP_FEATURES: AppFeature[] = [
  {
    slug: "interview-prep",
    title: "Interview Prep",
    subtitle: "Programme + role-specific practice",
    description:
      "Mock interview workspace for Data Analytics, Business AI, and Finance students with question categories by role type.",
    status: "UI scaffolded",
  },
  {
    slug: "job-board",
    title: "Job Board",
    subtitle: "Singapore-focused listings",
    description:
      "Aggregated listings relevant to SMU Masters students from public job sources, ready for ingestion and filtering logic.",
    status: "UI scaffolded",
  },
  {
    slug: "github-resource-sweeper",
    title: "GitHub Resource Sweeper",
    subtitle: "Learn and contribute faster",
    description:
      "Public repository explorer to surface contribution opportunities and learning resources with future AI summaries.",
    status: "UI scaffolded",
  },
];
