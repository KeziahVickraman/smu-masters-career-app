import type { UserProfile } from "@/lib/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoredProfileEntry {
  id: string;
  label: string;
  created_at: string;
  profile: UserProfile;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

export const KEY_PROFILES = "smu_profiles";
export const KEY_ACTIVE_PROFILE_ID = "smu_active_profile_id";

const KEY_LEGACY_PROFILE = "smu_career_profile";

// Custom event dispatched on same-tab profile changes so all consumers re-read
export const PROFILE_CHANGE_EVENT = "smu:profile-change";

export const MAX_PROFILES = 5;

// ── Read / write ──────────────────────────────────────────────────────────────

export function readProfiles(): StoredProfileEntry[] {
  try {
    const raw = localStorage.getItem(KEY_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as StoredProfileEntry[];
      }
    }

    // One-time migration from the legacy single-profile key
    const legacy = localStorage.getItem(KEY_LEGACY_PROFILE);
    if (legacy) {
      const profile = JSON.parse(legacy) as UserProfile;
      const entry: StoredProfileEntry = {
        id: generateId(),
        label: suggestLabel(profile),
        created_at: profile.metadata?.created_at ?? new Date().toISOString(),
        profile,
      };
      writeProfiles([entry]);
      writeActiveProfileId(entry.id);
      localStorage.removeItem(KEY_LEGACY_PROFILE);
      return [entry];
    }

    return [];
  } catch {
    return [];
  }
}

export function writeProfiles(entries: StoredProfileEntry[]) {
  localStorage.setItem(KEY_PROFILES, JSON.stringify(entries));
}

export function readActiveProfileId(): string | null {
  try {
    return localStorage.getItem(KEY_ACTIVE_PROFILE_ID);
  } catch {
    return null;
  }
}

export function writeActiveProfileId(id: string | null) {
  try {
    if (id === null) {
      localStorage.removeItem(KEY_ACTIVE_PROFILE_ID);
    } else {
      localStorage.setItem(KEY_ACTIVE_PROFILE_ID, id);
    }
  } catch {
    /* localStorage unavailable (SSR / private mode) — skip silently */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getActiveEntry(
  profiles: StoredProfileEntry[],
  activeId: string | null,
): StoredProfileEntry | null {
  if (!activeId) return null;
  return profiles.find((p) => p.id === activeId) ?? null;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function suggestLabel(profile: UserProfile): string {
  const role = profile.user?.target_role?.trim();
  const industry = profile.user?.target_industry?.trim();
  if (role && industry) return `${role} — ${industry}`;
  if (role) return role;
  return "My Profile";
}
