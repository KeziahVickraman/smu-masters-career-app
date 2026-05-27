"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "default" | "compact" | "hero";

type ButtonBaseProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type ButtonAsButton = ButtonBaseProps & {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type ButtonAsLink = ButtonBaseProps &
  Omit<ComponentProps<typeof Link>, "className" | "children">;

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 px-4 text-sm",
  compact: "h-8 px-3 text-sm",
  hero: "h-11 px-5 text-sm",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-light border border-primary",
  secondary:
    "bg-transparent text-ink border border-border hover:border-border-strong",
  danger:
    "bg-transparent text-accent border border-accent hover:bg-surface-muted",
};

const disabledClasses = "disabled:cursor-not-allowed disabled:opacity-50";

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className: string,
) {
  return `inline-flex items-center justify-center rounded-[8px] font-sans font-medium transition-all duration-150 ease-in-out ${disabledClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
}

export function Button({
  children,
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  const classes = buttonClasses(variant, size, className);

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { type = "button", onClick, disabled } = props as ButtonAsButton;

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
