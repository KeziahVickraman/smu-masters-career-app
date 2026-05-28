import { Progress } from "@/components/ui/progress";

type OnboardingProgressProps = {
  step: 1 | 2 | 3 | 4;
  total?: 3 | 4;
};

export function OnboardingProgress({ step, total = 3 }: OnboardingProgressProps) {
  const value = Math.round((step / total) * 100);

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
          Step {step} of {total}
        </p>
        <p className="text-xs text-ink-muted">{value}%</p>
      </div>
      <Progress className="mt-2" value={value} />
    </div>
  );
}
