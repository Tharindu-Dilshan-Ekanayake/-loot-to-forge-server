import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MongoClient } from 'mongodb'

import {
  QUESTS,
  START_POWER,
  STARTER_BAG,
  STARTER_WEAPON,
  STARTER_WEAPON_POWER,
} from '../shared/gameData.js'

/**
 * Player profiles.
 *
 * Two stores behind one API:
 *  - MongoDB, whenever MONGODB_URI is set (Bloxity Legion injects it). One
 *    document per player, loaded when they join and written back while they
 *    play, so any number of server pods share the same progress and nothing is
 *    lost when a pod is scaled away.
 *  - A local JSON file otherwise, for development: the whole map in memory,
 *    flushed to disk every few seconds when something changed.
 */

const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '../../data')
const FILE = join(DATA_DIR, 'profiles.json')
const SAVE_INTERVAL_MS = 10_000

/** Profiles in memory: every profile in file mode, only live players' with Mongo. */
/** @type {Map<string, any>} */
const profiles = new Map()
let dirty = false
let uidCounter = Date.now()
/** @type {import('mongodb').Collection | null} */
let collection = null

export const newUid = () => (uidCounter++).toString(36)

function loadFile() {
  if (!existsSync(FILE)) return
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'))
    for (const [key, p] of Object.entries(raw)) profiles.set(key, migrate(p))
    console.log(`[profiles] loaded ${profiles.size} profiles`)
  } catch (err) {
    console.error('[profiles] failed to read profiles.json, starting empty', err)
  }
}

function saveFile() {
  mkdirSync(DATA_DIR, { recursive: true })
  // Write-then-rename so a crash mid-write can't leave a truncated file.
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(Object.fromEntries(profiles)))
  renameSync(tmp, FILE)
}

const toDoc = (p) => ({ ...p, _id: p.key })
const fromDoc = ({ _id, ...p }) => ({ ...p, key: p.key || _id })

/** Writes the given profiles (default: every one in memory) to the store. */
async function write(list = [...profiles.values()]) {
  if (!collection) return saveFile()
  if (!list.length) return
  await collection.bulkWrite(
    list.map((p) => ({ replaceOne: { filter: { _id: p.key }, replacement: toDoc(p), upsert: true } })),
    { ordered: false },
  )
}

/** Flushes pending changes. Safe to call any time; errors are logged, not thrown. */
export async function saveNow() {
  if (!dirty) return
  dirty = false
  try {
    await write()
  } catch (err) {
    dirty = true
    console.error('[profiles] save failed', err)
  }
}

export const markDirty = () => {
  dirty = true
}

/** Connects the store. Call once before the server starts accepting players. */
export async function initProfiles() {
  const uri = process.env.MONGODB_URI
  if (uri) {
    const client = new MongoClient(uri, { maxPoolSize: 5 })
    await client.connect()
    collection = client.db().collection('profiles')
    await Promise.all([
      collection.createIndex({ power: -1 }),
      collection.createIndex({ rebirths: -1 }),
      collection.createIndex({ playtimeMs: -1 }),
    ])
    console.log('[profiles] using MongoDB')
  } else {
    loadFile()
    console.log('[profiles] using local file', FILE)
  }
  setInterval(saveNow, SAVE_INTERVAL_MS).unref()
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

/** Loads (or creates) a player's profile and keeps it in memory while they play. */
export async function getProfile(key, name) {
  let p = profiles.get(key)
  if (!p && collection) {
    const doc = await collection.findOne({ _id: key })
    if (doc) p = migrate(fromDoc(doc))
  }
  if (!p) {
    p = createProfile(key, name)
    dirty = true
  }
  profiles.set(key, p)
  if (name) p.name = name
  return p
}

/**
 * A player has left: with Mongo, save their profile and drop it from memory
 * (unless they're still connected in another room on this pod).
 */
export async function releaseProfile(key, stillHere = false) {
  if (!collection) return
  const p = profiles.get(key)
  if (!p) return
  try {
    await write([p])
  } catch (err) {
    console.error('[profiles] save on leave failed', err)
    dirty = true
    return
  }
  if (!stillHere) profiles.delete(key)
}

/**
 * The top `n` players by a numeric field, for the leaderboards. Players on this
 * pod count with their live (unsaved) numbers.
 */
export async function topProfiles(field, n) {
  const byKey = new Map()
  if (collection) {
    const docs = await collection
      .find({}, { projection: { name: 1, [field]: 1 } })
      .sort({ [field]: -1 })
      .limit(n)
      .toArray()
    for (const d of docs) byKey.set(d._id, { name: d.name, value: d[field] || 0 })
  }
  for (const p of profiles.values()) byKey.set(p.key, { name: p.name, value: p[field] || 0 })
  return [...byKey.values()].sort((a, b) => b.value - a.value).slice(0, n)
}
