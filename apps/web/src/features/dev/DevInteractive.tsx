// Dev-only gallery island (pages/[locale]/dev/ui.astro); never built for
// production. Sample copy is English fixture text; accessible labels come
// from real translations via props.
import { Bell, Gamepad2, Trophy } from "lucide-react";

import { Button } from "@kefche/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@kefche/ui/components/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@kefche/ui/components/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kefche/ui/components/tabs";
import { toast, Toaster, type ToastVariant } from "@kefche/ui/components/toast";

interface Props {
  dir: "ltr" | "rtl";
  closeLabel: string;
  notificationsLabel: string;
}

const TOASTS: { variant: ToastVariant; title: string; description: string }[] = [
  {
    variant: "info",
    title: "Invite sent",
    description: "Mila will see it next time she opens kefche.",
  },
  { variant: "success", title: "Achievement unlocked", description: "First win in Four in a Row." },
  {
    variant: "warning",
    title: "Reconnecting…",
    description: "Your opponent's connection dropped.",
  },
  {
    variant: "danger",
    title: "Couldn't join the room",
    description: "The room is full. Try another one.",
  },
];

export function DevInteractive({ dir, closeLabel, notificationsLabel }: Props) {
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent closeLabel={closeLabel}>
            <DialogHeader>
              <DialogTitle>Leave the match?</DialogTitle>
              <DialogDescription>
                Your seat stays reserved. You can rejoin from the lobby while the match is running.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Stay</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger">Leave</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {(["end", "start", "bottom"] as const).map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet: {side}</Button>
            </SheetTrigger>
            <SheetContent side={side} closeLabel={closeLabel} dir={dir}>
              <SheetHeader>
                <SheetTitle>Lobby chat</SheetTitle>
                <SheetDescription>
                  Slides in from the {side} edge (mirrored in RTL).
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        ))}
      </div>

      <Tabs defaultValue="solo" dir={dir}>
        <TabsList>
          <TabsTrigger value="solo">
            <Gamepad2 aria-hidden="true" /> Solo
          </TabsTrigger>
          <TabsTrigger value="friends">
            <Bell aria-hidden="true" /> With friends
          </TabsTrigger>
          <TabsTrigger value="ranked">
            <Trophy aria-hidden="true" /> Ranked
          </TabsTrigger>
        </TabsList>
        <TabsContent value="solo" className="p-2 text-muted">
          Play against bots at easy, medium or hard.
        </TabsContent>
        <TabsContent value="friends" className="p-2 text-muted">
          Share a link or a room code.
        </TabsContent>
        <TabsContent value="ranked" className="p-2 text-muted">
          Matched by rating. Arrow keys move between tabs.
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        {TOASTS.map((t) => (
          <Button
            key={t.variant}
            variant="ghost"
            onClick={() => {
              toast(t);
            }}
          >
            Toast: {t.variant}
          </Button>
        ))}
      </div>
      <Toaster label={notificationsLabel} closeLabel={closeLabel} dir={dir} />
    </div>
  );
}
