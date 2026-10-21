import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";

import { cn } from "../lib/cn";

// Built on the Radix Toast primitive (shadcn/ui v4 moved to Sonner, which
// also needs next-themes; Radix keeps the stack consistent and dependency-free).
// Radix announces toasts to screen readers and supports swipe and F8.

export type ToastVariant = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds; defaults to 5000. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  open: boolean;
}

// Minimal external store shared by `toast()` and every <Toaster />.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const MAX_VISIBLE = 3;

/** Shows a toast; returns its id. All text must already be translated. */
export function toast(options: ToastOptions): number {
  const id = nextId++;
  items = [...items, { ...options, id, open: true }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function setOpen(id: number, open: boolean) {
  items = items.map((t) => (t.id === id ? { ...t, open } : t));
  emit();
  // Drop it after the exit animation.
  if (!open) {
    setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 300);
  }
}

const ICONS: Record<ToastVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const ACCENT: Record<ToastVariant, string> = {
  info: "border-s-info [&_[data-icon]]:text-info",
  success: "border-s-success [&_[data-icon]]:text-success",
  warning: "border-s-warning [&_[data-icon]]:text-warning",
  danger: "border-s-danger [&_[data-icon]]:text-danger",
};

export interface ToasterProps {
  /** Landmark label of the notification region, e.g. "Notifications". */
  label: string;
  closeLabel: string;
  dir: "ltr" | "rtl";
}

/** Render once per page (as a client island). */
export function Toaster({ label, closeLabel, dir }: ToasterProps) {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
  return (
    <ToastPrimitive.Provider label={label} swipeDirection={dir === "rtl" ? "left" : "right"}>
      {current.map(({ id, open, title, description, variant = "info", duration = 5000 }) => {
        const Icon = ICONS[variant];
        return (
          <ToastPrimitive.Root
            key={id}
            open={open}
            duration={duration}
            onOpenChange={(next) => {
              setOpen(id, next);
            }}
            className={cn(
              "flex items-start gap-3 rounded-2xl border border-s-4 border-border bg-surface p-4 text-text shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
              ACCENT[variant],
            )}
          >
            <Icon data-icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="grid flex-1 gap-1">
              <ToastPrimitive.Title className="font-semibold">{title}</ToastPrimitive.Title>
              {description !== undefined && (
                <ToastPrimitive.Description className="text-sm text-muted">
                  {description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-focus">
              <XIcon aria-hidden="true" className="size-5" />
              <span className="sr-only">{closeLabel}</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed end-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none md:bottom-0" />
    </ToastPrimitive.Provider>
  );
}
