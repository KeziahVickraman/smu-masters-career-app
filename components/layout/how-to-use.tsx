"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const STEPS = [
  {
    step: "01",
    title: "Set up your profile",
    body: "Go to Profile in the nav and fill in your programme, target role, and skills. Every module uses this to personalise its output.",
    href: "/onboarding",
    cta: "Go to Profile →",
  },
  {
    step: "02",
    title: "Explore curated GitHub repos",
    body: "The GitHub Resource Sweeper searches public repos matched to your programme and role. Save the ones you want to revisit, and click “Get AI summary” on any card for a personalised breakdown.",
    href: "/github",
    cta: "Open GitHub Sweeper →",
  },
  {
    step: "03",
    title: "Browse Singapore job listings",
    body: "The Job Board aggregates listings relevant to SMU Masters students. Filter by role or industry and track your applications.",
    href: "/job-board",
    cta: "Open Job Board →",
  },
  {
    step: "04",
    title: "Practice for your interviews",
    body: "Interview Prep gives you question sets by role type — behavioural, technical, and case. Work through them before your next round.",
    href: "/interview-prep",
    cta: "Open Interview Prep →",
  },
];

export function HowToUse() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border bg-surface">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left">
          <div>
            <p className="font-medium text-ink">How to use this tool</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Four steps to get the most out of SMU Career Companion
            </p>
          </div>
          {/* Chevron rotates when open */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ol className="border-t border-border">
            {STEPS.map((item, index) => (
              <li
                key={item.step}
                className={`flex gap-4 px-5 py-4 ${
                  index < STEPS.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-[0.9375rem] leading-6 text-ink-secondary">
                    {item.body}
                  </p>
                  <Link
                    href={item.href}
                    className="mt-2 inline-block text-sm font-medium text-primary transition-colors hover:text-primary-light"
                  >
                    {item.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
