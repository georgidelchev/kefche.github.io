// Memory Match's 15 symbols, drawn for kefche: each a different shape in a
// different colour, so a pair never relies on colour alone. 24 × 24 boxes.
import type { ReactNode } from "react";

/** Names are "ui" keys (symbol0 … symbol14) for screen readers. */
export const SYMBOLS: readonly { colour: string; draw: ReactNode }[] = [
  // Star
  {
    colour: "#c77700",
    draw: (
      <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" />
    ),
  },
  // Moon
  { colour: "#3b4cc0", draw: <path d="M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3z" /> },
  // Sun
  {
    colour: "#d14a00",
    draw: (
      <>
        <circle cx="12" cy="12" r="4.5" />
        <path
          d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          stroke="currentColor"
        />
      </>
    ),
  },
  // Heart
  {
    colour: "#c2185b",
    draw: (
      <path d="M12 21s-8.5-5.4-8.5-11.2A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.7C20.5 15.6 12 21 12 21z" />
    ),
  },
  // Leaf
  {
    colour: "#2e7d32",
    draw: (
      <>
        <path d="M4 20C4 9.5 10 4 21 3c-.5 11-6.5 17-17 17z" />
        <path d="M4 20 14 10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  // Drop
  {
    colour: "#0277bd",
    draw: <path d="M12 2s7.5 8.2 7.5 13.2a7.5 7.5 0 0 1-15 0C4.5 10.2 12 2 12 2z" />,
  },
  // Bolt
  { colour: "#9e7b00", draw: <polygon points="13.5,1.5 3.5,14 11,14 9.5,22.5 20.5,9 13,9" /> },
  // Flower
  {
    colour: "#8e24aa",
    draw: (
      <>
        <circle cx="12" cy="6" r="4" />
        <circle cx="18" cy="12" r="4" />
        <circle cx="12" cy="18" r="4" />
        <circle cx="6" cy="12" r="4" />
        <circle cx="12" cy="12" r="3" fill="#ffd54f" />
      </>
    ),
  },
  // Fish
  {
    colour: "#00838f",
    draw: (
      <>
        <path d="M1.5 12c3.5-5.5 10-6.5 15-2.8L22 5.5v13l-5.5-3.7C11.5 18.5 5 17.5 1.5 12z" />
        <circle cx="7" cy="11" r="1.3" fill="#fff" />
      </>
    ),
  },
  // Bell
  {
    colour: "#b45309",
    draw: (
      <>
        <path d="M5.5 17v-6a6.5 6.5 0 0 1 13 0v6l2 2h-17z" />
        <circle cx="12" cy="21.5" r="2" />
      </>
    ),
  },
  // Key
  {
    colour: "#5d4037",
    draw: (
      <>
        <circle cx="7" cy="12" r="5" />
        <circle cx="7" cy="12" r="2" fill="#fff" />
        <path d="M11 10.5h11v3h-2v3h-3v-3h-6z" />
      </>
    ),
  },
  // Crown
  { colour: "#b8860b", draw: <path d="M2.5 19 3.5 6.5l5 5.5L12 4l3.5 8 5-5.5 1 12.5z" /> },
  // Anchor
  {
    colour: "#1a237e",
    draw: (
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="4.5" r="2.5" />
        <path d="M12 7v14M7 11h10M4 14a8 7 0 0 0 16 0" />
      </g>
    ),
  },
  // Cloud
  {
    colour: "#546e7a",
    draw: <path d="M7 19a5 5 0 1 1 .9-9.9A6.5 6.5 0 0 1 20 10.5a4.3 4.3 0 0 1-1.5 8.5z" />,
  },
  // Mushroom
  {
    colour: "#d32f2f",
    draw: (
      <>
        <path d="M2.5 13a9.5 9 0 0 1 19 0z" />
        <rect x="9" y="13" width="6" height="8" rx="2" fill="#a1887f" />
        <circle cx="8" cy="9" r="1.5" fill="#fff" />
        <circle cx="15" cy="8" r="1.8" fill="#fff" />
      </>
    ),
  },
];
