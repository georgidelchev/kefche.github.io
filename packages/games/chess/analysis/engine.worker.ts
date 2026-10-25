// Stockfish for the analysis view: Stockfish 19, lite and single-threaded
// (GPL-3.0, see vendor/stockfish/README.md), in a worker of its own started
// from this one, as for the bots. It evaluates one position at a time: a new
// position stops the search under way. Each depth's score and best line go
// back as the engine finds them, so the view fills in quickly and sharpens.
import type { EngineReply, EngineRequest } from "./engine-protocol";

const ENGINE = new URL("../vendor/stockfish/stockfish-19-lite-single.js", import.meta.url).href;
const WASM = new URL("../vendor/stockfish/stockfish-19-lite-single.wasm", import.meta.url).href;

/** Deep enough to be a fair judge, quick enough on a phone (a few seconds). */
const DEPTH = 18;

const stockfish = new Worker(`${ENGINE}#${encodeURIComponent(WASM)}`);
let ready = false;
/** The position being searched, and the one asked for since. */
let current: EngineRequest | null = null;
let next: EngineRequest | null = null;

const reply = (message: EngineReply) => {
  self.postMessage(message);
};

function run() {
  if (!ready || current || !next) return;
  current = next;
  next = null;
  stockfish.postMessage(`position fen ${current.fen}`);
  stockfish.postMessage(`go depth ${String(DEPTH)}`);
}

/** "info depth 12 … score cp 35 … pv e2e4 e7e5 …": the depth, score and line, or null. */
function parseInfo(
  line: string,
): Omit<Extract<EngineReply, { kind: "info" }>, "id" | "kind"> | null {
  const words = line.split(" ");
  const at = (word: string) => words.indexOf(word);
  const score = at("score");
  const pv = at("pv");
  const kind = words[score + 1];
  // A bound is a search window's edge, not a score.
  if (
    score < 0 ||
    pv < 0 ||
    words[score + 3] === "lowerbound" ||
    words[score + 3] === "upperbound"
  ) {
    return null;
  }
  const value = Number(words[score + 2]);
  const depth = Number(words[at("depth") + 1]);
  if (!Number.isFinite(value) || !Number.isFinite(depth)) return null;
  if (kind !== "cp" && kind !== "mate") return null;
  return {
    depth,
    score: kind === "cp" ? { cp: value } : { mate: value },
    pv: words.slice(pv + 1).filter(Boolean),
  };
}

// Besides UCI text, the engine posts its download progress as objects.
stockfish.onmessage = (event: MessageEvent<unknown>) => {
  if (typeof event.data !== "string") return;
  const line = event.data;
  if (line === "uciok") {
    stockfish.postMessage("isready");
  } else if (line === "readyok") {
    ready = true;
    reply({ kind: "ready" });
    run();
  } else if (line.startsWith("info ") && current && !next) {
    const info = parseInfo(line);
    if (info) reply({ kind: "info", id: current.id, ...info });
  } else if (line.startsWith("bestmove")) {
    if (current && !next) reply({ kind: "done", id: current.id });
    current = null;
    run();
  }
};
stockfish.postMessage("uci");

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  next = event.data;
  // The search under way ends with a bestmove, which starts the next one.
  if (current) stockfish.postMessage("stop");
  else run();
};
