// Copies the shared game catalog into the client so both sides agree on balance.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'src/shared/gameData.js')
const clientDir = process.env.CLIENT_DIR || join(root, '../loot-to-forge-client')
const to = join(clientDir, 'src/shared/gameData.js')

if (!existsSync(join(clientDir, 'package.json'))) {
  console.error(`Client not found at ${clientDir}. Set CLIENT_DIR.`)
  process.exit(1)
}
copyFileSync(from, to)
console.log(`Copied gameData.js -> ${to}`)
