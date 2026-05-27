"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDUSTRIES,
  PROGRAMMES,
  PROGRAMME_YEARS,
  type Industry,
  type Programme,
  type ProgrammeYear,
} from "@/lib/schema";

export type Step1Value = {
  programme?: Programme;
  programme_year?: ProgrammeYear;
  current_industry?: Industry;
  target_industry?: Industry;
};

export type Step1Errors = Partial<Record<keyof Step1Value, string>>;

type StepProgrammeIndustryProps = {
  value: Step1Value;
  errors: Step1Errors;
  onChange: (next: Step1Value) => void;
};

export function StepProgrammeIndustry({
  value,
  errors,
  onChange,
}: StepProgrammeIndustryProps) {
  return (
    <Card interactive={false} className="animate-fade-up">
      <h2 className="font-display text-[2rem] italic text-primary">
        Programme &amp; Industry
      </h2>
      <p className="mt-2 text-sm text-ink-secondary">
        These fields shape your default career pathways and content mix.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="programme">SMU Masters programme</Label>
          <Select
            value={value.programme}
            onValueChange={(programme) =>
              onChange({ ...value, programme: programme as Programme })
            }
          >
            <SelectTrigger id="programme" aria-invalid={!!errors.programme}>
              <SelectValue placeholder="Select programme" />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMMES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.programme ? (
            <p className="text-xs text-accent">{errors.programme}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="programme_year">Programme year</Label>
          <Select
            value={value.programme_year}
            onValueChange={(programme_year) =>
              onChange({
                ...value,
                programme_year: programme_year as ProgrammeYear,
              })
            }
          >
            <SelectTrigger id="programme_year" aria-invalid={!!errors.programme_year}>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMME_YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.programme_year ? (
            <p className="text-xs text-accent">{errors.programme_year}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_industry">Current industry</Label>
          <Select
            value={value.current_industry}
            onValueChange={(current_industry) =>
              onChange({
                ...value,
                current_industry: current_industry as Industry,
              })
            }
          >
            <SelectTrigger id="current_industry" aria-invalid={!!errors.current_industry}>
              <SelectValue placeholder="Select current industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.current_industry ? (
            <p className="text-xs text-accent">{errors.current_industry}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_industry">Target industry</Label>
          <Select
            value={value.target_industry}
            onValueChange={(target_industry) =>
              onChange({
                ...value,
                target_industry: target_industry as Industry,
              })
            }
          >
            <SelectTrigger id="target_industry" aria-invalid={!!errors.target_industry}>
              <SelectValue placeholder="Select target industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.target_industry ? (
            <p className="text-xs text-accent">{errors.target_industry}</p>
          ) : null}
        </div>
      </div>

      {/* Intentionally no extra fields beyond schema.json */}
    </Card>
  );
}

