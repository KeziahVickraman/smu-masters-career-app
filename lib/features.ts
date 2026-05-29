export type AppFeature = {
  slug: "interview-prep" | "job-board" | "github";
  title: string;
  subtitle: string;
  description: string;
  status: string;
};

// Order reflects the intended pipeline: discover & enrich repos in GitHub first,
// then turn them into interview questions, then track applications.
export const APP_FEATURES: AppFeature[] = [
  {
    slug: "github",
    title: "GitHub",
    subtitle: "Learn and contribute faster",
    description:
      "Public repository explorer powered by GitHub Search and AI summaries — repos matched to your programme, role, and skills. Saved repos feed your interview questions.",
    status: "Live",
  },
  {
    slug: "interview-prep",
    title: "Interview Prep",
    subtitle: "Programme + role-specific practice",
    description:
      "Mock interview workspace for Data Analytics, Business AI, and Finance students, with questions grounded in the repos you save.",
    status: "Live",
  },
  {
    slug: "job-board",
    title: "Job Board",
    subtitle: "Singapore-focused listings",
    description:
      "Live Singapore listings matched to your target role and industry, with a built-in application tracker.",
    status: "Live",
  },
];
