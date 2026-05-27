import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Card({
  children,
  interactive = false,
  className = "",
  style,
}: CardProps) {
  return (
    <div
      className={`card ${interactive ? "card-interactive" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
