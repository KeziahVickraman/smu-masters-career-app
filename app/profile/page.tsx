"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfiles } from "@/contexts/profile-context";
import {
  MAX_PROFILES,
  readProfiles,
  writeActiveProfileId,
  writeProfiles,
  type StoredProfileEntry,
} from "@/lib/profiles";

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: StoredProfileEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-ink">Delete profile?</p>
        <p className="mt-1.5 text-sm text-ink-secondary">
          <strong className="font-medium text-ink">{entry.label}</strong> will be permanently
          removed. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-8 items-center rounded-md border border-accent bg-accent px-3 text-sm font-medium text-white transition-all duration-150 hover:opacity-90"
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── "No active profile" card ──────────────────────────────────────────────────

function NoneCard({
  isActive,
  onSelect,
}: {
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-surface p-5 transition-all duration-150 ${
        isActive
          ? "border-primary shadow-[0_0_0_2px_rgba(0,33,71,0.15)]"
          : "border-border hover:border-border-strong"
      }`}
    >
      {isActive && (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 5l2.5 2.5 4.5-4.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <p className="pr-8 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        No active profile
      </p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
        All modules will prompt you to select or create a profile before generating content.
      </p>

      {!isActive && (
        <div className="mt-5">
          <Button type="button" variant="secondary" onClick={onSelect}>
            Select
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────

function ProfileCard({
  entry,
  isActive,
  canDelete,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  entry: StoredProfileEntry;
  isActive: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const { user } = entry.profile;

  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-surface p-5 transition-all duration-150 ${
        isActive
          ? "border-primary shadow-[0_0_0_2px_rgba(0,33,71,0.15)]"
          : "border-border hover:border-border-strong"
      }`}
    >
      {/* Active checkmark badge */}
      {isActive && (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 5l2.5 2.5 4.5-4.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      {/* Header */}
      <p className="pr-8 font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
        {entry.label}
      </p>

      {/* Details */}
      <div className="mt-3 flex flex-col gap-1.5 text-[0.8125rem] text-ink-secondary">
        <p>
          <span className="text-ink-muted">Programme: </span>
          {user.programme.replace(/_/g, " ")}
        </p>
        <p>
          <span className="text-ink-muted">Target role: </span>
          <strong className="font-medium text-ink">{user.target_role}</strong>
        </p>
        <p>
          <span className="text-ink-muted">Target industry: </span>
          {user.target_industry}
        </p>
        {user.interview_stage && (
          <p>
            <span className="text-ink-muted">Stage: </span>
            {user.interview_stage === "pre"
              ? "Preparing to apply"
              : user.interview_stage === "during"
              ? "Actively interviewing"
              : user.interview_stage === "post"
              ? "Offer received"
              : "Not job hunting"}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2">
        {isActive ? (
          <button
            type="button"
            onClick={onDeactivate}
            className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
          >
            Deselect
          </button>
        ) : (
          <Button type="button" onClick={onActivate}>
            Activate
          </Button>
        )}

        <Link
          href={`/onboarding?edit=${entry.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-ink-secondary transition-all duration-150 hover:border-border-strong hover:text-ink"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path
              d="M7.5 1.5l2 2-6 6H1.5v-2l6-6z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit
        </Link>

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${entry.label}`}
            className="ml-auto text-ink-muted transition-colors hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 3h12M4.5 3V2a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M2 3l.8 8.4A1 1 0 003.8 12.5h6.4a1 1 0 001-0.9L12 3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { activeProfileId, setActiveProfileId, refreshProfiles } = useProfiles();

  // Local profiles state (avoid re-triggering context reads on every keystroke)
  const [profiles, setProfiles] = useState<StoredProfileEntry[]>([]);
  const [pendingDelete, setPendingDelete] = useState<StoredProfileEntry | null>(null);

  useEffect(() => {
    setProfiles(readProfiles());
  }, [activeProfileId]); // re-read when active profile changes

  function handleActivate(id: string) {
    setActiveProfileId(id);
    refreshProfiles();
  }

  function handleDeactivate() {
    setActiveProfileId(null);
    refreshProfiles();
  }

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    const next = profiles.filter((p) => p.id !== pendingDelete.id);
    writeProfiles(next);

    // If we just deleted the active profile, clear it
    if (activeProfileId === pendingDelete.id) {
      writeActiveProfileId(null);
      setActiveProfileId(null);
    }

    setProfiles(next);
    refreshProfiles();
    setPendingDelete(null);
  }

  const atLimit = profiles.length >= MAX_PROFILES;

  return (
    <>
      <SiteHeader />
      <main className="app-shell">
        <Link
          href="/"
          className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink"
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <section className="mt-8 max-w-[800px] animate-fade-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-[2rem] font-semibold text-primary">
                Profiles
              </h1>
              <p className="mt-2 text-[0.9375rem] leading-7 text-ink-secondary">
                Switch between career paths instantly — each profile drives a separate set of
                interview questions and repo recommendations.
              </p>
            </div>
            <div className="shrink-0 pt-1">
              {atLimit ? (
                <Badge tone="warning">
                  {profiles.length} / {MAX_PROFILES} — limit reached
                </Badge>
              ) : (
                <Badge tone="default">
                  {profiles.length} / {MAX_PROFILES}
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* No profiles state */}
        {profiles.length === 0 && (
          <div className="mt-14 flex flex-col items-center gap-4 py-8 text-center animate-fade-up">
            <p className="text-[0.9375rem] font-medium text-ink">No profiles yet</p>
            <p className="max-w-sm text-sm text-ink-muted">
              Create your first profile to personalise Interview Prep and GitHub resources to
              your programme and target role.
            </p>
            <Button href="/onboarding">Create first profile →</Button>
          </div>
        )}

        {/* Profile grid */}
        {profiles.length > 0 && (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
            {/* "None" option — always first */}
            <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
              <NoneCard
                isActive={activeProfileId === null}
                onSelect={handleDeactivate}
              />
            </div>

            {profiles.map((entry, i) => (
              <div
                key={entry.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <ProfileCard
                  entry={entry}
                  isActive={activeProfileId === entry.id}
                  canDelete={profiles.length > 1}
                  onActivate={() => handleActivate(entry.id)}
                  onDeactivate={handleDeactivate}
                  onDelete={() => setPendingDelete(entry)}
                />
              </div>
            ))}

            {/* Add new profile card */}
            {!atLimit && (
              <button
                type="button"
                onClick={() => router.push("/onboarding")}
                className="flex min-h-[180px] animate-fade-up flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/25 bg-transparent p-5 text-center transition-all duration-150 hover:border-primary/50 hover:bg-primary/3"
                style={{ animationDelay: `${profiles.length * 50}ms` }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-primary/40">
                  <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-medium text-ink-secondary">Add new profile</p>
              </button>
            )}
          </section>
        )}



        {/* Limit notice */}
        {atLimit && (
          <p className="mt-6 text-sm text-ink-muted animate-fade-up">
            You have reached the {MAX_PROFILES} profile limit. Delete one to add a new one.
          </p>
        )}
      </main>

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <DeleteDialog
          entry={pendingDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
