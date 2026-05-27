"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_FEATURES } from "@/lib/features";

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

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-[rgba(247,246,243,0.92)] backdrop-blur-[12px]">
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
        </nav>
      </div>
    </header>
  );
}
