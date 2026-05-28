"use client";

import { useMemo, useState, useEffect } from "react";
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
  StepLabel,
  type Step4Errors,
  type Step4Value,
} from "@/components/onboarding/step-label";
import {
  DEFAULT_ASSESSMENT_MODE,
  DEFAULT_OUTPUT_FORMAT,
  type SkillsSelfReported,
  type UserProfile,
} from "@/lib/schema";
import { validateUserProfile } from "@/lib/validate-profile";
import {
  generateId,
  MAX_PROFILES,
  readActiveProfileId,
  readProfiles,
  suggestLabel,
  writeActiveProfileId,
  writeProfiles,
  type StoredProfileEntry,
} from "@/lib/profiles";

type Step = 1 | 2 | 3 | 4;

function nowIso() {
  return new Date().toISOString();
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

// ── Pre-fill helpers (edit mode) ──────────────────────────────────────────────

function step1FromProfile(p: UserProfile): Step1Value {
  return {
    programme: p.user.programme,
    programme_year: p.user.programme_year,
    current_industry: p.user.current_industry,
    target_industry: p.user.target_industry,
  };
}

function step2FromProfile(p: UserProfile): Step2Value {
  return {
    current_role: p.user.current_role,
    target_role: p.user.target_role,
    years_experience: p.user.years_experience,
    interview_stage: p.user.interview_stage,
    target_companies: p.user.target_companies ?? [],
  };
}

function step3FromProfile(p: UserProfile): Step3Value {
  return {
    data_and_analytics: p.user.skills_self_reported?.data_and_analytics ?? [],
    ai_and_ml: p.user.skills_self_reported?.ai_and_ml ?? [],
    finance: p.user.skills_self_reported?.finance ?? [],
    technology: p.user.skills_self_reported?.technology ?? [],
    soft_skills: p.user.skills_self_reported?.soft_skills ?? [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface OnboardingClientProps {
  /** UUID of a profile to edit; undefined means create-new mode */
  editId?: string;
}

export function OnboardingClient({ editId }: OnboardingClientProps) {
  const router = useRouter();
  const isEditMode = !!editId;

  const [step, setStep] = useState<Step>(1);

  const [step1, setStep1] = useState<Step1Value>({});
  const [step2, setStep2] = useState<Step2Value>({ target_companies: [] });
  const [step3, setStep3] = useState<Step3Value>(emptySkills());
  const [step4, setStep4] = useState<Step4Value>({ label: "" });

  const [errors1, setErrors1] = useState<Step1Errors>({});
  const [errors2, setErrors2] = useState<Step2Errors>({});
  const [errors3, setErrors3] = useState<Step3Errors>({});
  const [errors4, setErrors4] = useState<Step4Errors>({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  // Profile limit check — for create mode
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    const profiles = readProfiles();

    if (isEditMode) {
      // Pre-fill form with existing profile data
      const existing = profiles.find((p) => p.id === editId);
      if (existing) {
        setStep1(step1FromProfile(existing.profile));
        setStep2(step2FromProfile(existing.profile));
        setStep3(step3FromProfile(existing.profile));
        setStep4({ label: existing.label });
      }
    } else {
      // Create mode: enforce 5-profile limit
      if (profiles.length >= MAX_PROFILES) {
        setAtLimit(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-suggested label derived from current step2 state
  const suggestion = useMemo(() => {
    const role = step2.target_role?.trim() ?? "";
    const industry = step1.target_industry?.trim() ?? "";
    if (role && industry) return `${role} — ${industry}`;
    if (role) return role;
    return "";
  }, [step2.target_role, step1.target_industry]);

  const title = useMemo(() => {
    if (step === 1) return "Programme & Industry";
    if (step === 2) return "Role & Experience";
    if (step === 3) return "Skills";
    return "Name this profile";
  }, [step]);

  // ── Validators ──────────────────────────────────────────────────────────────

  function validateStep1(v: Step1Value): { ok: true } | { ok: false; errors: Step1Errors } {
    const next: Step1Errors = {};
    if (!v.programme) next.programme = "Required";
    if (!v.programme_year) next.programme_year = "Required";
    if (!v.current_industry) next.current_industry = "Required";
    if (!v.target_industry) next.target_industry = "Required";
    return Object.keys(next).length > 0 ? { ok: false, errors: next } : { ok: true };
  }

  function validateStep2(v: Step2Value): { ok: true } | { ok: false; errors: Step2Errors } {
    const next: Step2Errors = {};
    if (!v.current_role?.trim()) next.current_role = "Required";
    if (!v.target_role?.trim()) next.target_role = "Required";
    if (v.years_experience === undefined || Number.isNaN(v.years_experience)) {
      next.years_experience = "Required";
    }
    if (!v.interview_stage) next.interview_stage = "Required";
    if (v.target_companies.length > 5) next.target_companies = "Max 5 companies";
    return Object.keys(next).length > 0 ? { ok: false, errors: next } : { ok: true };
  }

  function validateStep4(v: Step4Value): { ok: true } | { ok: false; errors: Step4Errors } {
    if (!v.label.trim()) return { ok: false, errors: { label: "Required" } };
    return { ok: true };
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function goNext() {
    setSubmitErrors([]);

    if (step === 1) {
      const r = validateStep1(step1);
      if (!r.ok) { setErrors1(r.errors); return; }
      setErrors1({});
      setStep(2);
      return;
    }

    if (step === 2) {
      const r = validateStep2(step2);
      if (!r.ok) { setErrors2(r.errors); return; }
      setErrors2({});
      setStep(3);
      return;
    }

    if (step === 3) {
      // Skills are optional — advance unconditionally
      setStep(4);
      return;
    }
  }

  function goBack() {
    setSubmitErrors([]);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  }

  // ── Build & save ─────────────────────────────────────────────────────────────

  function buildProfile(): UserProfile {
    const now = nowIso();
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
        created_at: now,
        updated_at: now,
        session_id: generateId(),
        onboarding_complete: true,
      },
    };
  }

  function completeOnboarding() {
    setSubmitErrors([]);

    const r1 = validateStep1(step1);
    if (!r1.ok) { setErrors1(r1.errors); setStep(1); return; }

    const r2 = validateStep2(step2);
    if (!r2.ok) { setErrors2(r2.errors); setStep(2); return; }

    const r4 = validateStep4(step4);
    if (!r4.ok) { setErrors4(r4.errors); return; }

    const profile = buildProfile();

    const validation = validateUserProfile(profile);
    if (!validation.ok) { setSubmitErrors(validation.errors); return; }

    const profiles = readProfiles();
    const label = step4.label.trim() || suggestion || "My Profile";
    const now = nowIso();

    let updatedProfiles: StoredProfileEntry[];
    let activeId: string;

    if (isEditMode) {
      // Update existing entry; preserve original created_at
      updatedProfiles = profiles.map((entry) => {
        if (entry.id !== editId) return entry;
        return {
          ...entry,
          label,
          profile: {
            ...profile,
            metadata: {
              ...profile.metadata,
              created_at: entry.profile.metadata?.created_at ?? now,
            },
          },
        };
      });
      activeId = editId!;
    } else {
      if (profiles.length >= MAX_PROFILES) {
        setSubmitErrors([`You have reached the ${MAX_PROFILES} profile limit. Delete one to add a new one.`]);
        return;
      }
      const newEntry: StoredProfileEntry = {
        id: generateId(),
        label,
        created_at: now,
        profile,
      };
      updatedProfiles = [...profiles, newEntry];
      activeId = newEntry.id;
    }

    writeProfiles(updatedProfiles);
    writeActiveProfileId(activeId);

    router.push("/profile");
  }

  // ── Limit gate ───────────────────────────────────────────────────────────────

  if (!isEditMode && atLimit) {
    return (
      <>
        <SiteHeader />
        <main className="app-shell">
          <Link
            href="/profile"
            className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
          >
            ← Back to profiles
          </Link>
          <section className="mt-14 flex flex-col items-center gap-4 py-8 text-center animate-fade-up">
            <p className="text-[0.9375rem] font-medium text-ink">Profile limit reached</p>
            <p className="max-w-sm text-sm text-ink-muted">
              You have reached the {MAX_PROFILES} profile limit. Delete one of your existing
              profiles to add a new one.
            </p>
            <Button href="/profile">Manage profiles →</Button>
          </section>
        </main>
      </>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        <div className="flex items-center justify-between">
          <Link
            href={isEditMode ? "/profile" : "/"}
            className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
          >
            ← {isEditMode ? "Back to profiles" : "Back to dashboard"}
          </Link>
          <Badge tone="accent">{isEditMode ? "Editing" : "New Profile"}</Badge>
        </div>

        <section className="mt-8 content-narrow">
          <h1 className="font-display text-[3rem] italic leading-[1.1] text-primary">
            {isEditMode ? "Edit profile" : "Build your profile"}
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-ink-secondary">
            {isEditMode
              ? "Update your details — all modules will use the revised profile immediately."
              : "Fast onboarding—four steps, no fluff. Your answers drive every module in the pipeline."}
          </p>
        </section>

        <section className="mt-10">
          <OnboardingProgress step={step} total={4} />

          {step === 1 && (
            <StepProgrammeIndustry value={step1} errors={errors1} onChange={setStep1} />
          )}
          {step === 2 && (
            <StepRoleExperience value={step2} errors={errors2} onChange={setStep2} />
          )}
          {step === 3 && (
            <StepSkills value={step3} errors={errors3} onChange={setStep3} />
          )}
          {step === 4 && (
            <StepLabel
              value={step4}
              errors={errors4}
              suggestion={suggestion}
              onChange={setStep4}
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1}>
              Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={completeOnboarding}>
                {isEditMode ? "Save changes" : "Create profile"}
              </Button>
            )}
          </div>

          {submitErrors.length > 0 && (
            <Card interactive={false} className="mt-6">
              <p className="text-sm font-medium text-ink">Errors</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">
                {submitErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </Card>
          )}

          <p className="mt-8 text-xs text-ink-muted">
            Currently on: <span className="font-mono">{title}</span>
          </p>
        </section>
      </main>
    </>
  );
}
