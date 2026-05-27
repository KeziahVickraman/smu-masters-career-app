import type { ReactNode } from "react";

type BadgeTone =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "primary"
  | "info"
  | "muted";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClass: Record<BadgeTone, string> = {
  default:
    "border-border bg-surface-muted text-ink-secondary",
  accent: "border-accent/40 bg-surface-muted text-accent",
  success: "border-success/35 bg-surface-muted text-success",
  warning: "border-warning/35 bg-surface-muted text-warning",
  primary: "border-primary/35 bg-surface-muted text-primary",
  info: "border-info/35 bg-surface-muted text-info",
  muted: "border-border bg-surface text-ink-muted",
};

export function Badge({
  children,
  tone = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-[3px] font-mono text-[11px] font-medium uppercase tracking-wider ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
