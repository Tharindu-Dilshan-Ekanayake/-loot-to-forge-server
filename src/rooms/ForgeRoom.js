import { Room } from '@colyseus/core'
import { StateView } from '@colyseus/schema'

import { allProfiles, getProfile, markDirty, newUid } from '../game/profiles.js'
import {
  ARMOR_CLASS_ODDS,
  ARMOR_CLASSES,
  ARMORS,
  bagById,
  bagLevel,
  BAG_UPGRADE,
  bagUpgradeCost,
  BAGS,
  capacityFor,
  computeDamage,
  computeMaxHp,
  CLICK_POWER,
  DUMMIES,
  ENCHANT_COST,
  ENCHANTS,
  enemyStats,
  EVENT_ORES,
  eventOrePos,
  EXTRA_SKILL_COST,
  EXTRA_SKILLS,
  FORGE_WEAPON_CHOICES,
  giftCoins,
  HUB,
  levelFromPower,
  MAX_PLAYERS_PER_ROOM,
  mitigate,
  MAX_WEAPONS,
  ONLINE_REWARD_MS,
  ORES,
  QUESTS,
  RACE_SPIN_COST,
  RACES,
  RARITIES,
  RARITY_INDEX,
  rarityWeights,
  rebirthLevelReq,
  rebirthMult,
  rollLoot,
  SHOP_ITEMS,
  skillFor,
  stageAt,
  stageLock,
  stageBounds,
  stageById,
  STAGES,
  START_POWER,
  upgradeCost,
  UPGRADES,
  WEAPON_CLASS_ODDS,
  WEAPON_CLASSES,
  WEAPONS,
  weightedPick,
} from '../shared/gameData.js'
import { EnemyState, GameState, OreState, PlayerState } from './schema.js'

const TICK_MS = 50
/** Armor is the main source of max health, so it rolls a generous amount. */
const ARMOR_HP_SHARE = 2.5
const ATTACK_COOLDOWN_S = 0.42
const ATTACK_RANGE = 6
const ORE_RESPAWN_MS = 20_000
/** No teleporting out while an enemy has hit you this recently. */
const COMBAT_LOCK_MS = 4_000
/** Past this distance a charging enemy runs faster, so it reaches you quickly. */
const CHARGE_DIST = 18
const CHARGE_BOOST = 1.6
const REGEN_DELAY_MS = 5_000
const WORLD_LIMIT = 2000
const PROJECTILE_SPEED = 17
/** How close a shot has to land to where the player now stands to hit. */
const PROJECTILE_HIT_RADIUS = 2.2
/** Server-side pickup reach; generous, since the client picks within ~3.5. */
const PICKUP_RANGE = 7
/** Loot left on the ground waits this long, so a trip to the lobby doesn't lose it. */
const DROP_LIFE_MS = 20 * 60_000

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback)

function sanitizeName(raw) {
  const s = String(raw || '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 20)
  return s || `Player${1000 + Math.floor(Math.random() * 9000)}`
}

/**
 * One 8-player world: the hub, the forge and all dungeon stages.
 *
 * The server owns every number that matters (damage, hp, loot, currency). Clients
 * own only their own movement, which is clamped to the world and trusted — the game
 * is co-op, so the anti-cheat budget goes into the economy rather than positions.
 */
/** Key for one player's copy of one stage, in `stageRespawn` and `stageEnemies`. */
const stageKey = (sid, stageId) => `${sid}:${stageId}`

export class ForgeRoom extends Room {
  maxClients = MAX_PLAYERS_PER_ROOM

  onCreate() {
    this.setState(new GameState())
    this.state.leaderboard = '{}'

    /** sessionId -> { profile, client, cooldowns, contributors… } */
    this.sessions = new Map()
    /** enemy id -> server-only AI bookkeeping */
    this.ai = new Map()
    /** ore/enemy id -> Map<sessionId, damage> for shared rewards */
    this.contrib = new Map()

    this.spawnWorld()

    const now = Date.now()
    for (const ev of EVENT_ORES) this.state.events.set(ev.ore, now + ev.everyMs)

    this.registerMessages()
    this.setSimulationInterval((dt) => this.tick(dt / 1000), TICK_MS)
    this.clock.setInterval(() => this.refreshLeaderboard(), 10_000)
    this.refreshLeaderboard()
  }

  /* ------------------------------------------------------------------------
   * Lifecycle
   * ---------------------------------------------------------------------- */

  onJoin(client, options = {}) {
    const name = sanitizeName(options.name)
    const key = String(options.key || `guest:${client.sessionId}`).slice(0, 80)
    const profile = getProfile(key, name)

    const player = new PlayerState()
    player.name = name
    ;[player.x, player.y, player.z] = HUB.spawn
    player.ry = Math.PI
    player.avatar = typeof options.avatar === 'string' ? options.avatar.slice(0, 600) : ''
    player.pfp = typeof options.pfp === 'string' && /^https:\/\//.test(options.pfp) ? options.pfp.slice(0, 400) : ''
    this.state.players.set(client.sessionId, player)

    const session = {
      client,
      profile,
      player,
      lastAttack: 0,
      skillReadyAt: 0,
      lastHurt: 0,
      lastMove: Date.now(),
      dirty: true,
      /** Loot waiting on the ground for this player: id -> { ore, x, z, expires }. */
      drops: new Map(),
      lastLockedToast: 0,
    }
    this.sessions.set(client.sessionId, session)
    // What this client is sent of the filtered maps: its own dungeon, and the
    // event ores everyone shares.
    client.view = new StateView()
    for (const o of this.state.ores.values()) if (o.event) client.view.add(o)
    this.spawnDungeonFor(client.sessionId)
    this.applyStats(session)
    player.hp = player.maxHp

    client.send('welcome', { serverNow: Date.now(), sessionId: client.sessionId })
    this.broadcast('announce', { text: `${name} joined the game`, kind: 'join' }, { except: client })
  }

  onLeave(client) {
    const s = this.sessions.get(client.sessionId)
    if (s) this.broadcast('announce', { text: `${s.player.name} left the game`, kind: 'leave' })
    this.sessions.delete(client.sessionId)
    this.state.players.delete(client.sessionId)
    this.despawnDungeonFor(client.sessionId)
    markDirty()
  }

  /* ------------------------------------------------------------------------
   * World setup
   * ---------------------------------------------------------------------- */

  spawnWorld() {
    /** `${owner}:${stage}` -> enemy ids, so per-stage checks don't scan every enemy. */
    this.stageEnemies = new Map()
    this.dropSeq = 0
  }

  /**
   * Every player gets a private copy of the whole dungeon: their own enemies, ore
   * nodes and stage clears, tagged with their session id. Nobody else can see,
   * hit or steal them, and each copy respawns on its owner's own timer. Only
   * event ores stay shared, for everyone to mine together.
   */
  spawnDungeonFor(sid) {
    const view = this.sessions.get(sid)?.client.view
    for (const stage of STAGES) {
      const list = []
      this.stageEnemies.set(stageKey(sid, stage.id), list)
      stage.enemies.forEach(([kind, ox, oz, tag], i) => {
        const id = `${sid}_e${stage.id}_${i}`
        list.push(id)
        const type = enemyStats(kind, tag === 'elite')
        const e = new EnemyState()
        e.kind = kind
        e.owner = sid
        e.elite = tag === 'elite'
        e.stage = stage.id
        e.x = stage.center[0] + ox
        e.z = stage.center[1] + oz
        e.ry = 0
        e.maxHp = type.hp
        e.hp = type.hp
        e.alive = true
        this.state.enemies.set(id, e)
        view?.add(e)
        this.ai.set(id, {
          homeX: e.x,
          homeZ: e.z,
          cooldown: 1 + Math.random(),
          wanderX: e.x,
          wanderZ: e.z,
          wanderIn: Math.random() * 3,
        })
      })
      stage.ores.forEach(([type, ox, oz], i) => {
        const o = new OreState()
        o.type = type
        o.owner = sid
        o.stage = stage.id
        o.x = stage.center[0] + ox
        o.z = stage.center[1] + oz
        o.maxHp = ORES[type].hp
        o.hp = o.maxHp
        o.alive = true
        o.event = false
        o.timer = 0
        this.state.ores.set(`${sid}_o${stage.id}_${i}`, o)
        view?.add(o)
      })
      this.state.stageRespawn.set(stageKey(sid, stage.id), 0)
    }
  }

  despawnDungeonFor(sid) {
    for (const stage of STAGES) {
      for (const id of this.stageEnemies.get(stageKey(sid, stage.id)) || []) {
        this.state.enemies.delete(id)
        this.ai.delete(id)
        this.contrib.delete(id)
      }
      this.stageEnemies.delete(stageKey(sid, stage.id))
      this.state.stageRespawn.delete(stageKey(sid, stage.id))
    }
    for (const [id, o] of this.state.ores) if (o.owner === sid) this.state.ores.delete(id)
  }

  /* ------------------------------------------------------------------------
   * Derived stats
   * ---------------------------------------------------------------------- */

  equippedItem(profile, slot) {
    const uid = profile.equipped[slot]
    return uid ? profile.items.find((i) => i.uid === uid) : null
  }

  /** Recomputes damage/level/hp from the profile and mirrors them into the schema. */
  applyStats(session) {
    const { profile, player } = session
    const weapon = this.equippedItem(profile, 'weapon')
    const armor = this.equippedItem(profile, 'armor')
    const lvl = levelFromPower(profile.power)
    const maxHp = computeMaxHp(profile, armor)

    player.weapon = weapon?.id || ''
    player.enchant = weapon?.enchant || ''
    player.armor = armor?.id || ''
    player.damage = computeDamage(profile, weapon)
    player.level = lvl.level
    player.maxHp = maxHp
    player.hp = Math.min(player.hp || maxHp, maxHp)
    player.rebirths = profile.rebirths
    player.race = profile.race
    player.bag = profile.bag
    session.dirty = true
  }

  capacityOf(profile) {
    return capacityFor(profile)
  }

  /**
   * `sid`'s copy of a stage is cleared while its respawn countdown runs: gate
   * and ores open for them.
   */
  stageCleared(sid, stageId) {
    return (this.state.stageRespawn.get(stageKey(sid, stageId)) || 0) > 0
  }

  /** What the owning client sees: the profile plus everything derived from it. */
  profileView(session) {
    const { profile, player } = session
    const lvl = levelFromPower(profile.power)
    const weapon = this.equippedItem(profile, 'weapon')
    return {
      name: profile.name,
      coins: profile.coins,
      gems: profile.gems,
      power: profile.power,
      rebirths: profile.rebirths,
      race: profile.race,
      extraSkill: profile.extraSkill,
      x2: profile.x2,
      upgrades: profile.upgrades,
      ores: profile.ores,
      items: profile.items,
      equipped: profile.equipped,
      discovered: profile.discovered,
      quests: profile.quests,
      stats: profile.stats,
      giftAt: profile.giftAt,
      capacity: this.capacityOf(profile),
      bag: profile.bag,
      bags: profile.bags,
      bagLevels: profile.bagLevels,
      maxStage: profile.maxStage,
      level: lvl.level,
      levelInto: lvl.into,
      levelNeed: lvl.need,
      damage: player.damage,
      maxHp: player.maxHp,
      weaponId: weapon?.id || '',
      skillReadyAt: session.skillReadyAt,
      rebirthReq: rebirthLevelReq(profile.rebirths),
    }
  }

  toast(client, text, kind = 'info') {
    client.send('toast', { text, kind })
  }

  /* ------------------------------------------------------------------------
   * Rewards
   * ---------------------------------------------------------------------- */

  grantPower(session, amount) {
    const { profile, player } = session
    const before = levelFromPower(profile.power).level
    profile.power += amount * rebirthMult(profile.rebirths) * (profile.x2 ? 2 : 1)
    const after = levelFromPower(profile.power).level
    this.applyStats(session)
    // Levelling up adds damage only (see levelDamageMult): health comes from armor.
    if (after > before) this.broadcast('levelup', { id: session.client.sessionId, level: after })
    markDirty()
  }

  bumpQuest(session, id, amount = 1) {
    const q = session.profile.quests[id]
    if (q) q.progress = Math.min(q.target, q.progress + amount)
  }

  addOre(session, type) {
    const { profile } = session
    if (profile.ores.length >= this.capacityOf(profile)) return false
    profile.ores.push({ uid: newUid(), type })
    session.dirty = true
    markDirty()
    return true
  }

  /* ------------------------------------------------------------------------
   * Combat
   * ---------------------------------------------------------------------- */

  /** One hit from `session` on a target; returns the damage dealt or 0. */
  hitTarget(session, kind, id, multiplier = 1) {
    const { profile, player } = session
    let dmg = player.damage * multiplier
    let crit = false
    if (profile.extraSkill === 'crit' && Math.random() < 0.15) {
      dmg *= 2
      crit = true
    }
    dmg = Math.max(1, Math.floor(dmg))

    if (kind === 'dummy') {
      const dummy = DUMMIES.find((d) => d.id === id)
      if (!dummy) return 0
      if (profile.rebirths < dummy.rebirths) {
        this.toast(session.client, `Requires ${dummy.rebirths} rebirths!`, 'error')
        return 0
      }
      this.grantPower(session, dummy.mult * multiplier)
      this.bumpQuest(session, 'train')
      this.broadcast('hit', { kind, id, x: dummy.pos[0], z: dummy.pos[2], amount: dmg, crit, by: session.client.sessionId })
      return dmg
    }

    if (kind === 'enemy') {
      const e = this.state.enemies.get(id)
      if (!e || !e.alive || e.owner !== session.client.sessionId) return 0
      // Armour soaks a flat amount per hit: weak weapons barely scratch later stages.
      dmg = mitigate(dmg, enemyStats(e.kind, e.elite).def)
      e.hp = Math.max(0, e.hp - dmg)
      this.addContribution(id, session.client.sessionId, dmg)
      // Everyone gets it: other players see the blade land (their own copy of the
      // stage has no such enemy, so they draw just the impact).
      this.broadcast('hit', { kind, id, x: e.x, z: e.z, amount: dmg, crit, by: session.client.sessionId })
      const ai = this.ai.get(id)
      if (ai) ai.target = session.client.sessionId
      if (profile.extraSkill === 'vampire') player.hp = Math.min(player.maxHp, player.hp + dmg * 0.04)
      if (e.hp <= 0) this.killEnemy(id, e, session)
      return dmg
    }

    if (kind === 'ore') {
      const o = this.state.ores.get(id)
      if (!o || !o.alive) return 0
      if (!o.event && o.owner !== session.client.sessionId) return 0
      // Event ores are shared, but each player unlocks them by clearing that stage.
      const lockedBy = o.event ? session.client.sessionId : o.owner
      if (!this.stageCleared(lockedBy, o.stage)) {
        // Rate-limited: a skill can hit several locked nodes in one go.
        if (Date.now() - session.lastLockedToast > 1500) {
          session.lastLockedToast = Date.now()
          this.toast(session.client, 'Defeat every enemy to unlock the ores!', 'error')
        }
        return 0
      }
      if (!o.event && profile.ores.length >= this.capacityOf(profile)) {
        this.toast(session.client, 'Backpack full! Sell or forge your ores.', 'error')
        session.client.send('backpackFull', {})
        return 0
      }
      o.hp = Math.max(0, o.hp - dmg)
      this.addContribution(id, session.client.sessionId, dmg)
      const hit = { kind, id, x: o.x, z: o.z, amount: dmg, crit, by: session.client.sessionId }
      if (o.event) this.broadcast('hit', hit)
      else session.client.send('hit', hit)
      if (o.hp <= 0) this.mineOre(id, o, session)
      return dmg
    }
    return 0
  }

  addContribution(id, sessionId, dmg) {
    let m = this.contrib.get(id)
    if (!m) this.contrib.set(id, (m = new Map()))
    m.set(sessionId, (m.get(sessionId) || 0) + dmg)
  }

  /** Everyone who dealt at least `minShare` of the target's health. */
  contributors(id, maxHp, minShare) {
    const m = this.contrib.get(id)
    this.contrib.delete(id)
    if (!m) return []
    return [...m.entries()]
      .filter(([, dmg]) => dmg >= maxHp * minShare)
      .map(([sid]) => this.sessions.get(sid))
      .filter(Boolean)
  }

  killEnemy(id, e, killer) {
    e.alive = false
    e.moving = false
    const type = enemyStats(e.kind, e.elite)
    const helpers = this.contributors(id, e.maxHp, 0.05)
    if (!helpers.includes(killer)) helpers.push(killer)

    for (const s of helpers) {
      this.grantPower(s, type.reward)
      s.profile.coins += type.coins
      s.profile.stats.kills += 1
      this.bumpQuest(s, 'kill')
      s.dirty = true
    }

    // Loot from the stage's table goes to the killer, on the ground to pick up.
    // Elites and bosses roll more often, luckier, and may drop the next tier.
    const tier = type.boss ? 'boss' : e.elite ? 'elite' : 'normal'
    for (const ore of rollLoot(e.stage, tier)) this.spawnDrop(killer, ore, e.x, e.z)

    killer.client.send('kill', { id, x: e.x, z: e.z, kind: e.kind, elite: e.elite, boss: Boolean(type.boss), by: killer.client.sessionId })
  }

  mineOre(id, o, miner) {
    o.alive = false
    const recipients = o.event ? this.contributors(id, o.maxHp, 0.03) : [miner]
    if (o.event && !recipients.includes(miner)) recipients.push(miner)
    if (!o.event) this.contrib.delete(id)

    // The ore pops out onto the ground; each recipient picks up their own with E.
    for (const s of recipients) {
      this.spawnDrop(s, o.type, o.x, o.z)
      s.profile.stats.mined += 1
      this.bumpQuest(s, 'mine')
      if (s.profile.extraSkill === 'lucky' && Math.random() < 0.2) this.spawnDrop(s, o.type, o.x, o.z, true)
      s.dirty = true
    }

    const mined = { id, x: o.x, z: o.z, type: o.type }
    if (o.event) this.broadcast('mined', mined)
    else miner.client.send('mined', mined)
    if (o.event) {
      this.state.ores.delete(id)
    } else {
      o.timer = Date.now() + ORE_RESPAWN_MS
    }
  }

  /* ------------------------------------------------------------------------
   * Loot on the ground
   * ---------------------------------------------------------------------- */

  /**
   * Drops an ore near (x, z) that only `session` sees and can pick up. `land`
   * pins where it comes to rest; otherwise it scatters around the source.
   */
  spawnDrop(session, ore, x, z, bonus = false, land = null) {
    const id = `d${(this.dropSeq += 1)}`
    const a = Math.random() * Math.PI * 2
    const r = 1.4 + Math.random() * 1.6
    let dx = land ? land[0] : x + Math.cos(a) * r
    let dz = land ? land[1] : z + Math.sin(a) * r
    const stage = stageAt(x, z)
    if (stage) {
      const b = stageBounds(stage)
      dx = clamp(dx, b.x0 + 1.5, b.x1 - 1.5)
      dz = clamp(dz, b.zNorth + 1.5, b.zSouth - 1.5)
    }
    session.drops.set(id, { ore, x: dx, z: dz, expires: Date.now() + DROP_LIFE_MS })
    session.client.send('drop', { id, ore, x: dx, z: dz, fromX: x, fromZ: z, bonus })
  }

  handlePickup(s, m) {
    const ids = Array.isArray(m.ids) ? m.ids.slice(0, 20).map(String) : []
    const picked = []
    let full = false
    for (const id of ids) {
      const d = s.drops.get(id)
      if (!d) continue
      if (dist2d(s.player.x, s.player.z, d.x, d.z) > PICKUP_RANGE) continue
      if (!this.addOre(s, d.ore)) {
        full = true
        break
      }
      s.drops.delete(id)
      picked.push({ id, ore: d.ore })
    }
    if (picked.length) s.client.send('picked', { items: picked })
    if (full) {
      this.toast(s.client, 'Backpack full! Sell, forge or get a bigger bag.', 'error')
      s.client.send('backpackFull', {})
    }
  }

  /* ------------------------------------------------------------------------
   * Simulation
   * ---------------------------------------------------------------------- */

  tick(dt) {
    const now = Date.now()

    // Enemies only run AI while their owner is in their stage; the rest heal up.
    for (const [id, e] of this.state.enemies) {
      if (!e.alive) continue
      if (this.state.players.get(e.owner)?.stage === e.stage) this.stepEnemy(id, e, dt, now)
      else {
        e.moving = false
        if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.1 * dt)
      }
    }

    // Stage clear, per player: once every enemy in your copy is down, its gate
    // and ores unlock for you.
    for (const [sid, s] of this.sessions) {
      for (const stage of STAGES) {
        const key = stageKey(sid, stage.id)
        const at = this.state.stageRespawn.get(key)
        const anyAlive = this.stageEnemies.get(key).some((id) => this.state.enemies.get(id).alive)
        // It stays cleared (gate open, ores free) until you walk back in: see enterStage.
        if (!anyAlive && !at) {
          this.state.stageRespawn.set(key, now)
          s.client.send('stageClear', { stage: stage.id })
        }
      }
    }

    for (const [id, o] of this.state.ores) {
      if (o.event) {
        if (now >= o.timer) {
          this.state.ores.delete(id)
          this.contrib.delete(id)
        }
      } else if (!o.alive && now >= o.timer) {
        o.hp = o.maxHp
        o.alive = true
        o.timer = 0
      }
    }

    for (const ev of EVENT_ORES) {
      const next = this.state.events.get(ev.ore)
      if (now >= next) {
        this.spawnEventOre(ev, now)
        this.state.events.set(ev.ore, now + ev.everyMs)
      }
    }

    for (const s of this.sessions.values()) {
      const { profile, player } = s
      if (s.drops.size && now - (s.lastDropSweep || 0) > 1000) {
        s.lastDropSweep = now
        const gone = []
        for (const [id, d] of s.drops) if (now >= d.expires) gone.push(id)
        for (const id of gone) s.drops.delete(id)
        if (gone.length) s.client.send('dropGone', { ids: gone })
      }
      profile.playtimeMs += dt * 1000
      if (now - s.lastHurt > REGEN_DELAY_MS && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.08 * dt)
      }
      if (s.dirty) {
        s.dirty = false
        s.client.send('profile', this.profileView(s))
      }
    }
  }

  spawnEventOre(ev, now) {
    const id = `ev_${ev.ore}`
    if (this.state.ores.has(id)) return
    // A random stage in the ore's range, not one already holding another event ore.
    const taken = new Set([...this.state.ores.values()].filter((x) => x.event && x.alive).map((x) => x.stage))
    const [lo, hi] = ev.stages
    const open = []
    for (let id = lo; id <= hi; id += 1) if (!taken.has(id) && stageById(id)) open.push(id)
    if (!open.length) return
    const stage = open[Math.floor(Math.random() * open.length)]
    const [x, z] = eventOrePos(stage)
    const o = new OreState()
    o.type = ev.ore
    o.stage = stage
    o.x = x
    o.z = z
    o.maxHp = ORES[ev.ore].hp
    o.hp = o.maxHp
    o.alive = true
    o.event = true
    o.timer = now + ev.lifeMs
    this.state.ores.set(id, o)
    for (const s of this.sessions.values()) s.client.view?.add(o)
    this.broadcast('announce', {
      text: `A ${ORES[ev.ore].name} (${ev.label}) appeared in Stage ${stage}: ${stageById(stage).name}!`,
      kind: 'event',
      rarity: ORES[ev.ore].rarity,
    })
  }

  /** `sid` has just entered `stageId`: a stage they'd cleared fills back up. */
  enterStage(sid, stageId) {
    const key = stageKey(sid, stageId)
    if (!this.state.stageRespawn.get(key)) return
    this.respawnStage(sid, stageId)
    this.state.stageRespawn.set(key, 0)
  }

  respawnStage(sid, stageId) {
    for (const id of this.stageEnemies.get(stageKey(sid, stageId))) {
      const e = this.state.enemies.get(id)
      const ai = this.ai.get(id)
      e.hp = e.maxHp
      e.alive = true
      e.x = ai.homeX
      e.z = ai.homeZ
      ai.target = null
      this.contrib.delete(id)
    }
  }

  stepEnemy(id, e, dt, now) {
    const ai = this.ai.get(id)
    const type = enemyStats(e.kind, e.elite)
    const reach = 1.4 + type.scale * 0.9
    ai.cooldown -= dt

    // Keep the current target while it stays in this stage; otherwise go for the
    // nearest player in it. The whole stage charges the moment you walk in, and
    // enemies don't give up the chase inside their stage.
    let target = ai.target ? this.state.players.get(ai.target) : null
    if (target && target.stage !== e.stage) {
      target = null
      ai.target = null
    }
    if (!target) {
      // Your enemies only ever come for you.
      const p = this.state.players.get(e.owner)
      if (p?.stage === e.stage) {
        target = p
        ai.target = e.owner
      }
      // A fresh target gets a short wind-up, so the first hit isn't instant.
      if (target) ai.cooldown = Math.max(ai.cooldown, 0.35)
    }

    let goalX
    let goalZ
    let speed = type.speed
    if (target) {
      const d = dist2d(e.x, e.z, target.x, target.z)
      goalX = target.x
      goalZ = target.z
      if (d > CHARGE_DIST) speed *= CHARGE_BOOST
      if (type.ranged) {
        if (d <= type.ranged) {
          e.ry = Math.atan2(target.x - e.x, target.z - e.z)
          if (ai.cooldown <= 0) this.shoot(id, e, type, ai, target, d)
          if (d > 6) {
            e.moving = false
            return
          }
          // Too close: back off while reloading.
          goalX = e.x - (target.x - e.x)
          goalZ = e.z - (target.z - e.z)
          speed *= 0.7
        }
      } else if (d <= reach) {
        e.ry = Math.atan2(target.x - e.x, target.z - e.z)
        e.moving = false
        if (ai.cooldown <= 0) {
          ai.cooldown = type.atkCd * (0.9 + Math.random() * 0.2)
          e.atk = (e.atk + 1) % 65535
          this.hurtPlayer(ai.target, type.dmg, now, e.x, e.z)
        }
        return
      }
    } else {
      // Wander near home; drift back and heal when no one is around.
      ai.wanderIn -= dt
      if (ai.wanderIn <= 0) {
        ai.wanderIn = 2 + Math.random() * 4
        ai.wanderX = ai.homeX + (Math.random() - 0.5) * 8
        ai.wanderZ = ai.homeZ + (Math.random() - 0.5) * 8
      }
      goalX = ai.wanderX
      goalZ = ai.wanderZ
      speed *= 0.4
      if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.1 * dt)
    }

    const dx = goalX - e.x
    const dz = goalZ - e.z
    const d = Math.hypot(dx, dz)
    if (d > 0.3) {
      const step = Math.min(d, speed * dt)
      e.x += (dx / d) * step
      e.z += (dz / d) * step
      // Archers backing off keep facing their target.
      if (!type.ranged || !target) e.ry = Math.atan2(dx, dz)
      e.moving = true
    } else {
      e.moving = false
    }

    // Keep enemies apart and inside their stage.
    for (const oid of this.stageEnemies.get(stageKey(e.owner, e.stage))) {
      const o = this.state.enemies.get(oid)
      if (oid === id || !o.alive) continue
      const sx = e.x - o.x
      const sz = e.z - o.z
      const sd = Math.hypot(sx, sz)
      const min = 1.2 + (enemyStats(o.kind, o.elite).scale + type.scale) * 0.45
      if (sd > 0 && sd < min) {
        e.x += (sx / sd) * (min - sd) * 0.5
        e.z += (sz / sd) * (min - sd) * 0.5
      }
    }
    const b = stageBounds(e.stage)
    e.x = clamp(e.x, b.x0 + 1.5, b.x1 - 1.5)
    e.z = clamp(e.z, b.zNorth + 2, b.zSouth - 2)
  }

  /** A ranged attack: the shot lands where the player stood, so it can be dodged. */
  shoot(id, e, type, ai, target, d) {
    ai.cooldown = type.atkCd * (0.9 + Math.random() * 0.2)
    e.atk = (e.atk + 1) % 65535
    const sid = ai.target
    const tx = target.x
    const tz = target.z
    const flight = d / PROJECTILE_SPEED
    const fromX = e.x
    const fromZ = e.z
    this.sessions.get(sid)?.client.send('shot', { id, kind: e.kind, x: fromX, z: fromZ, tx, tz, t: flight })
    this.clock.setTimeout(() => {
      const p = this.state.players.get(sid)
      if (p && p.stage === e.stage && dist2d(p.x, p.z, tx, tz) < PROJECTILE_HIT_RADIUS) {
        this.hurtPlayer(sid, type.dmg, Date.now(), fromX, fromZ)
      }
    }, flight * 1000)
  }

  hurtPlayer(sessionId, amount, now, fromX, fromZ) {
    const s = this.sessions.get(sessionId)
    if (!s) return
    const { player } = s
    player.hp = Math.max(0, player.hp - amount)
    s.lastHurt = now
    s.client.send('hurt', { amount, x: fromX, z: fromZ })
    if (player.hp <= 0) {
      player.hp = player.maxHp
      player.stage = 0
      ;[player.x, player.y, player.z] = HUB.spawn
      s.client.send('died', { spawn: HUB.spawn })
      for (const ai of this.ai.values()) if (ai.target === sessionId) ai.target = null
    }
  }

  /* ------------------------------------------------------------------------
   * Messages
   * ---------------------------------------------------------------------- */

  registerMessages() {
    const on = (type, handler) =>
      this.onMessage(type, (client, msg) => {
        const session = this.sessions.get(client.sessionId)
        if (!session) return
        try {
          handler(session, msg || {})
        } catch (err) {
          console.error(`[room] ${type} failed`, err)
        }
      })

    on('move', (s, m) => {
      const p = s.player
      p.x = clamp(num(m.x, p.x), -WORLD_LIMIT, WORLD_LIMIT)
      p.y = clamp(num(m.y, p.y), -50, 200)
      p.z = clamp(num(m.z, p.z), -WORLD_LIMIT, WORLD_LIMIT)
      p.ry = num(m.ry, p.ry)
      p.anim = clamp(Math.floor(num(m.anim)), 0, 2)
      const stage = stageAt(p.x, p.z)
      // Walking into a stage you aren't strong enough for bounces you to the hub.
      // Checked on entry only, so swapping gear mid-stage never throws you out.
      const lock = stage !== p.stage && stage > p.stage ? stageLock(stage, p) : null
      if (lock) {
        this.toast(s.client, `${lock.text}!`, 'error')
        s.client.send('teleport', { pos: HUB.spawn, stage: 0 })
        p.stage = 0
        return
      }
      if (stage > s.profile.maxStage) {
        s.profile.maxStage = stage
        s.dirty = true
        markDirty()
      }
      // Walking in through a stage's entrance barrier (lobby -> 1, or n-1 -> n)
      // refills it if you'd cleared it before. Walking back in from the stage
      // ahead doesn't, so you can go back for loot you left behind.
      if (stage > 0 && stage === p.stage + 1) this.enterStage(s.client.sessionId, stage)
      p.stage = stage
    })

    on('attack', (s, m) => {
      const now = Date.now()
      const cd = ATTACK_COOLDOWN_S * (s.profile.extraSkill === 'swift' ? 0.75 : 1)
      // Allow a little jitter: client timers and network delivery aren't perfectly even.
      if (now - s.lastAttack < cd * 1000 * 0.8) return
      s.lastAttack = now
      s.player.atk = (s.player.atk + 1) % 65535

      // Every swing trains: power (and so damage) grows with each click.
      const powerBefore = s.profile.power
      const damageBefore = s.player.damage
      this.grantPower(s, CLICK_POWER)

      if (m.id && m.kind) {
        const pos = this.targetPos(m.kind, m.id)
        if (pos && dist2d(s.player.x, s.player.z, pos[0], pos[1]) <= ATTACK_RANGE + pos[2]) {
          this.hitTarget(s, m.kind, m.id)
        }
      }
      s.client.send('trained', {
        power: s.profile.power - powerBefore,
        damage: s.player.damage - damageBefore,
      })
    })

    on('skill', (s, m) => {
      const now = Date.now()
      const weapon = this.equippedItem(s.profile, 'weapon')
      const skill = weapon && skillFor(weapon.id)
      if (!skill || now < s.skillReadyAt - 150) return
      s.skillReadyAt = now + skill.cooldown * 1000
      s.player.skill = (s.player.skill + 1) % 65535

      let dirX = num(m.dirX)
      let dirZ = num(m.dirZ, 1)
      const len = Math.hypot(dirX, dirZ) || 1
      dirX /= len
      dirZ /= len
      const ox = num(m.x, s.player.x)
      const oz = num(m.z, s.player.z)
      if (dist2d(ox, oz, s.player.x, s.player.z) > 6) return

      const targets = this.targetsInArea(skill, ox, oz, dirX, dirZ, s.client.sessionId)
      const perHit = skill.percent / 100
      for (const [kind, id] of targets) this.hitTarget(s, kind, id, perHit)

      this.broadcast('skill', { by: s.client.sessionId, key: skill.key, x: ox, z: oz, dirX, dirZ })
      s.dirty = true
    })

    on('forge', (s, m) => this.handleForge(s, m))
    on('equip', (s, m) => this.handleEquip(s, m))
    on('sell', (s, m) => this.handleSell(s, m))
    on('lock', (s, m) => {
      const item = s.profile.items.find((i) => i.uid === m.uid)
      if (item) item.locked = !item.locked
      s.dirty = true
      markDirty()
    })

    on('upgrade', (s, m) => {
      const u = UPGRADES[m.key]
      if (!u) return
      const lvl = s.profile.upgrades[m.key] || 0
      if (lvl >= u.max) return this.toast(s.client, 'Already maxed!', 'error')
      const cost = upgradeCost(m.key, lvl)
      if (s.profile.coins < cost) return this.toast(s.client, 'Not enough coins!', 'error')
      s.profile.coins -= cost
      s.profile.upgrades[m.key] = lvl + 1
      this.applyStats(s)
      this.toast(s.client, `${u.name} upgraded!`, 'success')
      s.client.send('fx', { kind: 'upgrade' })
      markDirty()
    })

    on('enchant', (s) => {
      const weapon = this.equippedItem(s.profile, 'weapon')
      if (!weapon) return this.toast(s.client, 'Equip a weapon first!', 'error')
      if (s.profile.coins < ENCHANT_COST) return this.toast(s.client, 'Not enough coins!', 'error')
      s.profile.coins -= ENCHANT_COST
      const e = weightedPick(ENCHANTS)
      weapon.enchant = e.id
      this.applyStats(s)
      s.client.send('rolled', { what: 'enchant', id: e.id })
      markDirty()
    })

    on('race', (s) => {
      if (s.profile.coins < RACE_SPIN_COST) return this.toast(s.client, 'Not enough coins!', 'error')
      s.profile.coins -= RACE_SPIN_COST
      const r = weightedPick(RACES)
      s.profile.race = r.id
      this.applyStats(s)
      s.client.send('rolled', { what: 'race', id: r.id })
      markDirty()
    })

    on('extraSkill', (s) => {
      if (s.profile.coins < EXTRA_SKILL_COST) return this.toast(s.client, 'Not enough coins!', 'error')
      s.profile.coins -= EXTRA_SKILL_COST
      const x = weightedPick(EXTRA_SKILLS)
      s.profile.extraSkill = x.id
      this.applyStats(s)
      s.client.send('rolled', { what: 'extraSkill', id: x.id })
      markDirty()
    })

    on('rebirth', (s) => {
      const lvl = levelFromPower(s.profile.power).level
      const req = rebirthLevelReq(s.profile.rebirths)
      if (lvl < req) return this.toast(s.client, `Reach level ${req} to rebirth!`, 'error')
      s.profile.rebirths += 1
      s.profile.power = START_POWER
      this.applyStats(s)
      s.player.hp = s.player.maxHp
      this.broadcast('rebirth', { id: s.client.sessionId, rebirths: s.profile.rebirths })
      markDirty()
    })

    on('buy', (s, m) => this.handleBuy(s, m))

    on('claimQuest', (s, m) => {
      const def = QUESTS.find((q) => q.id === m.id)
      const q = s.profile.quests[m.id]
      if (!def || !q || q.progress < q.target) return
      const coins = Math.round(def.coins * (1 + q.tier * 0.5))
      s.profile.coins += coins
      q.tier += 1
      q.progress = 0
      q.target = Math.round(def.target * Math.pow(1.5, q.tier))
      s.dirty = true
      s.client.send('fx', { kind: 'reward' })
      this.toast(s.client, `Quest complete! +${coins} coins`, 'success')
      markDirty()
    })

    on('claimOnline', (s) => {
      if (Date.now() - s.profile.giftAt < ONLINE_REWARD_MS) return
      const coins = giftCoins(s.profile.rebirths)
      s.profile.giftAt = Date.now()
      s.profile.onlineClaims += 1
      s.profile.coins += coins
      s.dirty = true
      s.client.send('fx', { kind: 'reward' })
      this.toast(s.client, `Free gift: +${coins} coins!`, 'success')
      markDirty()
    })

    on('teleport', (s, m) => {
      const stage = Math.floor(num(m.stage))
      const def = stageById(stage)
      if (Date.now() - s.lastHurt < COMBAT_LOCK_MS) {
        return this.toast(s.client, "Can't teleport in the middle of a fight!", 'error')
      }
      if (def) {
        const lock = stageLock(stage, s.player)
        if (lock) return this.toast(s.client, `${lock.text}!`, 'error')
        // The Frostbound Tower counts as reaching its stage.
        const tower = stage === HUB.tower.stage && s.profile.rebirths >= HUB.tower.rebirths
        if (stage > s.profile.maxStage && !tower) return this.toast(s.client, 'Reach this stage on foot first!', 'error')
      }
      // Teleporting into a stage counts as entering it.
      if (def && s.player.stage !== stage) this.enterStage(s.client.sessionId, stage)
      s.player.stage = def ? stage : 0
      s.client.send('teleportOk', { stage: s.player.stage })
    })

    on('pickup', (s, m) => this.handlePickup(s, m))

    on('buyBag', (s, m) => {
      const bag = BAGS.find((b) => b.id === m.id)
      if (!bag) return
      const { profile } = s
      if (profile.bags.includes(bag.id)) return this.toast(s.client, 'Already owned!', 'error')
      const wallet = bag.currency === 'gems' ? 'gems' : 'coins'
      if (profile[wallet] < bag.price) return this.toast(s.client, `Not enough ${wallet}!`, 'error')
      profile[wallet] -= bag.price
      profile.bags.push(bag.id)
      profile.bag = bag.id
      this.applyStats(s)
      s.client.send('fx', { kind: 'purchase' })
      s.client.send('bagEquipped', { id: bag.id, bought: true })
      markDirty()
    })

    on('upgradeBag', (s, m) => {
      const { profile } = s
      if (!profile.bags.includes(m.id)) return this.toast(s.client, 'Buy this bag first!', 'error')
      const bag = bagById(m.id)
      const lvl = bagLevel(profile, bag.id)
      if (lvl >= BAG_UPGRADE.max) return this.toast(s.client, 'Already maxed!', 'error')
      const cost = bagUpgradeCost(bag, lvl)
      if (profile.coins < cost) return this.toast(s.client, 'Not enough coins!', 'error')
      profile.coins -= cost
      profile.bagLevels = { ...profile.bagLevels, [bag.id]: lvl + 1 }
      this.applyStats(s)
      this.toast(s.client, `${bag.name} upgraded to Lv. ${lvl + 1}!`, 'success')
      s.client.send('fx', { kind: 'upgrade' })
      markDirty()
    })

    on('equipBag', (s, m) => {
      if (!s.profile.bags.includes(m.id)) return
      s.profile.bag = bagById(m.id).id
      this.applyStats(s)
      s.client.send('bagEquipped', { id: s.profile.bag })
      markDirty()
    })

    on('avatar', (s, m) => {
      if (typeof m.avatar === 'string') s.player.avatar = m.avatar.slice(0, 600)
    })
  }

  targetPos(kind, id) {
    if (kind === 'enemy') {
      const e = this.state.enemies.get(id)
      return e?.alive ? [e.x, e.z, enemyStats(e.kind, e.elite).scale] : null
    }
    if (kind === 'ore') {
      const o = this.state.ores.get(id)
      return o?.alive ? [o.x, o.z, o.event ? 2.5 : 1] : null
    }
    if (kind === 'dummy') {
      const d = DUMMIES.find((x) => x.id === id)
      return d ? [d.pos[0], d.pos[2], 1] : null
    }
    return null
  }

  /** Everything `sid` could hit with a skill: their own enemies and ores only. */
  targetsInArea(skill, ox, oz, dirX, dirZ, sid) {
    const out = []
    const consider = (kind, id, x, z, size) => {
      if (skill.range && skill.key === 'dash') {
        // Distance from the dash segment.
        const t = clamp((x - ox) * dirX + (z - oz) * dirZ, 0, skill.range)
        const px = ox + dirX * t
        const pz = oz + dirZ * t
        if (dist2d(x, z, px, pz) <= 2.2 + size) out.push([kind, id])
      } else if (skill.key === 'flurry') {
        if (dist2d(x, z, ox, oz) <= skill.range + size) out.push([kind, id, dist2d(x, z, ox, oz)])
      } else if (dist2d(x, z, ox, oz) <= skill.radius + size) {
        out.push([kind, id])
      }
    }
    for (const [id, e] of this.state.enemies) {
      if (e.alive && e.owner === sid) consider('enemy', id, e.x, e.z, enemyStats(e.kind, e.elite).scale)
    }
    for (const [id, o] of this.state.ores) {
      if (!o.alive) continue
      if ((o.event || o.owner === sid) && this.stageCleared(sid, o.stage)) consider('ore', id, o.x, o.z, 1)
    }
    for (const d of DUMMIES) consider('dummy', d.id, d.pos[0], d.pos[2], 1)

    if (skill.key === 'flurry') {
      // Flurry focuses the single closest target.
      out.sort((a, b) => a[2] - b[2])
      return out.slice(0, 1)
    }
    return out
  }

  handleForge(s, m) {
    const { profile } = s
    const mode = m.mode === 'armor' ? 'armor' : 'weapon'
    const uids = Array.isArray(m.ores) ? [...new Set(m.ores.map(String))].slice(0, 4) : []
    const picked = uids.map((u) => profile.ores.find((o) => o.uid === u)).filter(Boolean)
    if (picked.length === 0 || picked.length !== uids.length) {
      return this.toast(s.client, 'Put ores into the forge first!', 'error')
    }
    if (profile.items.length >= MAX_WEAPONS) {
      return this.toast(s.client, 'Inventory full! Sell some items.', 'error')
    }

    const multiplier = picked.reduce((sum, o) => sum + ORES[o.type].mult, 0)
    const count = picked.length
    const rarity = weightedPick(rarityWeights(multiplier))
    const rIndex = RARITY_INDEX[rarity]
    const roll = 0.85 + Math.random() * 0.3
    let item

    if (mode === 'weapon') {
      // The player can ask for a Sword or an Axe; otherwise the ore count rolls it.
      const cls = FORGE_WEAPON_CHOICES.includes(m.cls) ? m.cls : weightedPick(WEAPON_CLASS_ODDS[count])
      const choices = Object.values(WEAPONS).filter(
        (w) => w.class === cls && w.rarity === rarity && !w.shopOnly,
      )
      const def = choices[Math.floor(Math.random() * choices.length)]
      const power = Math.round(
        RARITIES[rIndex].base * WEAPON_CLASSES[cls].mult * roll * (1 + multiplier * 0.08),
      )
      item = { uid: newUid(), kind: 'weapon', id: def.id, power, enchant: '', locked: false }
    } else {
      const cls = weightedPick(ARMOR_CLASS_ODDS[count])
      const def = Object.values(ARMORS).find((a) => a.class === cls && a.rarity === rarity)
      const hp = Math.round(
        RARITIES[rIndex].base * ARMOR_HP_SHARE * ARMOR_CLASSES[cls].mult * roll * (1 + multiplier * 0.08),
      )
      item = { uid: newUid(), kind: 'armor', id: def.id, hp, enchant: '', locked: false }
    }

    const isNew = !profile.discovered[item.id]
    profile.discovered[item.id] = true
    profile.ores = profile.ores.filter((o) => !uids.includes(o.uid))
    profile.items.push(item)
    profile.stats.forged += 1
    this.bumpQuest(s, 'forge')
    s.dirty = true
    markDirty()

    s.client.send('forged', { item, isNew, multiplier })
    if (rIndex >= RARITY_INDEX.Legendary) {
      const name = (WEAPONS[item.id] || ARMORS[item.id]).name
      this.broadcast('announce', {
        text: `${s.player.name} forged a ${rarity} ${name}!`,
        kind: 'event',
        rarity,
      })
    }
  }

  handleEquip(s, m) {
    const item = s.profile.items.find((i) => i.uid === m.uid)
    if (!item) return
    const slot = item.kind === 'armor' ? 'armor' : 'weapon'
    // Clicking the equipped armor again takes it off; a weapon is always held.
    s.profile.equipped[slot] = slot === 'armor' && s.profile.equipped.armor === item.uid ? '' : item.uid
    this.applyStats(s)
    markDirty()
  }

  itemPrice(item) {
    return Math.floor((item.power || item.hp || 10) * 2.4)
  }

  handleSell(s, m) {
    const { profile } = s
    let coins = 0

    if (m.what === 'ores') {
      for (const o of profile.ores) coins += ORES[o.type].sell
      profile.ores = []
    } else if (m.what === 'ore') {
      const idx = profile.ores.findIndex((o) => o.uid === m.uid)
      if (idx < 0) return
      coins += ORES[profile.ores[idx].type].sell
      profile.ores.splice(idx, 1)
    } else if (m.what === 'item' || m.what === 'items') {
      const maxRarity = m.what === 'items' ? RARITY_INDEX[m.maxRarity] ?? 0 : Infinity
      const equippedUids = new Set(Object.values(profile.equipped))
      profile.items = profile.items.filter((item) => {
        const def = WEAPONS[item.id] || ARMORS[item.id]
        const sellable =
          !item.locked &&
          !equippedUids.has(item.uid) &&
          (m.what === 'item' ? item.uid === m.uid : RARITY_INDEX[def.rarity] <= maxRarity)
        if (sellable) coins += this.itemPrice(item)
        return !sellable
      })
    }

    if (coins <= 0) return this.toast(s.client, 'Nothing to sell!', 'error')
    profile.coins += coins
    s.dirty = true
    s.client.send('sold', { coins })
    markDirty()
  }

  handleBuy(s, m) {
    const item = SHOP_ITEMS.find((i) => i.id === m.id)
    if (!item) return
    const { profile } = s
    const wallet = item.currency === 'gems' ? 'gems' : 'coins'
    if (profile[wallet] < item.price) {
      return this.toast(s.client, `Not enough ${wallet}!`, 'error')
    }

    if (item.pool) {
      const free = this.capacityOf(profile) - profile.ores.length
      if (free < item.count) return this.toast(s.client, 'Not enough backpack space!', 'error')
      profile[wallet] -= item.price
      const got = []
      for (let i = 0; i < item.count; i += 1) {
        // Weight toward the cheaper end of each crate's pool.
        const weights = item.pool.map((ore, idx) => ({ k: ore, weight: item.pool.length - idx }))
        const ore = weightedPick(weights)
        this.addOre(s, ore)
        got.push(ore)
      }
      s.client.send('crate', { ores: got })
    } else if (item.id === 'x2_power') {
      if (profile.x2) return this.toast(s.client, 'Already owned!', 'error')
      profile[wallet] -= item.price
      profile.x2 = true
      this.toast(s.client, 'x2 Power unlocked!', 'success')
    } else if (item.id === 'nether_bane') {
      if (profile.items.length >= MAX_WEAPONS) return this.toast(s.client, 'Inventory full!', 'error')
      profile[wallet] -= item.price
      const w = { uid: newUid(), kind: 'weapon', id: 'nether_bane', power: WEAPONS.nether_bane.fixedPower, enchant: '', locked: true }
      profile.items.push(w)
      const isNew = !profile.discovered.nether_bane
      profile.discovered.nether_bane = true
      s.client.send('forged', { item: w, isNew, multiplier: 0, bought: true })
    } else if (item.id === 'starter_pack') {
      profile[wallet] -= item.price
      profile.coins += 5000
      // The crates' ores go straight in as far as there is room.
      const pool = SHOP_ITEMS.find((i) => i.id === 'crate_rare').pool
      for (let i = 0; i < 6; i += 1) this.addOre(s, pool[Math.floor(Math.random() * pool.length)])
      this.toast(s.client, 'Starter Pack claimed!', 'success')
    }

    this.applyStats(s)
    s.client.send('fx', { kind: 'purchase' })
    markDirty()
  }

  refreshLeaderboard() {
    const list = [...allProfiles()]
    const top = (score) =>
      list
        .map((p) => [p.name, score(p)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
    this.state.leaderboard = JSON.stringify({
      power: top((p) => p.power),
      rebirths: top((p) => p.rebirths),
      playtime: top((p) => Math.floor(p.playtimeMs / 3_600_000 * 10) / 10),
    })
  }
}
