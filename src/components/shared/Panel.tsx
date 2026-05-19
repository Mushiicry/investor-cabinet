import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  tone?: "cyan" | "violet" | "yellow";
  className?: string;
  hover?: boolean;
};

export function Panel({
  children,
  tone = "cyan",
  className = "",
  hover = false,
}: PanelProps) {
  const map = { cyan: "cyber-panel-cyan", violet: "cyber-panel-violet", yellow: "cyber-panel-yellow" };
  return <div className={`cyber-panel ${map[tone]} ${hover ? "cyber-hover-panel" : ""} ${className}`}>{children}</div>;
}
