export type AppFeature = {
  slug: "interview-prep" | "job-board" | "github";
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
    slug: "github",
    title: "GitHub Resource Sweeper",
    subtitle: "Learn and contribute faster",
    description:
      "Public repository explorer powered by GitHub Search and AI summaries — repos matched to your programme, role, and skills.",
    status: "Live",
  },
];
