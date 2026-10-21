import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { initialsFor, paletteIndexFor } from "../lib/avatar";
import { cn } from "../lib/cn";

// Adapted from shadcn/ui (new-york-v4). Default avatar = initials on a
// color derived from the user id (SPEC §7.2), using the contrast-checked
// player palette. The image (if any) replaces it once loaded.

const PALETTE = [
  "bg-player-1 text-player-1-ink",
  "bg-player-2 text-player-2-ink",
  "bg-player-3 text-player-3-ink",
  "bg-player-4 text-player-4-ink",
  "bg-player-5 text-player-5-ink",
  "bg-player-6 text-player-6-ink",
  "bg-player-7 text-player-7-ink",
  "bg-player-8 text-player-8-ink",
] as const;

const avatarVariants = cva("relative flex shrink-0 overflow-hidden rounded-full select-none", {
  variants: {
    size: {
      sm: "size-8 text-xs",
      md: "size-11 text-base",
      lg: "size-16 text-xl",
      xl: "size-24 text-3xl",
    },
  },
  defaultVariants: { size: "md" },
});

type UserAvatarProps = VariantProps<typeof avatarVariants> & {
  /** Nickname; used for the initials and as the accessible name. */
  name: string;
  /** Stable user id; picks the fallback color. */
  id: string;
  src?: string;
  className?: string;
};

function UserAvatar({ name, id, src, size, className }: UserAvatarProps) {
  const palette = PALETTE[paletteIndexFor(id) - 1];
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      role="img"
      aria-label={name}
      className={cn(avatarVariants({ size }), className)}
    >
      {src !== undefined && (
        <AvatarPrimitive.Image src={src} alt="" className="aspect-square size-full object-cover" />
      )}
      <AvatarPrimitive.Fallback
        aria-hidden="true"
        className={cn("flex size-full items-center justify-center font-bold", palette)}
      >
        {initialsFor(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { UserAvatar, type UserAvatarProps };
