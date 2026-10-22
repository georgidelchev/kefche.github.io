import { cn } from "../lib/cn";

import type * as React from "react";

// Shared empty and error views (SPEC §2: every async UI state has loading,
// empty and error variants, a lost connection included). All text arrives
// translated.

interface StateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Buttons or links, e.g. a retry or "browse games" action. */
  action?: React.ReactNode;
  className?: string;
}

function StateView({
  icon,
  title,
  description,
  action,
  className,
  tone,
  ...aria
}: StateProps & { tone: "neutral" | "danger"; role?: "alert" | "status" }) {
  return (
    <div
      {...aria}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center",
        className,
      )}
    >
      {icon !== undefined && (
        <div
          aria-hidden="true"
          className={cn(
            "flex size-14 items-center justify-center rounded-full bg-surface-2 [&>svg]:size-7",
            tone === "danger" ? "text-danger" : "text-muted",
          )}
        >
          {icon}
        </div>
      )}
      <p className="text-lg font-semibold text-balance">{title}</p>
      {description !== undefined && <p className="max-w-prose text-muted">{description}</p>}
      {action !== undefined && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

/** Nothing to show yet (no friends, no matches...). */
function EmptyState(props: StateProps) {
  return <StateView tone="neutral" {...props} />;
}

/** Something failed. `live` announces it to screen readers when it appears after load. */
function ErrorState({ live = false, ...props }: StateProps & { live?: boolean }) {
  return <StateView tone="danger" {...(live ? { role: "alert" as const } : {})} {...props} />;
}

export { EmptyState, ErrorState, type StateProps };
