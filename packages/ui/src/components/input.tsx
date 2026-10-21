import { cn } from "../lib/cn";

import type * as React from "react";

// Adapted from shadcn/ui (new-york-v4). 16px text avoids iOS zoom-on-focus;
// `aria-invalid` shows the error state (pair it with a visible message).
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text transition-colors outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger motion-reduce:transition-none",
        "file:me-3 file:border-0 file:bg-transparent file:font-semibold file:text-text",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
