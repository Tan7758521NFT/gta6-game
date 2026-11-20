// SOLMARINA's hand-in program (Node 22, standard library only).
//
// What it does: take this repository's game/ (the playable static game)
// and screenshots/ (four real renders of it) and lay them out under the
// output directory the grader hands it — /output on the platform, or
// $MAKEFUN_OUTPUT_DIR when run by hand — then write /output/dossier.json
// with the kit's vendored library, so the scorer can check the entry and
// the judge can read it. Run it locally like this:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// It runs twice in grading and must write the same bytes both times:
// it only copies files and writes the dossier the library computes from
// them, so it does. The game itself needs no build step; this file is
// only the envelope it is handed in.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the gate's own (reference/gate.json): the text cap shapes
// the dossier's bytes, the rest refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files in
// game/ or 48 MiB of game files, or a game path over 1000 bytes.
const dossierText = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierText);
