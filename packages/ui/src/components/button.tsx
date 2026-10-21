import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../lib/cn";

import type * as React from "react";

// Adapted from shadcn/ui (new-york-v4): kefche tokens, 44px minimum touch
// targets (SPEC §6.5), outline focus ring.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:outline-danger motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:brightness-95 active:brightness-90",
        secondary: "bg-brand-2 text-on-brand-2 hover:brightness-95 active:brightness-90",
        outline: "border border-border-strong bg-surface text-text hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-danger text-on-danger hover:brightness-95 active:brightness-90",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-11 px-4 text-base",
        lg: "min-h-12 px-6 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. an `<a>`) with button styling. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
