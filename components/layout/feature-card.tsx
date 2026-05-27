import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AppFeature } from "@/lib/features";

type FeatureCardProps = {
  feature: AppFeature;
  style?: CSSProperties;
};

export function FeatureCard({ feature, style }: FeatureCardProps) {
  return (
    <Card interactive className="flex h-full flex-col animate-fade-up" style={style}>
      <h2 className="text-[1.375rem] font-semibold text-ink">{feature.title}</h2>
      <p className="mt-1 text-sm text-ink-secondary">{feature.subtitle}</p>
      <p className="mt-3 flex-1 text-[0.9375rem] leading-6 text-ink-secondary">
        {feature.description}
      </p>
      <Button
        href={`/${feature.slug}`}
        variant="secondary"
        className="mt-6 w-fit bg-surface-muted text-ink hover:bg-surface"
      >
        Open section
      </Button>
    </Card>
  );
}
