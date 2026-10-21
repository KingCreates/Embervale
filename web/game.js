'use strict';
// ===== Emberfall Vale engine (original code) =====
const TS = 16, VW = 15, VH = 15;
const cv = document.getElementById('c'), g = cv.getContext('2d');
g.imageSmoothingEnabled = false;
const SAVE_KEY = 'emberfall-vale-save-v1';
const FLOOR = 0, SOLID = 1, PATH = 2, WATER = 3, ROOF = 4, WALL = 5, DOOR = 6;

let S = null;        // persistent save state
let M = null;        // current map runtime
let mode = 'title';  // title | play | panel
const P = { x: 0, y: 0, px: 0, py: 0, dir: [0, 1], mcd: 0, acd: 0, inv: 0, flash: 0, walk: 0, swing: 0 };
const held = { up: false, down: false, left: false, right: false };
let fx = [], shake = 0, toasts = [], clock = 0, portalLock = 0;

// ---------- utils ----------
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;

// ---------- stats ----------
const nextXp = lv => 30 * lv + 12 * lv * lv;
const eqv = (slot, k) => { const id = S.eq[slot]; return id && ITEMS[id][k] || 0; };
const maxHp = () => 40 + S.lv * 10 + eqv('charm', 'hp');
const maxMp = () => 10 + S.lv * 4 + eqv('charm', 'mp');
const atk = () => 3 + S.lv * 2 + eqv('weapon', 'atk');
const def = () => Math.floor(S.lv / 2) + eqv('armor', 'def') + eqv('charm', 'def');
const luck = () => eqv('charm', 'luck');
function newState() {
  const s = { lv: 1, xp: 0, gold: 30, inv: { potion: 3, sword0: 1, armor0: 1 }, eq: { weapon: 'sword0', armor: 'armor0', charm: null },
    q: {}, flags: {}, opened: {}, picked: {}, kills: 0, skill: 'spark', map: 'village', x: 5, y: 8, t: 0 };
  s.hp = 40 + 10; s.mp = 14; return s;
}

// ---------- audio ----------
let AC = null, muted = false, musicTimer = null, mstep = 0;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function beep(f, d, type = 'square', v = 0.05, slide = 0) {
  if (muted || !AC) return; const o = AC.createOscillator(), a = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  a.gain.setValueAtTime(v, t); a.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(a); a.connect(AC.destination); o.start(t); o.stop(t + d);
}
const SFX = { hit: () => beep(180, 0.1, 'square', 0.06, -80), hurt: () => beep(120, 0.18, 'sawtooth', 0.07, -60), spell: () => beep(500, 0.2, 'triangle', 0.07, 500),
  pick: () => { beep(660, 0.08); setTimeout(() => beep(880, 0.1), 70); }, lvl: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.07), i * 110)),
  heal: () => { beep(440, 0.15, 'sine', 0.07); setTimeout(() => beep(660, 0.2, 'sine', 0.07), 120); }, die: () => beep(200, 0.6, 'sawtooth', 0.08, -170), ui: () => beep(500, 0.04, 'square', 0.03), boom: () => beep(90, 0.4, 'sawtooth', 0.09, -50) };
const sfx = n => { if (AC && SFX[n]) SFX[n](); };
const SCALES = { village: [0, 4, 7, 9, 12, 9, 7, 4], woods: [0, 3, 7, 10, 7, 3, 0, 5], cave: [0, 3, 5, 3, 0, -2, 0, 3], frost: [0, 7, 12, 14, 12, 7, 5, 2], keep: [0, 1, 5, 6, 5, 1, 0, -2] };
function musicTick() {
  if (muted || !AC || mode === 'title') return; const sc = SCALES[S && S.map] || SCALES.village; const base = { village: 262, woods: 220, cave: 147, frost: 196, keep: 110 }[S.map] || 220;
  const n = sc[mstep % sc.length]; mstep++; beep(base * Math.pow(2, n / 12), 0.35, 'triangle', 0.018);
  if (mstep % 8 === 0) beep(base / 2, 0.9, 'sine', 0.025);
}

// ---------- map building ----------
const MAPS = {};
function mkMap(w, h, theme, name) { const tiles = []; for (let y = 0; y < h; y++) tiles.push(new Array(w).fill(FLOOR)); return { w, h, theme, name, tiles, portals: [], npcs: [], signs: [], spawns: [], chests: [], herbs: [], boss: null, cache: null }; }
function buildVillage() {
  const m = mkMap(24, VILLAGE.length, 'woods', 'Hearthmere'), map = { '#': SOLID, '.': FLOOR, ',': PATH, '~': WATER, R: ROOF, W: WALL, D: DOOR, T: SOLID };
  VILLAGE.forEach((r, y) => { for (let x = 0; x < 24; x++) m.tiles[y][x] = map[r[x]] ?? FLOOR; });
  m.signs = VILLAGE_SIGNS;
  m.npcs = [['pell', 4, 5], ['odo', 11, 5], ['brenn', 18, 5], ['mara', 8, 7], ['tessa', 14, 8], ['ivo', 21, 6]];
  m.portals = [{ x: 23, y: 7, to: 'woods', tx: 3, ty: 16, req: () => S.q.q1 && S.q.q1.s >= 1, msg: 'Elder Mara should brief you before you leave. Talk to her first.' }];
  m.start = [5, 8]; return m;
}
function carve(m, x0, y0, x1, y1, tile) {
  let x = x0, y = y0;
  const set = (a, b) => { for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) { const xx = a + dx, yy = b + dy; if (xx > 0 && yy > 0 && xx < m.w - 1 && yy < m.h - 1) m.tiles[yy][xx] = tile; } };
  while (x !== x1) { set(x, y); x += Math.sign(x1 - x); }
  while (y !== y1) { set(x, y); y += Math.sign(y1 - y); }
  set(x, y);
}
function buildZone(id) {
  const z = ZONES[id], r = rng(z.seed), m = mkMap(z.w, z.h, z.theme, z.name), cy = z.h >> 1;
  let t = [];
  for (let y = 0; y < z.h; y++) { t[y] = []; for (let x = 0; x < z.w; x++) t[y][x] = (x === 0 || y === 0 || x === z.w - 1 || y === z.h - 1 || r() < z.density) ? SOLID : FLOOR; }
  for (let p = 0; p < z.passes; p++) {
    const n = t.map(row => row.slice());
    for (let y = 1; y < z.h - 1; y++) for (let x = 1; x < z.w - 1; x++) {
      let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && t[y + dy][x + dx] === SOLID) c++;
      n[y][x] = c >= 5 ? SOLID : FLOOR;
    }
    t = n;
  }
  m.tiles = t;
  const pts = [[2, cy]]; for (let i = 0; i < 3; i++) pts.push([rnd2(r, 6, z.w - 8), rnd2(r, 4, z.h - 5)]);
  if (z.arena) pts.push([z.arena.x, z.arena.y]);
  const hasExit = id !== 'keep'; if (hasExit) pts.push([z.w - 3, cy]);
  const path = z.theme === 'woods' ? PATH : FLOOR;
  for (let i = 0; i < pts.length - 1; i++) carve(m, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], path);
  if (z.arena) { const a = z.arena; for (let y = a.y - a.r; y <= a.y + a.r; y++) for (let x = a.x - a.r; x <= a.x + a.r; x++) m.tiles[y][x] = FLOOR; }
  // water/lava ponds for variety
  for (let i = 0; i < 4; i++) { const px = rnd2(r, 8, z.w - 10), py = rnd2(r, 3, z.h - 5);
    if (z.arena && Math.abs(px - z.arena.x) < z.arena.r + 4 && Math.abs(py - z.arena.y) < z.arena.r + 4) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (m.tiles[py + dy][px + dx] === SOLID) m.tiles[py + dy][px + dx] = WATER; }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx > 0 && y + dy > 0 && x + dx < z.w - 1 && y + dy < z.h - 1) m.tiles[y + dy][x + dx] = FLOOR; }
  // entry tile
  const back = { woods: ['village', 22, 7], caves: ['woods', z.w - 4 + 0, cy], frost: ['caves', 0, 0], keep: ['frost', 0, 0] }[id];
  const prev = { woods: 'village', caves: 'woods', frost: 'caves', keep: 'frost' }[id], next = { woods: 'caves', caves: 'frost', frost: 'keep' }[id];
  m.portals.push({ x: 1, y: cy, to: prev, tx: -1, ty: -1, back: true });
  m.tiles[cy][1] = FLOOR; m.tiles[cy][2] = FLOOR;
  if (hasExit) { m.portals.push({ x: z.w - 2, y: cy, to: next, tx: 3, ty: -1, fwd: true }); m.tiles[cy][z.w - 2] = FLOOR; m.tiles[cy][z.w - 3] = FLOOR; }
  m.cy = cy; m.start = [3, cy];
  // reachable floor tiles
  const seen = new Set(), q = [[3, cy]], free = []; seen.add(3 + cy * z.w);
  while (q.length) { const [x, y] = q.pop(); free.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ny * z.w;
      if (nx > 0 && ny > 0 && nx < z.w - 1 && ny < z.h - 1 && !seen.has(k) && m.tiles[ny][nx] !== SOLID && m.tiles[ny][nx] !== WATER) { seen.add(k); q.push([nx, ny]); } } }
  m.free = free; m.reach = seen;
  const used = new Set([cy * z.w + 1, cy * z.w + 2, cy * z.w + 3]);
  const pick = (minD, avoidArena) => {
    for (let k = 0; k < 400; k++) { const [x, y] = free[Math.floor(r() * free.length)]; if (used.has(x + y * z.w)) continue;
      if (Math.hypot(x - 3, y - cy) < minD) continue;
      if (avoidArena && z.arena && Math.hypot(x - z.arena.x, y - z.arena.y) < z.arena.r + 1.5) continue;
      if (x >= z.w - 3) continue; used.add(x + y * z.w); return [x, y]; }
    return null; };
  for (const [e, n] of z.spawns) for (let i = 0; i < n; i++) { const p = pick(10, true); if (p) m.spawns.push({ e, x: p[0], y: p[1] }); }
  z.chests.forEach((c, i) => { const p = pick(8, true); if (p) m.chests.push({ id: id + '_c' + i, x: p[0], y: p[1], loot: c }); });
  for (let i = 0; i < (z.herbs || 0); i++) { const p = pick(6, true); if (p) m.herbs.push({ id: id + '_h' + i, x: p[0], y: p[1] }); }
  if (z.boss) m.boss = { e: z.boss[0], x: z.boss[1], y: z.boss[2] };
  return m;
}
const rnd2 = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function getMap(id) {
  if (!MAPS[id]) { MAPS[id] = id === 'village' ? buildVillage() : buildZone(id); MAPS[id].id = id; MAPS[id].cache = renderCache(MAPS[id]); }
  return MAPS[id];
}
// resolve portal destinations lazily
function portalDest(p) {
  const dm = getMap(p.to);
  if (p.back) { if (p.to === 'village') return [22, 7]; return [dm.w - 4, dm.cy]; }
  return [3, dm.cy];
}
const ZONE_PORTAL_REQ = {
  woods: () => ({ ok: S.q.q1 && S.q.q1.s === 3, msg: 'A rockfall blocks the cave mouth. Finish Elder Mara\'s wolf hunt first.' }),
  caves: () => ({ ok: !!S.flags.hollowKing, msg: 'The way east is sealed by a spectral ward. The Hollow King must fall.' }),
  frost: () => ({ ok: S.q.q5 && S.q.q5.s === 3, msg: 'A wall of ice blocks the Keep. Rekindle the beacon first.' }),
};
function portalOk(m, p) { if (p.req) return p.req() ? null : p.msg; if (p.fwd) { const r = ZONE_PORTAL_REQ[m.id](); return r.ok ? null : r.msg; } return null; }

// ---------- rendering of tiles (cached) ----------
const PAL = {
  woods: { floor: ['#3f7d3a', '#4a8f44', '#34702f'], solid: '#1f5a2a', solid2: '#2c7a38', water: '#2f6bb5', water2: '#4a8bd5', path: '#b69b6b' },
  cave: { floor: ['#3a3445', '#443d52', '#2f2a3a'], solid: '#2a2532', solid2: '#6b6378', water: '#27407a', water2: '#3a5aa0', path: '#3a3445' },
  frost: { floor: ['#e3edf5', '#c9dbe9', '#f4f9fd'], solid: '#2f5d52', solid2: '#e8f4f8', water: '#8fd0e8', water2: '#c4ecfa', path: '#e3edf5' },
  keep: { floor: ['#2b2128', '#352a31', '#241a20'], solid: '#4a3a44', solid2: '#8a4a3a', water: '#d8431c', water2: '#ffb43a', path: '#2b2128' },
};
function px(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function paintTile(c, th, t, tx, ty) {
  const p = PAL[th], X = tx * TS, Y = ty * TS, h = hash(tx, ty), f = p.floor;
  px(c, f[0], X, Y, TS, TS);
  for (let i = 0; i < 4; i++) { const hh = (h >>> (i * 5)) & 31; px(c, f[1 + (hh & 1)], X + (hh * 7 % 14), Y + ((hh * 11 + i * 3) % 14), 2, 2); }
  if (th === 'keep' && ((tx + ty) & 1)) px(c, f[1], X, Y, TS, TS);
  if (th === 'woods' && (h & 31) === 3) { px(c, '#f2e86a', X + 6, Y + 6, 2, 2); px(c, '#fff', X + 5, Y + 6, 1, 1); }
  if (t === PATH) { px(c, p.path, X, Y, TS, TS); px(c, '#a38a5c', X + (h & 7) + 2, Y + ((h >> 3) & 7) + 2, 3, 2); px(c, '#c8b080', X + ((h >> 6) & 7), Y + ((h >> 9) & 7) + 6, 2, 2); }
  else if (t === SOLID) {
    if (th === 'woods') { px(c, '#4a2f1a', X + 6, Y + 9, 4, 6); px(c, p.solid, X + 1, Y + 1, 14, 10); px(c, p.solid2, X + 3, Y + 1, 9, 7); px(c, '#3a9a46', X + 5 + (h & 3), Y + 2, 3, 2); }
    else if (th === 'cave') { px(c, p.solid, X, Y, TS, TS); px(c, p.solid2, X + 1, Y + 1, 13, 11); px(c, '#8a8198', X + 2, Y + 2, 6, 3); px(c, '#4a4458', X + 8, Y + 8, 6, 4); }
    else if (th === 'frost') { px(c, '#6a8f8a', X + 7, Y + 11, 2, 4); px(c, p.solid, X + 3, Y + 7, 10, 5); px(c, p.solid, X + 4, Y + 3, 8, 5); px(c, p.solid, X + 6, Y + 1, 4, 4); px(c, p.solid2, X + 4, Y + 5, 3, 2); px(c, p.solid2, X + 6, Y + 1, 3, 2); }
    else { px(c, '#1c141a', X, Y, TS, TS); px(c, p.solid, X + 2, Y + 1, 12, 14); px(c, '#6a4a54', X + 2, Y + 1, 12, 2); px(c, p.solid2, X + 6, Y + 6 + (h & 3), 3, 2); }
  } else if (t === WATER) {
    px(c, p.water, X, Y, TS, TS); px(c, p.water2, X + 2 + (h & 3), Y + 4, 5, 1); px(c, p.water2, X + 7, Y + 10 + ((h >> 3) & 1), 6, 1);
    if (th === 'woods' || th === 'cave') {} else if (th === 'keep') px(c, '#fff3b0', X + 4, Y + 7, 2, 2);
  } else if (t === ROOF) { px(c, '#9c3b32', X, Y, TS, TS); px(c, '#b84a3e', X, Y + 2, TS, 2); px(c, '#7a2a24', X, Y + 8, TS, 2); px(c, '#7a2a24', X, Y + 14, TS, 2); }
  else if (t === WALL) { px(c, '#caa77a', X, Y, TS, TS); px(c, '#b08c60', X, Y + 12, TS, 4); px(c, '#6a8fb0', X + 4, Y + 4, 8, 6); px(c, '#fff', X + 4, Y + 4, 8, 1); px(c, '#5a3b22', X + 7, Y + 4, 2, 6); }
  else if (t === DOOR) { px(c, '#caa77a', X, Y, TS, TS); px(c, '#5a3b22', X + 3, Y + 2, 10, 14); px(c, '#8a5a32', X + 4, Y + 3, 8, 13); px(c, '#e0c250', X + 10, Y + 9, 2, 2); }
}
function renderCache(m) {
  const c = document.createElement('canvas'); c.width = m.w * TS; c.height = m.h * TS; const x = c.getContext('2d');
  for (let y = 0; y < m.h; y++) for (let xx = 0; xx < m.w; xx++) paintTile(x, m.theme, m.tiles[y][xx], xx, y);
  x.font = 'bold 6px monospace'; x.fillStyle = '#fff'; x.textAlign = 'center';
  for (const [s, sx, sy] of m.signs) { px(x, '#3a2414', sx * TS, sy * TS + 6, 3 * TS, 9); x.fillStyle = '#ffe9a0'; x.fillText(s, sx * TS + 24, sy * TS + 13); }
  // portal markers
  for (const p of m.portals) { px(x, p.fwd || p.to !== 'village' && !p.back ? '#ffd45a' : '#8ad4ff', p.x * TS + 4, p.y * TS + 2, 8, 12); x.globalAlpha = 0.5; px(x, '#fff', p.x * TS + 6, p.y * TS + 4, 4, 8); x.globalAlpha = 1; }
  return c;
}

// ---------- enter map ----------
function enterMap(id, x, y) {
  M = getMap(id); S.map = id; S.x = x; S.y = y;
  P.x = P.px = x; P.py = y; P.y = y; P.mcd = 0;
  M.ents = []; M.proj = []; fx = [];
  for (const s of M.spawns) addEnemy(s.e, s.x, s.y);
  if (M.boss && !S.flags[ENEMIES[M.boss.e].flag]) addEnemy(M.boss.e, M.boss.x, M.boss.y);
  M.npcList = M.npcs.map(([n, nx, ny]) => ({ id: n, x: nx, y: ny }));
  M.chestList = M.chests.filter(c => true).map(c => ({ ...c }));
  M.herbList = M.herbs.filter(h => !S.picked[h.id]);
  portalLock = 600; toast(M.name);
  save();
}
function addEnemy(e, x, y) { const d = ENEMIES[e]; M.ents.push({ e, d, x, y, px: x, py: y, hp: d.hp, mcd: rnd(0, 400), acd: 800, flash: 0, aggro: false, summoned: 0, dirx: 1, wander: 0 }); }

// ---------- game logic ----------
function solidAt(x, y) { if (x < 0 || y < 0 || x >= M.w || y >= M.h) return true; const t = M.tiles[y][x]; return t === SOLID || t === WATER || t === ROOF || t === WALL || t === DOOR; }
function occupied(x, y, self) {
  if (solidAt(x, y)) return true;
  if (M.ents.some(e => e !== self && e.x === x && e.y === y)) return true;
  if (M.npcList.some(n => n.x === x && n.y === y)) return true;
  if (M.chestList.some(c => c.x === x && c.y === y)) return true;
  return false;
}
function toast(t, ms = 2200) { toasts.push({ t, life: ms }); if (toasts.length > 3) toasts.shift(); }
function floatText(x, y, t, col = '#fff') { fx.push({ x, y, t, col, life: 800, vy: -0.02 }); }
function spark(x, y, col, n = 6) { for (let i = 0; i < n; i++) fx.push({ x, y, dx: (Math.random() - 0.5) * 0.01, dy: (Math.random() - 0.5) * 0.01, col, life: 400, p: true }); }

function giveItem(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; questEvents(); }
function addGold(n) { n = Math.round(n * (1 + 0.5 * luck())); S.gold += n; return n; }
function gainXp(n) {
  S.xp += n;
  while (S.lv < 25 && S.xp >= nextXp(S.lv)) {
    S.xp -= nextXp(S.lv); S.lv++; S.hp = maxHp(); S.mp = maxMp(); sfx('lvl');
    let extra = ''; for (const k in SKILLS) if (SKILLS[k].lv === S.lv) extra = ' Learned ' + SKILLS[k].name + '!';
    toast('Level ' + S.lv + '!' + extra, 3200); floatText(P.px, P.py - 0.6, 'LEVEL UP', '#ffe36a'); spark(P.px, P.py, '#ffe36a', 16);
  }
  if (S.lv >= 25) S.xp = 0;
}
function hurtPlayer(raw, srcX, srcY) {
  if (P.inv > 0 || mode !== 'play') return;
  const d = Math.max(1, Math.round(raw * (0.85 + Math.random() * 0.3) - def() * 0.6));
  S.hp -= d; P.inv = 350; P.flash = 200; shake = 6; sfx('hurt'); floatText(P.px, P.py - 0.4, '-' + d, '#ff6a6a');
  if (S.hp <= 0) die();
}
function die() {
  S.hp = 0; mode = 'panel'; sfx('die');
  const lost = Math.floor(S.gold / 2);
  showPanel('<h2>You have fallen...</h2><p>Hearthmere\'s healers carry you home. You lose ' + lost + ' gold.</p>', [{ label: 'Wake up', fn: () => { S.gold -= lost; S.hp = maxHp(); S.mp = maxMp(); closePanel(); enterMap('village', 5, 8); } }]);
}
function damageEnemy(e, dmg, crit) {
  const d = Math.max(1, Math.round(dmg)); e.hp -= d; e.flash = 150; e.aggro = true; floatText(e.px, e.py - 0.4, (crit ? '!' : '') + d, crit ? '#ffd45a' : '#fff'); spark(e.px, e.py, '#fff', 3); sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  M.ents.splice(M.ents.indexOf(e), 1); S.kills++; sfx(e.d.boss ? 'boom' : 'hit'); spark(e.px, e.py, e.d.color, 14);
  const gold = addGold(rnd(...e.d.gold)); gainXp(e.d.xp); if (gold) floatText(e.px, e.py - 0.8, '+' + gold + 'g', '#ffd45a');
  if (Math.random() < 0.14 && !e.d.boss) { giveItem('potion'); toast('Found a Potion'); } else if (Math.random() < 0.06 && !e.d.boss) { giveItem('ether'); toast('Found an Ether'); }
  if (e.d.flag) { S.flags[e.d.flag] = true; toast(e.d.name + ' is defeated!', 3500); }
  for (const id in QUESTS) { const q = QUESTS[id]; if (q.type !== 'kill' || q.target !== e.e) continue; if (!S.q[id] && questAvailable(q)) startQuest(id); const st = S.q[id]; if (st && st.s === 1) { st.p = (st.p || 0) + 1; checkQuest(id); } }
  if (e.e === 'cinderTyrant') setTimeout(victory, 1200);
  if (e.d.boss) { M.ents.filter(m => m.summoned).forEach(m => { m.hp = 0; }); M.ents = M.ents.filter(m => !m.summoned); }
}
function victory() {
  mode = 'panel';
  showPanel('<h2>The Vale is saved</h2><p>The Cinder Tyrant crumbles to ash. Dawn breaks over Emberfall Vale for the first time in a generation.</p><p>You received <b>Dawnbrand</b> and the gratitude of all Hearthmere.</p><p>Thank you for playing! You can keep exploring, hunting and levelling.</p>', [{ label: 'Keep playing', fn: closePanel }]);
}

// quests
function questAvailable(q) { return !q.req || (S.q[q.req] && S.q[q.req].s === 3); }
function questEvents() { for (const id in QUESTS) { const st = S.q[id]; if (st && st.s === 1 && QUESTS[id].type === 'collect') { st.p = Math.min(QUESTS[id].count, S.inv[QUESTS[id].target] || 0); checkQuest(id); } } }
function checkQuest(id) {
  const q = QUESTS[id], st = S.q[id];
  if (st.s === 1 && (st.p || 0) >= q.count) { st.s = 2; toast('Quest ready: ' + q.name, 3000); sfx('pick'); if (q.auto) turnIn(id); }
}
function startQuest(id) { S.q[id] = { s: 1, p: 0 }; toast('New quest: ' + QUESTS[id].name, 3000); sfx('pick'); questEvents(); checkQuest(id); }
function turnIn(id) {
  const q = QUESTS[id], r = q.reward; S.q[id].s = 3;
  if (q.type === 'collect') S.inv[q.target] = (S.inv[q.target] || 0) - q.count;
  gainXp(r.xp); if (r.gold) addGold(r.gold);
  for (const k in r.items) giveItem(k, r.items[k]);
  const names = Object.keys(r.items).map(k => ITEMS[k].name + (r.items[k] > 1 ? ' x' + r.items[k] : ''));
  toast('Quest complete! +' + r.xp + ' XP' + (r.gold ? ' +' + r.gold + 'g' : '') + ' ' + names.join(', '), 4000); sfx('lvl'); save();
}

// actions
function tryMove(dx, dy) {
  P.dir = [dx, dy];
  const nx = P.x + dx, ny = P.y + dy;
  if (!occupied(nx, ny, null)) { P.x = nx; P.y = ny; P.walk += 1; afterStep(); }
  P.mcd = 140;
}
function afterStep() {
  const h = M.herbList.find(h => h.x === P.x && h.y === P.y);
  if (h) { M.herbList.splice(M.herbList.indexOf(h), 1); S.picked[h.id] = 1; giveItem('moonherb'); toast('Picked a Moonherb'); sfx('pick'); spark(P.x, P.y, '#9ff', 8); }
  if (portalLock <= 0) { const p = M.portals.find(p => p.x === P.x && p.y === P.y); if (p) usePortal(p); }
}
function usePortal(p) {
  const why = portalOk(M, p);
  if (why) { toast(why, 3500); portalLock = 1500; P.x -= P.dir[0]; P.y -= P.dir[1]; return; }
  const [tx, ty] = portalDest(p); sfx('pick'); enterMap(p.to, tx, ty);
}
function swing() {
  if (P.acd > 0 || mode !== 'play') return; P.acd = 340; P.swing = 160;
  const tx = P.x + P.dir[0], ty = P.y + P.dir[1];
  const npc = M.npcList.find(n => n.x === tx && n.y === ty); if (npc) return talk(npc);
  const ch = M.chestList.find(c => c.x === tx && c.y === ty); if (ch) return openChest(ch);
  const e = M.ents.find(e => e.x === tx && e.y === ty);
  sfx('hit');
  if (e) { const crit = Math.random() < 0.1 + 0.1 * luck(); damageEnemy(e, (atk() * (0.9 + Math.random() * 0.4) - e.d.def * 0.5) * (crit ? 1.8 : 1), crit); }
}
function openChest(c) {
  if (S.opened[c.id]) { toast('Empty.'); return; }
  S.opened[c.id] = 1; sfx('pick'); const l = c.loot, got = [];
  if (l.gold) got.push(addGold(l.gold) + ' gold');
  for (const k in (l.items || {})) { giveItem(k, l.items[k]); got.push(ITEMS[k].name); }
  toast('Chest: ' + got.join(', '), 3200); spark(c.x, c.y, '#ffd45a', 12);
}
function useSkill() {
  if (mode !== 'play') return; const sk = SKILLS[S.skill];
  if (S.lv < sk.lv) { toast('Skill not learned.'); return; }
  if (S.mp < sk.mp) { toast('Not enough MP.'); return; }
  const [dx, dy] = P.dir;
  if (S.skill === 'spark') { S.mp -= sk.mp; sfx('spell'); M.proj.push({ x: P.x, y: P.y, vx: dx * 0.009, vy: dy * 0.009, dmg: 10 + S.lv * 2.5 + atk() * 0.4, mine: true, col: '#7fd8ff', life: 900 }); }
  else if (S.skill === 'mend') { if (S.hp >= maxHp()) { toast('HP is full.'); return; } S.mp -= sk.mp; const h = 30 + S.lv * 6; S.hp = Math.min(maxHp(), S.hp + h); sfx('heal'); floatText(P.px, P.py - 0.5, '+' + h, '#7fff9a'); spark(P.px, P.py, '#7fff9a', 10); }
  else if (S.skill === 'whirl') { S.mp -= sk.mp; sfx('spell'); P.swing = 300; spark(P.px, P.py, '#fff', 14); for (const e of M.ents.slice()) if (Math.abs(e.x - P.x) <= 1 && Math.abs(e.y - P.y) <= 1) damageEnemy(e, atk() * 1.6 - e.d.def * 0.5); }
  else if (S.skill === 'nova') { S.mp -= sk.mp; sfx('boom'); shake = 8; spark(P.px, P.py, '#ffb43a', 30); for (const e of M.ents.slice()) if (Math.hypot(e.x - P.x, e.y - P.y) <= 3.2) damageEnemy(e, atk() * 2.2 + 12 - e.d.def * 0.5); }
}
function cycleSkill() { const ks = Object.keys(SKILLS).filter(k => S.lv >= SKILLS[k].lv); S.skill = ks[(ks.indexOf(S.skill) + 1) % ks.length]; sfx('ui'); toast('Skill: ' + SKILLS[S.skill].name + ' (' + SKILLS[S.skill].mp + ' MP)', 1200); }

// ---------- update ----------
function stepToward(e, tx, ty) {
  const dx = tx - e.x, dy = ty - e.y; const order = Math.abs(dx) > Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
  for (const [mx, my] of order) if ((mx || my) && !occupied(e.x + mx, e.y + my, e) && !(e.x + mx === P.x && e.y + my === P.y)) { e.x += mx; e.y += my; return true; }
  return false;
}
function stepAway(e) { const dx = Math.sign(e.x - P.x), dy = Math.sign(e.y - P.y); for (const [mx, my] of Math.abs(e.x - P.x) > Math.abs(e.y - P.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]) if ((mx || my) && !occupied(e.x + mx, e.y + my, e) && !(e.x + mx === P.x && e.y + my === P.y)) { e.x += mx; e.y += my; return; } }
function updateEnemies(dt) {
  for (const e of M.ents) {
    e.flash = Math.max(0, e.flash - dt); e.mcd -= dt; e.acd -= dt;
    e.px += (e.x - e.px) * Math.min(1, dt / 90); e.py += (e.y - e.py) * Math.min(1, dt / 90);
    const dx = P.x - e.x, dy = P.y - e.y, md = Math.abs(dx) + Math.abs(dy), dist = Math.hypot(dx, dy), d = e.d;
    if (!e.aggro && dist <= d.aggro) e.aggro = true; else if (e.aggro && dist > d.aggro + 6 && !d.boss) e.aggro = false;
    if (d.boss && e.aggro) {
      const frac = e.hp / d.hp; const stages = d.flag === 'cinderTyrant' ? [0.66, 0.33] : [0.5];
      while (e.summoned < stages.length && frac <= stages[e.summoned]) { e.summoned++; toast(d.name + ' summons minions!', 2500); shake = 8; sfx('boom');
        for (let i = 0; i < 3; i++) { for (let k = 0; k < 20; k++) { const sx = e.x + rnd(-3, 3), sy = e.y + rnd(-3, 3); if (!occupied(sx, sy, null) && !(sx === P.x && sy === P.y)) { addEnemy(d.summon, sx, sy); M.ents[M.ents.length - 1].summoned = 99; M.ents[M.ents.length - 1].aggro = true; break; } } } }
    }
    if (e.aggro) {
      if (d.ranged && dist <= d.range && e.acd <= 0) { e.acd = d.rate; const l = Math.max(0.01, dist); M.proj.push({ x: e.x, y: e.y, vx: dx / l * 0.0055, vy: dy / l * 0.0055, dmg: d.atk * 0.8, mine: false, col: d.flag === 'cinderTyrant' || d.kind === 'imp' ? '#ff7a2a' : '#8fe8ff', life: 1800 }); sfx('spell'); }
      if (e.mcd <= 0) {
        e.mcd = d.spd * (0.9 + Math.random() * 0.3);
        if (d.erratic && Math.random() < 0.4) { const r = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd(0, 3)]; if (!occupied(e.x + r[0], e.y + r[1], e) && !(e.x + r[0] === P.x && e.y + r[1] === P.y)) { e.x += r[0]; e.y += r[1]; } }
        else if (d.keep && dist < d.keep) stepAway(e);
        else if (md > 1 && !(d.ranged && !d.boss && dist <= d.range && dist >= d.keep)) stepToward(e, P.x, P.y);
      }
      if (md === 1 && e.acd <= 0) { e.acd = d.rate; hurtPlayer(d.atk); }
    } else if (e.mcd <= 0) {
      e.mcd = 700 + Math.random() * 900; if (Math.random() < 0.5) { const r = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd(0, 3)]; if (!occupied(e.x + r[0], e.y + r[1], e) && !(e.x + r[0] === P.x && e.y + r[1] === P.y)) { e.x += r[0]; e.y += r[1]; } }
    }
  }
}
function updateProj(dt) {
  for (const p of M.proj.slice()) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    const tx = Math.round(p.x), ty = Math.round(p.y);
    if (p.life <= 0 || solidAt(tx, ty)) { M.proj.splice(M.proj.indexOf(p), 1); spark(p.x, p.y, p.col, 3); continue; }
    if (p.mine) { const e = M.ents.find(e => Math.hypot(e.px - p.x, e.py - p.y) < 0.65); if (e) { M.proj.splice(M.proj.indexOf(p), 1); damageEnemy(e, p.dmg - e.d.def * 0.3); spark(p.x, p.y, p.col, 6); } }
    else if (Math.hypot(P.px - p.x, P.py - p.y) < 0.55) { M.proj.splice(M.proj.indexOf(p), 1); hurtPlayer(p.dmg); }
  }
}
let last = 0, regen = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(50, now - last || 16); last = now; clock += dt;
  if (mode === 'play') update(dt);
  if (mode !== 'title') render(dt); else renderTitle();
  requestAnimationFrame(frame);
}
function update(dt) {
  S.t += dt; P.mcd -= dt; P.acd -= dt; P.inv -= dt; P.flash -= dt; P.swing -= dt; portalLock -= dt; shake = Math.max(0, shake - dt / 30);
  P.px += (P.x - P.px) * Math.min(1, dt / 80); P.py += (P.y - P.py) * Math.min(1, dt / 80);
  if (P.mcd <= 0) { const d = held.up ? [0, -1] : held.down ? [0, 1] : held.left ? [-1, 0] : held.right ? [1, 0] : null; if (d) tryMove(d[0], d[1]); }
  updateEnemies(dt); updateProj(dt);
  regen += dt; if (regen > 2500) { regen = 0; if (S.mp < maxMp()) S.mp++; if (S.hp < maxHp() && !M.ents.some(e => e.aggro)) S.hp = Math.min(maxHp(), S.hp + Math.ceil(maxHp() / 60)); }
  S.hp = Math.min(S.hp, maxHp()); S.mp = Math.min(S.mp, maxMp());
  for (const f of fx) { f.life -= dt; if (f.p) { f.x += f.dx * dt; f.y += f.dy * dt; } else f.y += f.vy * dt; } fx = fx.filter(f => f.life > 0);
  for (const t of toasts) t.life -= dt; toasts = toasts.filter(t => t.life > 0);
  saveT += dt; if (saveT > 20000) { saveT = 0; save(); }
}

// ---------- rendering ----------
function human(x, y, o, dir, bob, walk) {
  const cx = Math.round(x * TS), cy = Math.round(y * TS - bob);
  px(g, 'rgba(0,0,0,.3)', cx + 3, cy + 14, 10, 2);
  px(g, o.legs || '#3a3a55', cx + 4, cy + 11, 3, 4 - (walk ? 1 : 0)); px(g, o.legs || '#3a3a55', cx + 9, cy + 11, 3, 4 - (walk ? 0 : 1));
  px(g, o.body, cx + 3, cy + 5, 10, 7); px(g, 'rgba(255,255,255,.2)', cx + 3, cy + 5, 10, 1);
  px(g, '#f0c9a0', cx + 4, cy + 0, 8, 6); px(g, o.hair, cx + 4, cy - 1, 8, 3);
  if (dir[1] >= 0) { px(g, '#222', cx + 5, cy + 3, 2, 2); px(g, '#222', cx + 9, cy + 3, 2, 2); if (dir[1] === 0) px(g, o.hair, cx + (dir[0] < 0 ? 10 : 4), cy, 2, 5); } else px(g, o.hair, cx + 4, cy, 8, 5);
}
function drawEnemy(e) {
  const d = e.d, x = Math.round(e.px * TS), y = Math.round(e.py * TS), t = clock / 200 + e.x, bob = Math.sin(t) * 1.2, fl = e.flash > 0;
  const col = fl ? '#fff' : d.color, c2 = fl ? '#fff' : shade(d.color, -50);
  px(g, 'rgba(0,0,0,.3)', x + 2, y + 14, 12, 2);
  switch (d.kind) {
    case 'blob': px(g, c2, x + 2, y + 8 + bob, 12, 7); px(g, col, x + 3, y + 6 + bob, 10, 8); px(g, '#fff', x + 5, y + 8 + bob, 2, 2); px(g, '#fff', x + 9, y + 8 + bob, 2, 2); px(g, '#111', x + 6, y + 9 + bob, 1, 1); px(g, '#111', x + 10, y + 9 + bob, 1, 1); break;
    case 'wolf': px(g, c2, x + 1, y + 7, 14, 6); px(g, col, x + 2, y + 6, 12, 6); px(g, col, x + 10, y + 3, 5, 5); px(g, c2, x + 11, y + 1, 2, 3); px(g, '#f33', x + 13, y + 5, 1, 1); px(g, c2, x + 1 + (Math.sin(t * 2) > 0 ? 0 : 1), y + 12, 2, 3); px(g, c2, x + 10, y + 12 + (Math.sin(t * 2) > 0 ? 1 : 0), 2, 3); break;
    case 'bat': { const w = Math.sin(t * 6) * 3; px(g, c2, x + 1, y + 5 + w, 5, 3); px(g, c2, x + 10, y + 5 + w, 5, 3); px(g, col, x + 5, y + 5 + bob, 6, 6); px(g, '#f55', x + 6, y + 7 + bob, 1, 1); px(g, '#f55', x + 9, y + 7 + bob, 1, 1); break; }
    case 'human': human(e.px, e.py, { body: col, hair: '#222', legs: '#3a2a1a' }, [0, 1], -bob * 0.3, bob > 0); px(g, '#ccc', x + 12, y + 5, 2, 7); break;
    case 'skel': human(e.px, e.py, { body: col, hair: col, legs: col }, [0, 1], -bob * 0.3, bob > 0); px(g, '#111', x + 5, y + 3, 2, 2); px(g, '#111', x + 9, y + 3, 2, 2); break;
    case 'golem': px(g, c2, x + 1, y + 3, 14, 12); px(g, col, x + 2, y + 2, 12, 10); px(g, '#ffb43a', x + 4, y + 5, 2, 2); px(g, '#ffb43a', x + 10, y + 5, 2, 2); px(g, c2, x + 0, y + 6, 2, 6); px(g, c2, x + 14, y + 6, 2, 6); break;
    case 'ghost': { const a = fl ? 1 : 0.8; g.globalAlpha = a; px(g, col, x + 3, y + 2 + bob, 10, 10); px(g, col, x + 3, y + 12 + bob, 3, 3); px(g, col, x + 8, y + 12 + bob, 3, 2); px(g, '#134', x + 5, y + 5 + bob, 2, 3); px(g, '#134', x + 9, y + 5 + bob, 2, 3); g.globalAlpha = 1; break; }
    case 'knight': human(e.px, e.py, { body: col, hair: '#555', legs: '#4a2a22' }, [0, 1], -bob * 0.3, bob > 0); px(g, '#555', x + 4, y - 1, 8, 4); px(g, '#ff7a2a', x + 6, y + 2, 4, 1); px(g, '#ccc', x + 13, y + 3, 2, 9); break;
    case 'imp': px(g, c2, x + 4, y + 4 + bob, 8, 9); px(g, col, x + 3, y + 3 + bob, 10, 8); px(g, '#ffe36a', x + 5, y + 6 + bob, 2, 2); px(g, '#ffe36a', x + 9, y + 6 + bob, 2, 2); px(g, c2, x + 3, y + 1 + bob, 2, 3); px(g, c2, x + 11, y + 1 + bob, 2, 3); break;
    case 'king': { px(g, 'rgba(0,0,0,.3)', x - 4, y + 18, 24, 3); g.save(); g.globalAlpha = fl ? 1 : 0.9; px(g, c2, x - 3, y - 4 + bob, 22, 22); px(g, col, x - 1, y - 6 + bob, 18, 18); px(g, '#ffd45a', x, y - 11 + bob, 16, 5); px(g, '#ffd45a', x + 1, y - 14 + bob, 3, 4); px(g, '#ffd45a', x + 6, y - 14 + bob, 3, 4); px(g, '#ffd45a', x + 12, y - 14 + bob, 3, 4); px(g, '#111', x + 3, y - 1 + bob, 3, 4); px(g, '#111', x + 10, y - 1 + bob, 3, 4); g.restore(); break; }
    case 'tyrant': { px(g, 'rgba(0,0,0,.3)', x - 4, y + 18, 24, 3); px(g, c2, x - 4, y - 5 + bob, 24, 23); px(g, col, x - 2, y - 7 + bob, 20, 19); px(g, '#ffd45a', x + 1, y - 2 + bob, 4, 4); px(g, '#ffd45a', x + 11, y - 2 + bob, 4, 4); px(g, '#2a1010', x + 4, y + 6 + bob, 8, 3); px(g, c2, x - 3, y - 12 + bob, 4, 7); px(g, c2, x + 15, y - 12 + bob, 4, 7); if (Math.sin(t * 3) > 0) { px(g, '#ffb43a', x + 1, y - 15 + bob, 3, 4); px(g, '#ffb43a', x + 12, y - 15 + bob, 3, 4); } break; }
  }
  if (d.boss || e.hp < d.hp) { px(g, '#300', x, y - (d.boss ? 17 : 4), 16, 2); px(g, d.boss ? '#e22' : '#e44', x, y - (d.boss ? 17 : 4), Math.max(0, 16 * e.hp / d.hp), 2); }
}
function shade(hex, a) { const n = parseInt(hex.slice(1), 16); const f = v => clamp(v + a, 0, 255); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); }
function render(dt) {
  const camX = clamp(P.px - (VW - 1) / 2, 0, Math.max(0, M.w - VW)) * TS, camY = clamp(P.py - (VH - 1) / 2, 0, Math.max(0, M.h - VH)) * TS;
  g.fillStyle = '#000'; g.fillRect(0, 0, 240, 240); g.save();
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  g.translate(Math.round(-camX + sx), Math.round(-camY + sy));
  g.drawImage(M.cache, 0, 0);
  // animated water shimmer
  if (M.theme !== 'cave') { g.globalAlpha = 0.15 + 0.1 * Math.sin(clock / 400); g.fillStyle = '#fff'; const x0 = Math.floor(camX / TS), y0 = Math.floor(camY / TS); for (let y = y0; y < y0 + VH + 1; y++) for (let x = x0; x < x0 + VW + 1; x++) if (M.tiles[y] && M.tiles[y][x] === WATER && ((x + y + Math.floor(clock / 500)) & 3) === 0) g.fillRect(x * TS + 3, y * TS + 7, 8, 1); g.globalAlpha = 1; }
  for (const h of M.herbList) { px(g, '#3a9a46', h.x * TS + 6, h.y * TS + 8, 4, 6); px(g, '#b8f4ff', h.x * TS + 5, h.y * TS + 5, 6, 4); if (Math.sin(clock / 200 + h.x) > 0.3) px(g, '#fff', h.x * TS + 3, h.y * TS + 3, 2, 2); }
  for (const c of M.chestList) { const o = S.opened[c.id], X = c.x * TS, Y = c.y * TS; px(g, 'rgba(0,0,0,.3)', X + 1, Y + 14, 14, 2); px(g, '#7a4a22', X + 2, Y + 6, 12, 9); px(g, o ? '#3a2412' : '#a8672f', X + 2, Y + (o ? 4 : 5), 12, 4); px(g, '#e0c250', X + 7, Y + 8, 2, 3); }
  for (const n of M.npcList) { const N = NPCS[n.id]; human(n.x, n.y, { body: N.color, hair: N.hair }, [0, 1], Math.sin(clock / 500 + n.x) * 0.5, false); const q = N.quests.find(id => { const s = (S.q[id] || { s: 0 }).s; return (s === 0 && questAvailable(QUESTS[id])) || s === 2; }); if (q) { g.fillStyle = '#ffe36a'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText((S.q[q] || { s: 0 }).s === 2 ? '?' : '!', n.x * TS + 8, n.y * TS - 3 + Math.sin(clock / 150) * 1.5); } }
  const sorted = M.ents.slice().sort((a, b) => a.py - b.py); for (const e of sorted) drawEnemy(e);
  // player
  const walking = Math.abs(P.px - P.x) + Math.abs(P.py - P.y) > 0.1;
  if (P.inv > 0 && Math.floor(clock / 60) % 2) g.globalAlpha = 0.5;
  human(P.px, P.py, { body: '#4a8fe8', hair: '#6a3a1a', legs: '#2a3a6a' }, P.dir, walking ? Math.abs(Math.sin(clock / 70)) * 1.5 : 0, P.walk % 2 === 0);
  g.globalAlpha = 1;
  if (P.swing > 0) { const X = (P.px + P.dir[0]) * TS, Y = (P.py + P.dir[1]) * TS; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); const a = Math.atan2(P.dir[1], P.dir[0]); g.arc(P.px * TS + 8, P.py * TS + 8, 12, a - 0.9 + (1 - P.swing / 160) * 1.8, a - 0.2 + (1 - P.swing / 160) * 1.8); g.stroke(); px(g, '#ddd', X + 6, Y + 6, 4, 4); }
  for (const p of M.proj) { px(g, p.col, Math.round(p.x * TS + 5), Math.round(p.y * TS + 5), 6, 6); px(g, '#fff', Math.round(p.x * TS + 7), Math.round(p.y * TS + 7), 2, 2); }
  for (const f of fx) { if (f.p) px(g, f.col, Math.round(f.x * TS + 8), Math.round(f.y * TS + 8), 2, 2); else { g.globalAlpha = Math.min(1, f.life / 400); g.fillStyle = '#000'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillText(f.t, f.x * TS + 9, f.y * TS + 9); g.fillStyle = f.col; g.fillText(f.t, f.x * TS + 8, f.y * TS + 8); g.globalAlpha = 1; } }
  g.restore();
  // lighting & weather
  if (M.theme === 'cave' || M.theme === 'keep') {
    const r = g.createRadialGradient(P.px * TS - camX + 8, P.py * TS - camY + 8, 22, P.px * TS - camX + 8, P.py * TS - camY + 8, M.theme === 'cave' ? 110 : 130);
    r.addColorStop(0, 'rgba(0,0,10,0)'); r.addColorStop(1, M.theme === 'cave' ? 'rgba(0,0,12,.82)' : 'rgba(20,0,0,.7)'); g.fillStyle = r; g.fillRect(0, 0, 240, 240);
  } else if (M.theme === 'frost') { g.fillStyle = 'rgba(120,170,255,.12)'; g.fillRect(0, 0, 240, 240); g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect((i * 53 + clock / 25) % 240, (i * 37 + clock / 12 + i * 11) % 240, 1.5, 1.5); }
  else if (M.theme === 'woods' && M.id !== 'village') { g.fillStyle = 'rgba(10,30,20,.15)'; g.fillRect(0, 0, 240, 240); }
  if (S.map === 'keep') { g.fillStyle = '#ffa63a'; for (let i = 0; i < 18; i++) g.fillRect((i * 47 + Math.sin(clock / 700 + i) * 10) % 240, 240 - ((clock / 20 + i * 31) % 240), 1.5, 1.5); }
  if (P.flash > 0) { g.fillStyle = 'rgba(255,0,0,.25)'; g.fillRect(0, 0, 240, 240); }
  drawHud();
}
function bar(x, y, w, v, m, col) { px(g, '#000', x - 1, y - 1, w + 2, 6); px(g, '#2a2030', x, y, w, 4); px(g, col, x, y, Math.max(0, w * v / m), 4); px(g, 'rgba(255,255,255,.25)', x, y, Math.max(0, w * v / m), 1); }
function drawHud() {
  g.fillStyle = 'rgba(10,8,20,.88)'; g.fillRect(0, 0, 240, 24); g.fillRect(0, 228, 240, 12);
  g.font = 'bold 7px monospace'; g.textAlign = 'left'; g.fillStyle = '#fff';
  g.fillText('HP ' + Math.ceil(S.hp) + '/' + maxHp(), 3, 8); bar(3, 11, 64, S.hp, maxHp(), '#e04a4a');
  g.fillText('MP ' + Math.ceil(S.mp) + '/' + maxMp(), 73, 8); bar(73, 11, 64, S.mp, maxMp(), '#4a8fe0');
  g.fillText('Lv ' + S.lv, 143, 8); bar(143, 11, 40, S.lv >= 25 ? 1 : S.xp, S.lv >= 25 ? 1 : nextXp(S.lv), '#e0c250');
  g.textAlign = 'right'; g.fillStyle = '#ffd45a'; g.fillText(S.gold + 'g', 237, 8); g.fillStyle = '#cfe'; g.fillText(SKILLS[S.skill].name + ' ' + SKILLS[S.skill].mp, 237, 20);
  g.textAlign = 'right'; g.fillStyle = '#bdf'; g.fillText(M.name, 237, 237);
  g.fillStyle = '#ffe9a0'; const aq = Object.keys(QUESTS).find(id => S.q[id] && (S.q[id].s === 1 || S.q[id].s === 2));
  g.fillText(aq ? (S.q[aq].s === 2 ? 'Return: ' + QUESTS[aq].name : QUESTS[aq].name + ' ' + Math.min(S.q[aq].p || 0, QUESTS[aq].count) + '/' + QUESTS[aq].count) : (S.flags.cinderTyrant ? 'The Vale is saved!' : 'Talk to townsfolk for quests'), 3, 237);
  let y = 214; for (const t of toasts) { g.globalAlpha = Math.min(1, t.life / 300); g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.7)'; const w = g.measureText(t.t).width + 8; g.fillRect(120 - w / 2, y - 9, w, 12); g.fillStyle = '#fff'; g.fillText(t.t, 120, y); y -= 14; g.globalAlpha = 1; }
}
function renderTitle() {
  g.fillStyle = '#12101a'; g.fillRect(0, 0, 240, 240);
  for (let i = 0; i < 50; i++) { g.fillStyle = (i % 3 ? '#ff8a2a' : '#ffd45a'); g.fillRect((i * 67 + Math.sin(clock / 900 + i) * 12) % 240, 240 - ((clock / 18 + i * 29) % 240), 1.5, 1.5); }
  g.textAlign = 'center'; g.fillStyle = '#ffb43a'; g.font = 'bold 22px monospace'; g.fillText('EMBERFALL', 120, 90); g.fillStyle = '#ffe9a0'; g.fillText('VALE', 120, 114);
  g.font = '8px monospace'; g.fillStyle = '#aab'; g.fillText('An original action RPG', 120, 134);
}

// ---------- panels (DOM) ----------
const panel = document.getElementById('panel');
function showPanel(html, btns, keepOpen) {
  if (mode !== 'title') mode = 'panel'; panel.innerHTML = html + '<div class="btns"></div>'; panel.style.display = 'block';
  const bx = panel.querySelector('.btns'); (btns || []).forEach(b => { const e = document.createElement('button'); e.textContent = b.label; e.className = 'pb'; e.onclick = ev => { ev.stopPropagation(); sfx('ui'); b.fn(); }; bx.appendChild(e); });
  panel.querySelectorAll('[data-fn]').forEach(el => { el.onclick = ev => { ev.stopPropagation(); sfx('ui'); window[el.dataset.fn](el.dataset.a, el.dataset.b); }; });
}
function closePanel() { panel.style.display = 'none'; panel.innerHTML = ''; mode = 'play'; save(); }
function dialog(name, lines, done, choices) {
  let i = 0;
  const show = () => {
    const last = i >= lines.length - 1;
    const btns = []; if (lines.length && !last) btns.push({ label: 'Next', fn: () => { i++; show(); } });
    else { if (choices) choices.forEach(c => btns.push({ label: c.label, fn: () => { closePanel(); c.fn(); } })); btns.push({ label: choices ? 'Leave' : 'OK', fn: () => { closePanel(); } }); }
    showPanel('<h3>' + name + '</h3><p>' + (lines[i] || '') + '</p>', btns);
    if (last && done && !show.done) { show.done = true; done(); }
  };
  if (!lines.length) { done && done(); return; } show();
}
function talk(n) {
  const N = NPCS[n.id]; sfx('ui'); const extra = [];
  if (N.shop) extra.push({ label: 'Shop', fn: () => openShop(N.shop, N.name) });
  if (N.inn) extra.push({ label: 'Rest (10g)', fn: () => rest() });
  for (const qid of N.quests) {
    const q = QUESTS[qid], st = S.q[qid] || { s: 0 };
    if (st.s === 0 && questAvailable(q)) { dialog(N.name, q.intro, () => startQuest(qid), extra.length ? extra : null); return; }
    if (st.s === 1) { dialog(N.name, q.hint, null, extra.length ? extra : null); return; }
    if (st.s === 2) { dialog(N.name, q.done, () => turnIn(qid), extra.length ? extra : null); return; }
  }
  dialog(N.name, N.idle(S), null, extra.length ? extra : null);
}
function rest() {
  if (S.gold < 10) { dialog('Pell', ['Sorry, a bed costs 10 gold.']); return; }
  S.gold -= 10; S.hp = maxHp(); S.mp = maxMp(); sfx('heal'); save(); dialog('Pell', ['Sleep well... You are fully rested. (Game saved)']);
}
let shopId = null, shopTab = 'buy';
function openShop(id, name) { shopId = id; shopTab = 'buy'; renderShop(name); }
function renderShop(name) {
  name = name || (shopId === 'smith' ? 'Smith Brenn' : 'Odo');
  let h = '<h3>' + name + ' <span class="gold">' + S.gold + 'g</span></h3><div class="tabs"><button class="tab ' + (shopTab === 'buy' ? 'on' : '') + '" data-fn="shopTabSet" data-a="buy">Buy</button><button class="tab ' + (shopTab === 'sell' ? 'on' : '') + '" data-fn="shopTabSet" data-a="sell">Sell</button></div><div class="list">';
  if (shopTab === 'buy') { for (const [id, req] of SHOPS[shopId]) { if (req && !S.flags[req]) continue; const it = ITEMS[id]; h += row(it.name + ' <small>' + it.desc + '</small>', it.price + 'g', 'shopBuy', id); } }
  else { for (const id in S.inv) { const it = ITEMS[id]; if (!S.inv[id] || it.type === 'quest') continue; const eq = Object.values(S.eq).includes(id); const n = S.inv[id] - (eq ? 1 : 0); if (n <= 0) continue; h += row(it.name + ' x' + n, Math.floor(it.price / 2) + 'g', 'shopSell', id); } }
  h += '</div>'; showPanel(h, [{ label: 'Close', fn: closePanel }]);
}
const row = (label, right, fn, id) => '<div class="row" data-fn="' + fn + '" data-a="' + id + '"><span>' + label + '</span><b>' + right + '</b></div>';
window.shopTabSet = t => { shopTab = t; renderShop(); };
window.shopBuy = id => { const it = ITEMS[id]; if (S.gold < it.price) { toast('Not enough gold.'); return renderShop(); } S.gold -= it.price; giveItem(id); sfx('pick'); renderShop(); };
window.shopSell = id => { const it = ITEMS[id]; S.inv[id]--; S.gold += Math.floor(it.price / 2); sfx('pick'); renderShop(); };
// menu
let menuTab = 'items';
function openMenu(tab) {
  if (mode !== 'play' && mode !== 'panel') return; menuTab = tab || menuTab;
  const tabs = ['items', 'gear', 'skills', 'quests', 'stats'];
  let h = '<div class="tabs">' + tabs.map(t => '<button class="tab ' + (t === menuTab ? 'on' : '') + '" data-fn="menuTabSet" data-a="' + t + '">' + t + '</button>').join('') + '</div><div class="list">';
  if (menuTab === 'items') { let any = false; for (const id in S.inv) { const it = ITEMS[id]; if (!S.inv[id] || !(it.type === 'use' || it.type === 'quest')) continue; any = true; h += row(it.name + ' x' + S.inv[id] + ' <small>' + it.desc + '</small>', it.type === 'use' ? 'Use' : '', it.type === 'use' ? 'useItem' : 'noop', id); } if (!any) h += '<p>No items.</p>'; }
  else if (menuTab === 'gear') { for (const slot of ['weapon', 'armor', 'charm']) { h += '<div class="sub">' + slot + ': ' + (S.eq[slot] ? ITEMS[S.eq[slot]].name : 'none') + '</div>'; for (const id in S.inv) { const it = ITEMS[id]; if (it.type !== slot || !S.inv[id]) continue; h += row(it.name + ' <small>' + it.desc + '</small>', S.eq[slot] === id ? 'Equipped' : 'Equip', 'equip', id); } } }
  else if (menuTab === 'skills') { for (const k in SKILLS) { const s = SKILLS[k]; h += row(s.name + ' <small>' + (S.lv >= s.lv ? s.desc : 'Unlocks at Lv ' + s.lv) + '</small>', S.lv >= s.lv ? (S.skill === k ? 'Selected' : s.mp + ' MP') : 'Lv ' + s.lv, S.lv >= s.lv ? 'pickSkill' : 'noop', k); } }
  else if (menuTab === 'quests') { let any = false; for (const id in QUESTS) { const st = S.q[id]; if (!st) continue; any = true; const q = QUESTS[id]; h += '<div class="row"><span>' + q.name + '<small>' + q.hint[0] + '</small></span><b>' + (st.s === 3 ? 'Done' : st.s === 2 ? 'Turn in' : Math.min(st.p || 0, q.count) + '/' + q.count) + '</b></div>'; } if (!any) h += '<p>No quests yet. Speak with the townsfolk of Hearthmere.</p>'; }
  else { const m = Math.floor(S.t / 60000); h += '<p>Level ' + S.lv + ' &nbsp; XP ' + S.xp + '/' + nextXp(S.lv) + '<br>HP ' + Math.ceil(S.hp) + '/' + maxHp() + ' &nbsp; MP ' + Math.ceil(S.mp) + '/' + maxMp() + '<br>ATK ' + atk() + ' &nbsp; DEF ' + def() + '<br>Gold ' + S.gold + '<br>Foes defeated ' + S.kills + '<br>Play time ' + m + ' min</p>'; }
  h += '</div>'; showPanel(h, [{ label: 'Save', fn: () => { save(); toast('Game saved.'); } }, { label: muted ? 'Sound: off' : 'Sound: on', fn: () => { muted = !muted; openMenu(); } }, { label: 'Close', fn: closePanel }]);
}
window.menuTabSet = t => openMenu(t); window.noop = () => { };
window.useItem = id => { const it = ITEMS[id]; if (!S.inv[id]) return; if ((it.heal && S.hp >= maxHp() && !it.mp) || (it.mp && !it.heal && S.mp >= maxMp())) { toast('No effect.'); return; } S.inv[id]--; if (it.heal) S.hp = Math.min(maxHp(), S.hp + it.heal); if (it.mp) S.mp = Math.min(maxMp(), S.mp + it.mp); sfx('heal'); openMenu(); };
window.equip = id => { S.eq[ITEMS[id].type] = id; sfx('pick'); S.hp = Math.min(S.hp, maxHp()); openMenu(); };
window.pickSkill = k => { S.skill = k; openMenu(); };

// ---------- save / load ----------
function save() { try { if (S && S.hp > 0) { S.x = P.x; S.y = P.y; localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } } catch (e) { } }
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.lv ? s : null; } catch (e) { return null; } }
function startGame(s) {
  S = s; audio(); mode = 'play'; panel.style.display = 'none';
  const m = getMap(S.map); enterMap(S.map, m.ents ? S.x : S.x, S.y);
  if (occupied(S.x, S.y, null)) { enterMap(S.map, m.start[0], m.start[1]); }
  if (!S.flags.intro) { S.flags.intro = true; mode = 'panel'; dialog('Hearthmere', ['Welcome, traveler, to Hearthmere in Emberfall Vale.', 'Move with the pad. Press A facing someone to talk, or facing a foe to strike. B casts the chosen spell; the ⟳ button swaps spells. ☰ opens your bag.', 'Elder Mara (the "!") has work for you.']); }
}
function titleMenu() {
  const sv = load(); mode = 'title';
  showPanel('<h2>Emberfall Vale</h2><p>The Cinder Tyrant\'s fires creep across the Vale. Only you can end them.</p>', [
    ...(sv ? [{ label: 'Continue', fn: () => startGame(sv) }] : []),
    { label: 'New Game', fn: () => { if (sv && !confirm('Erase your saved game?')) return; startGame(newState()); } }]);
}

// ---------- input ----------
const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
addEventListener('keydown', e => {
  audio(); const d = dirMap[e.key]; if (d) { held[d] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'j') { e.preventDefault(); swing(); } else if (e.key === 'k') useSkill(); else if (e.key === 'l') cycleSkill();
  else if (e.key === 'm' || e.key === 'Tab') { e.preventDefault(); mode === 'play' ? openMenu() : mode === 'panel' && closePanel(); } else if (e.key === 'Escape' && mode === 'panel') closePanel();
});
addEventListener('keyup', e => { const d = dirMap[e.key]; if (d) held[d] = false; });
const release = () => { for (const k in held) held[k] = false; };
addEventListener('pointerup', release); addEventListener('pointercancel', release); addEventListener('blur', release);
document.querySelectorAll('[data-d]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); release(); held[b.dataset.d] = true; if (mode === 'play' && P.mcd <= 0) { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[b.dataset.d]; tryMove(d[0], d[1]); } }); b.addEventListener('contextmenu', e => e.preventDefault()); });
const bind = (id, fn) => { const b = document.getElementById(id); b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); fn(); }); b.addEventListener('contextmenu', e => e.preventDefault()); };
bind('act', () => swing()); bind('skill', () => useSkill()); bind('cyc', () => cycleSkill()); bind('menu', () => { if (mode === 'play') openMenu(); else if (mode === 'panel') closePanel(); });
setInterval(() => musicTick(), 230);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
window.__game = { get S() { return S; }, get M() { return M; }, P, getMap, enterMap, startGame, newState, ENEMIES };
requestAnimationFrame(frame);
titleMenu();
