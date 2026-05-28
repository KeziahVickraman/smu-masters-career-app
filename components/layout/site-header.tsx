"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_FEATURES } from "@/lib/features";
import { useProfiles } from "@/contexts/profile-context";

function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  return `flex h-16 items-center border-b-2 text-sm font-medium transition-colors duration-150 ${
    active
      ? "border-accent text-ink"
      : "border-transparent text-ink-secondary hover:text-ink"
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { activeProfile } = useProfiles();

  const profileHref = "/profile";
  const profileActive = isNavActive(pathname, profileHref) || isNavActive(pathname, "/onboarding");

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-[rgba(247,246,243,0.92)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 md:px-12">
        <Link href="/" className="font-display text-lg text-primary">
          SMU Career Companion
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className={navLinkClass(isNavActive(pathname, "/"))}>
            Dashboard
          </Link>
          {APP_FEATURES.map((feature) => {
            const href = `/${feature.slug}`;
            return (
              <Link
                key={feature.slug}
                href={href}
                className={`${navLinkClass(isNavActive(pathname, href))} hidden sm:flex`}
              >
                {feature.title}
              </Link>
            );
          })}
          <Link
            href={profileHref}
            className={`${navLinkClass(profileActive)} hidden sm:flex items-center gap-2`}
          >
            Profile
            {activeProfile ? (
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary max-w-[120px] truncate">
                {activeProfile.user.target_role}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-ink-muted">
                No profile
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
