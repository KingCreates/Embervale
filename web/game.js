// Emberfall Vale - an original top-down RPG. Move, talk (Act), fight, level up.
const T = 16, W = 20, H = 20;
const cv = document.getElementById('c'), g = cv.getContext('2d');
const map = [];
for (let y = 0; y < H; y++) { map[y] = []; for (let x = 0; x < W; x++) {
  const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
  map[y][x] = edge || ((x * 7 + y * 13) % 11 === 0 && (x > 3 || y > 3)) ? 1 : 0; } }
const p = { x: 2, y: 2, hp: 30, max: 30, atk: 5, lv: 1, xp: 0, dir: [0, 1] };
const elder = { x: 3, y: 2 };
let quest = 0, slain = 0, msg = 'Walk with the arrows. Act talks/attacks.', over = false;
const foes = [];
for (let i = 0; i < 6; i++) {
  let x, y; do { x = 5 + Math.floor(Math.random() * 13); y = 3 + Math.floor(Math.random() * 15); } while (map[y][x]);
  map[y][x] = 0; foes.push({ x, y, hp: 12, max: 12 });
}
const blocked = (x, y) => map[y][x] || foes.some(f => f.x === x && f.y === y) || (x === elder.x && y === elder.y);
function gain(n) { p.xp += n; while (p.xp >= p.lv * 10) { p.xp -= p.lv * 10; p.lv++; p.max += 8; p.hp = p.max; p.atk += 2; msg = 'Level up! Now ' + p.lv; } }
function foeTurn() {
  for (const f of foes) {
    const d = Math.abs(f.x - p.x) + Math.abs(f.y - p.y);
    if (d === 1) { p.hp -= 2 + Math.floor(Math.random() * 3); if (p.hp <= 0) { over = true; msg = 'You fell. Reload to retry.'; } }
    else if (d < 6) { const sx = Math.sign(p.x - f.x), sy = Math.sign(p.y - f.y);
      const [a, b] = Math.abs(p.x - f.x) > Math.abs(p.y - f.y) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
      for (const [dx, dy] of [a, b]) if ((dx || dy) && !blocked(f.x + dx, f.y + dy) && !(f.x + dx === p.x && f.y + dy === p.y)) { f.x += dx; f.y += dy; break; } }
  }
}
function move(dx, dy) {
  if (over) return; p.dir = [dx, dy];
  const nx = p.x + dx, ny = p.y + dy;
  if (!blocked(nx, ny)) { p.x = nx; p.y = ny; }
  foeTurn(); draw();
}
function act() {
  if (over) return;
  const tx = p.x + p.dir[0], ty = p.y + p.dir[1];
  if (tx === elder.x && ty === elder.y) {
    if (quest === 0) { quest = 1; msg = 'Elder: Slay 3 ember wisps for me!'; }
    else if (quest === 1) msg = 'Elder: ' + slain + '/3 slain.';
    if (quest === 1 && slain >= 3) { quest = 2; gain(20); p.hp = p.max; msg = 'Elder: The Vale is safe. Thank you!'; }
  } else {
    const f = foes.find(f => f.x === tx && f.y === ty);
    if (f) { f.hp -= p.atk + Math.floor(Math.random() * 3); msg = 'Hit!';
      if (f.hp <= 0) { foes.splice(foes.indexOf(f), 1); slain++; gain(8); } }
  }
  foeTurn(); draw();
}
function draw() {
  g.fillStyle = '#2d5a2f'; g.fillRect(0, 0, 320, 320);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map[y][x]) { g.fillStyle = '#1b3a22'; g.fillRect(x * T, y * T, T, T); }
  g.fillStyle = '#e8c35a'; g.fillRect(elder.x * T + 2, elder.y * T + 2, 12, 12);
  for (const f of foes) { g.fillStyle = '#ff7a2a'; g.fillRect(f.x * T + 3, f.y * T + 3, 10, 10); g.fillStyle = '#f00'; g.fillRect(f.x * T, f.y * T, T * f.hp / f.max, 2); }
  g.fillStyle = '#4aa8ff'; g.fillRect(p.x * T + 2, p.y * T + 2, 12, 12);
  g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, 320, 26);
  g.fillStyle = '#fff'; g.font = '9px monospace';
  g.fillText(`HP ${p.hp}/${p.max}  Lv ${p.lv}  XP ${p.xp}/${p.lv * 10}  Quest ${['not started', slain + '/3', 'done'][quest]}`, 4, 10);
  g.fillText(msg, 4, 22);
}
const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
document.querySelectorAll('[data-d]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); move(...dirs[b.dataset.d]); }));
document.getElementById('act').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
addEventListener('keydown', e => { const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
  if (m) move(...dirs[m]); else if (e.key === ' ' || e.key === 'Enter') act(); });
draw();
