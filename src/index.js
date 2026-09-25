import { matchMaker, Server } from '@colyseus/core'
import { Encoder } from '@colyseus/schema'
import { WebSocketTransport } from '@colyseus/ws-transport'

import { initProfiles, saveNow } from './game/profiles.js'
import { ForgeRoom } from './rooms/ForgeRoom.js'
import { MAX_PLAYERS_PER_ROOM } from './shared/gameData.js'

const PORT = Number(process.env.PORT) || 2567

// A full room's first sync (8 players with avatars, the leaderboard and event
// ores) can pass the 8 KB default; the encoder would then grow it mid-game.
Encoder.BUFFER_SIZE = 128 * 1024
export const ROOM_NAME = 'forge'

const server = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    // Lets the title screen show live servers ("3/8 players") before joining.
    app.get('/rooms', async (_req, res) => {
      res.set('Access-Control-Allow-Origin', '*')
      const rooms = await matchMaker.query({ name: ROOM_NAME })
      res.json(
        rooms.map((r) => ({
          roomId: r.roomId,
          clients: r.clients,
          maxClients: r.maxClients || MAX_PLAYERS_PER_ROOM,
          locked: Boolean(r.locked),
        })),
      )
    })
    app.get('/health', (_req, res) => res.json({ ok: true }))
  },
})

await initProfiles()

server.define(ROOM_NAME, ForgeRoom)
// SIGTERM (a deploy or scale-down): Colyseus closes the rooms, then everyone's
// progress is written out before the process exits.
server.onShutdown(() => saveNow())

await server.listen(PORT)
console.log(`⚒  Loot to Forge server listening on port ${PORT}`)
