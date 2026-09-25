# Loot to Forge — game server

Colyseus 0.18 backend for **+1 Loot to Forge**. Each `forge` room is one shared world
(hub, forge and all twelve dungeon stages) for up to **8 players**; when every room
is full, the matchmaker opens a new one.

## Run

```bash
npm install
npm run dev      # restarts on file changes
# or
npm start
```

The server listens on `ws://localhost:2567` (set `PORT` to change it).

| Endpoint | What it does |
| --- | --- |
| `GET /rooms` | Live rooms with player counts (the title screen's server list) |
| `GET /health` | Liveness check |

## Layout

```
src/
  index.js              Server bootstrap, HTTP routes, room registration
  rooms/ForgeRoom.js    The game: combat, mining, forging, economy, enemy AI
  rooms/schema.js       Replicated state (players, enemies, ore nodes, timers)
  game/profiles.js      Player progress, saved to data/profiles.json
  shared/gameData.js    Balance + world layout, shared with the client
scripts/sync-data.js    Copies gameData.js into the client
```

## How the game works

The server owns every number that matters: damage, HP, loot rolls and currency.
Clients send intent (`attack`, `skill`, `forge`, `sell`, …) and the server validates
range, cooldowns and cost before applying it.

- **Public state** (everyone sees it) is the Colyseus schema: positions, HP, enemies and ore nodes.
- **Private state** (inventory, coins, quests) goes only to its owner, as a `profile` message.

Player movement is client-authoritative but clamped. The game is co-op, so the
anti-cheat effort goes into the economy rather than into positions.

### The dungeon

- **Layout.** The dungeon is one corridor running north from the castle wall. `DUNGEON`
  and `STAGES` in `gameData.js` place each stage.
- **Clearing a stage.** When a stage's last enemy dies, that stage counts as cleared
  for `STAGE_RESPAWN_S`. It shows up in the state as a non-zero `stageRespawn[stage]`
  and the server broadcasts `stageClear`. While cleared:
  - its gate is open;
  - its ore nodes can be mined;
  - each player can open its chest once, with `openChest`.
- **Unlocking stages.** Entering a stage needs its `requiredDamage` (the stage's
  `recommend` × `STAGE_UNLOCK.damageShare`) and, for deep stages, rebirths; see
  `stageLock`. Clearing the previous stage opens its gate on top of that. Walking
  into a stage you're too weak for bounces you to the lobby. Teleports check the
  same rules, plus the furthest stage you've reached and no recent combat.
- **Enemies.** Stats derive from each kind's hp (`ENEMY_SCALING`): power reward,
  coins and a flat `def` that soaks each hit (`mitigate`). Flag an entry `'elite'` in
  a stage def for a tougher, better-looting version (`ELITE`). Bosses are kinds with
  `boss: true`.
- **AI.** Enemies only run AI in stages that have a player in them. The whole stage
  charges the moment you walk in, running faster from far away. Ranged enemies fire
  `shot`s that land where the player stood, so moving dodges them.
- **Loot drops.** Loot doesn't go straight into the backpack. Mined ores, enemy drops
  and chest ores become private **drops**, sent only to their owner:
  - `drop` creates one;
  - the client sends `pickup` with drop ids;
  - the server checks range and backpack space, then replies `picked`;
  - unclaimed drops expire after 2 minutes (`dropGone`).
  What drops comes from the stage's loot table (`stageLoot` / `rollLoot`): its own
  ores, weighted toward common ones. `DROP_RULES` sets chance, rolls and luck per
  normal, elite, boss and chest. Elites and bosses can drop the next stage's
  rarest ore.
- **Bags.** `buyBag` / `equipBag` set the worn bag. It's replicated as `PlayerState.bag`
  so everyone sees it. Ore capacity is the bag's capacity plus Upgrade-station slots
  (`capacityFor`).

Progress is keyed by the `key` join option: `bloxity:<userId>` when signed in, or a
per-device `guest:<id>`. It is kept in memory and flushed to `data/profiles.json`
every 10 seconds. That's fine for a single process. Before running more than one,
move it to a real database; the key is also taken on trust from the client, so it
should be verified against a Bloxity token at the same time.

## Changing balance

Edit `src/shared/gameData.js` and then run `npm run sync-data` to copy it into
`../loot-to-forge-client/src/shared/gameData.js`. Both sides must agree.
