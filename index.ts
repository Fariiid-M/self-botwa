import { Boom } from '@hapi/boom'
import makeWASocket, {
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
} from '@adiwajshing/baileys'
import { pino as MAIN_LOGGER } from './utils/logger'
import { messageHandler } from './src/handler'
import { textSync } from 'figlet'
import dotenv from 'dotenv'
import chalk from 'chalk'

const logger = MAIN_LOGGER.child({})
dotenv.config()
logger.level = 'error'

// Remove the following comment to enable data store.
const store = makeInMemoryStore({ logger })
store?.readFromFile('./env/baileys_store_multi.json')

setInterval(() => {
  store?.writeToFile('./env/baileys_store_multi.json')
}, 10_000)

const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(
    './env/baileys_auth_info'
  )
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(
    chalk.red(
      textSync('SERO SELFBOT', {
        horizontalLayout: 'fitted',
        font: 'Letters',
      })
    )
  )
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const waSocket = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: true,
  })

  // Remove the following comment to enable data store.
  store?.bind(waSocket.ev)

  waSocket.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update']
      const { connection, lastDisconnect } = update
      if (connection === 'close') {
        if (
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          startSock()
        } else {
          console.log('Connection closed. You are logged out.')
        }
      }
      console.log('Connection update:', update)

      if (connection === 'open') {
        console.log(
          chalk.yellow('!---------------BOT IS READY---------------!')
        )
      }
    }

    if (events['creds.update']) {
      await saveCreds()
    }

    if (events.call) {
      console.log('recv call event', events.call)
    }

    // received a new message
    if (events['messages.upsert']) {
      const upsert = events['messages.upsert']
      messageHandler(waSocket, upsert)
    }
  })
}

startSock()
