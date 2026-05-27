import { Progress } from "@/components/ui/progress";

type OnboardingProgressProps = {
  step: 1 | 2 | 3;
};

export function OnboardingProgress({ step }: OnboardingProgressProps) {
  // Step-to-percent mapping keeps the bar simple and predictable.
  const value = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
          Step {step} of 3
        </p>
        <p className="text-xs text-ink-muted">{value}%</p>
      </div>
      <Progress className="mt-2" value={value} />
    </div>
  );
}

