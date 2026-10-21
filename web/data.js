'use strict';
// ===== Emberfall Vale: game content (all original) =====
const ITEMS = {
  potion:   { name: 'Potion', type: 'use', heal: 40, price: 20, desc: 'Restores 40 HP.' },
  hipotion: { name: 'Hi-Potion', type: 'use', heal: 120, price: 60, desc: 'Restores 120 HP.' },
  ether:    { name: 'Ether', type: 'use', mp: 25, price: 50, desc: 'Restores 25 MP.' },
  elixir:   { name: 'Elixir', type: 'use', heal: 9999, mp: 9999, price: 180, desc: 'Fully restores HP and MP.' },
  moonherb: { name: 'Moonherb', type: 'quest', price: 0, desc: 'A silvery herb that glows at dusk.' },
  ledger:   { name: "Brenn's Ledger", type: 'quest', price: 0, desc: 'A soot-stained smith ledger.' },
  sword0: { name: 'Rusty Sword', type: 'weapon', atk: 2, price: 10, desc: 'ATK +2' },
  sword1: { name: 'Iron Blade', type: 'weapon', atk: 7, price: 90, desc: 'ATK +7' },
  sword2: { name: 'Ember Blade', type: 'weapon', atk: 14, price: 400, desc: 'ATK +14' },
  sword3: { name: 'Frost Saber', type: 'weapon', atk: 22, price: 900, desc: 'ATK +22' },
  sword4: { name: 'Dawnbrand', type: 'weapon', atk: 32, price: 3000, desc: 'ATK +32' },
  armor0: { name: 'Cloth Tunic', type: 'armor', def: 1, price: 8, desc: 'DEF +1' },
  armor1: { name: 'Leather Vest', type: 'armor', def: 4, price: 70, desc: 'DEF +4' },
  armor2: { name: 'Chain Mail', type: 'armor', def: 8, price: 160, desc: 'DEF +8' },
  armor3: { name: 'Frost Mail', type: 'armor', def: 14, price: 700, desc: 'DEF +14' },
  armor4: { name: 'Ember Plate', type: 'armor', def: 20, price: 1400, desc: 'DEF +20' },
  charm0: { name: 'Vigor Charm', type: 'charm', hp: 40, price: 200, desc: 'Max HP +40' },
  charm1: { name: 'Focus Charm', type: 'charm', mp: 20, price: 200, desc: 'Max MP +20' },
  charm2: { name: 'Lucky Coin', type: 'charm', luck: 1, price: 250, desc: 'Gold +50%, crits more often' },
  charm3: { name: 'Warding Knot', type: 'charm', def: 5, price: 300, desc: 'DEF +5' },
};

const SKILLS = {
  spark: { name: 'Spark',  lv: 1, mp: 3,  desc: 'Magic bolt in your facing direction.' },
  mend:  { name: 'Mend',   lv: 3, mp: 8,  desc: 'Heal yourself.' },
  whirl: { name: 'Whirl',  lv: 5, mp: 10, desc: 'Spin attack hitting all adjacent foes.' },
  nova:  { name: 'Nova',   lv: 8, mp: 20, desc: 'Blast everything within 3 tiles.' },
};

const ENEMIES = {
  slime:    { name: 'Gloom Slime', hp: 14,  atk: 5,  def: 0, xp: 5,   gold: [2, 5],    spd: 620, aggro: 5, rate: 1100, color: '#6fd36a', kind: 'blob' },
  wolf:     { name: 'Thorn Wolf',  hp: 26,  atk: 8,  def: 1, xp: 10,  gold: [3, 8],    spd: 360, aggro: 7, rate: 900,  color: '#8a8d96', kind: 'wolf' },
  bandit:   { name: 'Road Bandit', hp: 36,  atk: 10, def: 2, xp: 16,  gold: [10, 22],  spd: 440, aggro: 7, rate: 950,  color: '#a0522d', kind: 'human' },
  bat:      { name: 'Cave Bat',    hp: 22,  atk: 10, def: 1, xp: 14,  gold: [4, 10],   spd: 240, aggro: 8, rate: 800,  color: '#7a5fa8', kind: 'bat', erratic: true },
  skeleton: { name: 'Bone Walker', hp: 50,  atk: 13, def: 3, xp: 26,  gold: [10, 24],  spd: 480, aggro: 7, rate: 1000, color: '#e6e1cf', kind: 'skel' },
  golem:    { name: 'Rock Golem',  hp: 120, atk: 18, def: 6, xp: 55,  gold: [25, 50],  spd: 720, aggro: 6, rate: 1400, color: '#8c8478', kind: 'golem' },
  hollowKing: { name: 'The Hollow King', hp: 320, atk: 20, def: 5, xp: 400, gold: [150, 200], spd: 470, aggro: 12, rate: 1000, color: '#b6a2e8', kind: 'king', boss: true, flag: 'hollowKing', summon: 'skeleton', ranged: false },
  frostwolf:{ name: 'Frost Wolf',  hp: 64,  atk: 18, def: 3, xp: 38,  gold: [14, 28],  spd: 330, aggro: 8, rate: 850,  color: '#bcd8ee', kind: 'wolf' },
  wraith:   { name: 'Ice Wraith',  hp: 56,  atk: 16, def: 2, xp: 46,  gold: [18, 32],  spd: 520, aggro: 9, rate: 1700, color: '#8fe0ff', kind: 'ghost', ranged: true, range: 6, keep: 3 },
  yeti:     { name: 'Rime Yeti',   hp: 170, atk: 26, def: 7, xp: 90,  gold: [35, 60],  spd: 650, aggro: 6, rate: 1200, color: '#f0f5fa', kind: 'golem' },
  cinderKnight: { name: 'Cinder Knight', hp: 100, atk: 28, def: 9, xp: 80, gold: [30, 55], spd: 500, aggro: 7, rate: 1000, color: '#c25a3a', kind: 'knight' },
  emberImp: { name: 'Ember Imp',   hp: 64,  atk: 20, def: 3, xp: 62,  gold: [24, 44],  spd: 420, aggro: 9, rate: 1500, color: '#ff8a2a', kind: 'imp', ranged: true, range: 6, keep: 3 },
  cinderTyrant: { name: 'The Cinder Tyrant', hp: 800, atk: 32, def: 9, xp: 1500, gold: [0, 0], spd: 520, aggro: 14, rate: 900, color: '#ff5a1f', kind: 'tyrant', boss: true, flag: 'cinderTyrant', summon: 'emberImp', ranged: true, range: 7, keep: 1 },
};

const QUESTS = {
  q1: { name: 'Wolves at the Gate', npc: 'mara', type: 'kill', target: 'wolf', count: 5,
    intro: ['Thorn Wolves have been stalking the Whisper Woods east of town.', 'Cull five of them and the road will be safe. Take the path out the east gate.', 'Press A beside someone to talk, and A facing a foe to strike!'],
    hint: ['Five Thorn Wolves in the Whisper Woods. Be careful out there.'],
    done: ['You did it! The road is safe again.', 'Take this blade, and my thanks.'],
    reward: { xp: 80, gold: 60, items: { sword1: 1, potion: 2 } } },
  q2: { name: "Tessa's Moonherbs", npc: 'tessa', type: 'collect', target: 'moonherb', count: 3,
    intro: ['I need three moonherbs for my salves. They glimmer in the Whisper Woods.', 'Walk over the sparkles to pick them up.'],
    hint: ['Moonherbs sparkle among the trees of the Whisper Woods.'],
    done: ['Wonderful! These are perfect. Here, a few hi-potions I brewed.'],
    reward: { xp: 90, gold: 0, items: { hipotion: 3 } } },
  q3: { name: 'The Lost Ledger', npc: 'brenn', type: 'collect', target: 'ledger', count: 1, req: 'q1',
    intro: ['I lost my ledger in the Ashen Caves when bandits chased me. It lists every smith secret I own.', 'Find it in a chest deep in the caves. Mara can tell you how to get past the gate.'],
    hint: ['My ledger is in a chest somewhere in the Ashen Caves.'],
    done: ['My ledger! You are a marvel. Take this mail, forged by my own hands.'],
    reward: { xp: 250, gold: 150, items: { armor2: 1 } } },
  q4: { name: 'The Hollow King', npc: 'ivo', type: 'kill', target: 'hollowKing', count: 1, req: 'q1',
    intro: ['A spectral king rules the deepest hall of the Ashen Caves. His undead pour into the woods.', 'Defeat the Hollow King and the way to the Frostmire will open.', 'Pack potions. Whirl and Nova will help once you learn them.'],
    hint: ['The Hollow King waits at the far end of the Ashen Caves.'],
    done: ['The Hollow King is gone! Legends will be told.', 'The Ember Blade was sealed in his tomb. Now it is yours.'],
    reward: { xp: 500, gold: 250, items: { sword2: 1, elixir: 1 } } },
  q5: { name: 'The Frozen Beacon', npc: 'mara', type: 'kill', target: 'wraith', count: 6, req: 'q4', auto: true,
    intro: ['Beyond the caves lies the Frostmire. Ice Wraiths smother the old beacon there.', 'Destroy six of them to rekindle it. Then we can see what burns beyond.'],
    hint: ['Six Ice Wraiths haunt the Frostmire. Keep moving: they shoot from afar.'],
    done: [],
    reward: { xp: 900, gold: 400, items: { sword3: 1, armor3: 1 } } },
  q6: { name: 'The Cinder Tyrant', npc: 'ivo', type: 'kill', target: 'cinderTyrant', count: 1, req: 'q5', auto: true,
    intro: ['The Cinder Tyrant has dwelt in Emberfall Keep since the old war, burning the Vale from afar.', 'Walk through the Frostmire to the Keep and end him. The Vale is counting on you.'],
    hint: ['Emberfall Keep lies at the end of the Frostmire. End the Cinder Tyrant.'],
    done: [],
    reward: { xp: 3000, gold: 1000, items: { sword4: 1 } } },
};

const NPCS = {
  mara:  { name: 'Elder Mara',   quests: ['q1', 'q5'], color: '#cfd3ff', hair: '#eee',
           idle: s => s.flags.cinderTyrant ? ['The Vale is safe at last, hero.'] : s.q.q5 && s.q.q5.s === 3 ? ['Go to the Keep, hero. Ivo will tell you what he knows.'] : ['The Vale is quieter thanks to you.'] },
  tessa: { name: 'Tessa',        quests: ['q2'], color: '#7fd48a', hair: '#7a3b1e', idle: () => ['Herbs and salves! Sleep well, traveler.'] },
  brenn: { name: 'Smith Brenn',  quests: ['q3'], color: '#d98b4a', hair: '#222', shop: 'smith', idle: () => ['Steel for coin, friend. See anything you like?'] },
  odo:   { name: 'Odo',          quests: [], color: '#e0c250', hair: '#555', shop: 'general', idle: () => ['Potions, ethers, anything for the road!'] },
  ivo:   { name: 'Captain Ivo',  quests: ['q4', 'q6'], color: '#6a8fd8', hair: '#a33', idle: s => s.flags.cinderTyrant ? ['You saved us all. The watch salutes you.'] : ['Stay sharp out there.'] },
  pell:  { name: 'Innkeeper Pell', quests: [], color: '#d87a9a', hair: '#8a5', inn: true, idle: () => ['Welcome to the Emberhearth Inn!'] },
};

const SHOPS = {
  general: [['potion'], ['hipotion'], ['ether'], ['elixir']],
  smith: [['sword1'], ['armor1'], ['armor2'], ['charm0'], ['charm1'], ['charm3'], ['sword2', 'hollowKing'], ['armor3', 'hollowKing'], ['charm2', 'hollowKing'], ['sword3', 'cinderTyrant'], ['armor4', 'cinderTyrant']],
};

const VILLAGE = [
  '########################',
  '#......................#',
  '#..RRR....RRR....RRR...#',
  '#..RRR....RRR....RRR...#',
  '#..WDW....WDW....WDW...#',
  '#..,,,....,,,....,,,...#',
  '#,,,,,,,,,,,,,,,,,,,,,.#',
  '#,,,,,,,,,,,,,,,,,,,,,,,',
  '#.....~~~~.........TT..#',
  '#.....~~~~.......T.....#',
  '#.................T....#',
  '#..T......~~~..........#',
  '#.........~~~....T.....#',
  '#....T.................#',
  '########################',
];
const VILLAGE_SIGNS = [['INN', 3, 2], ['SHOP', 10, 2], ['FORGE', 17, 2]];

// id, size, theme, density, enemies, boss, chests
const ZONES = {
  woods: { w: 46, h: 32, theme: 'woods', name: 'Whisper Woods', seed: 11, density: 0.42, passes: 3,
    spawns: [['slime', 9], ['wolf', 9], ['bandit', 5]], herbs: 5, chests: [
      { gold: 40 }, { items: { potion: 2 } }, { items: { ether: 1 } }, { items: { charm0: 1 } }, { items: { armor1: 1 } }] },
  caves: { w: 42, h: 34, theme: 'cave', name: 'Ashen Caves', seed: 29, density: 0.44, passes: 3, arena: { x: 33, y: 17, r: 4 },
    spawns: [['bat', 9], ['skeleton', 9], ['golem', 4]], boss: ['hollowKing', 33, 17], chests: [
      { id: 'ledger', items: { ledger: 1 } }, { gold: 120 }, { items: { hipotion: 2 } }, { items: { charm1: 1 } }, { items: { ether: 2 } }, { items: { charm3: 1 } }] },
  frost: { w: 46, h: 32, theme: 'frost', name: 'Frostmire', seed: 47, density: 0.4, passes: 3,
    spawns: [['frostwolf', 9], ['wraith', 11], ['yeti', 4]], chests: [
      { gold: 250 }, { items: { hipotion: 3 } }, { items: { elixir: 1 } }, { items: { charm2: 1 } }, { items: { ether: 3 } }] },
  keep: { w: 34, h: 32, theme: 'keep', name: 'Emberfall Keep', seed: 71, density: 0.38, passes: 3, arena: { x: 26, y: 16, r: 5 },
    spawns: [['cinderKnight', 9], ['emberImp', 9]], boss: ['cinderTyrant', 26, 16], chests: [
      { items: { armor4: 1 } }, { gold: 400 }, { items: { elixir: 2 } }, { items: { hipotion: 4 } }] },
};
