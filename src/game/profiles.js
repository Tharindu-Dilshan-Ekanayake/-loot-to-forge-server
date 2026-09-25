import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  QUESTS,
  START_POWER,
  STARTER_BAG,
  STARTER_WEAPON,
  STARTER_WEAPON_POWER,
} from '../shared/gameData.js'

/**
 * Player profiles, persisted to a JSON file.
 *
 * Deliberately simple: the whole map lives in memory and is flushed to disk every
 * few seconds when something changed. Fine for one process and a few thousand
 * players; swap for a real database before scaling out to several processes.
 */

const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '../../data')
const FILE = join(DATA_DIR, 'profiles.json')
const SAVE_INTERVAL_MS = 10_000

/** @type {Map<string, any>} */
const profiles = new Map()
let dirty = false
let uidCounter = Date.now()

export const newUid = () => (uidCounter++).toString(36)

function load() {
  if (!existsSync(FILE)) return
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'))
    for (const [key, p] of Object.entries(raw)) profiles.set(key, migrate(p))
    console.log(`[profiles] loaded ${profiles.size} profiles`)
  } catch (err) {
    console.error('[profiles] failed to read profiles.json, starting empty', err)
  }
}

export function saveNow() {
  if (!dirty) return
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    // Write-then-rename so a crash mid-write can't leave a truncated file.
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(profiles)))
    renameSync(tmp, FILE)
    dirty = false
  } catch (err) {
    console.error('[profiles] save failed', err)
  }
}

export const markDirty = () => {
  dirty = true
}

function defaultQuests() {
  return Object.fromEntries(QUESTS.map((q) => [q.id, { progress: 0, target: q.target, tier: 0 }]))
}

function createProfile(key, name) {
  const starter = {
    uid: newUid(),
    kind: 'weapon',
    id: STARTER_WEAPON,
    power: STARTER_WEAPON_POWER,
    enchant: '',
    locked: true,
  }
  return {
    key,
    name,
    createdAt: Date.now(),
    coins: 0,
    gems: 0,
    power: START_POWER,
    rebirths: 0,
    race: 'human',
    extraSkill: '',
    x2: false,
    upgrades: { capacity: 0, vitality: 0 },
    bag: STARTER_BAG,
    bags: [STARTER_BAG],
    /** Upgrade level per owned bag id (see BAG_UPGRADE). */
    bagLevels: {},
    /** Furthest dungeon stage reached; the teleport menu offers up to here. */
    maxStage: 1,
    ores: [],
    items: [starter],
    equipped: { weapon: starter.uid, armor: '' },
    discovered: { [STARTER_WEAPON]: true },
    quests: defaultQuests(),
    stats: { kills: 0, mined: 0, forged: 0 },
    /** When the free gift was last claimed (ms); the next one is ONLINE_REWARD_MS later. */
    giftAt: 0,
    onlineClaims: 0,
    playtimeMs: 0,
  }
}

/** Fills in fields added after a profile was first saved. */
function migrate(p) {
  const d = createProfile(p.key, p.name)
  const out = { ...d, ...p }
  out.upgrades = { ...d.upgrades, ...(p.upgrades || {}) }
  out.stats = { ...d.stats, ...(p.stats || {}) }
  out.quests = { ...d.quests, ...(p.quests || {}) }
  out.equipped = { ...d.equipped, ...(p.equipped || {}) }
  out.bagLevels = { ...(p.bagLevels || {}) }
  delete out.onlineMs
  if (!Array.isArray(out.bags) || !out.bags.includes(STARTER_BAG)) out.bags = [STARTER_BAG, ...(out.bags || [])]
  if (!out.bags.includes(out.bag)) out.bag = STARTER_BAG
  if (!Array.isArray(out.items) || out.items.length === 0) {
    out.items = d.items
    out.equipped = d.equipped
  }
  return out
}

export function getProfile(key, name) {
  let p = profiles.get(key)
  if (!p) {
    p = createProfile(key, name)
    profiles.set(key, p)
    dirty = true
  }
  if (name) p.name = name
  return p
}

export const allProfiles = () => profiles.values()

load()
setInterval(saveNow, SAVE_INTERVAL_MS).unref()
