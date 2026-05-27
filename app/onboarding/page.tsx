"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import {
  StepProgrammeIndustry,
  type Step1Errors,
  type Step1Value,
} from "@/components/onboarding/step-programme-industry";
import {
  StepRoleExperience,
  type Step2Errors,
  type Step2Value,
} from "@/components/onboarding/step-role-experience";
import {
  StepSkills,
  type Step3Errors,
  type Step3Value,
} from "@/components/onboarding/step-skills";
import {
  DEFAULT_ASSESSMENT_MODE,
  DEFAULT_OUTPUT_FORMAT,
  type SkillsSelfReported,
  type UserProfile,
} from "@/lib/schema";
import { validateUserProfile } from "@/lib/validate-profile";

type Step = 1 | 2 | 3;

function nowIso() {
  return new Date().toISOString();
}

function safeRandomSessionId() {
  // `crypto.randomUUID()` is fast and collision-resistant in modern browsers.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback keeps onboarding functional in older runtimes.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptySkills(): SkillsSelfReported {
  return {
    data_and_analytics: [],
    ai_and_ml: [],
    finance: [],
    technology: [],
    soft_skills: [],
  };
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  // Each step owns its slice of schema-backed data; this makes validation and UX predictable.
  const [step1, setStep1] = useState<Step1Value>({});
  const [step2, setStep2] = useState<Step2Value>({ target_companies: [] });
  const [step3, setStep3] = useState<Step3Value>(emptySkills());

  const [errors1, setErrors1] = useState<Step1Errors>({});
  const [errors2, setErrors2] = useState<Step2Errors>({});
  const [errors3, setErrors3] = useState<Step3Errors>({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const title = useMemo(() => {
    if (step === 1) return "Programme & Industry";
    if (step === 2) return "Role & Experience";
    return "Skills";
  }, [step]);

  function validateStep1(value: Step1Value): { ok: true } | { ok: false; errors: Step1Errors } {
    const next: Step1Errors = {};

    if (!value.programme) next.programme = "Required";
    if (!value.programme_year) next.programme_year = "Required";
    if (!value.current_industry) next.current_industry = "Required";
    if (!value.target_industry) next.target_industry = "Required";

    if (Object.keys(next).length > 0) return { ok: false, errors: next };
    return { ok: true };
  }

  function validateStep2(value: Step2Value): { ok: true } | { ok: false; errors: Step2Errors } {
    const next: Step2Errors = {};

    if (!value.current_role?.trim()) next.current_role = "Required";
    if (!value.target_role?.trim()) next.target_role = "Required";
    if (value.years_experience === undefined || Number.isNaN(value.years_experience)) {
      next.years_experience = "Required";
    }
    if (!value.interview_stage) next.interview_stage = "Required";

    // We allow empty strings while typing, but final payload strips them.
    if (value.target_companies.length > 5) {
      next.target_companies = "Max 5 companies";
    }

    if (Object.keys(next).length > 0) return { ok: false, errors: next };
    return { ok: true };
  }

  function validateStep3(value: Step3Value): { ok: true } | { ok: false; errors: Step3Errors } {
    // Skills are optional by design in SCHEMA.md (binary have/don't have, can be empty).
    // We keep this hook for future constraints without changing the UX flow.
    void value;
    return { ok: true };
  }

  function goNext() {
    // This state transition is the core guardrail: we never advance unless the current step is valid.
    setSubmitErrors([]);

    if (step === 1) {
      const result = validateStep1(step1);
      if (!result.ok) {
        setErrors1(result.errors);
        return;
      }
      setErrors1({});
      setStep(2);
      return;
    }

    if (step === 2) {
      const result = validateStep2(step2);
      if (!result.ok) {
        setErrors2(result.errors);
        return;
      }
      setErrors2({});
      setStep(3);
      return;
    }
  }

  function goBack() {
    // Back is always allowed; we keep previously entered state intact for a fast UX.
    setSubmitErrors([]);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function buildProfile(): UserProfile {
    const createdAt = nowIso();
    const updatedAt = createdAt;

    const cleanedCompanies = step2.target_companies
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 5);

    return {
      user: {
        programme: step1.programme!,
        programme_year: step1.programme_year!,
        current_industry: step1.current_industry!,
        target_industry: step1.target_industry!,
        current_role: step2.current_role!.trim(),
        target_role: step2.target_role!.trim(),
        years_experience: step2.years_experience!,
        interview_stage: step2.interview_stage!,
        target_companies: cleanedCompanies.length > 0 ? cleanedCompanies : undefined,
        skills_self_reported: step3,
      },
      assessment_mode: DEFAULT_ASSESSMENT_MODE,
      output_format: DEFAULT_OUTPUT_FORMAT,
      metadata: {
        created_at: createdAt,
        updated_at: updatedAt,
        session_id: safeRandomSessionId(),
        onboarding_complete: true,
      },
    };
  }

  function completeOnboarding() {
    setSubmitErrors([]);

    const r1 = validateStep1(step1);
    if (!r1.ok) {
      setErrors1(r1.errors);
      setStep(1);
      return;
    }
    const r2 = validateStep2(step2);
    if (!r2.ok) {
      setErrors2(r2.errors);
      setStep(2);
      return;
    }
    const r3 = validateStep3(step3);
    if (!r3.ok) {
      setErrors3(r3.errors);
      setStep(3);
      return;
    }

    const profile = buildProfile();

    // Final guardrail: schema validation must pass before persistence.
    const result = validateUserProfile(profile);
    if (!result.ok) {
      setSubmitErrors(result.errors);
      return;
    }

    // localStorage is client-only; this page is a client component by design.
    localStorage.setItem("smu_career_profile", JSON.stringify(profile));

    router.push("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
          >
            ← Back to dashboard
          </Link>
          <Badge tone="accent">Onboarding</Badge>
        </div>

        <section className="mt-8 content-narrow">
          <h1 className="font-display text-[3rem] italic leading-[1.1] text-primary">
            Build your profile
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-ink-secondary">
            Fast onboarding—three steps, no fluff. Your answers drive every module in the pipeline.
          </p>
        </section>

        <section className="mt-10">
          <OnboardingProgress step={step} />

          {step === 1 ? (
            <StepProgrammeIndustry value={step1} errors={errors1} onChange={setStep1} />
          ) : null}
          {step === 2 ? (
            <StepRoleExperience value={step2} errors={errors2} onChange={setStep2} />
          ) : null}
          {step === 3 ? (
            <StepSkills value={step3} errors={errors3} onChange={setStep3} />
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1}>
              Back
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={completeOnboarding}>
                Complete onboarding
              </Button>
            )}
          </div>

          {submitErrors.length > 0 ? (
            <Card interactive={false} className="mt-6">
              <p className="text-sm font-medium text-ink">Schema validation errors</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
                {submitErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <p className="mt-8 text-xs text-ink-muted">
            Currently on: <span className="font-mono">{title}</span>
          </p>
        </section>
      </main>
    </>
  );
}

