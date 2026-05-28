"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Step4Value = {
  label: string;
};

export type Step4Errors = Partial<Record<keyof Step4Value, string>>;

type StepLabelProps = {
  value: Step4Value;
  errors: Step4Errors;
  suggestion: string;
  onChange: (next: Step4Value) => void;
};

export function StepLabel({ value, errors, suggestion, onChange }: StepLabelProps) {
  // Pre-fill with suggestion on first render if empty
  useEffect(() => {
    if (!value.label && suggestion) {
      onChange({ label: suggestion });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  return (
    <Card interactive={false} className="animate-fade-up">
      <h2 className="font-display text-[2rem] italic text-primary">
        Name this profile
      </h2>
      <p className="mt-2 text-sm text-ink-secondary">
        Give this profile a memorable label so you can switch between multiple
        career paths later. We&apos;ve suggested one based on your answers.
      </p>

      <div className="mt-8 max-w-md space-y-2">
        <Label htmlFor="profile_label">Profile label</Label>
        <Input
          id="profile_label"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={suggestion || "e.g. Data Analyst — Financial Services"}
          aria-invalid={!!errors.label}
          maxLength={60}
        />
        {errors.label ? (
          <p className="text-xs text-accent">{errors.label}</p>
        ) : (
          <p className="text-xs text-ink-muted">
            {value.label.length > 0
              ? `${value.label.length} / 60 characters`
              : "Auto-suggested from your target role and industry"}
          </p>
        )}
      </div>
    </Card>
  );
}
