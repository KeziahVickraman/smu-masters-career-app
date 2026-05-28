"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getActiveEntry,
  PROFILE_CHANGE_EVENT,
  readActiveProfileId,
  readProfiles,
  writeActiveProfileId,
  writeProfiles,
  type StoredProfileEntry,
} from "@/lib/profiles";
import type { UserProfile } from "@/lib/schema";

// ── Context shape ─────────────────────────────────────────────────────────────

interface ProfileContextValue {
  /** All stored profile entries */
  profiles: StoredProfileEntry[];
  /** UUID of the currently active profile, or null */
  activeProfileId: string | null;
  /** The full UserProfile for the active entry, or null */
  activeProfile: UserProfile | null;
  /** Activate a profile by id (null deactivates all) */
  setActiveProfileId: (id: string | null) => void;
  /** Re-read profiles from localStorage (call after adding / editing / deleting) */
  refreshProfiles: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  activeProfileId: null,
  activeProfile: null,
  setActiveProfileId: () => {},
  refreshProfiles: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<StoredProfileEntry[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  const load = useCallback(() => {
    const ps = readProfiles();
    const aid = readActiveProfileId();
    setProfiles(ps);
    setActiveProfileIdState(aid);
  }, []);

  useEffect(() => {
    load();

    // Re-read on same-tab PROFILE_CHANGE_EVENT or cross-tab storage events
    window.addEventListener(PROFILE_CHANGE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(PROFILE_CHANGE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [load]);

  const setActiveProfileId = useCallback((id: string | null) => {
    writeActiveProfileId(id);
    setActiveProfileIdState(id);
  }, []);

  const refreshProfiles = useCallback(() => {
    const ps = readProfiles();
    setProfiles(ps);
    // Re-read profiles from storage and persist back (handles migration side-effects)
    writeProfiles(ps);
  }, []);

  const activeEntry = getActiveEntry(profiles, activeProfileId);
  const activeProfile = activeEntry?.profile ?? null;

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile,
        setActiveProfileId,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfiles() {
  return useContext(ProfileContext);
}
