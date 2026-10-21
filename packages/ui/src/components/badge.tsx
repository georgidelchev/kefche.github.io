import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

import type * as React from "react";

// Adapted from shadcn/ui (new-york-v4). `new` and `hot` are the pixel-style
// portal badges (SPEC §6.1): stepped corners and a hard offset shadow. The
// label is translated text, so no pixel font (it would only cover Latin).
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 text-xs font-semibold whitespace-nowrap [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-text",
        brand: "rounded-full bg-brand px-2.5 py-0.5 text-on-brand",
        accent: "rounded-full bg-accent px-2.5 py-0.5 text-on-accent",
        danger: "rounded-full bg-danger px-2.5 py-0.5 text-on-danger",
        new: "pixel-badge bg-accent px-2 py-0.5 tracking-wider text-on-accent uppercase",
        hot: "pixel-badge bg-brand px-2 py-0.5 tracking-wider text-on-brand uppercase",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants, type BadgeProps };
