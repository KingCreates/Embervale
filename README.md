# Emberfall Vale

An original, fully AI-built top-down action RPG that runs in any browser (phone-friendly, installable as a PWA, works offline). No engine, no dependencies, no copyrighted assets: all code, art (drawn procedurally), music and sound are generated in code.

## Play
Open `index.html` through any static server (or GitHub Pages), e.g. `python3 -m http.server` and visit `http://localhost:8000`. On iPhone: Safari → Share → Add to Home Screen.

Controls: on-screen pad + **A** (talk / open / attack the tile you face), **B** (cast selected spell), **⟳** (change spell), **☰** (bag, gear, spells, quests, stats, save, sound). Keyboard: arrows/WASD, Space (A), K (B), L (⟳), M (menu).

## Content
- 5 zones: Hearthmere village, Whisper Woods, Ashen Caves, Frostmire, Emberfall Keep.
- 6 chained quests, 2 bosses (Hollow King, Cinder Tyrant) with summon phases, 12 enemy types including ranged casters.
- Levels 1–25, 4 spells (Spark, Mend, Whirl, Nova), weapons, armor, charms, consumables, chests, shops, inn.
- Autosave + manual save (localStorage), death penalty, dynamic lighting and weather, procedural music/SFX.

## Layout
- `web/data.js` – items, enemies, quests, NPCs, zone definitions.
- `web/game.js` – engine: map generation, AI, combat, UI, saving, audio.
