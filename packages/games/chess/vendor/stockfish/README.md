# Stockfish (vendored)

The chess bots and the analysis view run [Stockfish](https://github.com/official-stockfish/Stockfish) 19 in the browser, as built by [Stockfish.js](https://github.com/nmrugg/stockfish.js) (Nathan Rugg and Chess.com).

- **Files:** `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`, the "lite, single-threaded" flavour: a smaller network, no threads, and no cross-origin isolation headers needed.
- **Source:** the npm package `stockfish@19.0.1` (`bin/`), unchanged. It's vendored rather than installed because the package carries two 99 MB builds kefche never uses.
- **SHA-256:**
  - `stockfish-19-lite-single.js`: `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a`
  - `stockfish-19-lite-single.wasm`: `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de`
- **Licence:** GPL-3.0 (`COPYING.txt`). The corresponding source is at https://github.com/nmrugg/stockfish.js (tag `v19.0.1`) and https://github.com/official-stockfish/Stockfish. The engine runs as a separate program in a Web Worker and talks UCI over messages, so kefche's own code keeps its licence.
- **Updating:** download the new `stockfish` package, copy the two files from its `bin/`, rename the references in `renderer/stockfish.worker.ts`, and update the version, hashes and credits here and in `../../CREDITS.md`.
