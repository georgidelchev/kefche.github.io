import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

import type * as React from "react";

// Adapted from shadcn/ui (new-york-v4): sides are logical (`start`/`end`
// mirror in RTL, including the slide animation), safe-area padding, translated
// close label.

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

const SIDE_CLASSES = {
  start:
    "inset-y-0 start-0 h-full w-3/4 border-e ps-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start sm:max-w-sm",
  end: "inset-y-0 end-0 h-full w-3/4 border-s pe-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end sm:max-w-sm",
  top: "inset-x-0 top-0 max-h-[85dvh] rounded-b-2xl border-b pt-[env(safe-area-inset-top)] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
} as const;

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof SIDE_CLASSES;
  /** Accessible label of the corner close button; omit it to render no close button. */
  closeLabel?: string;
};

function SheetContent({
  className,
  children,
  side = "end",
  closeLabel,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-surface text-text shadow-xl transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {closeLabel !== undefined && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute end-2 top-[calc(0.5rem+env(safe-area-inset-top))] inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            <XIcon aria-hidden="true" className="size-5" />
            <span className="sr-only">{closeLabel}</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-header" className={cn("grid gap-1.5 p-4 pe-14", className)} {...props} />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-footer" className={cn("mt-auto grid gap-2 p-4", className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
