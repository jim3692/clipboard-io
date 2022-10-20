import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'

const SERVER = 'ntfy.sh'
const HTTP_ENDPOINT = `https://${SERVER}`
const WS_ENDPOINT = `wss://${SERVER}`

const CHANNEL_PREFIX = 'jim3692cbio'

const CHANNEL_LENGTH = 4
const TOKEN_LENGTH = 8
const SALT_LENGTH = 16

const SENDER_SERVER = 'server'
const SENDER_CLIENT = 'client'

const crypt = new OpenCrypto()

export default class ClipTransport {
  constructor ({ channelId, token, salt, onSocketConnected, onSocketData }) {
    const isServer = !channelId

    this.channelId = channelId
    this.token = token
    this.salt = salt
    this.messageCounter = isServer ? 0 : 1
    this.sender = isServer ? SENDER_SERVER : SENDER_CLIENT

    this.onSocketConnected = onSocketConnected
    this.onSocketData = onSocketData
  }

  async init () {
    this.channelId = this.channelId || await this.generateChannelId()
    this.token = this.token || await this.generateRandomString(TOKEN_LENGTH)
    this.salt = this.salt || await this.generateRandomString(SALT_LENGTH)

    this.connectToSocket()
  }

  connectToSocket () {
    if (this.socket?.readyState === window.WebSocket.OPEN) {
      this.socket.close()
    }

    this.socket = new window.WebSocket(`${WS_ENDPOINT}/${this.channelId}/ws`)

    this.socket.addEventListener('open', this.onSocketConnected.bind(this))
    this.socket.addEventListener('close', this.onSocketClosed.bind(this))
    this.socket.addEventListener('error', this.onSocketClosed.bind(this))
    this.socket.addEventListener('message', this.onSocketMessage.bind(this))
  }

  onSocketMessage (event) {
    const data = JSON.parse(event.data).message

    if (!data) {
      return
    }

    try {
      const payload = JSON.parse(data)

      if (!payload?.header || payload.header.sender === this.sender) {
        return
      }

      if (!payload.data || !payload.signature || !this.validateData(payload)) {
        console.log('Invalid signature')
        return
      }

      if (!payload.header.token || payload.header.token !== this.token) {
        console.log('Invalid token', payload.header.token)
        return
      }

      if (payload.header.counter !== this.messageCounter + 1) {
        console.log('Invalid counter', payload.header.counter)
        return
      }

      this.messageCounter += 2
      this.onSocketData(payload.data)
    } catch (err) {
      console.dir({ error: err.message, get data () { return data } })
    }
  }

  onSocketClosed () {
    this.connectToSocket()
  }

  async send (data) {
    const header = {
      token: this.token,
      counter: this.messageCounter,
      sender: this.sender
    }

    const signature = await this.signData({ header, data })

    await window.fetch(`${HTTP_ENDPOINT}/${this.channelId}`, {
      method: 'POST',
      body: JSON.stringify({ header, data, signature })
    })
  }

  async generateRandomString (bytes) {
    const arr = await crypt.getRandomBytes(bytes)
    const str = String.fromCharCode(...arr)
    return window.btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/m, '')
  }

  async generateChannelId () {
    const randomString = await this.generateRandomString(CHANNEL_LENGTH)
    return CHANNEL_PREFIX + randomString
  }

  async signData ({ header, data }) {
    const str = JSON.stringify({ header, data })
    return await crypt.hashPassphrase(str, new TextEncoder().encode(this.salt))
  }

  async validateData ({ header, data, signature }) {
    const hash = await this.signData({ header, data })
    return hash === signature
  }
}
