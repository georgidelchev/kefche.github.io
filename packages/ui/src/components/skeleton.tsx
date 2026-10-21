import { cn } from "../lib/cn";

import type * as React from "react";

// Adapted from shadcn/ui (new-york-v4). Decorative only: announce loading with
// text (e.g. an `aria-busy` region or visually hidden status) next to it.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
