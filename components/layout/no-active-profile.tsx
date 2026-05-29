import { Button } from "@/components/ui/button";

// Shared empty state shown by any feature that needs an active profile to work.
// Keeps the "no profile" experience consistent across the app.
export function NoActiveProfile({
  feature,
}: {
  /** Short description of what the feature personalises, e.g. "Job search" */
  feature: string;
}) {
  return (
    <div className="py-4 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">No active profile</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
        {feature} is personalised to your target role and skills. Activate a profile
        to begin.
      </p>
      <div className="mt-4 flex justify-center">
        <Button href="/profile">Select a profile →</Button>
      </div>
    </div>
  );
}
