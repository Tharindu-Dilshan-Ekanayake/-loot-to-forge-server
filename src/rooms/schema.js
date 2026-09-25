import { schema, t } from '@colyseus/schema'

/**
 * Replicated world state. Only what *other* players need to see lives here; each
 * player's private progression (inventory, coins, quests) is sent to its owner as a
 * `profile` message instead, so it never leaks to the rest of the room.
 */

export const PlayerState = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    ry: t.float32(),
    /** 0 idle, 1 run, 2 air. */
    anim: t.uint8(),
    /** Bumped on every swing so remote clients can replay the attack animation. */
    atk: t.uint16().default(0),
    /** Bumped on every skill cast. */
    skill: t.uint16().default(0),
    /** Which of the five combo moves the last swing was, so others see the same move. */
    combo: t.uint8().default(0),
    /** Bumped when the player takes off on a Q leap, so others see the jump-and-strike. */
    leap: t.uint16().default(0),
    weapon: t.string(),
    enchant: t.string(),
    armor: t.string(),
    damage: t.number(),
    level: t.uint16(),
    hp: t.number(),
    maxHp: t.number(),
    rebirths: t.uint16(),
    race: t.string(),
    /** JSON of the player's Bloxity equipped ids, so others see their avatar. */
    avatar: t.string(),
    /** Profile picture URL (Bloxity), '' for guests: tags then use the skin's face. */
    pfp: t.string(),
    /** Dungeon stage the player is standing in, 0 in the hub. */
    stage: t.uint8(),
    /** Worn backpack id, so everyone sees it on the player's back. */
    bag: t.string(),
  },
  'PlayerState',
)

export const EnemyState = schema(
  {
    kind: t.string(),
    stage: t.uint8(),
    x: t.float32(),
    z: t.float32(),
    ry: t.float32(),
    hp: t.number(),
    maxHp: t.number(),
    alive: t.boolean(),
    moving: t.boolean(),
    atk: t.uint16().default(0),
    /** Elite: a tougher, better-looting version of its kind (see ELITE). */
    elite: t.boolean(),
    /** Session that owns this enemy: every player fights their own copy of a stage. */
    owner: t.string(),
  },
  'EnemyState',
)

export const OreState = schema(
  {
    type: t.string(),
    stage: t.uint8(),
    x: t.float32(),
    z: t.float32(),
    hp: t.number(),
    maxHp: t.number(),
    alive: t.boolean(),
    event: t.boolean(),
    /** Session whose private dungeon this node is in; '' for shared event ores. */
    owner: t.string(),
    /** Server epoch ms: when a mined node comes back, or when an event ore vanishes. */
    timer: t.number(),
  },
  'OreState',
)

export const GameState = schema(
  {
    players: t.map(PlayerState),
    /**
     * Filtered per client (StateView): each player only receives their own
     * dungeon's enemies and ores, plus the shared event ores. Everyone else's
     * copies would be hundreds of entities they never draw.
     */
    enemies: t.map(EnemyState).view(),
    ores: t.map(OreState).view(),
    /** stage id -> server epoch ms when its enemies respawn (0 = alive). */
    stageRespawn: t.map('number'),
    /** event ore id -> server epoch ms of its next spawn. */
    events: t.map('number'),
    /** JSON: { power: [[name, value]], rebirths: [...], playtime: [...] } */
    leaderboard: t.string(),
  },
  'GameState',
)
