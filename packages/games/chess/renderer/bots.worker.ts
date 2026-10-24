// Chess bots (SPEC §9.5): Stockfish 19, lite and single-threaded (GPL-3.0,
// see vendor/stockfish/README.md), in a worker of its own started from this
// one. This worker answers the turn runtime's bot requests: each difficulty
// is a Stockfish skill level and a search limit, and the answer is the move
// Stockfish plays. Stockfish starts loading as soon as this worker does (the
// runtime starts it with the match) and stays warm for the rest of it.
import type { BotDifficulty } from "@kefche/game-sdk";
import type { BotReply, BotRequest } from "@kefche/game-sdk/browser";

import type { State } from "../engine";

// Emitted as files next to the bundle. The engine finds its .wasm through
// the URL's hash, so the hashed file names don't matter.
const ENGINE = new URL("../vendor/stockfish/stockfish-19-lite-single.js", import.meta.url).href;
const WASM = new URL("../vendor/stockfish/stockfish-19-lite-single.wasm", import.meta.url).href;

/** Each difficulty is a Stockfish Skill Level; players can also pick one (0–20). */
const LEVELS: Readonly<Record<BotDifficulty, number>> = { easy: 0, medium: 6, hard: 15 };

/**
 * Skill Level makes Stockfish choose weaker moves on purpose; below 15 a
 * depth limit keeps it from finding deep tactics anyway.
 */
const search = (level: number, budgetMs: number) =>
  level < 15
    ? `go depth ${String(level + 2)} movetime ${String(budgetMs)}`
    : `go movetime ${String(budgetMs)}`;
/** Kept back from the bot's budget for messages and the runtime's own work. */
const MARGIN_MS = 100;

let stockfish: Worker | null = null;
let listener: ((line: string) => void) | null = null;
let ready: Promise<void> | null = null;

const send = (command: string) => {
  stockfish?.postMessage(command);
};

/** Sends `command` and resolves with the first line of output that `done` accepts. */
function ask(command: string, done: (line: string) => boolean): Promise<string> {
  return new Promise((resolve) => {
    listener = (line) => {
      if (!done(line)) return;
      listener = null;
      resolve(line);
    };
    send(command);
  });
}

function start(): Promise<void> {
  ready ??= (async () => {
    stockfish = new Worker(`${ENGINE}#${encodeURIComponent(WASM)}`);
    // Besides UCI text, the engine posts its download progress as objects.
    stockfish.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === "string") listener?.(event.data);
    };
    await ask("uci", (line) => line === "uciok");
    send("ucinewgame");
    await ask("isready", (line) => line === "readyok");
  })();
  return ready;
}

void start();

self.onmessage = async (event: MessageEvent<BotRequest>) => {
  const { id, state, difficulty, level: picked, budgetMs } = event.data;
  let reply: BotReply;
  try {
    await start();
    const level = Math.min(20, Math.max(0, Math.round(picked ?? LEVELS[difficulty])));
    // The state comes from this game's own session, so it has the game's shape.
    const { moves } = state as State;
    send(`setoption name Skill Level value ${String(level)}`);
    send(`position startpos${moves.length > 0 ? ` moves ${moves.join(" ")}` : ""}`);
    const line = await ask(search(level, Math.max(50, budgetMs - MARGIN_MS)), (l) =>
      l.startsWith("bestmove"),
    );
    const uci = line.split(" ")[1];
    if (!uci || uci === "(none)") throw new Error("Stockfish found no move");
    reply = { id, ok: true, action: { type: "move", uci } };
  } catch (e) {
    reply = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  self.postMessage(reply);
};
