export type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

export const TODAY_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    label: "Interview Prep",
    detail: "Review 5 data analyst behavioural questions",
    href: "/interview-prep",
  },
  {
    id: "2",
    label: "Job Board",
    detail: "Check new Singapore listings from the past 48 hours",
    href: "/job-board",
  },
  {
    id: "3",
    label: "GitHub Sweeper",
    detail: "Explore beginner-friendly repos in the curated list",
    href: "/github-resource-sweeper",
  },
];
