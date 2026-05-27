"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INTERVIEW_STAGES,
  type InterviewStage,
} from "@/lib/schema";

export type Step2Value = {
  current_role?: string;
  target_role?: string;
  years_experience?: number;
  interview_stage?: InterviewStage;
  target_companies: string[];
};

export type Step2Errors = Partial<Record<keyof Step2Value, string>>;

type StepRoleExperienceProps = {
  value: Step2Value;
  errors: Step2Errors;
  onChange: (next: Step2Value) => void;
};

export function StepRoleExperience({
  value,
  errors,
  onChange,
}: StepRoleExperienceProps) {
  // Target companies are optional, but schema caps them at 5.
  const canAddCompany = value.target_companies.length < 5;

  return (
    <Card interactive={false} className="animate-fade-up">
      <h2 className="font-display text-[2rem] italic text-primary">
        Role &amp; Experience
      </h2>
      <p className="mt-2 text-sm text-ink-secondary">
        Keep this practical—your inputs steer job matching and interview practice.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="current_role">Current role</Label>
          <Input
            id="current_role"
            value={value.current_role ?? ""}
            onChange={(e) => onChange({ ...value, current_role: e.target.value })}
            placeholder="e.g. Business Analyst"
            aria-invalid={!!errors.current_role}
          />
          {errors.current_role ? (
            <p className="text-xs text-accent">{errors.current_role}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_role">Target role</Label>
          <Input
            id="target_role"
            value={value.target_role ?? ""}
            onChange={(e) => onChange({ ...value, target_role: e.target.value })}
            placeholder="e.g. AI Product Manager"
            aria-invalid={!!errors.target_role}
          />
          {errors.target_role ? (
            <p className="text-xs text-accent">{errors.target_role}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="years_experience">Years of experience</Label>
          <Input
            id="years_experience"
            type="number"
            min={0}
            max={30}
            value={value.years_experience ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                years_experience:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="0"
            aria-invalid={!!errors.years_experience}
          />
          {errors.years_experience ? (
            <p className="text-xs text-accent">{errors.years_experience}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interview_stage">Interview stage</Label>
          <Select
            value={value.interview_stage}
            onValueChange={(interview_stage) =>
              onChange({
                ...value,
                interview_stage: interview_stage as InterviewStage,
              })
            }
          >
            <SelectTrigger id="interview_stage" aria-invalid={!!errors.interview_stage}>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.interview_stage ? (
            <p className="text-xs text-accent">{errors.interview_stage}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between">
          <Label>Target companies (optional, up to 5)</Label>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => {
              // Adding an empty slot is the fastest UX; we validate only non-empty values.
              if (!canAddCompany) return;
              onChange({ ...value, target_companies: [...value.target_companies, ""] });
            }}
            disabled={!canAddCompany}
          >
            Add company
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {value.target_companies.map((company, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Input
                value={company}
                onChange={(e) => {
                  const next = [...value.target_companies];
                  next[idx] = e.target.value;
                  onChange({ ...value, target_companies: next });
                }}
                placeholder="e.g. GIC"
              />
              <Button
                type="button"
                variant="danger"
                size="compact"
                onClick={() => {
                  // Removing keeps ordering stable and prevents holes in the array.
                  const next = value.target_companies.filter((_, i) => i !== idx);
                  onChange({ ...value, target_companies: next });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

