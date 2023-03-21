import {
  downloadMediaMessage,
  WAMessageContent,
  WAMessage,
  WASocket,
} from '@adiwajshing/baileys'
import dotenv from 'dotenv'
import { config } from '../src/handler'
dotenv.config()

export interface MessageData {
  body: string | null | undefined
  isCmd: boolean
  cmd: string
  prefix: string
  args: string
  from: string
  fromMe: boolean | null | undefined
  name: string | null | undefined
  quotedMsg: WAMessageContent | null | undefined
  isGroup: boolean
  isQuotedImage: boolean | null
  isQuotedVideo: boolean | null
  isQuoted: boolean | null
  isImage: boolean | null
  isVideo: boolean | null
  isMedia: boolean | null
  config: Record<string, any>
  groupName: string | null
  download: () => Promise<Buffer>
  downloadQuoted: () => Promise<Buffer>
  reply: (text: string) => Promise<void>
}

export const serializeMessage = async (waSocket: WASocket, msg: WAMessage) => {
  const data: MessageData = {} as any
  data.body =
    msg?.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.conversation ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg.message?.ephemeralMessage?.message?.imageMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.videoMessage?.caption
  data.isCmd = data.body?.substring(0, 1).match(process.env.PREFIX!)
    ? true
    : false

  data.cmd = data.isCmd ? data.body!.substring(1).split(' ')[0] : ''
  data.prefix = data.isCmd ? data.body!.substring(0, 1) : ''
  data.args = data.body?.replace(data.prefix + data.cmd, '').trim() || ''
  data.from = msg.key.remoteJid!
  data.fromMe = msg.key.fromMe
  data.name = msg.pushName
  data.quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
      ?.quotedMessage?.ephemeralMessage?.message
  data.isGroup = data.from.endsWith('@g.us')
  data.groupName = data.isGroup
    ? (await waSocket.groupMetadata(data.from)).subject
    : null
  data.isQuotedImage = data.quotedMsg?.imageMessage != null
  data.isQuotedVideo = data.quotedMsg?.videoMessage != null
  data.isQuoted = data.quotedMsg != null
  data.isImage =
    msg.message?.imageMessage != null ||
    msg.message?.ephemeralMessage?.message?.imageMessage != null
  data.isVideo =
    msg.message?.videoMessage != null ||
    msg.message?.ephemeralMessage?.message?.videoMessage != null
  data.isMedia =
    data.isImage || data.isVideo || data.isQuotedImage || data.isQuotedVideo

  data.config = config

  data.download = async () => {
    let msgData: WAMessage
    if (Object.keys(msg.message!)[0] == 'ephemeralMessage') {
      msgData = {
        key: msg.key,
        message: msg.message?.ephemeralMessage?.message,
      }
    } else {
      msgData = msg
    }
    return (await downloadMediaMessage(msgData, 'buffer', {})) as Buffer
  }
  data.downloadQuoted = async () => {
    return (await downloadMediaMessage(
      { key: msg.key, message: data.quotedMsg },
      'buffer',
      {}
    )) as Buffer
  }

  data.reply = async (text: string) => {
    await waSocket.sendMessage(data.from, { text: text }, { quoted: msg })
  }

  return data
}
