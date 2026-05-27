"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  SKILLS_AI_AND_ML,
  SKILLS_DATA_AND_ANALYTICS,
  SKILLS_FINANCE,
  SKILLS_SOFT_SKILLS,
  SKILLS_TECHNOLOGY,
  type SkillAiAndMl,
  type SkillDataAndAnalytics,
  type SkillFinance,
  type SkillSoftSkills,
  type SkillTechnology,
  type SkillsSelfReported,
} from "@/lib/schema";

export type Step3Value = SkillsSelfReported;
export type Step3Errors = Partial<Record<keyof SkillsSelfReported, string>>;

type StepSkillsProps = {
  value: Step3Value;
  errors: Step3Errors;
  onChange: (next: Step3Value) => void;
};

function toggleInArray<T extends string>(arr: readonly T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function StepSkills({ value, errors, onChange }: StepSkillsProps) {
  const groups = useMemo(
    () => [
      {
        key: "data_and_analytics" as const,
        title: "Data & Analytics",
        items: SKILLS_DATA_AND_ANALYTICS as readonly SkillDataAndAnalytics[],
      },
      {
        key: "ai_and_ml" as const,
        title: "AI & ML",
        items: SKILLS_AI_AND_ML as readonly SkillAiAndMl[],
      },
      {
        key: "finance" as const,
        title: "Finance",
        items: SKILLS_FINANCE as readonly SkillFinance[],
      },
      {
        key: "technology" as const,
        title: "Technology",
        items: SKILLS_TECHNOLOGY as readonly SkillTechnology[],
      },
      {
        key: "soft_skills" as const,
        title: "Soft Skills",
        items: SKILLS_SOFT_SKILLS as readonly SkillSoftSkills[],
      },
    ],
    [],
  );

  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({
    data_and_analytics: true,
    ai_and_ml: false,
    finance: false,
    technology: false,
    soft_skills: false,
  });

  return (
    <Card interactive={false} className="animate-fade-up">
      <h2 className="font-display text-[2rem] italic text-primary">Skills</h2>
      <p className="mt-2 text-sm text-ink-secondary">
        Select skills you already have. This is used for skills-gap and recommendations.
      </p>

      <div className="mt-8 space-y-4">
        {groups.map((group, groupIdx) => {
          const selected = value[group.key];
          const open = openKeys[group.key] ?? false;
          return (
            <Collapsible
              key={group.key}
              open={open}
              onOpenChange={(nextOpen) =>
                setOpenKeys((prev) => ({ ...prev, [group.key]: nextOpen }))
              }
            >
              <div className="flex items-end justify-between rounded-md border border-border bg-surface px-4 py-3">
                <div>
                  <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                    Group {groupIdx + 1} / 5
                  </p>
                  <p className="mt-1 text-[1.125rem] font-medium text-ink">
                    {group.title}
                  </p>
                </div>
                <CollapsibleTrigger
                  className={cn(
                    "text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink",
                  )}
                >
                  {open ? "Collapse" : "Expand"}
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((skill) => {
                    const id = `${group.key}-${skill}`.replace(/\s+/g, "_");
                    const checked = selected.includes(skill as never);
                    return (
                      <label
                        key={skill}
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-muted px-4 py-3 transition-colors duration-150 hover:border-border-strong"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={() => {
                            // Toggling is a pure state transition; it keeps ordering stable.
                            onChange({
                              ...value,
                              [group.key]: toggleInArray(
                                selected as readonly string[],
                                skill as string,
                              ),
                            } as Step3Value);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-secondary">
                            {skill}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {errors[group.key] ? (
                  <p className="mt-2 text-xs text-accent">{errors[group.key]}</p>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </Card>
  );
}

