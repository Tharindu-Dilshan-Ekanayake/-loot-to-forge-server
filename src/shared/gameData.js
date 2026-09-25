/**
 * Loot to Forge — shared game catalog and world layout.
 *
 * This file is the single source of truth for game balance. An identical copy lives
 * in the client at `loot-to-forge-client/src/shared/gameData.js`; after editing
 * this one, run `npm run sync-data` in the server to copy it across.
 *
 * Pure data + pure functions only: no Node or browser APIs, so it runs on both sides.
 */

export const MAX_PLAYERS_PER_ROOM = 8

/* ---------------------------------------------------------------------------
 * Rarities
 * ------------------------------------------------------------------------- */

export const RARITIES = [
  { id: 'Common', color: '#c9ced6', dark: '#6b7280', grade: 'C', base: 20 },
  { id: 'UnCommon', color: '#3fdc3f', dark: '#138a1d', grade: 'B', base: 50 },
  { id: 'Rare', color: '#35a0ff', dark: '#0d4fb8', grade: 'A', base: 120 },
  { id: 'Epic', color: '#b456ff', dark: '#5b1aa8', grade: 'S', base: 300 },
  { id: 'Legendary', color: '#ffbf1f', dark: '#b86a00', grade: 'SS', base: 800 },
  { id: 'Mythic', color: '#ff3b4e', dark: '#9e0f1f', grade: 'SSS', base: 2000 },
  { id: 'Eternal', color: '#2cf2ff', dark: '#007c99', grade: 'EX', base: 5000 },
  { id: 'Secret', color: '#ff5cf0', dark: '#1b0630', grade: 'X', base: 15000 },
]

export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]))
export const rarityOf = (id) => RARITIES[RARITY_INDEX[id] ?? 0]

/* ---------------------------------------------------------------------------
 * Ores
 * ------------------------------------------------------------------------- */

/** `mult` feeds the forge multiplier; `hp` is the node's health when mined. */
export const ORES = {
  stone: { name: 'Stone', rarity: 'Common', color: '#9ea3a8', color2: '#3d4046', mult: 0.3, sell: 8, hp: 30 },
  copper: { name: 'Copper', rarity: 'Common', color: '#e07a45', color2: '#7a3a1c', mult: 0.5, sell: 14, hp: 55 },
  silver: { name: 'Silver', rarity: 'UnCommon', color: '#c8d2e6', color2: '#5d6a86', mult: 0.7, sell: 18, hp: 90 },
  quartz: { name: 'Quartz', rarity: 'UnCommon', color: '#dff4ff', color2: '#7fb6d6', mult: 0.8, sell: 20, hp: 110 },
  jade: { name: 'Jade', rarity: 'UnCommon', color: '#2fd37a', color2: '#0d6b3a', mult: 0.9, sell: 21, hp: 120 },
  ruby: { name: 'Ruby', rarity: 'UnCommon', color: '#ff3d7a', color2: '#7a1238', mult: 1.0, sell: 25, hp: 150 },
  sapphire: { name: 'Sapphire', rarity: 'Rare', color: '#3b7bff', color2: '#122f8a', mult: 1.3, sell: 40, hp: 700 },
  gold: { name: 'Gold', rarity: 'Rare', color: '#ffd23b', color2: '#a26a00', mult: 1.6, sell: 55, hp: 1100 },
  amethyst: { name: 'Amethyst', rarity: 'Epic', color: '#b35bff', color2: '#4a1486', mult: 2.0, sell: 80, hp: 5000 },
  emerald: { name: 'Emerald', rarity: 'Epic', color: '#19f08a', color2: '#006b3a', mult: 2.4, sell: 100, hp: 7000 },
  obsidian: { name: 'Obsidian', rarity: 'Legendary', color: '#5b3a8e', color2: '#120622', mult: 3.0, sell: 160, hp: 40000 },
  // Event ores: rare, but kept only a step above the ores around them, so one
  // lucky find can't carry a player to the end of the game.
  sunstone: { name: 'Sunstone', rarity: 'Legendary', color: '#ffb000', color2: '#ff5a00', mult: 2.2, sell: 110, hp: 6000, event: true },
  aetherite: { name: 'Aetherite', rarity: 'Eternal', color: '#3ef6ff', color2: '#0a5cff', mult: 3.4, sell: 280, hp: 60000, event: true },
  voidcrystal: { name: 'Void Crystal', rarity: 'Secret', color: '#ff4df2', color2: '#16002b', mult: 5.0, sell: 800, hp: 400000, event: true },
}

/**
 * Timed ores that turn up now and then in a random stage between `stages[0]` and
 * `stages[1]` (never Stage 1), for everyone to mine together. Each stays caged
 * for a player until they've beaten every enemy in that stage.
 */
export const EVENT_ORES = [
  { ore: 'sunstone', label: 'Legendary ore', stages: [3, 12], everyMs: 8 * 60 * 1000, lifeMs: 3 * 60 * 1000 },
  { ore: 'aetherite', label: 'Eternal ore', stages: [8, 17], everyMs: 20 * 60 * 1000, lifeMs: 4 * 60 * 1000 },
  { ore: 'voidcrystal', label: 'Secret ore', stages: [12, 20], everyMs: 40 * 60 * 1000, lifeMs: 5 * 60 * 1000 },
]

/* ---------------------------------------------------------------------------
 * Weapons & armor
 * ------------------------------------------------------------------------- */

export const WEAPON_CLASSES = {
  Dagger: { mult: 0.8, skill: 'flurry' },
  Sword: { mult: 1.0, skill: 'whirlwind' },
  Axe: { mult: 1.15, skill: 'earthsplitter' },
  Katana: { mult: 1.3, skill: 'dash' },
}

export const ARMOR_CLASSES = {
  Leather: { mult: 0.8 },
  Chainmail: { mult: 1.0 },
  Plate: { mult: 1.3 },
}

/** Class odds by how many ores go into the forge (1–4). */
/**
 * Weapon types the forge can be told to make. Picking one skips the class roll
 * (the ore count still decides everything else); "Auto" keeps the odds below.
 */
export const FORGE_WEAPON_CHOICES = ['Sword', 'Axe']

export const WEAPON_CLASS_ODDS = {
  1: { Dagger: 100 },
  2: { Dagger: 35, Sword: 65 },
  3: { Sword: 30, Axe: 30, Katana: 40 },
  4: { Katana: 100 },
}

export const ARMOR_CLASS_ODDS = {
  1: { Leather: 100 },
  2: { Leather: 60, Chainmail: 40 },
  3: { Chainmail: 70, Plate: 30 },
  4: { Plate: 100 },
}

// [id, name, class, rarity, blade, accent, glow?]
const W = [
  ['rusty_shiv', 'Rusty Shiv', 'Dagger', 'Common', '#9a8f86', '#6b4a2b'],
  ['stone_fang', 'Stone Fang', 'Dagger', 'Common', '#b0b3b8', '#4a4d52'],
  ['jade_needle', 'Jade Needle', 'Dagger', 'UnCommon', '#46e08a', '#1f5a3a'],
  ['copper_kris', 'Copper Kris', 'Dagger', 'UnCommon', '#ec8a4f', '#5a2c14'],
  ['tidal_stiletto', 'Tidal Stiletto', 'Dagger', 'Rare', '#3b8cff', '#0e2f6e', '#7cc4ff'],
  ['frostbite', 'Frostbite', 'Dagger', 'Rare', '#aeeaff', '#3b6f9a', '#d8f6ff'],
  ['venom_kiss', 'Venom Kiss', 'Dagger', 'Epic', '#9b3dff', '#43ff7a', '#b86bff'],
  ['shadow_talon', 'Shadow Talon', 'Dagger', 'Epic', '#6a4aa8', '#1c1030', '#a07bff'],
  ['sunfang', 'Sunfang', 'Dagger', 'Legendary', '#ffc629', '#b35a00', '#ffe07a'],
  ['bloodmoon_edge', 'Bloodmoon Edge', 'Dagger', 'Mythic', '#ff2d3d', '#3a0508', '#ff6b6b'],
  ['starpiercer', 'Starpiercer', 'Dagger', 'Eternal', '#39f0ff', '#1a3cff', '#b8fbff'],
  ['voidwhisper', 'Voidwhisper', 'Dagger', 'Secret', '#1a0b2e', '#ff4df2', '#e04dff'],

  ['training_sword', 'Training Sword', 'Sword', 'Common', '#c9c2b4', '#7a5230'],
  ['iron_blade', 'Iron Blade', 'Sword', 'Common', '#b8c0c8', '#3d434b'],
  ['emerald_edge', 'Emerald Edge', 'Sword', 'UnCommon', '#2fe07a', '#c9a13b'],
  ['silverbrand', 'Silverbrand', 'Sword', 'UnCommon', '#e3e9f2', '#4b5b7a'],
  ['azure_guardian', 'Azure Guardian', 'Sword', 'Rare', '#2f7dff', '#e8c14a', '#8cc2ff'],
  ['stormcaller', 'Stormcaller', 'Sword', 'Rare', '#9fd8ff', '#2a3a6e', '#e9f7ff'],
  ['amethyst_oath', 'Amethyst Oath', 'Sword', 'Epic', '#b35bff', '#f0d060', '#d6a1ff'],
  ['phantom_saber', 'Phantom Saber', 'Sword', 'Epic', '#8a7bff', '#231a4a', '#c0b6ff'],
  ['solar_crown', 'Solar Crown', 'Sword', 'Legendary', '#ffd23b', '#ff7a00', '#fff09a'],
  ['crimson_tyrant', 'Crimson Tyrant', 'Sword', 'Mythic', '#ff2440', '#1a0306', '#ff7a8a'],
  ['celestial_verdict', 'Celestial Verdict', 'Sword', 'Eternal', '#dffcff', '#2cf2ff', '#8ff8ff'],
  ['abyssal_sovereign', 'Abyssal Sovereign', 'Sword', 'Secret', '#120420', '#ff4df2', '#ff7af5'],

  ['woodcutter', 'Woodcutter', 'Axe', 'Common', '#a8adb3', '#7a4a22'],
  ['stone_hatchet', 'Stone Hatchet', 'Axe', 'Common', '#8e9196', '#5a3a1e'],
  ['jade_cleaver', 'Jade Cleaver', 'Axe', 'UnCommon', '#37d77f', '#3a2412'],
  ['copper_reaver', 'Copper Reaver', 'Axe', 'UnCommon', '#e67d42', '#2e2e33'],
  ['frost_splitter', 'Frost Splitter', 'Axe', 'Rare', '#9be6ff', '#29507a', '#dff8ff'],
  ['tidebreaker', 'Tidebreaker', 'Axe', 'Rare', '#2b7bff', '#e8d7a0', '#7fb9ff'],
  ['venomfang_axe', 'Venomfang Axe', 'Axe', 'Epic', '#7bff4a', '#3a0f5a', '#b3ff8f'],
  ['dusk_ripper', 'Dusk Ripper', 'Axe', 'Epic', '#a04dff', '#ff7a3b', '#c68bff'],
  ['dragon_maw', 'Dragon Maw', 'Axe', 'Legendary', '#ffb21a', '#8a1a00', '#ffd57a'],
  ['hellfire_reaper', 'Hellfire Reaper', 'Axe', 'Mythic', '#ff4020', '#2a0500', '#ff9a50'],
  ['aurora_halberd', 'Aurora Halberd', 'Axe', 'Eternal', '#6bffea', '#ff6bf0', '#c9fff7'],
  ['abyss_devourer', 'Abyss Devourer', 'Axe', 'Secret', '#1b0630', '#8a2bff', '#ff4df2'],

  ['wooden_katana', 'Wooden Katana', 'Katana', 'Common', '#d6dde6', '#1c1c22'],
  ['ronin_blade', 'Ronin Blade', 'Katana', 'Common', '#c0c6cf', '#6b1f1f'],
  ['azure_apex', 'Azure Apex', 'Katana', 'UnCommon', '#2f6bff', '#0b1a4a', '#8ab6ff'],
  ['bamboo_viper', 'Bamboo Viper', 'Katana', 'UnCommon', '#5fe06a', '#c9a256'],
  ['tsunami_edge', 'Tsunami Edge', 'Katana', 'Rare', '#35b6ff', '#f4f4f4', '#9fe0ff'],
  ['moonlit_fang', 'Moonlit Fang', 'Katana', 'Rare', '#d7dcff', '#3a3f7a', '#f0f2ff'],
  ['sakura_storm', 'Sakura Storm', 'Katana', 'Epic', '#ff8fd0', '#5a1a3a', '#ffc2e6'],
  ['oni_slayer', 'Oni Slayer', 'Katana', 'Epic', '#b04dff', '#ff3b3b', '#d59bff'],
  ['golden_dragon', 'Golden Dragon', 'Katana', 'Legendary', '#ffcf3b', '#c21a1a', '#fff0a0'],
  ['crimson_shogun', 'Crimson Shogun', 'Katana', 'Mythic', '#ff1f3a', '#140206', '#ff6a7a'],
  ['heavenly_tempest', 'Heavenly Tempest', 'Katana', 'Eternal', '#8ffcff', '#ffffff', '#d6ffff'],
  ['void_emperor', 'Void Emperor', 'Katana', 'Secret', '#0d0218', '#b400ff', '#ff4df2'],
]

export const WEAPONS = Object.fromEntries(
  W.map(([id, name, cls, rarity, blade, accent, glow]) => [
    id,
    { id, name, class: cls, rarity, blade, accent, glow: glow || null },
  ]),
)

/** Sold for gems in the shop; not forgeable. */
WEAPONS.nether_bane = {
  id: 'nether_bane',
  name: 'Nether Bane',
  class: 'Sword',
  rarity: 'Mythic',
  blade: '#ff1f2e',
  accent: '#1a0000',
  glow: '#ff5a3b',
  fixedPower: 750,
  shopOnly: true,
}

export const STARTER_WEAPON = 'wooden_katana'
export const STARTER_WEAPON_POWER = 12

// [id, name, class, rarity, color]
const A = [
  ['goblin_hide', 'Goblin Hide', 'Leather', 'Common', '#8a6a3a'],
  ['ranger_vest', 'Ranger Vest', 'Leather', 'UnCommon', '#3f8a3a'],
  ['tide_leathers', 'Tide Leathers', 'Leather', 'Rare', '#2f6bd8'],
  ['shade_wraps', 'Shade Wraps', 'Leather', 'Epic', '#6a2ab8'],
  ['sunweave', 'Sunweave', 'Leather', 'Legendary', '#e8a520'],
  ['blood_silk', 'Blood Silk', 'Leather', 'Mythic', '#c21a2e'],
  ['starcloth', 'Starcloth', 'Leather', 'Eternal', '#2ad8f0'],
  ['void_mantle', 'Void Mantle', 'Leather', 'Secret', '#2a0a40'],
  ['iron_links', 'Iron Links', 'Chainmail', 'Common', '#9aa0a8'],
  ['silver_mail', 'Silver Mail', 'Chainmail', 'UnCommon', '#cdd6e6'],
  ['sapphire_mail', 'Sapphire Mail', 'Chainmail', 'Rare', '#3b7bff'],
  ['amethyst_mail', 'Amethyst Mail', 'Chainmail', 'Epic', '#a04dff'],
  ['golden_mail', 'Golden Mail', 'Chainmail', 'Legendary', '#ffc629'],
  ['inferno_mail', 'Inferno Mail', 'Chainmail', 'Mythic', '#ff4020'],
  ['aurora_mail', 'Aurora Mail', 'Chainmail', 'Eternal', '#6bffea'],
  ['abyss_mail', 'Abyss Mail', 'Chainmail', 'Secret', '#1b0630'],
  ['knight_plate', 'Knight Plate', 'Plate', 'Common', '#b8c0c8'],
  ['jade_plate', 'Jade Plate', 'Plate', 'UnCommon', '#2fd37a'],
  ['glacier_plate', 'Glacier Plate', 'Plate', 'Rare', '#9be6ff'],
  ['warlord_plate', 'Warlord Plate', 'Plate', 'Epic', '#8a2be2'],
  ['dragon_plate', 'Dragon Plate', 'Plate', 'Legendary', '#ffb21a'],
  ['tyrant_plate', 'Tyrant Plate', 'Plate', 'Mythic', '#ff2440'],
  ['celestial_plate', 'Celestial Plate', 'Plate', 'Eternal', '#dffcff'],
  ['emperor_plate', 'Emperor Plate', 'Plate', 'Secret', '#0d0218'],
]

export const ARMORS = Object.fromEntries(
  A.map(([id, name, cls, rarity, color]) => [id, { id, name, class: cls, rarity, color }]),
)

/* ---------------------------------------------------------------------------
 * Skills
 * ------------------------------------------------------------------------- */

export const SKILLS = {
  dash: {
    name: 'Blade Dash',
    cooldown: 5.5,
    range: 9,
    base: 280,
    perGrade: 40,
    describe: (p) => `Dash forward, dealing ${p}% damage.`,
  },
  whirlwind: {
    name: 'Whirlwind',
    cooldown: 6,
    radius: 6,
    base: 200,
    perGrade: 30,
    describe: (p) => `Spin around, dealing ${p}% damage to nearby foes.`,
  },
  earthsplitter: {
    name: 'Earthsplitter',
    cooldown: 8,
    radius: 7,
    base: 300,
    perGrade: 45,
    describe: (p) => `Slam the ground, dealing ${p}% area damage.`,
  },
  flurry: {
    name: 'Flurry',
    cooldown: 4,
    range: 5,
    base: 270,
    perGrade: 35,
    describe: (p) => `Strike 3 times, dealing ${p}% total damage.`,
  },
}

export function skillFor(weaponId) {
  const w = WEAPONS[weaponId]
  if (!w) return null
  const key = WEAPON_CLASSES[w.class].skill
  const s = SKILLS[key]
  const g = RARITY_INDEX[w.rarity]
  const percent = s.base + s.perGrade * g
  return {
    key,
    ...s,
    grade: RARITIES[g].grade,
    percent,
    text: `${s.describe(percent)} CD:${s.cooldown}s`,
  }
}

/* ---------------------------------------------------------------------------
 * Enchants, races, extra skills
 * ------------------------------------------------------------------------- */

export const ENCHANTS = [
  { id: 'sharp', name: 'Sharpness', mult: 0.1, weight: 40, color: '#d6dde6' },
  { id: 'keen', name: 'Keen', mult: 0.2, weight: 28, color: '#3fdc3f' },
  { id: 'blazing', name: 'Blazing', mult: 0.35, weight: 16, color: '#ff7a1f' },
  { id: 'frost', name: 'Frost', mult: 0.35, weight: 10, color: '#7fe3ff' },
  { id: 'thunder', name: 'Thunder', mult: 0.6, weight: 5, color: '#ffe23b' },
  { id: 'void', name: 'Void', mult: 1.0, weight: 1, color: '#d24dff' },
]
export const ENCHANT_COST = 150

export const RACES = [
  { id: 'human', name: 'Human', mult: 1, weight: 40, color: '#f2c9a0' },
  { id: 'elf', name: 'Elf', mult: 1.1, weight: 25, color: '#9be07a' },
  { id: 'dwarf', name: 'Dwarf', mult: 1.2, weight: 16, color: '#c98a4a' },
  { id: 'orc', name: 'Orc', mult: 1.35, weight: 10, color: '#5fae3a' },
  { id: 'angel', name: 'Angel', mult: 1.6, weight: 5, color: '#fff3a8' },
  { id: 'demon', name: 'Demon', mult: 2, weight: 3, color: '#ff3b4e' },
  { id: 'dragonborn', name: 'Dragonborn', mult: 3, weight: 1, color: '#ffb21a' },
]
export const RACE_SPIN_COST = 100

export const EXTRA_SKILLS = [
  { id: 'crit', name: 'Critical Eye', text: '15% chance to deal 2x damage', weight: 30, color: '#ff5a3b' },
  { id: 'swift', name: 'Swift Hands', text: 'Attack 25% faster', weight: 25, color: '#3ef6ff' },
  { id: 'lucky', name: 'Lucky Miner', text: '20% chance for a bonus ore', weight: 20, color: '#3fdc3f' },
  { id: 'tough', name: 'Tough Skin', text: '+40% max health', weight: 15, color: '#ffbf1f' },
  { id: 'vampire', name: 'Vampiric', text: 'Heal 4% of damage dealt', weight: 10, color: '#b456ff' },
]
export const EXTRA_SKILL_COST = 250

/* ---------------------------------------------------------------------------
 * Shop, upgrades, quests
 * ------------------------------------------------------------------------- */

export const SHOP_ITEMS = [
  { id: 'crate_basic', name: 'Ore Crate', currency: 'coins', price: 60, text: '2 random ores', pool: ['stone', 'copper', 'silver', 'quartz', 'jade', 'ruby'], count: 2 },
  { id: 'crate_rare', name: 'Rare Ore Crate', currency: 'coins', price: 600, text: '2 rare ores', pool: ['ruby', 'sapphire', 'gold', 'amethyst'], count: 2 },
  { id: 'crate_mythic', name: 'Mythic Ore Crate', currency: 'coins', price: 6000, text: '1 epic+ ore', pool: ['amethyst', 'emerald', 'obsidian', 'sunstone'], count: 1 },
]

/**
 * Backpacks, worn on the character's back. Each sets the base ore capacity; the
 * Upgrade station's "Backpack Size" adds slots on top of whichever bag is worn.
 * `look` picks the procedural model and icon.
 */
export const BAGS = [
  { id: 'pouch', name: 'Leather Pouch', capacity: 4, currency: 'coins', price: 0, rarity: 'Common', look: 'pouch', text: 'A humble starter pouch.' },
  { id: 'explorer', name: 'Explorer Pack', capacity: 8, currency: 'coins', price: 300, rarity: 'UnCommon', look: 'explorer', text: 'Canvas pack with a bedroll.' },
  { id: 'knight', name: "Knight's Satchel", capacity: 12, currency: 'coins', price: 1800, rarity: 'Rare', look: 'knight', text: 'Steel-plated, gold buckles.' },
  { id: 'crystal', name: 'Crystal Pack', capacity: 18, currency: 'coins', price: 9000, rarity: 'Epic', look: 'crystal', text: 'Hums with trapped starlight.' },
  { id: 'dragon', name: 'Dragon Hoard', capacity: 26, currency: 'coins', price: 45000, rarity: 'Legendary', look: 'dragon', text: 'Wings included. Gold not.' },
  { id: 'void', name: 'Void Rift Bag', capacity: 36, currency: 'coins', price: 220000, rarity: 'Mythic', look: 'void', text: 'Bigger on the inside.' },
  { id: 'celestial', name: 'Celestial Satchel', capacity: 50, currency: 'coins', price: 1200000, rarity: 'Eternal', look: 'celestial', text: 'Blessed by the stars.' },
]
export const STARTER_BAG = 'pouch'
export const bagById = (id) => BAGS.find((b) => b.id === id) || BAGS[0]

/**
 * Each owned bag can be upgraded with coins, up to `max` levels. A level adds a
 * quarter of the bag's base size, so bigger bags grow more per level.
 */
export const BAG_UPGRADE = { max: 5, growth: 1.8, minCost: 120, priceShare: 0.4 }
export const bagUpgradeSlots = (bag) => Math.max(1, Math.round(bag.capacity * 0.25))
export const bagLevel = (profile, id) => profile?.bagLevels?.[id] || 0
export function bagUpgradeCost(bag, level) {
  const base = Math.max(BAG_UPGRADE.minCost, bag.price * BAG_UPGRADE.priceShare)
  return Math.round(base * Math.pow(BAG_UPGRADE.growth, level))
}
/** Slots a bag gives at its current upgrade level. */
export const bagCapacity = (profile, bag) => bag.capacity + bagLevel(profile, bag.id) * bagUpgradeSlots(bag)

/** Ore slots: the worn bag (with its upgrades) plus 2 per Backpack Size upgrade. */
export function capacityFor(profile) {
  return bagCapacity(profile, bagById(profile.bag)) + (profile.upgrades?.capacity || 0) * 2
}

export const UPGRADES = {
  capacity: { name: 'Backpack Size', text: '+2 ore slots', base: 100, growth: 2.2, max: 12 },
  vitality: { name: 'Vitality', text: '+25 max health', base: 80, growth: 1.8, max: 20 },
}

export function upgradeCost(key, level) {
  const u = UPGRADES[key]
  return Math.round(u.base * Math.pow(u.growth, level))
}

export const MAX_WEAPONS = 40

export const QUESTS = [
  { id: 'kill', name: 'Monster Hunter', verb: 'Defeat enemies', target: 10, gems: 2, coins: 60 },
  { id: 'mine', name: 'Rock Breaker', verb: 'Mine ores', target: 12, gems: 2, coins: 60 },
  { id: 'forge', name: 'Blacksmith', verb: 'Forge items', target: 3, gems: 3, coins: 100 },
  { id: 'train', name: 'Discipline', verb: 'Hit training dummies', target: 100, gems: 1, coins: 40 },
]

/** The free gift comes round every 3 hours (real time, online or not). */
export const ONLINE_REWARD_MS = 3 * 60 * 60 * 1000
/** Coins in the free gift, which grows with rebirths. */
export const giftCoins = (rebirths = 0) => 100 * (1 + rebirths)
/* ---------------------------------------------------------------------------
 * Progression math
 * ------------------------------------------------------------------------- */

export const START_POWER = 10
export const BASE_HP = 100

/**
 * Power needed to go from `level` to `level + 1`. Lv0 → 60, Lv10 → 203, Lv20 → 694…
 * Each level costs 13% more than the last, so the gap keeps widening and a
 * rebirth takes real play rather than a few minutes of clicking.
 */
export const levelNeed = (level) => Math.floor(60 * Math.pow(1.13, level))

/** Each level adds this share of damage on top, so levelling up hits harder. */
export const LEVEL_DAMAGE_BONUS = 0.12
export const levelDamageMult = (level) => 1 + level * LEVEL_DAMAGE_BONUS

/** Cumulative power → { level, into, need }. */
export function levelFromPower(power) {
  let level = 0
  let rest = Math.max(0, power)
  while (level < 999) {
    const need = levelNeed(level)
    if (rest < need) return { level, into: rest, need }
    rest -= need
    level += 1
  }
  return { level, into: rest, need: levelNeed(level) }
}

export const rebirthLevelReq = (rebirths) => 20 + rebirths * 10
export const rebirthMult = (rebirths) => 1 + rebirths * 0.5

export function formatNum(n) {
  n = Math.floor(n)
  if (n < 1000) return String(n)
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi']
  let u = -1
  let v = n
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000
    u += 1
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${units[u]}`.replace(
    /\.0+([A-Za-z])/,
    '$1',
  )
}

/* ---------------------------------------------------------------------------
 * World layout — the server runs AI against these, the client builds meshes.
 * Hub is centred on the origin; north is -Z.
 * ------------------------------------------------------------------------- */

export const HUB = {
  size: 110,
  /** North of the fountain, facing the dungeon gate with a clear road to it. */
  spawn: [0, 1, -8],
  /**
   * The forge stays south of the fountain; the four shops stand side by side in
   * one market row on the north-east side, all facing south toward the road.
   */
  stations: {
    forge: { pos: [0, 0, 22.8], radius: 8, label: 'Forge' },
    sell: { pos: [12, 0, -22], radius: 4.6, label: 'Sell' },
    upgrade: { pos: [20.4, 0, -22], radius: 4.6, label: 'Upgrade' },
    enchant: { pos: [28.8, 0, -22], radius: 4.6, label: 'Enchant' },
    skillIndex: { pos: [37.2, 0, -22], radius: 4.6, label: 'Skill Index' },
  },
  /** The leaderboard stage, north-west of the fountain, facing the spawn road. */
  boards: { pos: [-17, 0, -30], rotation: 0 },
  /** The dungeon gate in the north castle wall; walk through it into Stage 1. */
  portal: { pos: [0, 0, -44], width: 11 },
  /** Shortcut to the first Frostbound stage for players with enough rebirths. */
  tower: { pos: [36, 0, 0], radius: 5, rebirths: 2, stage: 7 },
}

/** Power every swing trains, before rebirth / x2 multipliers. */
export const CLICK_POWER = 1

/**
 * Training dummies, all in one row of pads along the west side (weakest in the
 * south). Hitting one grants power × mult; `theme` picks the pad and its effect.
 */
export const DUMMIES = [
  { id: 'd0', pos: [-33.8, 0.3, 30.4], mult: 1, rebirths: 0, look: 'target', theme: 'basic' },
  { id: 'd1', pos: [-33.8, 0.3, 20.3], mult: 1.5, rebirths: 0, look: 'goblin', theme: 'grass' },
  { id: 'd2', pos: [-33.8, 0.3, 10.2], mult: 2, rebirths: 2, look: 'knight', theme: 'fire' },
  { id: 'd3', pos: [-33.8, 0.3, 0], mult: 4, rebirths: 5, look: 'skeleton', theme: 'grave' },
  { id: 'd4', pos: [-33.8, 0.3, -10.2], mult: 6, rebirths: 9, look: 'frost', theme: 'ice' },
  { id: 'd5', pos: [-33.8, 0.3, -20.3], mult: 10, rebirths: 15, look: 'demon', theme: 'lava' },
]

/**
 * Enemy stats. `body` picks the model: humanoid (every regular enemy) or golem
 * (armoured giants). `ranged` (reach in studs) makes it shoot instead of
 * swinging. `atkCd` is seconds between attacks. Power and coin rewards are derived
 * from hp below so the curve stays smooth when stats are tuned.
 */
const ENEMY_BASE = {
  // Stage 1 — Ironwood Yard. Every enemy is a person (or a giant), never a creature.
  pinkslime: { name: 'Bandit', body: 'humanoid', hp: 14, dmg: 3, speed: 3.8, scale: 0.9, atkCd: 1.2 },
  blossomfox: { name: 'Lumberjack', body: 'humanoid', hp: 22, dmg: 3, speed: 4.2, scale: 0.75, atkCd: 1.3 },
  goblin: { name: 'Goblin', body: 'humanoid', hp: 18, dmg: 4, speed: 4.3, scale: 1, atkCd: 1.2 },
  goblinshaman: { name: 'Goblin Shaman', body: 'humanoid', hp: 16, dmg: 3, speed: 3.9, scale: 1, atkCd: 2.2, ranged: 12 },
  // Stage 2 — Goblin Meadow
  goblin2: { name: 'Goblin Scout', body: 'humanoid', hp: 50, dmg: 5, speed: 4.5, scale: 1, atkCd: 1.15 },
  wolf: { name: 'Goblin Brawler', body: 'humanoid', hp: 55, dmg: 5, speed: 5.4, scale: 1, atkCd: 1.0 },
  banditthief: { name: 'Bandit Thief', body: 'humanoid', hp: 45, dmg: 5, speed: 5.6, scale: 0.95, atkCd: 0.9 },
  archer: { name: 'Goblin Archer', body: 'humanoid', hp: 36, dmg: 5, speed: 3.9, scale: 1, atkCd: 2.2, ranged: 13 },
  // Stage 3 — Goblin Camp
  brute: { name: 'Goblin Brute', body: 'humanoid', hp: 140, dmg: 8, speed: 3.7, scale: 1.3, atkCd: 1.5 },
  boar: { name: 'Goblin Raider', body: 'humanoid', hp: 110, dmg: 7, speed: 5.3, scale: 1.15, atkCd: 1.1 },
  goblinwarlock: { name: 'Goblin Warlock', body: 'humanoid', hp: 90, dmg: 8, speed: 3.8, scale: 1.05, atkCd: 2.2, ranged: 14 },
  archer2: { name: 'Goblin Sniper', body: 'humanoid', hp: 85, dmg: 7, speed: 3.9, scale: 1, atkCd: 2.1, ranged: 15 },
  // Stage 4 — Captain's Keep
  goblin3: { name: 'Goblin Guard', body: 'humanoid', hp: 200, dmg: 9, speed: 4.4, scale: 1.1, atkCd: 1.2 },
  keepknight: { name: 'Keep Knight', body: 'humanoid', hp: 260, dmg: 10, speed: 4.0, scale: 1.2, atkCd: 1.4 },
  crossbow: { name: 'Keep Crossbowman', body: 'humanoid', hp: 150, dmg: 9, speed: 3.8, scale: 1.05, atkCd: 2.0, ranged: 15 },
  captain: { name: 'Captain Goblin', body: 'humanoid', hp: 1200, dmg: 16, speed: 3.9, scale: 1.6, atkCd: 1.5, boss: true },
  // Stage 5 — Troll Cavern
  spider: { name: 'Cave Troll', body: 'humanoid', hp: 380, dmg: 12, speed: 5.6, scale: 1, atkCd: 1.0 },
  bat: { name: 'Bat Cultist', body: 'humanoid', hp: 300, dmg: 11, speed: 6.2, scale: 0.9, atkCd: 1.0 },
  caveslime: { name: 'Toxic Miner', body: 'humanoid', hp: 450, dmg: 13, speed: 3.5, scale: 1.25, atkCd: 1.3 },
  // Stage 6 — Haunted Crypt
  skeleton: { name: 'Skeleton', body: 'humanoid', hp: 800, dmg: 16, speed: 4.6, scale: 1.1, atkCd: 1.15 },
  skelarcher: { name: 'Bone Archer', body: 'humanoid', hp: 650, dmg: 15, speed: 4.0, scale: 1.05, atkCd: 2.0, ranged: 15 },
  ghost: { name: 'Ghoul', body: 'humanoid', hp: 700, dmg: 17, speed: 4.9, scale: 1.1, atkCd: 1.2 },
  lich: { name: 'Lich King', body: 'humanoid', hp: 5000, dmg: 30, speed: 3.8, scale: 1.8, atkCd: 1.5, boss: true },
  // Stage 7 — Frostbound Halls
  frostwolf: { name: 'Frost Raider', body: 'humanoid', hp: 1600, dmg: 22, speed: 5.8, scale: 1.1, atkCd: 1.0 },
  snowslime: { name: 'Snow Bandit', body: 'humanoid', hp: 1900, dmg: 22, speed: 3.6, scale: 1.3, atkCd: 1.3 },
  icegolem: { name: 'Ice Golem', body: 'golem', hp: 2600, dmg: 28, speed: 3.3, scale: 1.45, atkCd: 1.6 },
  // Stage 8 — Glacier Throne
  icewisp: { name: 'Ice Mage', body: 'humanoid', hp: 3000, dmg: 26, speed: 4.6, scale: 1, atkCd: 2.0, ranged: 14 },
  yeti: { name: 'Yeti', body: 'golem', hp: 4200, dmg: 32, speed: 4.2, scale: 1.5, atkCd: 1.4 },
  frosttitan: { name: 'Frost Titan', body: 'golem', hp: 22000, dmg: 50, speed: 3.4, scale: 2.4, atkCd: 1.7, boss: true },
  // Stage 9 — Sunscorch Ruins
  mummy: { name: 'Desert Zombie', body: 'humanoid', hp: 6500, dmg: 35, speed: 4.1, scale: 1.1, atkCd: 1.2 },
  scorpion: { name: 'Mummy', body: 'humanoid', hp: 7000, dmg: 36, speed: 5.4, scale: 1.2, atkCd: 1.1 },
  sandgolem: { name: 'Jackal Zombie', body: 'humanoid', hp: 9000, dmg: 42, speed: 3.9, scale: 1.25, atkCd: 1.4 },
  // Stage 10 — Void Sanctum
  voidknight: { name: 'Void Knight', body: 'humanoid', hp: 13000, dmg: 45, speed: 4.4, scale: 1.3, atkCd: 1.2 },
  voideye: { name: 'Void Mage', body: 'humanoid', hp: 11000, dmg: 42, speed: 4.6, scale: 1.1, atkCd: 2.0, ranged: 15 },
  voidslime: { name: 'Void Cultist', body: 'humanoid', hp: 14000, dmg: 46, speed: 3.7, scale: 1.35, atkCd: 1.3 },
  // Stage 11 — Nether Depths
  imp: { name: 'Nether Imp', body: 'humanoid', hp: 26000, dmg: 55, speed: 5.5, scale: 0.95, atkCd: 1.0 },
  hellhound: { name: 'Hell Knight', body: 'humanoid', hp: 30000, dmg: 58, speed: 6.0, scale: 1.2, atkCd: 1.0 },
  magmagolem: { name: 'Magma Golem', body: 'golem', hp: 40000, dmg: 66, speed: 3.4, scale: 1.55, atkCd: 1.6 },
  // Stage 12 — Nether Throne
  firespirit: { name: 'Fire Mage', body: 'humanoid', hp: 50000, dmg: 64, speed: 4.8, scale: 1.1, atkCd: 2.0, ranged: 15 },
  netherlord: { name: 'Nether Lord', body: 'humanoid', hp: 450000, dmg: 130, speed: 3.6, scale: 2.6, atkCd: 1.6, boss: true },
  // Stage 13 — Emerald Jungle
  panther: { name: 'Jungle Warrior', body: 'humanoid', hp: 110000, dmg: 150, speed: 6.2, scale: 1.2, atkCd: 1.0 },
  vineslime: { name: 'Vine Shaman', body: 'humanoid', hp: 125000, dmg: 150, speed: 3.8, scale: 1.35, atkCd: 1.3 },
  junglehunter: { name: 'Jungle Hunter', body: 'humanoid', hp: 95000, dmg: 145, speed: 4.2, scale: 1.1, atkCd: 2.0, ranged: 15 },
  // Stage 14 — Coral Depths
  crab: { name: 'Pirate', body: 'humanoid', hp: 230000, dmg: 190, speed: 5.2, scale: 1.3, atkCd: 1.1 },
  jelly: { name: 'Sea Witch', body: 'humanoid', hp: 200000, dmg: 185, speed: 4.6, scale: 1.1, atkCd: 2.0, ranged: 14 },
  tidegolem: { name: 'Tide Golem', body: 'golem', hp: 280000, dmg: 210, speed: 3.4, scale: 1.5, atkCd: 1.6 },
  // Stage 15 — Crystal Caverns
  crystalbat: { name: 'Crystal Mage', body: 'humanoid', hp: 420000, dmg: 240, speed: 6.2, scale: 1, atkCd: 1.0 },
  shardslime: { name: 'Shard Knight', body: 'humanoid', hp: 520000, dmg: 250, speed: 3.6, scale: 1.4, atkCd: 1.3 },
  gemgolem: { name: 'Gem Golem', body: 'golem', hp: 600000, dmg: 280, speed: 3.3, scale: 1.55, atkCd: 1.6 },
  crystalqueen: { name: 'Crystal Queen', body: 'humanoid', hp: 3800000, dmg: 420, speed: 4.2, scale: 2.4, atkCd: 1.5, boss: true },
  // Stage 16 — Storm Peaks
  stormwolf: { name: 'Storm Warrior', body: 'humanoid', hp: 900000, dmg: 320, speed: 6.4, scale: 1.2, atkCd: 1.0 },
  thunderbird: { name: 'Thunder Mage', body: 'humanoid', hp: 820000, dmg: 310, speed: 5.0, scale: 1.2, atkCd: 2.0, ranged: 15 },
  stormgiant: { name: 'Storm Giant', body: 'golem', hp: 1200000, dmg: 380, speed: 3.6, scale: 1.7, atkCd: 1.6 },
  // Stage 17 — Sky Citadel
  skyknight: { name: 'Sky Knight', body: 'humanoid', hp: 2000000, dmg: 430, speed: 4.6, scale: 1.25, atkCd: 1.2 },
  angelarcher: { name: 'Seraph Archer', body: 'humanoid', hp: 1700000, dmg: 410, speed: 4.2, scale: 1.1, atkCd: 2.0, ranged: 16 },
  cloudspirit: { name: 'Cloud Monk', body: 'humanoid', hp: 1900000, dmg: 420, speed: 5.0, scale: 1.2, atkCd: 1.2 },
  // Stage 18 — Shadow Realm
  shade: { name: 'Shade Assassin', body: 'humanoid', hp: 4000000, dmg: 560, speed: 5.4, scale: 1.2, atkCd: 1.1 },
  shadowstalker: { name: 'Shadow Stalker', body: 'humanoid', hp: 4300000, dmg: 580, speed: 6.4, scale: 1.25, atkCd: 1.0 },
  nightmare: { name: 'Nightmare Knight', body: 'humanoid', hp: 4800000, dmg: 620, speed: 4.4, scale: 1.35, atkCd: 1.2 },
  shadowking: { name: 'Shadow King', body: 'humanoid', hp: 30000000, dmg: 900, speed: 3.8, scale: 2.6, atkCd: 1.5, boss: true },
  // Stage 19 — Dragon's Lair
  drake: { name: 'Dragon Mage', body: 'humanoid', hp: 8500000, dmg: 760, speed: 5.4, scale: 1.3, atkCd: 2.0, ranged: 16 },
  dragonkin: { name: 'Dragonkin', body: 'humanoid', hp: 9500000, dmg: 800, speed: 4.6, scale: 1.35, atkCd: 1.2 },
  lavawyrm: { name: 'Lava Berserker', body: 'humanoid', hp: 10500000, dmg: 840, speed: 5.6, scale: 1.4, atkCd: 1.1 },
  // Stage 20 — Celestial Summit
  starguard: { name: 'Star Guardian', body: 'golem', hp: 19000000, dmg: 1050, speed: 3.8, scale: 1.6, atkCd: 1.5 },
  cosmicslime: { name: 'Cosmic Monk', body: 'humanoid', hp: 17000000, dmg: 1000, speed: 4.0, scale: 1.45, atkCd: 1.3 },
  celestialseraph: { name: 'Celestial Seraph', body: 'humanoid', hp: 18000000, dmg: 1020, speed: 4.8, scale: 1.3, atkCd: 2.0, ranged: 16 },
  starsovereign: { name: 'Star Sovereign', body: 'humanoid', hp: 150000000, dmg: 1800, speed: 3.8, scale: 3, atkCd: 1.6, boss: true },
}

/**
 * Balance knobs for derived enemy stats. Everything below scales from each
 * enemy's hp, so a new enemy only needs hp, dmg and speed.
 */
export const ENEMY_SCALING = {
  /** Power reward = hp^exp × mult (×boss). */
  rewardExp: 0.72,
  rewardMult: 0.3,
  bossReward: 1.5,
  /** Flat damage soaked per hit = hp^exp × mult. */
  defenseExp: 0.55,
  defenseMult: 0.4,
  /** A hit always does at least this share of its damage, however high the defense. */
  minDamageShare: 0.1,
}

/** Elites: the same kind, tougher, with better loot. Flag one in a stage def. */
export const ELITE = { hp: 3, dmg: 1.5, def: 1.5, reward: 3, scale: 1.2 }

export const ENEMY_TYPES = Object.fromEntries(
  Object.entries(ENEMY_BASE).map(([kind, e]) => {
    const S = ENEMY_SCALING
    const reward = Math.max(2, Math.round(Math.pow(e.hp, S.rewardExp) * S.rewardMult * (e.boss ? S.bossReward : 1)))
    return [
      kind,
      {
        ...e,
        reward,
        coins: Math.round(reward * 0.6) + 1,
        def: e.def ?? Math.round(Math.pow(e.hp, S.defenseExp) * S.defenseMult),
        atkCd: e.atkCd ?? 1.2,
      },
    ]
  }),
)

/**
 * An enemy's stats as it stands in a stage: its kind, boosted if elite. The
 * server and client both read enemies through this.
 */
export function enemyStats(kind, elite = false) {
  const t = ENEMY_TYPES[kind] || ENEMY_TYPES.goblin
  if (!elite) return t
  return {
    ...t,
    name: `Elite ${t.name}`,
    hp: Math.round(t.hp * ELITE.hp),
    dmg: Math.round(t.dmg * ELITE.dmg),
    def: Math.round(t.def * ELITE.def),
    reward: Math.round(t.reward * ELITE.reward),
    coins: Math.round(t.coins * ELITE.reward),
    scale: t.scale * ELITE.scale,
  }
}

/** Damage a hit of `dmg` actually deals through `def`. */
export function mitigate(dmg, def) {
  return Math.max(1, Math.floor(Math.max(dmg * ENEMY_SCALING.minDamageShare, dmg - def)))
}

/* ---------------------------------------------------------------------------
 * The dungeon: one long walled corridor running north from the castle's dungeon
 * gate. Stage i fills the slice z ∈ [z0 - i·L, z0 - (i-1)·L]; players come in at
 * the south end and a gate at the north end opens once every enemy is down.
 * ------------------------------------------------------------------------- */

export const DUNGEON = {
  /** Half the corridor's inner width (x runs from -halfWidth to +halfWidth). */
  halfWidth: 22,
  /** South edge of Stage 1: the outer face of the castle's north wall. */
  z0: -45.5,
  /** Length of each stage along -Z. */
  stageLength: 72,
}
export const STAGE_RESPAWN_S = 45

// [id, name, theme, recommend, rebirths, enemies [kind, x, z, 'elite'?], ores [type, x, z]]
// Offsets are from the stage centre; +z is toward the entrance. `recommend` is the
// Damage the stage is balanced for; STAGE_UNLOCK sets how much of it the gate
// into the stage demands. Adding Stage 21 is one more row here (plus a theme on
// the client: dungeonThemes.js and the sky look in Atmosphere.jsx).
const STAGE_DEFS = [
  [1, 'Ironwood Yard', 'ironwood', 20, 0,
    [['pinkslime', -8, 6], ['pinkslime', 9, 4], ['blossomfox', 0, -4], ['goblin', -12, -12], ['goblinshaman', 12, -13], ['blossomfox', -4, -20], ['goblin', 7, -19, 'elite']],
    [['stone', -16, 12], ['copper', 16, 12], ['stone', -16, -6], ['stone', 16, -6], ['copper', -15, -22]]],
  [2, 'Goblin Meadow', 'meadow', 50, 0,
    [['goblin2', -8, 4], ['wolf', 9, 6], ['goblin2', 0, -6], ['archer', -13, -16], ['banditthief', 12, -10], ['archer', 10, -20], ['goblin2', -3, -18, 'elite']],
    [['copper', -16, 12], ['silver', 16, 12], ['stone', -16, -6], ['copper', 16, -6], ['silver', 15, -22]]],
  [3, 'Goblin Camp', 'camp', 110, 0,
    [['brute', 0, 0, 'elite'], ['boar', -10, 6], ['boar', 10, 6], ['archer2', -13, -14], ['archer2', 13, -14], ['goblin2', -5, -18], ['goblinwarlock', 5, -18]],
    [['silver', -16, 12], ['quartz', 16, 12], ['jade', -16, -6], ['silver', 16, -6], ['quartz', -15, -22]]],
  [4, "Captain's Keep", 'keep', 200, 0,
    [['captain', 0, -12], ['goblin3', -8, 2], ['keepknight', 8, 2], ['goblin3', 0, 6, 'elite'], ['crossbow', -14, -18], ['crossbow', 14, -18]],
    [['jade', -16, 12], ['ruby', 16, 12], ['quartz', -16, -6], ['ruby', 16, -6], ['jade', -15, -22]]],
  [5, 'Troll Cavern', 'cave', 400, 0,
    [['spider', -8, 4], ['spider', 8, 4], ['bat', 0, -4], ['caveslime', -12, -12], ['caveslime', 12, -12], ['bat', -4, -20], ['spider', 6, -20, 'elite']],
    [['ruby', -16, 12], ['sapphire', 16, 12], ['ruby', -16, -6], ['sapphire', 16, -6], ['quartz', -15, -22]]],
  [6, 'Haunted Crypt', 'crypt', 800, 0,
    [['lich', 0, -14], ['skeleton', -8, 4], ['skeleton', 8, 4], ['ghost', 0, 0], ['skelarcher', -14, -18], ['skelarcher', 14, -18], ['ghost', -6, -8], ['skeleton', 6, -8, 'elite']],
    [['sapphire', -16, 12], ['gold', 16, 12], ['sapphire', -16, -6], ['gold', 16, -6], ['ruby', -15, -22]]],
  [7, 'Frostbound Halls', 'frost', 1600, 2,
    [['frostwolf', -8, 4], ['frostwolf', 8, 4], ['snowslime', 0, -4], ['icegolem', -11, -14], ['icegolem', 11, -14], ['snowslime', -4, -20], ['frostwolf', 6, -20, 'elite']],
    [['gold', -16, 12], ['sapphire', 16, 12], ['gold', -16, -6], ['amethyst', 16, -6], ['sapphire', -15, -22]]],
  [8, 'Glacier Throne', 'glacier', 3200, 2,
    [['frosttitan', 0, -14], ['yeti', -9, 2], ['yeti', 9, 2, 'elite'], ['icewisp', -14, -18], ['icewisp', 14, -18], ['frostwolf', -4, 8], ['frostwolf', 4, 8]],
    [['amethyst', -16, 12], ['gold', 16, 12], ['amethyst', -16, -6], ['gold', 16, -6], ['emerald', -15, -22]]],
  [9, 'Sunscorch Ruins', 'desert', 6500, 2,
    [['mummy', -8, 4], ['mummy', 8, 4], ['scorpion', 0, -4], ['sandgolem', -11, -14], ['sandgolem', 11, -14], ['scorpion', -4, -20], ['mummy', 6, -20, 'elite']],
    [['emerald', -16, 12], ['amethyst', 16, 12], ['emerald', -16, -6], ['gold', 16, -6], ['amethyst', -15, -22]]],
  [10, 'Void Sanctum', 'void', 13000, 3,
    [['voidknight', -8, 4], ['voidknight', 8, 4], ['voidslime', 0, -4], ['voideye', -13, -14], ['voideye', 13, -14], ['voidslime', -4, -20], ['voidknight', 6, -20, 'elite']],
    [['emerald', -16, 12], ['obsidian', 16, 12], ['amethyst', -16, -6], ['emerald', 16, -6], ['obsidian', -15, -22]]],
  [11, 'Nether Depths', 'inferno', 28000, 3,
    [['imp', -8, 4], ['imp', 8, 4], ['hellhound', 0, -4], ['magmagolem', -11, -14], ['magmagolem', 11, -14], ['hellhound', -4, -20], ['imp', 6, -20, 'elite']],
    [['obsidian', -16, 12], ['emerald', 16, 12], ['obsidian', -16, -6], ['emerald', 16, -6], ['obsidian', -15, -22]]],
  [12, 'Nether Throne', 'throne', 60000, 3,
    [['netherlord', 0, -14], ['imp', -9, 2], ['imp', 9, 2], ['firespirit', -14, -18], ['firespirit', 14, -18], ['hellhound', -4, 8], ['hellhound', 4, 8, 'elite']],
    [['obsidian', -16, 12], ['obsidian', 16, 12], ['obsidian', -16, -6], ['obsidian', 16, -6], ['obsidian', -15, -22]]],
  [13, 'Emerald Jungle', 'jungle', 125000, 4,
    [['panther', -8, 4], ['panther', 8, 4], ['vineslime', 0, -4], ['junglehunter', -13, -14], ['junglehunter', 13, -14], ['vineslime', -4, -20], ['panther', 6, -20, 'elite']],
    [['obsidian', -16, 12], ['sunstone', 16, 12], ['obsidian', -16, -6], ['obsidian', 16, -6], ['sunstone', -15, -22]]],
  [14, 'Coral Depths', 'reef', 260000, 4,
    [['crab', -8, 4], ['crab', 8, 4], ['jelly', 0, -4], ['tidegolem', -11, -14], ['tidegolem', 11, -14], ['jelly', -4, -20], ['crab', 6, -20, 'elite']],
    [['sunstone', -16, 12], ['obsidian', 16, 12], ['sunstone', -16, -6], ['obsidian', 16, -6], ['sunstone', -15, -22]]],
  [15, 'Crystal Caverns', 'crystal', 540000, 5,
    [['crystalqueen', 0, -14], ['crystalbat', -9, 2], ['crystalbat', 9, 2], ['shardslime', -4, 8], ['shardslime', 4, 8, 'elite'], ['gemgolem', -14, -18], ['gemgolem', 14, -18]],
    [['sunstone', -16, 12], ['sunstone', 16, 12], ['aetherite', -16, -6], ['sunstone', 16, -6], ['aetherite', -15, -22]]],
  [16, 'Storm Peaks', 'storm', 1100000, 5,
    [['stormwolf', -8, 4], ['stormwolf', 8, 4], ['thunderbird', 0, -4], ['stormgiant', -11, -14], ['stormgiant', 11, -14], ['thunderbird', -4, -20], ['stormwolf', 6, -20, 'elite']],
    [['aetherite', -16, 12], ['sunstone', 16, 12], ['aetherite', -16, -6], ['sunstone', 16, -6], ['aetherite', -15, -22]]],
  [17, 'Sky Citadel', 'sky', 2300000, 6,
    [['skyknight', -8, 4], ['skyknight', 8, 4], ['cloudspirit', 0, -4], ['angelarcher', -13, -14], ['angelarcher', 13, -14], ['cloudspirit', -4, -20], ['skyknight', 6, -20, 'elite']],
    [['aetherite', -16, 12], ['aetherite', 16, 12], ['sunstone', -16, -6], ['aetherite', 16, -6], ['aetherite', -15, -22]]],
  [18, 'Shadow Realm', 'shadow', 4800000, 6,
    [['shadowking', 0, -14], ['shade', -9, 2], ['shade', 9, 2], ['shadowstalker', -4, 8], ['shadowstalker', 4, 8, 'elite'], ['nightmare', -14, -18], ['nightmare', 14, -18]],
    [['aetherite', -16, 12], ['voidcrystal', 16, 12], ['aetherite', -16, -6], ['aetherite', 16, -6], ['voidcrystal', -15, -22]]],
  [19, "Dragon's Lair", 'dragon', 10000000, 7,
    [['dragonkin', -8, 4], ['dragonkin', 8, 4], ['lavawyrm', 0, -4], ['drake', -13, -14], ['drake', 13, -14], ['lavawyrm', -4, -20], ['dragonkin', 6, -20, 'elite']],
    [['voidcrystal', -16, 12], ['aetherite', 16, 12], ['voidcrystal', -16, -6], ['aetherite', 16, -6], ['voidcrystal', -15, -22]]],
  [20, 'Celestial Summit', 'celestial', 21000000, 7,
    [['starsovereign', 0, -14], ['starguard', -9, 2], ['starguard', 9, 2], ['cosmicslime', -4, 8], ['cosmicslime', 4, 8, 'elite'], ['celestialseraph', -14, -18], ['celestialseraph', 14, -18]],
    [['voidcrystal', -16, 12], ['voidcrystal', 16, 12], ['voidcrystal', -16, -6], ['voidcrystal', 16, -6], ['voidcrystal', -15, -22]]],
]

/** How much of a stage's recommended Damage its gate asks for. */
export const STAGE_UNLOCK = { damageShare: 1 }

/**
 * Level balance. Levels multiply damage (levelDamageMult), so by the time a
 * player reaches a stage they hit several times harder than the power behind
 * it. Each stage, and the enemies and ores first met in it, are scaled up by
 * the multiplier a player typically has on arrival. The power it takes to get
 * through the game stays the same: levelling makes every hit bigger without
 * making the game shorter. `recommend` in STAGE_DEFS is the unscaled figure.
 */
export const LEVEL_BALANCE = {
  /** Share of a stage's base Damage that comes from power (the rest is gear). */
  powerShare: 0.5,
}
/** How much a stage (and what's first met in it) is scaled for levelling. */
export function stageScale(baseRecommend) {
  return levelDamageMult(levelFromPower(baseRecommend * LEVEL_BALANCE.powerShare).level)
}
/** Two significant figures, so scaled requirements read cleanly (1.2M, 450K). */
function roundNice(n) {
  if (n < 100) return Math.round(n)
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / mag) * mag
}

export const STAGES = STAGE_DEFS.map(([id, name, theme, baseRecommend, rebirths, enemies, ores]) => ({
  id,
  name,
  theme,
  scale: stageScale(baseRecommend),
  recommend: roundNice(baseRecommend * stageScale(baseRecommend)),
  rebirths,
  /** Damage needed to walk in (the way into Stage 1 is always open). */
  requiredDamage: id === 1 ? 0 : roundNice(baseRecommend * stageScale(baseRecommend) * STAGE_UNLOCK.damageShare),
  enemies,
  ores,
  center: [0, DUNGEON.z0 - (id - 0.5) * DUNGEON.stageLength],
}))

export const stageById = (id) => STAGES.find((s) => s.id === id)

// Enemies and ores get tougher by the scale of the first stage they appear in
// (their power reward stays as it was, so grinding pace doesn't change).
{
  const seen = new Set()
  // Event ores turn up across a range of stages: scale by where the range starts
  // (first, so the deep stages that also list them don't set their toughness).
  for (const ev of EVENT_ORES) {
    if (seen.has(`o:${ev.ore}`)) continue
    seen.add(`o:${ev.ore}`)
    ORES[ev.ore].hp = Math.round(ORES[ev.ore].hp * STAGES[ev.stages[0] - 1].scale)
  }
  for (const stage of STAGES) {
    for (const [kind] of stage.enemies) {
      const t = ENEMY_TYPES[kind]
      if (!t || seen.has(`e:${kind}`)) continue
      seen.add(`e:${kind}`)
      t.hp = Math.round(t.hp * stage.scale)
      t.def = Math.round(t.def * stage.scale)
    }
    for (const [ore] of stage.ores) {
      if (seen.has(`o:${ore}`)) continue
      seen.add(`o:${ore}`)
      ORES[ore].hp = Math.round(ORES[ore].hp * stage.scale)
    }
  }
}

/**
 * Why a player can't enter `stageId` yet, or null if they can. Stages open by
 * getting stronger: enough Damage from forged gear and training, plus rebirths
 * for the deep ones. The previous stage must also be cleared for its gate to open.
 */
export function stageLock(stageId, { damage = 0, rebirths = 0 } = {}) {
  const s = stageById(stageId)
  if (!s) return null
  if (rebirths < s.rebirths) return { kind: 'rebirths', need: s.rebirths, text: `Requires ${s.rebirths} Rebirths` }
  if (damage < s.requiredDamage) {
    return { kind: 'damage', need: s.requiredDamage, text: `Requires ${formatNum(s.requiredDamage)} Damage` }
  }
  return null
}

/** z of the gate at the north end of `stageId` (the south end of the next one). */
export const gateZ = (stageId) => DUNGEON.z0 - stageId * DUNGEON.stageLength

/** A stage's walkable rectangle. */
export function stageBounds(stageId) {
  return {
    x0: -DUNGEON.halfWidth,
    x1: DUNGEON.halfWidth,
    zSouth: gateZ(stageId - 1),
    zNorth: gateZ(stageId),
  }
}

/** Where a player appears when teleporting to a stage: just inside its entrance. */
export function stageEntry(stageId) {
  return [0, 1, gateZ(stageId - 1) - 5]
}

/** Which stage (if any) a world position is inside. */
export function stageAt(x, z) {
  if (Math.abs(x) > DUNGEON.halfWidth + 3 || z > DUNGEON.z0) return 0
  const i = Math.floor((DUNGEON.z0 - z) / DUNGEON.stageLength) + 1
  return i >= 1 && i <= STAGES.length ? i : 0
}

/* ---------------------------------------------------------------------------
 * Loot tables
 *
 * A stage drops the ores found in it, weighted toward the common ones. `luck`
 * multiplies the weight of each step up in rarity, so elites and bosses pull the
 * stage's rarer ores far more often, and can drop the next stage's rarest ore.
 * ------------------------------------------------------------------------- */

export const DROP_RULES = {
  normal: { chance: 0.3, rolls: 1, luck: 1, nextTier: 0 },
  elite: { chance: 1, rolls: 2, luck: 2.5, nextTier: 0.1 },
  boss: { chance: 1, rolls: 3, luck: 4, nextTier: 0.5 },
}

/** Weighted ore table for a stage: [{ k: ore, weight }]. */
export function stageLoot(stageId, luck = 1) {
  const s = stageById(stageId)
  if (!s) return []
  const counts = {}
  for (const [ore] of s.ores) counts[ore] = (counts[ore] || 0) + 1
  return Object.entries(counts).map(([ore, n]) => {
    const r = RARITY_INDEX[ORES[ore].rarity]
    return { k: ore, weight: n * Math.pow(luck / 2, r) }
  })
}

/** The rarest ore a stage holds. */
export function stageTopOre(stageId) {
  return stageLoot(stageId).reduce((a, b) => (RARITY_INDEX[ORES[b.k].rarity] > RARITY_INDEX[ORES[a.k].rarity] ? b : a)).k
}

/** Ores dropped by one kill of `tier` in `stageId`. */
export function rollLoot(stageId, tier, rand = Math.random) {
  const rule = DROP_RULES[tier] || DROP_RULES.normal
  if (rand() >= rule.chance) return []
  const out = []
  for (let i = 0; i < rule.rolls; i += 1) out.push(weightedPick(stageLoot(stageId, rule.luck), rand))
  if (rule.nextTier && stageById(stageId + 1) && rand() < rule.nextTier) out.push(stageTopOre(stageId + 1))
  return out
}

/** Where an event ore spawns in `stageId`: somewhere across the middle of it. */
export const eventOrePos = (stageId, rand = Math.random) => {
  const c = stageById(stageId).center
  return [c[0] + (rand() * 2 - 1) * 7, c[1] + 2 + rand() * 4]
}

/* ---------------------------------------------------------------------------
 * Damage
 * ------------------------------------------------------------------------- */

export function weaponPower(item) {
  if (!item) return 0
  return item.power || 0
}

export function enchantMult(item) {
  const e = item?.enchant && ENCHANTS.find((x) => x.id === item.enchant)
  return 1 + (e ? e.mult : 0)
}

export function raceMult(raceId) {
  return RACES.find((r) => r.id === raceId)?.mult ?? 1
}

/** The single damage number shown on the HUD and used by the server. */
export function computeDamage(profile, equippedWeapon) {
  const base = profile.power + weaponPower(equippedWeapon)
  const level = levelFromPower(profile.power).level
  return Math.floor(
    base * enchantMult(equippedWeapon) * raceMult(profile.race) * rebirthMult(profile.rebirths) * levelDamageMult(level),
  )
}

/**
 * Max health does not grow with level: it comes from the armor you forge (plus
 * the Vitality upgrade and Tough Skin), so getting tankier means crafting.
 */
export function computeMaxHp(profile, equippedArmor) {
  let hp = BASE_HP + (profile.upgrades?.vitality || 0) * 25 + (equippedArmor?.hp || 0)
  if (profile.extraSkill === 'tough') hp *= 1.4
  return Math.floor(hp)
}

/** Weighted random pick from [{ weight }] or { key: weight }. */
export function weightedPick(entries, rand = Math.random) {
  const list = Array.isArray(entries) ? entries : Object.entries(entries).map(([k, w]) => ({ k, weight: w }))
  const total = list.reduce((s, e) => s + e.weight, 0)
  let r = rand() * total
  for (const e of list) {
    r -= e.weight
    if (r <= 0) return e.k ?? e
  }
  const last = list[list.length - 1]
  return last.k ?? last
}

/** Rarity odds for a given forge multiplier. Higher multiplier → rarer loot. */
export function rarityWeights(multiplier) {
  const m = Math.max(0.3, multiplier)
  return {
    Common: 100,
    UnCommon: 30 * m,
    Rare: 6 * Math.pow(m, 1.5),
    Epic: 1 * Math.pow(m, 2),
    Legendary: 0.12 * Math.pow(m, 2.3),
    Mythic: 0.02 * Math.pow(m, 2.6),
    Eternal: 0.003 * Math.pow(m, 2.8),
    Secret: 0.0004 * Math.pow(m, 3),
  }
}

/** Percent chance per rarity, for the forge preview. */
export function rarityChances(multiplier) {
  const w = rarityWeights(multiplier)
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, (v / total) * 100]))
}
